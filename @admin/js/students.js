import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.endsWith('students.html')) return;

    const studentsListEl = document.getElementById('studentsList');
    const searchInput    = document.getElementById('studentSearch');
    const countEl        = document.getElementById('studentCount');
    if (!studentsListEl) return;

    // Cache all student rows for client-side filtering
    let allRows = [];

    function updateCount(visible, total) {
        if (!countEl) return;
        countEl.textContent = visible === total
            ? `${total} student${total !== 1 ? 's' : ''}`
            : `${visible} of ${total} student${total !== 1 ? 's' : ''}`;
    }

    function applySearch(query) {
        const q = query.trim().toLowerCase();
        let visible = 0;
        allRows.forEach(({ tr, name, email }) => {
            const match = !q || name.includes(q) || email.includes(q);
            tr.style.display = match ? '' : 'none';
            if (match) visible++;
        });

        // Show/hide no-results row
        let noResultRow = studentsListEl.querySelector('.no-results-row');
        if (visible === 0 && allRows.length > 0) {
            if (!noResultRow) {
                noResultRow = document.createElement('tr');
                noResultRow.className = 'no-results-row';
                noResultRow.innerHTML = `<td colspan="5" class="px-6 py-8 text-center text-gray-400">No students match your search.</td>`;
                studentsListEl.appendChild(noResultRow);
            }
        } else {
            noResultRow?.remove();
        }

        updateCount(visible, allRows.length);
    }

    // Wire up search input (live filter)
    searchInput?.addEventListener('input', (e) => applySearch(e.target.value));

    try {
        studentsListEl.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">Loading students...</td></tr>`;

        const usersSnapshot = await getDocs(collection(db, "users"));
        studentsListEl.innerHTML = '';

        if (usersSnapshot.empty) {
            studentsListEl.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No students registered yet.</td></tr>`;
            updateCount(0, 0);
            return;
        }

        usersSnapshot.forEach((docSnap) => {
            const data      = docSnap.data();
            const email     = data.email || 'N/A';
            const name      = data.name  || email.split('@')[0];
            const createdAt = data.createdAt
                ? new Date(data.createdAt.seconds * 1000).toLocaleDateString()
                : 'N/A';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            ${name[0].toUpperCase()}
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${name}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${email}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdAt}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a href="student_detail.html?studentId=${docSnap.id}" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">View Profile</a>
                </td>
            `;
            studentsListEl.appendChild(tr);

            // Store searchable data alongside the row element
            allRows.push({
                tr,
                name:  name.toLowerCase(),
                email: email.toLowerCase(),
            });
        });

        updateCount(allRows.length, allRows.length);

        // Apply any query that was already typed while data was loading
        if (searchInput?.value) applySearch(searchInput.value);

    } catch (error) {
        console.error("Error loading students:", error);
        studentsListEl.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Failed to load students.</td></tr>`;
    }
});
