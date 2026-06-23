<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only GET method is allowed."]);
    exit();
}

$id = $_GET['id'] ?? '';
$featured = $_GET['featured'] ?? '';
$category = $_GET['category'] ?? '';

try {
    if (!empty($id)) {
        // Query single course detail
        $stmt = $conn->prepare("
            SELECT c.id, c.title, c.description, cat.name AS category, c.duration, c.rating, c.isFeatured, c.hasQuizzes, c.totalLessons, c.thumbnailUrl, c.price, c.currency 
            FROM courses c
            LEFT JOIN categories cat ON c.category_id = cat.id
            WHERE c.id = ?
        ");
        $stmt->execute([$id]);
        $course = $stmt->fetch();
        
        if ($course) {
            // Escape output to protect client apps from XSS injection payloads
            echo json_encode(escape_output($course));
        } else {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Course not found."]);
        }
    } else {
        // Query lists of courses with conditions
        $sql = "
            SELECT c.id, c.title, c.description, cat.name AS category, c.duration, c.rating, c.isFeatured, c.hasQuizzes, c.totalLessons, c.thumbnailUrl, c.price, c.currency 
            FROM courses c
            LEFT JOIN categories cat ON c.category_id = cat.id
        ";
        $params = [];
        $conditions = [];

        if ($featured === '1' || $featured === 'true') {
            $conditions[] = "c.isFeatured = 1";
        }
        
        if (!empty($category)) {
            $conditions[] = "cat.name = ?";
            $params[] = $category;
        }

        if (!empty($conditions)) {
            $sql .= " WHERE " . implode(" AND ", $conditions);
        }

        $sql .= " ORDER BY c.created_at DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $courses = $stmt->fetchAll();

        // Escape output to protect client apps from XSS injection payloads
        echo json_encode(escape_output($courses));
    }
} catch (Exception $e) {
    secure_error_handler($e, "Failed to load courses data due to an internal database error.");
}
