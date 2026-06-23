/**
 * Course Viewer JS Controller
 * Handles: Course metadata loading, curriculum listing, video embedding,
 * lesson completion updates ("Mark Valid & Next"), previous/next navigation,
 * and course completion celebrations.
 */
import { getAuthHeader, currentUser } from './guard.js';
import { initChat } from './chat.js';

// Global State
let courseLessons = [];
let activeLessonId = null;
let completedLessonIds = new Set();
let currentCourseTitle = '';
let activeAssignment = null;    // Current lesson's assignment (or null)
let activeSubmission = null;    // Current student submission (or null)
let currentSlides = [];
let currentSlideIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');

    if (courseId) {
        await loadCourseData(courseId);
        await loadReviews(courseId);
        setupReviewForm();
        initChat(courseId);
    } else {
        // Kick back to dashboard if no ID provided
        window.location.replace('dashboard.html');
    }

    // Bind Button Click Handlers
    document.getElementById('prevLessonBtn')?.addEventListener('click', handlePreviousClick);
    document.getElementById('nextLessonBtn')?.addEventListener('click', handleNextClick);
    document.getElementById('prevLessonBtnBottom')?.addEventListener('click', handlePreviousClick);
    document.getElementById('nextLessonBtnBottom')?.addEventListener('click', handleNextClick);

    // Handle Mobile Sidebar Toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    function openSidebar() {
        if (sidebar) sidebar.classList.remove('-translate-x-full');
        if (overlay) overlay.classList.remove('hidden');
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.add('-translate-x-full');
        if (overlay) overlay.classList.add('hidden');
    }

    if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', openSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // Make closeSidebar accessible globally or on other events
    window.closeMobileSidebar = closeSidebar;
});

async function loadCourseData(courseId) {
    try {
        // 1. Fetch Course metadata
        const courseResponse = await fetch(`../api/courses/index.php?id=${courseId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            }
        });

        if (!courseResponse.ok) {
            throw new Error("Course not found or access denied.");
        }

        const course = await courseResponse.json();
        currentCourseTitle = course.title || '';
        
        // Render general course details
        const badge = document.getElementById('courseCategoryBadge');
        if (badge) badge.innerText = course.category || 'Theology';
        const titleSidebar = document.getElementById('courseTitleSidebar');
        if (titleSidebar) titleSidebar.innerText = course.title;
        const mobileCourseTitle = document.getElementById('mobileCourseTitle');
        if (mobileCourseTitle) mobileCourseTitle.innerText = course.title;

        // 2. Fetch Lessons curriculum
        const lessonsResponse = await fetch(`../api/lessons/index.php?course_id=${courseId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            }
        });

        if (!lessonsResponse.ok) {
            throw new Error("Lessons failed to load.");
        }

        courseLessons = await lessonsResponse.json();

        // 3. Fetch User progress
        try {
            const progressResponse = await fetch(`../api/learning/progress.php?user_id=${currentUser.id}&course_id=${courseId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                }
            });
            if (progressResponse.ok) {
                const progressData = await progressResponse.json();
                completedLessonIds.clear();
                progressData.forEach(p => {
                    if (p.isCompleted) {
                        completedLessonIds.add(p.lessonId);
                    }
                });
            }
        } catch (err) {
            console.error("Error fetching progress:", err);
        }

        renderCurriculum(courseLessons);

        // Load initial lesson (default to URL param if set, otherwise first lesson)
        const urlParams = new URLSearchParams(window.location.search);
        const targetLessonId = urlParams.get('lessonId');
        const shouldCelebrate = urlParams.get('celebrate') === 'true';

        if (courseLessons.length > 0) {
            if (targetLessonId && courseLessons.some(l => l.id === targetLessonId)) {
                selectAndDisplayLesson(targetLessonId);
            } else {
                selectAndDisplayLesson(courseLessons[0].id);
            }
        } else {
            displayEmptyState();
        }

        if (shouldCelebrate) {
            showCelebrationModal(courseId);
        }

    } catch (error) {
        console.error("Error loading course details:", error);
        alert(error.message || "Failed to load course details.");
        window.location.replace('dashboard.html');
    }
}

/**
 * Check if a lesson is unlocked.
 * A lesson is unlocked if it is the first lesson OR the previous lesson in sequence is completed.
 */
function isLessonUnlocked(lessonId) {
    const idx = courseLessons.findIndex(l => l.id === lessonId);
    if (idx <= 0) return true; // First lesson is always unlocked
    
    // Check if the previous lesson is completed
    const prevLesson = courseLessons[idx - 1];
    return completedLessonIds.has(prevLesson.id);
}

/**
 * Render curriculum sidebar items grouped by module_id
 */
function renderCurriculum(lessons) {
    const modulesContainer = document.getElementById('courseModulesList');
    if (!modulesContainer) return;
    modulesContainer.innerHTML = '';

    // Group lessons by module_id
    const modulesMap = {};
    lessons.forEach(lesson => {
        const modName = lesson.module_id || 'General Lectures';
        if (!modulesMap[modName]) {
            modulesMap[modName] = [];
        }
        modulesMap[modName].push(lesson);
    });

    // Render grouped lists
    for (const [moduleName, moduleLessons] of Object.entries(modulesMap)) {
        const moduleDiv = document.createElement('div');
        moduleDiv.className = 'space-y-1 mt-4';
        
        const heading = document.createElement('p');
        heading.className = 'font-bold text-xs text-gray-400 uppercase tracking-widest px-2 mb-3 mt-4';
        heading.innerText = moduleName;
        moduleDiv.appendChild(heading);

        moduleLessons.forEach(lesson => {
            const anchor = document.createElement('a');
            anchor.href = '#';
            anchor.id = `sidebar-lesson-${lesson.id}`;
            
            const isCompleted = completedLessonIds.has(lesson.id);
            const isUnlocked = isLessonUnlocked(lesson.id);
            const isVideo = lesson.contentType === 'video';

            if (!isUnlocked) {
                // Locked State
                anchor.className = 'flex items-center p-3 text-sm rounded-xl text-gray-300 cursor-not-allowed opacity-50 pointer-events-none mt-1';
                anchor.innerHTML = `
                    <div class="flex-shrink-0 mr-3">
                        <div class="w-7 h-7 rounded-full bg-gray-50 text-gray-300 border-gray-100 flex items-center justify-center text-xs border lesson-icon-container">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <span class="block font-medium truncate text-gray-400">${lesson.order_index}. ${lesson.title}</span>
                        <span class="block text-xs text-gray-400">Locked</span>
                    </div>
                `;
            } else {
                // Unlocked State
                anchor.className = 'flex items-center p-3 text-sm rounded-xl hover:bg-gray-50 text-gray-700 transition-all border-l-4 border-transparent mt-1';
                const icon = isCompleted ? 'fa-circle-check text-green-600' : (isVideo ? 'fa-play' : 'fa-file-pdf');
                
                anchor.innerHTML = `
                    <div class="flex-shrink-0 mr-3">
                        <div class="w-7 h-7 rounded-full ${isCompleted ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'} flex items-center justify-center text-xs border lesson-icon-container">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <span class="block font-medium truncate lesson-title-text">${lesson.order_index}. ${lesson.title}</span>
                        <span class="block text-xs text-gray-500 lesson-sub-text">${isVideo ? 'Video Lecture' : 'Material'}</span>
                    </div>
                `;

                anchor.addEventListener('click', (e) => {
                    e.preventDefault();
                    selectAndDisplayLesson(lesson.id);
                    if (typeof window.closeMobileSidebar === 'function') {
                        window.closeMobileSidebar();
                    }
                });
            }

            moduleDiv.appendChild(anchor);
        });

        modulesContainer.appendChild(moduleDiv);
    }
}

/**
 * Handle selection and rendering of an active lesson
 */
function selectAndDisplayLesson(lessonId) {
    const lesson = courseLessons.find(l => l.id === lessonId);
    if (!lesson) return;

    activeLessonId = lessonId;

    // Reset styles of all links in the sidebar
    document.querySelectorAll('#courseModulesList a').forEach(el => {
        const targetId = el.id.replace('sidebar-lesson-', '');
        const targetLesson = courseLessons.find(l => l.id === targetId);
        if (!targetLesson) return;
        
        const isUnlocked = isLessonUnlocked(targetId);
        
        if (!isUnlocked) {
            el.className = 'flex items-center p-3 text-sm rounded-xl text-gray-300 cursor-not-allowed opacity-50 pointer-events-none mt-1';
            return;
        }

        el.className = 'flex items-center p-3 text-sm rounded-xl hover:bg-gray-50 text-gray-700 transition-all border-l-4 border-transparent mt-1';
        const iconContainer = el.querySelector('.lesson-icon-container');
        if (iconContainer) {
            const isCompleted = completedLessonIds.has(targetId);
            iconContainer.className = `w-7 h-7 rounded-full ${isCompleted ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'} flex items-center justify-center text-xs border`;
            const icon = iconContainer.querySelector('i');
            if (icon) {
                const isVideo = targetLesson.contentType === 'video';
                icon.className = isCompleted ? 'fa-solid fa-circle-check text-green-600' : `fa-solid ${isVideo ? 'fa-play' : 'fa-file-pdf'}`;
            }
        }
    });

    // Mark the selected sidebar item as active
    const activeLink = document.getElementById(`sidebar-lesson-${lessonId}`);
    if (activeLink) {
        activeLink.className = 'flex items-center p-3 text-sm rounded-xl hover:bg-gray-50 bg-[#abcf471a] text-primaryDark border-l-4 border-primary transition-all';
        const iconContainer = activeLink.querySelector('.lesson-icon-container');
        if (iconContainer) {
            iconContainer.className = 'w-7 h-7 rounded-full brand-gradient-bg text-gray-900 flex items-center justify-center text-xs shadow-sm';
            const icon = iconContainer.querySelector('i');
            if (icon) {
                icon.className = icon.className.replace('text-green-600', '');
            }
        }
    }

    // Render Active Lesson Info
    document.getElementById('lessonTitle').innerText = lesson.title;
    
    // Parse and setup notes slides
    if (lesson.notes && lesson.notes.includes('<!-- page-break -->')) {
        currentSlides = lesson.notes.split('<!-- page-break -->');
    } else {
        currentSlides = [lesson.notes || '<p class="text-gray-400 italic">No notes available for this module.</p>'];
    }
    currentSlideIndex = 0;

    const descriptionEl = document.getElementById('lessonDescription');
    if (descriptionEl) {
        descriptionEl.style.transition = 'opacity 0.15s ease-in-out';
        descriptionEl.style.opacity = '1';
    }

    renderSlide();

    // Render Video Player
    const playerContainer = document.querySelector('.aspect-video');
    if (playerContainer) {
        if (lesson.contentType === 'video' && lesson.contentUrl) {
            const embedUrl = getEmbedUrl(lesson.contentUrl, lesson.videoSource);
            if (lesson.videoSource === 'link' && embedUrl) {
                playerContainer.innerHTML = `
                    <iframe class="w-full h-full border-0 animate-fade-in" 
                            src="${embedUrl}" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                    </iframe>`;
            } else if (lesson.videoSource === 'upload') {
                playerContainer.innerHTML = `
                    <video class="w-full h-full object-cover animate-fade-in" controls>
                        <source src="../uploads/${lesson.contentUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>`;
            } else {
                displayVideoPlaceholder(lesson.title);
            }
        } else {
            displayMaterialPlaceholder(lesson.title);
        }
    }

    // Load assignment for this lesson
    loadAssignmentForLesson(lessonId);

    // Update Navigation Buttons States
    updateNavigationButtons();
}

function renderSlide() {
    const descriptionEl = document.getElementById('lessonDescription');
    if (!descriptionEl) return;
    
    // Smooth transition
    descriptionEl.style.opacity = '0';
    setTimeout(() => {
        descriptionEl.innerHTML = currentSlides[currentSlideIndex] || '<p class="text-gray-400 italic">No notes available for this page.</p>';
        descriptionEl.style.opacity = '1';
        // Scroll to top of lesson container
        document.getElementById('lessonTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    // Update Progress Indicator
    const progressContainer = document.getElementById('lessonSlideProgressContainer');
    const indicator = document.getElementById('lessonSlideIndicator');
    const dotsContainer = document.getElementById('lessonSlideDots');

    if (progressContainer && indicator && dotsContainer) {
        if (currentSlides.length > 1) {
            progressContainer.classList.remove('hidden');
            indicator.innerText = `Page ${currentSlideIndex + 1} of ${currentSlides.length}`;
            
            // Render Dots
            dotsContainer.innerHTML = '';
            for (let i = 0; i < currentSlides.length; i++) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = `w-2.5 h-2.5 rounded-full transition-all duration-300 focus:outline-none ${i === currentSlideIndex ? 'bg-[#abcf47] scale-110 shadow-[0_0_8px_rgba(171,207,71,0.5)]' : 'bg-gray-200 hover:bg-gray-300'}`;
                dot.title = `Go to Page ${i + 1}`;
                dot.addEventListener('click', () => {
                    currentSlideIndex = i;
                    renderSlide();
                    updateNavigationButtons();
                });
                dotsContainer.appendChild(dot);
            }
        } else {
            progressContainer.classList.add('hidden');
        }
    }
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevLessonBtn');
    const nextBtn = document.getElementById('nextLessonBtn');
    const prevBtnBottom = document.getElementById('prevLessonBtnBottom');
    const nextBtnBottom = document.getElementById('nextLessonBtnBottom');
    if (!prevBtn || !nextBtn) return;

    const currentIndex = courseLessons.findIndex(l => l.id === activeLessonId);
    const activeLesson = courseLessons[currentIndex];
    const hasQuiz = activeLesson && activeLesson.hasQuiz;

    // Update Previous button
    const prevDisabled = (currentSlideIndex === 0 && currentIndex === 0);
    
    prevBtn.disabled = prevDisabled;
    if (prevDisabled) {
        prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
    } else {
        prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    }

    if (prevBtnBottom) {
        prevBtnBottom.disabled = prevDisabled;
        if (prevDisabled) {
            prevBtnBottom.classList.add('opacity-40', 'cursor-not-allowed');
        } else {
            prevBtnBottom.classList.remove('opacity-40', 'cursor-not-allowed');
        }
    }

    // Update Next/Finish button label based on quiz context and completion state
    let nextText = '';
    if (currentSlideIndex < currentSlides.length - 1) {
        nextText = 'Next Page <i class="fa-solid fa-chevron-right ml-2 text-xs"></i>';
    } else {
        if (hasQuiz) {
            nextText = 'Take Quiz & Next <i class="fa-solid fa-graduation-cap ml-2 text-xs"></i>';
        } else if (currentIndex === courseLessons.length - 1) {
            nextText = 'Mark Valid & Finish <i class="fa-solid fa-flag-checkered ml-2 text-xs"></i>';
        } else {
            nextText = 'Mark Valid & Next <i class="fa-solid fa-chevron-right ml-2 text-xs"></i>';
        }
    }

    nextBtn.innerHTML = nextText;
    if (nextBtnBottom) {
        nextBtnBottom.innerHTML = nextText;
    }
}

function handlePreviousClick() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        renderSlide();
        updateNavigationButtons();
        return;
    }
    const currentIndex = courseLessons.findIndex(l => l.id === activeLessonId);
    if (currentIndex > 0) {
        selectAndDisplayLesson(courseLessons[currentIndex - 1].id);
    }
}

async function handleNextClick() {
    if (!activeLessonId) return;

    // If there are more slides, progress to next slide first
    if (currentSlideIndex < currentSlides.length - 1) {
        currentSlideIndex++;
        renderSlide();
        updateNavigationButtons();
        return;
    }

    const activeLesson = courseLessons.find(l => l.id === activeLessonId);
    const hasQuiz = activeLesson && activeLesson.hasQuiz;
    
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');

    if (hasQuiz) {
        window.location.href = `quiz.html?lessonId=${activeLessonId}&courseId=${courseId}`;
        return;
    }

    const nextBtn = document.getElementById('nextLessonBtn');
    const nextBtnBottom = document.getElementById('nextLessonBtnBottom');
    const originalHTML = nextBtn ? nextBtn.innerHTML : '';
    
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = 'Saving... <i class="fa-solid fa-spinner fa-spin ml-2"></i>';
    }
    if (nextBtnBottom) {
        nextBtnBottom.disabled = true;
        nextBtnBottom.innerHTML = 'Saving... <i class="fa-solid fa-spinner fa-spin ml-2"></i>';
    }

    try {
        const response = await fetch('../api/learning/progress.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({
                userId: currentUser.id,
                courseId: courseId,
                lessonId: activeLessonId,
                isCompleted: true
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            // Check if blocked by assignment gating
            const msg = errData.message || 'Failed to save progress';
            if (msg.includes('assignment') || msg.includes('approved')) {
                showAssignmentGatingAlert();
            } else {
                alert(msg);
            }
            throw new Error(msg);
        }

        completedLessonIds.add(activeLessonId);
        renderCurriculum(courseLessons);

        const currentIndex = courseLessons.findIndex(l => l.id === activeLessonId);

        if (currentIndex < courseLessons.length - 1) {
            selectAndDisplayLesson(courseLessons[currentIndex + 1].id);
        } else {
            showCelebrationModal(courseId);
        }

    } catch (err) {
        console.error('Error saving progress:', err);
    } finally {
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.innerHTML = originalHTML;
        }
        if (nextBtnBottom) {
            nextBtnBottom.disabled = false;
            nextBtnBottom.innerHTML = originalHTML;
        }
    }
}

/**
 * Show a toast-style alert when lesson is blocked by an unapproved assignment
 */
function showAssignmentGatingAlert() {
    const panel = document.getElementById('assignmentPanel');
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        panel.querySelector('.bg-white')?.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => panel.querySelector('.bg-white')?.classList.remove('ring-2','ring-amber-400'), 2500);
    }
    // Show inline alert under the next button
    let alertEl = document.getElementById('assignmentGatingAlert');
    if (!alertEl) {
        alertEl = document.createElement('div');
        alertEl.id = 'assignmentGatingAlert';
        alertEl.className = 'mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium flex items-center gap-2';
        alertEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> You must submit and get your assignment approved before completing this lesson.';
        const btns = document.querySelector('.flex.gap-3');
        if (btns) btns.parentNode.insertBefore(alertEl, btns.nextSibling);
    }
    alertEl.classList.remove('hidden');
    setTimeout(() => alertEl?.classList.add('hidden'), 5000);
}

function showCelebrationModal(courseId) {
    // Prevent duplicate modals
    if (document.getElementById('celebrationModal')) return;

    const modal = document.createElement('div');
    modal.id = 'celebrationModal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300 opacity-0';

    modal.innerHTML = `
        <div class="bg-white rounded-[24px] max-w-md w-full overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-[#0000000a] transform scale-95 transition-all duration-300 relative">
            
            <!-- Confetti Canvas Background Effect -->
            <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
                <div class="confetti-piece" style="left:10%;animation:fall 3s infinite linear;background:#abcf47;width:8px;height:8px;border-radius:50%;"></div>
                <div class="confetti-piece" style="left:30%;animation:fall 4s infinite linear 1s;background:#f5a623;width:6px;height:12px;"></div>
                <div class="confetti-piece" style="left:50%;animation:fall 2.5s infinite linear 0.5s;background:#50b5ff;width:10px;height:10px;border-radius:50%;"></div>
                <div class="confetti-piece" style="left:70%;animation:fall 3.5s infinite linear 1.5s;background:#e056fd;width:8px;height:14px;"></div>
                <div class="confetti-piece" style="left:90%;animation:fall 3.2s infinite linear 0.2s;background:#2ed573;width:6px;height:6px;border-radius:50%;"></div>
            </div>

            <div class="brand-gradient-bg p-8 text-center text-gray-900 relative overflow-hidden flex flex-col items-center">
                <!-- Sparkle background circles -->
                <div class="absolute w-32 h-32 bg-white/10 rounded-full -top-10 -left-10 blur-xl"></div>
                <div class="absolute w-32 h-32 bg-white/10 rounded-full -bottom-10 -right-10 blur-xl"></div>
                
                <div class="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl mb-4 shadow-inner z-10 text-white">
                    🏆
                </div>
                <h3 class="text-2xl font-bold font-heading text-white z-10">Congratulations!</h3>
                <p class="text-white/80 text-sm mt-1 z-10">You have completed all curriculum steps</p>
            </div>
            
            <div class="p-8 text-center relative z-10">
                <h4 class="text-lg font-bold text-gray-900 mb-2">${currentCourseTitle}</h4>
                <p class="text-sm text-gray-500 mb-8 leading-relaxed">
                    Splendid work! You've successfully finished all video lectures and reading materials. You are now eligible to claim your official graduation certificate.
                </p>
                
                <div class="flex flex-col gap-3">
                    <button id="claimCertBtn" class="w-full py-3 brand-gradient-bg text-gray-900 rounded-[100px] text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-graduation-cap text-base"></i> Request Certificate
                    </button>
                    <a href="dashboard.html" class="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-[100px] text-sm font-semibold transition-colors border border-gray-100 block text-center">
                        Back to Dashboard
                    </a>
                </div>
            </div>
        </div>
    `;

    // Confetti animation styling
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fall {
            0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(450px) rotate(360deg); opacity: 0; }
        }
        .confetti-piece {
            position: absolute;
            top: -20px;
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);

    // Animate open
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        const card = modal.querySelector('div');
        if (card) card.classList.remove('scale-95');
    });

    // Add Claim Certificate Action
    document.getElementById('claimCertBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('claimCertBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Submitting...';

        try {
            const resp = await fetch('../api/learning/certificate.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ courseId: courseId })
            });

            if (!resp.ok) throw new Error("Failed to request certificate");
            const data = await resp.json();

            btn.innerHTML = '<i class="fa-solid fa-circle-check text-green-700 mr-2"></i> Submitted!';
            btn.className = 'w-full py-3 bg-green-100 text-green-800 border border-green-200 rounded-[100px] text-sm font-bold flex items-center justify-center gap-2';

            // Redirect to certificate print page
            setTimeout(() => {
                modal.remove();
                window.location.href = `certificate.html?course_title=${encodeURIComponent(currentCourseTitle)}`;
            }, 1800);

        } catch (err) {
            console.error("Error claiming certificate:", err);
            alert("Failed to submit certificate request. Please try again later.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-graduation-cap text-base"></i> Request Certificate';
        }
    });
}

function getEmbedUrl(url, source) {
    if (source === 'link') {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            const id = (match && match[2].length == 11) ? match[2] : null;
            return id ? `https://www.youtube.com/embed/${id}?rel=0` : url;
        } else if (url.includes('vimeo.com')) {
            const regExp = /^.*(vimeo\.com\/)((channels\/[^\/]+\/)|(groups\/[^\/]+\/videos\/)|(album\/(\d+)\/video\/))?(\d+)?([^\/]*)/;
            const match = url.match(regExp);
            const id = match ? match[7] : null;
            return id ? `https://player.vimeo.com/video/${id}?badge=0&byline=0` : url;
        }
    }
    return url;
}

function displayVideoPlaceholder(title) {
    const playerContainer = document.querySelector('.aspect-video');
    playerContainer.innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
            <div class="absolute w-64 h-64 brand-gradient-bg rounded-full mix-blend-overlay filter blur-3xl opacity-30"></div>
            <i class="fa-solid fa-video-slash text-4xl mb-4 text-gray-400"></i>
            <h3 class="text-xl font-heading font-medium z-10">${title}</h3>
            <p class="text-xs text-gray-400 mt-2 z-10">Video link is unavailable or incorrectly formatted.</p>
        </div>`;
}

function displayMaterialPlaceholder(title) {
    const playerContainer = document.querySelector('.aspect-video');
    playerContainer.innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-gray-800">
            <div class="absolute w-64 h-64 brand-gradient-bg rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>
            <i class="fa-regular fa-file-lines text-5xl mb-4 text-primary"></i>
            <h3 class="text-xl font-heading font-bold text-white z-10">${title}</h3>
            <p class="text-sm text-gray-300 mt-2 z-10">Please read the lecture details and notes provided below.</p>
        </div>`;
}

function displayEmptyState() {
    document.getElementById('lessonTitle').innerText = "No Lessons Available";
    document.getElementById('lessonDescription').innerHTML = '<p class="text-gray-400 italic">This course is currently empty.</p>';
    displayMaterialPlaceholder("Curriculum Empty");
}

// ──────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT PANEL LOGIC
// ──────────────────────────────────────────────────────────────────────────────

async function loadAssignmentForLesson(lessonId) {
    // Reset state
    activeAssignment = null;
    activeSubmission = null;
    hideAssignmentPanel();

    try {
        const resp = await fetch(`../api/assignments/index.php?lesson_id=${lessonId}`, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
        });
        if (!resp.ok) return;
        const assignment = await resp.json();
        if (!assignment || !assignment.id) return;

        activeAssignment = assignment;

        // Try fetching existing submission
        try {
            const subResp = await fetch(
                `../api/assignments/submissions.php?assignment_id=${assignment.id}&user_id=${currentUser.id}`,
                { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } }
            );
            activeSubmission = subResp.ok ? await subResp.json() : null;
        } catch { activeSubmission = null; }

        renderAssignmentPanel(assignment, activeSubmission);
    } catch (err) {
        console.error('Error loading lesson assignment:', err);
    }
}

function hideAssignmentPanel() {
    const panel = document.getElementById('assignmentPanel');
    if (panel) panel.classList.add('hidden');
}

function renderAssignmentPanel(assignment, submission) {
    const panel = document.getElementById('assignmentPanel');
    if (!panel) return;
    panel.classList.remove('hidden');

    // Title & due date
    const titleEl   = document.getElementById('assignmentTitle');
    const dueDateEl = document.getElementById('assignmentDueDate');
    if (titleEl)   titleEl.textContent = assignment.title || 'Assignment';
    if (dueDateEl) dueDateEl.textContent = assignment.dueDate
        ? new Date(assignment.dueDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
        : '—';

    // Instructions
    const instrEl = document.getElementById('assignmentInstructions');
    if (instrEl) instrEl.innerHTML = assignment.instructions || '<em class="text-gray-400">No instructions provided.</em>';

    // Status badge
    const badgeEl = document.getElementById('assignmentStatusBadge');
    const feedbackContainer = document.getElementById('assignmentFeedbackContainer');
    const feedbackText = document.getElementById('assignmentFeedbackText');
    const approvedBanner = document.getElementById('assignmentApprovedBanner');
    const formContainer = document.getElementById('assignmentSubmissionForm');

    // Hide all conditional elements first
    feedbackContainer?.classList.add('hidden');
    approvedBanner?.classList.add('hidden');

    const statusMap = {
        pending:  { cls: 'bg-amber-100 text-amber-800',   label: '⏳ Pending Review' },
        approved: { cls: 'bg-green-100 text-green-800',   label: '✅ Approved' },
        graded:   { cls: 'bg-blue-100 text-blue-800',     label: '📋 Graded' },
        rejected: { cls: 'bg-red-100 text-red-700',       label: '🔄 Needs Revision' },
    };

    if (!submission) {
        if (badgeEl) badgeEl.innerHTML = `<span class="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">Not Submitted</span>`;
        if (formContainer) formContainer.classList.remove('hidden');
    } else {
        const cfg = statusMap[submission.status] || statusMap.pending;
        if (badgeEl) badgeEl.innerHTML = `<span class="px-3 py-1.5 ${cfg.cls} text-xs font-bold rounded-full">${cfg.label}</span>`;

        if (['approved', 'graded'].includes(submission.status)) {
            approvedBanner?.classList.remove('hidden');
            if (formContainer) formContainer.classList.add('hidden'); // Hide form – already approved
        } else if (submission.status === 'rejected') {
            if (feedbackContainer) feedbackContainer.classList.remove('hidden');
            if (feedbackText) feedbackText.textContent = submission.feedback || 'Please revise your submission based on the lecturer feedback.';
            if (formContainer) formContainer.classList.remove('hidden');
            // Pre-fill form with previous submission
            prefillSubmissionForm(submission);
        } else {
            // Pending — allow re-submission
            if (formContainer) formContainer.classList.remove('hidden');
            prefillSubmissionForm(submission);
        }
    }

    // Setup submission type toggle
    setupSubmissionTypeToggle();
}

function prefillSubmissionForm(submission) {
    if (!submission) return;
    if (submission.submissionType === 'file') {
        document.getElementById('typeFile').checked = true;
        document.getElementById('submissionTextArea')?.classList.add('hidden');
        document.getElementById('submissionFileArea')?.classList.remove('hidden');
        if (submission.fileName) {
            const fnEl = document.getElementById('selectedFileName');
            if (fnEl) { fnEl.textContent = `Previously uploaded: ${submission.fileName}`; fnEl.classList.remove('hidden'); }
        }
    } else {
        document.getElementById('typeText').checked = true;
        document.getElementById('submissionTextArea')?.classList.remove('hidden');
        document.getElementById('submissionFileArea')?.classList.add('hidden');
        const textEl = document.getElementById('submissionText');
        if (textEl && submission.submissionText) textEl.value = submission.submissionText;
    }
}

function setupSubmissionTypeToggle() {
    const textRadio = document.getElementById('typeText');
    const fileRadio = document.getElementById('typeFile');
    const textArea  = document.getElementById('submissionTextArea');
    const fileArea  = document.getElementById('submissionFileArea');
    if (!textRadio || !fileRadio) return;

    textRadio.addEventListener('change', () => {
        textArea?.classList.remove('hidden');
        fileArea?.classList.add('hidden');
    });
    fileRadio.addEventListener('change', () => {
        textArea?.classList.add('hidden');
        fileArea?.classList.remove('hidden');
    });

    // File drop zone
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('submissionFile');
    const fnLabel  = document.getElementById('selectedFileName');
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files[0] && fnLabel) {
                fnLabel.textContent = fileInput.files[0].name;
                fnLabel.classList.remove('hidden');
            }
        });
    }
}

// Set up the assignment submission form handler
document.addEventListener('DOMContentLoaded', () => {
    const submitForm = document.getElementById('submitAssignmentForm');
    if (submitForm) {
        submitForm.addEventListener('submit', handleAssignmentSubmit);
    }
});

async function handleAssignmentSubmit(e) {
    e.preventDefault();
    if (!activeAssignment || !currentUser) return;

    const submissionType = document.querySelector('input[name="submissionType"]:checked')?.value || 'text';
    const btn = document.getElementById('submitAssignmentBtn');
    const orig = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Submitting…'; }

    try {
        let response;
        if (submissionType === 'file') {
            const fileInput = document.getElementById('submissionFile');
            if (!fileInput?.files[0]) {
                alert('Please choose a file to upload.');
                return;
            }
            const formData = new FormData();
            formData.append('userId', currentUser.id);
            formData.append('assignmentId', activeAssignment.id);
            formData.append('lessonId', activeAssignment.lessonId);
            formData.append('submissionType', 'file');
            formData.append('file', fileInput.files[0]);
            const token = localStorage.getItem('token');
            response = await fetch('../api/assignments/submissions.php', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
        } else {
            const text = document.getElementById('submissionText')?.value.trim();
            if (!text) { alert('Please write your answer before submitting.'); return; }
            response = await fetch('../api/assignments/submissions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({
                    userId: currentUser.id,
                    assignmentId: activeAssignment.id,
                    lessonId: activeAssignment.lessonId,
                    submissionType: 'text',
                    text
                })
            });
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Submission failed');
        }

        // Refresh submission status
        await loadAssignmentForLesson(activeLessonId);
        alert('Assignment submitted successfully! Awaiting lecturer review.');
    } catch (err) {
        console.error('Submission error:', err);
        alert(err.message || 'Failed to submit assignment.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
}

async function loadReviews(courseId) {
    const container = document.getElementById('reviewsListContainer');
    if (!container) return;

    try {
        const resp = await fetch(`../api/reviews/index.php?course_id=${courseId}`, {
            headers: getAuthHeader()
        });

        if (!resp.ok) throw new Error('Failed to load reviews');

        const reviews = await resp.json();
        container.innerHTML = '';

        if (!reviews || reviews.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fa-regular fa-comments text-4xl mb-3 text-gray-300"></i>
                    <p class="text-sm font-medium">No reviews yet</p>
                    <p class="text-xs text-gray-400 mt-1">Be the first to share your feedback about this course!</p>
                </div>
            `;
            return;
        }

        reviews.forEach(review => {
            const dateStr = review.created_at ? new Date(review.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'N/A';

            const stars = Array(5).fill(0).map((_, i) =>
                `<i class="fa-solid fa-star text-xs ${i < review.rating ? 'text-amber-400' : 'text-gray-200'}"></i>`
            ).join('');

            const item = document.createElement('div');
            item.className = 'p-5 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col gap-3 transition-all hover:bg-gray-50';
            item.innerHTML = `
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-primary/20 text-primaryDark flex items-center justify-center font-bold text-sm shadow-inner uppercase">
                            ${(review.user_name || 'A')[0]}
                        </div>
                        <div>
                            <h4 class="font-bold text-sm text-gray-900">${review.user_name || 'Anonymous'}</h4>
                            <p class="text-[11px] text-gray-400 font-medium">${dateStr}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-0.5">
                        ${stars}
                    </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed pl-1">${review.comment || '<span class="italic text-gray-400">No comment left.</span>'}</p>
            `;
            container.appendChild(item);
        });

    } catch (err) {
        console.error('Failed to load reviews:', err);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fa-solid fa-circle-exclamation text-3xl mb-2"></i>
                <p class="text-sm font-semibold">Failed to load reviews</p>
            </div>
        `;
    }
}

function setupReviewForm() {
    const writeBtn = document.getElementById('writeReviewBtn');
    const cancelBtn = document.getElementById('cancelReviewBtn');
    const formContainer = document.getElementById('reviewFormContainer');
    const starBtns = document.querySelectorAll('#starRatingSelect button');
    const ratingInput = document.getElementById('selectedRatingVal');
    const reviewForm = document.getElementById('courseReviewForm');

    if (writeBtn && formContainer) {
        writeBtn.addEventListener('click', () => {
            formContainer.classList.toggle('hidden');
        });
    }

    if (cancelBtn && formContainer) {
        cancelBtn.addEventListener('click', () => {
            formContainer.classList.add('hidden');
            resetReviewForm();
        });
    }

    // Star selection
    starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const rating = parseInt(btn.dataset.rating);
            ratingInput.value = rating;
            
            // Highlight stars
            starBtns.forEach((sBtn, idx) => {
                if (idx < rating) {
                    sBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
                    sBtn.className = 'text-3xl text-amber-400 transition-colors focus:outline-none';
                } else {
                    sBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
                    sBtn.className = 'text-3xl text-gray-300 transition-colors focus:outline-none';
                }
            });
        });

        // Hover effect helper
        btn.addEventListener('mouseenter', () => {
            const rating = parseInt(btn.dataset.rating);
            starBtns.forEach((sBtn, idx) => {
                if (idx < rating) {
                    sBtn.classList.remove('text-gray-300');
                    sBtn.classList.add('text-amber-400');
                }
            });
        });

        btn.addEventListener('mouseleave', () => {
            const currentRating = parseInt(ratingInput.value || 0);
            starBtns.forEach((sBtn, idx) => {
                if (idx >= currentRating) {
                    sBtn.classList.remove('text-amber-400');
                    sBtn.classList.add('text-gray-300');
                }
            });
        });
    });

    function resetReviewForm() {
        if (reviewForm) reviewForm.reset();
        ratingInput.value = '0';
        starBtns.forEach(sBtn => {
            sBtn.className = 'text-3xl text-gray-300 transition-colors focus:outline-none';
        });
    }

    // Submit review
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = parseInt(ratingInput.value);
            const comment = document.getElementById('reviewComment').value.trim();

            if (rating < 1 || rating > 5) {
                alert('Please select a rating between 1 and 5 stars.');
                return;
            }

            const submitBtn = reviewForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Submitting...';

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const courseId = urlParams.get('id');

                const response = await fetch('../api/reviews/index.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader()
                    },
                    body: JSON.stringify({
                        courseId: courseId,
                        rating: rating,
                        comment: comment
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to submit review');
                }

                alert('Thank you! Your review has been submitted successfully.');
                formContainer.classList.add('hidden');
                resetReviewForm();
                await loadReviews(courseId);

            } catch (err) {
                console.error('Error submitting review:', err);
                alert(err.message || 'Could not submit your review. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }
}
