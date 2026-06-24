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
    handleGetEnrollments($conn, $userId);
} elseif ($method === 'POST') {
    handlePostEnrollment($conn, $userId);
} else {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Method not allowed. Use GET or POST."]);
    exit();
}

/**
 * Fetch all course enrollments for the current user
 */
function handleGetEnrollments($conn, $userId) {
    try {
        $stmtEnroll = $conn->prepare("SELECT course_id FROM enrollments WHERE user_id = ?");
        $stmtEnroll->execute([$userId]);
        $enrolledCourses = $stmtEnroll->fetchAll(PDO::FETCH_COLUMN) ?: [];
        echo json_encode(escape_output($enrolledCourses));
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to fetch enrollments due to an internal server error.");
    }
}

/**
 * Handle new course enrollment
 */
function handlePostEnrollment($conn, $userId) {
    // Get raw POST data
    $inputData = json_decode(file_get_contents("php://input"), true);
    $courseId = sanitize_input($inputData['courseId'] ?? $inputData['course_id'] ?? '');

    if (empty($courseId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Course ID is required."]);
        exit();
    }

    try {
        // Check if course exists and get its price
        $stmtCheckCourse = $conn->prepare("SELECT id, price FROM courses WHERE id = ?");
        $stmtCheckCourse->execute([$courseId]);
        $course = $stmtCheckCourse->fetch();
        if (!$course) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Course not found."]);
            exit();
        }

        // Check if it's a paid course and verify payment
        $price = floatval($course['price'] ?? 0.00);
        if ($price > 0) {
            $stmtCheckPayment = $conn->prepare("SELECT 1 FROM payments WHERE user_id = ? AND course_id = ? AND status = 'completed'");
            $stmtCheckPayment->execute([$userId, $courseId]);
            if (!$stmtCheckPayment->fetch()) {
                header("HTTP/1.1 402 Payment Required");
                echo json_encode(["message" => "This is a paid course. Please purchase the course first."]);
                exit();
            }
        }

        // Check if already enrolled
        $stmtCheckEnroll = $conn->prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?");
        $stmtCheckEnroll->execute([$userId, $courseId]);
        if ($stmtCheckEnroll->fetch()) {
            // Already enrolled, return success silently
            $stmtEnroll = $conn->prepare("SELECT course_id FROM enrollments WHERE user_id = ?");
            $stmtEnroll->execute([$userId]);
            $enrolledCourses = $stmtEnroll->fetchAll(PDO::FETCH_COLUMN) ?: [];

            echo json_encode([
                "message" => "Already enrolled in this course.",
                "enrolledCourses" => $enrolledCourses
            ]);
            exit();
        }

        // Insert enrollment
        $stmtInsert = $conn->prepare("INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)");
        $stmtInsert->execute([$userId, $courseId]);

        // Send Enrollment Email Notification
        $stmtDetails = $conn->prepare("
            SELECT u.name AS user_name, u.email AS user_email, c.title AS course_title 
            FROM users u, courses c 
            WHERE u.id = ? AND c.id = ?
        ");
        $stmtDetails->execute([$userId, $courseId]);
        $details = $stmtDetails->fetch(PDO::FETCH_ASSOC);

        if ($details) {
            require_once __DIR__ . '/../utils/email.php';
            
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
            $host = $_SERVER['HTTP_HOST'] ?? 'lcmcollege.org';
            $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
            $pathParts = explode('/', $scriptName);
            array_pop($pathParts); // remove enroll.php
            array_pop($pathParts); // remove learning
            array_pop($pathParts); // remove api
            $basePath = implode('/', $pathParts);
            if (empty($basePath) || $basePath === '/') {
                $basePath = '/';
            } else {
                if (substr($basePath, 0, 1) !== '/') {
                    $basePath = '/' . $basePath;
                }
                if (substr($basePath, -1) !== '/') {
                    $basePath .= '/';
                }
            }
            $courseUrl = "$protocol://$host" . $basePath . "course_web_app/course.html?id=" . $courseId;

            $subject = "Course Enrollment Confirmation - " . $details['course_title'];
            $enrollContent = '
                <p>Dear ' . escape_output($details['user_name']) . ',</p>
                <p>You have successfully enrolled in the course: <strong>' . escape_output($details['course_title']) . '</strong>.</p>
                <p>You can access your course materials, video lectures, and quizzes anytime from your student portal.</p>
                <div class="button-container">
                    <a href="' . $courseUrl . '" class="button">Start Learning</a>
                </div>
            ';
            $emailBody = get_email_template("Enrolled in " . escape_output($details['course_title']), $enrollContent);
            send_transactional_email($details['user_email'], $subject, $emailBody);
        }

        // Fetch updated enrolled course IDs
        $stmtEnroll = $conn->prepare("SELECT course_id FROM enrollments WHERE user_id = ?");
        $stmtEnroll->execute([$userId]);
        $enrolledCourses = $stmtEnroll->fetchAll(PDO::FETCH_COLUMN) ?: [];

        echo json_encode([
            "message" => "Successfully enrolled in the course.",
            "enrolledCourses" => $enrolledCourses
        ]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to enroll in course due to an internal server error.");
    }
}
