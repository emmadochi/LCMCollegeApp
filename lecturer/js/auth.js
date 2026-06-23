/**
 * LCM Bible College — Lecturer Portal Auth Controller
 */

// Decode JWT helper
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

document.addEventListener('DOMContentLoaded', () => {
    // Check existing session
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
        const payload = parseJwt(token);
        if (payload && payload.exp && payload.exp > Date.now() / 1000) {
            const user = JSON.parse(userStr);
            if (['lecturer', 'admin', 'coordinator'].includes(user.role)) {
                window.location.replace('dashboard.html');
                return;
            }
        }
    }

    // Toggle Password Visibility
    const pwdInput = document.getElementById('loginPassword');
    const pwdBtn = document.getElementById('pwdToggleBtn');
    if (pwdBtn && pwdInput) {
        pwdBtn.addEventListener('click', () => {
            const icon = pwdBtn.querySelector('i');
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                icon.className = 'fa-regular fa-eye-slash';
            } else {
                pwdInput.type = 'password';
                icon.className = 'fa-regular fa-eye';
            }
        });
    }

    // Form submission
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const alertBanner = document.getElementById('alertBanner');
    const alertMessage = document.getElementById('alertMessage');
    const submitBtn = document.getElementById('submitBtn');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                showAlert('Email and password are required.');
                return;
            }

            setLoading(true);

            try {
                const response = await fetch('../api/auth/login.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    const role = data.user?.role;
                    // Check if role is allowed in lecturer portal
                    if (!['lecturer', 'admin', 'coordinator'].includes(role)) {
                        showAlert('Access restricted. Students must sign in using the student portal.');
                        setLoading(false);
                        return;
                    }

                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    showAlert('Login successful! Loading your dashboard...', 'success');
                    setTimeout(() => {
                        window.location.replace('dashboard.html');
                    }, 1200);
                } else {
                    showAlert(data.message || 'Invalid email or password.');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Lecturer login error:', err);
                showAlert('Connection error. Please check your network and try again.');
                setLoading(false);
            }
        });
    }

    function showAlert(msg, type = 'error') {
        if (!alertBanner || !alertMessage) return;
        alertMessage.textContent = msg;
        alertBanner.className = `form-alert ${type} show`;
    }

    function hideAlert() {
        if (alertBanner) alertBanner.classList.remove('show');
    }

    function setLoading(isLoading) {
        if (!submitBtn) return;
        submitBtn.disabled = isLoading;
        if (isLoading) {
            submitBtn.classList.add('loading');
        } else {
            submitBtn.classList.remove('loading');
        }
    }
});
