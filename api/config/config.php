<?php
// Prevent direct access to this file
if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
    header("HTTP/1.1 403 Forbidden");
    exit("Access Denied");
}

// Environment settings ('development' or 'production')
define('APP_ENV', 'development');

// Database Configuration
define('DB_HOST', '127.0.0.1'); // Using IP is faster than 'localhost' in some environments
define('DB_NAME', 'lcm_college');
define('DB_USER', 'root');
define('DB_PASS', '');

// Security Keys
// In production, keep this key in a non-web-accessible environment variable or separate secure file
define('JWT_SECRET', 'd8d85f7a0cbe5c3b123d6a2f7cdebe67a90b4d45e5f5f5c1d2e3f4a5b6c7d8e9'); // 256-bit cryptographically secure string
define('JWT_EXPIRY', 86400); // Token duration in seconds (24 hours)

// CORS Configuration
define('ALLOWED_ORIGINS', [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:3004'
]);

// Paystack API Keys
define('PAYSTACK_SECRET_KEY', 'sk_test_73da203d9534142cebc03f04b5a0d6d6cbbffa86');
define('PAYSTACK_PUBLIC_KEY', 'pk_test_e02301d81ac02e107bb1b462bb221b95fb58a6d7');

