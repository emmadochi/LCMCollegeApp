import { getAdminAuthHeader } from './auth.js';

const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    CAD: 'C$'
};

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('studentId');

    if (!studentId) {
        alert("No student ID provided.");
        window.location.href = 'students.html';
        return;
    }

    const studentProfile = document.getElementById('studentProfile');
    const loadingState   = document.getElementById('loadingState');

    try {
        const response = await fetch(`../api/admin/students.php?id=${studentId}`, {
            headers: getAdminAuthHeader()
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Student not found');
        }

        const data = await response.json();

        if (!data || !data.student) {
            alert("Student not found.");
            window.location.href = 'students.html';
            return;
        }

        renderStudentInfo(data.student, data.enrolled_count ?? 0, data.progress ?? []);
        renderProgress(data.progress ?? []);
        renderReviews(data.reviews ?? []);
        renderHeaderActions(data.student);

        loadingState?.classList.add('hidden');
        studentProfile?.classList.remove('hidden');
        studentProfile.style.display = 'flex';

    } catch (error) {
        console.error("Error loading student details:", error);
        alert("Failed to load student details: " + error.message);
    }
});

function renderStudentInfo(student, enrolledCount, progressList) {
    const name  = student.name || student.email?.split('@')[0] || 'Unknown Student';
    const email = student.email || 'N/A';
    const createdAt = student.created_at
        ? new Date(student.created_at).toLocaleDateString()
        : 'N/A';

    const nameEl = document.getElementById('studentName');
    const emailEl = document.getElementById('studentEmail');
    const regDateEl = document.getElementById('registrationDate');
    const avatarEl = document.getElementById('studentAvatar');
    const enrolledCountEl = document.getElementById('enrolledCount');
    const completedCountEl = document.getElementById('completedCount');
    const avgScoreEl = document.getElementById('avgScore');
    const statusBadgeEl = document.getElementById('studentStatusBadge');

    if (nameEl)      nameEl.textContent      = name;
    if (emailEl)     emailEl.textContent     = email;
    if (regDateEl)   regDateEl.textContent   = `Registered: ${createdAt}`;
    if (avatarEl)    avatarEl.textContent    = name[0].toUpperCase();
    if (enrolledCountEl) enrolledCountEl.textContent = enrolledCount;

    // Calculate completed lessons
    const completedCount = progressList.filter(p => p.is_completed).length;
    if (completedCountEl) completedCountEl.textContent = completedCount;

    // Calculate average quiz score
    const quizScores = progressList.filter(p => p.last_quiz_score > 0).map(p => p.last_quiz_score);
    const avgScore = quizScores.length > 0
        ? Math.round(quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length)
        : 0;
    if (avgScoreEl) avgScoreEl.textContent = `${avgScore}%`;

    // Render status badge dynamically
    if (statusBadgeEl) {
        if (student.is_active) {
            statusBadgeEl.className = 'badge badge-green badge-dot';
            statusBadgeEl.textContent = 'Active Member';
        } else {
            statusBadgeEl.className = 'badge badge-red badge-dot';
            statusBadgeEl.textContent = 'Suspended';
        }
    }

    document.title = `${name} - Student Profile`;
}

function renderHeaderActions(student) {
    const actionsContainer = document.getElementById('headerActions');
    if (!actionsContainer) return;

    actionsContainer.innerHTML = `
        <button id="toggleStatusBtn" class="adm-btn adm-btn-secondary" style="font-weight:600;padding:8px 16px;font-size:13px;border-radius:10px;border:1.5px solid var(--border);display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:#fff;">
            <span class="material-icons" style="font-size:16px;">${student.is_active ? 'block' : 'check_circle'}</span>
            ${student.is_active ? 'Suspend Student' : 'Activate Student'}
        </button>
        <button id="deleteStudentBtn" class="adm-btn adm-btn-danger" style="background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;font-weight:600;padding:8px 16px;font-size:13px;border-radius:10px;display:inline-flex;align-items:center;gap:6px;margin-left:8px;cursor:pointer;">
            <span class="material-icons" style="font-size:16px;">delete</span>
            Delete Account
        </button>
    `;

    document.getElementById('toggleStatusBtn').addEventListener('click', () => toggleStatus(student.id, student.is_active));
    document.getElementById('deleteStudentBtn').addEventListener('click', () => deleteStudent(student.id, student.name));
}

async function toggleStatus(studentId, currentStatus) {
    const actionVerb = currentStatus ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${actionVerb} this student?`)) return;
    try {
        const response = await fetch('../api/admin/students.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeader()
            },
            body: JSON.stringify({ id: studentId, is_active: currentStatus ? 0 : 1 })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to update student status');
        }
        alert("Student status updated successfully.");
        window.location.reload();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteStudent(studentId, name) {
    if (!confirm(`WARNING: Are you sure you want to permanently delete student "${name}"? This action cannot be undone and will delete all progress, assignments, and reviews.`)) return;
    try {
        const response = await fetch(`../api/admin/students.php?id=${studentId}`, {
            method: 'DELETE',
            headers: getAdminAuthHeader()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to delete student');
        }
        alert("Student deleted successfully.");
        window.location.href = 'students.html';
    } catch (err) {
        alert(err.message);
    }
}

function renderProgress(progressList) {
    const container = document.getElementById('enrollmentList');
    if (!container) return;

    if (!progressList || progressList.length === 0) {
        container.innerHTML = `<div class="p-12 text-center text-gray-400 italic">No progress records found for this student.</div>`;
        return;
    }

    // Group by course
    const byCourse = {};
    progressList.forEach(prog => {
        const cid = prog.course_id;
        if (!byCourse[cid]) {
            byCourse[cid] = {
                title: prog.course_title || 'Unknown Course',
                lessons: []
            };
        }
        byCourse[cid].lessons.push(prog);
    });

    container.innerHTML = '';
    Object.values(byCourse).forEach(course => {
        const total = course.lessons.length;
        const completed = course.lessons.filter(l => l.is_completed).length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        // List individual lesson details inside the course
        const lessonsListHtml = course.lessons.map(l => {
            const statusColor = l.is_completed ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50';
            const statusLabel = l.is_completed ? 'Completed' : 'In Progress';
            const quizHtml = l.last_quiz_score > 0 
                ? `<span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full">Quiz: ${l.last_quiz_score}%</span>` 
                : '';
            return `
                <div class="flex items-center justify-between text-xs py-2 px-3 hover:bg-gray-100 rounded-lg">
                    <span class="text-gray-700 font-medium">${l.lesson_title || 'Unnamed Lesson'}</span>
                    <div class="flex items-center gap-2">
                        ${quizHtml}
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor}">${statusLabel}</span>
                    </div>
                </div>
            `;
        }).join('');

        const div = document.createElement('div');
        div.className = 'p-6 border-b border-gray-50 last:border-0';
        div.innerHTML = `
            <div class="mb-4">
                <div class="flex justify-between items-center mb-1">
                    <h4 class="font-bold text-gray-900 text-sm">${course.title}</h4>
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">${pct}%</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                    <div class="bg-indigo-600 h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
                </div>
                <p class="text-[11px] text-gray-400 mt-1.5">${completed} of ${total} activities completed</p>
            </div>
            <div class="mt-3 space-y-1 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                <div class="text-[10px] font-bold text-gray-400 uppercase px-3 py-1">Activity Log</div>
                ${lessonsListHtml}
            </div>
        `;
        container.appendChild(div);
    });
}

function renderReviews(reviews) {
    const container = document.getElementById('studentReviewsList');
    if (!container) return;

    if (!reviews || reviews.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-gray-400 italic text-sm">No reviews submitted by this student.</div>`;
        return;
    }

    container.innerHTML = '';
    reviews.forEach(review => {
        const date = review.created_at ? new Date(review.created_at).toLocaleDateString() : 'N/A';
        const stars = Array(5).fill(0).map((_, i) =>
            `<span class="material-icons text-sm" style="font-size:14px;color:#fbbf24;">${i < review.rating ? 'star' : 'star_outline'}</span>`
        ).join('');

        const div = document.createElement('div');
        div.className = 'p-6 border-b border-gray-50 last:border-0';
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-1">${stars}</div>
                <span class="text-xs text-gray-400">${date}</span>
            </div>
            <p class="text-sm font-bold text-gray-800 mb-1">${review.course_title || 'Course Review'}</p>
            <p class="text-sm text-gray-600 italic">"${review.comment}"</p>
        `;
        container.appendChild(div);
    });
}
