<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetReviews($conn);
        break;

    case 'POST':
        handleCreateReview($conn);
        break;

    default:
        header("HTTP/1.1 405 Method Not Allowed");
        echo json_encode(["message" => "Method not allowed. Use GET or POST."]);
        break;
}

/**
 * Fetch reviews for a specific course
 */
function handleGetReviews($conn) {
    $courseId = $_GET['course_id'] ?? '';

    if (empty($courseId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course ID parameter (course_id) is required."]);
        exit();
    }

    try {
        $stmt = $conn->prepare("
            SELECT r.id, r.course_id, c.title AS course_name, r.user_id, u.name AS user_name, u.email AS user_email, r.rating, r.comment, r.created_at 
            FROM reviews r
            JOIN courses c ON r.course_id = c.id
            JOIN users u ON r.user_id = u.id
            WHERE r.course_id = ?
            ORDER BY r.created_at DESC
        ");
        $stmt->execute([$courseId]);
        $reviews = $stmt->fetchAll();

        echo json_encode(escape_output($reviews));
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to retrieve reviews due to an internal server error.");
    }
}

/**
 * Add a new review
 */
function handleCreateReview($conn) {
    // Requires authentication
    $currentUser = validate_jwt();
    $userId = $currentUser['userId'];

    $inputData = json_decode(file_get_contents("php://input"), true);

    $courseId = sanitize_input($inputData['courseId'] ?? $inputData['course_id'] ?? '');
    $rating = isset($inputData['rating']) ? (int)$inputData['rating'] : 0;
    $comment = sanitize_input($inputData['comment'] ?? '');

    if (empty($courseId) || $rating < 1 || $rating > 5) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course ID and rating (between 1 and 5) are required."]);
        exit();
    }

    try {
        // Verify course exists
        $stmtCourse = $conn->prepare("SELECT id FROM courses WHERE id = ?");
        $stmtCourse->execute([$courseId]);
        if (!$stmtCourse->fetch()) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Course not found."]);
            exit();
        }

        // Generate UUID v4 for Review ID
        $uuidBytes = random_bytes(16);
        $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
        $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
        $reviewId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

        $stmt = $conn->prepare("
            INSERT INTO reviews (id, user_id, course_id, rating, comment) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$reviewId, $userId, $courseId, $rating, $comment]);

        // Re-calculate course rating average
        $stmtAvg = $conn->prepare("SELECT AVG(rating) AS avg_rating FROM reviews WHERE course_id = ?");
        $stmtAvg->execute([$courseId]);
        $avgRow = $stmtAvg->fetch();
        $newRating = $avgRow['avg_rating'] ? round(floatval($avgRow['avg_rating']), 2) : 4.8;

        $stmtUpdateRating = $conn->prepare("UPDATE courses SET rating = ? WHERE id = ?");
        $stmtUpdateRating->execute([$newRating, $courseId]);

        header("HTTP/1.1 201 Created");
        echo json_encode([
            "message" => "Review submitted successfully.",
            "id" => $reviewId,
            "new_course_rating" => $newRating
        ]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to submit review due to an internal server error.");
    }
}
