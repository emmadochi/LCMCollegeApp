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
        listLecturers($conn);
        break;

    case 'POST':
        createLecturer($conn);
        break;

    case 'PUT':
        assignLecturer($conn);
        break;

    case 'DELETE':
        $lecturerId = $_GET['id'] ?? '';
        $assignmentId = $_GET['assignment_id'] ?? '';
        if ($assignmentId) {
            deleteAssignment($conn, $assignmentId);
        } else {
            deleteLecturer($conn, $lecturerId);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}

/**
 * List all lecturers
 */
function listLecturers($conn) {
    try {
        $stmt = $conn->prepare("SELECT id, name, email, created_at FROM users WHERE role = 'lecturer' ORDER BY name ASC");
        $stmt->execute();
        $lecturers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($lecturers as $l) {
            $stmtAssign = $conn->prepare("
                SELECT la.id, la.course_id, la.lesson_id, la.student_id, la.assignment_mode,
                       c.title AS course_title,
                       l.title AS lesson_title,
                       u.name AS student_name
                FROM lecturer_assignments la
                LEFT JOIN courses c ON c.id = la.course_id
                LEFT JOIN lessons l ON l.id = la.lesson_id
                LEFT JOIN users u ON u.id = la.student_id
                WHERE la.lecturer_id = ?
            ");
            $stmtAssign->execute([$l['id']]);
            $assignments = $stmtAssign->fetchAll(PDO::FETCH_ASSOC);

            $result[] = [
                'id' => $l['id'],
                'name' => escape_output($l['name']),
                'email' => escape_output($l['email']),
                'created_at' => $l['created_at'],
                'assignments' => array_map(function($a) {
                    return [
                        'id' => $a['id'],
                        'course_id' => $a['course_id'],
                        'lesson_id' => $a['lesson_id'],
                        'student_id' => $a['student_id'],
                        'assignment_mode' => $a['assignment_mode'],
                        'course_title' => $a['course_title'] ? escape_output($a['course_title']) : null,
                        'lesson_title' => $a['lesson_title'] ? escape_output($a['lesson_title']) : null,
                        'student_name' => $a['student_name'] ? escape_output($a['student_name']) : null
                    ];
                }, $assignments)
            ];
        }

        echo json_encode($result);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Create a new user with role = 'lecturer'
 */
function createLecturer($conn) {
    $inputData = json_decode(file_get_contents("php://input"), true);
    
    $name = sanitize_input($inputData['name'] ?? '');
    $email = sanitize_input($inputData['email'] ?? '');
    $password = $inputData['password'] ?? '';

    if (empty($name) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(["message" => "All fields (name, email, password) are required."]);
        return;
    }

    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(["message" => "Password must be at least 8 characters long."]);
        return;
    }

    try {
        // Check if user already exists with role 'lecturer'
        $stmtCheck = $conn->prepare("SELECT 1 FROM users WHERE email = ? AND role = 'lecturer'");
        $stmtCheck->execute([$email]);
        if ($stmtCheck->fetch()) {
            http_response_code(409);
            echo json_encode(["message" => "A lecturer with this email address already exists."]);
            return;
        }

        // Generate UUID for user id
        $uuidBytes = random_bytes(16);
        $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
        $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
        $userId = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $conn->prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'lecturer')");
        $stmt->execute([$userId, $name, $email, $passwordHash]);

        http_response_code(201);
        echo json_encode([
            "message" => "Lecturer registered successfully.",
            "id" => $userId
        ]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to register lecturer.");
    }
}

/**
 * Delete lecturer user
 */
function deleteLecturer($conn, $lecturerId) {
    if (empty($lecturerId)) {
        http_response_code(400);
        echo json_encode(["message" => "Lecturer ID is required."]);
        return;
    }

    try {
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ? AND role = 'lecturer'");
        $stmt->execute([$lecturerId]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Lecturer not found."]);
            return;
        }

        echo json_encode(["message" => "Lecturer deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete lecturer.");
    }
}

/**
 * Delete a lecturer assignment
 */
function deleteAssignment($conn, $assignmentId) {
    if (empty($assignmentId)) {
        http_response_code(400);
        echo json_encode(["message" => "Assignment ID is required."]);
        return;
    }

    try {
        $stmt = $conn->prepare("DELETE FROM lecturer_assignments WHERE id = ?");
        $stmt->execute([$assignmentId]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Assignment not found."]);
            return;
        }

        echo json_encode(["message" => "Assignment removed successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete assignment.");
    }
}

/**
 * Assign a lecturer to a course or lesson
 */
function assignLecturer($conn) {
    $inputData = json_decode(file_get_contents("php://input"), true);

    $lecturerId     = sanitize_input($inputData['lecturerId']     ?? '');
    $courseId       = sanitize_input($inputData['courseId']       ?? '') ?: null;
    $lessonId       = sanitize_input($inputData['lessonId']       ?? '') ?: null;
    $studentId      = sanitize_input($inputData['studentId']      ?? '') ?: null;
    $assignmentMode = sanitize_input($inputData['assignmentMode'] ?? 'global_course');

    if (empty($lecturerId)) {
        http_response_code(400);
        echo json_encode(["message" => "lecturerId is required."]);
        return;
    }

    // Verify lecturer exists
    try {
        $stmtCheck = $conn->prepare("SELECT 1 FROM users WHERE id = ? AND role = 'lecturer'");
        $stmtCheck->execute([$lecturerId]);
        if (!$stmtCheck->fetch()) {
            http_response_code(404);
            echo json_encode(["message" => "Lecturer not found."]);
            return;
        }

        // Verify student enrollment for student_course assignment
        if ($assignmentMode === 'student_course') {
            if (empty($studentId) || empty($courseId)) {
                http_response_code(400);
                echo json_encode(["message" => "studentId and courseId are required for student_course assignment."]);
                return;
            }
            $stmtEnroll = $conn->prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?");
            $stmtEnroll->execute([$studentId, $courseId]);
            if (!$stmtEnroll->fetch()) {
                http_response_code(400);
                echo json_encode(["message" => "Student is not enrolled in the selected course."]);
                return;
            }
        }

        // Prevent duplicate assignment
        $stmtDup = $conn->prepare("
            SELECT 1 FROM lecturer_assignments
            WHERE lecturer_id = ?
            AND (course_id = ? OR (course_id IS NULL AND ? IS NULL))
            AND (lesson_id = ? OR (lesson_id IS NULL AND ? IS NULL))
            AND (student_id = ? OR (student_id IS NULL AND ? IS NULL))
        ");
        $stmtDup->execute([$lecturerId, $courseId, $courseId, $lessonId, $lessonId, $studentId, $studentId]);
        if ($stmtDup->fetch()) {
            echo json_encode(["message" => "Lecturer is already assigned with these parameters."]);
            return;
        }

        // Generate UUID
        $uuidBytes = random_bytes(16);
        $uuidBytes[6] = chr(ord($uuidBytes[6]) & 0x0f | 0x40);
        $uuidBytes[8] = chr(ord($uuidBytes[8]) & 0x3f | 0x80);
        $id = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($uuidBytes), 4));

        $stmt = $conn->prepare("
            INSERT INTO lecturer_assignments (id, lecturer_id, course_id, lesson_id, student_id, assignment_mode)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$id, $lecturerId, $courseId, $lessonId, $studentId, $assignmentMode]);

        http_response_code(201);
        echo json_encode(["message" => "Lecturer assigned successfully.", "id" => $id]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to assign lecturer.");
    }
}
