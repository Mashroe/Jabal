// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = 'https://iuldkrafqpxnriijcsoc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Jlylm5iwyaqgttIF4rAtkQ_2Fa8bkh-';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// SYSTEM CONFIGURATION
// ============================================================
const APP_CONFIG = {
    currency: {
        code: 'SDG',
        symbol: 'ج.س',
        name: 'جنية سوداني',
        decimalPlaces: 2
    },
    app: {
        name: 'JABAL ALSAFA',
        version: '2.0.0'
    }
};

// ============================================================
// HELPER: Format Currency
// ============================================================
function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '0.00 SDG';
    const formatted = Number(amount).toFixed(APP_CONFIG.currency.decimalPlaces);
    const parts = formatted.split('.');
    const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${whole}.${parts[1]} ${APP_CONFIG.currency.code}`;
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
window.showToast = function(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">&times;</button>`;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
};

// ============================================================
// ESCAPE HTML
// ============================================================
window.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// ============================================================
// LOGOUT
// ============================================================
window.logoutUser = async function() {
    if (!confirm('⚠️ هل أنت متأكد من تسجيل الخروج؟')) return;
    try {
        showToast('⏳ جاري تسجيل الخروج...', 'info');
        await supabaseClient.auth.signOut();
        localStorage.removeItem('jabal_auth');
        localStorage.removeItem('jabal_email');
        showToast('✅ تم تسجيل الخروج بنجاح', 'success');
        setTimeout(() => window.location.href = 'login.html', 500);
    } catch (err) {
        localStorage.removeItem('jabal_auth');
        localStorage.removeItem('jabal_email');
        window.location.href = 'login.html';
    }
};

// ============================================================
// CHANGE PASSWORD
// ============================================================
window.changePassword = function() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'changePasswordModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3>🔑 تغيير كلمة المرور</h3>
                <button class="modal-close" onclick="closeChangePasswordModal()">&times;</button>
            </div>
            <form id="changePasswordForm">
                <div class="form-group">
                    <label for="currentPassword">كلمة المرور الحالية</label>
                    <input type="password" id="currentPassword" placeholder="أدخل كلمة المرور الحالية" required />
                </div>
                <div class="form-group">
                    <label for="newPassword">كلمة المرور الجديدة</label>
                    <input type="password" id="newPassword" placeholder="أدخل كلمة المرور الجديدة" required />
                </div>
                <div class="form-group">
                    <label for="confirmPassword">تأكيد كلمة المرور</label>
                    <input type="password" id="confirmPassword" placeholder="أعد إدخال كلمة المرور الجديدة" required />
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="closeChangePasswordModal()">إلغاء</button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i>
                        تغيير كلمة المرور
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('⚠️ يرجى ملء جميع الحقول', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('⚠️ كلمة المرور غير متطابقة', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showToast('⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return;
        }
        
        try {
            showToast('⏳ جاري تغيير كلمة المرور...', 'info');
            const { data, error } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (error) {
                showToast('⚠️ تم تغيير كلمة المرور محلياً', 'warning');
            } else {
                showToast('✅ تم تغيير كلمة المرور بنجاح!', 'success');
            }
            localStorage.setItem('jabal_password', newPassword);
            closeChangePasswordModal();
            setTimeout(() => {
                if (confirm('✅ تم تغيير كلمة المرور. هل تريد تسجيل الخروج وإعادة تسجيل الدخول؟')) {
                    window.logoutUser();
                }
            }, 1000);
        } catch (error) {
            console.error('Error changing password:', error);
            showToast('❌ حدث خطأ في تغيير كلمة المرور', 'error');
        }
    });
};

window.closeChangePasswordModal = function() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) modal.remove();
};

// ============================================================
// RESET SYSTEM
// ============================================================
window.resetSystem = async function() {
    if (!confirm('⚠️ هل أنت متأكد من إعادة تعيين النظام؟\n\nسيتم حذف جميع البيانات من:\n- التخزين المحلي\n- قاعدة البيانات\n\nلا يمكن التراجع!')) return;
    if (!confirm('⚠️ تأكيد نهائي؟')) return;
    
    try {
        showToast('⏳ جاري إعادة تعيين النظام...', 'warning');
        
        // مسح Supabase
        if (typeof supabaseClient !== 'undefined') {
            const tables = ['sale_items', 'sales', 'purchase_items', 'purchases', 'counting_items', 'counting_sessions', 'stock_movements', 'customers', 'products'];
            for (const table of tables) {
                try {
                    await supabaseClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    console.log(`✅ Cleared ${table}`);
                } catch (e) { console.warn(`⚠️ Could not clear ${table}`); }
            }
        }
        
        // مسح IndexedDB
        if (offlineManager && offlineManager.db) {
            const stores = ['products', 'sales', 'sale_items', 'stock_movements', 'pending_operations', 'counting_sessions', 'counting_items', 'customers', 'purchases', 'purchase_items'];
            for (const store of stores) {
                try {
                    const transaction = offlineManager.db.transaction(store, 'readwrite');
                    transaction.objectStore(store).clear();
                } catch (e) {}
            }
        }
        
        localStorage.clear();
        sessionStorage.clear();
        showToast('✅ تم إعادة تعيين النظام!', 'success');
        setTimeout(() => window.location.reload(true), 1500);
    } catch (error) {
        console.error('Error resetting system:', error);
        showToast('❌ حدث خطأ في إعادة التعيين', 'error');
    }
};

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        window.logoutUser();
    });
    document.getElementById('changePasswordBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        window.changePassword();
    });
    document.getElementById('resetBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        window.resetSystem();
    });
    
    // عرض البريد الإلكتروني
    const userEmail = localStorage.getItem('jabal_email') || 'مدير النظام';
    const emailEl = document.getElementById('userEmail');
    if (emailEl) emailEl.textContent = userEmail;
});

console.log('✅ JABAL ALSAFA App Loaded');
console.log(`💰 Currency: ${APP_CONFIG.currency.code} (${APP_CONFIG.currency.name})`);
console.log('🚀 System running with local auth');