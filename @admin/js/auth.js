// Admin Panel Authentication and Security Guard
const isLoginPage = window.location.pathname.includes('login.html');

/**
 * Decodes and parses the JWT token payload
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

/**
 * Returns authorization headers containing the admin token
 */
export function getAdminAuthHeader() {
    const token = localStorage.getItem('admin_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Make it globally available on the window object for non-module scripts
window.getAdminAuthHeader = getAdminAuthHeader;

// --- ROUTE GUARD FLOW ---
try {
    const token = localStorage.getItem('admin_token');
    const userStr = localStorage.getItem('admin_user');
    let isAuthorized = false;

    if (token && userStr) {
        const payload = parseJwt(token);
        const user = JSON.parse(userStr);
        const validRoles = ['admin', 'coordinator'];

        if (payload && payload.exp && payload.exp > Date.now() / 1000 && validRoles.includes(user.role)) {
            isAuthorized = true;
        }
    }

    if (isAuthorized) {
        // If logged in as admin and on login page, send to index.html
        if (isLoginPage) {
            window.location.replace('index.html');
        } else {
            // Populate avatar initials
            const user = JSON.parse(userStr);
            const avatarEl = document.getElementById('adminAvatar');
            if (avatarEl && user) {
                const name = user.name || user.email || '';
                const inits = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
                avatarEl.textContent = inits;
                avatarEl.title = name + (user.role ? ' (' + user.role + ')' : '');
            }

            // Dynamic Mobile Sidebar Toggle Button injection
            const header = document.querySelector('.adm-header');
            if (header) {
                const existingToggle = header.querySelector('.adm-sidebar-toggle-btn');
                if (!existingToggle) {
                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'adm-sidebar-toggle-btn';
                    toggleBtn.type = 'button';
                    toggleBtn.innerHTML = '<span class="material-icons">menu</span>';
                    
                    // Prepend to header's first child if it is a flex box, otherwise prepend to header itself
                    const firstChild = header.firstElementChild;
                    if (firstChild && firstChild.getAttribute('style')?.includes('display:flex')) {
                        firstChild.insertBefore(toggleBtn, firstChild.firstChild);
                    } else {
                        header.insertBefore(toggleBtn, header.firstChild);
                    }
                    
                    toggleBtn.addEventListener('click', () => {
                        document.body.classList.toggle('sidebar-open');
                    });
                }
            }

            // Dynamic Sidebar Background Overlay injection
            let overlay = document.querySelector('.adm-sidebar-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'adm-sidebar-overlay';
                document.body.appendChild(overlay);
                overlay.addEventListener('click', () => {
                    document.body.classList.remove('sidebar-open');
                });
            }

            // Dynamically inject the "Student Chat" link in the sidebar if not already present
            const nav = document.querySelector('.adm-sidebar-nav');
            if (nav) {
                // Find the section for Users (contains Students, Lecturers, Reviews)
                const sections = nav.querySelectorAll('.adm-nav-section');
                let usersSection = null;
                sections.forEach(sec => {
                    const label = sec.querySelector('.adm-nav-label');
                    if (label && label.textContent.toLowerCase().includes('users')) {
                        usersSection = sec;
                    }
                });

                if (usersSection) {
                    // Check if chat link already exists
                    const existingChat = usersSection.querySelector('a[href="chat.html"]');
                    if (!existingChat) {
                        const chatLink = document.createElement('a');
                        chatLink.href = 'chat.html';
                        chatLink.className = 'adm-nav-item';
                        if (window.location.pathname.endsWith('chat.html')) {
                            chatLink.className = 'adm-nav-item active';
                        }
                        chatLink.innerHTML = `
                            <span class="material-icons">chat</span> Student Chat
                            <span class="chat-unread-badge hidden" id="chatUnreadBadge">0</span>
                        `;
                        usersSection.appendChild(chatLink);
                    }
                }
            }

            // Function to fetch and update unread chat badge count
            const updateChatBadge = async () => {
                try {
                    const res = await fetch('../api/chat/unread.php', {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const badge = document.getElementById('chatUnreadBadge');
                        if (badge) {
                            if (data.unread_count > 0) {
                                badge.textContent = data.unread_count;
                                badge.classList.remove('hidden');
                            } else {
                                badge.classList.add('hidden');
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch unread chat count:", e);
                }
            };

            updateChatBadge();
            // Check every 10 seconds
            setInterval(updateChatBadge, 10000);
        }
    } else {
        // Clear expired credentials and kick out of protected pages
        if (!isLoginPage) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.replace('login.html');
        }
    }
} catch (e) {
    console.error("Admin guard execution failed:", e);
    if (!isLoginPage) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.replace('login.html');
    }
}

// --- LOGIN SUBMIT FLOW ---
if (isLoginPage) {
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            const errorAlert = document.getElementById('errorAlert');
            const errorMessage = document.getElementById('errorMessage');

            // Reset UI
            errorAlert.classList.add('hidden');
            loginBtn.innerHTML = '<span class="loader align-middle mr-2 border-white"></span> Signing in...';
            loginBtn.disabled = true;

            try {
                // Post credentials to common auth endpoint
                const response = await fetch('../api/auth/login.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, role: 'admin' })
                });

                const data = await response.json();

                if (response.ok) {
                    const validRoles = ['admin', 'coordinator'];
                    
                    // High Security: Reject lecturers and students from accessing admin panel
                    if (!validRoles.includes(data.user.role)) {
                        const isLecturer = data.user.role === 'lecturer';
                        errorMessage.textContent = isLecturer
                            ? "Lecturers must sign in via the Lecturer Portal, not this Admin Panel."
                            : "Unauthorized: Access restricted to college administrators only.";
                        errorAlert.classList.remove('hidden');
                        loginBtn.innerHTML = 'Sign In';
                        loginBtn.disabled = false;
                        return;
                    }

                    // Save session details
                    localStorage.setItem('admin_token', data.token);
                    localStorage.setItem('admin_user', JSON.stringify(data.user));

                    loginBtn.innerHTML = 'Redirecting...';
                    window.location.replace('index.html');
                } else {
                    errorMessage.textContent = data.message || "Invalid credentials.";
                    errorAlert.classList.remove('hidden');
                    loginBtn.innerHTML = 'Sign In';
                    loginBtn.disabled = false;
                }
            } catch (err) {
                console.error("Login request error:", err);
                errorMessage.textContent = "Connection error. Unable to connect to auth server.";
                errorAlert.classList.remove('hidden');
                loginBtn.innerHTML = 'Sign In';
                loginBtn.disabled = false;
            }
        });
    }
}

// --- LOGOUT FLOW ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.replace('login.html');
    });
}
