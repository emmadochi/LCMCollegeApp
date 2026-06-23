<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

handle_cors();

// Enforce Role-Based Access Control
$currentUser = require_auth(['admin', 'coordinator', 'lecturer']);
$role = $currentUser['role'];
$userId = $currentUser['userId'];

header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $assignmentId = $_GET['id'] ?? null;
        $lessonId     = $_GET['lesson_id'] ?? null;
        $submissions  = $_GET['submissions'] ?? null;
        if ($submissions) {
            listSubmissions($conn);
        } elseif ($assignmentId) {
            getAssignment($conn, $assignmentId);
        } elseif ($lessonId) {
            getAssignmentByLesson($conn, $lessonId);
        } else {
            listAssignments($conn);
        }
        break;

    case 'POST':
        $data   = json_decode(file_get_contents("php://input"), true);
        $action = $data['action'] ?? 'create';
        if ($action === 'update') {
            updateAssignment($conn, $data);
        } elseif ($action === 'grade_submission') {
            gradeSubmission($conn, $data);
        } else {
            createAssignment($conn, $data);
        }
        break;

    case 'DELETE':
        $assignmentId = $_GET['id'] ?? '';
        deleteAssignment($conn, $assignmentId);
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}

/**
 * List all assignments with lesson + course context
 */
function listAssignments($conn) {
    global $role, $userId;
    try {
        if (in_array($role, ['admin', 'coordinator'])) {
            $stmt = $conn->prepare("
                SELECT a.id, a.lesson_id, a.course_id, a.title, a.due_date, a.updated_at,
                       l.title AS lesson_title,
                       c.title AS course_title,
                       (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count
                FROM assignments a
                LEFT JOIN lessons l ON l.id = a.lesson_id
                LEFT JOIN courses c ON c.id = a.course_id
                ORDER BY a.updated_at DESC
            ");
            $stmt->execute();
        } else {
            // Lecturer: only see assignments for their assigned courses or lessons
            $stmt = $conn->prepare("
                SELECT DISTINCT a.id, a.lesson_id, a.course_id, a.title, a.due_date, a.updated_at,
                       l.title AS lesson_title,
                       c.title AS course_title,
                       (
                           SELECT COUNT(*) FROM assignment_submissions s
                           JOIN lecturer_assignments la2 ON (
                               la2.lecturer_id = ? AND (
                                   (la2.assignment_mode = 'global_course' AND la2.course_id = a.course_id)
                                   OR (la2.assignment_mode = 'student_course' AND la2.course_id = a.course_id AND la2.student_id = s.user_id)
                                   OR (la2.assignment_mode = 'global_student' AND la2.student_id = s.user_id)
                               )
                           )
                           WHERE s.assignment_id = a.id
                       ) AS submission_count
                FROM assignments a
                LEFT JOIN lessons l ON l.id = a.lesson_id
                LEFT JOIN courses c ON c.id = a.course_id
                JOIN lecturer_assignments la ON (
                    la.lecturer_id = ? AND (
                        la.course_id = a.course_id 
                        OR la.lesson_id = a.lesson_id
                    )
                )
                ORDER BY a.updated_at DESC
            ");
            $stmt->execute([$userId, $userId]);
        }
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(array_map(function($r) {
            return [
                'id'               => $r['id'],
                'lesson_id'        => $r['lesson_id'],
                'course_id'        => $r['course_id'],
                'title'            => escape_output($r['title']),
                'due_date'         => $r['due_date'],
                'lesson_title'     => escape_output($r['lesson_title'] ?? ''),
                'course_title'     => escape_output($r['course_title'] ?? ''),
                'submission_count' => (int)$r['submission_count'],
                'updated_at'       => $r['updated_at'],
            ];
        }, $rows));
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Get single assignment by ID
 */
function getAssignment($conn, $id) {
    global $role, $userId;
    try {
        $stmt = $conn->prepare("
            SELECT a.*, l.title AS lesson_title, c.title AS course_title
            FROM assignments a
            LEFT JOIN lessons l ON l.id = a.lesson_id
            LEFT JOIN courses c ON c.id = a.course_id
            WHERE a.id = ?
        ");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(404);
            echo json_encode(["message" => "Assignment not found."]);
            return;
        }

        // Access check: lecturer must be assigned
        if ($role === 'lecturer') {
            $stmtCheck = $conn->prepare("
                SELECT 1 FROM lecturer_assignments 
                WHERE lecturer_id = ? AND (course_id = ? OR lesson_id = ?)
            ");
            $stmtCheck->execute([$userId, $row['course_id'], $row['lesson_id']]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(["message" => "Access denied. You are not assigned to this course or lesson."]);
                return;
            }
        }

        // Fetch submissions
        if ($role === 'lecturer') {
            $stmtS = $conn->prepare("
                SELECT s.id, s.status, s.submission_type, s.submission_text, s.file_url, s.file_name,
                       s.grade, s.feedback, s.submitted_at, s.graded_at,
                       u.name AS user_name, u.email AS user_email
                FROM assignment_submissions s
                LEFT JOIN users u ON u.id = s.user_id
                JOIN lecturer_assignments la ON (
                    la.lecturer_id = ? AND (
                        (la.assignment_mode = 'global_course' AND la.course_id = ?)
                        OR (la.assignment_mode = 'student_course' AND la.course_id = ? AND la.student_id = s.user_id)
                        OR (la.assignment_mode = 'global_student' AND la.student_id = s.user_id)
                        OR (la.assignment_mode = 'lesson' AND la.lesson_id = ?)
                    )
                )
                WHERE s.assignment_id = ?
                ORDER BY s.submitted_at DESC
            ");
            $stmtS->execute([$userId, $row['course_id'], $row['course_id'], $userId, $row['lesson_id'], $id]);
        } else {
            $stmtS = $conn->prepare("
                SELECT s.id, s.status, s.submission_type, s.submission_text, s.file_url, s.file_name,
                       s.grade, s.feedback, s.submitted_at, s.graded_at,
                       u.name AS user_name, u.email AS user_email
                FROM assignment_submissions s
                LEFT JOIN users u ON u.id = s.user_id
                WHERE s.assignment_id = ?
                ORDER BY s.submitted_at DESC
            ");
            $stmtS->execute([$id]);
        }
        $submissions = $stmtS->fetchAll(PDO::FETCH_ASSOC);

        $row['lesson_title']  = escape_output($row['lesson_title'] ?? '');
        $row['course_title']  = escape_output($row['course_title'] ?? '');
        $row['title']         = escape_output($row['title']);
        $row['submissions']   = array_map(function($s) {
            return [
                'id'              => $s['id'],
                'status'          => $s['status'],
                'submission_type' => $s['submission_type'],
                'submission_text' => $s['submission_text'],
                'file_url'        => $s['file_url'],
                'file_name'       => escape_output($s['file_name'] ?? ''),
                'grade'           => escape_output($s['grade'] ?? ''),
                'feedback'        => escape_output($s['feedback'] ?? ''),
                'submitted_at'    => $s['submitted_at'],
                'graded_at'       => $s['graded_at'],
                'user_name'       => escape_output($s['user_name'] ?? ''),
                'user_email'      => escape_output($s['user_email'] ?? ''),
            ];
        }, $submissions);

        echo json_encode($row);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Get assignment by lesson ID
 */
function getAssignmentByLesson($conn, $lessonId) {
    try {
        $stmt = $conn->prepare("SELECT id FROM assignments WHERE lesson_id = ?");
        $stmt->execute([$lessonId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            echo json_encode(null);
            return;
        }

        getAssignment($conn, $row['id']);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Create a new assignment
 */
function createAssignment($conn, $data) {
    global $role, $userId;
    try {
        $lessonId     = sanitize_input($data['lessonId']     ?? '');
        $courseId     = sanitize_input($data['courseId']     ?? '');
        $title        = sanitize_input($data['title']        ?? '');
        $instructions = $data['instructions'] ?? '';    // HTML — keep as-is
        $dueDate      = $data['dueDate'] ?? '';

        if (!$lessonId || !$courseId || !$title || !$dueDate) {
            http_response_code(400);
            echo json_encode(["message" => "lessonId, courseId, title, and dueDate are required."]);
            return;
        }

        // Access check for lecturer
        if ($role === 'lecturer') {
            $stmtCheck = $conn->prepare("
                SELECT 1 FROM lecturer_assignments 
                WHERE lecturer_id = ? AND (course_id = ? OR lesson_id = ?)
            ");
            $stmtCheck->execute([$userId, $courseId, $lessonId]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(["message" => "Access denied. You cannot create assignments for this course or lesson."]);
                return;
            }
        }

        $assignmentId = bin2hex(random_bytes(16));
        $stmt = $conn->prepare("
            INSERT INTO assignments (id, lesson_id, course_id, title, instructions, due_date)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$assignmentId, $lessonId, $courseId, $title, $instructions, $dueDate]);

        http_response_code(201);
        echo json_encode(["message" => "Assignment created successfully.", "id" => $assignmentId]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to create assignment.");
    }
}

/**
 * Update an existing assignment
 */
function updateAssignment($conn, $data) {
    global $role, $userId;
    try {
        $id           = sanitize_input($data['id']           ?? '');
        $title        = sanitize_input($data['title']        ?? '');
        $instructions = $data['instructions'] ?? '';
        $dueDate      = $data['dueDate'] ?? '';

        if (!$id || !$title || !$dueDate) {
            http_response_code(400);
            echo json_encode(["message" => "id, title, and dueDate are required."]);
            return;
        }

        // Fetch course/lesson context
        $stmtCtx = $conn->prepare("SELECT course_id, lesson_id FROM assignments WHERE id = ?");
        $stmtCtx->execute([$id]);
        $ctx = $stmtCtx->fetch();
        if (!$ctx) {
            http_response_code(404);
            echo json_encode(["message" => "Assignment not found."]);
            return;
        }

        // Access check for lecturer
        if ($role === 'lecturer') {
            $stmtCheck = $conn->prepare("
                SELECT 1 FROM lecturer_assignments 
                WHERE lecturer_id = ? AND (course_id = ? OR lesson_id = ?)
            ");
            $stmtCheck->execute([$userId, $ctx['course_id'], $ctx['lesson_id']]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(["message" => "Access denied. You cannot update assignments for this course or lesson."]);
                return;
            }
        }

        $stmt = $conn->prepare("
            UPDATE assignments SET title = ?, instructions = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([$title, $instructions, $dueDate, $id]);

        echo json_encode(["message" => "Assignment updated successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to update assignment.");
    }
}

/**
 * Delete an assignment
 */
function deleteAssignment($conn, $assignmentId) {
    global $role, $userId;
    try {
        if (!$assignmentId) {
            http_response_code(400);
            echo json_encode(["message" => "Assignment ID is required."]);
            return;
        }

        // Fetch course/lesson context
        $stmtCtx = $conn->prepare("SELECT course_id, lesson_id FROM assignments WHERE id = ?");
        $stmtCtx->execute([$assignmentId]);
        $ctx = $stmtCtx->fetch();
        if (!$ctx) {
            http_response_code(404);
            echo json_encode(["message" => "Assignment not found."]);
            return;
        }

        // Access check for lecturer
        if ($role === 'lecturer') {
            $stmtCheck = $conn->prepare("
                SELECT 1 FROM lecturer_assignments 
                WHERE lecturer_id = ? AND (course_id = ? OR lesson_id = ?)
            ");
            $stmtCheck->execute([$userId, $ctx['course_id'], $ctx['lesson_id']]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(["message" => "Access denied. You cannot delete assignments for this course or lesson."]);
                return;
            }
        }

        $stmt = $conn->prepare("DELETE FROM assignments WHERE id = ?");
        $stmt->execute([$assignmentId]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Assignment not found."]);
            return;
        }

        echo json_encode(["message" => "Assignment deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete assignment.");
    }
}

/**
 * Grade a student submission
 */
function gradeSubmission($conn, $data) {
    global $role, $userId;
    try {
        $submissionId = sanitize_input($data['submissionId'] ?? '');
        $grade        = sanitize_input($data['grade']        ?? '');
        $feedback     = sanitize_input($data['feedback']     ?? '');
        $status       = sanitize_input($data['status']       ?? 'graded');

        if (!$submissionId) {
            http_response_code(400);
            echo json_encode(["message" => "submissionId is required."]);
            return;
        }

        // Fetch course/lesson context of the submission
        $stmtCtx = $conn->prepare("
            SELECT a.course_id, a.lesson_id 
            FROM assignment_submissions s
            JOIN assignments a ON a.id = s.assignment_id
            WHERE s.id = ?
        ");
        $stmtCtx->execute([$submissionId]);
        $ctx = $stmtCtx->fetch();
        if (!$ctx) {
            http_response_code(404);
            echo json_encode(["message" => "Submission not found."]);
            return;
        }

        // Access check for lecturer
        if ($role === 'lecturer') {
            // Get student ID for the submission
            $stmtSub = $conn->prepare("SELECT user_id FROM assignment_submissions WHERE id = ?");
            $stmtSub->execute([$submissionId]);
            $subStudentId = $stmtSub->fetchColumn();

            $stmtCheck = $conn->prepare("
                SELECT 1 FROM lecturer_assignments la
                WHERE la.lecturer_id = ? AND (
                    (la.assignment_mode = 'global_course' AND la.course_id = ?)
                    OR (la.assignment_mode = 'student_course' AND la.course_id = ? AND la.student_id = ?)
                    OR (la.assignment_mode = 'global_student' AND la.student_id = ?)
                    OR (la.assignment_mode = 'lesson' AND la.lesson_id = ?)
                )
            ");
            $stmtCheck->execute([$userId, $ctx['course_id'], $ctx['course_id'], $subStudentId, $subStudentId, $ctx['lesson_id']]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(["message" => "Access denied. You cannot grade submissions for this student's course or lesson."]);
                return;
            }
        }

        $stmt = $conn->prepare("
            UPDATE assignment_submissions
            SET grade = ?, feedback = ?, status = ?, graded_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([$grade, $feedback, $status, $submissionId]);

        echo json_encode(["message" => "Submission graded successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to grade submission.");
    }
}

/**
 * List all submissions visible to the current user (admin: all, lecturer: scoped)
 */
function listSubmissions($conn) {
    global $role, $userId;
    $statusFilter = $_GET['status'] ?? 'all';
    try {
        if (in_array($role, ['admin', 'coordinator'])) {
            $sql = "
                SELECT s.id, s.assignment_id, s.user_id, s.status, s.submission_type,
                       s.submission_text, s.file_url, s.file_name,
                       s.grade, s.feedback, s.submitted_at, s.graded_at,
                       u.name AS user_name, u.email AS user_email,
                       a.title AS assignment_title, a.course_id, a.lesson_id,
                       c.title AS course_title, l.title AS lesson_title
                FROM assignment_submissions s
                JOIN users u ON u.id = s.user_id
                JOIN assignments a ON a.id = s.assignment_id
                LEFT JOIN courses c ON c.id = a.course_id
                LEFT JOIN lessons l ON l.id = a.lesson_id
            ";
            $params = [];
            if ($statusFilter !== 'all') {
                $sql .= " WHERE s.status = ?";
                $params[] = $statusFilter;
            }
            $sql .= " ORDER BY s.submitted_at DESC";
        } else {
            // Lecturer: only see submissions from their scoped courses/lessons/students
            $sql = "
                SELECT s.id, s.assignment_id, s.user_id, s.status, s.submission_type,
                       s.submission_text, s.file_url, s.file_name,
                       s.grade, s.feedback, s.submitted_at, s.graded_at,
                       u.name AS user_name, u.email AS user_email,
                       a.title AS assignment_title, a.course_id, a.lesson_id,
                       c.title AS course_title, l.title AS lesson_title
                FROM assignment_submissions s
                JOIN users u ON u.id = s.user_id
                JOIN assignments a ON a.id = s.assignment_id
                LEFT JOIN courses c ON c.id = a.course_id
                LEFT JOIN lessons l ON l.id = a.lesson_id
                JOIN lecturer_assignments la ON (
                    la.lecturer_id = ? AND (
                        (la.assignment_mode = 'global_course' AND la.course_id = a.course_id)
                        OR (la.assignment_mode = 'student_course' AND la.course_id = a.course_id AND la.student_id = s.user_id)
                        OR (la.assignment_mode = 'global_student' AND la.student_id = s.user_id)
                        OR (la.assignment_mode = 'lesson' AND la.lesson_id = a.lesson_id)
                    )
                )
            ";
            $params = [$userId];
            if ($statusFilter !== 'all') {
                $sql .= " WHERE s.status = ?";
                $params[] = $statusFilter;
            }
            $sql .= " ORDER BY s.submitted_at DESC";
        }

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(array_map(function($s) {
            return [
                'id'               => $s['id'],
                'assignmentId'     => $s['assignment_id'],
                'userId'           => $s['user_id'],
                'status'           => $s['status'],
                'submissionType'   => $s['submission_type'],
                'submissionText'   => $s['submission_text'],
                'fileUrl'          => $s['file_url'],
                'fileName'         => escape_output($s['file_name'] ?? ''),
                'grade'            => escape_output($s['grade'] ?? ''),
                'feedback'         => escape_output($s['feedback'] ?? ''),
                'submittedAt'      => $s['submitted_at'],
                'gradedAt'         => $s['graded_at'],
                'userName'         => escape_output($s['user_name'] ?? ''),
                'userEmail'        => escape_output($s['user_email'] ?? ''),
                'assignmentTitle'  => escape_output($s['assignment_title'] ?? ''),
                'courseId'         => $s['course_id'],
                'lessonId'         => $s['lesson_id'],
                'courseTitle'      => escape_output($s['course_title'] ?? ''),
                'lessonTitle'      => escape_output($s['lesson_title'] ?? ''),
            ];
        }, $rows));
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to retrieve submissions.");
    }
}
