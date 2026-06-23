<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Enforce Role-Based Access Control (RBAC) - Must be Admin or Coordinator
$currentUser = require_auth(['admin', 'coordinator']);

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only GET method is allowed."]);
    exit();
}

try {
    // 1. Total Students
    $stmtStudents = $conn->query("SELECT COUNT(*) as total FROM users WHERE role = 'student'");
    $totalStudents = $stmtStudents->fetch()['total'];

    // 2. Active Courses
    $stmtCourses = $conn->query("SELECT COUNT(*) as total FROM courses");
    $totalCourses = $stmtCourses->fetch()['total'];

    // 3. Certificates Issued
    $stmtCerts = $conn->query("SELECT COUNT(*) as total FROM certificate_requests WHERE status = 'approved'");
    $totalCerts = $stmtCerts->fetch()['total'];

    // 4. Average Course Completion Rate
    // Calculates percentage of completed lessons out of total recorded user_progress items
    $stmtCompletion = $conn->query("
        SELECT IFNULL(ROUND(AVG(is_completed) * 100), 0) as avg_rate 
        FROM user_progress
    ");
    $avgCompletion = $stmtCompletion->fetch()['avg_rate'];

    // 5. Recently Added Courses (limit to 5)
    $stmtRecent = $conn->query("
        SELECT c.id, c.title, c.totalLessons, 'Published' as status 
        FROM courses c 
        ORDER BY c.created_at DESC 
        LIMIT 5
    ");
    $recentCourses = $stmtRecent->fetchAll();

    // Escape recent courses text fields for safety
    $escapedRecentCourses = [];
    foreach ($recentCourses as $course) {
        $escapedRecentCourses[] = [
            "id" => escape_output($course['id']),
            "title" => escape_output($course['title']),
            "totalLessons" => (int)$course['totalLessons'],
            "status" => escape_output($course['status'])
        ];
    }

    echo json_encode([
        "students" => (int)$totalStudents,
        "courses" => (int)$totalCourses,
        "certs" => (int)$totalCerts,
        "completion" => (int)$avgCompletion . "%",
        "recentCourses" => $escapedRecentCourses
    ]);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to compile admin dashboard analytics.");
}
