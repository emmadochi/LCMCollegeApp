<?php
require_once __DIR__ . '/config/db.php';

header("Content-Type: application/json; charset=UTF-8");

try {
    // 1. Create lecturer_assignments if not exists
    $conn->exec("
        CREATE TABLE IF NOT EXISTS lecturer_assignments (
            id VARCHAR(36) PRIMARY KEY,
            lecturer_id VARCHAR(36) NOT NULL,
            course_id VARCHAR(36) NULL,
            lesson_id VARCHAR(36) NULL,
            student_id VARCHAR(36) NULL,
            assignment_mode VARCHAR(50) NOT NULL COMMENT 'global_course, global_student, lesson',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 2. Create chat_messages if not exists
    $conn->exec("
        CREATE TABLE IF NOT EXISTS chat_messages (
            id VARCHAR(36) PRIMARY KEY,
            course_id VARCHAR(36) NOT NULL,
            student_id VARCHAR(36) NOT NULL,
            sender_id VARCHAR(36) NOT NULL,
            sender_role VARCHAR(20) NOT NULL COMMENT 'student or lecturer',
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_chat_course (course_id, sent_at),
            INDEX idx_chat_student_thread (course_id, student_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    echo json_encode([
        "status" => "success",
        "message" => "Database tables migration checked and executed successfully."
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Migration failed: " . $e->getMessage()
    ]);
}
