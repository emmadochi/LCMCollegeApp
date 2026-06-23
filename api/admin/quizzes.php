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
        $quizId   = $_GET['id'] ?? null;
        $lessonId = $_GET['lesson_id'] ?? null;
        if ($quizId) {
            getQuiz($conn, $quizId);
        } elseif ($lessonId) {
            getQuizByLesson($conn, $lessonId);
        } else {
            listQuizzes($conn);
        }
        break;

    case 'POST':
        $data   = json_decode(file_get_contents("php://input"), true);
        $action = $data['action'] ?? 'create';
        if ($action === 'update') {
            updateQuiz($conn, $data);
        } else {
            createQuiz($conn, $data);
        }
        break;

    case 'DELETE':
        $quizId = $_GET['id'] ?? '';
        deleteQuiz($conn, $quizId);
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}

/**
 * List all quizzes with lesson and course context
 */
function listQuizzes($conn) {
    try {
        $stmt = $conn->prepare("
            SELECT q.id, q.course_id, q.lesson_id, q.passMark, q.created_at, q.updated_at,
                   l.title AS lesson_title,
                   c.title AS course_title,
                   COUNT(qq.id) AS question_count
            FROM quizzes q
            LEFT JOIN lessons l ON l.id = q.lesson_id
            LEFT JOIN courses c ON c.id = q.course_id
            LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
            GROUP BY q.id
            ORDER BY q.updated_at DESC
        ");
        $stmt->execute();
        $quizzes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(array_map(function($q) {
            return [
                'id'             => $q['id'],
                'course_id'      => $q['course_id'],
                'lesson_id'      => $q['lesson_id'],
                'passMark'       => (int)$q['passMark'],
                'lesson_title'   => escape_output($q['lesson_title'] ?? 'Unknown Lesson'),
                'course_title'   => escape_output($q['course_title'] ?? ''),
                'question_count' => (int)$q['question_count'],
                'created_at'     => $q['created_at'],
                'updated_at'     => $q['updated_at'],
            ];
        }, $quizzes));
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Get single quiz with all questions and options
 */
function getQuiz($conn, $quizId) {
    try {
        $stmt = $conn->prepare("
            SELECT q.id, q.course_id, q.lesson_id, q.passMark
            FROM quizzes q WHERE q.id = ?
        ");
        $stmt->execute([$quizId]);
        $quiz = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$quiz) {
            http_response_code(404);
            echo json_encode(["message" => "Quiz not found."]);
            return;
        }

        $quiz['questions'] = fetchQuizQuestions($conn, $quizId);
        echo json_encode($quiz);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Get quiz by lesson_id
 */
function getQuizByLesson($conn, $lessonId) {
    try {
        $stmt = $conn->prepare("SELECT id, course_id, lesson_id, passMark FROM quizzes WHERE lesson_id = ?");
        $stmt->execute([$lessonId]);
        $quiz = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$quiz) {
            echo json_encode(null);
            return;
        }

        $quiz['questions'] = fetchQuizQuestions($conn, $quiz['id']);
        echo json_encode($quiz);
    } catch (Exception $e) {
        secure_error_handler($e);
    }
}

/**
 * Helper to load questions + options for a quiz
 */
function fetchQuizQuestions($conn, $quizId) {
    $stmtQ = $conn->prepare("
        SELECT id, question_text, correct_answer_index, order_index
        FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC
    ");
    $stmtQ->execute([$quizId]);
    $questions = $stmtQ->fetchAll(PDO::FETCH_ASSOC);

    foreach ($questions as &$q) {
        $stmtOpt = $conn->prepare("
            SELECT option_text, option_index FROM quiz_options
            WHERE question_id = ? ORDER BY option_index ASC
        ");
        $stmtOpt->execute([$q['id']]);
        $opts = $stmtOpt->fetchAll(PDO::FETCH_ASSOC);

        // Return as flat options array (matching JS structure)
        $q['options'] = array_column($opts, 'option_text');
        $q['correctIndex'] = (int)$q['correct_answer_index'];
        $q['text'] = escape_output($q['question_text']);
        unset($q['question_text'], $q['correct_answer_index']);
    }

    return $questions;
}

/**
 * Create a new quiz with questions and options
 */
function createQuiz($conn, $data) {
    try {
        $courseId  = sanitize_input($data['courseId']  ?? '');
        $lessonId  = sanitize_input($data['lessonId']  ?? '');
        $passMark  = (int)($data['passMark'] ?? 70);
        $questions = $data['questions'] ?? [];

        if (!$courseId || !$lessonId || empty($questions)) {
            http_response_code(400);
            echo json_encode(["message" => "courseId, lessonId, and at least one question are required."]);
            return;
        }

        // Validate questions
        foreach ($questions as $q) {
            if (empty($q['text']) || count($q['options'] ?? []) < 2 || !isset($q['correctIndex'])) {
                http_response_code(400);
                echo json_encode(["message" => "Each question must have text, at least 2 options, and a correct answer."]);
                return;
            }
        }

        $conn->beginTransaction();

        $quizId = bin2hex(random_bytes(16));
        $stmtQ = $conn->prepare("
            INSERT INTO quizzes (id, course_id, lesson_id, passMark)
            VALUES (?, ?, ?, ?)
        ");
        $stmtQ->execute([$quizId, $courseId, $lessonId, $passMark]);

        insertQuestions($conn, $quizId, $questions);

        // Mark lesson as having a quiz
        $stmtL = $conn->prepare("UPDATE lessons SET hasQuiz = TRUE WHERE id = ?");
        $stmtL->execute([$lessonId]);

        $conn->commit();

        http_response_code(201);
        echo json_encode(["message" => "Quiz created successfully.", "id" => $quizId]);
    } catch (Exception $e) {
        $conn->rollBack();
        secure_error_handler($e, "Failed to create quiz.");
    }
}

/**
 * Update an existing quiz
 */
function updateQuiz($conn, $data) {
    try {
        $quizId    = sanitize_input($data['id'] ?? '');
        $passMark  = (int)($data['passMark'] ?? 70);
        $questions = $data['questions'] ?? [];

        if (!$quizId || empty($questions)) {
            http_response_code(400);
            echo json_encode(["message" => "Quiz ID and questions are required."]);
            return;
        }

        $conn->beginTransaction();

        // Update pass mark
        $stmtU = $conn->prepare("UPDATE quizzes SET passMark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmtU->execute([$passMark, $quizId]);

        // Delete old questions (cascade deletes options)
        $stmtDel = $conn->prepare("DELETE FROM quiz_questions WHERE quiz_id = ?");
        $stmtDel->execute([$quizId]);

        // Re-insert questions
        insertQuestions($conn, $quizId, $questions);

        $conn->commit();

        echo json_encode(["message" => "Quiz updated successfully."]);
    } catch (Exception $e) {
        $conn->rollBack();
        secure_error_handler($e, "Failed to update quiz.");
    }
}

/**
 * Helper: insert questions + options
 */
function insertQuestions($conn, $quizId, $questions) {
    $stmtQ = $conn->prepare("
        INSERT INTO quiz_questions (quiz_id, question_text, correct_answer_index, order_index)
        VALUES (?, ?, ?, ?)
    ");
    $stmtO = $conn->prepare("
        INSERT INTO quiz_options (question_id, option_text, option_index)
        VALUES (?, ?, ?)
    ");

    foreach ($questions as $orderIdx => $q) {
        $stmtQ->execute([$quizId, sanitize_input($q['text']), (int)$q['correctIndex'], $orderIdx + 1]);
        $questionId = (int)$conn->lastInsertId();

        foreach ($q['options'] as $optIdx => $optText) {
            $stmtO->execute([$questionId, sanitize_input($optText), $optIdx]);
        }
    }
}

/**
 * Delete a quiz and cascade updates to lesson hasQuiz flag
 */
function deleteQuiz($conn, $quizId) {
    try {
        if (!$quizId) {
            http_response_code(400);
            echo json_encode(["message" => "Quiz ID is required."]);
            return;
        }

        // Get lesson_id before deleting
        $stmtGet = $conn->prepare("SELECT lesson_id FROM quizzes WHERE id = ?");
        $stmtGet->execute([$quizId]);
        $quiz = $stmtGet->fetch(PDO::FETCH_ASSOC);

        if (!$quiz) {
            http_response_code(404);
            echo json_encode(["message" => "Quiz not found."]);
            return;
        }

        $conn->beginTransaction();

        $stmtDel = $conn->prepare("DELETE FROM quizzes WHERE id = ?");
        $stmtDel->execute([$quizId]);

        // Clear hasQuiz flag on lesson
        $stmtL = $conn->prepare("UPDATE lessons SET hasQuiz = FALSE WHERE id = ?");
        $stmtL->execute([$quiz['lesson_id']]);

        $conn->commit();

        echo json_encode(["message" => "Quiz deleted successfully."]);
    } catch (Exception $e) {
        $conn->rollBack();
        secure_error_handler($e, "Failed to delete quiz.");
    }
}
