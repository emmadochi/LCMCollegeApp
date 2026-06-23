<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Enforce Role-Based Access Control (RBAC) - Must be Admin or Coordinator
$currentUser = require_auth(['admin', 'coordinator']);

header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Method not allowed. Use GET."]);
    exit();
}

try {
    // Query all payments, joined with student names and course titles
    $stmt = $conn->prepare("
        SELECT p.id, p.amount, p.currency, p.status, p.payment_method, p.transaction_reference, p.created_at, 
               u.name AS student_name, u.email AS student_email, c.title AS course_title
        FROM payments p
        JOIN users u ON p.user_id = u.id
        JOIN courses c ON p.course_id = c.id
        ORDER BY p.created_at DESC
    ");
    $stmt->execute();
    $payments = $stmt->fetchAll() ?: [];

    echo json_encode(escape_output($payments));
} catch (Exception $e) {
    secure_error_handler($e, "Failed to load payments database records.");
}
