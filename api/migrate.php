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
            seq INT AUTO_INCREMENT UNIQUE KEY,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_chat_course (course_id, sent_at),
            INDEX idx_chat_student_thread (course_id, student_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Check if 'seq' column exists in chat_messages, if not, add it (for existing databases)
    $checkCol = $conn->query("SHOW COLUMNS FROM chat_messages LIKE 'seq'");
    if ($checkCol->rowCount() === 0) {
        $conn->exec("ALTER TABLE chat_messages ADD COLUMN seq INT AUTO_INCREMENT UNIQUE KEY");
    }

    // Check if 'created_by' column exists in users, if not, add it
    $checkCreatedBy = $conn->query("SHOW COLUMNS FROM users LIKE 'created_by'");
    if ($checkCreatedBy->rowCount() === 0) {
        $conn->exec("ALTER TABLE users ADD COLUMN created_by VARCHAR(36) NULL, ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    // Check if 'is_active' column exists in users, if not, add it
    $checkActive = $conn->query("SHOW COLUMNS FROM users LIKE 'is_active'");
    if ($checkActive->rowCount() === 0) {
        $conn->exec("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE");
    }

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
