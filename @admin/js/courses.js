import { db, storage } from './firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let selectedFile = null;

document.addEventListener('DOMContentLoaded', async () => {
    const currentPath = window.location.pathname;

    // --- LIST COURSES (courses.html or /courses) ---
    if (currentPath.includes('courses')) {
        await loadCoursesList();
    }

    // --- ADD COURSE (add_course.html or /add_course) ---
    if (currentPath.includes('add_course')) {
        setupAddCourseForm();
        setupThumbnailUpload();
        await loadCategoriesForForm();
    }

    // --- EDIT COURSE (edit_course.html) ---
    if (currentPath.includes('edit_course')) {
        setupThumbnailUpload();
        await loadCategoriesForForm();
        await loadCourseDataForEdit();
        setupEditCourseForm();
    }
});

async function loadCategoriesForForm() {
    const categorySelect = document.getElementById('courseCategory');
    if (!categorySelect) return;

    try {
        const snapshot = await getDocs(collection(db, "categories"));
        if (snapshot.empty) {
            categorySelect.innerHTML = '<option value="">No categories found</option>';
            return;
        }

        categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement('option');
            option.value = data.name;
            option.textContent = data.name;
            categorySelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading categories for form:", error);
    }
}

async function loadCoursesList() {
    const coursesListEl = document.getElementById('coursesList');
    if (!coursesListEl) return;

    try {
        coursesListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center"><span class="loader align-middle mx-auto"></span><p class="mt-2 text-sm text-gray-500">Loading courses...</p></td></tr>`;
        
        const coursesSnapshot = await getDocs(collection(db, "courses"));
        coursesListEl.innerHTML = ''; // clear loading loader

        if (coursesSnapshot.empty) {
            coursesListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">No courses available. Click "Create Course" to add one.</td></tr>`;
            return;
        }

        coursesSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const initials = data.title ? data.title.substring(0, 2).toUpperCase() : 'CO';
            
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors group';
            tr.innerHTML = `
                <td class="px-6 py-4 border-b border-gray-100 flex items-center justify-center">
                    <input type="checkbox" class="rounded text-indigo-600 focus:ring-indigo-500 mt-2">
                </td>
                <td class="px-6 py-4 border-b border-gray-100">
                    <div class="flex items-center">
                        <div class="h-12 w-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative group-hover:shadow-md transition-shadow">
                            ${data.thumbnailUrl 
                                ? `<img src="${data.thumbnailUrl}" alt="Course" class="h-full w-full object-cover">` 
                                : `<span class="material-icons text-gray-500 text-2xl">image</span>`
                            }
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-bold text-gray-900">${data.title || 'Untitled'}</div>
                            <div class="text-xs text-gray-500 mt-0.5">ID: ${id.substring(0, 8)}... • ${data.totalLessons || 0} Modules</div>
                        </div>
                    </div>
                </td>

                <td class="px-6 py-4 border-b border-gray-100">
                    <div class="text-sm text-gray-900 font-medium">0 Enrolled</div>
                    <div class="text-xs text-gray-500 mt-0.5">Active Track</div>
                </td>
                <td class="px-6 py-4 border-b border-gray-100">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span> Published
                    </span>
                </td>
                <td class="px-6 py-4 text-right text-sm font-medium border-b border-gray-100">
                    <div class="flex items-center justify-end space-x-2">
                        <a href="lessons.html?courseId=${id}" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-lg transition-colors tooltip" title="Manage Lessons">
                            <span class="material-icons text-xl">view_list</span>
                        </a>
                        <button class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-lg transition-colors tooltip" onclick="window.location.href='edit_course.html?id=${id}'" title="Edit Course">
                            <span class="material-icons text-xl">edit</span>
                        </button>
                        <button class="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-lg transition-colors tooltip delete-btn" data-id="${id}" title="Delete">
                            <span class="material-icons text-xl">delete_outline</span>
                        </button>
                    </div>
                </td>
            `;
            coursesListEl.appendChild(tr);
        });

        // Add Delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this course?")) {
                    await deleteDoc(doc(db, "courses", id));
                    loadCoursesList(); // reload
                }
            });
        });

    } catch (error) {
        console.error("Error loading courses:", error);
        coursesListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Failed to load courses. Check console permissions.</td></tr>`;
    }
}

function setupThumbnailUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const previewContainer = document.getElementById('previewContainer');
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    const removeThumbnail = document.getElementById('removeThumbnail');

    if (!dropZone || !fileInput) return;

    // Handle click on dropZone to trigger file input
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('#removeThumbnail')) return;
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileSelect(e.target.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove('active');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    removeThumbnail.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        fileInput.value = '';
        thumbnailPreview.src = '';
        previewContainer.style.display = 'none';
        uploadPrompt.style.display = 'block';
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, or GIF).');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB.');
            return;
        }

        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            thumbnailPreview.src = e.target.result;
            uploadPrompt.style.display = 'none';
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function setupAddCourseForm() {
    const courseForm = document.getElementById('courseForm');
    const publishBtn = document.getElementById('publishBtn');
    
    // Header button triggers form submit
    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
             courseForm.dispatchEvent(new Event('submit'));
        });
    }

    if (!courseForm) return;

    courseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Disable buttons
        const submitBtn = courseForm.querySelector('button[type="submit"]');
        const ogText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Uploading & Saving...';
        submitBtn.disabled = true;
        if(publishBtn) publishBtn.disabled = true;

        const title = document.getElementById('courseTitle').value;
        const description = document.getElementById('courseDescription').value;
        const category = document.getElementById('courseCategory').value;
        const duration = document.getElementById('courseDuration').value;
        const rating = parseFloat(document.getElementById('courseRating').value) || 0;
        const isFeatured = document.getElementById('isFeatured').checked;
        const hasQuizzes = document.getElementById('hasQuizzes').checked;

        try {
            let thumbnailUrl = "";

            // Upload thumbnail if selected
            if (selectedFile) {
                const storageRef = ref(storage, `course_thumbnails/${Date.now()}_${selectedFile.name}`);
                const snapshot = await uploadBytes(storageRef, selectedFile);
                thumbnailUrl = await getDownloadURL(snapshot.ref);
            }

            await addDoc(collection(db, "courses"), {
                title: title,
                description: description,
                category: category,
                duration: duration,
                rating: rating,
                isFeatured: isFeatured,
                hasQuizzes: hasQuizzes,
                totalLessons: 0,
                thumbnailUrl: thumbnailUrl,
                createdAt: serverTimestamp()
            });

            alert('Course saved successfully!');
            window.location.href = 'courses.html'; 

        } catch (error) {
            console.error("Error adding course: ", error);
            alert("Error adding course: " + error.message);
            
            submitBtn.innerHTML = ogText;
            submitBtn.disabled = false;
            if(publishBtn) publishBtn.disabled = false;
        }
    });
}

async function loadCourseDataForEdit() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    if (!courseId) return;

    try {
        const docSnap = await getDoc(doc(db, "courses", courseId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('courseId').value = courseId;
            document.getElementById('courseTitle').value = data.title || '';
            document.getElementById('courseDescription').value = data.description || '';
            document.getElementById('courseCategory').value = data.category || '';
            document.getElementById('courseDuration').value = data.duration || '';
            document.getElementById('courseRating').value = data.rating || 0;
            document.getElementById('isFeatured').checked = data.isFeatured || false;
            document.getElementById('hasQuizzes').checked = data.hasQuizzes !== false;
            
            if (data.thumbnailUrl) {
                document.getElementById('existingThumbnailUrl').value = data.thumbnailUrl;
                document.getElementById('thumbnailPreview').src = data.thumbnailUrl;
                document.getElementById('uploadPrompt').style.display = 'none';
                document.getElementById('previewContainer').style.display = 'block';
            }
        }
    } catch (error) {
        console.error("Error loading course data:", error);
    }
}

function setupEditCourseForm() {
    const courseForm = document.getElementById('courseForm');
    const publishBtn = document.getElementById('publishBtn');
    
    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
             courseForm.dispatchEvent(new Event('submit'));
        });
    }

    if (!courseForm) return;

    courseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('courseId').value;
        const submitBtn = courseForm.querySelector('button[type="submit"]');
        submitBtn.innerHTML = 'Updating...';
        submitBtn.disabled = true;

        const updates = {
            title: document.getElementById('courseTitle').value,
            description: document.getElementById('courseDescription').value,
            category: document.getElementById('courseCategory').value,
            duration: document.getElementById('courseDuration').value,
            rating: parseFloat(document.getElementById('courseRating').value) || 0,
            isFeatured: document.getElementById('isFeatured').checked,
            hasQuizzes: document.getElementById('hasQuizzes').checked,
            updatedAt: serverTimestamp()
        };

        try {
            if (selectedFile) {
                const storageRef = ref(storage, `course_thumbnails/${Date.now()}_${selectedFile.name}`);
                const snapshot = await uploadBytes(storageRef, selectedFile);
                updates.thumbnailUrl = await getDownloadURL(snapshot.ref);
            }

            await updateDoc(doc(db, "courses", id), updates);
            alert('Course updated successfully!');
            window.location.href = 'courses.html';
        } catch (error) {
            console.error("Error updating course:", error);
            alert("Error: " + error.message);
            submitBtn.innerHTML = 'Update Course';
            submitBtn.disabled = false;
        }
    });
}

export async function syncCourseSchema() {
    try {
        const querySnapshot = await getDocs(collection(db, "courses"));
        let updatedCount = 0;
        
        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            const updates = {};
            
            if (data.isFeatured === undefined) updates.isFeatured = false;
            if (data.rating === undefined) updates.rating = 4.8;
            if (data.duration === undefined) updates.duration = 'Self-paced';
            if (data.hasQuizzes === undefined) updates.hasQuizzes = true;
            if (data.category === undefined) updates.category = 'Tech';
            
            if (Object.keys(updates).length > 0) {
                const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                await updateDoc(doc(db, "courses", docSnap.id), updates);
                updatedCount++;
            }
        }
        
        alert(`Successfully synced ${updatedCount} courses with the new data schema.`);
        location.reload();
    } catch (error) {
        console.error("Error syncing schema: ", error);
        alert("Error syncing schema: " + error.message);
    }
}

// Make it globally available for the button
window.syncCourseSchema = syncCourseSchema;
