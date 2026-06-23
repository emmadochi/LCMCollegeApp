import { initNotifications } from './notifications.js';

const API_BASE = '../api';

// ── State ───────────────────────────────────────────────────────────────────
let currentUser       = null;
let activeCourseId    = null;
let activeStudentId   = null;
let activeStudentName = '';
let activeCourseTitle = '';
let pollInterval      = null;   // message poller (3 s)
let inboxInterval     = null;   // inbox poller  (8 s)
let threads           = [];     // cached full thread list

// ── Auth ─────────────────────────────────────────────────────────────────────

function parseJwt(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(
            window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        ));
    } catch { return null; }
}

function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function guardAuth() {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { window.location.replace('login.html'); return false; }

    const payload = parseJwt(token);
    if (!payload || !payload.exp || payload.exp < Date.now() / 1000) {
        localStorage.clear();
        window.location.replace('login.html');
        return false;
    }

    const user = JSON.parse(userStr);
    if (!['lecturer', 'admin', 'coordinator'].includes(user.role)) {
        window.location.replace('login.html');
        return false;
    }

    currentUser = user;
    return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function friendlyTime(datetimeStr) {
    if (!datetimeStr) return '';
    const date    = new Date(datetimeStr.replace(/-/g, '/'));
    const now     = new Date();
    const diffMin = Math.floor((now - date) / 60000);

    if (diffMin < 1)  return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const isToday = date.toDateString() === now.toDateString();
    const time    = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function showToast(message, type = 'success') {
    const toast   = document.getElementById('toast');
    const icon    = document.getElementById('toastIcon');
    const msgEl   = document.getElementById('toastMessage');
    if (!toast) return;
    msgEl.textContent = message;
    icon.className = type === 'error'
        ? 'fa-solid fa-circle-exclamation text-red-400'
        : 'fa-solid fa-circle-check text-primary';
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3200);
}

function selectThreadFromHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#chat-')) {
        const parts = hash.split('-');
        if (parts.length === 3) {
            const courseId = parseInt(parts[1]) || parts[1];
            const studentId = parseInt(parts[2]) || parts[2];
            const thread = threads.find(t => 
                (String(t.course_id) === String(courseId)) && 
                (String(t.student_id) === String(studentId))
            );
            if (thread) {
                selectThread(thread.course_id, thread.student_id, thread.student_name, thread.course_title);
            }
        }
    }
}

// ── Inbox (Thread List) ───────────────────────────────────────────────────────

async function loadInbox() {
    try {
        const res = await fetch(`${API_BASE}/chat/unread.php`, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('Inbox load failed: ' + res.status);

        const data = await res.json();
        threads = data.threads || [];
        renderThreadsList(threads);

        if (!activeStudentId) {
            selectThreadFromHash();
        }

        // Update badge in sidebar
        const badge       = document.getElementById('chatUnreadBadge');
        const headerBadge = document.getElementById('unreadBadgeHeader');
        const count       = data.unread_count || 0;

        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
        if (headerBadge) {
            headerBadge.textContent = `${count} Unread`;
        }
    } catch (err) {
        console.error('Inbox error:', err);
    }
}

function renderThreadsList(list) {
    const container = document.getElementById('threadsListContainer');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-6 text-center text-gray-400 gap-3">
                <i class="fa-regular fa-comment-dots text-4xl text-gray-200"></i>
                <p class="text-sm leading-relaxed">No student conversations yet.<br>They'll appear here once a student sends a message.</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(t => {
        const isActive  = (t.course_id === activeCourseId && t.student_id === activeStudentId);
        const hasUnread = parseInt(t.unread_messages) > 0;
        const preview   = t.latest_message
            ? (t.latest_message.length > 50 ? t.latest_message.slice(0, 50) + '…' : t.latest_message)
            : 'No messages yet';

        const item = document.createElement('div');
        item.className = 'thread-item' + (isActive ? ' active' : '');

        item.innerHTML = `
            <div class="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white shadow-sm" style="background: linear-gradient(135deg,#abcf47,#8ba838)">
                ${initials(t.student_name)}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                    <span class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(t.student_name || 'Student')}</span>
                    <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">${friendlyTime(t.latest_sent_at)}</span>
                </div>
                <div class="text-[11px] text-primaryDark font-semibold truncate mb-0.5">${escapeHtml(t.course_title || '')}</div>
                <div class="flex items-center justify-between">
                    <span class="text-[12px] text-gray-400 truncate flex-1">${escapeHtml(preview)}</span>
                    ${hasUnread
                        ? `<span class="ml-2 flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${t.unread_messages}</span>`
                        : ''}
                </div>
            </div>`;

        item.addEventListener('click', () =>
            selectThread(t.course_id, t.student_id, t.student_name, t.course_title)
        );
        container.appendChild(item);
    });
}

// ── Thread Selection ──────────────────────────────────────────────────────────

function selectThread(courseId, studentId, studentName, courseTitle) {
    activeCourseId    = courseId;
    activeStudentId   = studentId;
    activeStudentName = studentName || 'Student';
    activeCourseTitle = courseTitle || 'Course';

    // Show conversation, hide empty state
    document.getElementById('chatEmptyState').classList.add('hidden');
    const conv = document.getElementById('activeConversation');
    conv.classList.remove('hidden');
    conv.style.display = 'flex';

    // Mobile view transition
    const threadsPanel = document.getElementById('threadsSidebarPanel');
    const chatPanel = document.getElementById('chatWindowPanel');
    if (window.innerWidth < 768) {
        if (threadsPanel) threadsPanel.classList.add('hidden');
        if (chatPanel) {
            chatPanel.classList.remove('hidden');
            chatPanel.classList.add('flex');
        }
    }

    // Update header
    document.getElementById('activeStudentName').textContent = activeStudentName;
    document.getElementById('activeCourseTitle').textContent = activeCourseTitle;
    document.getElementById('chatHeaderAvatar').textContent  = initials(activeStudentName);

    // Re-render thread list to highlight active
    renderThreadsList(threads);

    // Load messages & start polling
    loadMessages();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 3000);

    // Focus input
    const inp = document.getElementById('chatMessageInput');
    if (inp) inp.focus();
}

// ── Messages ──────────────────────────────────────────────────────────────────

async function loadMessages() {
    if (!activeCourseId || !activeStudentId) return;
    try {
        const res = await fetch(
            `${API_BASE}/chat/messages.php?course_id=${activeCourseId}&student_id=${activeStudentId}`,
            { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } }
        );
        if (!res.ok) throw new Error('Messages load failed: ' + res.status);
        const data = await res.json();
        renderMessages(data.messages || []);
    } catch (err) {
        console.error('Messages error:', err);
    }
}

function renderMessages(messages) {
    const stream = document.getElementById('chatStream');
    if (!stream) return;

    if (!messages.length) {
        stream.innerHTML = `
            <div class="flex flex-col items-center justify-center flex-1 text-center text-gray-400 gap-3 py-16">
                <i class="fa-regular fa-comments text-4xl text-gray-200"></i>
                <p class="text-sm">No messages in this thread yet.<br>Start the conversation!</p>
            </div>`;
        return;
    }

    // Preserve scroll if near bottom
    const wasAtBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 80;

    stream.innerHTML = '';
    let lastDate = null;

    messages.forEach(msg => {
        // Date divider
        const msgDate = msg.sent_at
            ? new Date(msg.sent_at.replace(/-/g, '/')).toDateString()
            : null;

        if (msgDate && msgDate !== lastDate) {
            lastDate = msgDate;
            const today   = new Date().toDateString();
            const divider = document.createElement('div');
            divider.className = 'msg-date-divider';
            divider.textContent = msgDate === today
                ? 'Today'
                : new Date(msg.sent_at.replace(/-/g, '/')).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            stream.appendChild(divider);
        }

        const isMe = ['lecturer', 'admin', 'coordinator'].includes(msg.sender_role);
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper ' + (isMe ? 'from-me' : 'from-student');

        let timeStr = '';
        if (msg.sent_at) {
            const d = new Date(msg.sent_at.replace(/-/g, '/'));
            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        wrapper.innerHTML = `
            <div class="msg-bubble">${escapeHtml(msg.message)}</div>
            <span class="msg-meta">${timeStr}${isMe ? ' · You' : ' · ' + escapeHtml(activeStudentName)}</span>`;
        stream.appendChild(wrapper);
    });

    if (wasAtBottom) {
        stream.scrollTop = stream.scrollHeight;
    }
}

// ── Send Message ──────────────────────────────────────────────────────────────

const sendForm = document.getElementById('chatSendForm');
if (sendForm) {
    sendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chatMessageInput');
        const btn   = document.getElementById('chatSendBtn');
        const text  = input.value.trim();
        if (!text || !activeCourseId || !activeStudentId) return;

        // Optimistic clear + disable
        input.value     = '';
        btn.disabled    = true;
        btn.innerHTML   = '<i class="fa-solid fa-spinner fa-spin text-sm"></i>';

        try {
            const res = await fetch(`${API_BASE}/chat/send.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({
                    course_id:  activeCourseId,
                    student_id: activeStudentId,
                    message:    text
                })
            });

            if (res.ok) {
                loadMessages();
                loadInbox();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.message || 'Failed to send message.', 'error');
                input.value = text; // restore on failure
            }
        } catch (err) {
            console.error('Send error:', err);
            showToast('Connection error. Please try again.', 'error');
            input.value = text;
        } finally {
            btn.disabled  = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
            input.focus();
        }
    });
}

// ── Thread Search ─────────────────────────────────────────────────────────────

const searchInput = document.getElementById('threadSearch');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        if (!q) { renderThreadsList(threads); return; }
        renderThreadsList(threads.filter(t =>
            (t.student_name  || '').toLowerCase().includes(q) ||
            (t.course_title  || '').toLowerCase().includes(q)
        ));
    });
}

// ── Keyboard shortcut: Enter to send ─────────────────────────────────────────
document.getElementById('chatMessageInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (!guardAuth()) return;

    // Show body (hidden by default to prevent FOUC)
    document.body.style.display = '';

    // Populate user info in sidebar
    const name  = currentUser.name  || 'Lecturer';
    const email = currentUser.email || '';
    const nameEl  = document.getElementById('lecturerNameDisplay');
    const emailEl = document.getElementById('lecturerEmailDisplay');
    const avEl    = document.getElementById('lecturerAvatar');
    if (nameEl)  nameEl.textContent  = name;
    if (emailEl) emailEl.textContent = email;
    if (avEl)    avEl.textContent    = initials(name);

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (pollInterval)  clearInterval(pollInterval);
            if (inboxInterval) clearInterval(inboxInterval);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.replace('login.html');
        });
    }

    // Initial inbox load + start recurring refresh
    loadInbox();
    inboxInterval = setInterval(loadInbox, 8000);

    // Hash navigation change listener
    window.addEventListener('hashchange', selectThreadFromHash);

    // Mobile Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const openBtn = document.getElementById('hamburgerBtnOpen');
    const closeBtn = document.getElementById('hamburgerBtnClose');

    function toggleSidebar(show) {
        if (!sidebar || !backdrop) return;
        if (show) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    }

    if (openBtn) openBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
    if (backdrop) backdrop.addEventListener('click', () => toggleSidebar(false));

    // Close sidebar when selecting a link on mobile
    sidebar.querySelectorAll('a').forEach(el => {
        el.addEventListener('click', () => toggleSidebar(false));
    });

    // Chat back button on mobile
    const backBtn = document.getElementById('chatMobileBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            activeCourseId = null;
            activeStudentId = null;
            window.location.hash = ''; // clear hash
            const threadsPanel = document.getElementById('threadsSidebarPanel');
            const chatPanel = document.getElementById('chatWindowPanel');
            if (threadsPanel) threadsPanel.classList.remove('hidden');
            if (chatPanel) {
                chatPanel.classList.add('hidden');
                chatPanel.classList.remove('flex');
            }
            if (pollInterval) clearInterval(pollInterval);
            renderThreadsList(threads); // update thread highlights
        });
    }

    // Initialize Notifications
    initNotifications(getAuthHeader, {
        onChatSelect: (courseId, studentId, studentName, courseTitle) => {
            selectThread(courseId, studentId, studentName, courseTitle);
            window.location.hash = `#chat-${courseId}-${studentId}`;
        }
    });
});
