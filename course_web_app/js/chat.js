import { getAuthHeader } from './guard.js';

let pollInterval = null;
let currentCourseId = null;
let lastTimestamp = null;
let isChatOpen = false;
let lastMessageId = null;

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

export function initChat(courseId) {
    currentCourseId = courseId;
    lastTimestamp = null;
    
    const chatFabBtn = document.getElementById('chatFabBtn');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatPanel = document.getElementById('chatPanel');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');

    if (!chatFabBtn || !closeChatBtn || !chatPanel || !chatForm) return;

    // Toggle Chat Panel
    chatFabBtn.addEventListener('click', () => {
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatPanel.classList.remove('hidden');
            document.getElementById('chatFabUnreadBadge').classList.add('hidden');
            document.getElementById('chatFabUnreadBadge').textContent = '0';
            document.getElementById('chatBubbleNotification').classList.add('hidden'); // Hide bubble when chat opens
            loadMessages();
            // Start Polling every 3s
            if (!pollInterval) {
                pollInterval = setInterval(loadMessages, 3000);
            }
        } else {
            chatPanel.classList.add('hidden');
            clearInterval(pollInterval);
            pollInterval = null;
        }
    });

    closeChatBtn.addEventListener('click', () => {
        isChatOpen = false;
        chatPanel.classList.add('hidden');
        clearInterval(pollInterval);
        pollInterval = null;
    });

    // Close notification bubble
    const closeBubbleBtn = document.getElementById('closeBubbleBtn');
    const bubbleNotification = document.getElementById('chatBubbleNotification');
    if (closeBubbleBtn && bubbleNotification) {
        closeBubbleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bubbleNotification.classList.add('hidden');
        });
        // Click on bubble opens chat
        bubbleNotification.addEventListener('click', () => {
            chatFabBtn.click();
        });
    }

    // Send Message
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgText = chatInput.value.trim();
        if (!msgText) return;

        chatInput.value = '';

        try {
            const response = await fetch('../api/chat/send.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({
                    course_id: currentCourseId,
                    message: msgText
                })
            });

            if (response.ok) {
                loadMessages();
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    });

    // Initial check for unread messages without opening chat
    checkUnreadCount();
    // Poll unread counts every 8 seconds when chat is closed
    setInterval(() => {
        if (!isChatOpen) {
            checkUnreadCount();
        }
    }, 8000);
}

let lastUnreadCount = 0;

async function checkUnreadCount() {
    try {
        const response = await fetch('../api/chat/unread.php', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            }
        });

        if (response.ok) {
            const data = await response.json();
            const badge = document.getElementById('chatFabUnreadBadge');
            const bubble = document.getElementById('chatBubbleNotification');
            const bubbleText = document.getElementById('chatBubbleText');
            const bubbleTime = document.getElementById('chatBubbleTime');

            if (badge && data.unread_count > 0) {
                badge.textContent = data.unread_count;
                badge.classList.remove('hidden');

                // If unread count has increased, show notification bubble
                if (data.unread_count > lastUnreadCount && bubble && bubbleText) {
                    playNotificationSound();
                    // Fetch message preview
                    try {
                        const msgRes = await fetch(`../api/chat/messages.php?course_id=${currentCourseId}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                ...getAuthHeader()
                            }
                        });
                        if (msgRes.ok) {
                            const msgData = await msgRes.json();
                            const msgs = msgData.messages || [];
                            // Find the last lecturer message
                            const lastLecturerMsg = [...msgs].reverse().find(m => m.sender_role === 'lecturer');
                            if (lastLecturerMsg) {
                                bubbleText.textContent = lastLecturerMsg.message;
                                if (lastLecturerMsg.sent_at) {
                                    const date = new Date(lastLecturerMsg.sent_at.replace(/-/g, '/'));
                                    bubbleTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                }
                                bubble.classList.remove('hidden');
                            }
                        }
                    } catch (err) {
                        console.error("Error loading notification preview:", err);
                    }
                }
            } else {
                if (badge) badge.classList.add('hidden');
                if (bubble) bubble.classList.add('hidden');
            }
            lastUnreadCount = data.unread_count;
        }
    } catch (error) {
        console.error("Error checking unread:", error);
    }
}

async function loadMessages() {
    if (!currentCourseId) return;

    try {
        const response = await fetch(`../api/chat/messages.php?course_id=${currentCourseId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            }
        });

        if (response.ok) {
            const data = await response.json();
            const msgs = data.messages || [];
            if (msgs.length > 0) {
                const lastMsg = msgs[msgs.length - 1];
                if (lastMessageId && lastMessageId !== lastMsg.id && lastMsg.sender_role === 'lecturer') {
                    playNotificationSound();
                }
                lastMessageId = lastMsg.id;
            }
            renderMessages(msgs);
        }
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

function renderMessages(messages) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400 text-xs">
                <i class="fa-regular fa-comment-dots text-2xl mb-2 text-gray-300 block"></i>
                No messages yet. Send a message to start conversation with the lecturer.
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    messages.forEach(msg => {
        const isMe = msg.sender_role === 'student';
        const bubble = document.createElement('div');
        bubble.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3`;
        
        // Time format
        let timeStr = '';
        if (msg.sent_at) {
            const date = new Date(msg.sent_at.replace(/-/g, '/'));
            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Safely escape message text
        const safe = (msg.message || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const senderLabel = isMe ? 'You' : 'Lecturer';

        bubble.innerHTML = `
            <div class="max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs ${isMe ? 'bg-primary text-gray-900 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'}" style="box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                <p class="leading-relaxed whitespace-pre-wrap">${safe}</p>
            </div>
            <span class="text-[9px] text-gray-400 mt-1 px-1">${senderLabel} · ${timeStr}</span>
        `;
        container.appendChild(bubble);
    });

    // Auto Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

