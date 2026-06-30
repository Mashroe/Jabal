// ============================================================
// PURCHASES MANAGEMENT (نظام المشتريات)
// ============================================================

let allPurchases = [];
let purchaseCart = [];
let editingPurchaseId = null;

async function loadPurchases() {
    try {
        console.log('🔄 Loading purchases...');
        
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return [];
        }
        
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('purchases')
                .select(`
                    *,
                    purchase_items (
                        *,
                        products (name)
                    ),
                    customers:supplier_id (name, phone)
                `)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            allPurchases = data || [];
            console.log(`✅ Loaded ${allPurchases.length} purchases`);
            
            if (typeof offlineManager !== 'undefined' && offlineManager && allPurchases.length > 0) {
                await offlineManager.saveToLocalDB('purchases', allPurchases);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            allPurchases = await offlineManager.getFromLocalDB('purchases');
            console.log(`📴 Loaded ${allPurchases.length} purchases from local DB`);
        }
        
        renderPurchases(allPurchases);
        updatePurchasesCount(allPurchases.length);
        return allPurchases;
        
    } catch (error) {
        console.error('Error loading purchases:', error);
        showToast('حدث خطأ في تحميل المشتريات', 'error');
        return [];
    }
}

function renderPurchases(purchases) {
    const tbody = document.getElementById('purchasesTableBody');
    if (!tbody) return;
    
    if (!purchases || purchases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                    لا توجد مشتريات
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = purchases.map((purchase, index) => {
        const date = new Date(purchase.created_at).toLocaleString('ar-SA');
        const supplierName = purchase.customers?.name || '---';
        const itemsCount = purchase.purchase_items?.length || 0;
        const status = purchase.status || 'completed';
        const statusBadge = status === 'completed' 
            ? '<span class="badge badge-success">مكتملة</span>'
            : status === 'pending' 
                ? '<span class="badge badge-warning">قيد الانتظار</span>'
                : '<span class="badge badge-danger">ملغية</span>';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>#${purchase.id.slice(0, 8).toUpperCase()}</strong></td>
                <td>${date}</td>
                <td>${escapeHtml(supplierName)}</td>
                <td>${itemsCount}</td>
                <td>${formatCurrency(purchase.total)}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="viewPurchase('${purchase.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${status === 'completed' ? `
                        <button class="action-btn delete-btn" onclick="cancelPurchase('${purchase.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function openPurchaseModal() {
    editingPurchaseId = null;
    purchaseCart = [];
    document.getElementById('purchaseModalTitle').textContent = '📦 إضافة مشتريات جديدة';
    document.getElementById('purchaseId').value = '';
    document.getElementById('purchaseForm').reset();
    updatePurchaseCart();
    await loadProductsForPurchase();
    await loadSuppliersForPurchase();
    document.getElementById('purchaseModal').classList.add('active');
}

async function loadProductsForPurchase() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return;
        }
        
        const products = await loadProducts();
        const select = document.getElementById('purchaseProductSelect');
        if (!select) return;
        
        select.innerHTML = `
            <option value="">اختر منتج...</option>
            ${products.map(p => `
                <option value="${p.id}">
                    ${escapeHtml(p.name)} - ${formatCurrency(p.price)} (${p.quantity} متوفر)
                </option>
            `).join('')}
        `;
    } catch (error) {
        console.error('Error loading products for purchase:', error);
    }
}

async function loadSuppliersForPurchase() {
    try {
        const customers = await loadCustomers();
        const select = document.getElementById('purchaseSupplier');
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = `
            <option value="">بدون مورد</option>
            ${customers.map(c => `
                <option value="${c.id}">${escapeHtml(c.name)}</option>
            `).join('')}
        `;
        if (currentValue) select.value = currentValue;
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

function addProductByName() {
    const productName = document.getElementById('purchaseProductName').value.trim();
    const quantity = parseInt(document.getElementById('purchaseQuantity').value);
    const price = parseFloat(document.getElementById('purchasePrice').value);
    
    if (!productName) {
        showToast('يرجى إدخال اسم المنتج', 'error');
        return;
    }
    if (!quantity || quantity <= 0) {
        showToast('يرجى إدخال كمية صحيحة', 'error');
        return;
    }
    if (!price || price <= 0) {
        showToast('يرجى إدخال سعر صحيح', 'error');
        return;
    }
    
    const existing = purchaseCart.find(item => item.product_name === productName);
    if (existing) {
        existing.quantity += quantity;
        existing.price = price;
    } else {
        purchaseCart.push({
            product_id: 'temp_' + Date.now(),
            product_name: productName,
            quantity: quantity,
            price: price
        });
    }
    
    updatePurchaseCart();
    showToast(`تم إضافة ${productName} إلى سلة المشتريات`, 'success');
    
    document.getElementById('purchaseProductName').value = '';
    document.getElementById('purchaseQuantity').value = '';
    document.getElementById('purchasePrice').value = '';
}

function updatePurchaseCart() {
    const container = document.getElementById('purchaseCartItems');
    if (!container) return;
    
    if (purchaseCart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-basket"></i>
                <p>سلة المشتريات فارغة</p>
                <span>أضف منتجات للشراء</span>
            </div>
        `;
        return;
    }
    
    container.innerHTML = purchaseCart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${escapeHtml(item.product_name)}</h4>
                <p>${item.quantity} × ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}</p>
            </div>
            <div class="cart-item-controls">
                <button onclick="removeFromPurchaseCart(${index})" class="remove-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    const total = purchaseCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('purchaseTotal').textContent = formatCurrency(total);
}

function removeFromPurchaseCart(index) {
    purchaseCart.splice(index, 1);
    updatePurchaseCart();
}

document.getElementById('purchaseForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (purchaseCart.length === 0) {
        showToast('يرجى إضافة منتجات إلى سلة المشتريات', 'error');
        return;
    }
    
    if (typeof supabaseClient === 'undefined') {
        showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }
    
    const supplierId = document.getElementById('purchaseSupplier').value;
    const notes = document.getElementById('purchaseNotes').value.trim();
    const total = purchaseCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    try {
        // التحقق من وجود المنتجات في قاعدة البيانات
        const productIds = purchaseCart.filter(item => !item.product_id.startsWith('temp_')).map(item => item.product_id);
        
        // إذا كان هناك منتجات جديدة (بـ temp_) نحتاج إلى إضافتها أولاً
        const newProducts = purchaseCart.filter(item => item.product_id.startsWith('temp_'));
        
        for (const newItem of newProducts) {
            // البحث عن المنتج في قاعدة البيانات
            const { data: existingProduct } = await supabaseClient
                .from('products')
                .select('id')
                .eq('name', newItem.product_name)
                .maybeSingle();
            
            if (existingProduct) {
                // المنتج موجود - استخدم الـ ID الخاص به
                newItem.product_id = existingProduct.id;
            } else {
                // المنتج غير موجود - أضفه
                const { data: newProduct, error: createError } = await supabaseClient
                    .from('products')
                    .insert([{
                        name: newItem.product_name,
                        price: newItem.price,
                        quantity: 0
                    }])
                    .select()
                    .single();
                
                if (createError) throw createError;
                newItem.product_id = newProduct.id;
            }
        }
        
        const purchaseData = {
            supplier_id: supplierId || null,
            total: total,
            status: 'completed',
            notes: notes || null,
            created_at: new Date().toISOString()
        };
        
        const { data: purchase, error: purchaseError } = await supabaseClient
            .from('purchases')
            .insert([purchaseData])
            .select();
        
        if (purchaseError) throw purchaseError;
        
        const purchaseId = purchase[0].id;
        
        const items = purchaseCart.map(item => ({
            purchase_id: purchaseId,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price
        }));
        
        const { error: itemsError } = await supabaseClient
            .from('purchase_items')
            .insert(items);
        
        if (itemsError) throw itemsError;
        
        for (const item of purchaseCart) {
            const { data: product } = await supabaseClient
                .from('products')
                .select('quantity')
                .eq('id', item.product_id)
                .single();
            
            if (product) {
                const newQuantity = product.quantity + item.quantity;
                await supabaseClient
                    .from('products')
                    .update({ quantity: newQuantity })
                    .eq('id', item.product_id);
                
                await supabaseClient
                    .from('stock_movements')
                    .insert([{
                        product_id: item.product_id,
                        type: 'in',
                        quantity: item.quantity,
                        note: `شراء - فاتورة #${purchaseId.slice(0, 8)}`
                    }]);
            }
        }
        
        showToast('تمت إضافة المشتريات بنجاح', 'success');
        closePurchaseModal();
        await loadPurchases();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        await loadProducts();
        
    } catch (error) {
        console.error('Error saving purchase:', error);
        showToast('حدث خطأ في حفظ المشتريات: ' + (error.message || 'غير معروف'), 'error');
    }
});

async function viewPurchase(purchaseId) {
    try {
        const purchase = allPurchases.find(p => p.id === purchaseId);
        if (!purchase) {
            showToast('المشتريات غير موجودة', 'error');
            return;
        }
        
        const items = purchase.purchase_items || [];
        const total = purchase.total || 0;
        const date = new Date(purchase.created_at).toLocaleString('ar-SA');
        const supplierName = purchase.customers?.name || '---';
        
        const modal = document.getElementById('purchaseDetailModal');
        const body = document.getElementById('purchaseDetailBody');
        
        if (body) {
            body.innerHTML = `
                <div class="purchase-detail">
                    <div class="purchase-info">
                        <p><strong>رقم الفاتورة:</strong> #${purchase.id.slice(0, 8).toUpperCase()}</p>
                        <p><strong>التاريخ:</strong> ${date}</p>
                        <p><strong>المورد:</strong> ${escapeHtml(supplierName)}</p>
                        ${purchase.notes ? `<p><strong>ملاحظات:</strong> ${escapeHtml(purchase.notes)}</p>` : ''}
                    </div>
                    <div class="receipt-divider"></div>
                    <div class="receipt-items">
                        ${items.map(item => `
                            <div class="receipt-item">
                                <span>${escapeHtml(item.products?.name || 'منتج محذوف')}</span>
                                <span>${item.quantity} × ${formatCurrency(item.price)}</span>
                                <span>${formatCurrency(item.price * item.quantity)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="receipt-divider"></div>
                    <div class="receipt-total">
                        <span>الإجمالي</span>
                        <span>${formatCurrency(total)}</span>
                    </div>
                </div>
            `;
        }
        
        if (modal) modal.classList.add('active');
        
    } catch (error) {
        console.error('Error viewing purchase:', error);
        showToast('حدث خطأ في عرض المشتريات', 'error');
    }
}

async function cancelPurchase(purchaseId) {
    if (!confirm('هل أنت متأكد من إلغاء هذه المشتريات؟')) return;
    
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const purchase = allPurchases.find(p => p.id === purchaseId);
        if (!purchase) {
            showToast('المشتريات غير موجودة', 'error');
            return;
        }
        
        const { error } = await supabaseClient
            .from('purchases')
            .update({ status: 'cancelled' })
            .eq('id', purchaseId);
        
        if (error) throw error;
        
        if (purchase.purchase_items) {
            for (const item of purchase.purchase_items) {
                const { data: product } = await supabaseClient
                    .from('products')
                    .select('quantity')
                    .eq('id', item.product_id)
                    .single();
                
                if (product) {
                    await supabaseClient
                        .from('products')
                        .update({ quantity: product.quantity - item.quantity })
                        .eq('id', item.product_id);
                }
            }
        }
        
        showToast('تم إلغاء المشتريات بنجاح', 'success');
        await loadPurchases();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        await loadProducts();
        
    } catch (error) {
        console.error('Error cancelling purchase:', error);
        showToast('حدث خطأ في إلغاء المشتريات', 'error');
    }
}

function updatePurchasesCount(count) {
    const element = document.getElementById('purchasesCount');
    if (element) element.textContent = `${count} مشتريات`;
}

function searchPurchase() {
    const searchTerm = document.getElementById('purchaseSearchInput')?.value?.toLowerCase() || '';
    const filtered = allPurchases.filter(p => 
        p.id.toLowerCase().includes(searchTerm) ||
        p.customers?.name?.toLowerCase().includes(searchTerm)
    );
    renderPurchases(filtered);
}

function closePurchaseModal() {
    document.getElementById('purchaseModal').classList.remove('active');
    document.getElementById('purchaseForm').reset();
    purchaseCart = [];
}

function closePurchaseDetailModal() {
    document.getElementById('purchaseDetailModal').classList.remove('active');
}

window.loadPurchases = loadPurchases;
window.openPurchaseModal = openPurchaseModal;
window.addProductByName = addProductByName;
window.removeFromPurchaseCart = removeFromPurchaseCart;
window.viewPurchase = viewPurchase;
window.cancelPurchase = cancelPurchase;
window.searchPurchase = searchPurchase;

console.log('✅ Purchases Module Loaded');