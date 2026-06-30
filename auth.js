// ============================================================
// AUTH SYSTEM - JABAL ALSAFA
// ============================================================

const FIXED_EMAIL = 'jabal@gmail.com';
const FIXED_PASSWORD = 'Barakat';

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const togglePasswordBtn = document.getElementById('togglePassword');

// ============================================================
// CHECK IF ALREADY LOGGED IN
// ============================================================
(async function checkSession() {
    try {
        const localAuth = localStorage.getItem('jabal_auth');
        if (localAuth === 'true') {
            console.log('✅ User already logged in locally');
            window.location.href = 'index.html';
            return;
        }
    } catch (err) {
        console.error('Session check error:', err);
    }
})();

// ============================================================
// TOGGLE PASSWORD
// ============================================================
togglePasswordBtn?.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.querySelector('i').classList.toggle('fa-eye');
    this.querySelector('i').classList.toggle('fa-eye-slash');
});

// ============================================================
// ============================================================
// LOGIN (محلي - بدون Supabase)
// ============================================================
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        hideError();
        
        if (!email) { showError('يرجى إدخال البريد الإلكتروني'); return; }
        if (!password) { showError('يرجى إدخال كلمة المرور'); return; }
        
        // ===== التحقق من المستخدمين =====
        const USERS = [
            { email: 'jabal@gmail.com', password: 'Barakat' },
            { email: 'moez@gmail.com', password: 'Jabalwase' },
            // أضف أي مستخدم جديد هنا
        ];
        
        const user = USERS.find(u => u.email === email && u.password === password);
        
        if (user) {
            console.log('✅ Login successful');
            localStorage.setItem('jabal_auth', 'true');
            localStorage.setItem('jabal_email', email);
            showToast('✅ تم تسجيل الدخول بنجاح!', 'success');
            setTimeout(() => window.location.href = 'index.html', 500);
            return;
        }
        
        showError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    });
}

// ============================================================
// HELPERS
// ============================================================
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">&times;</button>`;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3000);
}

function showError(msg) {
    if (!errorText || !errorMessage) return;
    errorText.textContent = msg;
    errorMessage.classList.remove('hidden');
    errorMessage.style.animation = 'shake 0.4s ease';
    setTimeout(() => { if (errorMessage) errorMessage.style.animation = ''; }, 400);
}

function hideError() {
    if (errorMessage) errorMessage.classList.add('hidden');
}

console.log('✅ JABAL ALSAFA Auth System Loaded');
console.log(`📧 Email: ${FIXED_EMAIL}`);
console.log('🔑 Password: ********');
