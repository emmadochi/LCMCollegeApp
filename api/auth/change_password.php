<?php
/**
 * Change Password Endpoint
 * POST /api/auth/change_password.php
 *
 * Requires:
 *   - Authorization: Bearer <jwt>  header
 *   - JSON body: { currentPassword, newPassword, confirmPassword }
 *
 * Rules enforced:
 *   - currentPassword must match the stored hash
 *   - newPassword: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
 *   - newPassword must not equal currentPassword
 *   - confirmPassword must match newPassword
 */
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// JSON response
header("Content-Type: application/json; charset=UTF-8");

// Only POST allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Only POST method is allowed."]);
    exit();
}

// Authenticate caller — returns ['userId', 'role', ...]
$currentUserPayload = validate_jwt();
$userId = $currentUserPayload['userId'];

// Parse request body
$input = json_decode(file_get_contents("php://input"), true);

$currentPassword  = $input['currentPassword']  ?? '';
$newPassword      = $input['newPassword']      ?? '';
$confirmPassword  = $input['confirmPassword']  ?? '';

// ---- Basic presence checks ----
if (empty($currentPassword) || empty($newPassword) || empty($confirmPassword)) {
    http_response_code(400);
    echo json_encode(["message" => "All three password fields are required."]);
    exit();
}

// ---- Confirm match ----
if ($newPassword !== $confirmPassword) {
    http_response_code(400);
    echo json_encode(["message" => "New password and confirmation do not match."]);
    exit();
}

// ---- Strength rules (mirrors register.php) ----
if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(["message" => "New password must be at least 8 characters long."]);
    exit();
}
if (!preg_match('/[A-Z]/', $newPassword)) {
    http_response_code(400);
    echo json_encode(["message" => "New password must include at least one uppercase letter."]);
    exit();
}
if (!preg_match('/[a-z]/', $newPassword)) {
    http_response_code(400);
    echo json_encode(["message" => "New password must include at least one lowercase letter."]);
    exit();
}
if (!preg_match('/[0-9]/', $newPassword)) {
    http_response_code(400);
    echo json_encode(["message" => "New password must include at least one number."]);
    exit();
}

try {
    // ---- Fetch current hash from DB ----
    $stmt = $conn->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(["message" => "User account not found."]);
        exit();
    }

    // ---- Verify current password ----
    if (!password_verify($currentPassword, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(["message" => "Your current password is incorrect."]);
        exit();
    }

    // ---- Reject same password ----
    if (password_verify($newPassword, $user['password_hash'])) {
        http_response_code(400);
        echo json_encode(["message" => "New password must be different from your current password."]);
        exit();
    }

    // ---- Hash and save ----
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmtUpdate = $conn->prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmtUpdate->execute([$newHash, $userId]);

    echo json_encode(["message" => "Password changed successfully. Please sign in again with your new password."]);

} catch (Exception $e) {
    secure_error_handler($e, "Failed to change password due to an internal server error.");
}
