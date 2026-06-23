<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only POST method is allowed."]);
    exit();
}

// Enforce JWT authentication
$currentUser = validate_jwt();
$userId = $currentUser['userId'];
$userRole = $currentUser['role']; // student, lecturer, coordinator, admin

// Map sender role
$senderRole = 'student';
if ($userRole === 'lecturer' || $userRole === 'admin' || $userRole === 'coordinator') {
    $senderRole = 'lecturer';
}

// Get raw POST data
$inputData = json_decode(file_get_contents("php://input"), true);
$courseId = sanitize_input($inputData['course_id'] ?? $inputData['courseId'] ?? '');
$message = trim($inputData['message'] ?? '');

if (empty($courseId) || empty($message)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Course ID and message are required."]);
    exit();
}

try {
    // If student is sending, student_id is they themselves.
    // If lecturer is sending, they must pass student_id to specify which student thread they are replying to.
    if ($senderRole === 'student') {
        $studentId = $userId;
    } else {
        $studentId = sanitize_input($inputData['student_id'] ?? $inputData['studentId'] ?? '');
        if (empty($studentId)) {
            header("HTTP/1.1 400 Bad Request");
            echo json_encode(["message" => "Student ID is required when sending as lecturer."]);
            exit();
        }
    }

    // Verify course exists
    $stmtCheckCourse = $conn->prepare("SELECT id FROM courses WHERE id = ?");
    $stmtCheckCourse->execute([$courseId]);
    if (!$stmtCheckCourse->fetch()) {
        header("HTTP/1.1 404 Not Found");
        echo json_encode(["message" => "Course not found."]);
        exit();
    }

    // Generate UUID for the message ID
    $stmtUuid = $conn->query("SELECT UUID() as uuid");
    $uuidRow = $stmtUuid->fetch();
    $messageId = $uuidRow['uuid'];

    // Insert message
    $stmtInsert = $conn->prepare("
        INSERT INTO chat_messages (id, course_id, student_id, sender_id, sender_role, message, is_read, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    ");
    $stmtInsert->execute([$messageId, $courseId, $studentId, $userId, $senderRole, $message]);

    echo json_encode([
        "message" => "Message sent successfully.",
        "chat" => [
            "id" => $messageId,
            "course_id" => $courseId,
            "student_id" => $studentId,
            "sender_id" => $userId,
            "sender_role" => $senderRole,
            "message" => escape_output($message),
            "sent_at" => date("Y-m-d H:i:s")
        ]
    ]);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to send chat message.");
}
