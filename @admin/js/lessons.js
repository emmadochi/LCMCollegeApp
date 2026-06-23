import { getAdminAuthHeader } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const currentPath = window.location.pathname;

    // --- LIST LESSONS (lessons.html or /lessons) ---
    if (currentPath.includes('lessons') && !currentPath.includes('add_lesson') && !currentPath.includes('edit_lesson')) {
        await loadCoursesDropdown();
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('courseId');
        if (courseId) {
            const courseSelect = document.getElementById('courseSelect');
            if (courseSelect) courseSelect.value = courseId;
            await loadLessons(courseId);
        } else {
            const courseSelect = document.getElementById('courseSelect');
            if (courseSelect) {
                await loadLessons(courseSelect.value);
            }
        }

        // Handle course change
        document.getElementById('courseSelect')?.addEventListener('change', (e) => {
            const id = e.target.value;
            loadLessons(id);
            // Update URL without reload
            const newUrl = id ? `${window.location.pathname}?courseId=${id}` : window.location.pathname;
            window.history.pushState({ path: newUrl }, '', newUrl);
        });
    }

    // --- ADD/EDIT LESSON ---
    if (currentPath.includes('add_lesson') || currentPath.includes('edit_lesson')) {
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('courseId');
        const lessonId = urlParams.get('lessonId');

        await loadCoursesDropdown();
        
        if (courseId) {
            const courseSelect = document.getElementById('courseSelect');
            if (courseSelect) {
                courseSelect.value = courseId;
                await loadModules(courseId);
            }
        }

        setupAddLessonForm();
        setupRichEditor();
    }
});

async function loadModules(courseId) {
    const moduleSelect = document.getElementById('moduleSelect');
    if (!moduleSelect) return;

    if (!courseId) {
        moduleSelect.innerHTML = '<option value="">Select a module</option>';
        return;
    }

    try {
        console.log(`[loadModules] Loading modules for course: ${courseId}`);
        moduleSelect.innerHTML = '<option value="">Select a module</option>';
        const modules = new Set();
        
        // Fetch unique module names from existing lessons in MySQL via PHP API
        const response = await fetch(`../api/lessons/index.php?course_id=${courseId}`, {
            headers: getAdminAuthHeader()
        });
        
        if (response.ok) {
            const lessons = await response.json();
            console.log(`[loadModules] Found ${lessons.length} lessons for course`);
            lessons.forEach(lesson => {
                if (lesson.module_id) {
                    modules.add(lesson.module_id);
                }
            });
        }

        modules.forEach(mod => {
            const option = document.createElement('option');
            option.value = mod;
            option.textContent = mod;
            moduleSelect.appendChild(option);
        });

        const newOption = document.createElement('option');
        newOption.value = 'new';
        newOption.textContent = '+ Add to a new module';
        moduleSelect.appendChild(newOption);
        console.log(`[loadModules] Populated ${modules.size} modules total`);

    } catch (error) {
        console.error("[loadModules] Error:", error);
        moduleSelect.innerHTML = '<option value="">Error loading modules</option>';
    }
}

async function loadCoursesDropdown() {
    const courseSelect = document.getElementById('courseSelect');
    if (!courseSelect) return;

    try {
        console.log("[loadCoursesDropdown] Fetching courses...");
        const response = await fetch('../api/courses/index.php');
        if (!response.ok) throw new Error("Failed to fetch courses from API");
        
        const courses = await response.json();
        console.log(`[loadCoursesDropdown] Found ${courses.length} courses`);
        const currentVal = courseSelect.value;
        courseSelect.innerHTML = '<option value="">Select a course</option>';

        courses.forEach((course) => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.title;
            courseSelect.appendChild(option);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const courseIdParam = urlParams.get('courseId');
        const finalVal = currentVal || courseIdParam;
        
        if (finalVal && Array.from(courseSelect.options).some(o => o.value === finalVal)) {
            courseSelect.value = finalVal;
        }
    } catch (error) {
        console.error("[loadCoursesDropdown] Error:", error);
        courseSelect.innerHTML = '<option value="">Error loading courses</option>';
    }
}

async function loadLessons(courseId) {
    const container = document.getElementById('lessonsContainer');
    if (!container) return;

    if (!courseId) {
        container.innerHTML = `
            <div class="adm-card" style="padding:48px;text-align:center;color:var(--text-muted);border:1px dashed var(--border);">
                <span class="material-icons text-gray-300 text-5xl mb-4" style="font-size:48px;color:#d1d5db;margin-bottom:16px;">history_edu</span>
                <h3 class="text-lg font-bold text-gray-900" style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px;">No Course Selected</h3>
                <p class="text-gray-500" style="font-size:13.5px;color:#6b7280;">Select a course from the dropdown above to manage its lessons.</p>
            </div>`;
        const titleEl = document.querySelector('.page-heading');
        if (titleEl) {
            titleEl.textContent = 'Curriculum Builder';
        }
        return;
    }

    try {
        console.log(`[loadLessons] Loading lessons for course: ${courseId}`);
        container.innerHTML = `<div class="p-8 text-center"><span class="loader"></span><p class="mt-2 text-sm text-gray-500">Loading curriculum...</p></div>`;
        
        const response = await fetch(`../api/lessons/index.php?course_id=${courseId}`, {
            headers: getAdminAuthHeader()
        });
        
        if (!response.ok) throw new Error("Failed to load lessons");
        const lessons = await response.json();
        
        console.log(`[loadLessons] Fetched ${lessons.length} lessons`);
        
        const titleEl = document.querySelector('.page-heading');
        if (titleEl && courseId) {
            const courseResponse = await fetch(`../api/courses/index.php?id=${courseId}`);
            if (courseResponse.ok) {
                const course = await courseResponse.json();
                titleEl.textContent = `Curriculum: ${course.title}`;
            }
        }

        container.innerHTML = '';

        if (lessons.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-xl p-12 text-center border border-dashed border-gray-300">
                    <span class="material-icons text-gray-300 text-5xl mb-4">history_edu</span>
                    <h3 class="text-lg font-bold text-gray-900">No lessons found</h3>
                    <p class="text-gray-500 mb-6">This course is currently empty. Start building the curriculum.</p>
                    <a href="add_lesson.html?courseId=${courseId}" class="btn-primary inline-flex">
                        <span class="material-icons text-sm">add</span> Add First Lesson
                    </a>
                </div>`;
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden';
        
        lessons.forEach((lesson) => {
            const li = document.createElement('li');
            li.className = 'px-6 py-4 flex items-center justify-between hover:bg-gray-50 group transition-colors';
            li.innerHTML = `
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mr-4">
                        <span class="material-icons text-lg">${lesson.videoSource === 'link' || lesson.videoSource === 'upload' ? 'play_circle' : 'article'}</span>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-gray-900">${lesson.order_index}. ${lesson.title}</h4>
                        <div class="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                            <span class="flex items-center capitalize"><span class="material-icons text-[12px] mr-1">category</span> ${lesson.module_id || 'No Module'}</span>
                            ${lesson.hasQuiz ? `<span class="flex items-center text-indigo-600 font-medium"><span class="material-icons text-[12px] mr-1">quiz</span> Quiz attached</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors manage-assignment" data-id="${lesson.id}" data-courseid="${courseId}" title="Assignments">
                        <span class="material-icons text-sm">assignment</span>
                    </button>
                    <button class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors edit-lesson" data-id="${lesson.id}" data-courseid="${courseId}">
                        <span class="material-icons text-sm">edit</span>
                    </button>
                    <button class="p-1.5 text-gray-400 hover:text-red-600 transition-colors delete-lesson" data-id="${lesson.id}">
                        <span class="material-icons text-sm">delete_outline</span>
                    </button>
                </div>
            `;
            ul.appendChild(li);
        });
        
        container.appendChild(ul);

        // Single listener for all clicks within container
        container.removeEventListener('click', handleCurriculumClick);
        container.addEventListener('click', handleCurriculumClick);

    } catch (error) {
        console.error("[loadLessons] Error:", error);
        container.innerHTML = `<p class="text-red-500 p-4">Error loading curriculum: ${error.message}</p>`;
    }
}

async function handleCurriculumClick(e) {
    const editBtn = e.target.closest('.edit-lesson');
    const deleteBtn = e.target.closest('.delete-lesson');

    if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const cid = editBtn.getAttribute('data-courseid');
        console.log(`[Edit Click] id=${id}, courseId=${cid}`);
        if (!id) {
            console.error("[Edit Click] Missing lesson ID!");
            return;
        }
        const url = `edit_lesson.html?lessonId=${id}&courseId=${cid}`;
        console.log(`[Edit Click] Redirecting to: ${url}`);
        window.location.href = url;
    }

    const assignmentBtn = e.target.closest('.manage-assignment');
    if (assignmentBtn) {
        const id = assignmentBtn.getAttribute('data-id');
        const cid = assignmentBtn.getAttribute('data-courseid');
        window.location.href = `add_assignment.html?lessonId=${id}&courseId=${cid}`;
    }

    if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (confirm("Permanently delete this lesson?")) {
            try {
                const response = await fetch(`../api/admin/lessons.php?id=${id}`, {
                    method: 'DELETE',
                    headers: getAdminAuthHeader()
                });
                
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || "Failed to delete lesson");
                }
                
                const courseId = document.getElementById('courseSelect')?.value;
                if (courseId) {
                    loadLessons(courseId);
                }
            } catch (err) {
                alert("Error deleting: " + err.message);
            }
        }
    }
}

function setupAddLessonForm() {
    const lessonForm = document.getElementById('lessonForm');
    const publishBtn = document.getElementById('publishBtn');
    
    if (!lessonForm) {
        // Handle lessons.html add module button
        const addModuleBtn = document.getElementById('addModuleBtn');
        if (addModuleBtn) {
            addModuleBtn.onclick = () => {
                const cSelect = document.getElementById('courseSelect');
                const courseId = cSelect?.value;
                if (!courseId || courseId === 'all') {
                    alert('Please select a course first');
                    return;
                }
                window.location.href = `add_lesson.html?courseId=${courseId}&newModule=true`;
            };
        }
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lessonId');
    const courseIdParam = urlParams.get('courseId');
    const isNewModuleRequest = urlParams.get('newModule') === 'true';

    const moduleSelect = document.getElementById('moduleSelect');
    const newModuleContainer = document.getElementById('newModuleContainer');
    const videoSourceRadios = document.querySelectorAll('input[name="videoSource"]');
    const uploadUI = document.getElementById('uploadUI');
    const externalURLUI = document.getElementById('externalURLUI');

    const syncSourceUI = (source) => {
        const isLink = source === 'link';
        if (externalURLUI) externalURLUI.classList.toggle('hidden', !isLink);
        if (uploadUI) uploadUI.classList.toggle('hidden', isLink);
        
        videoSourceRadios.forEach(radio => {
            const label = document.getElementById(radio.value === 'upload' ? 'labelUpload' : 'labelLink');
            if (label) {
                const active = radio.value === source;
                label.style.borderColor = active ? 'var(--brand)' : 'var(--border)';
                label.style.background  = active ? '#ede9fe' : 'transparent';
                label.style.color       = active ? 'var(--brand)' : 'var(--text-muted)';
            }
        });
    };

    videoSourceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => syncSourceUI(e.target.value));
    });

    if (moduleSelect && newModuleContainer) {
        moduleSelect.addEventListener('change', (e) => {
            newModuleContainer.classList.toggle('hidden', e.target.value !== 'new');
        });
    }

    const courseSelect = document.getElementById('courseSelect');
    if (courseSelect) {
        courseSelect.addEventListener('change', (e) => {
            if (e.target.value) loadModules(e.target.value);
        });
    }

    const initData = async () => {
        await loadCoursesDropdown();
        
        if (courseIdParam && courseSelect) {
            courseSelect.value = courseIdParam;
            await loadModules(courseIdParam);
            if (isNewModuleRequest && moduleSelect) {
                moduleSelect.value = 'new';
                newModuleContainer?.classList.remove('hidden');
            }
        }

        if (lessonId) {
            const headerTitle = document.querySelector('.adm-header-title');
            if (headerTitle) headerTitle.textContent = "Edit Lesson";
            if (publishBtn) publishBtn.innerHTML = '<span class="material-icons text-sm">save</span> Update Lesson';
            
            const backBtn = document.querySelector('a[title="Back"]');
            if (backBtn && courseIdParam) backBtn.href = 'lessons.html?courseId=' + courseIdParam;

            try {
                // Fetch single lesson details from REST API
                const response = await fetch(`../api/lessons/index.php?id=${lessonId}`, {
                    headers: getAdminAuthHeader()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('lessonTitle').value = data.title || "";
                    const notesValue = data.notes || "";
                    document.getElementById('lessonNotes').value = notesValue;
                    populateSegmentEditors(notesValue);
                    
                    if (data.module_id) {
                        if (!Array.from(moduleSelect.options).some(opt => opt.value === data.module_id)) {
                            const opt = document.createElement('option');
                            opt.value = data.module_id;
                            opt.textContent = data.module_id;
                            moduleSelect.add(opt, moduleSelect.options[moduleSelect.options.length - 1]);
                        }
                        moduleSelect.value = data.module_id;
                    }

                    if (data.videoSource) {
                        const radio = document.querySelector(`input[name="videoSource"][value="${data.videoSource}"]`);
                        if (radio) radio.checked = true;
                        syncSourceUI(data.videoSource);
                        if (data.videoSource === 'link') {
                            document.getElementById('externalVideoUrl').value = data.contentUrl || "";
                        }
                    }
                }
            } catch (err) {
                console.error("[initData] Error loading lesson:", err);
            }
        }
        
        document.getElementById('formLoader')?.classList.add('hidden');
    };

    const isValidVideoUrl = (url) => {
        const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        const vimeoRegex = /^(https?:\/\/)?(www\.)?(vimeo\.com)\/.+$/;
        return ytRegex.test(url) || vimeoRegex.test(url);
    };

    initData();

    lessonForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = publishBtn || lessonForm.querySelector('button[type="submit"]');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons animate-spin text-sm mr-2">sync</span> Saving...';
        btn.disabled = true;

        try {
            const title = document.getElementById('lessonTitle').value;
            const selectedCourseId = courseSelect.value;
            const notes = document.getElementById('lessonNotes').value;
            const videoSource = document.querySelector('input[name="videoSource"]:checked')?.value;
            
            if (!selectedCourseId) throw new Error("Please select a course.");

            let moduleId = moduleSelect.value;
            if (moduleId === 'new') {
                moduleId = document.getElementById('newModuleName').value.trim();
                if (!moduleId) throw new Error("Please enter a name for the new module.");
            }

            let contentUrl = "";
            if (videoSource === 'link') {
                contentUrl = document.getElementById('externalVideoUrl').value.trim();
                if (!contentUrl) throw new Error("Please enter a video URL.");
                if (!isValidVideoUrl(contentUrl)) {
                    throw new Error("Please enter a valid YouTube or Vimeo URL.");
                }
            } else {
                const videoFile = document.getElementById('videoFileInput').files[0];
                if (videoFile) {
                    contentUrl = `local://${videoFile.name}`; 
                } else if (lessonId) {
                    const response = await fetch(`../api/lessons/index.php?id=${lessonId}`, {
                        headers: getAdminAuthHeader()
                    });
                    if (response.ok) {
                        const existingLesson = await response.json();
                        contentUrl = existingLesson.contentUrl || "";
                    }
                }
            }

            const payload = {
                courseId: selectedCourseId,
                moduleId: moduleId,
                title: title,
                contentType: 'video',
                videoSource: videoSource,
                contentUrl: contentUrl || "",
                notes: notes
            };

            let response;
            if (lessonId) {
                payload.action = 'update';
                payload.id = lessonId;
                response = await fetch('../api/admin/lessons.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAdminAuthHeader()
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                payload.action = 'create';
                response = await fetch('../api/admin/lessons.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAdminAuthHeader()
                    },
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || "Failed to save lesson");
            }

            alert(lessonId ? 'Lesson updated successfully!' : 'Lesson added to curriculum!');
            window.location.href = `lessons.html?courseId=${selectedCourseId}`;
        } catch (error) {
            console.error("[Form Submit] Error:", error);
            alert("Error: " + error.message);
            btn.innerHTML = ogText;
            btn.disabled = false;
        }
    });

    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
             if (lessonForm.reportValidity()) lessonForm.requestSubmit();
        });
    }
}

function setupRichEditor() {
    const container = document.getElementById('segmentsContainer');
    const hiddenInput = document.getElementById('lessonNotes');
    const addBtn = document.getElementById('addSegmentBtn');
    if (!container || !hiddenInput || !addBtn) return;

    addBtn.addEventListener('click', () => {
        addSegment("");
        // Focus the newly added editor
        const editors = container.querySelectorAll('.rich-editor');
        if (editors.length > 0) {
            editors[editors.length - 1].focus();
        }
    });

    // If no segments are populated (e.g., adding a new lesson), start with one empty segment
    setTimeout(() => {
        if (container.children.length === 0) {
            addSegment("");
        }
    }, 100);
}

function addSegment(content = "") {
    const container = document.getElementById('segmentsContainer');
    if (!container) return;

    const segmentCard = document.createElement('div');
    segmentCard.className = 'segment-card';
    const segmentId = 'editor-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    segmentCard.innerHTML = `
        <div class="segment-header">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider segment-number-label">Slide 1</span>
            <div style="display:flex;gap:4px;align-items:center;">
                <button type="button" class="rich-btn segment-bold-btn" title="Bold (Ctrl+B)"><span class="material-icons" style="font-size:16px;">format_bold</span></button>
                <button type="button" class="rich-btn segment-italic-btn" title="Italic (Ctrl+I)"><span class="material-icons" style="font-size:16px;">format_italic</span></button>
                <button type="button" class="rich-btn segment-list-btn" title="Bullet List"><span class="material-icons" style="font-size:16px;">format_list_bulleted</span></button>
                <button type="button" class="rich-btn segment-code-btn" title="Code Block"><span class="material-icons" style="font-size:16px;">code</span></button>
                <button type="button" class="rich-btn segment-size-btn" title="Increase Font Size"><span class="material-icons" style="font-size:16px;">format_size</span></button>
                <div style="width:1.5px;height:16px;background:var(--border);margin:0 4px;"></div>
                <button type="button" class="rich-btn segment-delete-btn" title="Delete Slide" style="color:#ef4444;"><span class="material-icons" style="font-size:16px;">delete</span></button>
            </div>
        </div>
        <div id="${segmentId}" class="rich-editor" contenteditable="true" placeholder="Write key concepts for this slide page…"></div>
    `;

    container.appendChild(segmentCard);

    const editor = segmentCard.querySelector('.rich-editor');
    editor.innerHTML = content;

    // Update labels for numbering
    updateSegmentLabels();

    // Toolbar buttons
    const boldBtn = segmentCard.querySelector('.segment-bold-btn');
    const italicBtn = segmentCard.querySelector('.segment-italic-btn');
    const listBtn = segmentCard.querySelector('.segment-list-btn');
    const codeBtn = segmentCard.querySelector('.segment-code-btn');
    const sizeBtn = segmentCard.querySelector('.segment-size-btn');
    const deleteBtn = segmentCard.querySelector('.segment-delete-btn');

    const exec = (command, value = null) => {
        document.execCommand(command, false, value);
        editor.focus();
        syncNotes();
    };

    // Prevent focus loss on button clicks
    const preventDefault = (e) => e.preventDefault();
    [boldBtn, italicBtn, listBtn, codeBtn, sizeBtn, deleteBtn].forEach(btn => {
        btn?.addEventListener('mousedown', preventDefault);
    });

    boldBtn?.addEventListener('click', () => exec('bold'));
    italicBtn?.addEventListener('click', () => exec('italic'));
    listBtn?.addEventListener('click', () => exec('insertUnorderedList'));

    codeBtn?.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return;

        const code = document.createElement('code');
        code.appendChild(range.extractContents());
        range.insertNode(code);
        syncNotes();
    });

    let currentFontSize = 3;
    sizeBtn?.addEventListener('click', () => {
        currentFontSize = currentFontSize >= 6 ? 2 : currentFontSize + 1;
        exec('fontSize', currentFontSize);
    });

    deleteBtn?.addEventListener('click', () => {
        const allCards = container.querySelectorAll('.segment-card');
        if (allCards.length <= 1) {
            alert('A lesson must have at least one slide.');
            return;
        }
        if (confirm('Delete this slide page? All content on it will be lost.')) {
            segmentCard.remove();
            updateSegmentLabels();
            syncNotes();
        }
    });

    // Inputs/key events
    editor.addEventListener('input', syncNotes);
    editor.addEventListener('paste', () => {
        setTimeout(syncNotes, 0);
    });

    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); exec('bold'); }
            if (e.key === 'i') { e.preventDefault(); exec('italic'); }
        }
    });

    editor.addEventListener('focus', () => segmentCard.classList.add('focused'));
    editor.addEventListener('blur', () => segmentCard.classList.remove('focused'));

    syncNotes();
}

function populateSegmentEditors(notesValue) {
    const container = document.getElementById('segmentsContainer');
    if (!container) return;

    container.innerHTML = '';
    if (notesValue && notesValue.includes('<!-- page-break -->')) {
        const pieces = notesValue.split('<!-- page-break -->');
        pieces.forEach(piece => {
            addSegment(piece);
        });
    } else {
        addSegment(notesValue || "");
    }
}

function updateSegmentLabels() {
    const container = document.getElementById('segmentsContainer');
    if (!container) return;
    const cards = container.querySelectorAll('.segment-card');
    cards.forEach((card, index) => {
        const label = card.querySelector('.segment-number-label');
        if (label) label.textContent = `Slide ${index + 1}`;
    });
}

function syncNotes() {
    const container = document.getElementById('segmentsContainer');
    const hiddenInput = document.getElementById('lessonNotes');
    if (!container || !hiddenInput) return;

    const editors = container.querySelectorAll('.rich-editor');
    const contents = Array.from(editors).map(ed => ed.innerHTML);
    hiddenInput.value = contents.join('<!-- page-break -->');
}
