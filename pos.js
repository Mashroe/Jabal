// ============================================================
// POS SYSTEM
// ============================================================

let posProducts = [];
let cart = [];
let lastSaleData = null;

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
        const sale = {
            id: saleId,
            total: total,
            created_at: new Date().toISOString()
        };
        const items = cart.map(item => ({
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            sale_id: saleId,
            product_id: item.id,
            quantity: item.quantity,
            price: item.price
        }));
        
        lastSaleData = { sale, items, total };
        
        if (navigator.onLine) {
            const { error: saleError } = await supabaseClient
                .from('sales')
                .insert([sale]);
            if (saleError) throw saleError;
            
            const { error: itemsError } = await supabaseClient
                .from('sale_items')
                .insert(items);
            if (itemsError) throw itemsError;
            
            for (const item of cart) {
                const product = posProducts.find(p => p.id === item.id);
                if (product) {
                    await supabaseClient
                        .from('products')
                        .update({ quantity: product.quantity - item.quantity })
                        .eq('id', item.id);
                    
                    await supabaseClient
                        .from('stock_movements')
                        .insert([{
                            product_id: item.id,
                            type: 'out',
                            quantity: item.quantity
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
        
        showReceipt(sale, cart, total);
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
        console.error('Checkout error:', error);
        showToast('حدث خطأ في إتمام البيع', 'error');
    }
}

function showReceipt(sale, items, total) {
    const modal = document.getElementById('receiptModal');
    const body = document.getElementById('receiptBody');
    const date = new Date(sale.created_at).toLocaleString('ar-SA');
    const receiptNumber = sale.id.slice(0, 8).toUpperCase();
    
    if (body) {
        body.innerHTML = `
            <div class="receipt" id="receiptContent">
                <div class="receipt-header">
                    <h2>🏷️ JABAL ALSAFA</h2>
                    <p>فاتورة بيع</p>
                    <small>رقم: #${receiptNumber}</small>
                    <small>التاريخ: ${date}</small>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-items">
                    ${items.map(item => `
                        <div class="receipt-item">
                            <span>${escapeHtml(item.name)}</span>
                            <span>${item.quantity} × ${formatCurrency(item.price)}</span>
                            <span>${formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-total">
                    <span>المجموع</span>
                    <span>${formatCurrency(total)}</span>
                </div>
                <div class="receipt-footer">
                    <small>شكراً لتسوقكم معنا</small>
                </div>
            </div>
        `;
    }
    if (modal) modal.classList.add('active');
}

function sendReceiptWhatsApp() {
    if (!lastSaleData) {
        showToast('لا توجد فاتورة لإرسالها', 'error');
        return;
    }
    
    const { sale, items, total } = lastSaleData;
    const date = new Date(sale.created_at).toLocaleString('ar-SA');
    const receiptNumber = sale.id.slice(0, 8).toUpperCase();
    
    let message = '🏷️ *JABAL ALSAFA*\n';
    message += '━'.repeat(30) + '\n';
    message += `📋 فاتورة: #${receiptNumber}\n`;
    message += `📅 التاريخ: ${date}\n`;
    message += '━'.repeat(30) + '\n\n';
    message += '*المنتجات:*\n';
    
    items.forEach(item => {
        message += `• ${item.name}\n`;
        message += `  ${item.quantity} × ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}\n`;
    });
    
    message += '\n' + '━'.repeat(30) + '\n';
    message += `*المجموع: ${formatCurrency(total)}*\n`;
    message += '━'.repeat(30) + '\n';
    message += '_شكراً لتسوقكم معنا_';
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

function printReceipt() {
    const receiptContent = document.getElementById('receiptBody')?.innerHTML;
    if (!receiptContent) return;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>فاتورة البيع</title>
                <style>
                    @media print { body { margin: 0; padding: 20px; } .no-print { display: none; } }
                    body { font-family: 'Inter', 'Arial', sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; background: white; color: black; }
                    .receipt { background: white; padding: 20px; }
                    .receipt-header { text-align: center; margin-bottom: 20px; }
                    .receipt-header h2 { margin: 0; color: #000; font-size: 20px; }
                    .receipt-header p { margin: 5px 0; color: #666; font-size: 14px; }
                    .receipt-header small { display: block; color: #999; font-size: 12px; }
                    .receipt-divider { border-top: 1px dashed #ddd; margin: 15px 0; }
                    .receipt-items { margin: 15px 0; }
                    .receipt-item { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
                    .receipt-total { display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin: 15px 0; }
                    .receipt-footer { text-align: center; color: #999; margin-top: 20px; font-size: 12px; }
                </style>
            </head>
            <body>
                ${receiptContent}
                <button class="print-btn no-print" onclick="window.print()" style="display:block;width:100%;padding:10px;margin:10px 0;background:#00b4d8;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;">🖨️ طباعة</button>
                <script>
                    window.onload = function() {
                        setTimeout(function() { window.print(); }, 500);
                    };
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('posSearch')?.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filtered = posProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
        renderPOSProducts(filtered);
    });

    document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
    document.getElementById('checkoutBtn')?.addEventListener('click', checkout);

    document.getElementById('closeReceiptModal')?.addEventListener('click', () => {
        document.getElementById('receiptModal')?.classList.remove('active');
    });
    document.getElementById('closeReceiptBtn')?.addEventListener('click', () => {
        document.getElementById('receiptModal')?.classList.remove('active');
    });
    document.getElementById('printReceiptBtn')?.addEventListener('click', printReceipt);
    document.getElementById('whatsappBtn')?.addEventListener('click', sendReceiptWhatsApp);

    document.getElementById('receiptModal')?.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });
});

// ===== EXPORT =====
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.checkout = checkout;
window.printReceipt = printReceipt;
window.sendReceiptWhatsApp = sendReceiptWhatsApp;
window.loadPOSProducts = loadPOSProducts;

console.log('✅ POS Module Loaded');