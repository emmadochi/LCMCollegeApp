<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

header("Content-Type: application/json; charset=UTF-8");

echo json_encode([
    "paystackPublicKey" => defined('PAYSTACK_PUBLIC_KEY') ? PAYSTACK_PUBLIC_KEY : '',
    "paystackSubaccount" => defined('PAYSTACK_SUBACCOUNT_CODE') ? PAYSTACK_SUBACCOUNT_CODE : ''
]);
