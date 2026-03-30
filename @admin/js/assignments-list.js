import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, doc, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('assignmentsGrid');

    try {
        const q = query(collection(db, "assignments"), orderBy("updatedAt", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
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
        
        // Fetch lessons and courses in parallel for better performance mapping
        const assignmentsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        for (const assign of assignmentsData) {
            let lessonTitle = "Unknown Lesson";
            let courseTitle = "Unknown Course";

            if (assign.lessonId) {
                const lessonSnap = await getDoc(doc(db, "lessons", assign.lessonId));
                if (lessonSnap.exists()) lessonTitle = lessonSnap.data().title;
            }
            if (assign.courseId) {
                const courseSnap = await getDoc(doc(db, "courses", assign.courseId));
                if (courseSnap.exists()) courseTitle = courseSnap.data().title;
            }

            const card = document.createElement('div');
            card.className = 'adm-card p-6 flex flex-col hover:shadow-lg transition-shadow';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-indigo-50 text-indigo-700 p-2 rounded-lg">
                        <span class="material-icons">assignment</span>
                    </div>
                    <span class="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">${courseTitle}</span>
                </div>
                <h3 class="font-bold text-gray-800 mb-1 truncate" title="${assign.title || 'Untitled Assignment'}">${assign.title || 'Untitled Assignment'}</h3>
                <p class="text-xs text-indigo-600 font-medium mb-4">Lesson: ${lessonTitle}</p>
                
                <div class="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div class="flex flex-col">
                        <span class="text-[10px] text-gray-400 uppercase font-bold">Due Date</span>
                        <span class="text-xs font-semibold text-red-500">${assign.dueDate?.toDate().toLocaleDateString() || 'No date'}</span>
                    </div>
                    <div class="flex gap-2">
                        <button class="text-red-400 hover:text-red-600 p-2 rounded-full transition-colors delete-btn" data-id="${assign.id}" title="Delete Assignment">
                            <span class="material-icons text-sm">delete_outline</span>
                        </button>
                        <a href="add_assignment.html?lessonId=${assign.lessonId}&courseId=${assign.courseId}" class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors" title="Manage & Submissions">
                            <span class="material-icons">edit</span>
                        </a>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        }

        // Add event listener for delete buttons
        grid.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this assignment? This cannot be undone.')) {
                    try {
                        await deleteDoc(doc(db, "assignments", id));
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
