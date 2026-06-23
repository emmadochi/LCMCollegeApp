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
    // Check if email already exists
    $stmtCheck = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmtCheck->execute([$email]);
    if ($stmtCheck->fetch()) {
        header("HTTP/1.1 409 Conflict");
        echo json_encode(["message" => "A user with this email address already exists."]);
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
