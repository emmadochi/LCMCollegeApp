import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, addDoc, updateDoc, query, where, serverTimestamp, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const currentPath = window.location.pathname;

    // --- LIST QUIZZES (quizzes.html or /quizzes) ---
    if (currentPath.includes('quizzes') && !currentPath.includes('add_quiz')) {
        await loadQuizzes();
    }

    // --- ADD QUIZ (add_quiz.html or /add_quiz) ---
    if (currentPath.includes('add_quiz')) {
        setupAddQuizForm();
    }
});

// --- LISTING LOGIC ---
async function loadQuizzes() {
    const quizzesGrid = document.getElementById('quizzesGrid');
    if (!quizzesGrid) return;

    try {
        quizzesGrid.innerHTML = `<div class="col-span-full py-12 text-center"><span class="loader"></span><p class="mt-2 text-sm text-gray-500">Loading assessments...</p></div>`;
        
        const quizzesSnapshot = await getDocs(collection(db, "quizzes"));
        quizzesGrid.innerHTML = '';

        if (quizzesSnapshot.empty) {
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

        for (const docSnap of quizzesSnapshot.docs) {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Get Lesson Title
            let lessonTitle = "Unknown Lesson";
            if (data.lessonId) {
                try {
                    const lessonDoc = await getDoc(doc(db, "lessons", data.lessonId));
                    if (lessonDoc.exists()) {
                        lessonTitle = lessonDoc.data().title;
                    }
                } catch (e) { /* lesson may not exist, use default */ }
            }

            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all';
            card.innerHTML = `
                <div class="p-6 border-b border-gray-100">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <span class="material-icons">fact_check</span>
                        </div>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${lessonTitle}</h3>
                    <p class="text-sm text-gray-500">ID: ${id.substring(0,8)}... • ${data.questions?.length || 0} Questions</p>
                </div>
                
                <div class="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
                    <button class="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center edit-quiz" data-id="${id}">
                        <span class="material-icons text-[16px] mr-1">edit</span> Edit
                    </button>
                    <button class="text-sm font-medium text-red-600 hover:text-red-800 flex items-center delete-quiz" data-id="${id}">
                        <span class="material-icons text-[16px] mr-1">delete</span> Delete
                    </button>
                </div>
            `;
            quizzesGrid.appendChild(card);
        }

        // Edit/Delete listeners
        document.querySelectorAll('.edit-quiz').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                window.location.href = `add_quiz.html?quizId=${id}`;
            });
        });

        document.querySelectorAll('.delete-quiz').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("Permanently delete this assessment?")) {
                    try {
                        const quizSnap = await getDoc(doc(db, "quizzes", id));
                        if (quizSnap.exists()) {
                            const lessonId = quizSnap.data().lessonId;
                            if (lessonId) {
                                await updateDoc(doc(db, "lessons", lessonId), { hasQuiz: false });
                            }
                        }
                        await deleteDoc(doc(db, "quizzes", id));
                        loadQuizzes();
                    } catch (err) {
                        alert("Error: " + err.message);
                    }
                }
            });
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
let currentQuizId = null; // Track if we are editing an existing quiz

async function setupAddQuizForm() {
    const courseSelect = document.getElementById('courseSelect');
    const lessonSelect = document.getElementById('lessonSelect');
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const saveQuizBtn = document.getElementById('saveQuizBtn');

    if (!courseSelect || !lessonSelect || !addQuestionBtn || !saveQuizBtn) return;

    // 1. Load Courses
    try {
        const coursesSnap = await getDocs(collection(db, "courses"));
        coursesSnap.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().title;
            courseSelect.appendChild(opt);
        });
    } catch (e) { console.error(e); }

    // Detect Edit Mode from URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuizId = urlParams.get('quizId');

    if (urlQuizId) {
        currentQuizId = urlQuizId;
        await loadExistingQuiz(currentQuizId);
    } else {
        // Add initial empty question for Create Mode
        addQuestionBlock();
    }

    // 2. Course Change -> Load Lessons & Reset Builder
    courseSelect.addEventListener('change', async () => {
        const courseId = courseSelect.value;
        console.log("Course changed to:", courseId);
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
            console.log("Fetching lessons for course:", courseId);
            const q = query(collection(db, "lessons"), where("courseId", "==", courseId));
            const lessonsSnap = await getDocs(q);
            const allLessons = lessonsSnap.docs;
            
            console.log(`Found ${allLessons.length} lessons`);
            allLessons.sort((a, b) => (a.data().order || 0) - (b.data().order || 0));

            allLessons.forEach(doc => {
                const data = doc.data();
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = data.title;
                lessonSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    });

    // --- AUTO-DETECT EXISTING QUIZ ON LESSON CHANGE ---
    lessonSelect.addEventListener('change', async () => {
        const lessonId = lessonSelect.value;
        if (!lessonId) return;

        try {
            console.log("Checking for existing quiz for lesson:", lessonId);
            const q = query(collection(db, "quizzes"), where("lessonId", "==", lessonId));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                console.log("Existing quiz found! Loading into builder...");
                const docSnap = snap.docs[0];
                currentQuizId = docSnap.id;
                await loadExistingQuiz(currentQuizId, false); // false = don't update lesson dropdown (already on it)
            } else {
                console.log("No existing quiz for this lesson. Fresh start.");
                if (currentQuizId) {
                    // Reset UI if it was in Edit Mode
                    currentQuizId = null;
                    const headerTitle = document.querySelector('h1');
                    if (headerTitle) headerTitle.textContent = "Create New Assessment";
                    if (saveQuizBtn) {
                        saveQuizBtn.innerHTML = '<span class="material-icons text-sm">save</span> Publish Quiz';
                        saveQuizBtn.className = 'btn-primary'; // Restore default
                    }
                    document.getElementById('questionsContainer').innerHTML = '';
                    addQuestionBlock();
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
            saveQuizBtn.classList.replace('btn-primary', 'bg-amber-600'); // Visual hint it's an update
            saveQuizBtn.classList.add('hover:bg-amber-700', 'text-white');
        }

        try {
            const quizSnap = await getDoc(doc(db, "quizzes", id));
            if (quizSnap.exists()) {
                const quizData = quizSnap.data();
                document.getElementById('passMark').value = quizData.passMark || 70;
                
                if (updateLessonDropdown) {
                    courseSelect.value = quizData.courseId;
                    // Load Lessons and Pre-select
                    lessonSelect.innerHTML = '<option value="">Select Lesson</option>';
                    const q_lessons = query(collection(db, "lessons"), where("courseId", "==", quizData.courseId));
                    const snap_lessons = await getDocs(q_lessons);
                    const allL = snap_lessons.docs;
                    allL.sort((a,b) => (a.data().order || 0) - (b.data().order || 0));
                    allL.forEach(l => {
                        const opt = document.createElement('option');
                        opt.value = l.id;
                        opt.textContent = l.data().title;
                        if (l.id === quizData.lessonId) opt.selected = true;
                        lessonSelect.appendChild(opt);
                    });
                }

                // Load Questions
                document.getElementById('questionsContainer').innerHTML = '';
                if (quizData.questions && quizData.questions.length > 0) {
                    quizData.questions.forEach(q => {
                        addQuestionBlock(q);
                    });
                } else {
                    addQuestionBlock();
                }
            }
        } catch (e) { console.error("Error loading quiz:", e); }
    }

    // 3. Add Question Block
    addQuestionBtn.addEventListener('click', () => {
        addQuestionBlock();
    });

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
                const text = block.querySelector('textarea').value;
                const options = [];
                const optionInputs = block.querySelectorAll('.option-input');
                let correctIndex = -1;

                optionInputs.forEach((input, index) => {
                    if (input.value.trim()) {
                        options.push(input.value.trim());
                        const radio = input.previousElementSibling;
                        if (radio && radio.checked) {
                            correctIndex = options.length - 1;
                        }
                    }
                });

                if (!text || options.length < 2 || correctIndex === -1) {
                    throw new Error("Each question must have text, at least 2 options, and a correct answer selected.");
                }

                questions.push({
                    text,
                    options,
                    correctIndex
                });
            }

            saveQuizBtn.disabled = true;
            saveQuizBtn.innerHTML = 'Saving...';

            const passMark = parseInt(document.getElementById('passMark').value) || 70;

            const payload = {
                courseId,
                lessonId,
                questions,
                passMark,
                updatedAt: serverTimestamp()
            };

            if (currentQuizId) {
                await updateDoc(doc(db, "quizzes", currentQuizId), payload);
                alert("Quiz updated successfully!");
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, "quizzes"), payload);
                // Update lesson hasQuiz
                await updateDoc(doc(db, "lessons", lessonId), { hasQuiz: true });
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
    const blockId = `q_${questionCount}`;
    
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
                <!-- Options injected here -->
            </div>
            
            <button class="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center add-option-btn ml-10">
                <span class="material-icons text-sm mr-1">add</span> Add Option
            </button>
        </div>
    `;

    container.appendChild(block);

    if (data && data.options) {
        data.options.forEach((opt, idx) => {
            addOptionField(block, blockId, opt, idx === data.correctIndex);
        });
    } else {
        // Initial 2 options
        addOptionField(block, blockId);
        addOptionField(block, blockId);
    }

    // Add Option Listener
    block.querySelector('.add-option-btn').addEventListener('click', (e) => {
        e.preventDefault();
        addOptionField(block, blockId);
    });

    // Remove Question Listener
    block.querySelector('.remove-question').addEventListener('click', () => {
        block.remove();
        reindexQuestions();
    });
}

function addOptionField(block, radioName, text = '', isCorrect = false) {
    const list = block.querySelector('.options-list');
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3';
    div.innerHTML = `
        <input type="radio" name="${radioName}" class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${isCorrect ? 'checked' : ''}>
        <input type="text" class="form-input form-input-sm w-full option-input" placeholder="Enter option text..." value="${text}">
        <button class="text-gray-300 hover:text-red-400 remove-option"><span class="material-icons text-sm">close</span></button>
    `;
    list.appendChild(div);

    div.querySelector('.remove-option').addEventListener('click', () => {
        div.remove();
    });
}

function reindexQuestions() {
    const blocks = document.querySelectorAll('.question-block');
    questionCount = 0;
    blocks.forEach((block, i) => {
        questionCount++;
        block.querySelector('span.w-8').textContent = questionCount;
    });
}
