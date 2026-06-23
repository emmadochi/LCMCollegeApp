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

// Get raw POST data
$inputData = json_decode(file_get_contents("php://input"), true);
$courseId = sanitize_input($inputData['courseId'] ?? $inputData['course_id'] ?? '');

if (empty($courseId)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Course ID is required."]);
    exit();
}

try {
    // Check if course exists
    $stmtCheckCourse = $conn->prepare("SELECT id FROM courses WHERE id = ?");
    $stmtCheckCourse->execute([$courseId]);
    if (!$stmtCheckCourse->fetch()) {
        header("HTTP/1.1 404 Not Found");
        echo json_encode(["message" => "Course not found."]);
        exit();
    }

    // Check if already requested
    $stmtCheckReq = $conn->prepare("SELECT id, status FROM certificate_requests WHERE user_id = ? AND course_id = ?");
    $stmtCheckReq->execute([$userId, $courseId]);
    $existing = $stmtCheckReq->fetch();
    
    if ($existing) {
        echo json_encode([
            "message" => "Certificate request already exists.",
            "status" => $existing['status']
        ]);
        exit();
    }

    // Generate secure UUID v4 for Request ID
    $uuidBytes = random_bytes(16);
    $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
    $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
    $requestId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

    // Insert certificate request
    $stmtInsert = $conn->prepare("
        INSERT INTO certificate_requests (id, user_id, course_id, status, requested_at) 
        VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    ");
    $stmtInsert->execute([$requestId, $userId, $courseId]);

    echo json_encode([
        "message" => "Certificate request submitted successfully.",
        "id" => $requestId,
        "status" => "pending"
    ]);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to submit certificate request due to an internal server error.");
}
