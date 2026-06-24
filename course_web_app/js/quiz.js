/**
 * Quiz JS Controller
 * Fetches dynamic quiz questions, handles radio selections, score calculation,
 * progress reporting, and rendering results with pass/fail feedback.
 */
import { getAuthHeader, currentUser } from './guard.js';

// Global variables
let quizData = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let courseId = null;
let lessonId = null;
let courseLessons = [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    lessonId = urlParams.get('lessonId');
    courseId = urlParams.get('courseId');

    if (!lessonId || !courseId) {
        alert("Missing quiz context parameters.");
        window.location.replace('dashboard.html');
        return;
    }

    // Configure exit quiz back link
    const exitLink = document.getElementById('exitQuizLink');
    if (exitLink) {
        exitLink.href = `course.html?id=${courseId}`;
    }

    await fetchQuizData(lessonId);

    // Bind Button Handler
    const nextBtn = document.getElementById('nextQuestionBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', handleNextQuestionClick);
    }
});

async function fetchQuizData(lId) {
    try {
        const response = await fetch(`../api/quizzes/index.php?lesson_id=${lId}`, {
            headers: getAuthHeader()
        });

        if (!response.ok) {
            throw new Error("Failed to load quiz metadata.");
        }

        quizData = await response.json();

        if (!quizData || !quizData.questions || quizData.questions.length === 0) {
            alert("No quiz questions available for this module.");
            window.location.replace(`course.html?id=${courseId}`);
            return;
        }

        // Fetch course lessons sequence for dynamic redirects
        try {
            const lessonsResp = await fetch(`../api/lessons/index.php?course_id=${courseId}`, {
                headers: getAuthHeader()
            });
            if (lessonsResp.ok) {
                courseLessons = await lessonsResp.json();
            }
        } catch (e) {
            console.error("Error loading course lessons sequence:", e);
        }

        // Initialize user answers array
        userAnswers = new Array(quizData.questions.length).fill(null);
        currentQuestionIndex = 0;

        renderQuestion();

    } catch (err) {
        console.error("Error fetching quiz:", err);
        alert("Unable to fetch quiz questions. Returning to course.");
        window.location.replace(`course.html?id=${courseId}`);
    }
}

function renderQuestion() {
    if (!quizData) return;

    const question = quizData.questions[currentQuestionIndex];
    const totalQuestions = quizData.questions.length;
    const progressPercent = Math.round((currentQuestionIndex / totalQuestions) * 100);

    // Update Counter & Progress Bar
    const counterEl = document.getElementById('questionCounter');
    if (counterEl) counterEl.textContent = `Question ${currentQuestionIndex + 1} of ${totalQuestions}`;

    const percentEl = document.getElementById('progressPercentage');
    if (percentEl) percentEl.textContent = `${progressPercent}%`;

    const barEl = document.getElementById('progressBar');
    if (barEl) barEl.style.width = `${progressPercent}%`;

    // Render Question Text
    const textEl = document.getElementById('questionText');
    if (textEl) textEl.textContent = question.question;

    // Render Options
    const optionsContainer = document.getElementById('optionsContainer');
    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    question.options.forEach((optText, index) => {
        const label = document.createElement('label');
        label.className = 'block relative group cursor-pointer';

        const isChecked = userAnswers[currentQuestionIndex] === index;

        label.innerHTML = `
            <input type="radio" name="quiz_options" value="${index}" class="peer sr-only" ${isChecked ? 'checked' : ''}>
            <div class="p-4 border-2 ${isChecked ? 'border-primaryDark bg-[#abcf471a]' : 'border-gray-100'} rounded-xl hover:border-primary/50 transition-all peer-checked:border-primaryDark peer-checked:bg-[#abcf471a]">
                <div class="flex items-center">
                    <div class="w-6 h-6 rounded-full border-2 ${isChecked ? 'border-primaryDark bg-primaryDark' : 'border-gray-300'} mr-4 flex items-center justify-center transition-all peer-checked:border-primaryDark peer-checked:bg-primaryDark">
                        <div class="w-2.5 h-2.5 rounded-full bg-white ${isChecked ? 'opacity-100' : 'opacity-0'} transition-opacity"></div>
                    </div>
                    <span class="text-gray-700 font-medium text-lg">${optText}</span>
                </div>
            </div>
        `;

        // Event listener to dynamically update styles on click
        const radio = label.querySelector('input');
        radio.addEventListener('change', () => {
            userAnswers[currentQuestionIndex] = index;
            // Re-render to update state outline styles immediately
            renderQuestion();
        });

        optionsContainer.appendChild(label);
    });

    // Update Button label on last question
    const nextBtn = document.getElementById('nextQuestionBtn');
    if (nextBtn) {
        if (currentQuestionIndex === totalQuestions - 1) {
            nextBtn.innerHTML = 'Submit Quiz <i class="fa-solid fa-paper-plane ml-2 text-xs"></i>';
        } else {
            nextBtn.innerHTML = 'Next Question <i class="fa-solid fa-arrow-right ml-2 text-xs"></i>';
        }
    }
}

async function handleNextQuestionClick() {
    if (!quizData) return;

    // Verify selection
    const selectedAnswer = userAnswers[currentQuestionIndex];
    if (selectedAnswer === null) {
        alert("Please select an answer before proceeding.");
        return;
    }

    const totalQuestions = quizData.questions.length;

    if (currentQuestionIndex < totalQuestions - 1) {
        // Move to next question
        currentQuestionIndex++;
        renderQuestion();
    } else {
        // Submit Results
        await submitQuizResults();
    }
}

async function submitQuizResults() {
    const mainEl = document.getElementById('quizMainContent');
    if (!mainEl) return;

    mainEl.innerHTML = `
        <div class="bg-white rounded-[20px] shadow-sm border border-[#00000014] p-12 text-center max-w-xl mx-auto w-full">
            <span class="loader mx-auto mb-4"></span>
            <p class="text-gray-500 font-medium">Submitting quiz results. Please wait...</p>
        </div>
    `;

    // Calculate score
    const totalQuestions = quizData.questions.length;
    let correctCount = 0;
    quizData.questions.forEach((q, idx) => {
        if (userAnswers[idx] === q.correctAnswerIndex) {
            correctCount++;
        }
    });

    const score = Math.round((correctCount / totalQuestions) * 100);
    const passMark = quizData.passMark || 70;
    const isPassed = score >= passMark;

    try {
        // Post progress update
        const response = await fetch('../api/learning/progress.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                userId: currentUser.id,
                courseId: courseId,
                lessonId: lessonId,
                isCompleted: isPassed,
                lastQuizScore: score,
                attempts: 1 // Increases client-side attempt tracking by 1
            })
        });

        if (!response.ok) {
            throw new Error("Server rejected saving progress");
        }

        renderResultsView(score, passMark, isPassed, correctCount, totalQuestions);

    } catch (err) {
        console.error("Error submitting quiz results:", err);
        mainEl.innerHTML = `
            <div class="bg-white rounded-[20px] shadow-sm border border-red-100 p-8 text-center max-w-md mx-auto w-full">
                <i class="fa-solid fa-circle-exclamation text-4xl text-red-500 mb-4"></i>
                <h3 class="text-lg font-bold text-gray-900 mb-2">Network Submission Error</h3>
                <p class="text-xs text-gray-500 mb-6">Unable to save your progress due to connection issues. Your score was ${score}%.</p>
                <button onclick="location.reload()" class="w-full py-3 brand-gradient-bg rounded-[100px] font-bold text-gray-900 shadow-md">
                    Retry Submission
                </button>
            </div>
        `;
    }
}

function renderResultsView(score, passMark, isPassed, correctCount, totalQuestions) {
    const mainEl = document.getElementById('quizMainContent');
    if (!mainEl) return;

    // Confetti effect injection if passed
    if (isPassed) {
        const confettiStyles = document.createElement('style');
        confettiStyles.innerHTML = `
            @keyframes fall {
                0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
                100% { transform: translateY(500px) rotate(360deg); opacity: 0; }
            }
            .confetti-piece { position: absolute; top: -20px; }
        `;
        document.head.appendChild(confettiStyles);

        const container = document.createElement('div');
        container.className = 'absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40';
        container.innerHTML = `
            <div class="confetti-piece" style="left:10%;animation:fall 3s infinite linear;background:#abcf47;width:8px;height:8px;border-radius:50%;"></div>
            <div class="confetti-piece" style="left:30%;animation:fall 4s infinite linear 1s;background:#f5a623;width:6px;height:12px;"></div>
            <div class="confetti-piece" style="left:50%;animation:fall 2.5s infinite linear 0.5s;background:#50b5ff;width:10px;height:10px;border-radius:50%;"></div>
            <div class="confetti-piece" style="left:70%;animation:fall 3.5s infinite linear 1.5s;background:#e056fd;width:8px;height:14px;"></div>
            <div class="confetti-piece" style="left:90%;animation:fall 3.2s infinite linear 0.2s;background:#2ed573;width:6px;height:6px;border-radius:50%;"></div>
        `;
        document.body.appendChild(container);
    }

    const visualIcon = isPassed ? '🏆' : '📚';
    const accentClass = isPassed ? 'text-primaryDark bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200';
    const statusText = isPassed ? 'PASSED' : 'RETRY REQUIRED';
    const feedback = isPassed
        ? `Incredible job! You've passed the lesson quiz and demonstrated a solid understanding of this topic. The next course lesson is now unlocked.`
        : `You scored ${score}%, which is below the minimum required pass mark of ${passMark}%. Please review the lesson content and try the quiz again.`;

    // Calculate next lesson redirect URL
    const currentIdx = courseLessons.findIndex(l => l.id === lessonId);
    let nextLessonUrl = `course.html?id=${courseId}`;
    if (currentIdx !== -1 && currentIdx < courseLessons.length - 1) {
        nextLessonUrl = `course.html?id=${courseId}&lessonId=${courseLessons[currentIdx + 1].id}`;
    } else {
        nextLessonUrl = `course.html?id=${courseId}&celebrate=true`;
    }

    let failedQuestionsHtml = '';
    if (!isPassed) {
        let itemsHtml = '';
        quizData.questions.forEach((q, idx) => {
            if (userAnswers[idx] !== q.correctAnswerIndex) {
                const selectedText = userAnswers[idx] !== null && userAnswers[idx] !== undefined ? q.options[userAnswers[idx]] : 'None';
                const correctText = q.options[q.correctAnswerIndex];
                itemsHtml += `
                    <div class="p-4 border border-gray-100 rounded-xl bg-white space-y-2">
                        <p class="font-semibold text-gray-900 text-sm">${idx + 1}. ${q.question}</p>
                        <div class="text-xs space-y-1.5 pl-2 border-l-2 border-gray-200">
                            <div class="text-red-600 font-medium">
                                <i class="fa-solid fa-circle-xmark mr-1"></i> Your Answer: <span class="text-gray-700">${selectedText}</span>
                            </div>
                            <div class="text-green-600 font-medium">
                                <i class="fa-solid fa-circle-check mr-1"></i> Correct Answer: <span class="text-gray-700">${correctText}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        failedQuestionsHtml = `
            <div class="mt-6 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50 text-left">
                <button onclick="const el = document.getElementById('failedQuestionsReview'); const icon = document.getElementById('reviewToggleIcon'); el.classList.toggle('hidden'); icon.classList.toggle('rotate-180')" class="w-full px-5 py-4 font-bold text-gray-700 flex justify-between items-center hover:bg-gray-100/70 transition-all outline-none">
                    <span class="text-sm flex items-center gap-2"><i class="fa-solid fa-clipboard-list text-gray-400"></i> Review Failed Questions</span>
                    <i id="reviewToggleIcon" class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-300"></i>
                </button>
                <div id="failedQuestionsReview" class="hidden p-5 border-t border-gray-100 space-y-4 max-h-[300px] overflow-y-auto">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    mainEl.innerHTML = `
        <div class="bg-white rounded-[24px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border border-[#0000000a] max-w-xl w-full mx-auto overflow-hidden animate-fade-in">
            <div class="brand-gradient-bg p-10 text-center relative overflow-hidden flex flex-col items-center">
                <div class="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl mb-4 shadow-inner text-white">
                    ${visualIcon}
                </div>
                <h3 class="text-2xl font-bold font-heading text-white">Quiz Results</h3>
                <span class="mt-2 px-3 py-1 bg-white/30 text-gray-900 border border-white/40 text-[10px] font-bold rounded-full tracking-wider uppercase">
                    ${statusText}
                </span>
            </div>

            <div class="p-8 text-center">
                <div class="flex justify-center items-center gap-8 mb-6 border-b border-gray-100 pb-6">
                    <div>
                        <p class="text-sm text-gray-400 font-semibold uppercase tracking-wider">Your Score</p>
                        <p class="text-4xl font-extrabold text-gray-900 mt-1">${score}%</p>
                    </div>
                    <div class="w-px h-12 bg-gray-200"></div>
                    <div>
                        <p class="text-sm text-gray-400 font-semibold uppercase tracking-wider">Required Score</p>
                        <p class="text-4xl font-extrabold text-gray-400 mt-1">${passMark}%</p>
                    </div>
                    <div class="w-px h-12 bg-gray-200"></div>
                    <div>
                        <p class="text-sm text-gray-400 font-semibold uppercase tracking-wider">Questions</p>
                        <p class="text-4xl font-extrabold text-gray-900 mt-1">${correctCount}/${totalQuestions}</p>
                    </div>
                </div>

                <p class="text-sm text-gray-500 mb-6 leading-relaxed px-2">
                    ${feedback}
                </p>

                ${failedQuestionsHtml}

                <div class="flex flex-col gap-3 mt-6">
                    ${isPassed 
                        ? `<a href="${nextLessonUrl}" class="w-full py-3 brand-gradient-bg text-gray-900 rounded-[100px] text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all block text-center">
                             Continue Course <i class="fa-solid fa-arrow-right ml-2 text-xs"></i>
                           </a>`
                        : `<button onclick="location.reload()" class="w-full py-3 brand-gradient-bg text-gray-900 rounded-[100px] text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">
                             <i class="fa-solid fa-rotate-right"></i> Retry Quiz
                           </button>
                           <a href="course.html?id=${courseId}" class="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-[100px] text-sm font-semibold transition-colors border border-gray-100 block text-center">
                             Return to Course
                           </a>`
                    }
                </div>
            </div>
        </div>
    `;
}
