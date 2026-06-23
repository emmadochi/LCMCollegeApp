<?php
require_once __DIR__ . '/../config/config.php';

// Create logs directory if not exists, and secure it
$logsDir = __DIR__ . '/../logs';
if (!file_exists($logsDir)) {
    mkdir($logsDir, 0755, true);
    // Write .htaccess inside logs to block web download
    file_put_contents($logsDir . '/.htaccess', "Deny from all\n");
}

/**
 * Handle secure Cross-Origin Resource Sharing (CORS)
 */
function handle_cors() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    if ($origin) {
        if (in_array($origin, ALLOWED_ORIGINS)) {
            header("Access-Control-Allow-Origin: " . $origin);
            header("Access-Control-Allow-Credentials: true");
            header("Access-Control-Max-Age: 86400"); // cache preflight for 1 day
        } else {
            header("HTTP/1.1 403 Forbidden");
            echo json_encode(["message" => "CORS origin not allowed."]);
            exit();
        }
    }
    
    // Handle Preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
            header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        }
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
        }
        exit(0);
    }
}

/**
 * Log errors securely and output a safe generic response to the user
 */
function secure_error_handler($e, $customMsg = "An internal server error occurred.") {
    $logFile = __DIR__ . '/../logs/error.log';
    $timestamp = date("Y-m-d H:i:s");
    $errId = bin2hex(random_bytes(8)); // Tracking ID for developers
    
    $logMsg = "[$timestamp] [ID:$errId] " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine() . "\n";
    error_log($logMsg, 3, $logFile);
    
    header("Content-Type: application/json; charset=UTF-8");
    http_response_code(500);
    echo json_encode([
        "message" => $customMsg,
        "error_reference" => $errId // User can quote this ID to the admin for debugging
    ]);
    exit();
}

/**
 * Escape variables for safe HTML display (Mitigates Cross-Site Scripting - XSS)
 */
function escape_output($data) {
    if (is_array($data)) {
        return array_map('escape_output', $data);
    }
    return htmlspecialchars($data, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/**
 * Basic input validation sanitization
 */
function sanitize_input($data) {
    return trim(strip_tags($data));
}

/**
 * Base64 URL Encoding helper for JWT
 */
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Base64 URL Decoding helper for JWT
 */
function base64url_decode($data) {
    return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
}

/**
 * Generate a cryptographically signed secure JWT token (HMAC SHA-256)
 */
function generate_jwt($userId, $role) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    
    $issuedAt = time();
    $expire = $issuedAt + JWT_EXPIRY;
    
    $payload = json_encode([
        'iss' => 'lcm_college_api',
        'aud' => 'lcm_college_app',
        'iat' => $issuedAt,
        'exp' => $expire,
        'userId' => $userId,
        'role' => $role
    ]);
    
    $base64UrlHeader = base64url_encode($header);
    $base64UrlPayload = base64url_encode($payload);
    
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true);
    $base64UrlSignature = base64url_encode($signature);
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

/**
 * Validate and decode a client JWT token
 */
function validate_jwt() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    
    if (empty($authHeader) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    if (empty($authHeader)) {
        header("HTTP/1.1 401 Unauthorized");
        echo json_encode(["message" => "Authorization token missing."]);
        exit();
    }
    
    // Format should be "Bearer <token>"
    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Malformed authorization header."]);
        exit();
    }
    
    $jwt = $matches[1];
    $tokenParts = explode('.', $jwt);
    if (count($tokenParts) !== 3) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Invalid token layout."]);
        exit();
    }
    
    $header = base64url_decode($tokenParts[0]);
    $payload = base64url_decode($tokenParts[1]);
    $signatureProvided = $tokenParts[2];
    
    // Re-calculate signature to verify integrity
    $signatureToCheck = base64url_encode(hash_hmac('sha256', $tokenParts[0] . "." . $tokenParts[1], JWT_SECRET, true));
    
    // Timing-attack safe comparison
    if (!hash_equals($signatureToCheck, $signatureProvided)) {
        header("HTTP/1.1 401 Unauthorized");
        echo json_encode(["message" => "Invalid token signature."]);
        exit();
    }
    
    $payloadData = json_decode($payload, true);
    
    // Check expiration time
    if (($payloadData['exp'] ?? 0) < time()) {
        header("HTTP/1.1 401 Unauthorized");
        echo json_encode(["message" => "Token has expired."]);
        exit();
    }
    
    return $payloadData; // Returns userId, role, and details
}

/**
 * Enforce authentication & role restrictions (e.g. require admin)
 */
function require_auth($allowedRoles = []) {
    $user = validate_jwt();
    
    if (!empty($allowedRoles) && !in_array($user['role'] ?? '', $allowedRoles)) {
        header("HTTP/1.1 403 Forbidden");
        echo json_encode(["message" => "Access denied. Insufficient privileges."]);
        exit();
    }
    
    return $user;
}

/**
 * Secure Rate Limiter for Login (helps prevent brute-force attacks)
 */
function check_login_rate_limit($ip, $dbConnection) {
    try {
        // Calculate difference in seconds directly on MySQL to avoid PHP/MySQL timezone mismatches
        $stmt = $dbConnection->prepare("
            SELECT attempts, TIMESTAMPDIFF(SECOND, last_attempt, CURRENT_TIMESTAMP) AS seconds_since_last 
            FROM login_attempts 
            WHERE ip_address = ?
        ");
        $stmt->execute([$ip]);
        $row = $stmt->fetch();
        
        if ($row) {
            $attempts = $row['attempts'];
            $secondsSinceLast = (int)$row['seconds_since_last'];
            
            // Limit: max 5 attempts, lockout for 15 minutes (900 seconds)
            if ($attempts >= 5 && $secondsSinceLast < 900) {
                return false; // Rate limit exceeded, user is locked out
            }
            
            // If the last attempt was over 15 minutes ago, reset lock
            if ($secondsSinceLast >= 900) {
                $stmtReset = $dbConnection->prepare("DELETE FROM login_attempts WHERE ip_address = ?");
                $stmtReset->execute([$ip]);
            }
        }
        return true;
    } catch (PDOException $e) {
        // Log error silently, do not lock user out because database check failed
        error_log("Rate limit check failed: " . $e->getMessage());
        return true;
    }
}

/**
 * Record a login attempt (increment count or delete upon success)
 */
function record_login_attempt($ip, $success, $dbConnection) {
    try {
        if ($success) {
            // Delete rate limit logs on success
            $stmt = $dbConnection->prepare("DELETE FROM login_attempts WHERE ip_address = ?");
            $stmt->execute([$ip]);
        } else {
            // Increment attempt count on failure
            $stmt = $dbConnection->prepare("
                INSERT INTO login_attempts (ip_address, attempts, last_attempt) 
                VALUES (?, 1, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$ip]);
        }
    } catch (PDOException $e) {
        error_log("Rate limit registration failed: " . $e->getMessage());
    }
}
