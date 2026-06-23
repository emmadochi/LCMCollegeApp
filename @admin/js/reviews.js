import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.includes('reviews.html')) return;
    await loadReviews();
});

async function loadReviews() {
    const reviewsListEl = document.getElementById('reviewsList');
    const reviewCountEl = document.getElementById('reviewCount');
    if (!reviewsListEl) return;

    try {
        reviewsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading reviews...</td></tr>`;

        const resp = await fetch('../api/admin/reviews.php', {
            headers: getAdminAuthHeader()
        });

        if (!resp.ok) throw new Error('Failed to load reviews');

        const reviews = await resp.json();
        reviewsListEl.innerHTML = '';

        if (reviewCountEl) reviewCountEl.textContent = reviews.length;

        if (!reviews || reviews.length === 0) {
            reviewsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No reviews found yet.</td></tr>`;
            return;
        }

        reviews.forEach(review => {
            const date = review.created_at ? new Date(review.created_at).toLocaleDateString() : 'N/A';
            const stars = Array(5).fill(0).map((_, i) =>
                `<span class="material-icons text-sm">${i < review.rating ? 'star' : 'star_outline'}</span>`
            ).join('');

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${review.user_name}</div>
                    <div class="text-xs text-gray-500">${review.user_email}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${review.course_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-amber-500">
                    <div class="flex items-center">${stars}</div>
                </td>
                <td class="px-6 py-4">
                    <p class="text-sm text-gray-600 max-w-xs truncate" title="${review.comment}">${review.comment || 'No comment'}</p>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg delete-btn" data-id="${review.id}">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </td>
            `;
            reviewsListEl.appendChild(tr);
        });

        // Delegate delete events
        reviewsListEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('.delete-btn');
            if (btn) {
                const id = btn.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this review?")) {
                    try {
                        const delResp = await fetch(`../api/admin/reviews.php?id=${id}`, {
                            method: 'DELETE',
                            headers: getAdminAuthHeader()
                        });

                        if (!delResp.ok) {
                            const err = await delResp.json();
                            throw new Error(err.message || 'Delete failed');
                        }

                        loadReviews();
                    } catch (error) {
                        console.error("Error deleting review:", error);
                        alert("Failed to delete review: " + error.message);
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error loading reviews:", error);
        reviewsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Failed to load reviews: ${error.message}</td></tr>`;
    }
}
