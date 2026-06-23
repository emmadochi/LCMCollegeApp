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

$lessonId = $_GET['lesson_id'] ?? $_GET['lessonId'] ?? '';

if (empty($lessonId)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Lesson ID parameter (lesson_id) is required."]);
    exit();
}

try {
    $stmt = $conn->prepare("
        SELECT id, lesson_id, course_id, title, instructions, due_date, created_at 
        FROM assignments 
        WHERE lesson_id = ?
    ");
    $stmt->execute([$lessonId]);
    $assignment = $stmt->fetch();

    if ($assignment) {
        $formatted = [
            "id" => $assignment['id'],
            "lessonId" => $assignment['lesson_id'],
            "courseId" => $assignment['course_id'],
            "title" => escape_output($assignment['title']),
            "instructions" => $assignment['instructions'], // Preserve HTML instructions from admin
            "dueDate" => $assignment['due_date'],
            "createdAt" => $assignment['created_at']
        ];
        echo json_encode($formatted);
    } else {
        // Return null or 404. For Flutter stream expectation, returning null or empty object is fine.
        // Let's return null to signify no assignment.
        echo json_encode(null);
    }
} catch (Exception $e) {
    secure_error_handler($e, "Failed to retrieve assignment due to an internal server error.");
}
