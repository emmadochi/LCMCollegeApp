<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Return Google Client ID so frontend can initialize SDK
    if (isset($_GET['action']) && $_GET['action'] === 'client_id') {
        echo json_encode(["client_id" => GOOGLE_CLIENT_ID]);
        exit();
    }
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Invalid action."]);
    exit();
}

if ($method !== 'POST') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only POST and GET methods are allowed."]);
    exit();
}

// Get raw POST data
$inputData = json_decode(file_get_contents("php://input"), true);
$idToken = $inputData['id_token'] ?? '';

if (empty($idToken)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "ID Token is required."]);
    exit();
}

try {
    // Validate ID Token with Google API TokenInfo
    $url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($idToken);
    
    // Set timeout options for secure fetch
    $opts = [
        "http" => [
            "method" => "GET",
            "timeout" => 10,
            "header" => "User-Agent: LCM-College-Auth/1.0\r\n"
        ]
    ];
    $context = stream_context_create($opts);
    $responseJson = @file_get_contents($url, false, $context);
    
    if ($responseJson === false) {
        header("HTTP/1.1 401 Unauthorized");
        echo json_encode(["message" => "Failed to verify ID token with Google."]);
        exit();
    }
    
    $payload = json_decode($responseJson, true);
    if (!$payload || isset($payload['error_description'])) {
        header("HTTP/1.1 401 Unauthorized");
        echo json_encode(["message" => "Invalid Google ID token: " . ($payload['error_description'] ?? 'unknown error')]);
        exit();
    }
    
    // Validate audience matches our Client ID
    if ($payload['aud'] !== GOOGLE_CLIENT_ID) {
        header("HTTP/1.1 401 Unauthorized");
        echo json_encode(["message" => "Audience mismatch. Client ID verification failed."]);
        exit();
    }
    
    // Validate email is verified
    $emailVerified = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if (!$emailVerified) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Unverified email addresses cannot register."]);
        exit();
    }
    
    $email = sanitize_input($payload['email']);
    $name = sanitize_input($payload['name'] ?? 'Google Student');
    
    // Check if user exists
    $stmt = $conn->prepare("SELECT id, name, role, is_active, created_by FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        // User exists: verify active status
        if ((int)$user['is_active'] === 0) {
            header("HTTP/1.1 403 Forbidden");
            echo json_encode(["message" => "Your account has been deactivated. Please contact support."]);
            exit();
        }
        
        $userId = $user['id'];
        $role = $user['role'];
    } else {
        // User does not exist: perform registration
        // Generate secure UUID v4 for user ID
        $uuidBytes = random_bytes(16);
        $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
        $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
        $userId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));
        
        // Generate secure random password since schema requires password_hash NOT NULL
        $passwordHash = password_hash('google_' . bin2hex(random_bytes(16)), PASSWORD_BCRYPT);
        $role = 'student';
        
        $stmtInsert = $conn->prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)");
        $stmtInsert->execute([userId, $name, $email, $passwordHash, $role]);
    }
    
    // Generate JWT token
    $token = generate_jwt($userId, $role);
    
    // Fetch enrolled course IDs
    $stmtEnroll = $conn->prepare("SELECT course_id FROM enrollments WHERE user_id = ?");
    $stmtEnroll->execute([$userId]);
    $enrolledCourses = $stmtEnroll->fetchAll(PDO::FETCH_COLUMN) ?: [];
    
    // Fetch completed course IDs
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
    $stmtComplete->execute([$userId]);
    $completedCourses = $stmtComplete->fetchAll(PDO::FETCH_COLUMN) ?: [];
    
    echo json_encode([
        "message" => "Google login successful.",
        "token" => $token,
        "user" => [
            "id" => $userId,
            "name" => $name,
            "email" => $email,
            "role" => $role,
            "created_by" => $user['created_by'] ?? null,
            "enrolledCourses" => $enrolledCourses,
            "completedCourses" => $completedCourses
        ]
    ]);
    
} catch (Exception $e) {
    secure_error_handler($e, "Failed to authenticate Google user due to an internal server error.");
}
