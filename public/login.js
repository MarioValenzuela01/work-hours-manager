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

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = 'index.html';
    }

    authToggleLink.addEventListener('click', () => {
        isLogin = !isLogin;
        authTitle.textContent = isLogin ? 'Login' : 'Registration';
        authSubmit.innerHTML = isLogin ? '<i class="fa-solid fa-sign-in-alt"></i> Login' : '<i class="fa-solid fa-user-plus"></i> Sign Up';
        authToggleText.textContent = isLogin ? 'Don\'t have an account?' : 'Already have an account?';
        authToggleLink.textContent = isLogin ? 'Sign Up' : 'Login';
        authError.textContent = '';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showError('Please enter username and password');
            return;
        }

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (isLogin) {
                    localStorage.setItem('token', data.token);
                    window.location.href = 'index.html';
                } else {
                    // Registration successful, auto-login or switch to login
                    isLogin = true;
                    authTitle.textContent = 'Login';
                    authSubmit.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Login';
                    authToggleText.textContent = 'Don\'t have an account?';
                    authToggleLink.textContent = 'Sign Up';
                    usernameInput.value = '';
                    passwordInput.value = '';
                    showError('Registration successful. Please log in.', 'success');
                }
            } else {
                showError(data.message || 'Authentication error');
            }
        } catch (error) {
            console.error('Auth error:', error);
            showError('Connection error with the server');
        }
    });

    function showError(msg, type = 'error') {
        authError.textContent = msg;
        authError.style.color = type === 'error' ? 'var(--danger-color)' : 'var(--success-color, #10b981)';
        setTimeout(() => {
            authError.textContent = '';
        }, 4000);
    }
});
