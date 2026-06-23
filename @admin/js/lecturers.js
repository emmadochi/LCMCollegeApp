import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.endsWith('lecturers.html') &&
        !window.location.pathname.includes('lecturers.html')) return;

    const lecturersListEl = document.getElementById('lecturersList');
    const searchInput = document.getElementById('lecturerSearch');
    const countEl = document.getElementById('lecturerCount');
    const registerForm = document.getElementById('registerForm');
    const registerError = document.getElementById('registerError');
    const assignForm = document.getElementById('assignForm');
    const assignError = document.getElementById('assignError');
    const assignCourseSelect = document.getElementById('assignCourseSelect');

    if (!lecturersListEl) return;

    let allRows = [];
    let coursesList = [];

    // Update lecturer count display
    function updateCount(visible, total) {
        if (!countEl) return;
        countEl.textContent = visible === total
            ? `${total} lecturer${total !== 1 ? 's' : ''}`
            : `${visible} of ${total} lecturer${total !== 1 ? 's' : ''}`;
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

        let noResultRow = lecturersListEl.querySelector('.no-results-row');
        if (visible === 0 && allRows.length > 0) {
            if (!noResultRow) {
                noResultRow = document.createElement('tr');
                noResultRow.className = 'no-results-row';
                noResultRow.innerHTML = `<td colspan="5" class="px-6 py-8 text-center text-gray-400">No lecturers match your search.</td>`;
                lecturersListEl.appendChild(noResultRow);
            }
        } else {
            noResultRow?.remove();
        }

        updateCount(visible, allRows.length);
    }

    searchInput?.addEventListener('input', (e) => applySearch(e.target.value));

    // Fetch and populate course dropdown list
    async function loadCourses() {
        try {
            const response = await fetch('../api/courses/index.php');
            if (response.ok) {
                coursesList = await response.json();
                assignCourseSelect.innerHTML = '<option value="">Choose a course...</option>';
                coursesList.forEach(course => {
                    const opt = document.createElement('option');
                    opt.value = course.id;
                    opt.textContent = course.title;
                    assignCourseSelect.appendChild(opt);
                });
            }
        } catch (error) {
            console.error("Failed to load courses for assignments:", error);
        }
    }

    // Fetch and render all lecturers
    async function loadLecturers() {
        try {
            lecturersListEl.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500"><span class="loader align-middle mr-2"></span>Loading lecturers...</td></tr>`;
            allRows = [];

            const response = await fetch('../api/admin/lecturers.php', {
                headers: getAdminAuthHeader()
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to load lecturers');
            }

            const lecturers = await response.json();
            lecturersListEl.innerHTML = '';

            if (!lecturers || lecturers.length === 0) {
                lecturersListEl.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No lecturers registered yet.</td></tr>`;
                updateCount(0, 0);
                return;
            }

            lecturers.forEach((lecturer) => {
                const name = lecturer.name || 'N/A';
                const email = lecturer.email || 'N/A';
                const createdAt = lecturer.created_at
                    ? new Date(lecturer.created_at).toLocaleDateString()
                    : 'N/A';

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 border-b border-gray-100 transition-colors';

                // Render assignments list inside table cell
                let assignmentsHtml = '';
                if (lecturer.assignments && lecturer.assignments.length > 0) {
                    assignmentsHtml = lecturer.assignments.map(a => {
                        let label = 'Assigned';
                        if (a.assignment_mode === 'global_course') {
                            label = `${a.course_title || 'Course'}`;
                        } else if (a.assignment_mode === 'student_course') {
                            label = `${a.student_name || 'Student'} (${a.course_title || 'Course'})`;
                        } else if (a.assignment_mode === 'lesson') {
                            label = `Lesson: ${a.lesson_title || 'Lesson'}`;
                        } else if (a.assignment_mode === 'global_student') {
                            label = `Student: ${a.student_name || 'Student'}`;
                        }
                        return `
                            <span class="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium border border-indigo-100">
                                ${label}
                                <button type="button" class="remove-assign-btn hover:text-red-600 transition-colors ml-1 font-bold" data-id="${a.id}" title="Remove assignment">×</button>
                            </span>
                        `;
                    }).join(' ');
                } else {
                    assignmentsHtml = `<span class="text-xs text-gray-400 italic">No courses assigned</span>`;
                }

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
                    <td class="px-6 py-4 text-sm text-gray-500">
                        <div class="flex flex-wrap gap-1.5 max-w-md">
                            ${assignmentsHtml}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdAt}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" class="assign-btn text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors mr-2" data-id="${lecturer.id}" data-name="${name}">Assign Student</button>
                        <button type="button" class="delete-lecturer-btn text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-lg transition-colors" data-id="${lecturer.id}" data-name="${name}">Delete</button>
                    </td>
                `;

                lecturersListEl.appendChild(tr);

                allRows.push({
                    tr,
                    name: name.toLowerCase(),
                    email: email.toLowerCase()
                });
            });

            updateCount(allRows.length, allRows.length);
            if (searchInput?.value) applySearch(searchInput.value);

        } catch (error) {
            console.error("Error loading lecturers:", error);
            lecturersListEl.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Failed to load lecturers: ${error.message}</td></tr>`;
        }
    }

    // Handle delete assignment click
    lecturersListEl.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-assign-btn')) {
            const assignmentId = e.target.getAttribute('data-id');
            if (confirm("Are you sure you want to remove this lecturer assignment?")) {
                try {
                    const response = await fetch(`../api/admin/lecturers.php?assignment_id=${assignmentId}`, {
                        method: 'DELETE',
                        headers: getAdminAuthHeader()
                    });
                    if (response.ok) {
                        loadLecturers();
                    } else {
                        const err = await response.json();
                        alert(err.message || "Failed to remove assignment.");
                    }
                } catch (error) {
                    console.error("Failed to remove assignment:", error);
                    alert("Network error. Could not remove assignment.");
                }
            }
        }

        // Handle Assign Course click
        if (e.target.classList.contains('assign-btn')) {
            const id = e.target.getAttribute('data-id');
            const name = e.target.getAttribute('data-name');
            window.showAssignModal(id, name);
        }

        // Handle Delete Lecturer click
        if (e.target.classList.contains('delete-lecturer-btn')) {
            const id = e.target.getAttribute('data-id');
            const name = e.target.getAttribute('data-name');
            if (confirm(`Are you sure you want to delete lecturer ${name}? This will also delete all their course assignments.`)) {
                try {
                    const response = await fetch(`../api/admin/lecturers.php?id=${id}`, {
                        method: 'DELETE',
                        headers: getAdminAuthHeader()
                    });
                    if (response.ok) {
                        loadLecturers();
                    } else {
                        const err = await response.json();
                        alert(err.message || "Failed to delete lecturer.");
                    }
                } catch (error) {
                    console.error("Failed to delete lecturer:", error);
                    alert("Network error. Could not delete lecturer.");
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
            const response = await fetch('../api/admin/lecturers.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeader()
                },
                body: JSON.stringify({ name, email, password })
            });

            if (response.ok) {
                window.hideRegisterModal();
                loadLecturers();
            } else {
                const err = await response.json();
                registerError.textContent = err.message || "Failed to register lecturer.";
                registerError.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Register lecturer error:", error);
            registerError.textContent = "Network error. Could not connect to the API.";
            registerError.classList.remove('hidden');
        }
    });

    // Handle course selection change to dynamically load enrolled students
    const assignStudentSelect = document.getElementById('assignStudentSelect');
    assignCourseSelect?.addEventListener('change', async () => {
        const courseId = assignCourseSelect.value;
        if (!courseId) {
            assignStudentSelect.innerHTML = '<option value="">Choose a course first...</option>';
            assignStudentSelect.disabled = true;
            return;
        }

        try {
            assignStudentSelect.innerHTML = '<option value="">Loading students...</option>';
            assignStudentSelect.disabled = true;

            const response = await fetch(`../api/admin/students.php?course_id=${courseId}`, {
                headers: getAdminAuthHeader()
            });

            if (response.ok) {
                const students = await response.json();
                if (students.length === 0) {
                    assignStudentSelect.innerHTML = '<option value="">No students enrolled in this course</option>';
                } else {
                    assignStudentSelect.innerHTML = '<option value="">Choose a student...</option>';
                    students.forEach(student => {
                        const opt = document.createElement('option');
                        opt.value = student.id;
                        opt.textContent = student.name;
                        assignStudentSelect.appendChild(opt);
                    });
                    assignStudentSelect.disabled = false;
                }
            } else {
                assignStudentSelect.innerHTML = '<option value="">Failed to load students</option>';
            }
        } catch (error) {
            console.error("Failed to load students for course:", error);
            assignStudentSelect.innerHTML = '<option value="">Error loading students</option>';
        }
    });

    // Handle Assign Submit
    assignForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        assignError.classList.add('hidden');

        const lecturerId = document.getElementById('assignLecturerId').value;
        const courseId = assignCourseSelect.value;
        const studentId = assignStudentSelect.value;

        try {
            const response = await fetch('../api/admin/lecturers.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeader()
                },
                body: JSON.stringify({
                    lecturerId,
                    courseId,
                    studentId,
                    assignmentMode: 'student_course'
                })
            });

            if (response.ok) {
                window.hideAssignModal();
                loadLecturers();
            } else {
                const err = await response.json();
                assignError.textContent = err.message || "Failed to assign student.";
                assignError.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Assign student error:", error);
            assignError.textContent = "Network error. Could not connect to the API.";
            assignError.classList.remove('hidden');
        }
    });

    // Initial load
    await loadCourses();
    await loadLecturers();
});
