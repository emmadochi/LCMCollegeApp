import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();

    const categoryForm = document.getElementById('categoryForm');
    const categoryIconInput = document.getElementById('categoryIcon');
    const iconPreview = document.getElementById('iconPreview');

    // Live preview
    categoryIconInput.addEventListener('input', (e) => {
        iconPreview.textContent = e.target.value.trim() || 'category';
    });
    
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('categoryId').value;
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value.trim();

        try {
            const payload = { name, icon };
            if (id) {
                payload.id = id;
            }

            const response = await fetch('../api/categories/index.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeader()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || "Failed to save category");
            }

            hideModal();
            loadCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            alert("Error: " + error.message);
        }
    });
});

async function loadCategories() {
    const listEl = document.getElementById('categoriesList');
    if (!listEl) return;

    try {
        const response = await fetch('../api/categories/index.php');
        if (!response.ok) throw new Error("Failed to load categories");
        
        const categories = await response.json();
        listEl.innerHTML = '';

        if (categories.length === 0) {
            listEl.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">No categories found.</td></tr>';
            return;
        }

        categories.forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 border-b border-gray-100">
                    <div class="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined">${cat.icon || 'category'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 border-b border-gray-100 font-bold">${cat.name}</td>
                <td class="px-6 py-4 border-b border-gray-100 text-xs text-gray-500">
                    Active
                </td>
                <td class="px-6 py-4 border-b border-gray-100 text-right">
                    <button class="text-indigo-600 mr-3 edit-btn" data-id="${cat.id}" data-name="${cat.name}" data-icon="${cat.icon}">Edit</button>
                    <button class="text-red-500 delete-btn" data-id="${cat.id}">Delete</button>
                </td>
            `;
            listEl.appendChild(tr);
        });

        // Event listeners for edit button
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = () => {
                document.getElementById('modalTitle').innerText = 'Edit Category';
                document.getElementById('categoryId').value = btn.dataset.id;
                document.getElementById('categoryName').value = btn.dataset.name;
                document.getElementById('categoryIcon').value = btn.dataset.icon;
                document.getElementById('iconPreview').textContent = btn.dataset.icon || 'category';
                document.getElementById('categoryModal').classList.remove('hidden');
            };
        });

        // Event listeners for delete button
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Are you sure you want to delete this category?')) {
                    try {
                        const response = await fetch(`../api/categories/index.php?id=${btn.dataset.id}`, {
                            method: 'DELETE',
                            headers: getAdminAuthHeader()
                        });
                        
                        if (!response.ok) {
                            const errData = await response.json();
                            throw new Error(errData.message || "Failed to delete category");
                        }
                        
                        loadCategories();
                    } catch (err) {
                        alert("Error: " + err.message);
                    }
                }
            };
        });

    } catch (error) {
        console.error("Error loading categories:", error);
    }
}

// Global modal helper fallback matching original modal controls
function hideModal() {
    document.getElementById('categoryModal').classList.add('hidden');
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('iconPreview').textContent = 'category';
}
window.hideModal = hideModal;
