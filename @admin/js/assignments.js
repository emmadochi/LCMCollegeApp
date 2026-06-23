import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let lessonId = urlParams.get('lessonId');
    let courseId = urlParams.get('courseId');

    if (!lessonId) {
        document.getElementById('lessonPicker')?.classList.remove('hidden');
        await loadCourses();
    } else {
        await loadLessonInfo(lessonId);
        await loadAssignmentData(lessonId);
    }

    setupRichEditor();

    const backBtn   = document.getElementById('backBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    if (backBtn && courseId) backBtn.href = `lessons.html?courseId=${courseId}`;

    async function loadLessonInfo(id) {
        try {
            const resp = await fetch(`../api/lessons/index.php?id=${id}`, {
                headers: getAdminAuthHeader()
            });
            if (resp.ok) {
                const data = await resp.json();
                const titleEl = document.getElementById('lessonTitle');
                if (titleEl) titleEl.textContent = `Assignment for: ${data.title}`;
                if (!courseId && data.course_id) {
                    courseId = data.course_id;
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
            const resp = await fetch(`../api/admin/assignments.php?lesson_id=${lId}`, {
                headers: getAdminAuthHeader()
            });

            if (!resp.ok) throw new Error('Request failed');

            const data = await resp.json();

            if (data && data.id) {
                existingAssignmentId = data.id;

                if (data.course_id) {
                    courseId = data.course_id;
                    if (backBtn) backBtn.href = `lessons.html?courseId=${courseId}`;
                }

                const titleEl   = document.getElementById('assignmentTitle');
                const instrEl   = document.getElementById('assignmentInstructions');
                const editorEl  = document.getElementById('editor');
                const dueDateEl = document.getElementById('dueDate');

                if (titleEl)  titleEl.value = data.title || '';
                const instructions = data.instructions || '';
                if (instrEl)  instrEl.value = instructions;
                if (editorEl) editorEl.innerHTML = instructions;

                if (data.due_date && dueDateEl) {
                    const date = new Date(data.due_date);
                    const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                        .toISOString().slice(0, 16);
                    dueDateEl.value = localISO;
                }

                deleteBtn?.classList.remove('hidden');
                if (data.submissions && data.submissions.length > 0) {
                    renderSubmissions(data.submissions);
                }
            } else {
                existingAssignmentId = null;
                document.getElementById('assignmentForm')?.reset();
                const editorEl = document.getElementById('editor');
                if (editorEl) editorEl.innerHTML = '';
                deleteBtn?.classList.add('hidden');
                document.getElementById('submissionsSection')?.classList.add('hidden');
            }
        } catch (err) {
            console.error("Error loading assignment:", err);
        }
    }

    // Course/Lesson Selectors
    async function loadCourses() {
        const courseSelect = document.getElementById('courseSelect');
        if (!courseSelect) return;
        try {
            const resp = await fetch('../api/courses/index.php');
            if (resp.ok) {
                const courses = await resp.json();
                courseSelect.innerHTML = '<option value="">Select a course</option>';
                courses.forEach(c => {
                    courseSelect.innerHTML += `<option value="${c.id}">${c.title}</option>`;
                });
            }
        } catch (e) { console.error(e); }
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

        try {
            const resp = await fetch(`../api/lessons/index.php?course_id=${cId}`, {
                headers: getAdminAuthHeader()
            });
            if (resp.ok) {
                const lessons = await resp.json();
                lessonSelect.innerHTML = '<option value="">Select a lesson</option>';
                lessons.forEach(l => {
                    lessonSelect.innerHTML += `<option value="${l.id}">${l.title}</option>`;
                });
            }
        } catch (e) { console.error(e); }
    });

    document.getElementById('lessonSelect')?.addEventListener('change', async (e) => {
        lessonId = e.target.value;
        if (lessonId) {
            await loadLessonInfo(lessonId);
            await loadAssignmentData(lessonId);
        }
    });

    const assignmentForm = document.getElementById('assignmentForm');
    assignmentForm?.addEventListener('submit', async (e) => {
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
            title:        document.getElementById('assignmentTitle').value,
            instructions: document.getElementById('assignmentInstructions').value,
            dueDate:      dueDateValue,
        };

        try {
            let resp;
            if (existingAssignmentId) {
                payload.action = 'update';
                payload.id     = existingAssignmentId;
                resp = await fetch('../api/admin/assignments.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() },
                    body: JSON.stringify(payload)
                });
            } else {
                payload.action = 'create';
                resp = await fetch('../api/admin/assignments.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() },
                    body: JSON.stringify(payload)
                });
            }

            if (!resp.ok) {
                const errData = await resp.json();
                throw new Error(errData.message || 'Save failed');
            }

            alert('Assignment saved!');
            window.location.href = 'assignments.html';
        } catch (err) {
            alert('Error saving assignment: ' + err.message);
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons text-sm">save</span> Save Assignment';
        }
    });

    deleteBtn?.addEventListener('click', async () => {
        if (confirm('Delete this assignment and all submissions?')) {
            try {
                const resp = await fetch(`../api/admin/assignments.php?id=${existingAssignmentId}`, {
                    method: 'DELETE',
                    headers: getAdminAuthHeader()
                });

                if (!resp.ok) {
                    const err = await resp.json();
                    throw new Error(err.message || 'Delete failed');
                }

                alert('Assignment deleted.');
                window.location.href = 'assignments.html';
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
    });
});

function renderSubmissions(submissions) {
    const section    = document.getElementById('submissionsSection');
    const container  = document.getElementById('submissionsContainer');
    const countEl    = document.getElementById('submissionCount');

    if (!section || !container) return;

    section.classList.remove('hidden');
    if (countEl) countEl.textContent = `${submissions.length} Submissions`;

    if (submissions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No submissions yet.</p>';
        return;
    }

    container.innerHTML = '';
    submissions.forEach(sub => {
        const card = document.createElement('div');
        card.className = 'adm-card p-4 hover:shadow-md transition-shadow cursor-default';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-sm">${sub.user_name || 'Student'}</h4>
                    <p class="text-xs text-gray-500">${sub.user_email || ''}</p>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${sub.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${(sub.status || 'pending').toUpperCase()}
                </span>
            </div>
            <div class="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-700">
                ${sub.submission_type === 'text' ? (sub.submission_text || '') : `<a href="${sub.file_url}" target="_blank" class="text-indigo-600 underline font-medium">Download: ${sub.file_name}</a>`}
            </div>
            <div class="mt-4 flex items-center justify-between">
                <p class="text-[10px] text-gray-400">Submitted: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A'}</p>
                <button class="text-xs text-indigo-600 font-bold hover:underline grade-btn" data-id="${sub.id}">
                    ${sub.status === 'graded' ? 'Update Grade' : 'Grade Submission'}
                </button>
            </div>
            <div id="gradeForm-${sub.id}" class="hidden mt-4 pt-4 border-t border-gray-100">
                <div class="flex gap-2">
                    <input type="text" placeholder="Grade (e.g. 85/100)" class="form-input text-xs w-32" id="grade-${sub.id}" value="${sub.grade || ''}">
                    <input type="text" placeholder="Feedback" class="form-input text-xs flex-1" id="feedback-${sub.id}" value="${sub.feedback || ''}">
                    <button class="btn-primary text-[10px] px-3 py-1 save-grade" data-id="${sub.id}">Save</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    container.addEventListener('click', async (e) => {
        if (e.target.classList.contains('grade-btn')) {
            const id = e.target.getAttribute('data-id');
            document.getElementById(`gradeForm-${id}`)?.classList.toggle('hidden');
        }

        if (e.target.classList.contains('save-grade')) {
            const id       = e.target.getAttribute('data-id');
            const grade    = document.getElementById(`grade-${id}`).value;
            const feedback = document.getElementById(`feedback-${id}`).value;

            try {
                const resp = await fetch('../api/admin/assignments.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() },
                    body: JSON.stringify({ action: 'grade_submission', submissionId: id, grade, feedback })
                });

                if (!resp.ok) {
                    const err = await resp.json();
                    throw new Error(err.message || 'Grade save failed');
                }

                alert('Grade saved!');
                location.reload();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
    });
}

function setupRichEditor() {
    const editor      = document.getElementById('editor');
    const hiddenInput = document.getElementById('assignmentInstructions');
    if (!editor || !hiddenInput) return;

    const buttons = {
        bold:   document.getElementById('boldBtn'),
        italic: document.getElementById('italicBtn'),
        list:   document.getElementById('listBtn'),
        code:   document.getElementById('codeBtn'),
    };

    const exec = (command, value = null) => {
        document.execCommand(command, false, value);
        editor.focus();
        sync();
    };

    const sync = () => { hiddenInput.value = editor.innerHTML; };

    buttons.bold?.addEventListener('click',   () => exec('bold'));
    buttons.italic?.addEventListener('click', () => exec('italic'));
    buttons.list?.addEventListener('click',   () => exec('insertUnorderedList'));

    buttons.code?.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const code  = document.createElement('code');
        code.appendChild(range.extractContents());
        range.insertNode(code);
        sync();
    });

    editor.addEventListener('input', sync);
    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); exec('bold'); }
            if (e.key === 'i') { e.preventDefault(); exec('italic'); }
        }
    });
}
