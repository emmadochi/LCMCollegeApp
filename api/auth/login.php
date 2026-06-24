<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/email.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only POST method is allowed."]);
    exit();
}

// Get raw POST data
$inputData = json_decode(file_get_contents("php://input"), true);

$email = sanitize_input($inputData['email'] ?? '');
$password = $inputData['password'] ?? '';

if (empty($email) || empty($password)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Email and password are required fields."]);
    exit();
}

// Fetch IP address for rate limiting
$ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// Check rate limit
if (!check_login_rate_limit($ipAddress, $conn)) {
    header("HTTP/1.1 429 Too Many Requests");
    echo json_encode(["message" => "Too many failed login attempts. Please try again after 15 minutes."]);
    exit();
}

try {
    // Select all users by email (since same email can have different roles)
    $stmt = $conn->prepare("SELECT id, name, password_hash, role, is_active, created_by FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $matchingUsers = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Resolve requested role from payload or referer header
    $requestedRole = sanitize_input($inputData['role'] ?? '');
    if (empty($requestedRole)) {
        $referer = $_SERVER['HTTP_REFERER'] ?? '';
        if (strpos($referer, '/@admin/') !== false) {
            $requestedRole = 'admin';
        } else if (strpos($referer, '/lecturer/') !== false) {
            $requestedRole = 'lecturer';
        } else if (strpos($referer, '/course_web_app/') !== false) {
            $requestedRole = 'student';
        }
    }

    $user = null;
    foreach ($matchingUsers as $u) {
        if (password_verify($password, $u['password_hash'])) {
            if (!empty($requestedRole)) {
                // If admin, we also allow coordinator (refer to admin auth.js checks)
                if ($requestedRole === 'admin' && in_array($u['role'], ['admin', 'coordinator'])) {
                    $user = $u;
                    break;
                } else if ($u['role'] === $requestedRole) {
                    $user = $u;
                    break;
                }
            } else {
                // No role specified, just take the first matching one
                $user = $u;
                break;
            }
        }
    }

    // Fallback if password was correct but requested role was not found: take the first user with correct password
    if (!$user && !empty($matchingUsers)) {
        foreach ($matchingUsers as $u) {
            if (password_verify($password, $u['password_hash'])) {
                $user = $u;
                break;
            }
        }
    }

    if ($user && (int)$user['is_active'] === 0) {
        header("HTTP/1.1 403 Forbidden");
        echo json_encode(["message" => "Your account has been deactivated. Please contact support."]);
        exit();
    }

    if ($user) {
        // Successful login: reset rate limit attempts
        record_login_attempt($ipAddress, true, $conn);

        // Generate JWT token
        $token = generate_jwt($user['id'], $user['role']);

        // Fetch enrolled course IDs
        $stmtEnroll = $conn->prepare("SELECT course_id FROM enrollments WHERE user_id = ?");
        $stmtEnroll->execute([$user['id']]);
        $enrolledCourses = $stmtEnroll->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // Fetch completed course IDs (where completed lessons >= total lessons)
        $stmtComplete = $conn->prepare("
            SELECT c.id 
            FROM courses c
            JOIN (
                SELECT course_id, COUNT(*) as total 
                FROM lessons 
                GROUP BY course_id
            ) l ON c.id = l.course_id
            JOIN (
                SELECT course_id, COUNT(*) as completed 
                FROM user_progress 
                WHERE user_id = ? AND is_completed = 1 
                GROUP BY course_id
            ) p ON c.id = p.course_id
            WHERE p.completed >= l.total AND l.total > 0
        ");
        $stmtComplete->execute([$user['id']]);
        $completedCourses = $stmtComplete->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // Send Login Alert Email
        $subject = "New Login to Your Account - Lifechangers Ministerial College";
        $loginTime = date("Y-m-d H:i:s");
        $loginContent = '
            <p>Dear ' . escape_output($user['name']) . ',</p>
            <p>We detected a new sign-in to your student account on ' . $loginTime . '.</p>
            <p><strong>IP Address:</strong> ' . $ipAddress . '</p>
            <p>If this was you, you do not need to take any action. If you do not recognize this login, please change your password immediately.</p>
        ';
        $emailBody = get_email_template("Security Notification", $loginContent);
        send_transactional_email($email, $subject, $emailBody);

        echo json_encode([
            "message" => "Login successful.",
            "token" => $token,
            "user" => [
                "id" => $user['id'],
                "name" => $user['name'],
                "email" => $email,
                "role" => $user['role'],
                "created_by" => $user['created_by'],
                "enrolledCourses" => $enrolledCourses,
                "completedCourses" => $completedCourses
            ]
        ]);
    } else {
        // Failed login: record attempt and increment rate limit
        record_login_attempt($ipAddress, false, $conn);

        header("HTTP/1.1 401 Unauthorized");
        echo json_encode(["message" => "Invalid email or password."]);
    }
} catch (Exception $e) {
    secure_error_handler($e, "Failed to authenticate user due to an internal server error.");
}
