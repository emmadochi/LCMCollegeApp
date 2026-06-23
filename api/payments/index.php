<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

// Enforce JWT authentication
$currentUser = validate_jwt();
$userId = $currentUser['userId'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleGetPayments($conn, $userId);
} elseif ($method === 'POST') {
    handlePostPayment($conn, $userId);
} else {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Method not allowed. Use GET or POST."]);
    exit();
}

/**
 * Fetch all payments for the current user
 */
function handleGetPayments($conn, $userId) {
    try {
        $stmt = $conn->prepare("
            SELECT p.id, p.amount, p.currency, p.status, p.payment_method, p.transaction_reference, p.created_at, c.title as course_title
            FROM payments p
            JOIN courses c ON p.course_id = c.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$userId]);
        $payments = $stmt->fetchAll() ?: [];
        echo json_encode(escape_output($payments));
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to fetch payments due to an internal server error.");
    }
}

/**
 * Handle new course payment and automatic enrollment
 */
function handlePostPayment($conn, $userId) {
    $inputData = json_decode(file_get_contents("php://input"), true);
    $courseId = sanitize_input($inputData['courseId'] ?? '');
    $gateway = sanitize_input($inputData['gateway'] ?? $inputData['paymentMethod'] ?? 'card');
    $currency = strtoupper(sanitize_input($inputData['currency'] ?? 'USD'));
    $amount = floatval($inputData['amount'] ?? 0.00);
    $reference = sanitize_input($inputData['reference'] ?? '');

    if (empty($courseId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course ID is required."]);
        exit();
    }

    try {
        // Start transaction
        $conn->beginTransaction();

        // Check if course exists
        $stmtCheckCourse = $conn->prepare("SELECT id, title, price, currency FROM courses WHERE id = ?");
        $stmtCheckCourse->execute([$courseId]);
        $course = $stmtCheckCourse->fetch();
        if (!$course) {
            $conn->rollBack();
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Course not found."]);
            exit();
        }

        $coursePrice = floatval($course['price'] ?? 0.00);
        
        // If amount wasn't sent, default to course's price and native currency
        if ($amount <= 0.0) {
            $amount = $coursePrice;
            $currency = strtoupper($course['currency'] ?? 'USD');
        }

        // Check if already paid
        $stmtCheckPay = $conn->prepare("SELECT 1 FROM payments WHERE user_id = ? AND course_id = ? AND status = 'completed'");
        $stmtCheckPay->execute([$userId, $courseId]);
        $alreadyPaid = $stmtCheckPay->fetch();

        if (!$alreadyPaid) {
            $txRef = 'LCM-TX-' . strtoupper(bin2hex(random_bytes(6)));

            // Paystack verification
            if ($gateway === 'paystack') {
                if (empty($reference)) {
                    $conn->rollBack();
                    header("HTTP/1.1 400 Bad Request");
                    echo json_encode(["message" => "Transaction reference is required for Paystack."]);
                    exit();
                }

                $url = "https://api.paystack.co/transaction/verify/" . rawurlencode($reference);
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    "Authorization: Bearer " . PAYSTACK_SECRET_KEY,
                    "Cache-Control: no-cache"
                ]);
                $responseJson = curl_exec($ch);
                $err = curl_error($ch);
                curl_close($ch);

                if ($err) {
                    $conn->rollBack();
                    header("HTTP/1.1 500 Internal Server Error");
                    echo json_encode(["message" => "Paystack verification connection error: " . $err]);
                    exit();
                }

                $resp = json_decode($responseJson, true);
                if (!$resp || !isset($resp['status']) || !$resp['status'] || $resp['data']['status'] !== 'success') {
                    $conn->rollBack();
                    header("HTTP/1.1 400 Bad Request");
                    echo json_encode(["message" => "Paystack payment verification failed."]);
                    exit();
                }

                // Verify verified details
                $verifiedAmount = floatval($resp['data']['amount']) / 100.0;
                $verifiedCurrency = strtoupper($resp['data']['currency']);

                $amount = $verifiedAmount;
                $currency = $verifiedCurrency;
                $txRef = $reference;
            }

            // Generate UUID v4 for Payment ID
            $uuidBytes = random_bytes(16);
            $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
            $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
            $paymentId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

            // Record payment
            $stmtPay = $conn->prepare("
                INSERT INTO payments (id, user_id, course_id, amount, currency, status, payment_method, transaction_reference)
                VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
            ");
            $stmtPay->execute([$paymentId, $userId, $courseId, $amount, $currency, $gateway, $txRef]);
        }

        // Check if already enrolled
        $stmtCheckEnroll = $conn->prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?");
        $stmtCheckEnroll->execute([$userId, $courseId]);
        if (!$stmtCheckEnroll->fetch()) {
            // Enroll in course
            $stmtEnroll = $conn->prepare("INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)");
            $stmtEnroll->execute([$userId, $courseId]);
        }

        $conn->commit();

        // Fetch updated enrolled course IDs
        $stmtEnrollList = $conn->prepare("SELECT course_id FROM enrollments WHERE user_id = ?");
        $stmtEnrollList->execute([$userId]);
        $enrolledCourses = $stmtEnrollList->fetchAll(PDO::FETCH_COLUMN) ?: [];

        echo json_encode([
            "message" => "Payment successful and course enrolled.",
            "enrolledCourses" => $enrolledCourses
        ]);
    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        secure_error_handler($e, "Payment processing failed due to an internal server error.");
    }
}
