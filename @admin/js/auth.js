import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Check if we are on the login page (handling both login.html and clean URLs)
const isLoginPage = window.location.pathname.includes('login');

// 1. Monitor Authentication State
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (isLoginPage) {
            window.location.replace('index.html');
        } else {
            const userDisplay = document.getElementById('adminNameDisplay');
            if (userDisplay) {
                userDisplay.textContent = user.email.split('@')[0];
            }
        }
    } else {
        // if (!isLoginPage) {
        //     window.location.replace('login.html');
        // }
    }
});

// 2. Handle Login Form Submission (only on login.html)
if (isLoginPage) {
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            const errorAlert = document.getElementById('errorAlert');
            const errorMessage = document.getElementById('errorMessage');

            // UI Reset
            errorAlert.classList.add('hidden');
            loginBtn.innerHTML = '<span class="loader align-middle mr-2 border-white"></span> Signing in...';
            loginBtn.disabled = true;

            try {
                // IMPORTANT: Firebase needs actual Auth setup. Assuming simple email/pass for admin.
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged will handle the redirect to index.html
            } catch (error) {
                console.error("Login failed:", error.code, error.message);
                
                // Show Error
                errorMessage.textContent = getFriendlyErrorMessage(error.code);
                errorAlert.classList.remove('hidden');
                
                // Reset Button
                loginBtn.innerHTML = 'Sign In';
                loginBtn.disabled = false;
            }
        });
    }
}

// 3. Handle Logout (on all protected pages)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // onAuthStateChanged will handle the redirect to login.html
        } catch (error) {
            console.error("Logout failed", error);
        }
    });
}

// Helper to translate Firebase error codes
function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'The email address is not valid.';
        case 'auth/user-disabled':
            return 'This admin account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        default:
            return 'An error occurred during login. Please try again.';
    }
}
