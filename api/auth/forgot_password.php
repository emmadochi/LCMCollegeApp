<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/email.php';

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
$email = sanitize_input($inputData['email'] ?? '');

if (empty($email)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Email address is required."]);
    exit();
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Invalid email format."]);
    exit();
}

try {
    // 1. Check if user exists
    $stmt = $conn->prepare("SELECT id, name FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user) {
        // For security, don't explicitly leak whether an email exists.
        // Return a generic success message.
        echo json_encode(["message" => "If the email is registered, a password reset link has been sent."]);
        exit();
    }
    
    // 2. Generate secure token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date("Y-m-d H:i:s", strtotime("+1 hour"));
    
    // 3. Purge existing resets for this email
    $stmtDelete = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    $stmtDelete->execute([$email]);
    
    // 4. Save new token
    $stmtInsert = $conn->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
    $stmtInsert->execute([$email, $token, $expiresAt]);
    
    // 5. Build dynamic link
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'] ?? 'lcmcollege.org';
    
    // Detect folder path (handles localhost subfolder vs root domain)
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    $pathParts = explode('/', $scriptName);
    array_pop($pathParts); // remove forgot_password.php
    array_pop($pathParts); // remove auth
    array_pop($pathParts); // remove api
    $basePath = implode('/', $pathParts);
    if ($basePath && substr($basePath, -1) !== '/') {
        $basePath .= '/';
    }
    
    $resetLink = "$protocol://$host" . $basePath . "course_web_app/reset_password.html?token=" . $token;
    
    // 6. Send recovery email
    $subject = "Reset Your Password - LCM Ministerial College";
    $content = '
        <p>Dear ' . escape_output($user['name']) . ',</p>
        <p>We received a request to reset your password for your LCM Ministerial College account.</p>
        <p>Click the button below to choose a new password. This link will expire in 1 hour.</p>
        <div class="button-container">
            <a href="' . $resetLink . '" class="button" target="_blank">Reset Password</a>
        </div>
        <p>If you cannot click the button, copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; font-size: 13px; color: #6b7280;">' . $resetLink . '</p>
        <p>If you did not request a password reset, please secure your email account and ignore this message.</p>
    ';
    
    $emailBody = get_email_template("Password Reset Request", $content);
    
    send_transactional_email($email, $subject, $emailBody);
    
    echo json_encode(["message" => "If the email is registered, a password reset link has been sent."]);
    
} catch (Exception $e) {
    secure_error_handler($e, "Failed to initiate password reset due to an internal server error.");
}
