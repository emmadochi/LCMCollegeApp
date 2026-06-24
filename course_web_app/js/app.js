/**
 * Lifechangers Ministerial College — Student Dashboard Controller
 * Handles: tabs, course fetching (enrolled/catalog/completed), search, enrollment, toast, hero stats
 */
import { getAuthHeader, currentUser } from './guard.js';
import { initDashboardChat } from './dashboard-chat.js';

// ============================================================
//  STATE
// ============================================================
let allCourses   = [];   // Full catalog from API
let activeTab    = 'catalog';
let searchQuery  = '';
let enrolledIds  = [];
let completedIds = [];
let enrolling    = new Set(); // Course IDs currently being enrolled
let userProgressList = []; // Real-time user progress entries

let convertedPrice = 0.00;
let selectedCurrency = 'USD';
let exchangeRatesCache = {};
const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    CAD: 'C$'
};

// Helper to load dynamic scripts (e.g. Paystack Inline SDK)
function loadScript(url, alreadyLoadedCheck) {
    return new Promise((resolve, reject) => {
        if (alreadyLoadedCheck && alreadyLoadedCheck()) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load script: ' + url));
        document.head.appendChild(script);
    });
}

// Exchange rate fetching with fallback mechanism
async function fetchExchangeRates(base) {
    if (exchangeRatesCache[base]) {
        return exchangeRatesCache[base];
    }
    try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('Exchange rate API returned ' + res.status);
        const data = await res.json();
        if (data && data.rates && data.result === 'success') {
            exchangeRatesCache[base] = data.rates;
            return data.rates;
        }
        throw new Error('Unexpected exchange rate response format');
    } catch (e) {
        console.warn('Using hardcoded fallback exchange rates:', e.message);
    }
    
    // Hardcoded fallback exchange rates (relative to USD)
    const usdFallback = {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.79,
        NGN: 1500.0,
        CAD: 1.37
    };
    
    if (base === 'USD') {
        return usdFallback;
    }
    
    // Cross-convert using USD as base for fallback
    const baseToUsd = 1.0 / (usdFallback[base] || 1.0);
    const rates = {};
    for (const cur in usdFallback) {
        rates[cur] = usdFallback[cur] * baseToUsd;
    }
    return rates;
}

// ============================================================
//  BOOTSTRAP
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    setupUserInfo();
    setupGreeting();
    setupTabs();
    setupSearch();
    setupLogout();
    setupMobileSidebar();
    setupHeroButtons();
    setupPaymentModal();
    initDashboardChat();
    await loadData();
    
    // URL parameter tab routing
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['enrolled', 'catalog', 'completed'].includes(tabParam)) {
        switchTab(tabParam);
    } else {
        switchTab('catalog');
    }
});

// ============================================================
//  USER INFO
// ============================================================
function setupUserInfo() {
    const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');

    enrolledIds  = (user.enrolledCourses  || []).slice();
    completedIds = (user.completedCourses || []).slice();

    const name   = user.name || user.email || 'Student';
    const firstName = name.split(' ')[0];
    const initials  = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Sidebar
    const sidebarName = document.getElementById('sidebarName');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    if (sidebarName)  sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = initials;

    // Hero
    const heroName = document.getElementById('heroName');
    if (heroName) heroName.textContent = firstName + ' 👋';

    updateBadges();
}

function updateBadges() {
    const enrolledBadge   = document.getElementById('enrolledBadge');
    const completedBadge  = document.getElementById('completedBadge');
    const tabCountEnrolled  = document.getElementById('tabCountEnrolled');
    const tabCountCompleted = document.getElementById('tabCountCompleted');

    const eCount = enrolledIds.filter(id => !completedIds.includes(id)).length;
    const cCount = completedIds.length;

    if (enrolledBadge)    enrolledBadge.textContent   = eCount;
    if (completedBadge)   completedBadge.textContent  = cCount;
    if (tabCountEnrolled)  tabCountEnrolled.textContent  = eCount;
    if (tabCountCompleted) tabCountCompleted.textContent = cCount;

    // Update hero stats (basic)
    const heroEnrolledCount  = document.getElementById('heroEnrolledCount');
    const heroCompletedCount = document.getElementById('heroCompletedCount');
    if (heroEnrolledCount)  heroEnrolledCount.textContent  = enrolledIds.length;
    if (heroCompletedCount) heroCompletedCount.textContent = completedIds.length;
}

// ============================================================
//  GREETING (time-of-day)
// ============================================================
function setupGreeting() {
    const hour = new Date().getHours();
    let greet = 'Good morning';
    let icon  = 'fa-sun';

    if (hour >= 12 && hour < 17) { greet = 'Good afternoon'; icon = 'fa-cloud-sun'; }
    else if (hour >= 17)          { greet = 'Good evening';   icon = 'fa-moon'; }

    const el = document.getElementById('heroTimeGreeting');
    if (el) el.textContent = greet;

    const iconEl = el?.parentElement?.querySelector('i');
    if (iconEl) iconEl.className = `fa-solid ${icon}`;
}

// ============================================================
//  TABS
// ============================================================
function setupTabs() {
    ['tabEnrolled', 'tabCatalog', 'tabCompleted'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });

    // Sidebar nav tab shortcuts
    ['navEnrolled', 'navCatalog', 'navCompleted'].forEach(id => {
        const link = document.getElementById(id);
        if (!link) return;
        link.addEventListener('click', e => {
            e.preventDefault();
            const tab = link.dataset.tab;
            switchTab(tab);
        });
    });

    // Bottom nav tab shortcuts
    ['bottomNavDashboard', 'bottomNavCatalog', 'bottomNavCompleted'].forEach(id => {
        const link = document.getElementById(id);
        if (!link) return;
        link.addEventListener('click', e => {
            e.preventDefault();
            const tab = link.dataset.tab || 'enrolled';
            switchTab(tab);
            
            // Update query param without reloading to keep URL in sync
            const url = new URL(window.location);
            url.searchParams.set('tab', tab);
            window.history.pushState({}, '', url);
        });
    });
}

function switchTab(tab) {
    activeTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
        btn.setAttribute('aria-selected', btn.dataset.tab === tab ? 'true' : 'false');
    });

    // Update bottom nav link active class
    ['bottomNavDashboard', 'bottomNavCatalog', 'bottomNavCompleted'].forEach(id => {
        const link = document.getElementById(id);
        if (!link) return;
        const isActive = link.dataset.tab === tab;
        link.classList.toggle('active', isActive);
    });

    // Update section title
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) {
        const titles = {
            enrolled:  'My Enrolled Courses',
            catalog:   'All Available Courses',
            completed: 'Completed Courses',
        };
        titleEl.textContent = titles[tab] || 'Courses';
    }

    // Close mobile sidebar
    closeMobileSidebar();

    renderCourses();
}

// ============================================================
//  SEARCH
// ============================================================
function setupSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', () => {
        searchQuery = input.value.trim().toLowerCase();
        renderCourses();
    });
}

// ============================================================
//  HERO QUICK BUTTONS
// ============================================================
function setupHeroButtons() {
    const resumeBtn = document.getElementById('heroResumeBtn');
    const browseBtn = document.getElementById('heroBrowseBtn');

    if (resumeBtn) {
        resumeBtn.addEventListener('click', e => {
            e.preventDefault();
            // Find an enrolled non-completed course and go to it
            const next = allCourses.find(c => enrolledIds.includes(c.id) && !completedIds.includes(c.id));
            if (next) {
                window.location.href = `course.html?id=${next.id}`;
            } else {
                switchTab('enrolled');
            }
        });
    }

    if (browseBtn) {
        browseBtn.addEventListener('click', e => {
            e.preventDefault();
            switchTab('catalog');
        });
    }
}

// ============================================================
//  DATA LOADING
// ============================================================
async function loadData() {
    try {
        const res = await fetch('../api/courses/index.php', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        allCourses = await res.json();

        // Fetch real-time enrollments and progress from API
        const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.id) {
            // 1. Fetch real-time enrollments
            try {
                const enrollRes = await fetch('../api/learning/enroll.php', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                });
                if (enrollRes.ok) {
                    enrolledIds = await enrollRes.json();
                }
            } catch (enrollErr) {
                console.error('Failed to load real-time enrollments:', enrollErr);
            }

            // 2. Fetch real-time progress records
            try {
                const progRes = await fetch(`../api/learning/progress.php?user_id=${user.id}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                });
                if (progRes.ok) {
                    userProgressList = await progRes.json();
                }
            } catch (progErr) {
                console.error('Failed to load user progress:', progErr);
            }

            // Calculate completedIds dynamically based on progress records
            completedIds = [];
            allCourses.forEach(course => {
                const total = parseInt(course.totalLessons || 0);
                if (total > 0 && enrolledIds.includes(course.id)) {
                    const completed = userProgressList.filter(p => p.courseId === course.id && p.isCompleted).length;
                    if (completed >= total) {
                        completedIds.push(course.id);
                    }
                }
            });

            // Keep user object in localStorage updated
            const localUser = JSON.parse(localStorage.getItem('user') || '{}');
            localUser.enrolledCourses = enrolledIds;
            localUser.completedCourses = completedIds;
            localStorage.setItem('user', JSON.stringify(localUser));
        }

        // Count catalog courses (not enrolled)
        const catalogCount = allCourses.filter(c => !enrolledIds.includes(c.id)).length;
        const tabCountCatalog = document.getElementById('tabCountCatalog');
        if (tabCountCatalog) tabCountCatalog.textContent = catalogCount;

        updateBadges();
        updateHeroProgressStat();
        renderCourses();

    } catch (err) {
        console.error('Failed to load courses:', err);
        showError('Failed to load courses. Please refresh the page.');
        const grid = document.getElementById('coursesGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <h3>Something went wrong</h3>
                    <p>We couldn't load the courses. Check your connection and try again.</p>
                    <button class="empty-cta" onclick="location.reload()">
                        <i class="fa-solid fa-rotate-right"></i> Retry
                    </button>
                </div>`;
        }
    }
}

function updateHeroProgressStat() {
    const heroProgressPct = document.getElementById('heroProgressPct');
    if (!heroProgressPct) return;

    const enrolled = allCourses.filter(c => enrolledIds.includes(c.id));
    if (enrolled.length === 0) {
        heroProgressPct.textContent = '0%';
        return;
    }

    const completedCount = completedIds.length;
    const pct = Math.round((completedCount / enrolled.length) * 100);
    heroProgressPct.textContent = pct + '%';
}

// ============================================================
//  RENDER
// ============================================================
function renderCourses() {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    let courses = [];

    if (activeTab === 'enrolled') {
        courses = allCourses.filter(c => enrolledIds.includes(c.id) && !completedIds.includes(c.id));
    } else if (activeTab === 'completed') {
        courses = allCourses.filter(c => completedIds.includes(c.id));
    } else {
        // Catalog: show all non-enrolled
        courses = allCourses.filter(c => !enrolledIds.includes(c.id));
    }

    // Apply search filter
    if (searchQuery) {
        courses = courses.filter(c =>
            c.title?.toLowerCase().includes(searchQuery) ||
            c.category?.toLowerCase().includes(searchQuery) ||
            c.description?.toLowerCase().includes(searchQuery)
        );
    }

    grid.innerHTML = '';

    if (courses.length === 0) {
        grid.appendChild(buildEmptyState(activeTab, !!searchQuery));
        return;
    }

    courses.forEach((course, i) => {
        const card = buildCard(course);
        card.style.animationDelay = `${i * 0.05}s`;
        grid.appendChild(card);
    });
}

// ============================================================
//  CARD BUILDER
// ============================================================
function buildCard(course) {
    const isEnrolled  = enrolledIds.includes(course.id);
    const isCompleted = completedIds.includes(course.id);

    // Calculate actual progress based on userProgressList
    let progress = -1;
    if (isEnrolled) {
        if (isCompleted) {
            progress = 100;
        } else {
            const total = parseInt(course.totalLessons || 0);
            if (total > 0) {
                const completed = userProgressList.filter(p => p.courseId === course.id && p.isCompleted).length;
                progress = Math.round((completed / total) * 100);
                if (progress > 100) progress = 100;
            } else {
                progress = 0;
            }
        }
    }

    const imgUrl = course.thumbnailUrl
        || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop';

    const rating = parseFloat(course.rating || 4.8).toFixed(1);
    const lessons = course.totalLessons || '?';
    const duration = course.duration || 'Self-paced';
    const price = parseFloat(course.price || 0.00);

    let btnClass = 'enroll';
    let btnText  = 'Enroll Free';
    let btnIcon  = 'fa-graduation-cap';

    if (isCompleted) {
        btnClass = 'review'; btnText = 'Review Course'; btnIcon = 'fa-rotate-right';
    } else if (isEnrolled && progress > 0) {
        btnClass = 'continue'; btnText = 'Continue'; btnIcon = 'fa-play';
    } else if (isEnrolled) {
        btnClass = 'start'; btnText = 'Start Learning'; btnIcon = 'fa-play';
    } else if (price > 0) {
        const curSymbol = currencySymbols[course.currency || 'USD'] || '$';
        btnClass = 'enroll buy'; btnText = `Enrol (${curSymbol}${price.toFixed(2)})`; btnIcon = 'fa-credit-card';
    }

    const progressHtml = (isEnrolled && progress >= 0) ? `
        <div class="card-progress">
            <div class="progress-top">
                <span class="progress-label">Progress</span>
                <span class="progress-pct">${progress}%</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width:${progress}%"></div>
            </div>
        </div>` : '';

    const statusBadge = isCompleted
        ? `<span class="card-status-badge completed"><i class="fa-solid fa-check mr-1"></i>Done</span>`
        : isEnrolled
        ? `<span class="card-status-badge enrolled"><i class="fa-solid fa-bolt mr-1"></i>Active</span>`
        : '';

    const card = document.createElement('div');
    card.className = 'course-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', course.title);
    card.id = `card-${course.id}`;

    card.innerHTML = `
        <div class="enrolling-overlay" id="overlay-${course.id}">
            <div class="spinner"></div>
        </div>
        <div class="card-thumb">
            <img src="${imgUrl}" alt="${course.title}" loading="lazy" onerror="this.style.display='none'">
            <div class="card-thumb-overlay"></div>
            <span class="card-category-badge">${course.category || 'Theology'}</span>
            ${statusBadge}
            ${price > 0 && !isEnrolled ? `<span class="card-price-badge" style="position: absolute; bottom: 10px; left: 12px; background: linear-gradient(135deg, #1b5e20 0%, #2E7D32 100%); color: #fff; font-size: 11.5px; font-weight: 800; padding: 3px 10px; border-radius: 100px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); backdrop-filter: blur(8px);">${currencySymbols[course.currency || 'USD'] || '$'}${price.toFixed(2)}</span>` : ''}
            <div class="card-rating">
                <i class="fa-solid fa-star"></i>
                ${rating}
            </div>
        </div>
        <div class="card-body">
            <div class="card-meta">
                <span class="card-meta-item">
                    <i class="fa-solid fa-layer-group"></i>
                    ${lessons} lessons
                </span>
                <span class="card-meta-item">
                    <i class="fa-regular fa-clock"></i>
                    ${duration}
                </span>
                ${course.hasQuizzes == 1 ? `<span class="card-meta-item"><i class="fa-solid fa-circle-question"></i>Quizzes</span>` : ''}
            </div>
            <h3 class="card-title">${course.title}</h3>
            <p class="card-desc">${course.description || 'Deepen your understanding of the faith through this expertly crafted course.'}</p>
            ${progressHtml}
            <button class="card-cta ${btnClass}" data-id="${course.id}" data-enrolled="${isEnrolled ? '1' : '0'}">
                <i class="fa-solid ${btnIcon}"></i>
                ${btnText}
            </button>
        </div>`;

    // Card CTA click
    const cta = card.querySelector('.card-cta');
    cta.addEventListener('click', e => {
        e.stopPropagation();
        handleCtaClick(course, isEnrolled, isCompleted);
    });

    // Full card click (if already enrolled)
    card.addEventListener('click', () => {
        if (isEnrolled) {
            window.location.href = `course.html?id=${course.id}`;
        }
    });

    return card;
}

// ============================================================
//  CTA HANDLER
// ============================================================
async function handleCtaClick(course, isEnrolled, isCompleted) {
    if (isCompleted || isEnrolled) {
        window.location.href = `course.html?id=${course.id}`;
        return;
    }

    const price = parseFloat(course.price || 0.00);
    if (price > 0) {
        openPaymentModal(course);
        return;
    }

    // Enroll in course
    if (enrolling.has(course.id)) return;
    enrolling.add(course.id);

    const overlay = document.getElementById(`overlay-${course.id}`);
    if (overlay) overlay.classList.add('show');

    try {
        const res = await fetch('../api/learning/enroll.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ courseId: course.id }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Enrollment failed');

        // Update local state
        if (!enrolledIds.includes(course.id)) {
            enrolledIds.push(course.id);
        }

        // Persist updated enrolled list to localStorage user object
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.enrolledCourses = enrolledIds;
        localStorage.setItem('user', JSON.stringify(user));

        showSuccess(`🎉 You're now enrolled in "${course.title}"!`);
        updateBadges();
        updateHeroProgressStat();

        // Short delay then redirect to the course
        setTimeout(() => {
            window.location.href = `course.html?id=${course.id}`;
        }, 1200);

    } catch (err) {
        console.error('Enrollment error:', err);
        showError(err.message || 'Could not enroll. Please try again.');
        enrolling.delete(course.id);
        const overlay = document.getElementById(`overlay-${course.id}`);
        if (overlay) overlay.classList.remove('show');
    }
}

// ============================================================
//  EMPTY STATES
// ============================================================
function buildEmptyState(tab, isSearch) {
    const wrapper = document.createElement('div');
    wrapper.className = 'empty-state';

    if (isSearch) {
        wrapper.innerHTML = `
            <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
            <h3>No results found</h3>
            <p>No courses match your search. Try a different keyword.</p>
            <button class="empty-cta" id="clearSearchBtn">
                <i class="fa-solid fa-xmark"></i> Clear Search
            </button>`;
        setTimeout(() => {
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) { searchInput.value = ''; }
                    searchQuery = '';
                    renderCourses();
                });
            }
        }, 0);
        return wrapper;
    }

    const configs = {
        enrolled: {
            icon:  'fa-book-open',
            title: 'No enrolled courses yet',
            text:  'Browse our catalog and enroll in courses to start your learning journey.',
            cta:   'Browse Catalog',
            ctaFn: () => switchTab('catalog'),
        },
        completed: {
            icon:  'fa-circle-check',
            title: 'No completed courses yet',
            text:  'Keep learning! Finish a course and it will appear here with your certificate.',
            cta:   'Continue Learning',
            ctaFn: () => switchTab('enrolled'),
        },
        catalog: {
            icon:  'fa-layer-group',
            title: 'No courses available',
            text:  'Our library is being updated. Check back soon for new content.',
            cta:   null,
            ctaFn: null,
        },
    };

    const cfg = configs[tab] || configs.enrolled;
    wrapper.innerHTML = `
        <div class="empty-icon"><i class="fa-solid ${cfg.icon}"></i></div>
        <h3>${cfg.title}</h3>
        <p>${cfg.text}</p>
        ${cfg.cta ? `<button class="empty-cta" id="emptyCtaBtn"><i class="fa-solid fa-compass"></i> ${cfg.cta}</button>` : ''}`;

    if (cfg.cta && cfg.ctaFn) {
        setTimeout(() => {
            const btn = document.getElementById('emptyCtaBtn');
            if (btn) btn.addEventListener('click', cfg.ctaFn);
        }, 0);
    }

    return wrapper;
}

// ============================================================
//  LOGOUT
// ============================================================
function setupLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('index.html');
    });
}

// ============================================================
//  MOBILE SIDEBAR
// ============================================================
function setupMobileSidebar() {
    const hamburger = document.getElementById('hamburgerBtn');
    const overlay   = document.getElementById('sidebarOverlay');

    if (hamburger) hamburger.addEventListener('click', openMobileSidebar);
    if (overlay)   overlay.addEventListener('click', closeMobileSidebar);
}

function openMobileSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebarOverlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
}

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================
let toastTimer = null;

function showToast(message, type = 'success') {
    const toast   = document.getElementById('toast');
    const msgEl   = document.getElementById('toastMessage');
    const iconEl  = document.getElementById('toastIcon');

    if (!toast || !msgEl || !iconEl) return;

    msgEl.textContent = message;
    toast.className   = `toast ${type}`;
    iconEl.className  = type === 'success'
        ? 'fa-solid fa-circle-check'
        : 'fa-solid fa-circle-exclamation';

    // Show
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function showSuccess(msg) { showToast(msg, 'success'); }
function showError(msg)   { showToast(msg, 'error'); }

// ============================================================
//  PAYMENT SYSTEM (SIMULATED CHECKOUT)
// ============================================================
let currentPayingCourse = null;
let selectedGateway = 'stripe';

function setupPaymentModal() {
    const backdrop = document.getElementById('paymentModalBackdrop');
    const closeBtn = document.getElementById('paymentModalClose');
    const form     = document.getElementById('paymentForm');
    const currencySelect = document.getElementById('paymentCurrency');

    if (!backdrop || !closeBtn || !form) return;

    // Close modal triggers
    closeBtn.addEventListener('click', () => closePaymentModal());
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closePaymentModal();
    });

    // Gateway Selection Handling
    const gatewayButtons = document.querySelectorAll('#gatewaySelectorList .gateway-btn');
    gatewayButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            gatewayButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectPaymentGateway(btn.dataset.gateway);
        });
    });

    // Currency Selection Handling
    if (currencySelect) {
        currencySelect.addEventListener('change', () => {
            updateConvertedPrice();
        });
    }

    // Form inputs and live previews
    const nameInput = document.getElementById('cardholderName');
    const numInput  = document.getElementById('cardNumber');
    const expInput  = document.getElementById('cardExpiry');
    const cvvInput  = document.getElementById('cardCvv');

    nameInput.addEventListener('input', () => {
        document.getElementById('cardPreviewName').textContent = nameInput.value.toUpperCase() || 'YOUR NAME';
    });

    numInput.addEventListener('input', (e) => {
        let value = numInput.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) formatted += ' ';
            formatted += value[i];
        }
        numInput.value = formatted;
        document.getElementById('cardPreviewNum').textContent = formatted || '•••• •••• •••• ••••';
    });

    expInput.addEventListener('input', (e) => {
        let value = expInput.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (value.length > 2) {
            expInput.value = value.slice(0, 2) + '/' + value.slice(2, 4);
        } else {
            expInput.value = value;
        }
        document.getElementById('cardPreviewExpiry').textContent = expInput.value || 'MM/YY';
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentPayingCourse) return;

        if (selectedGateway === 'paystack') {
            payWithPaystack();
        } else {
            submitPaymentToServer();
        }
    });
}

async function updateConvertedPrice() {
    if (!currentPayingCourse) return;
    
    const coursePrice = parseFloat(currentPayingCourse.price || 0.00);
    const baseCur = currentPayingCourse.currency || 'USD';
    
    const currencySelect = document.getElementById('paymentCurrency');
    const targetCur = currencySelect ? currencySelect.value : 'USD';
    
    const paySubmitBtn = document.getElementById('paySubmitBtn');
    if (paySubmitBtn) paySubmitBtn.disabled = true;
    
    let rates = {};
    try {
        rates = await fetchExchangeRates(baseCur);
    } catch (err) {
        console.error('Exchange rate error:', err);
    } finally {
        if (paySubmitBtn) paySubmitBtn.disabled = false;
    }
    
    const rate = rates[targetCur] || 1.0;
    convertedPrice = coursePrice * rate;
    selectedCurrency = targetCur;
    
    selectPaymentGateway(selectedGateway);
}

async function payWithPaystack() {
    const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    const email = user.email || 'student@lcmbiblecollege.org';
    const amountInKobo = Math.round(convertedPrice * 100);

    const btn = document.getElementById('paySubmitBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        // Load Paystack v2 inline SDK (avoids the CORP-restricted CSS issue in v1)
        await loadScript(
            'https://js.paystack.co/v2/inline.js',
            () => typeof PaystackPop !== 'undefined'
        );

        const popup = new PaystackPop();
        popup.newTransaction({
            key: 'pk_test_e02301d81ac02e107bb1b462bb221b95fb58a6d7',
            email: email,
            amount: amountInKobo,
            currency: selectedCurrency,
            ref: 'LCM-PS-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
            onSuccess: function(transaction) {
                submitPaymentToServer(transaction.reference);
            },
            onCancel: function() {
                showError('Paystack checkout was cancelled.');
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        });
    } catch (err) {
        console.error('Paystack SDK error:', err);
        showError('Could not initialize Paystack checkout. Please try another payment method.');
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

async function submitPaymentToServer(reference = null) {
    const btn = document.getElementById('paySubmitBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const response = await fetch('../api/payments/index.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                courseId: currentPayingCourse.id,
                gateway: selectedGateway,
                currency: selectedCurrency,
                amount: convertedPrice,
                reference: reference
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Payment simulation failed.');
        }

        enrolledIds = data.enrolledCourses || enrolledIds;

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.enrolledCourses = enrolledIds;
        localStorage.setItem('user', JSON.stringify(user));

        const displayGateway = selectedGateway.charAt(0).toUpperCase() + selectedGateway.slice(1);
        showSuccess(`💳 Payment processed via ${displayGateway}! Enrolled in "${currentPayingCourse.title}"`);
        closePaymentModal();

        updateBadges();
        updateHeroProgressStat();
        renderCourses();

        setTimeout(() => {
            window.location.href = `course.html?id=${currentPayingCourse.id}`;
        }, 1200);

    } catch (err) {
        console.error('Payment error:', err);
        showError(err.message || 'Payment processing failed. Please try again.');
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function selectPaymentGateway(gateway) {
    selectedGateway = gateway;
    const symbol = currencySymbols[selectedCurrency] || '$';
    const formattedPrice = `${symbol}${convertedPrice.toFixed(2)}`;

    const infoText = document.getElementById('gatewayInfoText');
    const cardPreview = document.getElementById('creditCardPreviewWrap');
    const cardInputs = document.getElementById('cardInputsContainer');
    const brandIcon = document.getElementById('cardBrandIcon');
    const payBtnText = document.getElementById('payBtnText');

    const nameInput = document.getElementById('cardholderName');
    const numInput  = document.getElementById('cardNumber');
    const expInput  = document.getElementById('cardExpiry');
    const cvvInput  = document.getElementById('cardCvv');

    if (gateway === 'stripe') {
        infoText.textContent = "Pay securely with Stripe Elements. Input card details below.";
        cardPreview.style.display = 'flex';
        cardInputs.style.display = 'block';
        brandIcon.className = "fa-brands fa-cc-visa";
        payBtnText.textContent = `Pay ${formattedPrice} & Enroll`;
        
        nameInput.required = true;
        numInput.required = true;
        expInput.required = true;
        cvvInput.required = true;
    } 
    else if (gateway === 'sandbox') {
        infoText.textContent = "Simulated card sandbox checkout. Input card details below.";
        cardPreview.style.display = 'flex';
        cardInputs.style.display = 'block';
        brandIcon.className = "fa-solid fa-vial";
        payBtnText.textContent = `Pay ${formattedPrice} & Enroll (Sandbox)`;

        nameInput.required = true;
        numInput.required = true;
        expInput.required = true;
        cvvInput.required = true;
    } 
    else if (gateway === 'paystack') {
        infoText.textContent = "Open secure Paystack Inline pop-up checkout. Enrolls automatically upon success.";
        cardPreview.style.display = 'none';
        cardInputs.style.display = 'none';
        payBtnText.textContent = `Pay ${formattedPrice} via Paystack`;

        nameInput.required = false;
        numInput.required = false;
        expInput.required = false;
        cvvInput.required = false;
    } 
    else if (gateway === 'flutterwave') {
        infoText.textContent = "Redirects to secure Flutterwave hosted checkout portal. Enrolls automatically upon success.";
        cardPreview.style.display = 'none';
        cardInputs.style.display = 'none';
        payBtnText.textContent = `Pay ${formattedPrice} via Flutterwave`;

        nameInput.required = false;
        numInput.required = false;
        expInput.required = false;
        cvvInput.required = false;
    }
}

function openPaymentModal(course) {
    currentPayingCourse = course;
    
    // Set course native currency on dropdown
    const paymentCurrencySelect = document.getElementById('paymentCurrency');
    if (paymentCurrencySelect) {
        paymentCurrencySelect.value = course.currency || 'USD';
    }
    
    // Set title
    document.getElementById('paymentModalTitle').textContent = `Checkout: ${course.title}`;
    
    // Trigger price conversion first
    updateConvertedPrice();
    
    // Select default Stripe gateway on open
    const defaultBtn = document.querySelector('#gatewaySelectorList [data-gateway="stripe"]');
    if (defaultBtn) {
        document.querySelectorAll('#gatewaySelectorList .gateway-btn').forEach(b => b.classList.remove('active'));
        defaultBtn.classList.add('active');
        selectedGateway = 'stripe';
    }

    // Reset inputs
    document.getElementById('paymentForm').reset();
    document.getElementById('cardPreviewName').textContent = 'YOUR NAME';
    document.getElementById('cardPreviewNum').textContent = '•••• •••• •••• ••••';
    document.getElementById('cardPreviewExpiry').textContent = 'MM/YY';

    // Show modal
    const backdrop = document.getElementById('paymentModalBackdrop');
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => {
        backdrop.classList.add('show');
    });
}

function closePaymentModal() {
    const backdrop = document.getElementById('paymentModalBackdrop');
    backdrop.classList.remove('show');
    setTimeout(() => {
        backdrop.style.display = 'none';
        currentPayingCourse = null;
    }, 300);
}

