import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
        const name = document.getElementById('categoryName').value;
        const icon = document.getElementById('categoryIcon').value;

        try {
            if (id) {
                // Update
                await updateDoc(doc(db, "categories", id), {
                    name,
                    icon,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Add
                await addDoc(collection(db, "categories"), {
                    name,
                    icon,
                    updatedAt: serverTimestamp()
                });
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
        const snapshot = await getDocs(collection(db, "categories"));
        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">No categories found.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 border-b border-gray-100">
                    <div class="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined">${data.icon || 'category'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 border-b border-gray-100 font-bold">${data.name}</td>
                <td class="px-6 py-4 border-b border-gray-100 text-xs text-gray-500">
                    ${data.updatedAt ? new Date(data.updatedAt.seconds * 1000).toLocaleDateString() : 'New'}
                </td>
                <td class="px-6 py-4 border-b border-gray-100 text-right">
                    <button class="text-indigo-600 mr-3 edit-btn" data-id="${id}" data-name="${data.name}" data-icon="${data.icon}">Edit</button>
                    <button class="text-red-500 delete-btn" data-id="${id}">Delete</button>
                </td>
            `;
            listEl.appendChild(tr);
        });

        // Event listeners
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

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Are you sure?')) {
                    await deleteDoc(doc(db, "categories", btn.dataset.id));
                    loadCategories();
                }
            };
        });

    } catch (error) {
        console.error("Error loading categories:", error);
    }
}
