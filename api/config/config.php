<?php
// Prevent direct access to this file
if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
    header("HTTP/1.1 403 Forbidden");
    exit("Access Denied");
}

// Environment settings ('development' or 'production')
// Automatically detect environment based on host
if (isset($_SERVER['HTTP_HOST']) && ($_SERVER['HTTP_HOST'] === 'lcmcollege.org' || $_SERVER['HTTP_HOST'] === 'www.lcmcollege.org')) {
    define('APP_ENV', 'production');
} else {
    define('APP_ENV', 'development');
}

// Database Configuration
if (APP_ENV === 'production') {
    define('DB_HOST', '127.0.0.1');
    define('DB_NAME', 'lifeubkq_college');
    define('DB_USER', 'lifeubkq_college');
    define('DB_PASS', 'lifeubkq_college');
} else {
    define('DB_HOST', '127.0.0.1'); // Using IP is faster than 'localhost' in some environments
    define('DB_NAME', 'lcm_college');
    define('DB_USER', 'root');
    define('DB_PASS', '');
}

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
    'http://localhost:3004',
    'http://lcmcollege.org',
    'https://lcmcollege.org',
    'http://www.lcmcollege.org',
    'https://www.lcmcollege.org'
]);

// Paystack API Keys
define('PAYSTACK_SECRET_KEY', getenv('PAYSTACK_SECRET_KEY') ?: '');
define('PAYSTACK_PUBLIC_KEY', getenv('PAYSTACK_PUBLIC_KEY') ?: 'pk_live_91fa71a264e0c3919f7d2f7b87c24cfa0df6b796');
define('PAYSTACK_SUBACCOUNT_CODE', getenv('PAYSTACK_SUBACCOUNT_CODE') ?: 'ACCT_29ixq9k2y7wucus');

// Google OAuth Configuration
define('GOOGLE_CLIENT_ID', '370483546378-aoeuesf6h9p1smb9c40mkiepippkqud3.apps.googleusercontent.com');


