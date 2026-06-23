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

// Enforce JWT authentication to secure curriculum access
$currentUser = validate_jwt();

$courseId = $_GET['course_id'] ?? '';
$id = $_GET['id'] ?? '';

if (empty($courseId) && empty($id)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Course ID (course_id) or Lesson ID (id) is required."]);
    exit();
}

try {
    if (!empty($id)) {
        // Query single lesson detail
        $stmt = $conn->prepare("
            SELECT id, course_id, module_id, title, contentType, videoSource, contentUrl, notes, order_index, hasQuiz 
            FROM lessons 
            WHERE id = ?
        ");
        $stmt->execute([$id]);
        $lesson = $stmt->fetch();
        
        if ($lesson) {
            $escaped = [
                "id" => escape_output($lesson['id']),
                "course_id" => escape_output($lesson['course_id']),
                "module_id" => escape_output($lesson['module_id']),
                "title" => escape_output($lesson['title']),
                "contentType" => escape_output($lesson['contentType']),
                "videoSource" => escape_output($lesson['videoSource']),
                "contentUrl" => escape_output($lesson['contentUrl']),
                "notes" => $lesson['notes'], // Preserving HTML notes content
                "order_index" => (int)$lesson['order_index'],
                "hasQuiz" => (bool)$lesson['hasQuiz']
            ];
            echo json_encode($escaped);
        } else {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Lesson not found."]);
        }
        exit();
    }

    // Check if course exists first
    $stmtCourse = $conn->prepare("SELECT id FROM courses WHERE id = ?");
    $stmtCourse->execute([$courseId]);
    if (!$stmtCourse->fetch()) {
        header("HTTP/1.1 404 Not Found");
        echo json_encode(["message" => "Course not found."]);
        exit();
    }

    // Query lessons in order
    $stmt = $conn->prepare("
        SELECT id, course_id, module_id, title, contentType, videoSource, contentUrl, notes, order_index, hasQuiz 
        FROM lessons 
        WHERE course_id = ? 
        ORDER BY order_index ASC
    ");
    $stmt->execute([$courseId]);
    $lessons = $stmt->fetchAll();

    // Escape outputs (except potentially the 'notes' field which contains HTML rich-text, but we should sanitise it.
    // Wait: notes contains HTML course contents. If we run standard htmlspecialchars on HTML, it will display raw code.
    // So for 'notes', we can run HTML sanitisation or allow it while sanitising dangerous tags, or escape other fields and keep notes.
    // For standard safety: escape all text fields, but for 'notes', let's either clean it or preserve it if it contains safe HTML.
    // Let's implement a loop where we escape everything except 'notes', which we output as-is, or run through HTML sanitisation.
    // In our security model, notes are input only by administrators, but escaping it fully would break the formatting.
    // Let's run a custom escape logic:
    $escapedLessons = [];
    foreach ($lessons as $lesson) {
        $escapedLessons[] = [
            "id" => escape_output($lesson['id']),
            "course_id" => escape_output($lesson['course_id']),
            "module_id" => escape_output($lesson['module_id']),
            "title" => escape_output($lesson['title']),
            "contentType" => escape_output($lesson['contentType']),
            "videoSource" => escape_output($lesson['videoSource']),
            "contentUrl" => escape_output($lesson['contentUrl']),
            "notes" => $lesson['notes'], // Preserving HTML notes content (written by trusted admins)
            "order_index" => (int)$lesson['order_index'],
            "hasQuiz" => (bool)$lesson['hasQuiz']
        ];
    }

    echo json_encode($escapedLessons);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to retrieve curriculum data due to an internal server error.");
}
