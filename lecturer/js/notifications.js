/**
 * Lifechangers Ministerial College — Shared Notifications Controller
 * Handles notification fetching, dropdown open/close, badge updating,
 * and feed rendering for both Dashboard and Chat pages.
 */

const API_BASE = '../api';

let notifData = { pending_submissions: [], unread_chat: [], new_enrollments: [], progress_alerts: [] };
let activeNotifTab = 'all';
let notifOpen = false;
let prevNotifCount = 0;
let getAuthHeaderFn = null;
let configOptions = {};

function friendlyTime(datetimeStr) {
    if (!datetimeStr) return '';
    const date = new Date(datetimeStr.replace(/-/g, '/').replace(' ', 'T'));
    const now = new Date();
    const diffMin = Math.floor((now - date) / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;

    return date.getFullYear() === now.getFullYear()
        ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export async function loadNotifications() {
    if (!getAuthHeaderFn) return;
    try {
        const res = await fetch(`${API_BASE}/notifications/index.php`, { headers: getAuthHeaderFn() });
        if (!res.ok) return;
        const data = await res.json();
        notifData = data;
        updateNotifBadges(data);
        renderNotifDropdown(activeNotifTab);

        // Bell ring animation on count increase
        const currentCount = data.total_count || 0;
        if (currentCount > prevNotifCount) {
            const bellIcon = document.querySelector('#notifBtn i');
            if (bellIcon) {
                bellIcon.classList.add('bell-ring');
                setTimeout(() => bellIcon.classList.remove('bell-ring'), 600);
            }
        }
        prevNotifCount = currentCount;
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function updateNotifBadges(data) {
    const totalCount = data.total_count || 0;
    
    // Topbar bell badge
    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.textContent = totalCount;
        badge.classList.toggle('hidden', totalCount === 0);
    }

    // Dropdown header total badge
    const totalBadge = document.getElementById('notifTotalBadge');
    if (totalBadge) {
        totalBadge.textContent = totalCount;
    }

    // Tab sub-badges
    const submissionsCount = (data.pending_submissions || []).length;
    const tabBadgeSubmissions = document.getElementById('tabBadgeSubmissions');
    if (tabBadgeSubmissions) {
        tabBadgeSubmissions.textContent = submissionsCount;
        tabBadgeSubmissions.classList.toggle('hidden', submissionsCount === 0);
    }

    const chatCount = (data.unread_chat || []).length;
    const tabBadgeChat = document.getElementById('tabBadgeChat');
    if (tabBadgeChat) {
        tabBadgeChat.textContent = chatCount;
        tabBadgeChat.classList.toggle('hidden', chatCount === 0);
    }
}

function renderNotifDropdown(tab) {
    const feed = document.getElementById('notifFeed');
    if (!feed) return;

    let items = [];

    // Compile items based on active tab
    if (tab === 'all' || tab === 'submissions') {
        (notifData.pending_submissions || []).forEach(item => {
            items.push({
                type: 'submission',
                time: item.submitted_at,
                html: renderNotifItem(
                    'fa-file-invoice',
                    'notif-icon-amber',
                    `New Submission: ${escapeHtml(item.assignment_title)}`,
                    `${escapeHtml(item.student_name)} · ${escapeHtml(item.course_title)}`,
                    friendlyTime(item.submitted_at),
                    () => handleNotifClick('submission', item)
                )
            });
        });
    }

    if (tab === 'all' || tab === 'chat') {
        (notifData.unread_chat || []).forEach(item => {
            const preview = item.message.length > 60 ? item.message.slice(0, 60) + '…' : item.message;
            items.push({
                type: 'chat',
                time: item.sent_at,
                html: renderNotifItem(
                    'fa-comment',
                    'notif-icon-blue',
                    `Message from ${escapeHtml(item.student_name)}`,
                    `"${escapeHtml(preview)}" · ${escapeHtml(item.course_title)}`,
                    friendlyTime(item.sent_at),
                    () => handleNotifClick('chat', item)
                )
            });
        });
    }

    if (tab === 'all' || tab === 'enrollments') {
        (notifData.new_enrollments || []).forEach(item => {
            items.push({
                type: 'enrollment',
                time: item.enrolled_at,
                html: renderNotifItem(
                    'fa-user-plus',
                    'notif-icon-green',
                    `${escapeHtml(item.student_name)} enrolled`,
                    `in ${escapeHtml(item.course_title)}`,
                    friendlyTime(item.enrolled_at),
                    () => handleNotifClick('enrollment', item)
                )
            });
        });
    }

    if (tab === 'all' || tab === 'alerts') {
        (notifData.progress_alerts || []).forEach(item => {
            items.push({
                type: 'alert',
                time: item.updated_at,
                html: renderNotifItem(
                    'fa-triangle-exclamation',
                    'notif-icon-red',
                    `Low Quiz Score: ${escapeHtml(item.student_name)}`,
                    `${item.last_quiz_score}% in ${escapeHtml(item.lesson_title || item.course_title)}`,
                    friendlyTime(item.updated_at),
                    () => handleNotifClick('alert', item)
                )
            });
        });
    }

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (items.length === 0) {
        feed.innerHTML = `
            <div class="notif-empty">
                <i class="fa-regular fa-bell-slash"></i>
                <p>No notifications in this category</p>
            </div>`;
        return;
    }

    feed.innerHTML = '';
    
    // If 'all' tab, we can group or show section labels, but a sorted list is clean and readable.
    // Let's render the list items and append them
    items.forEach(item => {
        feed.appendChild(item.html);
    });
}

function renderNotifItem(iconClass, iconBgClass, title, detail, time, onClick) {
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `
        <div class="notif-icon ${iconBgClass}">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="min-w-0 flex-1">
            <h4 class="notif-title">${title}</h4>
            <p class="notif-detail">${detail}</p>
            <p class="notif-time">${time}</p>
        </div>
    `;
    item.addEventListener('click', (e) => {
        // Close dropdown
        notifOpen = false;
        document.getElementById('notifDropdown').classList.add('hidden');
        onClick();
    });
    return item;
}

function handleNotifClick(type, item) {
    if (type === 'chat') {
        if (configOptions.onChatSelect) {
            configOptions.onChatSelect(item.course_id, item.student_id, item.student_name, item.course_title);
        } else {
            // Redirect to chat.html and pass params via hash or query param if needed
            window.location.href = `chat.html#chat-${item.course_id}-${item.student_id}`;
        }
    } else if (type === 'submission') {
        if (configOptions.onTabSwitch) {
            configOptions.onTabSwitch('submissions');
        } else {
            window.location.href = 'dashboard.html#submissions';
        }
    } else if (type === 'enrollment' || type === 'alert') {
        if (configOptions.onTabSwitch) {
            configOptions.onTabSwitch('students');
        } else {
            window.location.href = 'dashboard.html#students';
        }
    }
}

export function initNotifications(getAuthHeader, options = {}) {
    getAuthHeaderFn = getAuthHeader;
    configOptions = options;

    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifContainer = document.getElementById('notifContainer');
    const notifRefreshBtn = document.getElementById('notifRefreshBtn');

    if (!notifBtn || !notifDropdown) return;

    // Toggle dropdown
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifOpen = !notifOpen;
        notifDropdown.classList.toggle('hidden', !notifOpen);
        if (notifOpen) {
            loadNotifications();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (notifContainer && !notifContainer.contains(e.target)) {
            notifDropdown.classList.add('hidden');
            notifOpen = false;
        }
    });

    // Tab switching
    document.querySelectorAll('.notif-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active-notif-tab'));
            btn.classList.add('active-notif-tab');
            activeNotifTab = btn.dataset.notifTab;
            renderNotifDropdown(activeNotifTab);
        });
    });

    // Refresh button
    if (notifRefreshBtn) {
        notifRefreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadNotifications();
        });
    }

    // Initial load
    loadNotifications();

    // Poll every 30 seconds
    setInterval(loadNotifications, 30000);
}
