import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.endsWith('admins.html') &&
        !window.location.pathname.includes('admins.html')) return;

    const adminsListEl = document.getElementById('adminsList');
    const searchInput = document.getElementById('adminSearch');
    const countEl = document.getElementById('adminCount');
    const registerForm = document.getElementById('registerForm');
    const registerError = document.getElementById('registerError');

    if (!adminsListEl) return;

    let allRows = [];
    const currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
    const myCreatorId = currentUser.created_by || null;
    const myId = currentUser.id || null;

    // Update admin count display
    function updateCount(visible, total) {
        if (!countEl) return;
        countEl.textContent = visible === total
            ? `${total} admin${total !== 1 ? 's' : ''}`
            : `${visible} of ${total} admin${total !== 1 ? 's' : ''}`;
    }

    // Filter table rows by search query
    function applySearch(query) {
        const q = query.trim().toLowerCase();
        let visible = 0;
        allRows.forEach(({ tr, name, email }) => {
            const match = !q || name.includes(q) || email.includes(q);
            tr.style.display = match ? '' : 'none';
            if (match) visible++;
        });

        let noResultRow = adminsListEl.querySelector('.no-results-row');
        if (visible === 0 && allRows.length > 0) {
            if (!noResultRow) {
                noResultRow = document.createElement('tr');
                noResultRow.className = 'no-results-row';
                noResultRow.innerHTML = `<td colspan="6" class="px-6 py-8 text-center text-gray-400">No administrators match your search.</td>`;
                adminsListEl.appendChild(noResultRow);
            }
        } else {
            noResultRow?.remove();
        }

        updateCount(visible, allRows.length);
    }

    searchInput?.addEventListener('input', (e) => applySearch(e.target.value));

    // Fetch and render all admins
    async function loadAdmins() {
        try {
            adminsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500"><span class="loader align-middle mr-2"></span>Loading administrators...</td></tr>`;
            allRows = [];

            const response = await fetch('../api/admin/admins.php', {
                headers: getAdminAuthHeader()
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to load administrators');
            }

            const admins = await response.json();
            adminsListEl.innerHTML = '';

            if (!admins || admins.length === 0) {
                adminsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No administrators registered yet.</td></tr>`;
                updateCount(0, 0);
                return;
            }

            admins.forEach((admin) => {
                const name = admin.name || 'N/A';
                const email = admin.email || 'N/A';
                const creator = admin.creator_name || 'System / Seed';
                const isActive = admin.is_active;
                const createdAt = admin.created_at
                    ? new Date(admin.created_at).toLocaleDateString()
                    : 'N/A';

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 border-b border-gray-100 transition-colors';

                const isCreator = (myCreatorId && admin.id === myCreatorId);
                const isMyself = (myId && admin.id === myId);
                const isCreatedByMe = admin.created_by === myId;

                // Disable actions if they are the creator of the logged in user
                // Disable deactivating/deleting self too
                const actionDisabled = isCreator || isMyself;
                const tooltipText = isCreator 
                    ? 'Protected: This administrator registered you' 
                    : (isMyself ? 'Self account actions disabled' : '');

                const statusBtnColor = isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100';
                const statusBtnText = isActive ? 'Deactivate' : 'Activate';

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                ${name[0].toUpperCase()}
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-semibold text-gray-900">${name}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${creator}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${isActive ? 'Active' : 'Deactivated'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdAt}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        ${actionDisabled 
                            ? `<span class="text-xs text-gray-400 italic mr-2" title="${tooltipText}">${tooltipText || 'Protected'}</span>` 
                            : `
                                ${isCreatedByMe ? `<button type="button" class="change-pw-btn text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors mr-2" onclick="showChangePasswordModal('${admin.id}', '${name}')">Password</button>` : ''}
                                <button type="button" class="status-btn ${statusBtnColor} px-3 py-1.5 rounded-lg transition-colors mr-2" data-id="${admin.id}" data-active="${isActive ? 0 : 1}" data-name="${name}">${statusBtnText}</button>
                                <button type="button" class="delete-btn text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-lg transition-colors" data-id="${admin.id}" data-name="${name}">Delete</button>
                            `
                        }
                    </td>
                `;

                adminsListEl.appendChild(tr);

                allRows.push({
                    tr,
                    name: name.toLowerCase(),
                    email: email.toLowerCase()
                });
            });

            updateCount(allRows.length, allRows.length);
            if (searchInput?.value) applySearch(searchInput.value);

        } catch (error) {
            console.error("Error loading administrators:", error);
            adminsListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Failed to load administrators: ${error.message}</td></tr>`;
        }
     }

    // Handle actions click
    adminsListEl.addEventListener('click', async (e) => {
        // Toggle Active status
        if (e.target.classList.contains('status-btn')) {
            const id = e.target.getAttribute('data-id');
            const name = e.target.getAttribute('data-name');
            const nextActive = parseInt(e.target.getAttribute('data-active'));
            const actionText = nextActive === 1 ? 'activate' : 'deactivate';

            if (confirm(`Are you sure you want to ${actionText} administrator ${name}?`)) {
                try {
                    const response = await fetch('../api/admin/admins.php', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAdminAuthHeader()
                        },
                        body: JSON.stringify({ id, is_active: nextActive })
                    });
                    if (response.ok) {
                        loadAdmins();
                    } else {
                        const err = await response.json();
                        alert(err.message || `Failed to ${actionText} administrator.`);
                    }
                } catch (error) {
                    console.error("Status change error:", error);
                    alert("Network error. Could not toggle administrator status.");
                }
            }
        }

        // Delete Admin
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.getAttribute('data-id');
            const name = e.target.getAttribute('data-name');
            if (confirm(`Are you sure you want to permanently delete administrator ${name}? This action is irreversible.`)) {
                try {
                    const response = await fetch(`../api/admin/admins.php?id=${id}`, {
                        method: 'DELETE',
                        headers: getAdminAuthHeader()
                    });
                    if (response.ok) {
                        loadAdmins();
                    } else {
                        const err = await response.json();
                        alert(err.message || "Failed to delete administrator.");
                    }
                } catch (error) {
                    console.error("Delete admin error:", error);
                    alert("Network error. Could not delete administrator.");
                }
            }
        }
    });

    // Handle Register Submit
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.classList.add('hidden');

        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        try {
            const response = await fetch('../api/admin/admins.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeader()
                },
                body: JSON.stringify({ name, email, password })
            });

            if (response.ok) {
                window.hideRegisterModal();
                loadAdmins();
            } else {
                const err = await response.json();
                registerError.textContent = err.message || "Failed to register administrator.";
                registerError.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Register admin error:", error);
            registerError.textContent = "Network error. Could not connect to the API.";
            registerError.classList.remove('hidden');
        }
    });

    // Handle Change Password Submit
    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordError = document.getElementById('changePasswordError');

    changePasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        changePasswordError.classList.add('hidden');

        const id = document.getElementById('changePasswordAdminId').value;
        const password = document.getElementById('newAdminPassword').value;

        // Perform password validation (minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, and 1 numeric digit)
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            changePasswordError.textContent = "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.";
            changePasswordError.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('../api/admin/admins.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeader()
                },
                body: JSON.stringify({ action: 'change_password', id, password })
            });

            if (response.ok) {
                window.hideChangePasswordModal();
                alert("Password changed successfully.");
                loadAdmins();
            } else {
                const err = await response.json();
                changePasswordError.textContent = err.message || "Failed to update administrator password.";
                changePasswordError.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Change password error:", error);
            changePasswordError.textContent = "Network error. Could not connect to the API.";
            changePasswordError.classList.remove('hidden');
        }
    });

    // Initial load
    await loadAdmins();
});
