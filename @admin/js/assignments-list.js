import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('assignmentsGrid');
    if (!grid) return;

    try {
        grid.innerHTML = `<div style="grid-column:1/-1;padding:48px;text-align:center;"><span class="loader"></span></div>`;

        const resp = await fetch('../api/admin/assignments.php', {
            headers: getAdminAuthHeader()
        });

        if (!resp.ok) throw new Error('Failed to load assignments');
        const assignments = await resp.json();

        if (!assignments || assignments.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;padding:64px;text-align:center;background:white;border-radius:16px;border:1px dashed var(--border);">
                    <span class="material-icons" style="font-size:48px;color:var(--text-muted);opacity:0.3;margin-bottom:12px;">assignment</span>
                    <p style="color:var(--text-muted);font-size:14px;">No assignments found. Go to Lessons to create one.</p>
                    <a href="lessons.html" class="btn-primary" style="display:inline-flex;margin-top:20px;">Go to Lessons</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        assignments.forEach(assign => {
            const dueDisplay = assign.due_date
                ? new Date(assign.due_date).toLocaleDateString()
                : 'No date';

            const card = document.createElement('div');
            card.className = 'adm-card p-6 flex flex-col hover:shadow-lg transition-shadow';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-indigo-50 text-indigo-700 p-2 rounded-lg">
                        <span class="material-icons">assignment</span>
                    </div>
                    <span class="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">${assign.course_title || ''}</span>
                </div>
                <h3 class="font-bold text-gray-800 mb-1 truncate" title="${assign.title}">${assign.title}</h3>
                <p class="text-xs text-indigo-600 font-medium mb-4">Lesson: ${assign.lesson_title || ''}</p>
                
                <div class="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div class="flex flex-col">
                        <span class="text-[10px] text-gray-400 uppercase font-bold">Due Date</span>
                        <span class="text-xs font-semibold text-red-500">${dueDisplay}</span>
                    </div>
                    <div class="flex gap-2">
                        <button class="text-red-400 hover:text-red-600 p-2 rounded-full transition-colors delete-btn" data-id="${assign.id}" title="Delete Assignment">
                            <span class="material-icons text-sm">delete_outline</span>
                        </button>
                        <a href="add_assignment.html?lessonId=${assign.lesson_id}&courseId=${assign.course_id}" class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors" title="Manage & Submissions">
                            <span class="material-icons">edit</span>
                        </a>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        grid.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this assignment? This cannot be undone.')) {
                    try {
                        const resp = await fetch(`../api/admin/assignments.php?id=${id}`, {
                            method: 'DELETE',
                            headers: getAdminAuthHeader()
                        });

                        if (!resp.ok) {
                            const err = await resp.json();
                            throw new Error(err.message || 'Delete failed');
                        }

                        alert('Assignment deleted successfully!');
                        location.reload();
                    } catch (err) {
                        alert('Error deleting assignment: ' + err.message);
                    }
                }
            }
        });

    } catch (err) {
        console.error("Error loading assignments:", err);
        grid.innerHTML = `<p class="error">Error loading assignments: ${err.message}</p>`;
    }
});
