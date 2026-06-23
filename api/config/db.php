<?php
require_once __DIR__ . '/config.php';

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Throw exceptions on error
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // Fetch associative array format
        PDO::ATTR_EMULATE_PREPARES   => false,                  // True prepared statements - absolutely crucial for security
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ];

    $conn = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (PDOException $e) {
    // Highly Secure: Log connection failure details to an error log, but do not show credentials on the webpage.
    error_log("Database connection failed: " . $e->getMessage());
    
    // Set response header and fail gracefully
    header("Content-Type: application/json; charset=UTF-8");
    http_response_code(500);
    echo json_encode(["message" => "An internal database configuration error occurred."]);
    exit();
}
