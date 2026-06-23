import { getAdminAuthHeader } from './auth.js';

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
        // Fetch unique categories dynamically from the public courses endpoint
        const response = await fetch('../api/courses/index.php', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeader()
            }
        });
        
        categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';

        if (response.ok) {
            const courses = await response.json();
            const categories = [...new Set(courses.map(c => c.category).filter(Boolean))];
            
            categories.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                categorySelect.appendChild(option);
            });
        }
        
        // Add default options if no categories found
        const existingCount = categorySelect.options.length;
        if (existingCount <= 1) {
            const defaults = ['Theology', 'Ministry', 'Leadership', 'History'];
            defaults.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                categorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error loading categories for form:", error);
    }
}

async function loadCoursesList() {
    const coursesListEl = document.getElementById('coursesList');
    if (!coursesListEl) return;

    try {
        coursesListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center"><span class="loader align-middle mx-auto"></span><p class="mt-2 text-sm text-gray-500">Loading courses...</p></td></tr>`;
        
        // Fetch courses list from the secure API
        const response = await fetch('../api/courses/index.php', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeader()
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const courses = await response.json();
        coursesListEl.innerHTML = ''; // clear loader

        if (courses.length === 0) {
            coursesListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">No courses available. Click "Create Course" to add one.</td></tr>`;
            return;
        }

        courses.forEach((course) => {
            const initials = course.title ? course.title.substring(0, 2).toUpperCase() : 'CO';
            
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors group';
            
            // Adjust image relative path if necessary
            let imageUrl = course.thumbnailUrl;
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('..')) {
                imageUrl = '../' + imageUrl;
            }

            tr.innerHTML = `
                <td class="px-6 py-4 border-b border-gray-100 flex items-center justify-center">
                    <input type="checkbox" class="rounded text-indigo-600 focus:ring-indigo-500 mt-2">
                </td>
                <td class="px-6 py-4 border-b border-gray-100">
                    <div class="flex items-center">
                        <div class="h-12 w-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative group-hover:shadow-md transition-shadow">
                            ${imageUrl 
                                ? `<img src="${imageUrl}" alt="Course" class="h-full w-full object-cover">` 
                                : `<span class="material-icons text-gray-500 text-2xl">image</span>`
                            }
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-bold text-gray-900">${course.title || 'Untitled'}</div>
                            <div class="text-xs text-gray-500 mt-0.5">ID: ${course.id.substring(0, 8)}... • ${course.totalLessons || 0} Modules</div>
                        </div>
                    </div>
                </td>

                <td class="px-6 py-4 border-b border-gray-100">
                    <div class="text-sm text-gray-900 font-medium">${course.category || 'General'}</div>
                    <div class="text-xs text-gray-500 mt-0.5">${course.duration || 'Self-paced'}</div>
                </td>
                <td class="px-6 py-4 border-b border-gray-100">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span> Published
                    </span>
                </td>
                <td class="px-6 py-4 text-right text-sm font-medium border-b border-gray-100">
                    <div class="flex items-center justify-end space-x-2">
                        <a href="lessons.html?courseId=${course.id}" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-lg transition-colors tooltip" title="Manage Lessons">
                            <span class="material-icons text-xl">view_list</span>
                        </a>
                        <button class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-lg transition-colors tooltip" onclick="window.location.href='edit_course.html?id=${course.id}'" title="Edit Course">
                            <span class="material-icons text-xl">edit</span>
                        </button>
                        <button class="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-lg transition-colors tooltip delete-btn" data-id="${course.id}" title="Delete">
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
                if (confirm("Are you sure you want to delete this course? This will delete all modules and lessons under it!")) {
                    try {
                        const deleteResponse = await fetch(`../api/admin/courses.php?id=${id}`, {
                            method: 'DELETE',
                            headers: getAdminAuthHeader()
                        });

                        if (deleteResponse.ok) {
                            alert("Course deleted successfully!");
                            loadCoursesList(); // reload
                        } else {
                            const errData = await deleteResponse.json();
                            alert("Failed to delete: " + (errData.message || "Unknown error"));
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Network connection error. Failed to delete course.");
                    }
                }
            });
        });

    } catch (error) {
        console.error("Error loading courses:", error);
        coursesListEl.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Failed to load courses. Check administrative permissions.</td></tr>`;
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

/**
 * Uploads a file to the PHP backend upload API and returns the server URL
 */
async function uploadThumbnailFile() {
    if (!selectedFile) return "";

    const formData = new FormData();
    formData.append('file', selectedFile);

    const response = await fetch('../api/admin/upload.php', {
        method: 'POST',
        headers: getAdminAuthHeader(), // Pass admin token (without Content-Type so browser sets correct boundary)
        body: formData
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to upload image file to server.");
    }

    const data = await response.json();
    return data.url; // Returns relative path, e.g., "../uploads/filename.jpg"
}

function setupAddCourseForm() {
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
        const price = parseFloat(document.getElementById('coursePrice').value) || 0;
        const currency = document.getElementById('courseCurrency').value;
        const isFeatured = document.getElementById('isFeatured').checked;
        const hasQuizzes = document.getElementById('hasQuizzes').checked;

        try {
            let thumbnailUrl = "";

            // Upload thumbnail to local PHP server if selected
            if (selectedFile) {
                thumbnailUrl = await uploadThumbnailFile();
            }

            // Post course details to admin courses endpoint
            const response = await fetch('../api/admin/courses.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeader()
                },
                body: JSON.stringify({
                    action: 'create',
                    title,
                    description,
                    category,
                    duration,
                    rating,
                    price,
                    currency,
                    isFeatured,
                    hasQuizzes,
                    thumbnailUrl
                })
            });

            if (response.ok) {
                alert('Course saved successfully!');
                window.location.href = 'courses.html'; 
            } else {
                const errData = await response.json();
                alert("Failed to save: " + (errData.message || "Unknown error"));
                submitBtn.innerHTML = ogText;
                submitBtn.disabled = false;
                if(publishBtn) publishBtn.disabled = false;
            }

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
        const response = await fetch(`../api/courses/index.php?id=${courseId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeader()
            }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('courseId').value = courseId;
            document.getElementById('courseTitle').value = data.title || '';
            document.getElementById('courseDescription').value = data.description || '';
            
            // Handle category pre-selection
            const catSelect = document.getElementById('courseCategory');
            if (data.category) {
                // Check if option exists in dropdown, if not create it
                if (!Array.from(catSelect.options).some(o => o.value === data.category)) {
                    const opt = document.createElement('option');
                    opt.value = data.category;
                    opt.textContent = data.category;
                    catSelect.appendChild(opt);
                }
                catSelect.value = data.category;
            }

            document.getElementById('courseDuration').value = data.duration || '';
            document.getElementById('courseRating').value = data.rating || 0;
            document.getElementById('coursePrice').value = data.price || 0.00;
            document.getElementById('courseCurrency').value = data.currency || 'USD';
            document.getElementById('isFeatured').checked = data.isFeatured || false;
            document.getElementById('hasQuizzes').checked = data.hasQuizzes !== false;
            
            if (data.thumbnailUrl) {
                let imageUrl = data.thumbnailUrl;
                if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('..')) {
                    imageUrl = '../' + imageUrl;
                }
                document.getElementById('existingThumbnailUrl').value = data.thumbnailUrl;
                document.getElementById('thumbnailPreview').src = imageUrl;
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

        const title = document.getElementById('courseTitle').value;
        const description = document.getElementById('courseDescription').value;
        const category = document.getElementById('courseCategory').value;
        const duration = document.getElementById('courseDuration').value;
        const rating = parseFloat(document.getElementById('courseRating').value) || 0;
        const price = parseFloat(document.getElementById('coursePrice').value) || 0;
        const currency = document.getElementById('courseCurrency').value;
        const isFeatured = document.getElementById('isFeatured').checked;
        const hasQuizzes = document.getElementById('hasQuizzes').checked;
        const existingThumbnailUrl = document.getElementById('existingThumbnailUrl').value;

        try {
            let thumbnailUrl = existingThumbnailUrl;

            // Upload a new thumbnail file if selected
            if (selectedFile) {
                thumbnailUrl = await uploadThumbnailFile();
            }

            // Post course update details
            const response = await fetch('../api/admin/courses.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeader()
                },
                body: JSON.stringify({
                    action: 'update',
                    id,
                    title,
                    description,
                    category,
                    duration,
                    rating,
                    price,
                    currency,
                    isFeatured,
                    hasQuizzes,
                    thumbnailUrl
                })
            });

            if (response.ok) {
                alert('Course updated successfully!');
                window.location.href = 'courses.html';
            } else {
                const errData = await response.json();
                alert("Failed to update: " + (errData.message || "Unknown error"));
                submitBtn.innerHTML = 'Update Course';
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error("Error updating course:", error);
            alert("Error: " + error.message);
            submitBtn.innerHTML = 'Update Course';
            submitBtn.disabled = false;
        }
    });
}
