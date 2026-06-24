import { initNotifications } from './notifications.js';

const API_BASE = '../api';

function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function parseJwt(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(window.atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')));
    } catch { return null; }
}

let currentUser = null;
let allSubmissions = [];
let allStudents   = [];
let allAssignments = [];
let allCourses    = [];

// ──────────────────────────────────────────────────────────────────────────────
// AUTH GUARD
// ──────────────────────────────────────────────────────────────────────────────

function guardAuth() {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { window.location.replace('login.html'); return false; }

    const payload = parseJwt(token);
    if (!payload || !payload.exp || payload.exp < Date.now() / 1000) {
        localStorage.clear();
        window.location.replace('login.html');
        return false;
    }

    const user = JSON.parse(userStr);
    if (!['lecturer', 'admin', 'coordinator'].includes(user.role)) {
        window.location.replace('login.html');
        return false;
    }

    currentUser = user;
    return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ──────────────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon  = document.getElementById('toastIcon');
    const msg   = document.getElementById('toastMessage');
    if (!toast) return;

    msg.textContent = message;
    if (type === 'error') {
        icon.className = 'fa-solid fa-circle-exclamation text-red-400';
        toast.classList.add('bg-red-900');
        toast.classList.remove('bg-gray-900');
    } else {
        icon.className = 'fa-solid fa-circle-check text-primary';
        toast.classList.add('bg-gray-900');
        toast.classList.remove('bg-red-900');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3200);
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB SWITCHING
// ──────────────────────────────────────────────────────────────────────────────

function switchTab(tabName) {
    document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.classList.remove('active-tab');
        btn.classList.add('text-gray-600');
    });

    const section = document.getElementById(`${tabName}Section`);
    if (section) section.classList.remove('hidden');

    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) { btn.classList.add('active-tab'); btn.classList.remove('text-gray-600'); }

    const titles = { overview: 'Dashboard', students: 'My Students', submissions: 'Submissions', assignments: 'Assignments' };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titles[tabName] || 'Dashboard';

    if (tabName === 'overview')    renderOverview();
    if (tabName === 'submissions') renderSubmissionsTable();
    if (tabName === 'assignments') renderAssignmentsTable();
    if (tabName === 'students')    renderStudentsTable();
}

// ──────────────────────────────────────────────────────────────────────────────
// DATA FETCHERS
// ──────────────────────────────────────────────────────────────────────────────

async function fetchAll() {
    try {
        const [submRes, studRes, asnRes, courseRes] = await Promise.all([
            fetch(`${API_BASE}/admin/assignments.php?submissions=1`, { headers: getAuthHeader() }),
            fetch(`${API_BASE}/admin/students.php`,                  { headers: getAuthHeader() }),
            fetch(`${API_BASE}/admin/assignments.php`,               { headers: getAuthHeader() }),
            fetch(`${API_BASE}/courses/index.php`,                   { headers: getAuthHeader() }),
        ]);

        allSubmissions  = submRes.ok  ? await submRes.json()  : [];
        allStudents     = studRes.ok  ? await studRes.json()  : [];
        allAssignments  = asnRes.ok   ? await asnRes.json()   : [];
        const coursesJson = courseRes.ok ? await courseRes.json() : [];
        allCourses      = Array.isArray(coursesJson) ? coursesJson : (coursesJson.data || []);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// OVERVIEW SECTION
// ──────────────────────────────────────────────────────────────────────────────

function renderOverview() {
    const pending = allSubmissions.filter(s => s.status === 'pending');
    const graded  = allSubmissions.filter(s => ['approved','graded'].includes(s.status));

    document.getElementById('statStudentsCount').textContent = allStudents.length;
    document.getElementById('statPendingCount').textContent  = pending.length;
    document.getElementById('statGradedCount').textContent   = graded.length;
    document.getElementById('badgeTotalStudents').textContent = `${allStudents.length} Students`;

    const pendingBadge = document.getElementById('pendingBadgeCount');
    if (pendingBadge) pendingBadge.textContent = `${pending.length} New`;

    // Pending submissions feed
    const feedEl = document.getElementById('overviewSubmissionsList');
    if (feedEl) {
        if (pending.length === 0) {
            feedEl.innerHTML = `<div class="py-12 text-center text-gray-400"><i class="fa-solid fa-inbox text-3xl mb-3 block"></i><p class="text-sm">No pending submissions</p></div>`;
        } else {
            feedEl.innerHTML = pending.slice(0, 8).map(s => `
                <div class="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 hover:bg-amber-50 transition-colors cursor-pointer" onclick="openGradingModal('${s.id}')">
                    <div class="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm flex-shrink-0 uppercase">${(s.userName||'?')[0]}</div>
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-gray-900 text-xs truncate">${s.userName}</p>
                        <p class="text-[11px] text-gray-500 truncate mt-0.5">${s.assignmentTitle}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${s.courseTitle || ''}</p>
                    </div>
                    <span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full flex-shrink-0">Pending</span>
                </div>
            `).join('');
        }
    }

    // Classes overview
    const classesEl = document.getElementById('overviewClassesList');
    if (classesEl) {
        const uniqueCourses = [...new Map(allAssignments.map(a => [a.course_id, a])).values()];
        if (uniqueCourses.length === 0) {
            classesEl.innerHTML = `<div class="py-12 text-center text-gray-400"><i class="fa-solid fa-chalkboard text-3xl mb-3 block"></i><p class="text-sm">No assigned classes yet</p></div>`;
        } else {
            classesEl.innerHTML = uniqueCourses.map(a => {
                const courseSubmissions = allSubmissions.filter(s => s.courseId === a.course_id);
                const approvedCount = courseSubmissions.filter(s => ['approved','graded'].includes(s.status)).length;
                return `
                    <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                        <div class="w-10 h-10 rounded-xl bg-primary/15 text-primaryDark flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-book-open text-sm"></i></div>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-gray-900 text-xs truncate">${a.course_title}</p>
                            <p class="text-[11px] text-gray-500 mt-0.5">${courseSubmissions.length} submissions · ${approvedCount} approved</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// STUDENTS TABLE
// ──────────────────────────────────────────────────────────────────────────────

function renderStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (allStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-16 text-center text-gray-400 italic text-sm">No students assigned to you yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = allStudents.map(s => {
        let coursesHtml = '—';
        let progressHtml = '—';
        
        if (s.courses && s.courses.length > 0) {
            coursesHtml = s.courses.map(c => `
                <div class="font-medium text-gray-800 text-xs truncate max-w-[180px] mb-1.5 last:mb-0" title="${c.course_title}">
                    ${c.course_title}
                </div>
            `).join('');
            
            progressHtml = s.courses.map(c => `
                <div class="flex items-center gap-2 mb-1.5 last:mb-0" title="${c.completed_lessons} of ${c.total_lessons} lessons completed">
                    <div class="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[70px] max-w-[100px]">
                        <div class="brand-gradient-bg h-1.5 rounded-full" style="width:${c.progress_percent}%"></div>
                    </div>
                    <span class="text-xs text-gray-500 font-bold">${c.progress_percent}%</span>
                </div>
            `).join('');
        }

        return `
            <tr class="hover:bg-gray-50/70 transition-colors">
                <td class="py-3.5 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full brand-gradient-bg flex items-center justify-center font-bold text-gray-900 text-sm uppercase flex-shrink-0">${(s.name||'?')[0]}</div>
                        <span class="font-semibold text-gray-900 text-sm">${s.name}</span>
                    </div>
                </td>
                <td class="py-3.5 px-4 text-xs text-gray-500">${s.email}</td>
                <td class="py-3.5 px-4 text-xs text-gray-500">${coursesHtml}</td>
                <td class="py-3.5 px-4">${progressHtml}</td>
                <td class="py-3.5 px-4 text-right">
                    <button onclick="openStudentModal('${s.id}')" class="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primaryDark text-xs font-semibold rounded-lg transition-colors">
                        View Profile
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ──────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS TABLE
// ──────────────────────────────────────────────────────────────────────────────

function renderSubmissionsTable(filterStatus = null) {
    const tbody = document.getElementById('submissionsTableBody');
    if (!tbody) return;

    const sel = document.getElementById('submissionFilterStatus');
    const status = filterStatus || (sel ? sel.value : 'all');

    const filtered = status === 'all'
        ? allSubmissions
        : allSubmissions.filter(s => s.status === status);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-16 text-center text-gray-400 italic text-sm">No submissions found.</td></tr>`;
        return;
    }

    const statusConfig = {
        pending:  { cls: 'bg-amber-100 text-amber-800',   label: 'Pending' },
        approved: { cls: 'bg-green-100 text-green-800',   label: 'Approved' },
        graded:   { cls: 'bg-blue-100 text-blue-800',     label: 'Graded' },
        rejected: { cls: 'bg-red-100 text-red-700',       label: 'Revision' },
    };

    tbody.innerHTML = filtered.map(s => {
        const cfg = statusConfig[s.status] || { cls: 'bg-gray-100 text-gray-700', label: s.status };
        const date = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const typeIcon = s.submissionType === 'file' ? 'fa-file-arrow-up' : 'fa-align-left';
        return `
            <tr class="hover:bg-gray-50/70 transition-colors">
                <td class="py-3.5 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primary/15 text-primaryDark flex items-center justify-center font-bold text-xs uppercase">${(s.userName||'?')[0]}</div>
                        <div>
                            <p class="font-semibold text-gray-900 text-xs">${s.userName}</p>
                            <p class="text-[10px] text-gray-400">${s.userEmail}</p>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-4">
                    <p class="font-medium text-gray-800 text-xs">${s.assignmentTitle}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">${s.courseTitle || ''}</p>
                </td>
                <td class="py-3.5 px-4 text-xs text-gray-500">${date}</td>
                <td class="py-3.5 px-4">
                    <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                        <i class="fa-solid ${typeIcon}"></i>
                        ${s.submissionType === 'file' ? 'File Upload' : 'Text'}
                    </span>
                </td>
                <td class="py-3.5 px-4">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}">${cfg.label}</span>
                </td>
                <td class="py-3.5 px-4 text-right">
                    <button onclick="openGradingModal('${s.id}')" class="px-3 py-1.5 brand-gradient-bg text-gray-900 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-all">
                        Review
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ──────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS TABLE
// ──────────────────────────────────────────────────────────────────────────────

function renderAssignmentsTable() {
    const tbody = document.getElementById('assignmentsTableBody');
    if (!tbody) return;

    if (allAssignments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-16 text-center text-gray-400 italic text-sm">No assignments yet. Create one to get started.</td></tr>`;
        return;
    }

    tbody.innerHTML = allAssignments.map(a => {
        const due = a.due_date ? new Date(a.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        return `
            <tr class="hover:bg-gray-50/70 transition-colors">
                <td class="py-3.5 px-4 font-semibold text-gray-900 text-sm">${a.title}</td>
                <td class="py-3.5 px-4 text-xs text-gray-500">${a.course_title || '—'}</td>
                <td class="py-3.5 px-4 text-xs text-gray-500">${a.lesson_title || '—'}</td>
                <td class="py-3.5 px-4 text-xs text-gray-500">${due}</td>
                <td class="py-3.5 px-4">
                    <span class="font-bold text-gray-700 text-sm">${a.submission_count || 0}</span>
                    <span class="text-xs text-gray-400 ml-1">submissions</span>
                </td>
                <td class="py-3.5 px-4 text-right flex justify-end gap-2">
                    <button onclick="openEditAssignmentModal('${a.id}')" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors">
                        Edit
                    </button>
                    <button onclick="deleteAssignment('${a.id}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ──────────────────────────────────────────────────────────────────────────────
// GRADING MODAL
// ──────────────────────────────────────────────────────────────────────────────

function openGradingModal(submissionId) {
    const sub = allSubmissions.find(s => s.id === submissionId);
    if (!sub) return;

    document.getElementById('gradeSubmissionId').value = submissionId;
    document.getElementById('modalStudentInfo').textContent = `Student: ${sub.userName} · ${sub.assignmentTitle}`;

    const textEl = document.getElementById('modalSubmissionText');
    textEl.textContent = sub.submissionText || '(No text submitted)';

    const fileContainer = document.getElementById('modalSubmissionFileContainer');
    const fileLink = document.getElementById('modalSubmissionFileLink');
    if (sub.fileUrl && sub.fileName) {
        fileContainer.classList.remove('hidden');
        fileLink.href = sub.fileUrl;
        fileLink.title = sub.fileName;
        const ext = sub.fileName.split('.').pop().toLowerCase();
        const iconEl = fileLink.querySelector('i');
        const iconMap = { pdf: 'fa-file-pdf text-red-500', doc: 'fa-file-word text-blue-600', docx: 'fa-file-word text-blue-600', txt: 'fa-file-lines text-gray-500', zip: 'fa-file-zipper text-yellow-600' };
        if (iconEl) iconEl.className = `fa-solid ${iconMap[ext] || 'fa-file text-gray-500'} text-base`;
        fileLink.querySelector('span') && (fileLink.querySelector('span').textContent = sub.fileName);
    } else {
        fileContainer.classList.add('hidden');
    }

    // Pre-fill feedback if already graded
    document.getElementById('gradeScore').value   = sub.grade    || '';
    document.getElementById('gradeFeedback').value = sub.feedback || '';
    document.getElementById('gradeStatus').value  = ['approved','graded'].includes(sub.status) ? 'approved' : 'rejected';

    const modal = document.getElementById('gradingModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.openGradingModal = openGradingModal;

window.closeGradingModal = function() {
    const modal = document.getElementById('gradingModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// ──────────────────────────────────────────────────────────────────────────────
// SUBMIT GRADE
// ──────────────────────────────────────────────────────────────────────────────

async function submitGrade(e) {
    e.preventDefault();
    const submissionId = document.getElementById('gradeSubmissionId').value;
    const grade    = document.getElementById('gradeScore').value.trim();
    const feedback = document.getElementById('gradeFeedback').value.trim();
    const status   = document.getElementById('gradeStatus').value;

    if (!submissionId) return;

    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Saving...';

    try {
        const resp = await fetch(`${API_BASE}/admin/assignments.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ action: 'grade_submission', submissionId, grade, feedback, status })
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || 'Failed to save grade');

        showToast('Submission graded successfully!');
        window.closeGradingModal();

        // Update local state
        const idx = allSubmissions.findIndex(s => s.id === submissionId);
        if (idx !== -1) {
            allSubmissions[idx].status   = status;
            allSubmissions[idx].grade    = grade;
            allSubmissions[idx].feedback = feedback;
        }

        renderOverview();
        renderSubmissionsTable();
    } catch (err) {
        showToast(err.message || 'Failed to grade submission.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT MODAL
// ──────────────────────────────────────────────────────────────────────────────

function populateCoursesDropdown() {
    const select = document.getElementById('assignCourse');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Select Course</option>';
    allCourses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        select.appendChild(opt);
    });
}

async function loadLessonsForCourse(courseId) {
    const select = document.getElementById('assignLesson');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Loading lessons…</option>';
    try {
        const resp = await fetch(`${API_BASE}/lessons/index.php?course_id=${courseId}`, { headers: getAuthHeader() });
        const lessons = resp.ok ? await resp.json() : [];
        select.innerHTML = '<option value="" disabled selected>Select Lesson</option>';
        lessons.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = `${l.order_index}. ${l.title}`;
            select.appendChild(opt);
        });
    } catch {
        select.innerHTML = '<option value="" disabled>Failed to load lessons</option>';
    }
}

window.openAssignmentModal = function(editId = null) {
    const modal = document.getElementById('assignmentModal');
    const titleEl = document.getElementById('assignmentModalTitle');
    document.getElementById('editAssignmentId').value = editId || '';
    titleEl.textContent = editId ? 'Edit Assignment' : 'Create Course Assignment';
    document.getElementById('assignmentForm').reset();
    populateCoursesDropdown();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.openEditAssignmentModal = async function(assignmentId) {
    const a = allAssignments.find(x => x.id === assignmentId);
    if (!a) return;

    window.openAssignmentModal(assignmentId);

    setTimeout(() => {
        document.getElementById('assignTitle').value       = a.title || '';
        document.getElementById('assignDueDate').value     = a.due_date ? a.due_date.replace(' ','T').slice(0,16) : '';
        document.getElementById('assignInstructions').value = a.instructions || '';
        const courseSelect = document.getElementById('assignCourse');
        courseSelect.value = a.course_id || '';
        loadLessonsForCourse(a.course_id).then(() => {
            document.getElementById('assignLesson').value = a.lesson_id || '';
        });
    }, 80);
};

window.closeAssignmentModal = function() {
    const modal = document.getElementById('assignmentModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

async function submitAssignment(e) {
    e.preventDefault();
    const editId   = document.getElementById('editAssignmentId').value;
    const title    = document.getElementById('assignTitle').value.trim();
    const courseId = document.getElementById('assignCourse').value;
    const lessonId = document.getElementById('assignLesson').value;
    const dueDate  = document.getElementById('assignDueDate').value;
    const instructions = document.getElementById('assignInstructions').value;

    if (!title || !courseId || !lessonId || !dueDate) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Saving…';

    try {
        const payload = { title, courseId, lessonId, dueDate, instructions };
        if (editId) { payload.action = 'update'; payload.id = editId; }

        const resp = await fetch(`${API_BASE}/admin/assignments.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || 'Failed to save assignment');

        showToast(editId ? 'Assignment updated!' : 'Assignment created!');
        window.closeAssignmentModal();
        allAssignments = [];
        await fetchAll();
        renderAssignmentsTable();
        renderOverview();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

window.deleteAssignment = async function(assignmentId) {
    if (!confirm('Delete this assignment? This will also remove all student submissions.')) return;
    try {
        const resp = await fetch(`${API_BASE}/admin/assignments.php?id=${assignmentId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message);
        showToast('Assignment deleted.');
        allAssignments = allAssignments.filter(a => a.id !== assignmentId);
        renderAssignmentsTable();
        renderOverview();
    } catch (err) {
        showToast(err.message || 'Delete failed.', 'error');
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// STUDENT DETAIL MODAL
// ──────────────────────────────────────────────────────────────────────────────

window.openStudentModal = async function(studentId) {
    const modal = document.getElementById('studentDetailModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const nameEl    = document.getElementById('modalStudentName');
    const emailEl   = document.getElementById('modalStudentEmail');
    const avatarEl  = document.getElementById('modalStudentAvatar');
    const progressEl = document.getElementById('modalStudentProgressContainer');

    nameEl.textContent   = 'Loading…';
    emailEl.textContent  = '';
    progressEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    try {
        const resp = await fetch(`${API_BASE}/admin/students.php?id=${studentId}`, { headers: getAuthHeader() });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message);

        const st = data.student;
        nameEl.textContent  = st.name;
        emailEl.textContent = st.email;
        avatarEl.textContent = (st.name || '?')[0].toUpperCase();

        const progress = data.progress || [];
        if (progress.length === 0) {
            progressEl.innerHTML = `<p class="text-gray-400 italic text-xs">No progress data found.</p>`;
        } else {
            // Group by course
            const byCoure = {};
            progress.forEach(p => {
                if (!byCoure[p.course_id]) byCoure[p.course_id] = { title: p.course_title, lessons: [] };
                byCoure[p.course_id].lessons.push(p);
            });

            progressEl.innerHTML = Object.values(byCoure).map(course => {
                const total     = course.lessons.length;
                const completed = course.lessons.filter(l => l.is_completed).length;
                const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
                return `
                    <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div class="flex justify-between items-center mb-2">
                            <p class="font-semibold text-gray-900 text-sm">${course.title}</p>
                            <span class="text-xs font-bold text-primaryDark">${pct}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div class="brand-gradient-bg h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
                        </div>
                        <p class="text-[11px] text-gray-400 mt-1.5">${completed} of ${total} lessons completed</p>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        progressEl.innerHTML = `<p class="text-red-500 text-xs">${err.message}</p>`;
    }
};

window.closeStudentModal = function() {
    const modal = document.getElementById('studentDetailModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// ──────────────────────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    if (!guardAuth()) return;

    // Populate user info
    const name  = currentUser.name  || 'Lecturer';
    const email = currentUser.email || '';
    const el    = document.getElementById('lecturerNameDisplay');
    const em    = document.getElementById('lecturerEmailDisplay');
    const av    = document.getElementById('lecturerAvatar');
    const gr    = document.getElementById('lecturerGreeting');
    if (el) el.textContent  = name;
    if (em) em.textContent  = email;
    if (av) av.textContent  = name[0].toUpperCase();
    if (gr) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        gr.textContent = `${greeting}, ${name.split(' ')[0]} 👋`;
    }

    // Show body
    document.body.style.display = '';

    // Fetch all data
    await fetchAll();

    // Handle initial hash navigation
    const initialHash = window.location.hash.substring(1);
    if (['overview', 'students', 'submissions', 'assignments'].includes(initialHash)) {
        switchTab(initialHash);
    } else {
        switchTab('overview');
    }

    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.substring(1);
        if (['overview', 'students', 'submissions', 'assignments'].includes(newHash)) {
            switchTab(newHash);
        }
    });

    // Initialize Notifications
    initNotifications(getAuthHeader, {
        onTabSwitch: (tabName) => {
            switchTab(tabName);
            window.location.hash = tabName;
        }
    });

    // Sidebar Tab Navigation
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
            window.location.hash = tab;
        });
    });

    // Submission filter select
    const filterSel = document.getElementById('submissionFilterStatus');
    if (filterSel) filterSel.addEventListener('change', () => renderSubmissionsTable(filterSel.value));

    // Grading form
    const gradingForm = document.getElementById('gradingForm');
    if (gradingForm) gradingForm.addEventListener('submit', submitGrade);

    // Assignment form
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) assignmentForm.addEventListener('submit', submitAssignment);

    // Assignment modal course → lesson cascade
    const assignCourse = document.getElementById('assignCourse');
    if (assignCourse) assignCourse.addEventListener('change', () => loadLessonsForCourse(assignCourse.value));

    // Create assignment button
    const btnCreate = document.getElementById('btnCreateAssignment');
    if (btnCreate) btnCreate.addEventListener('click', () => window.openAssignmentModal());

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.replace('login.html');
        });
    }

    // Mobile Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const openBtn = document.getElementById('hamburgerBtnOpen');
    const closeBtn = document.getElementById('hamburgerBtnClose');

    function toggleSidebar(show) {
        if (!sidebar || !backdrop) return;
        if (show) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    }

    if (openBtn) openBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
    if (backdrop) backdrop.addEventListener('click', () => toggleSidebar(false));

    // Close sidebar when selecting a tab on mobile
    document.querySelectorAll('[data-tab], #sidebar a').forEach(el => {
        el.addEventListener('click', () => toggleSidebar(false));
    });

    // Close modals on backdrop click
    ['gradingModal', 'assignmentModal', 'studentDetailModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => {
            if (e.target === el) {
                el.classList.add('hidden');
                el.classList.remove('flex');
            }
        });
    });

    // ── Chat unread badge poller ────────────────────────────────────────────
    async function updateChatBadge() {
        try {
            const res = await fetch(`${API_BASE}/chat/unread.php`, { headers: getAuthHeader() });
            if (!res.ok) return;
            const data = await res.json();
            const badge = document.getElementById('chatUnreadBadge');
            if (badge) {
                const count = data.unread_count || 0;
                badge.textContent = count;
                badge.classList.toggle('hidden', count === 0);
            }
        } catch (_) { /* silent — non-critical */ }
    }

    updateChatBadge();
    setInterval(updateChatBadge, 10000);
});
