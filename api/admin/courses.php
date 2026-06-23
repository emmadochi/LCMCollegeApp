<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Enforce Role-Based Access Control (RBAC) - Must be Admin or Coordinator
$currentUser = require_auth(['admin', 'coordinator']);

header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'POST':
        // Handle Create or Update depending on action
        $inputData = json_decode(file_get_contents("php://input"), true);
        $action = $inputData['action'] ?? 'create';

        if ($action === 'update') {
            handleUpdateCourse($conn, $inputData);
        } else {
            handleCreateCourse($conn, $inputData);
        }
        break;

    case 'DELETE':
        // Handle Delete course
        $courseId = $_GET['id'] ?? '';
        handleDeleteCourse($conn, $courseId);
        break;

    default:
        header("HTTP/1.1 405 Method Not Allowed");
        echo json_encode(["message" => "Method not allowed. Use POST or DELETE."]);
        break;
}

/**
 * Find or create a category name and return its ID
 */
function getCategoryId($conn, $categoryName) {
    $categoryName = sanitize_input($categoryName);
    if (empty($categoryName)) {
        return null;
    }

    $stmt = $conn->prepare("SELECT id FROM categories WHERE name = ?");
    $stmt->execute([$categoryName]);
    $row = $stmt->fetch();
    
    if ($row) {
        return (int)$row['id'];
    } else {
        // Insert new category
        $stmtInsert = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
        $stmtInsert->execute([$categoryName]);
        return (int)$conn->lastInsertId();
    }
}

/**
 * Handle new course creation
 */
function handleCreateCourse($conn, $data) {
    $title = sanitize_input($data['title'] ?? '');
    $description = sanitize_input($data['description'] ?? '');
    $category = sanitize_input($data['category'] ?? '');
    $duration = sanitize_input($data['duration'] ?? 'Self-paced');
    $rating = parseFloat($data['rating'] ?? 4.8);
    $isFeatured = !empty($data['isFeatured']) ? 1 : 0;
    $hasQuizzes = isset($data['hasQuizzes']) && $data['hasQuizzes'] === false ? 0 : 1;
    $thumbnailUrl = sanitize_input($data['thumbnailUrl'] ?? '');
    $price = parseFloat($data['price'] ?? 0.00);
    $currency = sanitize_input($data['currency'] ?? 'USD');

    if (empty($title)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course title is required."]);
        exit();
    }

    try {
        $categoryId = getCategoryId($conn, $category);

        // Generate UUID v4 for Course ID
        $uuidBytes = random_bytes(16);
        $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
        $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
        $courseId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

        $stmt = $conn->prepare("
            INSERT INTO courses (id, title, description, category_id, duration, rating, isFeatured, hasQuizzes, totalLessons, thumbnailUrl, price, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        ");
        $stmt->execute([$courseId, $title, $description, $categoryId, $duration, $rating, $isFeatured, $hasQuizzes, $thumbnailUrl, $price, $currency]);

        header("HTTP/1.1 201 Created");
        echo json_encode([
            "message" => "Course created successfully.",
            "id" => $courseId
        ]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to create course.");
    }
}

/**
 * Handle course updates
 */
function handleUpdateCourse($conn, $data) {
    $id = sanitize_input($data['id'] ?? '');
    $title = sanitize_input($data['title'] ?? '');
    $description = sanitize_input($data['description'] ?? '');
    $category = sanitize_input($data['category'] ?? '');
    $duration = sanitize_input($data['duration'] ?? 'Self-paced');
    $rating = parseFloat($data['rating'] ?? 4.8);
    $isFeatured = !empty($data['isFeatured']) ? 1 : 0;
    $hasQuizzes = isset($data['hasQuizzes']) && $data['hasQuizzes'] === false ? 0 : 1;
    $thumbnailUrl = sanitize_input($data['thumbnailUrl'] ?? '');
    $price = parseFloat($data['price'] ?? 0.00);
    $currency = sanitize_input($data['currency'] ?? 'USD');

    if (empty($id) || empty($title)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course ID and Title are required to update."]);
        exit();
    }

    try {
        // Verify course exists
        $stmtCheck = $conn->prepare("SELECT id FROM courses WHERE id = ?");
        $stmtCheck->execute([$id]);
        if (!$stmtCheck->fetch()) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Course to update not found."]);
            exit();
        }

        $categoryId = getCategoryId($conn, $category);

        $sql = "UPDATE courses SET title = ?, description = ?, category_id = ?, duration = ?, rating = ?, isFeatured = ?, hasQuizzes = ?, price = ?, currency = ?";
        $params = [$title, $description, $categoryId, $duration, $rating, $isFeatured, $hasQuizzes, $price, $currency];

        if (!empty($thumbnailUrl)) {
            $sql .= ", thumbnailUrl = ?";
            $params[] = $thumbnailUrl;
        }

        $sql .= " WHERE id = ?";
        $params[] = $id;

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);

        echo json_encode(["message" => "Course updated successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to update course.");
    }
}

/**
 * Handle course deletion
 */
function handleDeleteCourse($conn, $courseId) {
    if (empty($courseId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course ID is required to delete."]);
        exit();
    }

    try {
        $stmtCheck = $conn->prepare("SELECT id FROM courses WHERE id = ?");
        $stmtCheck->execute([$courseId]);
        if (!$stmtCheck->fetch()) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Course not found."]);
            exit();
        }

        $stmt = $conn->prepare("DELETE FROM courses WHERE id = ?");
        $stmt->execute([$courseId]);

        echo json_encode(["message" => "Course deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete course.");
    }
}

/**
 * Safely parse float values
 */
function parseFloat($value) {
    return floatval(filter_var($value, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION));
}
