import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.endsWith('reviews.html')) return;

    await loadReviews();
});

async function loadReviews() {
    const reviewsListEl = document.getElementById('reviewsList');
    const reviewCountEl = document.getElementById('reviewCount');
    if (!reviewsListEl) return;

    try {
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        reviewsListEl.innerHTML = '';
        reviewCountEl.textContent = querySnapshot.size;

        if (querySnapshot.empty) {
            reviewsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No reviews found yet.</td></tr>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
            
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${data.userName || 'Anonymous'}</div>
                    <div class="text-xs text-gray-500">${data.userEmail || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${data.courseName || 'Multiple'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-amber-500">
                    <div class="flex items-center">
                        ${Array(5).fill(0).map((_, i) => `<span class="material-icons text-sm">${i < (data.rating || 0) ? 'star' : 'star_outline'}</span>`).join('')}
                    </div>
                </td>
                <td class="px-6 py-4">
                    <p class="text-sm text-gray-600 max-w-xs truncate" title="${data.comment || ''}">${data.comment || 'No comment'}</p>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg delete-btn" data-id="${id}">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </td>
            `;
            reviewsListEl.appendChild(tr);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this review?")) {
                    try {
                        await deleteDoc(doc(db, "reviews", id));
                        loadReviews();
                    } catch (error) {
                        console.error("Error deleting review:", error);
                        alert("Failed to delete review.");
                    }
                }
            });
        });

    } catch (error) {
        console.error("Error loading reviews:", error);
        reviewsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Failed to load reviews.</td></tr>`;
    }
}
