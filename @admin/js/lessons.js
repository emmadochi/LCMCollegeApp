import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, addDoc, updateDoc, query, where, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
            if (courseSelect && courseSelect.value !== 'all') {
                await loadLessons(courseSelect.value);
            }
        }

        // Handle course change
        document.getElementById('courseSelect')?.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id !== 'all') {
                loadLessons(id);
                // Update URL without reload
                const newUrl = `${window.location.pathname}?courseId=${id}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
            }
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

    try {
        console.log(`[loadModules] Loading modules for course: ${courseId}`);
        moduleSelect.innerHTML = '<option value="">Select a module</option>';
        const modules = new Set();
        
        // 1. Fetch from 'modules' collection
        try {
            const qModules = query(collection(db, "modules"), where("courseId", "==", courseId));
            const modulesSnapshot = await getDocs(qModules);
            console.log(`[loadModules] Found ${modulesSnapshot.size} docs in modules collection`);
            modulesSnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.name) modules.add(data.name);
            });
        } catch (mErr) {
            console.warn("[loadModules] Modules collection check failed:", mErr.message);
        }

        // 2. Fetch unique module names from existing lessons
        const qLessons = query(collection(db, "lessons"), where("courseId", "==", courseId));
        const lessonsSnapshot = await getDocs(qLessons);
        console.log(`[loadModules] Found ${lessonsSnapshot.size} lessons for course`);
        lessonsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.moduleId) modules.add(data.moduleId);
        });

        // 3. Fallback to course document
        const courseDoc = await getDoc(doc(db, "courses", courseId));
        if (courseDoc.exists()) {
            const courseData = courseDoc.data();
            console.log("[loadModules] Course data found:", courseData);
            if (courseData.modules && Array.isArray(courseData.modules)) {
                courseData.modules.forEach(m => modules.add(m));
            }
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
        const coursesSnapshot = await getDocs(collection(db, "courses"));
        console.log(`[loadCoursesDropdown] Found ${coursesSnapshot.size} courses`);
        const currentVal = courseSelect.value;
        courseSelect.innerHTML = '<option value="">Select a course</option>';

        coursesSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = data.title;
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
        if (error.code === 'permission-denied') {
            alert("Permission denied. Are you logged in?");
        }
    }
}

async function loadLessons(courseId) {
    const container = document.getElementById('lessonsContainer');
    if (!container) return;

    try {
        console.log(`[loadLessons] Loading lessons for course: ${courseId}`);
        container.innerHTML = `<div class="p-8 text-center"><span class="loader"></span><p class="mt-2 text-sm text-gray-500">Loading curriculum...</p></div>`;
        
        const q = query(
            collection(db, "lessons"), 
            where("courseId", "==", courseId)
        );
        
        const lessonsSnapshot = await getDocs(q);
        const allDocs = lessonsSnapshot.docs;
        console.log(`[loadLessons] Fetched ${allDocs.length} lessons`);
        
        allDocs.sort((a, b) => (a.data().order || 0) - (b.data().order || 0));
        
        const titleEl = document.querySelector('.page-heading');
        if (titleEl && courseId) {
            const courseDoc = await getDoc(doc(db, "courses", courseId));
            if (courseDoc.exists()) {
                titleEl.textContent = `Curriculum: ${courseDoc.data().title}`;
            }
        }

        container.innerHTML = '';

        if (lessonsSnapshot.empty) {
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
        
        allDocs.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const li = document.createElement('li');
            li.className = 'px-6 py-4 flex items-center justify-between hover:bg-gray-50 group transition-colors';
            li.innerHTML = `
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mr-4">
                        <span class="material-icons text-lg">${data.videoSource === 'link' || data.videoSource === 'upload' ? 'play_circle' : 'article'}</span>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-gray-900">${data.order}. ${data.title}</h4>
                        <div class="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                            <span class="flex items-center capitalize"><span class="material-icons text-[12px] mr-1">category</span> ${data.moduleId || 'No Module'}</span>
                            ${data.hasQuiz ? `<span class="flex items-center text-indigo-600 font-medium"><span class="material-icons text-[12px] mr-1">quiz</span> Quiz attached</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors manage-assignment" data-id="${id}" data-courseid="${courseId}" title="Assignments">
                        <span class="material-icons text-sm">assignment</span>
                    </button>
                    <button class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors edit-lesson" data-id="${id}" data-courseid="${courseId}">
                        <span class="material-icons text-sm">edit</span>
                    </button>
                    <button class="p-1.5 text-gray-400 hover:text-red-600 transition-colors delete-lesson" data-id="${id}">
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
                await deleteDoc(doc(db, "lessons", id));
                // Recalculate and update totalLessons
                const container = document.getElementById('lessonsContainer');
                const courseId = document.getElementById('courseSelect')?.value;
                if (courseId) {
                    const courseRef = doc(db, "courses", courseId);
                    const cSnap = await getDoc(courseRef);
                    if (cSnap.exists()) {
                        const newCount = Math.max(0, (cSnap.data().totalLessons || 0) - 1);
                        await updateDoc(courseRef, { totalLessons: newCount });
                    }
                    loadLessons(courseId);
                }
            } catch (err) {
                alert("Error deleting: " + err.message);
            }
        }
    }
}

async function updateCourseLessonCount(courseId) {
    try {
        const q = query(collection(db, "lessons"), where("courseId", "==", courseId));
        const snap = await getDocs(q);
        const count = snap.size;
        await updateDoc(doc(db, "courses", courseId), { totalLessons: count });
        console.log(`[updateCourseLessonCount] Updated course ${courseId} to ${count} lessons`);
    } catch (err) {
        console.warn("[updateCourseLessonCount] Failed:", err.message);
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
                const docSnap = await getDoc(doc(db, "lessons", lessonId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    document.getElementById('lessonTitle').value = data.title || "";
                    const notesValue = data.notes || "";
                    document.getElementById('lessonNotes').value = notesValue;
                    const editor = document.getElementById('editor');
                    if (editor) editor.innerHTML = notesValue;
                    
                    if (data.moduleId) {
                        if (!Array.from(moduleSelect.options).some(opt => opt.value === data.moduleId)) {
                            const opt = document.createElement('option');
                            opt.value = data.moduleId;
                            opt.textContent = data.moduleId;
                            moduleSelect.add(opt, moduleSelect.options[moduleSelect.options.length - 1]);
                        }
                        moduleSelect.value = data.moduleId;
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

    const getVideoId = (url) => {
        let id = '';
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            id = (match && match[2].length == 11) ? match[2] : null;
        } else if (url.includes('vimeo.com')) {
            const regExp = /^.*(vimeo\.com\/)((channels\/[^\/]+\/)|(groups\/[^\/]+\/videos\/)|(album\/(\d+)\/video\/))?(\d+)?([^\/]*)/;
            const match = url.match(regExp);
            id = match ? match[7] : null;
        }
        return id;
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
                    const docSnap = await getDoc(doc(db, "lessons", lessonId));
                    contentUrl = docSnap.data().contentUrl || "";
                }
            }

            const payload = {
                courseId: selectedCourseId,
                moduleId: moduleId,
                title: title,
                contentType: 'video',
                videoSource: videoSource,
                contentUrl: contentUrl || "",
                notes: notes,
                updatedAt: serverTimestamp()
            };

            if (lessonId) {
                await updateDoc(doc(db, "lessons", lessonId), payload);
                alert('Lesson updated successfully!');
            } else {
                const q = query(collection(db, "lessons"), where("courseId", "==", selectedCourseId));
                const snap = await getDocs(q);
                payload.order = snap.size + 1;
                payload.hasQuiz = false;
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, "lessons"), payload);
                alert('Lesson added to curriculum!');
                await updateCourseLessonCount(selectedCourseId);
            }

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
    const editor = document.getElementById('editor');
    const hiddenInput = document.getElementById('lessonNotes');
    if (!editor || !hiddenInput) return;

    // Buttons
    const buttons = {
        bold: document.getElementById('boldBtn'),
        italic: document.getElementById('italicBtn'),
        list: document.getElementById('listBtn'),
        code: document.getElementById('codeBtn'),
        size: document.getElementById('sizeBtn')
    };

    const exec = (command, value = null) => {
        document.execCommand(command, false, value);
        editor.focus();
        sync();
    };

    const sync = () => {
        hiddenInput.value = editor.innerHTML;
    };

    buttons.bold?.addEventListener('click', () => exec('bold'));
    buttons.italic?.addEventListener('click', () => exec('italic'));
    buttons.list?.addEventListener('click', () => exec('insertUnorderedList'));
    
    buttons.code?.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const code = document.createElement('code');
        code.appendChild(range.extractContents());
        range.insertNode(code);
        sync();
    });

    let currentSize = 3; // default execCommand size (approx 14-16px)
    buttons.size?.addEventListener('click', () => {
        currentSize = currentSize >= 6 ? 2 : currentSize + 1;
        exec('fontSize', currentSize);
    });

    editor.addEventListener('input', sync);
    editor.addEventListener('paste', (e) => {
        // Simple paste as plain text or handle basic HTML
        sync();
    });

    // Keyboard shortcuts
    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); exec('bold'); }
            if (e.key === 'i') { e.preventDefault(); exec('italic'); }
        }
    });
}
