<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Enforce Role-Based Access Control: Only admins can manage admins
$currentUser = require_auth(['admin']);
$currentUserId = $currentUser['userId'];

header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        listAdmins($conn);
        break;

    case 'POST':
        createAdmin($conn, $currentUserId);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents("php://input"), true);
        if (isset($input['action']) && $input['action'] === 'change_password') {
            changeAdminPassword($conn, $currentUserId);
        } else {
            updateAdminStatus($conn, $currentUserId);
        }
        break;

    case 'DELETE':
        deleteAdmin($conn, $currentUserId);
        break;

    default:
        header("HTTP/1.1 405 Method Not Allowed");
        echo json_encode(["message" => "Method not allowed."]);
        break;
}

/**
 * List all administrators
 */
function listAdmins($conn) {
    try {
        $stmt = $conn->prepare("
            SELECT u.id, u.name, u.email, u.created_by, u.is_active, u.created_at, creator.name AS creator_name
            FROM users u
            LEFT JOIN users creator ON creator.id = u.created_by
            WHERE u.role = 'admin'
            ORDER BY u.name ASC
        ");
        $stmt->execute();
        $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(array_map(function($a) {
            return [
                'id' => $a['id'],
                'name' => escape_output($a['name']),
                'email' => escape_output($a['email']),
                'created_by' => $a['created_by'],
                'creator_name' => $a['creator_name'] ? escape_output($a['creator_name']) : null,
                'is_active' => (bool)$a['is_active'],
                'created_at' => $a['created_at']
            ];
        }, $admins));
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to retrieve admins.");
    }
}

/**
 * Register a new administrator
 */
function createAdmin($conn, $creatorId) {
    $inputData = json_decode(file_get_contents("php://input"), true);
    
    $name = sanitize_input($inputData['name'] ?? '');
    $email = sanitize_input($inputData['email'] ?? '');
    $password = $inputData['password'] ?? '';

    if (empty($name) || empty($email) || empty($password)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Name, email, and password are required fields."]);
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Invalid email format."]);
        return;
    }

    if (strlen($password) < 8 || !preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number."]);
        return;
    }

    try {
        // Check if email already exists
        $stmtCheck = $conn->prepare("SELECT id FROM users WHERE email = ?");
        $stmtCheck->execute([$email]);
        if ($stmtCheck->fetch()) {
            header("HTTP/1.1 409 Conflict");
            echo json_encode(["message" => "A user with this email address already exists."]);
            return;
        }

        // Generate secure UUID v4 for admin ID
        $uuidBytes = random_bytes(16);
        $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
        $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
        $userId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $conn->prepare("INSERT INTO users (id, name, email, password_hash, role, created_by, is_active) VALUES (?, ?, ?, ?, 'admin', ?, 1)");
        $stmt->execute([$userId, $name, $email, $passwordHash, $creatorId]);

        header("HTTP/1.1 201 Created");
        echo json_encode([
            "message" => "Administrator registered successfully.",
            "id" => $userId
        ]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to register administrator.");
    }
}

/**
 * Deactivate or Activate an administrator
 */
function updateAdminStatus($conn, $currentUserId) {
    $inputData = json_decode(file_get_contents("php://input"), true);
    $targetAdminId = sanitize_input($inputData['id'] ?? '');
    $status = isset($inputData['is_active']) ? (int)$inputData['is_active'] : null;

    if (empty($targetAdminId) || $status === null) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Admin ID and is_active status are required."]);
        return;
    }

    try {
        // Check creator protections: Find if targetAdminId is the creator of currentUserId
        $stmtCheck = $conn->prepare("SELECT created_by FROM users WHERE id = ?");
        $stmtCheck->execute([$currentUserId]);
        $creatorId = $stmtCheck->fetchColumn();

        if ($creatorId && $creatorId === $targetAdminId) {
            header("HTTP/1.1 403 Forbidden");
            echo json_encode(["message" => "Security Violation: You are not permitted to deactivate the administrator who registered you."]);
            return;
        }

        // Apply state change
        $stmtUpdate = $conn->prepare("UPDATE users SET is_active = ? WHERE id = ? AND role = 'admin'");
        $stmtUpdate->execute([$status, $targetAdminId]);

        if ($stmtUpdate->rowCount() === 0) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Administrator not found."]);
            return;
        }

        echo json_encode(["message" => "Administrator status updated successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to update administrator status.");
    }
}

/**
 * Delete an administrator
 */
function deleteAdmin($conn, $currentUserId) {
    $targetAdminId = sanitize_input($_GET['id'] ?? '');

    if (empty($targetAdminId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Admin ID is required."]);
        return;
    }

    try {
        // Check creator protections: Find if targetAdminId is the creator of currentUserId
        $stmtCheck = $conn->prepare("SELECT created_by FROM users WHERE id = ?");
        $stmtCheck->execute([$currentUserId]);
        $creatorId = $stmtCheck->fetchColumn();

        if ($creatorId && $creatorId === $targetAdminId) {
            header("HTTP/1.1 403 Forbidden");
            echo json_encode(["message" => "Security Violation: You are not permitted to delete the administrator who registered you."]);
            return;
        }

        // Prevent self-deletion if desired (optional but good practice)
        if ($targetAdminId === $currentUserId) {
            header("HTTP/1.1 400 Bad Request");
            echo json_encode(["message" => "You cannot delete your own account."]);
            return;
        }

        $stmtDelete = $conn->prepare("DELETE FROM users WHERE id = ? AND role = 'admin'");
        $stmtDelete->execute([$targetAdminId]);

        if ($stmtDelete->rowCount() === 0) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Administrator not found."]);
            return;
        }

        echo json_encode(["message" => "Administrator deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete administrator.");
    }
}

/**
 * Change administrator password by superadmin
 */
function changeAdminPassword($conn, $currentUserId) {
    $inputData = json_decode(file_get_contents("php://input"), true);
    $targetAdminId = sanitize_input($inputData['id'] ?? '');
    $newPassword = $inputData['password'] ?? '';

    if (empty($targetAdminId) || empty($newPassword)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Admin ID and new password are required fields."]);
        return;
    }

    if (strlen($newPassword) < 8 || !preg_match('/[A-Z]/', $newPassword) || !preg_match('/[a-z]/', $newPassword) || !preg_match('/[0-9]/', $newPassword)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number."]);
        return;
    }

    try {
        // Enforce the rule: the current user MUST be the creator of the target admin.
        $stmtCheck = $conn->prepare("SELECT created_by FROM users WHERE id = ? AND role = 'admin'");
        $stmtCheck->execute([$targetAdminId]);
        $creatorId = $stmtCheck->fetchColumn();

        if (!$creatorId) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Administrator not found."]);
            return;
        }

        if ($creatorId !== $currentUserId) {
            header("HTTP/1.1 403 Forbidden");
            echo json_encode(["message" => "Security Violation: You can only change the password of administrators you registered yourself."]);
            return;
        }

        // Update password
        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $stmtUpdate = $conn->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmtUpdate->execute([$passwordHash, $targetAdminId]);

        echo json_encode(["message" => "Administrator password updated successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to update administrator password.");
    }
}
