import { getAdminAuthHeader } from './auth.js';

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

        renderStudentInfo(data.student, data.enrolled_count ?? 0);
        renderProgress(data.progress ?? []);
        renderReviews(data.reviews ?? []);

        loadingState?.classList.add('hidden');
        studentProfile?.classList.remove('hidden');

    } catch (error) {
        console.error("Error loading student details:", error);
        alert("Failed to load student details: " + error.message);
    }
});

function renderStudentInfo(student, enrolledCount) {
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

    if (nameEl)      nameEl.textContent      = name;
    if (emailEl)     emailEl.textContent     = email;
    if (regDateEl)   regDateEl.textContent   = `Registered: ${createdAt}`;
    if (avatarEl)    avatarEl.textContent    = name[0].toUpperCase();
    if (enrolledCountEl) enrolledCountEl.textContent = enrolledCount;

    document.title = `${name} - Student Profile`;
}

function renderProgress(progressList) {
    const container = document.getElementById('enrollmentList');
    if (!container) return;

    if (!progressList || progressList.length === 0) {
        container.innerHTML = `<div class="p-12 text-center text-gray-400 italic">No quiz progress found for this student.</div>`;
        return;
    }

    container.innerHTML = '';
    progressList.forEach(prog => {
        const div = document.createElement('div');
        div.className = 'p-6 flex items-center justify-between border-b border-gray-50 last:border-0';
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <span class="material-icons">quiz</span>
                </div>
                <div>
                    <h4 class="font-bold text-gray-900">${prog.course_title || 'Unknown Course'}${prog.lesson_title ? ` - ${prog.lesson_title}` : ''}</h4>
                    <div class="flex items-center gap-3 mt-1">
                        <span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">
                            Score: ${prog.last_quiz_score || 0}%
                        </span>
                        <span class="text-xs text-gray-400">
                            Status: ${prog.is_completed ? 'Passed' : 'Needs Review'}
                        </span>
                    </div>
                </div>
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
            `<span class="material-icons text-sm">${i < review.rating ? 'star' : 'star_outline'}</span>`
        ).join('');

        const div = document.createElement('div');
        div.className = 'p-6';
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-1 text-amber-400">${stars}</div>
                <span class="text-xs text-gray-400">${date}</span>
            </div>
            <p class="text-sm font-bold text-gray-800 mb-1">${review.course_title || 'Course Review'}</p>
            <p class="text-sm text-gray-600 italic">"${review.comment}"</p>
        `;
        container.appendChild(div);
    });
}
