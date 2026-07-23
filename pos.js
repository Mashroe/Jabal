// ============================================================
// POS SYSTEM - نسخة محسنة مع إصلاح الطباعة
// ============================================================

let posProducts = [];
let cart = [];
let lastSaleData = null;
let invoiceType = 'final'; // 'final' أو 'draft'

// ============================================================
// اختيار نوع الفاتورة
// ============================================================
function selectInvoiceType(type) {
    invoiceType = type;
    
    document.querySelectorAll('.invoice-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });
    
    console.log('📄 Invoice type:', type === 'final' ? 'فاتورة بيع' : 'فاتورة مبدئية');
}

async function loadPOSProducts() {
    try {
        console.log('🔄 Loading POS products...');
        let products = [];
        
        if (typeof supabaseClient === 'undefined') {
            console.error('❌ supabaseClient is not defined');
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return [];
        }
        
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
            console.log(`✅ Loaded ${products.length} POS products from Supabase`);
            
            if (typeof offlineManager !== 'undefined' && offlineManager && products.length > 0) {
                await offlineManager.saveToLocalDB('products', products);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            products = await offlineManager.getFromLocalDB('products');
            console.log(`📴 Loaded ${products.length} POS products from local DB`);
            if (products.length > 0) {
                showToast('📴 عرض المنتجات من الذاكرة المحلية', 'info');
            }
        } else {
            console.warn('⚠️ Offline Manager not available');
        }
        
        posProducts = products;
        renderPOSProducts(posProducts);
        return products;
        
    } catch (error) {
        console.error('Error loading POS products:', error);
        try {
            if (typeof offlineManager !== 'undefined' && offlineManager) {
                const products = await offlineManager.getFromLocalDB('products');
                if (products && products.length > 0) {
                    posProducts = products;
                    renderPOSProducts(posProducts);
                    showToast('📴 عرض المنتجات من الذاكرة المحلية', 'info');
                    return products;
                }
            }
        } catch (e) {
            console.error('Error loading from local DB:', e);
        }
        showToast('حدث خطأ في تحميل المنتجات', 'error');
        return [];
    }
}

function renderPOSProducts(products) {
    const grid = document.getElementById('posProductsGrid');
    if (!grid) {
        console.warn('⚠️ posProductsGrid not found');
        return;
    }
    
    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div class="empty-products">
                <i class="fas fa-box-open"></i>
                <p>لا توجد منتجات متاحة</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = products.map(product => `
        <div class="pos-product-card" onclick="addToCart('${product.id}')" data-id="${product.id}">
            <div class="product-icon">
                <i class="fas fa-box"></i>
            </div>
            <div class="product-info">
                <h4>${escapeHtml(product.name)}</h4>
                <p>${formatCurrency(product.price)}</p>
                <span class="stock-info ${product.quantity <= 0 ? 'out' : product.quantity <= 5 ? 'low' : ''}">
                    ${product.quantity <= 0 ? '⚠️ نفذ' : product.quantity <= 5 ? '⚠️ منخفض' : `📦 ${product.quantity}`}
                </span>
            </div>
        </div>
    `).join('');
}

function addToCart(productId) {
    const product = posProducts.find(p => p.id === productId);
    if (!product) {
        showToast('المنتج غير موجود', 'error');
        return;
    }
    if (product.quantity <= 0) {
        showToast('المنتج غير متوفر في المخزون', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        if (existingItem.quantity + 1 > product.quantity) {
            showToast('الكمية المطلوبة غير متوفرة في المخزون', 'error');
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            maxQuantity: product.quantity
        });
    }
    updateCart();
    showToast(`تم إضافة ${product.name} إلى السلة`, 'success');
}

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const subtotalEl = document.getElementById('cartSubtotal');
    const taxEl = document.getElementById('cartTax');
    const totalEl = document.getElementById('cartTotal');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalItems;
    
    if (cart.length === 0) {
        if (cartItems) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-basket"></i>
                    <p>السلة فارغة</p>
                    <span>أضف منتجات للبدء</span>
                </div>
            `;
        }
        if (subtotalEl) subtotalEl.textContent = '0.00 SDG';
        if (taxEl) taxEl.textContent = '0.00 SDG';
        if (totalEl) totalEl.textContent = '0.00 SDG';
        return;
    }
    
    if (cartItems) {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.name)}</h4>
                    <p>${formatCurrency(item.price)}</p>
                </div>
                <div class="cart-item-controls">
                    <button onclick="updateCartQuantity('${item.id}', -1)" class="qty-btn">-</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button onclick="updateCartQuantity('${item.id}', 1)" class="qty-btn">+</button>
                    <button onclick="removeFromCart('${item.id}')" class="remove-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0;
    const total = subtotal + tax;
    
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (taxEl) taxEl.textContent = formatCurrency(tax);
    if (totalEl) totalEl.textContent = formatCurrency(total);
}

function updateCartQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    const product = posProducts.find(p => p.id === productId);
    if (product && newQuantity > product.quantity) {
        showToast('الكمية المطلوبة غير متوفرة في المخزون', 'error');
        return;
    }
    item.quantity = newQuantity;
    updateCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('هل أنت متأكد من تفريغ السلة؟')) {
        cart = [];
        updateCart();
        showToast('تم تفريغ السلة', 'success');
    }
}

// ============================================================
// معاينة الفاتورة قبل إتمام البيع
// ============================================================
function previewInvoice() {
    if (cart.length === 0) {
        showToast('السلة فارغة. أضف منتجات أولاً', 'error');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const customerNameInput = document.getElementById('customerName');
    const customerName = customerNameInput ? customerNameInput.value.trim() : 'عميل';
    
    const tempSale = {
        id: 'preview_' + Date.now(),
        total: total,
        customer_name: customerName || 'عميل',
        invoice_type: invoiceType,
        created_at: new Date().toISOString()
    };
    
    showReceiptPreview(tempSale, cart, total, invoiceType);
}

// ============================================================
// عرض فاتورة المعاينة
// ============================================================
function showReceiptPreview(sale, items, total, type = 'final') {
    const modal = document.getElementById('receiptModal');
    const body = document.getElementById('receiptBody');
    const date = new Date(sale.created_at).toLocaleString('ar-SA');
    const receiptNumber = 'معاينة-' + Date.now().toString().slice(-6);
    const customerName = sale.customer_name || 'عميل';
    const customerTitle = `السيد/ ${customerName}`;
    
    const invoiceTitle = type === 'final' ? 'فاتورة بيع' : 'فاتورة مبدئية';
    const invoiceStatus = '📄 معاينة';
    
    if (body) {
        body.innerHTML = `
            <div class="receipt" id="receiptContent">
                <div class="receipt-header">
                    <h2>🏷️ JABAL ALSAFA</h2>
                    <p>${invoiceTitle}</p>
                    <small>رقم: #${receiptNumber}</small>
                    <small>التاريخ: ${date}</small>
                    <small style="color: #ffc800;">${invoiceStatus}</small>
                    <div class="customer-name-display">
                        <strong>${escapeHtml(customerTitle)}</strong>
                    </div>
                </div>
                <div class="receipt-divider"></div>
                
                <div class="receipt-table-header">
                    <span>الصنف</span>
                    <span>الكمية</span>
                    <span>السعر</span>
                    <span>الإجمالي</span>
                </div>
                
                <div class="receipt-divider"></div>
                
                <div class="receipt-items">
                    ${items.map(item => `
                        <div class="receipt-item">
                            <span class="item-name">${escapeHtml(item.name || item.product_name || 'منتج')}</span>
                            <span class="item-qty">${item.quantity}</span>
                            <span class="item-price">${formatCurrency(item.price)}</span>
                            <span class="item-total">${formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="receipt-divider"></div>
                
                <div class="receipt-total">
                    <span>المجموع الكلي</span>
                    <span>${formatCurrency(total)}</span>
                </div>
                
                <div class="receipt-footer">
                    <small style="color: #ffc800;">⚠️ هذه معاينة للفاتورة، لم تتم العملية بعد</small>
                </div>
            </div>
        `;
        
        const actions = document.querySelector('#receiptModal .modal-actions');
        if (actions) {
            actions.innerHTML = `
                <button class="btn-secondary" onclick="closeReceiptPreview()">
                    <i class="fas fa-times"></i>
                    إغلاق
                </button>
                <button class="btn-primary" onclick="closeReceiptPreviewAndCheckout()">
                    <i class="fas fa-check"></i>
                    تأكيد وإتمام البيع
                </button>
            `;
        }
    }
    if (modal) modal.classList.add('active');
}

// ============================================================
// إغلاق معاينة الفاتورة
// ============================================================
function closeReceiptPreview() {
    document.getElementById('receiptModal').classList.remove('active');
}

// ============================================================
// إغلاق المعاينة وإتمام البيع
// ============================================================
function closeReceiptPreviewAndCheckout() {
    document.getElementById('receiptModal').classList.remove('active');
    checkout();
}

async function checkout() {
    if (cart.length === 0) {
        showToast('السلة فارغة. أضف منتجات أولاً', 'error');
        return;
    }
    
    if (typeof supabaseClient === 'undefined') {
        showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }
    
    for (const item of cart) {
        const product = posProducts.find(p => p.id === item.id);
        if (!product || product.quantity < item.quantity) {
            showToast(`الكمية المطلوبة من ${item.name} غير متوفرة`, 'error');
            return;
        }
    }
    
    try {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const saleId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        
        const customerNameInput = document.getElementById('customerName');
        const customerName = customerNameInput ? customerNameInput.value.trim() : 'عميل';
        console.log('👤 Customer Name:', customerName);
        
        const invoiceTypeLabel = invoiceType === 'final' ? 'فاتورة بيع' : 'فاتورة مبدئية';
        console.log('📄 Invoice Type:', invoiceTypeLabel);
        
        const sale = {
            id: saleId,
            total: total,
            customer_name: customerName || 'عميل',
            invoice_type: invoiceType,
            created_at: new Date().toISOString()
        };
        
        const items = cart.map(item => ({
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            sale_id: saleId,
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            product_name: item.name
        }));
        
        console.log('📦 Sale data:', sale);
        console.log('📦 Items data:', items);
        
        lastSaleData = { sale, items, total };
        
        if (navigator.onLine) {
            const { error: saleError } = await supabaseClient
                .from('sales')
                .insert([sale]);
            
            if (saleError) {
                console.error('❌ Sale error:', saleError);
                throw saleError;
            }
            
            const { error: itemsError } = await supabaseClient
                .from('sale_items')
                .insert(items);
            
            if (itemsError) {
                console.error('❌ Items error:', itemsError);
                throw itemsError;
            }
            
            for (const item of cart) {
                const product = posProducts.find(p => p.id === item.id);
                if (product) {
                    const newQuantity = product.quantity - item.quantity;
                    await supabaseClient
                        .from('products')
                        .update({ quantity: newQuantity })
                        .eq('id', item.id);
                    
                    await supabaseClient
                        .from('stock_movements')
                        .insert([{
                            product_id: item.id,
                            type: 'out',
                            quantity: item.quantity,
                            note: `بيع - فاتورة #${saleId.slice(0, 8)}`
                        }]);
                }
            }
            
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            await offlineManager.saveToLocalDB('sales', sale);
            await offlineManager.saveToLocalDB('sale_items', items);
            
            for (const item of cart) {
                const product = posProducts.find(p => p.id === item.id);
                if (product) {
                    product.quantity -= item.quantity;
                    await offlineManager.saveToLocalDB('products', product);
                }
            }
            
            await offlineManager.addPendingOperation({
                type: 'sale',
                data: { sale, items }
            });
            showToast('📴 تم البيع (سيتم المزامنة عند الاتصال)', 'info');
        }
        
        showReceipt(sale, cart, total, invoiceType);
        
        cart = [];
        updateCart();
        
        await loadPOSProducts();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        
        if (navigator.onLine) {
            showToast('✅ تم إتمام البيع بنجاح', 'success');
        }
        
    } catch (error) {
        console.error('❌ Checkout error:', error);
        showToast('⚠️ حدث خطأ في إتمام البيع: ' + (error.message || 'غير معروف'), 'error');
    }
}

function showReceipt(sale, items, total, type = 'final') {
    const modal = document.getElementById('receiptModal');
    const body = document.getElementById('receiptBody');
    const date = new Date(sale.created_at).toLocaleString('ar-SA');
    const receiptNumber = sale.id.slice(0, 8).toUpperCase();
    const customerName = sale.customer_name || 'عميل';
    const customerTitle = `السيد/ ${customerName}`;
    
    const invoiceTitle = type === 'final' ? 'فاتورة بيع' : 'فاتورة مبدئية';
    const invoiceStatus = type === 'final' ? '✅ معتمدة' : '⏳ غير معتمدة';
    
    if (body) {
        body.innerHTML = `
            <div class="receipt" id="receiptContent">
                <div class="receipt-header">
                    <h2>🏷️ JABAL ALSAFA</h2>
                    <p>${invoiceTitle}</p>
                    <small>رقم: #${receiptNumber}</small>
                    <small>التاريخ: ${date}</small>
                    <small>الحالة: ${invoiceStatus}</small>
                    <div class="customer-name-display">
                        <strong>${escapeHtml(customerTitle)}</strong>
                    </div>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-table-header">
                    <span>الصنف</span>
                    <span>الكمية</span>
                    <span>السعر</span>
                    <span>الإجمالي</span>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-items">
                    ${items.map(item => `
                        <div class="receipt-item">
                            <span class="item-name">${escapeHtml(item.name || item.product_name || 'منتج')}</span>
                            <span class="item-qty">${item.quantity}</span>
                            <span class="item-price">${formatCurrency(item.price)}</span>
                            <span class="item-total">${formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-total">
                    <span>المجموع الكلي</span>
                    <span>${formatCurrency(total)}</span>
                </div>
                <div class="receipt-footer">
                    <small>📞 للتواصل: 0129321654 - 0922500501</small>
                    <br>
                    <small>شكراً لتسوقكم معنا</small>
                </div>
            </div>
        `;
    }
    if (modal) modal.classList.add('active');
}

// ============================================================
// حقل اسم العميل - إظهار/إخفاء زر المسح
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const customerInput = document.getElementById('customerName');
    const clearBtn = document.getElementById('clearCustomerName');

    if (customerInput && clearBtn) {
        customerInput.addEventListener('input', function() {
            if (this.value.trim() !== '') {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
        });
        
        clearBtn.addEventListener('click', function() {
            customerInput.value = '';
            this.style.display = 'none';
            customerInput.focus();
        });
    }
});

function sendReceiptWhatsApp() {
    if (!lastSaleData) {
        showToast('لا توجد فاتورة لإرسالها', 'error');
        return;
    }
    
    const { sale, items, total } = lastSaleData;
    const date = new Date(sale.created_at).toLocaleString('ar-SA');
    const receiptNumber = sale.id.slice(0, 8).toUpperCase();
    const customerName = sale.customer_name || 'عميل';
    const type = sale.invoice_type || 'final';
    const invoiceTitle = type === 'final' ? 'فاتورة بيع' : 'فاتورة مبدئية';
    const customerTitle = `السيد/ ${customerName}`;
    
    let message = '🏷️ *JABAL ALSAFA*\n';
    message += '━'.repeat(30) + '\n';
    message += `📋 ${invoiceTitle}\n`;
    message += `📅 التاريخ: ${date}\n`;
    message += `👤 ${customerTitle}\n`;
    message += '━'.repeat(30) + '\n\n';
    message += '*المنتجات:*\n';
    
    items.forEach(item => {
        message += `• ${item.name || item.product_name}\n`;
        message += `  ${item.quantity} × ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}\n`;
    });
    
    message += '\n' + '━'.repeat(30) + '\n';
    message += `*المجموع الكلي: ${formatCurrency(total)}*\n`;
    message += '━'.repeat(30) + '\n';
    message += type === 'final' ? '_شكراً لتسوقكم معنا_' : '_⚠️ فاتورة مبدئية غير معتمدة_';
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

// ============================================================
// 🖨️ طباعة الفاتورة (النسخة المحسنة مع رسائل خطأ وحلول بديلة)
// ============================================================
function printReceipt() {
    try {
        // 1. التحقق من وجود محتوى الفاتورة
        const receiptContent = document.getElementById('receiptBody')?.innerHTML;
        if (!receiptContent || receiptContent.trim() === '') {
            showToast('⚠️ لا يوجد محتوى للطباعة. يرجى إنشاء فاتورة أولاً.', 'error');
            console.warn('⚠️ printReceipt: receiptBody is empty');
            return;
        }

        // 2. محاولة فتح نافذة الطباعة
        const printWindow = window.open('', '_blank', 'width=500,height=700');
        
        // 3. إذا تم حظر النافذة المنبثقة
        if (!printWindow) {
            showToast('⚠️ الرجاء السماح للنوافذ المنبثقة (Pop-up) في المتصفح', 'error');
            console.warn('⚠️ printReceipt: Pop-up blocked');
            
            // ===== حل بديل: استخدام window.print() مباشرة =====
            const shouldUseFallback = confirm(
                '⚠️ تعذر فتح نافذة الطباعة.\n\n' +
                'هل تريد طباعة الفاتورة في الصفحة الحالية بدلاً من ذلك؟\n' +
                '(سيتم إخفاء العناصر غير الضرورية مؤقتاً)'
            );
            
            if (shouldUseFallback) {
                // إخفاء العناصر غير المرغوب فيها مؤقتاً
                const sidebar = document.querySelector('.sidebar');
                const topbar = document.querySelector('.topbar');
                const quickActions = document.querySelector('.quick-actions');
                const modalActions = document.querySelector('#receiptModal .modal-actions');
                const modalHeader = document.querySelector('#receiptModal .modal-header');
                const modalClose = document.querySelector('#receiptModal .modal-close');
                
                if (sidebar) sidebar.style.display = 'none';
                if (topbar) topbar.style.display = 'none';
                if (quickActions) quickActions.style.display = 'none';
                if (modalActions) modalActions.style.display = 'none';
                if (modalHeader) modalHeader.style.display = 'none';
                if (modalClose) modalClose.style.display = 'none';
                
                // طباعة الصفحة
                window.print();
                
                // إعادة العناصر بعد الطباعة
                setTimeout(() => {
                    if (sidebar) sidebar.style.display = '';
                    if (topbar) topbar.style.display = '';
                    if (quickActions) quickActions.style.display = '';
                    if (modalActions) modalActions.style.display = '';
                    if (modalHeader) modalHeader.style.display = '';
                    if (modalClose) modalClose.style.display = '';
                }, 1000);
                
                showToast('🖨️ جاري الطباعة...', 'info');
            }
            return;
        }

        // 4. بناء HTML كامل للطباعة (نسخة احترافية)
        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>فاتورة البيع - JABAL ALSAFA</title>
                    <style>
                        /* ===== جميع الأنماط ===== */
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Arial', 'Tahoma', sans-serif;
                            background: #f0f2f5;
                            padding: 30px 20px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            direction: rtl;
                        }
                        .receipt {
                            max-width: 420px;
                            width: 100%;
                            margin: 0 auto;
                            background: #ffffff;
                            padding: 35px 30px;
                            border: 2px solid #1a1a2e;
                            border-radius: 20px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                        }
                        .receipt-header {
                            text-align: center;
                            margin-bottom: 25px;
                            padding-bottom: 20px;
                            border-bottom: 2px dashed #e8e8e8;
                        }
                        .receipt-header h2 {
                            font-size: 28px;
                            font-weight: 900;
                            color: #0077b6;
                            letter-spacing: 1px;
                            margin-bottom: 4px;
                        }
                        .receipt-header p {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 10px;
                            font-weight: 600;
                        }
                        .receipt-header small {
                            display: block;
                            color: #999;
                            font-size: 12px;
                            margin: 3px 0;
                        }
                        .receipt-header .invoice-status {
                            color: #ffc800;
                            font-weight: 600;
                        }
                        .customer-name-display {
                            margin-top: 12px;
                            padding: 10px 16px;
                            background: linear-gradient(135deg, #f0f7ff, #e3eeff);
                            border-radius: 12px;
                            border-right: 4px solid #0077b6;
                        }
                        .customer-name-display strong {
                            color: #1a1a2e;
                            font-size: 15px;
                        }
                        .receipt-divider {
                            border-top: 1px dashed #ddd;
                            margin: 12px 0;
                        }
                        .receipt-table-header {
                            display: grid;
                            grid-template-columns: 2fr 0.8fr 1fr 1fr;
                            gap: 5px;
                            padding: 8px 0;
                            font-size: 11px;
                            font-weight: 700;
                            color: #666;
                            text-transform: uppercase;
                            border-bottom: 2px solid #0077b6;
                        }
                        .receipt-item {
                            display: grid;
                            grid-template-columns: 2fr 0.8fr 1fr 1fr;
                            gap: 5px;
                            padding: 6px 0;
                            font-size: 13px;
                            color: #333;
                            border-bottom: 1px solid #f0f0f0;
                        }
                        .receipt-item:last-child {
                            border-bottom: none;
                        }
                        .receipt-item .item-name {
                            font-weight: 500;
                            color: #1a1a2e;
                        }
                        .receipt-item .item-qty {
                            text-align: center;
                            color: #666;
                        }
                        .receipt-item .item-price {
                            text-align: left;
                            color: #666;
                        }
                        .receipt-item .item-total {
                            text-align: left;
                            font-weight: 700;
                            color: #0077b6;
                        }
                        .receipt-total {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 18px 5px 12px;
                            margin-top: 12px;
                            border-top: 3px double #0077b6;
                            font-size: 20px;
                            font-weight: 700;
                        }
                        .receipt-total span:last-child {
                            color: #0077b6;
                            font-size: 24px;
                            background: #f0f7ff;
                            padding: 2px 16px;
                            border-radius: 8px;
                        }
                        .receipt-footer {
                            text-align: center;
                            margin-top: 20px;
                            padding-top: 15px;
                            border-top: 1px solid #eee;
                        }
                        .receipt-footer .contact-info {
                            color: #555;
                            font-size: 13px;
                            font-weight: 600;
                            margin: 2px 0;
                        }
                        .receipt-footer .thanks-msg {
                            color: #888;
                            font-size: 14px;
                            font-weight: 500;
                            margin: 4px 0;
                        }
                        .print-btn {
                            display: block;
                            width: 100%;
                            padding: 14px;
                            margin-top: 15px;
                            background: linear-gradient(135deg, #0077b6, #005a8c);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            box-shadow: 0 4px 15px rgba(0,119,182,0.3);
                        }
                        .print-btn:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 8px 25px rgba(0,119,182,0.4);
                        }
                        .close-btn {
                            display: block;
                            width: 100%;
                            padding: 12px;
                            margin-top: 8px;
                            background: #f5f5f5;
                            color: #555;
                            border: 1px solid #ddd;
                            border-radius: 12px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        }
                        .close-btn:hover {
                            background: #eee;
                        }
                        
                        /* ===== أنماط الطباعة ===== */
                        @media print {
                            body {
                                background: white !important;
                                padding: 5px !important;
                                margin: 0 !important;
                                display: block !important;
                            }
                            .receipt {
                                border: 1px solid #ddd !important;
                                box-shadow: none !important;
                                padding: 15px !important;
                                max-width: 100% !important;
                                border-radius: 0 !important;
                            }
                            .print-btn, .close-btn {
                                display: none !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                            .customer-name-display {
                                background: #f0f7ff !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            .receipt-total span:last-child {
                                background: #f0f7ff !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                        
                        /* ===== أنماط الجوال ===== */
                        @media (max-width: 480px) {
                            body { padding: 10px; }
                            .receipt { padding: 18px 15px; }
                            .receipt-total { font-size: 16px; }
                            .receipt-total span:last-child { font-size: 18px; }
                            .receipt-item { font-size: 12px; }
                            .receipt-item { padding: 4px 0; }
                            .receipt-header h2 { font-size: 22px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="receipt">
                        ${receiptContent}
                    </div>
                    
                    <!-- ===== أزرار التحكم ===== -->
                    <button class="print-btn no-print" onclick="window.print()">
                        🖨️ طباعة الفاتورة
                    </button>
                    <button class="close-btn no-print" onclick="window.close()">
                        ✖ إغلاق
                    </button>
                    
                    <script>
                        // ===== الطباعة التلقائية =====
                        (function() {
                            if (document.readyState === 'complete') {
                                startPrint();
                            } else {
                                window.addEventListener('load', startPrint);
                            }
                            
                            function startPrint() {
                                setTimeout(function() {
                                    window.print();
                                }, 800);
                            }
                        })();
                    <\/script>
                </body>
            </html>
        `;

        // 5. كتابة المحتوى في النافذة الجديدة
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // 6. التركيز على النافذة الجديدة
        printWindow.focus();
        
        showToast('🖨️ جاري فتح نافذة الطباعة...', 'info');
        
    } catch (error) {
        console.error('❌ Error in printReceipt:', error);
        showToast('⚠️ حدث خطأ في الطباعة: ' + (error.message || 'غير معروف'), 'error');
    }
}

// ============================================================
// ربط الأحداث (Event Listeners)
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // ربط زر الطباعة
    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
        // إزالة أي مستمعين قديمين لتجنب التكرار
        const newPrintBtn = printBtn.cloneNode(true);
        printBtn.parentNode.replaceChild(newPrintBtn, printBtn);
        newPrintBtn.addEventListener('click', printReceipt);
        console.log('✅ printReceiptBtn event bound');
    } else {
        console.warn('⚠️ printReceiptBtn not found in DOM');
    }
});

// ===== البحث في المنتجات =====
document.getElementById('posSearch')?.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const filtered = posProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
    renderPOSProducts(filtered);
});

// ===== تفريغ السلة =====
document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);

// ===== معاينة الفاتورة =====
document.getElementById('previewInvoiceBtn')?.addEventListener('click', previewInvoice);

// ===== إتمام البيع =====
document.getElementById('checkoutBtn')?.addEventListener('click', checkout);

// ===== إغلاق نافذة الفاتورة =====
document.getElementById('closeReceiptModal')?.addEventListener('click', () => {
    document.getElementById('receiptModal')?.classList.remove('active');
});
document.getElementById('closeReceiptBtn')?.addEventListener('click', () => {
    document.getElementById('receiptModal')?.classList.remove('active');
});

// ===== واتساب =====
document.getElementById('whatsappBtn')?.addEventListener('click', sendReceiptWhatsApp);

// ===== إغلاق النافذة بالضغط خارجها =====
document.getElementById('receiptModal')?.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
});

// ============================================================
// تصدير الدوال للنطاق العام
// ============================================================
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.checkout = checkout;
window.printReceipt = printReceipt;
window.sendReceiptWhatsApp = sendReceiptWhatsApp;
window.loadPOSProducts = loadPOSProducts;
window.selectInvoiceType = selectInvoiceType;
window.previewInvoice = previewInvoice;
window.closeReceiptPreview = closeReceiptPreview;
window.closeReceiptPreviewAndCheckout = closeReceiptPreviewAndCheckout;

console.log('✅ POS Module Loaded');
