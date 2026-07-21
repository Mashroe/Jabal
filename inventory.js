// ============================================================
// INVENTORY MANAGEMENT
// ============================================================

let inventoryItems = [];
let allMovements = [];

async function loadInventoryData() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        await Promise.all([loadInventoryItems(), loadMovements()]);
        switchInventoryTab('current');
    } catch (error) {
        console.error('Error loading inventory:', error);
        showToast('حدث خطأ في تحميل بيانات المخزون', 'error');
    }
}

async function loadInventoryItems() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return;
        }
        
        let items = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('inventory')
                .select(`
                    *,
                    products (name, price)
                `)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            items = data || [];
            console.log(`✅ Loaded ${items.length} inventory items`);
            
            if (typeof offlineManager !== 'undefined' && offlineManager && items.length > 0) {
                await offlineManager.saveToLocalDB('inventory', items);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            items = await offlineManager.getFromLocalDB('inventory');
            console.log(`📴 Loaded ${items.length} inventory items from local DB`);
            if (items.length > 0) {
                showToast('📴 عرض المخزون من الذاكرة المحلية', 'info');
            }
        }
        
        inventoryItems = items;
        renderInventoryItems(items);
        updateAlerts(items);
        checkLowStockAlert(items);
        
    } catch (error) {
        console.error('Error loading inventory items:', error);
        showToast('حدث خطأ في تحميل المخزون', 'error');
    }
}

function renderInventoryItems(items) {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) {
        console.warn('⚠️ inventoryTableBody not found');
        return;
    }
    
    if (!items || items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                    📦 لا توجد منتجات في المخزون
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = items.map((item, index) => {
        const productName = item.products?.name || 'منتج محذوف';
        const productPrice = item.products?.price || 0;
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(productName)}</strong></td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(productPrice)}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="openStockModal('${item.id}')" title="تعديل المخزون">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteInventoryItem('${item.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function deleteInventoryItem(id) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا العنصر من المخزون؟')) return;
    
    try {
        const { error } = await supabaseClient
            .from('inventory')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('✅ تم حذف العنصر من المخزون', 'success');
        await loadInventoryData();
        
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        showToast('حدث خطأ في حذف العنصر', 'error');
    }
}

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

function updateAlerts(items) {
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;
    
    const lowStockItems = items.filter(i => i.quantity <= 5 && i.quantity > 0);
    const outOfStockItems = items.filter(i => i.quantity <= 0);
    
    let alertsHTML = '';
    
    if (outOfStockItems.length > 0) {
        alertsHTML += `
            <div class="alert-card alert-danger">
                <i class="fas fa-times-circle"></i>
                <div class="alert-content">
                    <h4>⚠️ منتجات نفذت من المخزون</h4>
                    <p>المنتجات التالية تحتاج إلى إعادة توريد:</p>
                    <ul>
                        ${outOfStockItems.map(i => 
                            `<li>${escapeHtml(i.products?.name || 'منتج محذوف')} - الكمية: ${i.quantity}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    if (lowStockItems.length > 0) {
        alertsHTML += `
            <div class="alert-card alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="alert-content">
                    <h4>⚠️ منتجات منخفضة المخزون</h4>
                    <p>المنتجات التالية قاربت على النفاذ:</p>
                    <ul>
                        ${lowStockItems.map(i => 
                            `<li>${escapeHtml(i.products?.name || 'منتج محذوف')} - الكمية: ${i.quantity}</li>`
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

function checkLowStockAlert(items) {
    const lowStock = items.filter(i => i.quantity <= 5 && i.quantity > 0);
    const outOfStock = items.filter(i => i.quantity <= 0);
    
    if (lowStock.length > 0 || outOfStock.length > 0) {
        if (Notification.permission === 'granted') {
            new Notification('⚠️ تنبيه المخزون', {
                body: `${outOfStock.length + lowStock.length} منتج بحاجة للمراجعة`,
                icon: '🏷️'
            });
        }
    }
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

function switchInventoryTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) btn.classList.add('active');
    });
    
    document.getElementById('currentStockTab').style.display = tab === 'current' ? 'block' : 'none';
    document.getElementById('movementsTab').style.display = tab === 'movements' ? 'block' : 'none';
    document.getElementById('alertsTab').style.display = tab === 'alerts' ? 'block' : 'none';
    
    if (tab === 'current') renderInventoryItems(inventoryItems);
    else if (tab === 'movements') loadMovements();
}

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

function openStockModal(itemId = null) {
    const modal = document.getElementById('stockModal');
    const select = document.getElementById('stockProduct');
    
    // إذا كان هناك itemId، نعدل المخزون الموجود
    if (itemId) {
        const item = inventoryItems.find(i => i.id === itemId);
        if (item) {
            select.innerHTML = `
                <option value="${item.product_id}">${escapeHtml(item.products?.name || 'منتج محذوف')} (${item.quantity} متوفر)</option>
            `;
            document.getElementById('stockQuantity').value = '';
            document.getElementById('stockType').value = 'in';
            modal.classList.add('active');
            return;
        }
    }
    
    // إضافة مخزون جديد
    select.innerHTML = `
        <option value="">اختر منتج...</option>
        ${currentProducts.map(p => `
            <option value="${p.id}">${escapeHtml(p.name)}</option>
        `).join('')}
    `;
    
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
    
    if (!productId) { showToast('يرجى اختيار منتج', 'error'); return; }
    if (!quantity || quantity <= 0) { showToast('يرجى إدخال كمية صحيحة', 'error'); return; }
    
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        // التحقق من وجود المنتج في المخزون
        const { data: existingInventory } = await supabaseClient
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', productId)
            .maybeSingle();
        
        let newQuantity;
        
        if (existingInventory) {
            // تحديث الكمية
            newQuantity = type === 'in' ? existingInventory.quantity + quantity : existingInventory.quantity - quantity;
            
            if (newQuantity < 0) {
                showToast('الكمية المطلوبة للسحب غير متوفرة', 'error');
                return;
            }
            
            const { error: updateError } = await supabaseClient
                .from('inventory')
                .update({ quantity: newQuantity })
                .eq('id', existingInventory.id);
            
            if (updateError) throw updateError;
            
        } else {
            // إضافة منتج جديد للمخزون
            if (type === 'out') {
                showToast('لا يمكن سحب كمية من منتج غير موجود في المخزون', 'error');
                return;
            }
            
            newQuantity = quantity;
            
            const { error: insertError } = await supabaseClient
                .from('inventory')
                .insert([{
                    product_id: productId,
                    quantity: quantity
                }]);
            
            if (insertError) throw insertError;
        }
        
        // تسجيل حركة المخزون
        const { error: movementError } = await supabaseClient
            .from('stock_movements')
            .insert([{
                product_id: productId,
                type: type,
                quantity: quantity,
                note: type === 'in' ? 'إضافة مخزون' : 'سحب من المخزون'
            }]);
        
        if (movementError) throw movementError;
        
        showToast(`✅ تم ${type === 'in' ? 'إضافة' : 'سحب'} المخزون بنجاح`, 'success');
        
        closeStockModal();
        await loadInventoryData();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        if (typeof loadProducts === 'function') {
            await loadProducts();
        }
        
    } catch (error) {
        console.error('Error updating stock:', error);
        showToast('حدث خطأ في تحديث المخزون: ' + (error.message || 'غير معروف'), 'error');
    }
}

document.getElementById('inventorySearch')?.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const filtered = inventoryItems.filter(i => 
        i.products?.name?.toLowerCase().includes(searchTerm)
    );
    renderInventoryItems(filtered);
});

window.loadInventoryData = loadInventoryData;
window.openStockModal = openStockModal;
window.switchInventoryTab = switchInventoryTab;

console.log('✅ Inventory Module Loaded');
