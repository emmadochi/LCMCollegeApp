import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, addDoc, updateDoc, query, where, serverTimestamp, deleteDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let lessonId = urlParams.get('lessonId');
    let courseId = urlParams.get('courseId');

    if (!lessonId) {
        document.getElementById('lessonPicker').classList.remove('hidden');
        await loadCourses();
    } else {
        await loadLessonInfo(lessonId);
        await loadAssignmentData(lessonId);
    }

    setupRichEditor();

    const lessonTitleEl = document.getElementById('lessonTitle');
    const assignmentForm = document.getElementById('assignmentForm');
    const backBtn = document.getElementById('backBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    if (backBtn && courseId) backBtn.href = `lessons.html?courseId=${courseId}`;

    async function loadLessonInfo(id) {
        try {
            const lessonSnap = await getDoc(doc(db, "lessons", id));
            if (lessonSnap.exists()) {
                const data = lessonSnap.data();
                document.getElementById('lessonTitle').textContent = `Assignment for: ${data.title}`;
                if (!courseId && data.courseId) {
                    courseId = data.courseId;
                    if (backBtn) backBtn.href = `lessons.html?courseId=${courseId}`;
                }
            }
        } catch (err) {
            console.error("Error loading lesson:", err);
        }
    }

    let existingAssignmentId = null;

    async function loadAssignmentData(lId) {
        try {
            const q = query(collection(db, "assignments"), where("lessonId", "==", lId));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const assignmentDoc = snap.docs[0];
                existingAssignmentId = assignmentDoc.id;
                const data = assignmentDoc.data();
                
                if (data.courseId) {
                    courseId = data.courseId;
                    if (backBtn) backBtn.href = `lessons.html?courseId=${courseId}`;
                }

                document.getElementById('assignmentTitle').value = data.title;
                const instructions = data.instructions || "";
                document.getElementById('assignmentInstructions').value = instructions;
                const editor = document.getElementById('editor');
                if (editor) editor.innerHTML = instructions;
                
                if (data.dueDate) {
                    const date = data.dueDate.toDate();
                    const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    document.getElementById('dueDate').value = localISO;
                }

                deleteBtn.classList.remove('hidden');
                loadSubmissions(existingAssignmentId);
            } else {
                // Reset form for new assignment
                existingAssignmentId = null;
                assignmentForm.reset();
                const editor = document.getElementById('editor');
                if (editor) editor.innerHTML = "";
                deleteBtn.classList.add('hidden');
                document.getElementById('submissionsSection').classList.add('hidden');
            }
        } catch (err) {
            console.error("Error loading assignment:", err);
        }
    }

    // Course/Lesson Selectors
    async function loadCourses() {
        const courseSelect = document.getElementById('courseSelect');
        const snap = await getDocs(collection(db, "courses"));
        courseSelect.innerHTML = '<option value="">Select a course</option>';
        snap.forEach(doc => {
            courseSelect.innerHTML += `<option value="${doc.id}">${doc.data().title}</option>`;
        });
    }

    document.getElementById('courseSelect')?.addEventListener('change', async (e) => {
        const cId = e.target.value;
        const lessonSelect = document.getElementById('lessonSelect');
        if (!cId) {
            lessonSelect.disabled = true;
            return;
        }

        courseId = cId;
        lessonSelect.disabled = false;
        lessonSelect.innerHTML = '<option value="">Loading lessons...</option>';

        const q = query(collection(db, "lessons"), where("courseId", "==", cId));
        const snap = await getDocs(q);
        lessonSelect.innerHTML = '<option value="">Select a lesson</option>';
        snap.forEach(doc => {
            lessonSelect.innerHTML += `<option value="${doc.id}">${doc.data().title}</option>`;
        });
    });

    document.getElementById('lessonSelect')?.addEventListener('change', async (e) => {
        lessonId = e.target.value;
        if (lessonId) {
            await loadLessonInfo(lessonId);
            await loadAssignmentData(lessonId);
        }
    });

    assignmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!lessonId) {
            alert('Please select a lesson first.');
            return;
        }
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-icons animate-spin text-sm mr-2">sync</span> Saving...';

        const dueDateValue = document.getElementById('dueDate').value;
        if (!dueDateValue) {
            alert('Please select a due date.');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons text-sm">save</span> Save Assignment';
            return;
        }

        const payload = {
            lessonId,
            courseId,
            title: document.getElementById('assignmentTitle').value,
            instructions: document.getElementById('assignmentInstructions').value,
            dueDate: Timestamp.fromDate(new Date(dueDateValue)),
            updatedAt: serverTimestamp()
        };

        try {
            if (existingAssignmentId) {
                await updateDoc(doc(db, "assignments", existingAssignmentId), payload);
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, "assignments"), payload);
            }
            alert('Assignment saved!');
            window.location.href = 'assignments.html';
        } catch (err) {
            alert('Error saving assignment: ' + err.message);
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons text-sm">save</span> Save Assignment';
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (confirm('Delete this assignment and all submissions?')) {
            try {
                await deleteDoc(doc(db, "assignments", existingAssignmentId));
                alert('Assignment deleted.');
                window.location.href = 'assignments.html';
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
    });
});

async function loadSubmissions(assignmentId) {
    const section = document.getElementById('submissionsSection');
    const container = document.getElementById('submissionsContainer');
    const countEl = document.getElementById('submissionCount');

    try {
        const q = query(collection(db, "assignment_submissions"), where("assignmentId", "==", assignmentId));
        const snap = await getDocs(q);
        
        section.classList.remove('hidden');
        countEl.textContent = `${snap.size} Submissions`;

        if (snap.empty) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No submissions yet.</p>';
            return;
        }

        container.innerHTML = '';
        snap.forEach(subDoc => {
            const data = subDoc.data();
            const card = document.createElement('div');
            card.className = 'adm-card p-4 hover:shadow-md transition-shadow cursor-default';
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-sm">${data.userName}</h4>
                        <p class="text-xs text-gray-500">${data.userEmail}</p>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${data.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                        ${data.status.toUpperCase()}
                    </span>
                </div>
                <div class="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-700">
                    ${data.submissionType === 'text' ? data.text : `<a href="${data.fileUrl}" target="_blank" class="text-indigo-600 underline font-medium">Download: ${data.fileName}</a>`}
                </div>
                <div class="mt-4 flex items-center justify-between">
                    <p class="text-[10px] text-gray-400">Submitted: ${data.submittedAt?.toDate().toLocaleString() || 'N/A'}</p>
                    <button class="text-xs text-indigo-600 font-bold hover:underline grade-btn" data-id="${subDoc.id}">
                        ${data.status === 'graded' ? 'Update Grade' : 'Grade Submission'}
                    </button>
                </div>
                <div id="gradeForm-${subDoc.id}" class="hidden mt-4 pt-4 border-t border-gray-100">
                    <div class="flex gap-2">
                        <input type="text" placeholder="Grade (e.g. 85/100)" class="form-input text-xs w-32" id="grade-${subDoc.id}" value="${data.grade || ''}">
                        <input type="text" placeholder="Feedback" class="form-input text-xs flex-1" id="feedback-${subDoc.id}" value="${data.feedback || ''}">
                        <button class="btn-primary text-[10px] px-3 py-1 save-grade" data-id="${subDoc.id}">Save</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        container.addEventListener('click', async (e) => {
            if (e.target.classList.contains('grade-btn')) {
                const id = e.target.getAttribute('data-id');
                const form = document.getElementById(`gradeForm-${id}`);
                form.classList.toggle('hidden');
            }

            if (e.target.classList.contains('save-grade')) {
                const id = e.target.getAttribute('data-id');
                const grade = document.getElementById(`grade-${id}`).value;
                const feedback = document.getElementById(`feedback-${id}`).value;
                
                try {
                    await updateDoc(doc(db, "assignment_submissions", id), {
                        grade,
                        feedback,
                        status: 'graded',
                        gradedAt: serverTimestamp()
                    });
                    alert('Grade saved!');
                    loadSubmissions(assignmentId);
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            }
        });

    } catch (err) {
        console.error("Error loading submissions:", err);
    }
}

function setupRichEditor() {
    const editor = document.getElementById('editor');
    const hiddenInput = document.getElementById('assignmentInstructions');
    if (!editor || !hiddenInput) return;

    const buttons = {
        bold: document.getElementById('boldBtn'),
        italic: document.getElementById('italicBtn'),
        list: document.getElementById('listBtn'),
        code: document.getElementById('codeBtn')
    };

    const exec = (command, value = null) => {
        document.execCommand(command, false, value);
        editor.focus();
        sync();
    };

    const sync = () => {
        hiddenInput.value = editor.innerHTML;
    };

    buttons.bold?.addEventListener('click', () => exec('bold'));
    buttons.italic?.addEventListener('click', () => exec('italic'));
    buttons.list?.addEventListener('click', () => exec('insertUnorderedList'));
    
    buttons.code?.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const code = document.createElement('code');
        code.appendChild(range.extractContents());
        range.insertNode(code);
        sync();
    });

    editor.addEventListener('input', sync);

    // Keyboard shortcuts
    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); exec('bold'); }
            if (e.key === 'i') { e.preventDefault(); exec('italic'); }
        }
    });
}
