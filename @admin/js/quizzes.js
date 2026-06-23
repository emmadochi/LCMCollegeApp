import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const currentPath = window.location.pathname;

    if (currentPath.includes('quizzes') && !currentPath.includes('add_quiz')) {
        await loadQuizzes();
    }

    if (currentPath.includes('add_quiz')) {
        await setupAddQuizForm();
    }
});

// --- LISTING LOGIC ---
async function loadQuizzes() {
    const quizzesGrid = document.getElementById('quizzesGrid');
    if (!quizzesGrid) return;

    try {
        quizzesGrid.innerHTML = `<div class="col-span-full py-12 text-center"><span class="loader"></span><p class="mt-2 text-sm text-gray-500">Loading assessments...</p></div>`;

        const response = await fetch('../api/admin/quizzes.php', {
            headers: getAdminAuthHeader()
        });

        if (!response.ok) throw new Error('Failed to load quizzes');

        const quizzes = await response.json();
        quizzesGrid.innerHTML = '';

        if (!quizzes || quizzes.length === 0) {
            quizzesGrid.innerHTML = `
                <div class="col-span-full bg-white rounded-xl p-12 text-center border border-dashed border-gray-300">
                    <span class="material-icons text-gray-300 text-5xl mb-4">fact_check</span>
                    <h3 class="text-lg font-bold text-gray-900">No quizzes available</h3>
                    <p class="text-gray-500 mb-6">Create quizzes to test your student's knowledge after lessons.</p>
                    <a href="add_quiz.html" class="btn-primary inline-flex">
                        <span class="material-icons text-sm">add</span> Create First Quiz
                    </a>
                </div>`;
            return;
        }

        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all';
            card.innerHTML = `
                <div class="p-6 border-b border-gray-100">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <span class="material-icons">fact_check</span>
                        </div>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${quiz.lesson_title}</h3>
                    <p class="text-sm text-gray-500">ID: ${quiz.id.substring(0, 8)}... • ${quiz.question_count} Questions</p>
                </div>
                
                <div class="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
                    <button class="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center edit-quiz" data-id="${quiz.id}">
                        <span class="material-icons text-[16px] mr-1">edit</span> Edit
                    </button>
                    <button class="text-sm font-medium text-red-600 hover:text-red-800 flex items-center delete-quiz" data-id="${quiz.id}" data-lesson-id="${quiz.lesson_id}">
                        <span class="material-icons text-[16px] mr-1">delete</span> Delete
                    </button>
                </div>
            `;
            quizzesGrid.appendChild(card);
        });

        quizzesGrid.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-quiz');
            const delBtn  = e.target.closest('.delete-quiz');

            if (editBtn) {
                window.location.href = `add_quiz.html?quizId=${editBtn.dataset.id}`;
            }

            if (delBtn) {
                if (confirm("Permanently delete this assessment?")) {
                    try {
                        const resp = await fetch(`../api/admin/quizzes.php?id=${delBtn.dataset.id}`, {
                            method: 'DELETE',
                            headers: getAdminAuthHeader()
                        });
                        if (!resp.ok) {
                            const err = await resp.json();
                            throw new Error(err.message || 'Delete failed');
                        }
                        loadQuizzes();
                    } catch (err) {
                        alert("Error: " + err.message);
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error loading quizzes:", error);
        quizzesGrid.innerHTML = `
            <div style="grid-column:1/-1;padding:48px;text-align:center;color:#ef4444;">
                <span class="material-icons" style="font-size:40px;margin-bottom:8px;">error_outline</span>
                <p style="font-weight:600;">Failed to load quizzes</p>
                <p style="font-size:13px;color:#6b7280;margin-top:4px;">${error.message}</p>
            </div>`;
    }
}

// --- BUILDER LOGIC ---
let questionCount = 0;
let currentQuizId = null;

async function setupAddQuizForm() {
    const courseSelect  = document.getElementById('courseSelect');
    const lessonSelect  = document.getElementById('lessonSelect');
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const saveQuizBtn   = document.getElementById('saveQuizBtn');

    if (!courseSelect || !lessonSelect || !addQuestionBtn || !saveQuizBtn) return;

    // 1. Load Courses
    try {
        const resp = await fetch('../api/courses/index.php');
        if (resp.ok) {
            const courses = await resp.json();
            courses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.title;
                courseSelect.appendChild(opt);
            });
        }
    } catch (e) { console.error('Failed to load courses:', e); }

    // Detect Edit Mode
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuizId = urlParams.get('quizId');

    if (urlQuizId) {
        currentQuizId = urlQuizId;
        await loadExistingQuiz(currentQuizId);
    } else {
        addQuestionBlock();
    }

    // 2. Course Change → Load Lessons & Reset Builder
    courseSelect.addEventListener('change', async () => {
        const courseId = courseSelect.value;
        lessonSelect.innerHTML = '<option value="">Select Lesson</option>';

        // Reset Builder State
        currentQuizId = null;
        const headerTitle = document.querySelector('h1');
        if (headerTitle) headerTitle.textContent = "Create New Assessment";
        if (saveQuizBtn) {
            saveQuizBtn.innerHTML = '<span class="material-icons text-sm">save</span> Publish Quiz';
            saveQuizBtn.className = 'btn-primary';
        }
        document.getElementById('questionsContainer').innerHTML = '';
        addQuestionBlock();

        if (!courseId) return;

        try {
            const resp = await fetch(`../api/lessons/index.php?course_id=${courseId}`, {
                headers: getAdminAuthHeader()
            });
            if (resp.ok) {
                const lessons = await resp.json();
                lessons.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                lessons.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l.id;
                    opt.textContent = l.title;
                    lessonSelect.appendChild(opt);
                });
            }
        } catch (e) { console.error('Failed to load lessons:', e); }
    });

    // --- AUTO-DETECT EXISTING QUIZ ON LESSON CHANGE ---
    lessonSelect.addEventListener('change', async () => {
        const lessonId = lessonSelect.value;
        if (!lessonId) return;

        try {
            const resp = await fetch(`../api/admin/quizzes.php?lesson_id=${lessonId}`, {
                headers: getAdminAuthHeader()
            });

            if (resp.ok) {
                const quiz = await resp.json();
                if (quiz && quiz.id) {
                    console.log("Existing quiz found! Loading into builder...");
                    currentQuizId = quiz.id;
                    await loadExistingQuiz(currentQuizId, false);
                } else {
                    if (currentQuizId) {
                        currentQuizId = null;
                        const headerTitle = document.querySelector('h1');
                        if (headerTitle) headerTitle.textContent = "Create New Assessment";
                        if (saveQuizBtn) {
                            saveQuizBtn.innerHTML = '<span class="material-icons text-sm">save</span> Publish Quiz';
                            saveQuizBtn.className = 'btn-primary';
                        }
                        document.getElementById('questionsContainer').innerHTML = '';
                        addQuestionBlock();
                    }
                }
            }
        } catch (e) {
            console.error("Error auto-detecting quiz:", e);
        }
    });

    async function loadExistingQuiz(id, updateLessonDropdown = true) {
        const headerTitle = document.querySelector('h1');
        if (headerTitle) {
            headerTitle.innerHTML = `Edit Quiz Assessment <span class="ml-3 px-2 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded-full border border-amber-200 uppercase tracking-tighter">Edit Mode</span>`;
        }
        if (saveQuizBtn) {
            saveQuizBtn.innerHTML = '<span class="material-icons text-sm">save</span> Update Quiz Content';
            saveQuizBtn.className = 'bg-amber-600 hover:bg-amber-700 text-white btn-primary';
        }

        try {
            const resp = await fetch(`../api/admin/quizzes.php?id=${id}`, {
                headers: getAdminAuthHeader()
            });

            if (!resp.ok) throw new Error('Failed to load quiz');
            const quizData = await resp.json();

            const passMarkEl = document.getElementById('passMark');
            if (passMarkEl) passMarkEl.value = quizData.passMark || 70;

            if (updateLessonDropdown) {
                courseSelect.value = quizData.course_id;
                lessonSelect.innerHTML = '<option value="">Select Lesson</option>';
                const lessonsResp = await fetch(`../api/lessons/index.php?course_id=${quizData.course_id}`, {
                    headers: getAdminAuthHeader()
                });
                if (lessonsResp.ok) {
                    const lessons = await lessonsResp.json();
                    lessons.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                    lessons.forEach(l => {
                        const opt = document.createElement('option');
                        opt.value = l.id;
                        opt.textContent = l.title;
                        if (l.id === quizData.lesson_id) opt.selected = true;
                        lessonSelect.appendChild(opt);
                    });
                }
            }

            // Load Questions
            document.getElementById('questionsContainer').innerHTML = '';
            if (quizData.questions && quizData.questions.length > 0) {
                quizData.questions.forEach(q => addQuestionBlock(q));
            } else {
                addQuestionBlock();
            }
        } catch (e) { console.error("Error loading quiz:", e); }
    }

    // 3. Add Question Block
    addQuestionBtn.addEventListener('click', () => addQuestionBlock());

    // 4. Save Quiz
    saveQuizBtn.addEventListener('click', async () => {
        const courseId = courseSelect.value;
        const lessonId = lessonSelect.value;

        if (!courseId || !lessonId) {
            alert("Please select a course and lesson.");
            return;
        }

        const questions = [];
        const questionBlocks = document.querySelectorAll('.question-block');

        if (questionBlocks.length === 0) {
            alert("Please add at least one question.");
            return;
        }

        try {
            for (const block of questionBlocks) {
                const text    = block.querySelector('textarea').value;
                const options = [];
                const optionInputs = block.querySelectorAll('.option-input');
                let correctIndex = -1;

                optionInputs.forEach((input, index) => {
                    if (input.value.trim()) {
                        options.push(input.value.trim());
                        const radio = input.previousElementSibling;
                        if (radio && radio.checked) correctIndex = options.length - 1;
                    }
                });

                if (!text || options.length < 2 || correctIndex === -1) {
                    throw new Error("Each question must have text, at least 2 options, and a correct answer selected.");
                }

                questions.push({ text, options, correctIndex });
            }

            saveQuizBtn.disabled = true;
            saveQuizBtn.innerHTML = 'Saving...';

            const passMark = parseInt(document.getElementById('passMark')?.value) || 70;

            const payload = { courseId, lessonId, questions, passMark };

            let resp;
            if (currentQuizId) {
                payload.action = 'update';
                payload.id     = currentQuizId;
                resp = await fetch('../api/admin/quizzes.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) { const e = await resp.json(); throw new Error(e.message || 'Update failed'); }
                alert("Quiz updated successfully!");
            } else {
                payload.action = 'create';
                resp = await fetch('../api/admin/quizzes.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) { const e = await resp.json(); throw new Error(e.message || 'Create failed'); }
                alert("Quiz saved successfully!");
            }

            window.location.href = 'quizzes.html';

        } catch (error) {
            alert(error.message);
            saveQuizBtn.disabled = false;
            saveQuizBtn.innerHTML = 'Save Quiz';
        }
    });
}

function addQuestionBlock(data = null) {
    questionCount++;
    const container = document.getElementById('questionsContainer');
    const blockId   = `q_${questionCount}`;

    const block = document.createElement('div');
    block.className = 'bg-white p-6 rounded-xl shadow-sm border border-indigo-200 relative group question-block';
    block.innerHTML = `
        <div class="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="text-gray-400 hover:text-red-500 transition-colors remove-question"><span class="material-icons">delete</span></button>
        </div>
        
        <div class="flex items-center gap-2 mb-4">
            <span class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">${questionCount}</span>
            <h3 class="font-bold text-gray-800">Multiple Choice Question</h3>
        </div>
        <div class="space-y-4">
            <textarea rows="2" class="form-input font-medium" placeholder="Enter question text here...">${data ? data.text : ''}</textarea>
            
            <div class="space-y-3 pl-10 border-l-2 border-indigo-100 py-2 mt-4 options-list">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Select the correct answer via Radio button</p>
            </div>
            
            <button class="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center add-option-btn ml-10">
                <span class="material-icons text-sm mr-1">add</span> Add Option
            </button>
        </div>
    `;

    container.appendChild(block);

    if (data && data.options) {
        data.options.forEach((opt, idx) => addOptionField(block, blockId, opt, idx === data.correctIndex));
    } else {
        addOptionField(block, blockId);
        addOptionField(block, blockId);
    }

    block.querySelector('.add-option-btn').addEventListener('click', (e) => {
        e.preventDefault();
        addOptionField(block, blockId);
    });

    block.querySelector('.remove-question').addEventListener('click', () => {
        block.remove();
        reindexQuestions();
    });
}

function addOptionField(block, radioName, text = '', isCorrect = false) {
    const list = block.querySelector('.options-list');
    const div  = document.createElement('div');
    div.className = 'flex items-center gap-3';
    div.innerHTML = `
        <input type="radio" name="${radioName}" class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${isCorrect ? 'checked' : ''}>
        <input type="text" class="form-input form-input-sm w-full option-input" placeholder="Enter option text..." value="${text}">
        <button class="text-gray-300 hover:text-red-400 remove-option"><span class="material-icons text-sm">close</span></button>
    `;
    list.appendChild(div);
    div.querySelector('.remove-option').addEventListener('click', () => div.remove());
}

function reindexQuestions() {
    const blocks = document.querySelectorAll('.question-block');
    questionCount = 0;
    blocks.forEach((block) => {
        questionCount++;
        block.querySelector('span.w-8').textContent = questionCount;
    });
}
