<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set headers
header("Content-Type: application/json; charset=UTF-8");

// All operations require authentication
$currentUser = validate_jwt();
$requestUserId = $currentUser['userId'];
$role = $currentUser['role'];

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetProgress($conn, $requestUserId, $role);
        break;

    case 'POST':
        handleSaveProgress($conn, $requestUserId, $role);
        break;

    default:
        header("HTTP/1.1 405 Method Not Allowed");
        echo json_encode(["message" => "Method not allowed. Use GET or POST."]);
        break;
}

function handleGetProgress($conn, $requestUserId, $role) {
    $userId = $_GET['user_id'] ?? $_GET['userId'] ?? '';
    $courseId = $_GET['course_id'] ?? $_GET['courseId'] ?? '';

    if (empty($userId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "User ID is required."]);
        exit();
    }

    // Security: standard students can only view their own progress records, but admins, coordinators and lecturers can view them
    if ($userId !== $requestUserId && !in_array($role, ['admin', 'coordinator', 'lecturer'])) {
        header("HTTP/1.1 403 Forbidden");
        echo json_encode(["message" => "Access denied. Cannot view another user's progress."]);
        exit();
    }

    try {
        if (!empty($courseId)) {
            $stmt = $conn->prepare("
                SELECT user_id, course_id, lesson_id, is_completed, last_quiz_score, attempts 
                FROM user_progress 
                WHERE user_id = ? AND course_id = ?
            ");
            $stmt->execute([$userId, $courseId]);
        } else {
            $stmt = $conn->prepare("
                SELECT user_id, course_id, lesson_id, is_completed, last_quiz_score, attempts 
                FROM user_progress 
                WHERE user_id = ?
            ");
            $stmt->execute([$userId]);
        }
        $rows = $stmt->fetchAll();

        $formatted = [];
        foreach ($rows as $row) {
            $formatted[] = [
                "userId" => $row['user_id'],
                "courseId" => $row['course_id'],
                "lessonId" => $row['lesson_id'],
                "isCompleted" => (bool)$row['is_completed'],
                "lastQuizScore" => (int)$row['last_quiz_score'],
                "attempts" => (int)$row['attempts']
            ];
        }

        echo json_encode(escape_output($formatted));
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to retrieve user progress due to an internal server error.");
    }
}

/**
 * Save or update progress entry
 */
function handleSaveProgress($conn, $requestUserId, $role) {
    $inputData = json_decode(file_get_contents("php://input"), true);

    $userId = sanitize_input($inputData['userId'] ?? $inputData['user_id'] ?? '');
    $courseId = sanitize_input($inputData['courseId'] ?? $inputData['course_id'] ?? '');
    $lessonId = sanitize_input($inputData['lessonId'] ?? $inputData['lesson_id'] ?? '');
    $isCompleted = isset($inputData['isCompleted']) ? (bool)$inputData['isCompleted'] : (isset($inputData['is_completed']) ? (bool)$inputData['is_completed'] : false);
    $lastQuizScore = isset($inputData['lastQuizScore']) ? (int)$inputData['lastQuizScore'] : (isset($inputData['last_quiz_score']) ? (int)$inputData['last_quiz_score'] : 0);
    $attempts = isset($inputData['attempts']) ? (int)$inputData['attempts'] : 0;

    if (empty($userId) || empty($courseId) || empty($lessonId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "userId, courseId, and lessonId are required fields."]);
        exit();
    }

    // Security check: cannot modify another student's progress unless administrator
    if ($userId !== $requestUserId && !in_array($role, ['admin', 'coordinator'])) {
        header("HTTP/1.1 403 Forbidden");
        echo json_encode(["message" => "Access denied. Cannot update progress for another user."]);
        exit();
    }

    try {
        // Enforce DB constraints: verify lesson exists
        $stmtCheck = $conn->prepare("SELECT id FROM lessons WHERE id = ? AND course_id = ?");
        $stmtCheck->execute([$lessonId, $courseId]);
        if (!$stmtCheck->fetch()) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Specified lesson in course does not exist."]);
            exit();
        }

        // Gating Check: if lesson has an assignment, confirm that student has an approved submission
        if ($isCompleted) {
            $stmtCheckAssign = $conn->prepare("SELECT id FROM assignments WHERE lesson_id = ?");
            $stmtCheckAssign->execute([$lessonId]);
            $assign = $stmtCheckAssign->fetch();

            if ($assign) {
                // Fetch student submission
                $stmtCheckSub = $conn->prepare("
                    SELECT status FROM assignment_submissions 
                    WHERE assignment_id = ? AND user_id = ?
                ");
                $stmtCheckSub->execute([$assign['id'], $userId]);
                $sub = $stmtCheckSub->fetch();

                if (!$sub || !in_array($sub['status'], ['approved', 'graded'])) {
                    header("HTTP/1.1 400 Bad Request");
                    echo json_encode(["message" => "Cannot complete lesson: assignment submission must be approved by the lecturer."]);
                    exit();
                }
            }
        }

        // Generate composite ID: userId_lessonId
        $docId = "${userId}_${lessonId}";
        $isCompletedVal = $isCompleted ? 1 : 0;

        $stmt = $conn->prepare("
            INSERT INTO user_progress (id, user_id, course_id, lesson_id, is_completed, last_quiz_score, attempts, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE 
                is_completed = VALUES(is_completed),
                last_quiz_score = VALUES(last_quiz_score),
                attempts = VALUES(attempts),
                updated_at = CURRENT_TIMESTAMP
        ");
        $stmt->execute([$docId, $userId, $courseId, $lessonId, $isCompletedVal, $lastQuizScore, $attempts]);

        // Check if course is completed (all lessons marked as completed)
        $stmtTotal = $conn->prepare("SELECT COUNT(*) FROM lessons WHERE course_id = ?");
        $stmtTotal->execute([$courseId]);
        $totalLessons = (int)$stmtTotal->fetchColumn();

        $stmtCompleted = $conn->prepare("SELECT COUNT(*) FROM user_progress WHERE user_id = ? AND course_id = ? AND is_completed = 1");
        $stmtCompleted->execute([$userId, $courseId]);
        $completedLessons = (int)$stmtCompleted->fetchColumn();

        if ($totalLessons > 0 && $completedLessons === $totalLessons && $isCompleted) {
            // Fetch student and course info
            $stmtInfo = $conn->prepare("
                SELECT u.name AS user_name, u.email AS user_email, c.title AS course_title 
                FROM users u, courses c 
                WHERE u.id = ? AND c.id = ?
            ");
            $stmtInfo->execute([$userId, $courseId]);
            $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);

            if ($info) {
                // Send milestone completed email
                require_once __DIR__ . '/../utils/email.php';
                
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
                $host = $_SERVER['HTTP_HOST'] ?? 'lcmcollege.org';
                $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
                $pathParts = explode('/', $scriptName);
                array_pop($pathParts); // remove progress.php
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
                $dashboardUrl = "$protocol://$host" . $basePath . "course_web_app/dashboard.html";

                $subject = "Course Completed! Congratulations - " . $info['course_title'];
                $completeContent = '
                    <p>Dear ' . escape_output($info['user_name']) . ',</p>
                    <p>Congratulations! You have completed all lessons and assignments for the course: <strong>' . escape_output($info['course_title']) . '</strong>.</p>
                    <p>We are very proud of your progress and commitment to your studies. You can now claim and print your official certificate directly from the student dashboard.</p>
                    <div class="button-container">
                        <a href="' . $dashboardUrl . '" class="button">View Certificate</a>
                    </div>
                ';
                $emailBody = get_email_template("Course Completed!", $completeContent);
                send_transactional_email($info['user_email'], $subject, $emailBody);
            }
        }

        echo json_encode(["message" => "Progress saved successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to save user progress due to an internal server error.");
    }
}
