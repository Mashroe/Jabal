// ============================================================
// DASHBOARD CONTROLLER
// ============================================================

(async function initDashboard() {
    console.log('✅ Starting dashboard...');
    
    const localAuth = localStorage.getItem('jabal_auth');
    if (localAuth !== 'true') {
        console.log('⚠️ No local auth, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }
    
    console.log('✅ User authenticated locally');
    await loadDashboardData();
})();

async function loadDashboardData() {
    try {
        showLoading();
        
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            updateStats(0, 0, 0, 0);
            hideLoading();
            return;
        }
        
        const [productsCount, totalSales, lowStockCount, totalRevenue] = await Promise.all([
            getProductsCount(),
            getTotalSales(),
            getLowStockCount(),
            getTotalRevenue()
        ]);
        updateStats(productsCount, totalSales, lowStockCount, totalRevenue);
        hideLoading();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        updateStats(0, 0, 0, 0);
        hideLoading();
    }
}

async function getProductsCount() {
    try {
        if (navigator.onLine && typeof supabaseClient !== 'undefined') {
            const { count, error } = await supabaseClient.from('products').select('*', { count: 'exact', head: true });
            if (error) throw error;
            return count || 0;
        } else if (offlineManager) {
            const products = await offlineManager.getFromLocalDB('products');
            return products.length;
        }
        return 0;
    } catch (error) { return 0; }
}

async function getTotalSales() {
    try {
        if (navigator.onLine && typeof supabaseClient !== 'undefined') {
            const { data, error } = await supabaseClient.from('sales').select('total');
            if (error) throw error;
            if (!data || data.length === 0) return 0;
            return data.reduce((sum, sale) => sum + (sale.total || 0), 0);
        } else if (offlineManager) {
            const sales = await offlineManager.getFromLocalDB('sales');
            return sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        }
        return 0;
    } catch (error) { return 0; }
}

async function getLowStockCount() {
    try {
        if (navigator.onLine && typeof supabaseClient !== 'undefined') {
            const { count, error } = await supabaseClient.from('products').select('*', { count: 'exact', head: true }).lte('quantity', 5);
            if (error) throw error;
            return count || 0;
        } else if (offlineManager) {
            const products = await offlineManager.getFromLocalDB('products');
            return products.filter(p => p.quantity <= 5).length;
        }
        return 0;
    } catch (error) { return 0; }
}

async function getTotalRevenue() {
    return await getTotalSales();
}

function updateStats(productsCount, totalSales, lowStockCount, totalRevenue) {
    const salesElement = document.getElementById('totalSales');
    if (salesElement) {
        salesElement.innerHTML = `${formatCurrency(totalSales)} <span style="font-size: 0.8rem; color: rgba(255,255,255,0.3);">SDG</span>`;
    }
    const productsElement = document.getElementById('totalProducts');
    if (productsElement) productsElement.textContent = productsCount;
    const lowStockElement = document.getElementById('lowStock');
    if (lowStockElement) lowStockElement.textContent = lowStockCount;
    const revenueElement = document.getElementById('totalRevenue');
    if (revenueElement) {
        revenueElement.innerHTML = `${formatCurrency(totalRevenue)} <span style="font-size: 0.8rem; color: rgba(255,255,255,0.3);">SDG</span>`;
    }
    console.log('📊 Dashboard updated:', { products: productsCount, sales: totalSales, lowStock: lowStockCount, revenue: totalRevenue });
}

function showLoading() {
    document.querySelectorAll('.stat-value').forEach(el => { el.textContent = '...'; });
}

function hideLoading() {}

// ===== QUICK ACTION BUTTONS =====
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('newSaleBtn')?.addEventListener('click', function() {
        if (typeof window.switchPage === 'function') window.switchPage('sales');
    });
    document.getElementById('manageInventoryBtn')?.addEventListener('click', function() {
        if (typeof window.switchPage === 'function') window.switchPage('inventory');
    });
});

// ===== SIDEBAR NAVIGATION =====
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const page = this.dataset.page;
        if (page && typeof window.switchPage === 'function') {
            window.switchPage(page);
        }
    });
});

// ===== MOBILE MENU =====
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
if (menuToggle) {
    menuToggle.addEventListener('click', () => sidebar?.classList.toggle('active'));
}
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (sidebar && !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.innerWidth <= 768) {
        sidebar?.classList.remove('active');
    }
});

// ===== AUTO REFRESH =====
setInterval(async () => {
    console.log('🔄 Auto-refreshing dashboard data...');
    await loadDashboardData();
}, 30000);

// ===== SWITCH PAGE =====
window.switchPage = function(page) {
    console.log('🔄 Switching to page:', page);
    
    const pages = ['dashboardContent', 'posContent', 'inventoryContent', 'countingContent', 
                   'customersContent', 'purchasesContent', 'invoicesContent', 'reportsContent'];
    pages.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    const pageMap = {
        'dashboard': { id: 'dashboardContent', fn: loadDashboardData },
        'inventory': { id: 'inventoryContent', fn: function() { if (typeof loadInventoryData === 'function') loadInventoryData(); else showToast('⚠️ نظام المخزون غير متاح', 'warning'); } },
        'counting': { id: 'countingContent', fn: function() { if (typeof loadCountingData === 'function') loadCountingData(); else showToast('⚠️ نظام الجرد غير متاح', 'warning'); } },
        'customers': { id: 'customersContent', fn: function() { if (typeof loadCustomers === 'function') loadCustomers(); else showToast('⚠️ نظام العملاء غير متاح', 'warning'); } },
        'purchases': { id: 'purchasesContent', fn: function() { if (typeof loadPurchases === 'function') loadPurchases(); else showToast('⚠️ نظام المشتريات غير متاح', 'warning'); } },
        'invoices': { id: 'invoicesContent', fn: function() { if (typeof loadInvoices === 'function') loadInvoices(); else showToast('⚠️ نظام الفواتير غير متاح', 'warning'); } },
        'reports': { id: 'reportsContent', fn: function() { if (typeof loadReportsData === 'function') loadReportsData(); else showToast('⚠️ نظام التقارير غير متاح', 'warning'); } },
        'products': { id: 'dashboardContent', fn: function() { if (typeof loadProducts === 'function') loadProducts(); } },
        'sales': { id: 'posContent', fn: function() { if (typeof loadPOSProducts === 'function') loadPOSProducts(); } }
    };
    
    const target = pageMap[page];
    if (target) {
        const el = document.getElementById(target.id);
        if (el) {
            el.style.display = 'block';
            const productsSection = document.getElementById('productsSection');
            if (productsSection) productsSection.style.display = page === 'products' ? 'block' : 'none';
        }
        if (typeof target.fn === 'function') target.fn();
    }
    
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.dataset.page === page) nav.classList.add('active');
    });
    
    const titles = {
        'dashboard': 'لوحة التحكم',
        'products': 'المنتجات',
        'sales': 'نقطة البيع',
        'inventory': 'المخزون',
        'counting': 'الجرد',
        'customers': 'العملاء',
        'purchases': 'المشتريات',
        'invoices': 'الفواتير',
        'reports': 'التقارير'
    };
    const titleEl = document.querySelector('.page-title');
    if (titleEl) titleEl.textContent = titles[page] || page;
};

console.log('✅ switchPage function defined globally');
console.log('✅ Dashboard Module Loaded');