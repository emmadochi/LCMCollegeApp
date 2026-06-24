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
        $studentId = $_GET['id'] ?? null;
        if ($studentId) {
            getStudentProfile($conn, $studentId);
        } else {
            listStudents($conn);
        }
        break;

    case 'PUT':
        toggleStudentStatus($conn);
        break;

    case 'DELETE':
        deleteStudent($conn);
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}

/**
 * List all students (users with role = 'student')
 */
function listStudents($conn) {
    global $role, $userId;
    $courseId = $_GET['course_id'] ?? $_GET['courseId'] ?? null;
    try {
        if (in_array($role, ['admin', 'coordinator'])) {
            if ($courseId) {
                $stmt = $conn->prepare("
                    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at
                    FROM users u
                    JOIN enrollments e ON e.user_id = u.id
                    WHERE u.role = 'student' AND e.course_id = ?
                    ORDER BY u.name ASC
                ");
                $stmt->execute([$courseId]);
            } else {
                $stmt = $conn->prepare("
                    SELECT id, name, email, role, is_active, created_at
                    FROM users
                    WHERE role = 'student'
                    ORDER BY created_at DESC
                ");
                $stmt->execute();
            }
        } else {
            // Lecturer: only see students assigned to them via lecturer_assignments
            $stmt = $conn->prepare("
                SELECT DISTINCT u.id, u.name, u.email, u.role, u.is_active, u.created_at
                FROM users u
                LEFT JOIN enrollments e ON e.user_id = u.id
                JOIN lecturer_assignments la ON (
                    la.lecturer_id = ? AND (
                        (la.assignment_mode = 'student_course' AND la.student_id = u.id AND la.course_id = e.course_id)
                        OR (la.assignment_mode = 'global_course' AND la.course_id = e.course_id)
                        OR (la.assignment_mode = 'global_student' AND la.student_id = u.id)
                        OR (la.assignment_mode = 'lesson' AND la.lesson_id = (SELECT lesson_id FROM user_progress up WHERE up.user_id = u.id AND up.lesson_id = la.lesson_id LIMIT 1))
                    )
                )
                WHERE u.role = 'student'
                ORDER BY u.name ASC
            ");
            $stmt->execute([$userId]);
        }
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $studentEnrollments = [];
        if (count($students) > 0) {
            $studentIds = array_column($students, 'id');
            $inClause = implode(',', array_fill(0, count($studentIds), '?'));
            
            $stmtProg = $conn->prepare("
                SELECT e.user_id, e.course_id, c.title AS course_title, c.totalLessons AS total_lessons,
                       (SELECT COUNT(*) FROM user_progress up WHERE up.user_id = e.user_id AND up.course_id = e.course_id AND up.is_completed = 1) AS completed_lessons
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                WHERE e.user_id IN ($inClause)
            ");
            $stmtProg->execute($studentIds);
            $enrollments = $stmtProg->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($enrollments as $enc) {
                $uid = $enc['user_id'];
                if (!isset($studentEnrollments[$uid])) {
                    $studentEnrollments[$uid] = [];
                }
                $total = intval($enc['total_lessons']);
                $completed = intval($enc['completed_lessons']);
                $pct = $total > 0 ? round(($completed / $total) * 100) : 0;
                $studentEnrollments[$uid][] = [
                    'course_id' => $enc['course_id'],
                    'course_title' => escape_output($enc['course_title']),
                    'progress_percent' => $pct,
                    'completed_lessons' => $completed,
                    'total_lessons' => $total
                ];
            }
        }

        echo json_encode(array_map(function($s) use ($studentEnrollments) {
            return [
                'id'         => $s['id'],
                'name'       => escape_output($s['name']),
                'email'      => escape_output($s['email']),
                'role'       => $s['role'],
                'is_active'  => (bool)$s['is_active'],
                'created_at' => $s['created_at'],
                'courses'    => $studentEnrollments[$s['id']] ?? []
            ];
        }, $students));
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Get a single student profile with progress metrics and reviews
 */
function getStudentProfile($conn, $studentId) {
    global $role, $userId;
    try {
        // 1. Basic student info
        $stmt = $conn->prepare("SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ? AND role = 'student'");
        $stmt->execute([$studentId]);
        $student = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$student) {
            http_response_code(404);
            echo json_encode(["message" => "Student not found."]);
            return;
        }

        // Access check for lecturer
        if ($role === 'lecturer') {
            $stmtCheck = $conn->prepare("
                SELECT 1 FROM lecturer_assignments la
                LEFT JOIN enrollments e ON e.course_id = la.course_id AND e.user_id = ?
                WHERE la.lecturer_id = ? AND (
                    la.student_id = ?
                    OR (la.assignment_mode = 'global_course' AND la.course_id = e.course_id)
                )
            ");
            $stmtCheck->execute([$studentId, $userId, $studentId]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(["message" => "Access denied. Student is not assigned to you."]);
                return;
            }
        }

        // 2. Progress / Enrollments
        if ($role === 'lecturer') {
            $stmtProg = $conn->prepare("
                SELECT DISTINCT up.course_id, up.lesson_id, up.is_completed, up.last_quiz_score,
                       c.title AS course_title,
                       l.title AS lesson_title
                FROM user_progress up
                LEFT JOIN courses c ON c.id = up.course_id
                LEFT JOIN lessons l ON l.id = up.lesson_id
                JOIN lecturer_assignments la ON (
                    la.lecturer_id = ? AND (
                        (la.assignment_mode = 'student_course' AND la.student_id = up.user_id AND la.course_id = up.course_id)
                        OR (la.assignment_mode = 'global_course' AND la.course_id = up.course_id)
                        OR (la.assignment_mode = 'global_student' AND la.student_id = up.user_id)
                    )
                )
                WHERE up.user_id = ?
                ORDER BY up.updated_at DESC
            ");
            $stmtProg->execute([$userId, $studentId]);
        } else {
            $stmtProg = $conn->prepare("
                SELECT up.course_id, up.lesson_id, up.is_completed, up.last_quiz_score,
                       c.title AS course_title,
                       l.title AS lesson_title
                FROM user_progress up
                LEFT JOIN courses c ON c.id = up.course_id
                LEFT JOIN lessons l ON l.id = up.lesson_id
                WHERE up.user_id = ?
                ORDER BY up.updated_at DESC
            ");
            $stmtProg->execute([$studentId]);
        }
        $progress = $stmtProg->fetchAll(PDO::FETCH_ASSOC);

        // Count distinct enrolled courses
        $enrolledCourseIds = array_unique(array_column($progress, 'course_id'));

        // 3. Student reviews
        if ($role === 'lecturer') {
            $stmtRev = $conn->prepare("
                SELECT DISTINCT r.id, r.rating, r.comment, r.created_at,
                       c.title AS course_title
                FROM reviews r
                LEFT JOIN courses c ON c.id = r.course_id
                JOIN lecturer_assignments la ON (
                    la.lecturer_id = ? AND (
                        (la.assignment_mode = 'student_course' AND la.student_id = r.user_id AND la.course_id = r.course_id)
                        OR (la.assignment_mode = 'global_course' AND la.course_id = r.course_id)
                        OR (la.assignment_mode = 'global_student' AND la.student_id = r.user_id)
                    )
                )
                WHERE r.user_id = ?
                ORDER BY r.created_at DESC
            ");
            $stmtRev->execute([$userId, $studentId]);
        } else {
            $stmtRev = $conn->prepare("
                SELECT r.id, r.rating, r.comment, r.created_at,
                       c.title AS course_title
                FROM reviews r
                LEFT JOIN courses c ON c.id = r.course_id
                WHERE r.user_id = ?
                ORDER BY r.created_at DESC
            ");
            $stmtRev->execute([$studentId]);
        }
        $reviews = $stmtRev->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'student'       => [
                'id'         => $student['id'],
                'name'       => escape_output($student['name']),
                'email'      => escape_output($student['email']),
                'is_active'  => (bool)$student['is_active'],
                'created_at' => $student['created_at'],
            ],
            'enrolled_count' => count($enrolledCourseIds),
            'progress'      => array_map(function($p) {
                return [
                    'course_id'      => $p['course_id'],
                    'course_title'   => escape_output($p['course_title'] ?? ''),
                    'lesson_id'      => $p['lesson_id'],
                    'lesson_title'   => escape_output($p['lesson_title'] ?? ''),
                    'is_completed'   => (bool)$p['is_completed'],
                    'last_quiz_score'=> (int)$p['last_quiz_score'],
                ];
            }, $progress),
            'reviews'       => array_map(function($r) {
                return [
                    'id'           => $r['id'],
                    'rating'       => (int)$r['rating'],
                    'comment'      => escape_output($r['comment'] ?? ''),
                    'course_title' => escape_output($r['course_title'] ?? ''),
                    'created_at'   => $r['created_at'],
                ];
            }, $reviews),
        ]);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Toggle student active status (deactivate / activate)
 */
function toggleStudentStatus($conn) {
    global $role;
    if (!in_array($role, ['admin', 'coordinator'])) {
        http_response_code(403);
        echo json_encode(["message" => "Access denied. Administrative privileges required."]);
        return;
    }

    $input = json_decode(file_get_contents("php://input"), true);
    $studentId = $input['id'] ?? null;
    $isActive = isset($input['is_active']) ? (int)$input['is_active'] : null;

    if (!$studentId || $isActive === null) {
        http_response_code(400);
        echo json_encode(["message" => "Student ID and active status are required."]);
        return;
    }

    try {
        $stmt = $conn->prepare("UPDATE users SET is_active = ? WHERE id = ? AND role = 'student'");
        $stmt->execute([$isActive, $studentId]);

        echo json_encode(["message" => "Student status updated successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Delete a student account
 */
function deleteStudent($conn) {
    global $role;
    if (!in_array($role, ['admin', 'coordinator'])) {
        http_response_code(403);
        echo json_encode(["message" => "Access denied. Administrative privileges required."]);
        return;
    }

    $studentId = $_GET['id'] ?? null;

    if (!$studentId) {
        http_response_code(400);
        echo json_encode(["message" => "Student ID is required."]);
        return;
    }

    try {
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ? AND role = 'student'");
        $stmt->execute([$studentId]);

        echo json_encode(["message" => "Student deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}
