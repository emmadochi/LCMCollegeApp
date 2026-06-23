<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

// All operations require JWT authentication
$currentUser = validate_jwt();
$requestUserId = $currentUser['userId'];
$role = $currentUser['role'];

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetSubmission($conn, $requestUserId, $role);
        break;

    case 'POST':
        handleCreateSubmission($conn, $requestUserId);
        break;

    default:
        header("HTTP/1.1 405 Method Not Allowed");
        echo json_encode(["message" => "Method not allowed. Use GET or POST."]);
        break;
}

/**
 * Retrieve user submission for an assignment
 */
function handleGetSubmission($conn, $requestUserId, $role) {
    $assignmentId = $_GET['assignment_id'] ?? $_GET['assignmentId'] ?? '';
    $userId = $_GET['user_id'] ?? $_GET['userId'] ?? '';

    if (empty($assignmentId) || empty($userId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Assignment ID and User ID are required."]);
        exit();
    }

    // Security: standard students can only view their own submissions
    if ($userId !== $requestUserId && !in_array($role, ['admin', 'coordinator'])) {
        header("HTTP/1.1 403 Forbidden");
        echo json_encode(["message" => "Access denied. Cannot view another student's submission."]);
        exit();
    }

    try {
        $stmt = $conn->prepare("
            SELECT s.id, s.assignment_id, s.user_id, u.name AS user_name, u.email AS user_email,
                   s.status, s.submission_type, s.submission_text, s.file_url, s.file_name, s.submitted_at, s.grade, s.feedback
            FROM assignment_submissions s
            JOIN users u ON s.user_id = u.id
            WHERE s.assignment_id = ? AND s.user_id = ?
        ");
        $stmt->execute([$assignmentId, $userId]);
        $sub = $stmt->fetch();

        if ($sub) {
            $formatted = [
                "id" => $sub['id'],
                "assignmentId" => $sub['assignment_id'],
                "userId" => $sub['user_id'],
                "userName" => escape_output($sub['user_name']),
                "userEmail" => escape_output($sub['user_email']),
                "submissionType" => $sub['submission_type'],
                "text" => escape_output($sub['submission_text']),
                "fileUrl" => $sub['file_url'],
                "fileName" => escape_output($sub['file_name']),
                "submittedAt" => $sub['submitted_at'],
                "status" => $sub['status'],
                "grade" => escape_output($sub['grade'] ?? ''),
                "feedback" => escape_output($sub['feedback'] ?? '')
            ];
            echo json_encode($formatted);
        } else {
            echo json_encode(null);
        }
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to retrieve submission due to an internal server error.");
    }
}

/**
 * Handle new submission (supports both JSON and multipart form upload)
 */
function handleCreateSubmission($conn, $requestUserId) {
    // Check if multipart form request
    $isMultipart = strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false;

    if ($isMultipart) {
        $userId = sanitize_input($_POST['userId'] ?? $_POST['user_id'] ?? '');
        $assignmentId = sanitize_input($_POST['assignmentId'] ?? $_POST['assignment_id'] ?? '');
        $lessonId = sanitize_input($_POST['lessonId'] ?? $_POST['lesson_id'] ?? '');
        $submissionType = sanitize_input($_POST['submissionType'] ?? $_POST['submission_type'] ?? 'text');
        $text = sanitize_input($_POST['text'] ?? $_POST['submission_text'] ?? '');
    } else {
        $inputData = json_decode(file_get_contents("php://input"), true);
        $userId = sanitize_input($inputData['userId'] ?? $inputData['user_id'] ?? '');
        $assignmentId = sanitize_input($inputData['assignmentId'] ?? $inputData['assignment_id'] ?? '');
        $lessonId = sanitize_input($inputData['lessonId'] ?? $inputData['lesson_id'] ?? '');
        $submissionType = sanitize_input($inputData['submissionType'] ?? $inputData['submission_type'] ?? 'text');
        $text = sanitize_input($inputData['text'] ?? $inputData['submission_text'] ?? '');
    }

    if (empty($userId) || empty($assignmentId) || empty($lessonId)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "userId, assignmentId, and lessonId are required."]);
        exit();
    }

    // Security: student can only submit as themselves
    if ($userId !== $requestUserId) {
        header("HTTP/1.1 403 Forbidden");
        echo json_encode(["message" => "Access denied. Cannot submit on behalf of another user."]);
        exit();
    }

    $fileUrl = '';
    $fileName = '';

    // Handle File Upload if present in $_FILES
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../../uploads/submissions/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
            // Write htaccess to secure uploaded documents
            file_put_contents($uploadDir . '.htaccess', "RemoveHandler .php .phtml .php3\nRemoveType .php .phtml .php3\nphp_flag engine off\n");
        }

        $tmpName = $_FILES['file']['tmp_name'];
        $originalName = basename($_FILES['file']['name']);
        $fileSize = $_FILES['file']['size'];

        // 1. File size limit: 10MB
        if ($fileSize > 10 * 1024 * 1024) {
            header("HTTP/1.1 400 Bad Request");
            echo json_encode(["message" => "File size exceeds the limit of 10MB."]);
            exit();
        }

        // 2. Extension validation
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'zip', 'png', 'jpg', 'jpeg'];
        if (!in_array($ext, $allowedExtensions)) {
            header("HTTP/1.1 400 Bad Request");
            echo json_encode(["message" => "Invalid file extension. Allowed: PDF, Word, TXT, ZIP, Images."]);
            exit();
        }

        // 3. Generate secure random filename to prevent collision and path injection
        $securedFileName = bin2hex(random_bytes(16)) . '.' . $ext;
        $destPath = $uploadDir . $securedFileName;

        if (move_uploaded_file($tmpName, $destPath)) {
            // Build the public HTTP URL for the file
            $fileUrl = 'http://' . ($_SERVER['HTTP_HOST'] ?? '10.0.2.2') . '/CollegeApp/uploads/submissions/' . $securedFileName;
            $fileName = $originalName;
        } else {
            header("HTTP/1.1 500 Internal Server Error");
            echo json_encode(["message" => "Failed to save uploaded file."]);
            exit();
        }
    } else {
        // Fallback to JSON inputs if not uploading file
        if (!$isMultipart) {
            $fileUrl = sanitize_input($inputData['fileUrl'] ?? '');
            $fileName = sanitize_input($inputData['fileName'] ?? '');
        } else {
            $fileUrl = sanitize_input($_POST['fileUrl'] ?? '');
            $fileName = sanitize_input($_POST['fileName'] ?? '');
        }
    }

    try {
        // Check if assignment exists
        $stmtCheck = $conn->prepare("SELECT id FROM assignments WHERE id = ?");
        $stmtCheck->execute([$assignmentId]);
        if (!$stmtCheck->fetch()) {
            header("HTTP/1.1 404 Not Found");
            echo json_encode(["message" => "Assignment not found."]);
            exit();
        }

        // Check if already submitted (update if exists, otherwise create new)
        $stmtCheckSub = $conn->prepare("SELECT id FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?");
        $stmtCheckSub->execute([$assignmentId, $userId]);
        $existingSub = $stmtCheckSub->fetch();

        if ($existingSub) {
            $subId = $existingSub['id'];
            $stmtUpdate = $conn->prepare("
                UPDATE assignment_submissions 
                SET status = 'pending', submission_type = ?, submission_text = ?, file_url = ?, file_name = ?, submitted_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ");
            $stmtUpdate->execute([$submissionType, $text, $fileUrl, $fileName, $subId]);
        } else {
            // Generate UUID v4 for Submission ID
            $uuidBytes = random_bytes(16);
            $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
            $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
            $subId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

            $stmtInsert = $conn->prepare("
                INSERT INTO assignment_submissions (id, assignment_id, user_id, status, submission_type, submission_text, file_url, file_name, submitted_at) 
                VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ");
            $stmtInsert->execute([$subId, $assignmentId, $userId, $submissionType, $text, $fileUrl, $fileName]);
        }

        echo json_encode([
            "message" => "Assignment submitted successfully.",
            "id" => $subId,
            "fileUrl" => $fileUrl
        ]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to submit assignment due to an internal server error.");
    }
}
