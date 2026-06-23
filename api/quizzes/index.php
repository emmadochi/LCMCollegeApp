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

$lessonId = $_GET['lesson_id'] ?? $_GET['lessonId'] ?? '';

if (empty($lessonId)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Lesson ID parameter (lesson_id) is required."]);
    exit();
}

try {
    // 1. Fetch quiz metadata
    $stmtQuiz = $conn->prepare("SELECT id, lesson_id, passMark FROM quizzes WHERE lesson_id = ?");
    $stmtQuiz->execute([$lessonId]);
    $quiz = $stmtQuiz->fetch();

    if (!$quiz) {
        echo json_encode(null);
        exit();
    }

    $quizId = $quiz['id'];

    // 2. Fetch quiz questions
    $stmtQuestions = $conn->prepare("
        SELECT id, question_text, correct_answer_index 
        FROM quiz_questions 
        WHERE quiz_id = ? 
        ORDER BY order_index ASC
    ");
    $stmtQuestions->execute([$quizId]);
    $questions = $stmtQuestions->fetchAll();

    $formattedQuestions = [];
    foreach ($questions as $q) {
        $questionId = $q['id'];

        // 3. Fetch options for each question
        $stmtOptions = $conn->prepare("
            SELECT option_text, option_index 
            FROM quiz_options 
            WHERE question_id = ? 
            ORDER BY option_index ASC
        ");
        $stmtOptions->execute([$questionId]);
        $options = $stmtOptions->fetchAll();

        $optionsList = [];
        foreach ($options as $opt) {
            $optionsList[] = escape_output($opt['option_text']);
        }

        $formattedQuestions[] = [
            "question" => escape_output($q['question_text']),
            "options" => $optionsList,
            "correctAnswerIndex" => (int)$q['correct_answer_index']
        ];
    }

    $response = [
        "id" => $quizId,
        "lessonId" => $quiz['lesson_id'],
        "passMark" => (int)($quiz['passMark'] ?? 70),
        "questions" => $formattedQuestions
    ];

    echo json_encode($response);
} catch (Exception $e) {
    secure_error_handler($e, "Failed to retrieve quiz due to an internal server error.");
}
