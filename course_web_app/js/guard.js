// Client-side authentication guard for the Student Portal
export let currentUser = null;

/**
 * Safely decodes a base64url JWT payload in vanilla JS
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
 * Build authentication headers for REST API fetches
 */
export function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Perform client-side auth validation
try {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    let isValid = false;
    
    if (token && userStr) {
        const payload = parseJwt(token);
        if (payload && payload.exp && payload.exp > Date.now() / 1000) {
            isValid = true;
            currentUser = JSON.parse(userStr);
        }
    }
    
    if (!isValid) {
        // Clear local storage and redirect out immediately if unauthorized
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Only redirect if they are not already on the login page (index.html)
        const path = window.location.pathname;
        if (!path.endsWith('index.html') && path !== '/' && !path.endsWith('course_web_app/')) {
            window.location.replace('index.html');
        }
    } else {
        // Reveal the body content once authenticated
        document.body.style.display = '';
        
        // Auto-populate user name display
        const emailDisplay = document.getElementById('userEmailDisplay');
        if (emailDisplay && currentUser) {
            emailDisplay.innerText = currentUser.name || currentUser.email;
        }
    }
} catch (e) {
    console.error("Route guarding execution failed:", e);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('index.html');
}
