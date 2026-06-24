<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set headers
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only POST method is allowed."]);
    exit();
}

$inputData = json_decode(file_get_contents("php://input"), true);
$token = sanitize_input($inputData['token'] ?? '');
$password = $inputData['password'] ?? '';

if (empty($token) || empty($password)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Token and new password are required fields."]);
    exit();
}

// Enforce password strength
if (strlen($password) < 8 || !preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number."]);
    exit();
}

try {
    // 1. Fetch valid token
    $stmt = $conn->prepare("SELECT email, expires_at FROM password_resets WHERE token = ?");
    $stmt->execute([$token]);
    $reset = $stmt->fetch();
    
    if (!$reset) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Invalid or expired password reset link."]);
        exit();
    }
    
    // Check expiration
    if (strtotime($reset['expires_at']) < time()) {
        // Delete expired token
        $stmtDel = $conn->prepare("DELETE FROM password_resets WHERE token = ?");
        $stmtDel->execute([$token]);
        
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "This password reset link has expired."]);
        exit();
    }
    
    $email = $reset['email'];
    
    // 2. Hash and update password
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $stmtUpdate = $conn->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
    $stmtUpdate->execute([$passwordHash, $email]);
    
    // 3. Purge token
    $stmtDel = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    $stmtDel->execute([$email]);
    
    echo json_encode(["message" => "Your password has been reset successfully. You can now log in."]);
    
} catch (Exception $e) {
    secure_error_handler($e, "Failed to reset password due to an internal server error.");
}
