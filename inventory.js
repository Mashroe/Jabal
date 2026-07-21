// ============================================================
// INVENTORY MANAGEMENT (مخزون منفصل تماماً)
// ============================================================

let inventoryItems = [];

// ============================================================
// تحميل المخزون
// ============================================================
async function loadInventoryData() {
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        inventoryItems = data || [];
        renderInventoryItems(inventoryItems);
        
        // تحديث التنبيهات
        updateInventoryAlerts(inventoryItems);
        
    } catch (error) {
        console.error('Error loading inventory:', error);
        showToast('حدث خطأ في تحميل المخزون', 'error');
    }
}

// ============================================================
// عرض المخزون
// ============================================================
function renderInventoryItems(items) {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    
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
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(item.product_name)}</strong></td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price || 0)}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editInventoryItem('${item.id}')" title="تعديل">
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

// ============================================================
// تنبيهات المخزون
// ============================================================
function updateInventoryAlerts(items) {
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;
    
    const lowStock = items.filter(i => i.quantity <= 5 && i.quantity > 0);
    const outOfStock = items.filter(i => i.quantity <= 0);
    
    let alertsHTML = '';
    
    if (outOfStock.length > 0) {
        alertsHTML += `
            <div class="alert-card alert-danger">
                <i class="fas fa-times-circle"></i>
                <div class="alert-content">
                    <h4>⚠️ منتجات نفذت من المخزون</h4>
                    <ul>
                        ${outOfStock.map(i => `<li>${escapeHtml(i.product_name)} - الكمية: ${i.quantity}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    if (lowStock.length > 0) {
        alertsHTML += `
            <div class="alert-card alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="alert-content">
                    <h4>⚠️ منتجات منخفضة المخزون</h4>
                    <ul>
                        ${lowStock.map(i => `<li>${escapeHtml(i.product_name)} - الكمية: ${i.quantity}</li>`).join('')}
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
// إضافة مخزون جديد
// ============================================================
function openAddInventoryModal() {
    document.getElementById('inventoryModalTitle').textContent = '➕ إضافة مخزون جديد';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inventoryId').value = '';
    document.getElementById('inventoryModal').classList.add('active');
}

// ============================================================
// تعديل مخزون
// ============================================================
function editInventoryItem(id) {
    const item = inventoryItems.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('inventoryModalTitle').textContent = '✏️ تعديل المخزون';
    document.getElementById('inventoryId').value = item.id;
    document.getElementById('inventoryName').value = item.product_name;
    document.getElementById('inventoryQuantity').value = item.quantity;
    document.getElementById('inventoryPrice').value = item.price || 0;
    document.getElementById('inventoryModal').classList.add('active');
}

// ============================================================
// حفظ المخزون (مصحح)
// ============================================================
document.getElementById('inventoryForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('inventoryId').value;
    const productName = document.getElementById('inventoryName').value.trim();
    const quantity = parseInt(document.getElementById('inventoryQuantity').value);
    const price = parseFloat(document.getElementById('inventoryPrice').value) || 0;
    
    // ===== التحقق من البيانات =====
    if (!productName) {
        showToast('يرجى إدخال اسم المنتج', 'error');
        return;
    }
    if (!quantity || quantity <= 0) {
        showToast('يرجى إدخال كمية صحيحة', 'error');
        return;
    }
    
    try {
        // ===== جاهزية البيانات للإرسال =====
        const dataToSend = {
            product_name: productName,
            quantity: quantity,
            price: price,
            updated_at: new Date().toISOString()
        };
        
        console.log('📤 Sending data:', dataToSend);
        
        if (id) {
            // ===== تعديل =====
            const { error } = await supabaseClient
                .from('inventory')
                .update(dataToSend)
                .eq('id', id);
            
            if (error) {
                console.error('Update error:', error);
                throw error;
            }
            showToast('✅ تم تحديث المخزون بنجاح', 'success');
            
        } else {
            // ===== إضافة جديدة =====
            const { error } = await supabaseClient
                .from('inventory')
                .insert([dataToSend]);
            
            if (error) {
                console.error('Insert error:', error);
                throw error;
            }
            showToast('✅ تم إضافة المخزون بنجاح', 'success');
        }
        
        closeInventoryModal();
        await loadInventoryData();
        
    } catch (error) {
        console.error('❌ Error saving inventory:', error);
        showToast('⚠️ حدث خطأ في حفظ المخزون: ' + (error.message || 'غير معروف'), 'error');
    }
});

// ============================================================
// حذف مخزون
// ============================================================
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

// ============================================================
// إغلاق النافذة
// ============================================================
function closeInventoryModal() {
    document.getElementById('inventoryModal').classList.remove('active');
    document.getElementById('inventoryForm').reset();
}

// ============================================================
// البحث في المخزون
// ============================================================
document.getElementById('inventorySearch')?.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const filtered = inventoryItems.filter(i => 
        i.product_name.toLowerCase().includes(searchTerm)
    );
    renderInventoryItems(filtered);
});

// ============================================================
// EXPORT
// ============================================================
window.loadInventoryData = loadInventoryData;
window.openAddInventoryModal = openAddInventoryModal;
window.editInventoryItem = editInventoryItem;
window.deleteInventoryItem = deleteInventoryItem;

console.log('✅ Inventory Module Loaded');
