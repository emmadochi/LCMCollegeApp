-- Database Initialization for LCM Bible College App
CREATE DATABASE IF NOT EXISTS lcm_college CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lcm_college;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student' COMMENT 'student, coordinator, admin',
    created_by VARCHAR(36) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_email (email)
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT,
    duration VARCHAR(50) DEFAULT 'Self-paced',
    rating DECIMAL(3,2) DEFAULT 4.80,
    isFeatured BOOLEAN DEFAULT FALSE,
    hasQuizzes BOOLEAN DEFAULT TRUE,
    totalLessons INT DEFAULT 0,
    thumbnailUrl VARCHAR(2048),
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'USD',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_course_featured (isFeatured)
);

-- Lessons Table
CREATE TABLE IF NOT EXISTS lessons (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    module_id VARCHAR(255) DEFAULT 'General' COMMENT 'Groups lessons into course modules',
    title VARCHAR(255) NOT NULL,
    contentType VARCHAR(50) DEFAULT 'video',
    videoSource VARCHAR(20) DEFAULT 'link' COMMENT 'link, upload',
    contentUrl VARCHAR(2048),
    notes TEXT COMMENT 'HTML rich-text course contents',
    order_index INT NOT NULL DEFAULT 1,
    hasQuiz BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_lesson_course_order (course_id, order_index)
);

-- Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    lesson_id VARCHAR(36) NOT NULL,
    passMark INT DEFAULT 70 COMMENT 'Percentage score required to pass',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE KEY uq_quiz_lesson (lesson_id)
);

-- Quiz Questions Table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id VARCHAR(36) NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer_index INT NOT NULL DEFAULT 0,
    order_index INT NOT NULL DEFAULT 1,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Quiz Options Table
CREATE TABLE IF NOT EXISTS quiz_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    option_text VARCHAR(255) NOT NULL,
    option_index INT NOT NULL DEFAULT 0 COMMENT '0-indexed representation corresponding to correct_answer_index',
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_question_option (question_id, option_index)
);

-- Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(36) PRIMARY KEY,
    lesson_id VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    instructions TEXT COMMENT 'HTML formatted guidelines',
    due_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY uq_assignment_lesson (lesson_id)
);

-- Assignment Submissions Table
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id VARCHAR(36) PRIMARY KEY,
    assignment_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, graded',
    submission_type VARCHAR(20) DEFAULT 'text' COMMENT 'text, file',
    submission_text TEXT,
    file_url VARCHAR(2048),
    file_name VARCHAR(255),
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    grade VARCHAR(50),
    feedback TEXT,
    graded_at DATETIME,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_submission_status (status)
);

-- User Progress Table
CREATE TABLE IF NOT EXISTS user_progress (
    id VARCHAR(73) PRIMARY KEY COMMENT 'Composite key helper, e.g. userId_lessonId',
    user_id VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    lesson_id VARCHAR(36) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    last_quiz_score INT DEFAULT 0,
    attempts INT DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_lesson_progress (user_id, lesson_id),
    INDEX idx_user_course_progress (user_id, course_id)
);

-- Certificate Requests Table
CREATE TABLE IF NOT EXISTS certificate_requests (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, rejected',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_course_cert (user_id, course_id)
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Rate Limiting Table (to prevent auth brute-force attacks)
CREATE TABLE IF NOT EXISTS login_attempts (
    ip_address VARCHAR(45) NOT NULL,
    attempts INT NOT NULL DEFAULT 1,
    last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ip_address)
);

-- Lecturer Assignments Table
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
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'completed' COMMENT 'pending, completed, failed',
    payment_method VARCHAR(50) DEFAULT 'card',
    transaction_reference VARCHAR(255) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Chat Messages Table
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
);
