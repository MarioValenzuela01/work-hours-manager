
document.addEventListener('DOMContentLoaded', () => {

    const authForm = document.getElementById('auth-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const authTitle = document.getElementById('auth-title');
    const authSubmit = document.getElementById('auth-submit');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authToggleLink = document.getElementById('auth-toggle-link');
    const authError = document.getElementById('auth-error');

    let isLogin = true;

    // ==========================================
    // NFC - GET ORIGINAL DESTINATION
    // ==========================================

    function getRedirectUrl() {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');

        // Only allow internal equipment URLs
        if (
            next &&
            /^\/equipment\/[a-zA-Z0-9_-]+$/.test(next)
        ) {
            return next;
        }

        return null;
    }

    // ==========================================
    // REDIRECT AFTER LOGIN
    // ==========================================

    function redirectAfterLogin(role) {
        const nextUrl = getRedirectUrl();

        // Return to the tractor scanned through NFC
        if (nextUrl) {
            window.location.replace(nextUrl);
            return;
        }

        // Normal application navigation
        window.location.replace(
            role === 'admin' ? '/admin.html' : '/menu.html'
        );
    }

    // ==========================================
    // CHECK EXISTING SESSION
    // ==========================================

    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token) {
        redirectAfterLogin(role);
        return;
    }

    // ==========================================
    // SWITCH LOGIN / REGISTRATION
    // ==========================================

    authToggleLink.addEventListener('click', () => {
        isLogin = !isLogin;

        authTitle.textContent =
            isLogin ? 'Login' : 'Registration';

        authSubmit.innerHTML = isLogin
            ? '<i class="fa-solid fa-sign-in-alt"></i> Login'
            : '<i class="fa-solid fa-user-plus"></i> Sign Up';

        authToggleText.textContent = isLogin
            ? "Don't have an account?"
            : 'Already have an account?';

        authToggleLink.textContent =
            isLogin ? 'Sign Up' : 'Login';

        authError.textContent = '';
    });

    // ==========================================
    // LOGIN / REGISTER REQUEST
    // ==========================================

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        authError.textContent = '';

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError('Please enter username and password');
            return;
        }

        const endpoint = isLogin
            ? '/api/auth/login'
            : '/api/auth/register';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showError(data.message || 'Authentication error');
                return;
            }

            // ==================================
            // SUCCESSFUL LOGIN
            // ==================================

            if (isLogin) {

                localStorage.setItem('token', data.token);
                localStorage.setItem('username', username);
                localStorage.setItem(
                    'role',
                    data.role || 'user'
                );

                // Return to NFC tractor or normal menu
                redirectAfterLogin(data.role || 'user');

            } else {

                // ==================================
                // SUCCESSFUL REGISTRATION
                // ==================================

                isLogin = true;

                authTitle.textContent = 'Login';

                authSubmit.innerHTML =
                    '<i class="fa-solid fa-sign-in-alt"></i> Login';

                authToggleText.textContent =
                    "Don't have an account?";

                authToggleLink.textContent = 'Sign Up';

                usernameInput.value = '';
                passwordInput.value = '';

                showError(
                    'Registration successful. Please log in.',
                    'success'
                );
            }

        } catch (error) {
            console.error('Auth error:', error);
            showError('Connection error with the server');
        }
    });

    // ==========================================
    // SHOW ERROR / SUCCESS MESSAGE
    // ==========================================

    function showError(msg, type = 'error') {
        authError.textContent = msg;

        authError.style.color = type === 'error'
            ? 'var(--danger-color)'
            : 'var(--success-color, #10b981)';

        setTimeout(() => {
            authError.textContent = '';
        }, 4000);
    }
});
