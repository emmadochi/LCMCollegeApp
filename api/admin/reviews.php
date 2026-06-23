<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

handle_cors();

// Enforce Role-Based Access Control
$currentUser = require_auth(['admin', 'coordinator']);

header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        listReviews($conn);
        break;

    case 'DELETE':
        $reviewId = $_GET['id'] ?? '';
        deleteReview($conn, $reviewId);
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}

/**
 * List all reviews ordered by newest first
 */
function listReviews($conn) {
    try {
        $stmt = $conn->prepare("
            SELECT r.id, r.rating, r.comment, r.created_at,
                   u.name AS user_name, u.email AS user_email,
                   c.title AS course_name
            FROM reviews r
            LEFT JOIN users u ON u.id = r.user_id
            LEFT JOIN courses c ON c.id = r.course_id
            ORDER BY r.created_at DESC
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(array_map(function($r) {
            return [
                'id'         => $r['id'],
                'rating'     => (int)$r['rating'],
                'comment'    => escape_output($r['comment'] ?? ''),
                'created_at' => $r['created_at'],
                'user_name'  => escape_output($r['user_name'] ?? 'Anonymous'),
                'user_email' => escape_output($r['user_email'] ?? ''),
                'course_name'=> escape_output($r['course_name'] ?? 'Multiple'),
            ];
        }, $rows));
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Delete a review by ID
 */
function deleteReview($conn, $reviewId) {
    try {
        if (!$reviewId) {
            http_response_code(400);
            echo json_encode(["message" => "Review ID is required."]);
            return;
        }

        $stmt = $conn->prepare("DELETE FROM reviews WHERE id = ?");
        $stmt->execute([$reviewId]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Review not found."]);
            return;
        }

        echo json_encode(["message" => "Review deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete review.");
    }
}
