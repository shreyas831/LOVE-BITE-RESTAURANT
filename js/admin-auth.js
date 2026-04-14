// Admin Authentication Handler
(function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            // Hide previous messages
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Logging in...';

            try {
                // Try server authentication first
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data.token) {
                    // Store token
                    sessionStorage.setItem('adminToken', data.token);
                    sessionStorage.setItem('adminEmail', email);
                    
                    if (rememberMe) {
                        localStorage.setItem('adminEmail', email);
                    }

                    // Show success message
                    successMessage.classList.remove('hidden');
                    
                    // Redirect to dashboard
                    setTimeout(() => {
                        window.location.href = 'admin-dashboard.html';
                    }, 1500);
                } else {
                    throw new Error(data.message || 'Login failed');
                }
            } catch (error) {
                console.error('Auth error:', error);

                // Fallback: Dev/demo authentication
                if (email === 'shreyas' && password === 'shreyas123') {
                    const demoToken = 'demo_token_' + Date.now();
                    sessionStorage.setItem('adminToken', demoToken);
                    sessionStorage.setItem('adminEmail', email);
                    
                    if (rememberMe) {
                        localStorage.setItem('adminEmail', email);
                    }

                    successMessage.classList.remove('hidden');
                    setTimeout(() => {
                        window.location.href = 'admin-dashboard.html';
                    }, 1500);
                } else {
                    // Show error
                    errorText.textContent = error.message || 'Invalid email or password';
                    errorMessage.classList.remove('hidden');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login';
            }
        });

        // Auto-fill email if remembered
        const rememberedEmail = localStorage.getItem('adminEmail');
        if (rememberedEmail) {
            document.getElementById('email').value = rememberedEmail;
        }
    }
})();
