/**
 * Admin / Lecturer Chat Controller
 * Manages the two-column inbox: thread list (left) + message stream (right).
 * Polls for new messages every 3 s when a thread is open, and refreshes
 * the inbox list every 8 s so unread counts stay accurate.
 */
import { getAdminAuthHeader } from './auth.js';

// ── State ──────────────────────────────────────────────────────────────────
let activeCourseId   = null;
let activeStudentId  = null;
let activeStudentName = '';
let activeCourseTitle = '';
let pollInterval     = null;   // message poller (3 s)
let inboxInterval    = null;   // inbox poller  (8 s)
let threads          = [];     // full thread list from API
let lastUnreadCount  = null;
let lastMessageId    = null;

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = 'sine';
        osc1.frequency.value = 587.33; // D5
        gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.15);
        
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sine';
        osc2.frequency.value = 880.00; // A5
        gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc2.start(audioCtx.currentTime + 0.12);
        osc2.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.error("Audio Context playback failed:", e);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Derive initials from a name string (up to 2 chars). */
function initials(name = '') {
    return name.split(' ')
               .map(w => w[0])
               .join('')
               .toUpperCase()
               .slice(0, 2) || '?';
}

/**
 * Format a MySQL datetime string into a friendly relative or clock string.
 * e.g. "Just now", "2 min ago", "Today 14:32", "Jun 20"
 */
function friendlyTime(datetimeStr) {
    if (!datetimeStr) return '';
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    const now   = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1)  return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;

    const isToday    = date.toDateString() === now.toDateString();
    const timePart   = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return timePart;

    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Inbox (Thread List) ────────────────────────────────────────────────────

async function loadInbox() {
    try {
        const res = await fetch('../api/chat/unread.php', {
            headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() }
        });
        if (!res.ok) throw new Error('Inbox fetch failed: ' + res.status);

        const data = await res.json();
        threads = data.threads || [];
        renderThreadsList(threads);

        // Update sidebar badge
        const badge = document.getElementById('chatUnreadBadge');
        if (badge) {
            if (data.unread_count > 0) {
                badge.textContent = data.unread_count;
                badge.classList.remove('hidden');

                if (lastUnreadCount !== null && data.unread_count > lastUnreadCount) {
                    playNotificationSound();
                }
            } else {
                badge.classList.add('hidden');
            }
        }
        lastUnreadCount = data.unread_count;
    } catch (err) {
        console.error('Inbox error:', err);
    }
}

function renderThreadsList(list) {
    const container = document.getElementById('threadsListContainer');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="thread-empty">
                <span class="material-icons">inbox</span>
                <p>No student conversations yet.<br>Conversations appear here once a student sends a message.</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(t => {
        const isActive = (t.course_id === activeCourseId && t.student_id === activeStudentId);
        const item = document.createElement('div');
        item.className = 'thread-item' + (isActive ? ' active' : '');
        item.dataset.courseId  = t.course_id;
        item.dataset.studentId = t.student_id;

        const initStr  = initials(t.student_name);
        const timeStr  = friendlyTime(t.latest_sent_at);
        const hasUnread = parseInt(t.unread_messages) > 0;
        const preview  = t.latest_message
            ? (t.latest_message.length > 48 ? t.latest_message.slice(0, 48) + '…' : t.latest_message)
            : 'No messages yet';

        item.innerHTML = `
            <div class="thread-avatar">${initStr}</div>
            <div class="thread-content">
                <div class="thread-top">
                    <span class="thread-name">${t.student_name || 'Student'}</span>
                    <span class="thread-time">${timeStr}</span>
                </div>
                <div class="thread-course">${t.course_title || ''}</div>
                <div class="thread-preview">
                    <span class="thread-preview-text">${preview}</span>
                    ${hasUnread ? `<span class="thread-unread-pill">${t.unread_messages}</span>` : ''}
                </div>
            </div>`;

        item.addEventListener('click', () =>
            selectThread(t.course_id, t.student_id, t.student_name, t.course_title)
        );
        container.appendChild(item);
    });
}

// ── Thread Selection ───────────────────────────────────────────────────────

function selectThread(courseId, studentId, studentName, courseTitle) {
    activeCourseId   = courseId;
    activeStudentId  = studentId;
    activeStudentName = studentName || 'Student';
    activeCourseTitle = courseTitle || 'Course';

    // Show conversation panel, hide empty state
    document.getElementById('chatEmptyState').classList.add('hidden');
    const conv = document.getElementById('activeConversation');
    conv.classList.remove('hidden');
    conv.style.display = 'flex';

    // Toggle body class for mobile responsiveness
    document.body.classList.add('thread-open');

    // Update header
    document.getElementById('activeStudentName').textContent = activeStudentName;
    document.getElementById('activeCourseTitle').textContent = activeCourseTitle;
    document.getElementById('chatHeaderAvatar').textContent  = initials(activeStudentName);

    // Re-render thread list to highlight selected
    renderThreadsList(threads);

    // Focus input
    const inp = document.getElementById('chatMessageInput');
    if (inp) inp.focus();

    // Reset message tracking history for the new thread
    lastMessageId = null;

    // Start message polling
    loadMessages();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 3000);
}

// ── Messages ───────────────────────────────────────────────────────────────

async function loadMessages() {
    if (!activeCourseId || !activeStudentId) return;

    try {
        const res = await fetch(
            `../api/chat/messages.php?course_id=${activeCourseId}&student_id=${activeStudentId}`,
            { headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() } }
        );
        if (!res.ok) throw new Error('Messages fetch failed: ' + res.status);
        const data = await res.json();
        const msgs = data.messages || [];
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMessageId && lastMessageId !== lastMsg.id && lastMsg.sender_role === 'student') {
                playNotificationSound();
            }
            lastMessageId = lastMsg.id;
        }
        renderMessages(msgs);
    } catch (err) {
        console.error('Messages error:', err);
    }
}

function renderMessages(messages) {
    const stream = document.getElementById('chatStream');
    if (!stream) return;

    if (!messages.length) {
        stream.innerHTML = `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;text-align:center;padding:32px;">
                <span class="material-icons" style="font-size:40px;margin-bottom:8px;color:#d1d5db;">chat</span>
                <p style="font-size:13px;">No messages in this thread yet.</p>
            </div>`;
        return;
    }

    // Preserve scroll position if near bottom
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
            const today = new Date().toDateString();
            const divider = document.createElement('div');
            divider.className = 'msg-date-divider';
            divider.textContent = (msgDate === today) ? 'Today' : new Date(msg.sent_at.replace(/-/g, '/')).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            stream.appendChild(divider);
        }

        const isMe = msg.sender_role === 'lecturer' || msg.sender_role === 'admin' || msg.sender_role === 'coordinator';
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper ' + (isMe ? 'from-me' : 'from-student');

        let timeStr = '';
        if (msg.sent_at) {
            const d = new Date(msg.sent_at.replace(/-/g, '/'));
            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        wrapper.innerHTML = `
            <div class="msg-bubble">${escapeHtml(msg.message)}</div>
            <span class="msg-meta">${timeStr}${isMe ? ' · You' : ' · ' + activeStudentName}</span>`;

        stream.appendChild(wrapper);
    });

    if (wasAtBottom) {
        stream.scrollTop = stream.scrollHeight;
    }
}

/** Basic HTML entity escaping to prevent XSS when injecting message text */
function escapeHtml(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Send Message ───────────────────────────────────────────────────────────

const form = document.getElementById('chatSendForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chatMessageInput');
        const text  = input.value.trim();
        if (!text || !activeCourseId || !activeStudentId) return;

        input.value = '';

        try {
            const res = await fetch('../api/chat/send.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAdminAuthHeader() },
                body: JSON.stringify({
                    course_id: activeCourseId,
                    student_id: activeStudentId,
                    message: text
                })
            });

            if (res.ok) {
                // Optimistic: refresh messages & inbox immediately
                loadMessages();
                loadInbox();
            } else {
                const err = await res.json().catch(() => ({}));
                console.error('Send failed:', err.message || res.status);
            }
        } catch (err) {
            console.error('Send error:', err);
        }
    });
}

// ── Thread Search ──────────────────────────────────────────────────────────

const searchInput = document.getElementById('threadSearch');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        if (!q) {
            renderThreadsList(threads);
            return;
        }
        renderThreadsList(threads.filter(t =>
            (t.student_name || '').toLowerCase().includes(q) ||
            (t.course_title || '').toLowerCase().includes(q)
        ));
    });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

// Set user avatar initials from stored admin_user
(function initAvatar() {
    try {
        const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
        const av = document.getElementById('adminAvatar');
        if (av && user.name) {
            av.textContent = initials(user.name);
            av.title = user.name;
        }
    } catch (_) { /* swallow */ }
})();

// Initial load + recurring inbox refresh
loadInbox();
inboxInterval = setInterval(loadInbox, 8000);

// Mobile chat back button handler
document.getElementById('chatBackBtn')?.addEventListener('click', () => {
    document.body.classList.remove('thread-open');
    activeCourseId = null;
    activeStudentId = null;
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
});
