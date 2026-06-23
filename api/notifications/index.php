<?php
/**
 * Lecturer Notifications API
 * GET /api/notifications/index.php
 *
 * Returns four categories of real-time notifications scoped to the
 * authenticated lecturer's assigned courses/lessons:
 *
 *   - pending_submissions  : Assignment submissions awaiting grading
 *   - unread_chat          : Unread student chat messages
 *   - new_enrollments      : Students who started a course in the last 72 h
 *   - progress_alerts      : Students who scored < 50 % on a quiz attempt
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

handle_cors();

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Only GET method is allowed."]);
    exit();
}

// Authenticate – any logged-in role may call this
$currentUser = validate_jwt();
$userId   = $currentUser['userId'];
$userRole = $currentUser['role'];

try {
    // ── 1. Pending assignment submissions ─────────────────────────────────
    if (in_array($userRole, ['admin', 'coordinator'])) {
        // Admin / coordinator see ALL pending submissions
        $stmtSub = $conn->prepare("
            SELECT
                s.id,
                s.submitted_at,
                u.name  AS student_name,
                a.title AS assignment_title,
                c.title AS course_title
            FROM assignment_submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN courses c     ON c.id = a.course_id
            JOIN users u       ON u.id = s.user_id
            WHERE s.status = 'pending'
            ORDER BY s.submitted_at DESC
            LIMIT 15
        ");
        $stmtSub->execute();
    } else {
        // Lecturer: only their scoped assignments
        $stmtSub = $conn->prepare("
            SELECT
                s.id,
                s.submitted_at,
                u.name  AS student_name,
                a.title AS assignment_title,
                c.title AS course_title
            FROM assignment_submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN courses c     ON c.id = a.course_id
            JOIN users u       ON u.id = s.user_id
            JOIN lecturer_assignments la ON (
                la.lecturer_id = ? AND (
                    (la.assignment_mode = 'global_course' AND la.course_id = a.course_id)
                    OR (la.assignment_mode = 'student_course' AND la.course_id = a.course_id AND la.student_id = s.user_id)
                    OR (la.assignment_mode = 'global_student' AND la.student_id = s.user_id)
                    OR (la.assignment_mode = 'lesson' AND la.lesson_id = a.lesson_id)
                )
            )
            WHERE s.status = 'pending'
            ORDER BY s.submitted_at DESC
            LIMIT 15
        ");
        $stmtSub->execute([$userId]);
    }
    $pendingSubmissions = $stmtSub->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // ── 2. Unread chat messages ────────────────────────────────────────────
    if (in_array($userRole, ['admin', 'coordinator'])) {
        $stmtChat = $conn->prepare("
            SELECT
                cm.id,
                cm.message,
                cm.sent_at,
                cm.course_id,
                cm.student_id,
                u.name  AS student_name,
                c.title AS course_title
            FROM chat_messages cm
            JOIN users u   ON u.id  = cm.student_id
            JOIN courses c ON c.id  = cm.course_id
            WHERE cm.sender_role = 'student' AND cm.is_read = 0
            ORDER BY cm.sent_at DESC
            LIMIT 15
        ");
        $stmtChat->execute();
    } else {
        $stmtChat = $conn->prepare("
            SELECT
                cm.id,
                cm.message,
                cm.sent_at,
                cm.course_id,
                cm.student_id,
                u.name  AS student_name,
                c.title AS course_title
            FROM chat_messages cm
            JOIN users u   ON u.id  = cm.student_id
            JOIN courses c ON c.id  = cm.course_id
            JOIN lecturer_assignments la ON (
                la.lecturer_id = ? AND (
                    (la.assignment_mode = 'global_course' AND la.course_id = cm.course_id)
                    OR (la.assignment_mode = 'student_course' AND la.course_id = cm.course_id AND la.student_id = cm.student_id)
                    OR (la.assignment_mode = 'global_student' AND la.student_id = cm.student_id)
                )
            )
            WHERE cm.sender_role = 'student' AND cm.is_read = 0
            ORDER BY cm.sent_at DESC
            LIMIT 15
        ");
        $stmtChat->execute([$userId]);
    }
    $unreadChats = $stmtChat ? ($stmtChat->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

    // ── 3. New enrollments (students who started a course in the last 72 h) ─
    // We use user_progress as a proxy since there's no dedicated enrollments table.
    // We look for newly created progress records – first lesson entry per student/course.
    if (in_array($userRole, ['admin', 'coordinator'])) {
        $stmtEnroll = $conn->prepare("
            SELECT
                up.user_id,
                up.course_id,
                MIN(up.updated_at) AS enrolled_at,
                u.name  AS student_name,
                c.title AS course_title
            FROM user_progress up
            JOIN users   u ON u.id = up.user_id
            JOIN courses c ON c.id = up.course_id
            WHERE up.updated_at >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
            GROUP BY up.user_id, up.course_id
            ORDER BY enrolled_at DESC
            LIMIT 10
        ");
        $stmtEnroll->execute();
    } else {
        $stmtEnroll = $conn->prepare("
            SELECT
                up.user_id,
                up.course_id,
                MIN(up.updated_at) AS enrolled_at,
                u.name  AS student_name,
                c.title AS course_title
            FROM user_progress up
            JOIN users   u ON u.id = up.user_id
            JOIN courses c ON c.id = up.course_id
            JOIN lecturer_assignments la ON (
                la.lecturer_id = ? AND (
                    (la.assignment_mode = 'global_course' AND la.course_id = up.course_id)
                    OR (la.assignment_mode = 'student_course' AND la.course_id = up.course_id AND la.student_id = up.user_id)
                    OR (la.assignment_mode = 'global_student' AND la.student_id = up.user_id)
                )
            )
            WHERE up.updated_at >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
            GROUP BY up.user_id, up.course_id
            ORDER BY enrolled_at DESC
            LIMIT 10
        ");
        $stmtEnroll->execute([$userId]);
    }
    $newEnrollments = $stmtEnroll ? ($stmtEnroll->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

    // ── 4. Progress alerts (quiz score < 50 % in last 7 days) ────────────
    if (in_array($userRole, ['admin', 'coordinator'])) {
        $stmtProgress = $conn->prepare("
            SELECT
                up.user_id,
                up.course_id,
                up.lesson_id,
                up.last_quiz_score,
                up.updated_at,
                u.name  AS student_name,
                c.title AS course_title,
                l.title AS lesson_title
            FROM user_progress up
            JOIN users   u ON u.id = up.user_id
            JOIN courses c ON c.id = up.course_id
            LEFT JOIN lessons l ON l.id = up.lesson_id
            WHERE up.last_quiz_score > 0
              AND up.last_quiz_score < 50
              AND up.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY up.updated_at DESC
            LIMIT 10
        ");
        $stmtProgress->execute();
    } else {
        $stmtProgress = $conn->prepare("
            SELECT
                up.user_id,
                up.course_id,
                up.lesson_id,
                up.last_quiz_score,
                up.updated_at,
                u.name  AS student_name,
                c.title AS course_title,
                l.title AS lesson_title
            FROM user_progress up
            JOIN users   u ON u.id = up.user_id
            JOIN courses c ON c.id = up.course_id
            LEFT JOIN lessons l ON l.id = up.lesson_id
            JOIN lecturer_assignments la ON (
                la.lecturer_id = ? AND (
                    (la.assignment_mode = 'global_course' AND la.course_id = up.course_id)
                    OR (la.assignment_mode = 'student_course' AND la.course_id = up.course_id AND la.student_id = up.user_id)
                    OR (la.assignment_mode = 'global_student' AND la.student_id = up.user_id)
                )
            )
            WHERE up.last_quiz_score > 0
              AND up.last_quiz_score < 50
              AND up.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY up.updated_at DESC
            LIMIT 10
        ");
        $stmtProgress->execute([$userId]);
    }
    $progressAlerts = $stmtProgress ? ($stmtProgress->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

    // ── Sanitise & respond ────────────────────────────────────────────────
    $totalCount =
        count($pendingSubmissions) +
        count($unreadChats) +
        count($newEnrollments) +
        count($progressAlerts);

    // Escape text fields
    $sanitise = function(array $items, array $textFields) use (&$sanitise): array {
        return array_map(function($item) use ($textFields) {
            foreach ($textFields as $f) {
                if (isset($item[$f])) {
                    $item[$f] = htmlspecialchars($item[$f], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }
            }
            return $item;
        }, $items);
    };

    echo json_encode([
        'total_count'         => $totalCount,
        'pending_submissions' => $sanitise($pendingSubmissions, ['student_name', 'assignment_title', 'course_title']),
        'unread_chat'         => $sanitise($unreadChats,        ['student_name', 'course_title', 'message']),
        'new_enrollments'     => $sanitise($newEnrollments,     ['student_name', 'course_title']),
        'progress_alerts'     => $sanitise($progressAlerts,     ['student_name', 'course_title', 'lesson_title']),
    ]);

} catch (Exception $e) {
    secure_error_handler($e, "Failed to load notifications.");
}
