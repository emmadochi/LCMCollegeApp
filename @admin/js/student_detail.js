import { db } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('studentId');

    if (!studentId) {
        alert("No student ID provided.");
        window.location.href = 'students.html';
        return;
    }

    const studentProfile = document.getElementById('studentProfile');
    const loadingState = document.getElementById('loadingState');

    try {
        // 1. Fetch Student Basic Info
        const studentSnap = await getDoc(doc(db, "users", studentId));
        if (!studentSnap.exists()) {
            alert("Student not found.");
            window.location.href = 'students.html';
            return;
        }

        const data = studentSnap.data();
        renderStudentInfo(data);

        // 2. Fetch Enrollments / Progress
        // Based on typical structure, this might be in 'enrollments' or subcollection
        // For now, let's explore or use placeholders
        await loadEnrollments(studentId);

        // 3. Fetch Student Reviews
        await loadStudentReviews(studentId);

        // Show Content
        loadingState.classList.add('hidden');
        studentProfile.classList.remove('hidden');

    } catch (error) {
        console.error("Error loading student details:", error);
        alert("Failed to load student details.");
    }
});

function renderStudentInfo(data) {
    const name = data.displayName || data.name || data.email?.split('@')[0] || 'Unknown Student';
    const email = data.email || 'N/A';
    const createdAt = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

    document.getElementById('studentName').textContent = name;
    document.getElementById('studentEmail').textContent = email;
    document.getElementById('registrationDate').textContent = `Registered: ${createdAt}`;
    
    const avatar = document.getElementById('studentAvatar');
    avatar.textContent = name[0].toUpperCase();
    
    // Set Document Title
    document.title = `${name} - Student Profile`;
}

async function loadEnrollments(studentId) {
    const container = document.getElementById('enrollmentList');
    try {
        // Updated to query root collection 'user_progress'
        const q = query(collection(db, "user_progress"), where("userId", "==", studentId));
        const progressSnap = await getDocs(q);
        
        if (!progressSnap.empty) {
            container.innerHTML = '';
            for (const docSnap of progressSnap.docs) {
                const prog = docSnap.data();
                
                // Fetch Course Title
                let courseTitle = "Loading course...";
                try {
                    const courseDoc = await getDoc(doc(db, "courses", prog.courseId));
                    if (courseDoc.exists()) courseTitle = courseDoc.data().title;
                } catch (e) { courseTitle = `Course: ${prog.courseId}`; }

                // Fetch Lesson Title
                let lessonTitle = "";
                try {
                    const lessonDoc = await getDoc(doc(db, "lessons", prog.lessonId));
                    if (lessonDoc.exists()) lessonTitle = ` - ${lessonDoc.data().title}`;
                } catch (e) { }

                const div = document.createElement('div');
                div.className = 'p-6 flex items-center justify-between border-b border-gray-50 last:border-0';
                div.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                             <span class="material-icons">quiz</span>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900">${courseTitle}${lessonTitle}</h4>
                            <div class="flex items-center gap-3 mt-1">
                                <span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">
                                    Score: ${prog.lastQuizScore || 0}%
                                </span>
                                <span class="text-xs text-gray-400">
                                    Status: ${prog.isCompleted ? 'Passed' : 'Needs Review'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(div);
            }
            document.getElementById('enrolledCount').textContent = progressSnap.size;
        } else {
            container.innerHTML = `<div class="p-12 text-center text-gray-400 italic">No quiz progress found for this student.</div>`;
        }
    } catch (e) {
        console.error("Error loading progress:", e);
    }
}

async function loadStudentReviews(studentId) {
    const container = document.getElementById('studentReviewsList');
    try {
        const q = query(collection(db, "reviews"), where("userId", "==", studentId), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            container.innerHTML = '';
            snap.forEach(docSnap => {
                const review = docSnap.data();
                const date = review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                
                const div = document.createElement('div');
                div.className = 'p-6';
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-1 text-amber-400">
                            ${Array(5).fill(0).map((_, i) => `<span class="material-icons text-sm">${i < (review.rating || 0) ? 'star' : 'star_outline'}</span>`).join('')}
                        </div>
                        <span class="text-xs text-gray-400">${date}</span>
                    </div>
                    <p class="text-sm font-bold text-gray-800 mb-1">${review.courseName || 'Course Review'}</p>
                    <p class="text-sm text-gray-600 italic">"${review.comment}"</p>
                `;
                container.appendChild(div);
            });
        }
    } catch (e) {
        console.log("Error loading reviews:", e);
    }
}
