// ============================================================
// INVENTORY MANAGEMENT - VERSION FINAL
// ============================================================

let inventoryProducts = [];
let allMovements = [];

// ============================================================
// LOAD INVENTORY DATA
// ============================================================
async function loadInventoryData() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        await Promise.all([loadInventoryProducts(), loadMovements()]);
        switchInventoryTab('current');
    } catch (error) {
        console.error('Error loading inventory:', error);
        showToast('حدث خطأ في تحميل بيانات المخزون', 'error');
    }
}

// ============================================================
// LOAD INVENTORY PRODUCTS
// ============================================================
async function loadInventoryProducts() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return;
        }
        
        let products = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .order('name');
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            products = data || [];
            console.log(`✅ Loaded ${products.length} inventory products`);
            
            if (typeof offlineManager !== 'undefined' && offlineManager && products.length > 0) {
                await offlineManager.saveToLocalDB('products', products);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            products = await offlineManager.getFromLocalDB('products');
            console.log(`📴 Loaded ${products.length} products from local DB`);
            if (products.length > 0) {
                showToast('📴 عرض المنتجات من الذاكرة المحلية', 'info');
            }
        }
        
        inventoryProducts = products;
        renderInventoryProducts(products);
        updateAlerts(products);
        
    } catch (error) {
        console.error('Error loading inventory products:', error);
        showToast('حدث خطأ في تحميل المنتجات', 'error');
    }
}

// ============================================================
// RENDER INVENTORY PRODUCTS
// ============================================================
function renderInventoryProducts(products) {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) {
        console.warn('⚠️ inventoryTableBody not found');
        return;
    }
    
    if (!products || products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                    📦 لا توجد منتجات في المخزون
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = products.map((product, index) => {
        const status = getProductStatus(product.quantity);
        const statusBadge = getStatusBadge(status);
        const lastUpdated = product.created_at ? 
            new Date(product.created_at).toLocaleDateString('ar-SA') : 
            '---';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(product.name)}</strong></td>
                <td>${product.quantity}</td>
                <td>${statusBadge}</td>
                <td>${lastUpdated}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="openStockModal('${product.id}')" title="إضافة/سحب مخزون">
                        <i class="fas fa-plus"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// LOAD MOVEMENTS
// ============================================================
async function loadMovements(filters = {}) {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return;
        }
        
        let movements = [];
        if (navigator.onLine) {
            let query = supabaseClient
                .from('stock_movements')
                .select('*, products (name)')
                .order('created_at', { ascending: false });
            
            if (filters.from) query = query.gte('created_at', filters.from);
            if (filters.to) query = query.lte('created_at', filters.to);
            if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
            
            const { data, error } = await query;
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            movements = data || [];
            
            if (typeof offlineManager !== 'undefined' && offlineManager && movements.length > 0) {
                await offlineManager.saveToLocalDB('stock_movements', movements);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            movements = await offlineManager.getFromLocalDB('stock_movements');
        }
        
        allMovements = movements;
        renderMovements(movements);
    } catch (error) {
        console.error('Error loading movements:', error);
        showToast('حدث خطأ في تحميل الحركات', 'error');
    }
}

// ============================================================
// RENDER MOVEMENTS
// ============================================================
function renderMovements(movements) {
    const tbody = document.getElementById('movementsTableBody');
    if (!tbody) {
        console.warn('⚠️ movementsTableBody not found');
        return;
    }
    
    if (!movements || movements.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                    📋 لا توجد حركات مخزون
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = movements.map(movement => {
        const date = new Date(movement.created_at).toLocaleString('ar-SA');
        const typeLabel = movement.type === 'in' ? '➕ إضافة' : 
                         movement.type === 'out' ? '➖ سحب' : 
                         '📝 تعديل';
        const typeClass = movement.type === 'in' ? 'positive' : 
                         movement.type === 'out' ? 'negative' : '';
        const productName = movement.products?.name || 'منتج محذوف';
        
        return `
            <tr>
                <td>${date}</td>
                <td>${escapeHtml(productName)}</td>
                <td class="${typeClass}">${typeLabel}</td>
                <td>${movement.quantity}</td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// UPDATE ALERTS
// ============================================================
function updateAlerts(products) {
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;
    
    const lowStockProducts = products.filter(p => p.quantity <= 5 && p.quantity > 0);
    const outOfStockProducts = products.filter(p => p.quantity <= 0);
    
    let alertsHTML = '';
    
    if (outOfStockProducts.length > 0) {
        alertsHTML += `
            <div class="alert-card alert-danger">
                <i class="fas fa-times-circle"></i>
                <div class="alert-content">
                    <h4>⚠️ منتجات نفذت من المخزون</h4>
                    <p>المنتجات التالية تحتاج إلى إعادة توريد:</p>
                    <ul>
                        ${outOfStockProducts.map(p => 
                            `<li>${escapeHtml(p.name)} - الكمية: ${p.quantity}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    if (lowStockProducts.length > 0) {
        alertsHTML += `
            <div class="alert-card alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="alert-content">
                    <h4>⚠️ منتجات منخفضة المخزون</h4>
                    <p>المنتجات التالية قاربت على النفاذ:</p>
                    <ul>
                        ${lowStockProducts.map(p => 
                            `<li>${escapeHtml(p.name)} - الكمية: ${p.quantity}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    if (!alertsHTML) {
        alertsHTML = `
            <div class="alert-card alert-success">
                <i class="fas fa-check-circle"></i>
                <div class="alert-content">
                    <h4>✅ المخزون جيد</h4>
                    <p>جميع المنتجات متوفرة بكميات كافية</p>
                </div>
            </div>
        `;
    }
    
    alertsContainer.innerHTML = alertsHTML;
}

// ============================================================
// SWITCH INVENTORY TAB
// ============================================================
function switchInventoryTab(tab) {
    console.log('🔄 Switching to tab:', tab);
    
    // تحديث الأزرار
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });
    
    // إخفاء جميع المحتويات
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
    });
    
    // إظهار المحتوى المطلوب
    const tabMap = {
        'current': 'currentStockTab',
        'movements': 'movementsTab',
        'alerts': 'alertsTab'
    };
    
    const targetId = tabMap[tab];
    if (targetId) {
        const target = document.getElementById(targetId);
        if (target) target.style.display = 'block';
    }
    
    // تحميل البيانات حسب التبويب
    if (tab === 'current') {
        renderInventoryProducts(inventoryProducts);
    } else if (tab === 'movements') {
        loadMovements();
    } else if (tab === 'alerts') {
        updateAlerts(inventoryProducts);
    }
}

// ============================================================
// STOCK MODAL
// ============================================================
document.getElementById('addStockBtn')?.addEventListener('click', function() { openStockModal(); });
document.getElementById('closeStockModal')?.addEventListener('click', closeStockModal);
document.getElementById('cancelStock')?.addEventListener('click', closeStockModal);
document.getElementById('stockModal')?.addEventListener('click', function(e) { if (e.target === this) closeStockModal(); });
document.getElementById('stockForm')?.addEventListener('submit', handleStockSubmit);
document.getElementById('filterMovementsBtn')?.addEventListener('click', function() {
    const from = document.getElementById('movementDateFrom').value;
    const to = document.getElementById('movementDateTo').value;
    const type = document.getElementById('movementType').value;
    loadMovements({ from, to, type });
});

function openStockModal(productId = null) {
    const modal = document.getElementById('stockModal');
    const select = document.getElementById('stockProduct');
    if (select) {
        select.innerHTML = `
            <option value="">اختر منتج...</option>
            ${inventoryProducts.map(p => `
                <option value="${p.id}" ${p.id === productId ? 'selected' : ''}>
                    ${escapeHtml(p.name)} (${p.quantity} متوفر)
                </option>
            `).join('')}
        `;
    }
    document.getElementById('stockQuantity').value = '';
    document.getElementById('stockType').value = 'in';
    if (modal) modal.classList.add('active');
}

function closeStockModal() {
    document.getElementById('stockModal')?.classList.remove('active');
    document.getElementById('stockForm')?.reset();
}

async function handleStockSubmit(e) {
    e.preventDefault();
    
    const productId = document.getElementById('stockProduct').value;
    const quantity = parseInt(document.getElementById('stockQuantity').value);
    const type = document.getElementById('stockType').value;
    
    if (!productId) { 
        showToast('يرجى اختيار منتج', 'error'); 
        return; 
    }
    if (!quantity || quantity <= 0) { 
        showToast('يرجى إدخال كمية صحيحة', 'error'); 
        return; 
    }
    
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const product = inventoryProducts.find(p => p.id === productId);
        if (!product) { 
            showToast('المنتج غير موجود', 'error'); 
            return; 
        }
        
        const newQuantity = type === 'in' ? product.quantity + quantity : product.quantity - quantity;
        if (newQuantity < 0) { 
            showToast('الكمية المطلوبة للسحب غير متوفرة', 'error'); 
            return; 
        }
        
        const movement = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            product_id: productId,
            type: type,
            quantity: quantity,
            created_at: new Date().toISOString()
        };
        
        if (navigator.onLine) {
            const { error: updateError } = await supabaseClient
                .from('products')
                .update({ quantity: newQuantity })
                .eq('id', productId);
            if (updateError) throw updateError;
            
            const { error: movementError } = await supabaseClient
                .from('stock_movements')
                .insert([movement]);
            if (movementError) throw movementError;
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            product.quantity = newQuantity;
            await offlineManager.saveToLocalDB('products', product);
            await offlineManager.saveToLocalDB('stock_movements', movement);
            await offlineManager.addPendingOperation({
                type: 'stock_movement',
                data: movement
            });
            showToast('📴 تم تحديث المخزون (سيتم المزامنة عند الاتصال)', 'info');
        }
        
        showToast('✅ تم تحديث المخزون بنجاح', 'success');
        closeStockModal();
        await loadInventoryData();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
    } catch (error) {
        console.error('Error updating stock:', error);
        showToast('حدث خطأ في تحديث المخزون: ' + (error.message || 'غير معروف'), 'error');
    }
}

document.getElementById('inventorySearch')?.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const filtered = inventoryProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
    renderInventoryProducts(filtered);
});

// ============================================================
// EVENT LISTENERS FOR TABS
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const tab = this.dataset.tab;
            if (tab && typeof switchInventoryTab === 'function') {
                switchInventoryTab(tab);
            }
        });
    });
});

// ============================================================
// EXPORT
// ============================================================
window.loadInventoryData = loadInventoryData;
window.openStockModal = openStockModal;
window.switchInventoryTab = switchInventoryTab;

console.log('✅ Inventory Module Loaded');