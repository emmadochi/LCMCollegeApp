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

// Enforce JWT authentication
$currentUser = validate_jwt();
$userId = $currentUser['userId'];
$userRole = $currentUser['role']; // student, lecturer, coordinator, admin

$courseId = sanitize_input($_GET['course_id'] ?? $_GET['courseId'] ?? '');
if (empty($courseId)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Course ID is required."]);
    exit();
}

try {
    // Determine the student thread we are retrieving
    if ($userRole === 'student') {
        $studentId = $userId;
    } else {
        $studentId = sanitize_input($_GET['student_id'] ?? $_GET['studentId'] ?? '');
        if (empty($studentId)) {
            header("HTTP/1.1 400 Bad Request");
            echo json_encode(["message" => "Student ID is required when fetching as lecturer."]);
            exit();
        }
    }

    // Optional: Get messages since a specific timestamp to minimize payload size during long polls
    $since = sanitize_input($_GET['since'] ?? '');

    // Fetch messages
    if (!empty($since)) {
        $stmt = $conn->prepare("
            SELECT id, course_id, student_id, sender_id, sender_role, message, is_read, sent_at
            FROM chat_messages
            WHERE course_id = ? AND student_id = ? AND sent_at > ?
            ORDER BY sent_at ASC, seq ASC
        ");
        $stmt->execute([$courseId, $studentId, $since]);
    } else {
        $stmt = $conn->prepare("
            SELECT id, course_id, student_id, sender_id, sender_role, message, is_read, sent_at
            FROM chat_messages
            WHERE course_id = ? AND student_id = ?
            ORDER BY sent_at ASC, seq ASC
        ");
        $stmt->execute([$courseId, $studentId]);
    }
    
    $messages = $stmt->fetchAll() ?: [];

    // Mark messages sent by the *other* party as read
    $targetSenderRole = ($userRole === 'student') ? 'lecturer' : 'student';
    $stmtMarkRead = $conn->prepare("
        UPDATE chat_messages
        SET is_read = 1
        WHERE course_id = ? AND student_id = ? AND sender_role = ? AND is_read = 0
    ");
    $stmtMarkRead->execute([$courseId, $studentId, $targetSenderRole]);

    // Escape messages for safety
    foreach ($messages as &$msg) {
        $msg['message'] = escape_output($msg['message']);
    }

    echo json_encode([
        "messages" => $messages
    ]);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to retrieve chat messages.");
}
