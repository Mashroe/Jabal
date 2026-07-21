// ============================================================
// INVOICES MANAGEMENT
// ============================================================

let allInvoices = [];

async function loadInvoices() {
    try {
        console.log('🔄 Loading invoices...');
        
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return [];
        }
        
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        *,
                        products (name, price)
                    )
                `)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            allInvoices = data || [];
            console.log(`✅ Loaded ${allInvoices.length} invoices`);
            
            if (typeof offlineManager !== 'undefined' && offlineManager && allInvoices.length > 0) {
                await offlineManager.saveToLocalDB('sales', allInvoices);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            allInvoices = await offlineManager.getFromLocalDB('sales');
            console.log(`📴 Loaded ${allInvoices.length} invoices from local DB`);
        }
        
        renderInvoices(allInvoices);
        updateInvoicesCount(allInvoices.length);
        return allInvoices;
        
    } catch (error) {
        console.error('Error loading invoices:', error);
        showToast('حدث خطأ في تحميل الفواتير', 'error');
        return [];
    }
}

function renderInvoices(invoices) {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;
    
    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                    لا توجد فواتير
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = invoices.map((invoice, index) => {
        const date = new Date(invoice.created_at).toLocaleString('ar-SA');
        const itemsCount = invoice.sale_items?.length || 0;
        const status = invoice.status || 'completed';
        const statusBadge = status === 'completed' 
            ? '<span class="badge badge-success">مكتملة</span>'
            : status === 'cancelled'
                ? '<span class="badge badge-danger">ملغية</span>'
                : '<span class="badge badge-warning">قيد الانتظار</span>';
        const customerName = invoice.customer_name || 'عميل';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>#${invoice.id.slice(0, 8).toUpperCase()}</strong></td>
                <td>${date}</td>
                <td>${escapeHtml(customerName)}</td>
                <td>${itemsCount}</td>
                <td>${formatCurrency(invoice.total)}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="viewInvoice('${invoice.id}')" title="عرض التفاصيل">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit-btn" onclick="printInvoice('${invoice.id}')" title="طباعة">
                        <i class="fas fa-print"></i>
                    </button>
                    ${status === 'completed' ? `
                        <button class="action-btn delete-btn" onclick="cancelInvoice('${invoice.id}')" title="إلغاء الفاتورة">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function viewInvoice(invoiceId) {
    try {
        const invoice = allInvoices.find(i => i.id === invoiceId);
        if (!invoice) {
            showToast('الفاتورة غير موجودة', 'error');
            return;
        }
        
        const items = invoice.sale_items || [];
        const total = invoice.total || 0;
        const date = new Date(invoice.created_at).toLocaleString('ar-SA');
        const receiptNumber = invoice.id.slice(0, 8).toUpperCase();
        const customerName = invoice.customer_name || 'عميل';
        
        const modal = document.getElementById('invoiceDetailModal');
        const body = document.getElementById('invoiceDetailBody');
        
        if (body) {
            body.innerHTML = `
                <div class="receipt" id="invoiceDetailContent">
                    <div class="receipt-header">
                        <h2>🏷️ JABAL ALSAFA</h2>
                        <p>فاتورة بيع</p>
                        <small>رقم: #${receiptNumber}</small>
                        <small>التاريخ: ${date}</small>
                        <small>👤 العميل: ${escapeHtml(customerName)}</small>
                        <small>الحالة: ${invoice.status === 'completed' ? '✅ مكتملة' : '❌ ملغية'}</small>
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
        
    } catch (error) {
        console.error('Error viewing invoice:', error);
        showToast('حدث خطأ في عرض الفاتورة', 'error');
    }
}

async function printInvoice(invoiceId) {
    try {
        const invoice = allInvoices.find(i => i.id === invoiceId);
        if (!invoice) {
            showToast('الفاتورة غير موجودة', 'error');
            return;
        }
        
        const items = invoice.sale_items || [];
        const total = invoice.total || 0;
        const date = new Date(invoice.created_at).toLocaleString('ar-SA');
        const receiptNumber = invoice.id.slice(0, 8).toUpperCase();
        const customerName = invoice.customer_name || 'عميل';
        
        let content = `
            <div class="receipt">
                <div class="receipt-header">
                    <h2>🏷️ JABAL ALSAFA</h2>
                    <p>فاتورة بيع</p>
                    <small>رقم: #${receiptNumber}</small>
                    <small>التاريخ: ${date}</small>
                    <small>👤 العميل: ${escapeHtml(customerName)}</small>
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
                    <span>المجموع</span>
                    <span>${formatCurrency(total)}</span>
                </div>
                <div class="receipt-footer">
                    <small>شكراً لتسوقكم معنا</small>
                </div>
            </div>
        `;
        
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) return;
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>فاتورة #${receiptNumber}</title>
                    <style>
                        @media print { body { margin: 0; padding: 20px; } }
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
                    ${content}
                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 500);
                        };
                    <\/script>
                </body>
            </html>
        `);
        printWindow.document.close();
        
    } catch (error) {
        console.error('Error printing invoice:', error);
        showToast('حدث خطأ في طباعة الفاتورة', 'error');
    }
}

async function cancelInvoice(invoiceId) {
    if (!confirm('⚠️ هل أنت متأكد من إلغاء هذه الفاتورة؟\nسيتم إعادة الكميات إلى المخزون.')) return;
    
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const invoice = allInvoices.find(i => i.id === invoiceId);
        if (!invoice) {
            showToast('الفاتورة غير موجودة', 'error');
            return;
        }
        
        const { error } = await supabaseClient
            .from('sales')
            .update({ status: 'cancelled' })
            .eq('id', invoiceId);
        
        if (error) throw error;
        
        if (invoice.sale_items) {
            for (const item of invoice.sale_items) {
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
                            note: `إلغاء فاتورة #${invoiceId.slice(0, 8)}`
                        }]);
                }
            }
        }
        
        showToast('✅ تم إلغاء الفاتورة وإعادة الكميات للمخزون', 'success');
        await loadInvoices();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        await loadProducts();
        
    } catch (error) {
        console.error('Error cancelling invoice:', error);
        showToast('حدث خطأ في إلغاء الفاتورة', 'error');
    }
}

// ============================================================
// البحث في الفواتير (متقدم)
// ============================================================
function searchInvoice() {
    const searchTerm = document.getElementById('invoiceSearchInput')?.value?.toLowerCase() || '';
    const filterDate = document.getElementById('invoiceDateFilter')?.value;
    const filterStatus = document.getElementById('invoiceStatusFilter')?.value || 'all';
    
    let filtered = allInvoices;
    
    // بحث بالاسم أو الرقم
    if (searchTerm) {
        filtered = filtered.filter(invoice => 
            invoice.id.toLowerCase().includes(searchTerm) ||
            (invoice.customer_name && invoice.customer_name.toLowerCase().includes(searchTerm)) ||
            invoice.sale_items?.some(item => 
                item.products?.name?.toLowerCase().includes(searchTerm)
            )
        );
    }
    
    // فلترة بالتاريخ
    if (filterDate) {
        const searchDate = new Date(filterDate).toDateString();
        filtered = filtered.filter(invoice => {
            const invoiceDate = new Date(invoice.created_at).toDateString();
            return invoiceDate === searchDate;
        });
    }
    
    // فلترة بالحالة
    if (filterStatus !== 'all') {
        filtered = filtered.filter(invoice => 
            (invoice.status || 'completed') === filterStatus
        );
    }
    
    renderInvoices(filtered);
}

// ============================================================
// تصفية الفواتير حسب اليوم
// ============================================================
function filterTodayInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('invoiceDateFilter').value = today;
    searchInvoice();
}

// ============================================================
// تصفية الفواتير حسب الشهر
// ============================================================
function filterThisMonthInvoices() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const filtered = allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.created_at);
        return invoiceDate >= firstDay && invoiceDate <= lastDay;
    });
    
    renderInvoices(filtered);
}

function updateInvoicesCount(count) {
    const element = document.getElementById('invoicesCount');
    if (element) element.textContent = `${count} فاتورة`;
}

function printInvoiceDetail() {
    const content = document.getElementById('invoiceDetailContent')?.innerHTML;
    if (!content) return;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>فاتورة</title>
                <style>
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
                ${content}
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

document.getElementById('closeInvoiceDetailModal')?.addEventListener('click', function() {
    document.getElementById('invoiceDetailModal').classList.remove('active');
});

document.getElementById('closeInvoiceDetailBtn')?.addEventListener('click', function() {
    document.getElementById('invoiceDetailModal').classList.remove('active');
});

document.getElementById('printInvoiceDetailBtn')?.addEventListener('click', printInvoiceDetail);

document.getElementById('invoiceDetailModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.remove('active');
    }
});

window.loadInvoices = loadInvoices;
window.viewInvoice = viewInvoice;
window.printInvoice = printInvoice;
window.cancelInvoice = cancelInvoice;
window.searchInvoice = searchInvoice;
window.printInvoiceDetail = printInvoiceDetail;

console.log('✅ Invoices Module Loaded');
