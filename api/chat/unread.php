<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only GET method is allowed."]);
    exit();
}

// Enforce JWT authentication
$currentUser = validate_jwt();
$userId = $currentUser['userId'];
$userRole = $currentUser['role']; // student, lecturer, coordinator, admin

try {
    if ($userRole === 'student') {
        // Return unread count for this student (messages from lecturer that are unread)
        $stmt = $conn->prepare("
            SELECT COUNT(*) as unread_count 
            FROM chat_messages 
            WHERE student_id = ? AND sender_role = 'lecturer' AND is_read = 0
        ");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        
        echo json_encode([
            "unread_count" => (int)($result['unread_count'] ?? 0)
        ]);
        exit();
    }

    // For Lecturers, Coordinators, Admins:
    // 1. Get total unread count across all courses assigned to this lecturer (or all courses if admin)
    if ($userRole === 'admin' || $userRole === 'coordinator') {
        // Admin/coordinator gets unread count across all courses
        $stmtTotal = $conn->query("
            SELECT COUNT(*) as unread_count 
            FROM chat_messages 
            WHERE sender_role = 'student' AND is_read = 0
        ");
        $totalUnread = $stmtTotal->fetch()['unread_count'] ?? 0;

        // Fetch list of active threads (course + student)
        // Grouped by course, showing latest message and student info
        $stmtThreads = $conn->query("
            SELECT 
                cm.course_id, 
                c.title as course_title, 
                cm.student_id, 
                u.name as student_name, 
                u.email as student_email,
                SUM(CASE WHEN cm.sender_role = 'student' AND cm.is_read = 0 THEN 1 ELSE 0 END) as unread_messages,
                (SELECT message FROM chat_messages WHERE course_id = cm.course_id AND student_id = cm.student_id ORDER BY sent_at DESC LIMIT 1) as latest_message,
                (SELECT sent_at FROM chat_messages WHERE course_id = cm.course_id AND student_id = cm.student_id ORDER BY sent_at DESC LIMIT 1) as latest_sent_at
            FROM chat_messages cm
            JOIN courses c ON cm.course_id = c.id
            JOIN users u ON cm.student_id = u.id
            GROUP BY cm.course_id, cm.student_id
            ORDER BY latest_sent_at DESC
        ");
        $threads = $stmtThreads->fetchAll() ?: [];
    } else {
        // Lecturer gets only their assigned student threads
        // We calculate unread count and fetch threads based on assigned students and courses
        $stmtTotal = $conn->prepare("
            SELECT COUNT(*) as unread_count 
            FROM chat_messages cm
            JOIN lecturer_assignments la ON (
                la.lecturer_id = ? AND (
                    (la.assignment_mode = 'global_course' AND la.course_id = cm.course_id)
                    OR (la.assignment_mode = 'student_course' AND la.course_id = cm.course_id AND la.student_id = cm.student_id)
                    OR (la.assignment_mode = 'global_student' AND la.student_id = cm.student_id)
                )
            )
            WHERE cm.sender_role = 'student' AND cm.is_read = 0
        ");
        $stmtTotal->execute([$userId]);
        $totalUnread = $stmtTotal->fetch()['unread_count'] ?? 0;

        $stmtThreads = $conn->prepare("
            SELECT 
                cm.course_id, 
                c.title as course_title, 
                cm.student_id, 
                u.name as student_name, 
                u.email as student_email,
                SUM(CASE WHEN cm.sender_role = 'student' AND cm.is_read = 0 THEN 1 ELSE 0 END) as unread_messages,
                (SELECT message FROM chat_messages WHERE course_id = cm.course_id AND student_id = cm.student_id ORDER BY sent_at DESC LIMIT 1) as latest_message,
                (SELECT sent_at FROM chat_messages WHERE course_id = cm.course_id AND student_id = cm.student_id ORDER BY sent_at DESC LIMIT 1) as latest_sent_at
            FROM chat_messages cm
            JOIN courses c ON cm.course_id = c.id
            JOIN users u ON cm.student_id = u.id
            JOIN lecturer_assignments la ON (
                la.lecturer_id = ? AND (
                    (la.assignment_mode = 'global_course' AND la.course_id = cm.course_id)
                    OR (la.assignment_mode = 'student_course' AND la.course_id = cm.course_id AND la.student_id = cm.student_id)
                    OR (la.assignment_mode = 'global_student' AND la.student_id = cm.student_id)
                )
            )
            GROUP BY cm.course_id, cm.student_id
            ORDER BY latest_sent_at DESC
        ");
        $stmtThreads->execute([$userId]);
        $threads = $stmtThreads->fetchAll() ?: [];
    }

    // Escape thread details
    foreach ($threads as &$t) {
        $t['course_title'] = escape_output($t['course_title']);
        $t['student_name'] = escape_output($t['student_name']);
        $t['student_email'] = escape_output($t['student_email']);
        $t['latest_message'] = escape_output($t['latest_message']);
    }

    echo json_encode([
        "unread_count" => (int)$totalUnread,
        "threads" => $threads
    ]);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to retrieve unread chat count.");
}
