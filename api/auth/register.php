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

$name = sanitize_input($inputData['name'] ?? '');
$email = sanitize_input($inputData['email'] ?? '');
$password = $inputData['password'] ?? '';

// Basic validations
if (empty($name) || empty($email) || empty($password)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Name, email, and password are required fields."]);
    exit();
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Invalid email format."]);
    exit();
}

// Enforce password strength (minimum 8 characters, at least one uppercase letter, one lowercase, one number)
if (strlen($password) < 8 || !preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number."]);
    exit();
}

try {
    // Check if email already exists with the same role
    $stmtCheck = $conn->prepare("SELECT id FROM users WHERE email = ? AND role = ?");
    $stmtCheck->execute([$email, $role]);
    if ($stmtCheck->fetch()) {
        header("HTTP/1.1 409 Conflict");
        echo json_encode(["message" => "A user with this email address and role already exists."]);
        exit();
    }

    // Generate secure UUID v4 for user ID
    $uuidBytes = random_bytes(16);
    $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40); // set version to 4
    $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80); // set variant to RFC 4122
    $userId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

    // Hash password securely (BCRYPT is safe and standard)
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $role = 'student'; // Default role is student

    // Insert user into database
    $stmtInsert = $conn->prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)");
    $stmtInsert->execute([$userId, $name, $email, $passwordHash, $role]);

    // Send Welcome Email
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'] ?? 'lcmcollege.org';
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    $pathParts = explode('/', $scriptName);
    array_pop($pathParts); // remove register.php
    array_pop($pathParts); // remove auth
    array_pop($pathParts); // remove api
    $basePath = implode('/', $pathParts);
    if (empty($basePath) || $basePath === '/') {
        $basePath = '/';
    } else {
        if (substr($basePath, 0, 1) !== '/') {
            $basePath = '/' . $basePath;
        }
        if (substr($basePath, -1) !== '/') {
            $basePath .= '/';
        }
    }
    
    $portalUrl = "$protocol://$host" . $basePath . "course_web_app/";
    $subject = "Welcome to Lifechangers Ministerial College!";
    $welcomeContent = '
        <p>Dear ' . escape_output($name) . ',</p>
        <p>Welcome! We are excited to have you join us at Lifechangers Ministerial College.</p>
        <p>Your student account has been registered successfully. You can now log in, enroll in theology courses, and start your ministry training journey.</p>
        <div class="button-container">
            <a href="' . $portalUrl . '" class="button">Log In to Portal</a>
        </div>
        <p>May your faith and learning journey be blessed!</p>
    ';
    $emailBody = get_email_template("Welcome, " . escape_output($name) . "!", $welcomeContent);
    send_transactional_email($email, $subject, $emailBody);

    header("HTTP/1.1 201 Created");
    echo json_encode([
        "message" => "User registered successfully.",
        "user" => [
            "id" => $userId,
            "name" => $name,
            "email" => $email,
            "role" => $role,
            "enrolledCourses" => [],
            "completedCourses" => []
        ]
    ]);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to register user due to an internal server error.");
}
