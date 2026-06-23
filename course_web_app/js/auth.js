/**
 * LCM Bible College — Student Portal Auth Handler
 * Uses local PHP REST API with JWT. No Firebase.
 */

document.addEventListener('DOMContentLoaded', function () {

    // =============================================
    // SESSION CHECK — redirect if already logged in
    // =============================================
    (function checkExistingSession() {
        var token = localStorage.getItem('token');
        if (!token) return;
        try {
            var parts   = token.split('.');
            var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.exp && payload.exp > Date.now() / 1000) {
                window.location.replace('dashboard.html');
            }
        } catch (e) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    })();

    // =============================================
    // LOGIN FORM
    // =============================================
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            window.clearFieldErrors && window.clearFieldErrors();
            window.hideAlert && window.hideAlert();

            var email    = (document.getElementById('loginEmail')    || {}).value  || '';
            var password = (document.getElementById('loginPassword') || {}).value  || '';
            var btn      = document.getElementById('loginSubmitBtn');

            email    = email.trim();

            // Client-side validation
            var valid = true;
            if (!email) {
                window.setFieldError && window.setFieldError('loginEmail', 'loginEmailError', 'Email is required');
                valid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                window.setFieldError && window.setFieldError('loginEmail', 'loginEmailError', 'Please enter a valid email');
                valid = false;
            }
            if (!password) {
                window.setFieldError && window.setFieldError('loginPassword', 'loginPasswordError', 'Password is required');
                valid = false;
            }
            if (!valid) return;

            setLoading(btn, true);

            try {
                var response = await fetch('../api/auth/login.php', {
                    method : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body   : JSON.stringify({ email: email, password: password })
                });

                var data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user',  JSON.stringify(data.user));
                    window.showAlert && window.showAlert('Login successful! Redirecting to your dashboard…', 'success');
                    setTimeout(function () {
                        window.location.replace('dashboard.html');
                    }, 1000);
                } else {
                    window.showAlert && window.showAlert(data.message || 'Invalid email or password. Please try again.');
                    setLoading(btn, false);
                }
            } catch (err) {
                console.error('[auth.js] Login error:', err);
                window.showAlert && window.showAlert('Connection error. Please check your network and try again.');
                setLoading(btn, false);
            }
        });
    }

    // =============================================
    // REGISTER FORM
    // =============================================
    var registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            window.clearFieldErrors && window.clearFieldErrors();
            window.hideAlert && window.hideAlert();

            var name            = ((document.getElementById('regName')    || {}).value || '').trim();
            var email           = ((document.getElementById('regEmail')   || {}).value || '').trim();
            var password        = (document.getElementById('regPassword') || {}).value || '';
            var confirmPassword = (document.getElementById('regConfirm')  || {}).value || '';
            var btn             = document.getElementById('registerSubmitBtn');

            // Client-side validation (mirrors server-side rules in register.php)
            var valid = true;

            if (!name) {
                window.setFieldError && window.setFieldError('regName', 'regNameError', 'Full name is required');
                valid = false;
            } else if (name.length < 2) {
                window.setFieldError && window.setFieldError('regName', 'regNameError', 'Name must be at least 2 characters');
                valid = false;
            }

            if (!email) {
                window.setFieldError && window.setFieldError('regEmail', 'regEmailError', 'Email address is required');
                valid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                window.setFieldError && window.setFieldError('regEmail', 'regEmailError', 'Please enter a valid email address');
                valid = false;
            }

            if (!password) {
                window.setFieldError && window.setFieldError('regPassword', 'regPasswordError', 'Password is required');
                valid = false;
            } else if (password.length < 8) {
                window.setFieldError && window.setFieldError('regPassword', 'regPasswordError', 'Password must be at least 8 characters');
                valid = false;
            } else if (!/[A-Z]/.test(password)) {
                window.setFieldError && window.setFieldError('regPassword', 'regPasswordError', 'Password must include at least one uppercase letter');
                valid = false;
            } else if (!/[0-9]/.test(password)) {
                window.setFieldError && window.setFieldError('regPassword', 'regPasswordError', 'Password must include at least one number');
                valid = false;
            }

            if (!confirmPassword) {
                window.setFieldError && window.setFieldError('regConfirm', 'regConfirmError', 'Please confirm your password');
                valid = false;
            } else if (password !== confirmPassword) {
                window.setFieldError && window.setFieldError('regConfirm', 'regConfirmError', 'Passwords do not match');
                valid = false;
            }

            if (!valid) return;

            setLoading(btn, true);

            try {
                var regResponse = await fetch('../api/auth/register.php', {
                    method : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body   : JSON.stringify({ name: name, email: email, password: password })
                });

                var regData = await regResponse.json();

                if (regResponse.ok) {
                    window.showAlert && window.showAlert('Account created! Signing you in…', 'success');

                    // Auto-login after successful registration
                    var loginResponse = await fetch('../api/auth/login.php', {
                        method : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body   : JSON.stringify({ email: email, password: password })
                    });

                    var loginData = await loginResponse.json();

                    if (loginResponse.ok) {
                        localStorage.setItem('token', loginData.token);
                        localStorage.setItem('user',  JSON.stringify(loginData.user));
                        setTimeout(function () {
                            window.location.replace('dashboard.html');
                        }, 1100);
                    } else {
                        // Registration succeeded but auto-login failed — ask to sign in manually
                        window.showAlert && window.showAlert('Account created! Please sign in to continue.', 'success');
                        setTimeout(function () {
                            window.toggleView && window.toggleView('login');
                        }, 2200);
                        setLoading(btn, false);
                    }
                } else {
                    window.showAlert && window.showAlert(regData.message || 'Registration failed. Please try again.');
                    setLoading(btn, false);
                }
            } catch (err) {
                console.error('[auth.js] Registration error:', err);
                window.showAlert && window.showAlert('Connection error. Please check your network and try again.');
                setLoading(btn, false);
            }
        });
    }

    // =============================================
    // HELPER: set button loading state
    // =============================================
    function setLoading(btn, isLoading) {
        if (!btn) return;
        btn.disabled = isLoading;
        if (isLoading) {
            btn.classList.add('loading');
        } else {
            btn.classList.remove('loading');
        }
    }
});
