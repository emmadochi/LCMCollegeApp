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
        $inputData = json_decode(file_get_contents("php://input"), true);
        $action = $inputData['action'] ?? 'create';

        if ($action === 'update') {
            handleUpdateLesson($conn, $inputData);
        } else {
            handleCreateLesson($conn, $inputData);
        }
        break;

    case 'DELETE':
        $lessonId = $_GET['id'] ?? '';
        handleDeleteLesson($conn, $lessonId);
        break;

    default:
        header("HTTP/1.1 405 Method Not Allowed");
        echo json_encode(["message" => "Method not allowed. Use POST or DELETE."]);
        break;
}

/**
 * Recalculate and update the total lessons count on a course
 */
function updateCourseLessonCount($conn, $courseId) {
    try {
        $stmtCount = $conn->prepare("SELECT COUNT(*) as total FROM lessons WHERE course_id = ?");
        $stmtCount->execute([$courseId]);
        $row = $stmtCount->fetch();
        $total = $row ? (int)$row['total'] : 0;

        $stmtUpdate = $conn->prepare("UPDATE courses SET totalLessons = ? WHERE id = ?");
        $stmtUpdate->execute([$total, $courseId]);
    } catch (Exception $e) {
        error_log("Failed to update course lesson count: " . $e->getMessage());
    }
}

/**
 * Handle new lesson creation
 */
function handleCreateLesson($conn, $data) {
    $courseId = sanitize_input($data['courseId'] ?? '');
    $moduleId = sanitize_input($data['moduleId'] ?? 'General');
    $title = sanitize_input($data['title'] ?? '');
    $contentType = sanitize_input($data['contentType'] ?? 'video');
    $videoSource = sanitize_input($data['videoSource'] ?? 'link');
    $contentUrl = sanitize_input($data['contentUrl'] ?? '');
    $notes = $data['notes'] ?? ''; // Keep raw HTML since notes are written in a trusted admin editor
    
    if (empty($courseId) || empty($title)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course ID and Lesson Title are required fields."]);
        exit();
    }

    try {
        // Generate UUID v4 for Lesson ID
        $uuidBytes = random_bytes(16);
        $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
        $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
        $lessonId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

        // Get the current order index
        $stmtOrder = $conn->prepare("SELECT COUNT(*) as count FROM lessons WHERE course_id = ?");
        $stmtOrder->execute([$courseId]);
        $orderRow = $stmtOrder->fetch();
        $orderIndex = ($orderRow ? (int)$orderRow['count'] : 0) + 1;

        $stmt = $conn->prepare("
            INSERT INTO lessons (id, course_id, module_id, title, contentType, videoSource, contentUrl, notes, order_index, hasQuiz)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ");
        $stmt->execute([$lessonId, $courseId, $moduleId, $title, $contentType, $videoSource, $contentUrl, $notes, $orderIndex]);

        // Recalculate lessons count on course
        updateCourseLessonCount($conn, $courseId);

        header("HTTP/1.1 201 Created");
        echo json_encode([
            "message" => "Lesson created successfully.",
            "id" => $lessonId
        ]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to create lesson.");
    }
}

/**
 * Handle lesson updates
 */
function handleUpdateLesson($conn, $data) {
    $id = sanitize_input($data['id'] ?? '');
    $title = sanitize_input($data['title'] ?? '');
    $moduleId = sanitize_input($data['moduleId'] ?? '');
    $videoSource = sanitize_input($data['videoSource'] ?? '');
    $contentUrl = sanitize_input($data['contentUrl'] ?? '');
    $notes = $data['notes'] ?? ''; // Keep raw HTML since notes are written in a trusted admin editor

    if (empty($id) || empty($title)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Lesson ID and Lesson Title are required fields to update."]);
        exit();
    }

    try {
        // Fetch existing lesson to check course reference
        $stmtCheck = $conn->prepare("SELECT course_id FROM lessons WHERE id = ?");
        $stmtCheck->execute([$id]);
        $lesson = $stmtCheck->fetch();
        
        if (!$lesson) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Lesson to update not found."]);
            exit();
        }

        $courseId = $lesson['course_id'];

        $sql = "UPDATE lessons SET title = ?";
        $params = [$title];

        if (!empty($moduleId)) {
            $sql .= ", module_id = ?";
            $params[] = $moduleId;
        }

        if (!empty($videoSource)) {
            $sql .= ", videoSource = ?";
            $params[] = $videoSource;
        }

        if ($contentUrl !== null) {
            $sql .= ", contentUrl = ?";
            $params[] = $contentUrl;
        }

        if ($notes !== null) {
            $sql .= ", notes = ?";
            $params[] = $notes;
        }

        $sql .= " WHERE id = ?";
        $params[] = $id;

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);

        echo json_encode(["message" => "Lesson updated successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to update lesson.");
    }
}

/**
 * Handle lesson deletion
 */
function handleDeleteLesson($conn, $lessonId) {
    if (empty($lessonId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Lesson ID is required to delete."]);
        exit();
    }

    try {
        // Fetch existing lesson to grab course reference for recount
        $stmtCheck = $conn->prepare("SELECT course_id FROM lessons WHERE id = ?");
        $stmtCheck->execute([$lessonId]);
        $lesson = $stmtCheck->fetch();
        
        if (!$lesson) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Lesson not found."]);
            exit();
        }

        $courseId = $lesson['course_id'];

        $stmt = $conn->prepare("DELETE FROM lessons WHERE id = ?");
        $stmt->execute([$lessonId]);

        // Recalculate lessons count on course
        updateCourseLessonCount($conn, $courseId);

        echo json_encode(["message" => "Lesson deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete lesson.");
    }
}
