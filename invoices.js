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
                <td colspan="9" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
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
        const customerName = invoice.customer_name || 'عميل';
        const invoiceType = invoice.invoice_type || 'final';
        
        const statusBadge = status === 'completed' 
            ? '<span class="badge badge-success">مكتملة</span>'
            : status === 'cancelled'
                ? '<span class="badge badge-danger">ملغية</span>'
                : '<span class="badge badge-warning">قيد الانتظار</span>';
        
        const typeLabel = invoiceType === 'final' 
            ? '<span class="badge badge-info">بيع</span>' 
            : '<span class="badge badge-warning" style="background: rgba(255,200,0,0.2); color: #ffc800;">مبدئية</span>';
        
        let actionButtons = `
            <button class="action-btn edit-btn" onclick="viewInvoice('${invoice.id}')" title="عرض التفاصيل">
                <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn edit-btn" onclick="printInvoice('${invoice.id}')" title="طباعة">
                <i class="fas fa-print"></i>
            </button>
        `;
        
        if (invoiceType === 'draft' && status === 'completed') {
            actionButtons += `
                <button class="action-btn edit-btn" onclick="completeInvoice('${invoice.id}')" title="إتمام العملية" style="background: rgba(0,200,255,0.15); color: #00c8ff;">
                    <i class="fas fa-check-double"></i>
                </button>
            `;
        }
        
        if (status === 'completed') {
            actionButtons += `
                <button class="action-btn delete-btn" onclick="cancelInvoice('${invoice.id}')" title="إلغاء الفاتورة">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>#${invoice.id.slice(0, 8).toUpperCase()}</strong></td>
                <td>${date}</td>
                <td>${escapeHtml(customerName)}</td>
                <td>${itemsCount}</td>
                <td>${formatCurrency(invoice.total)}</td>
                <td>${typeLabel} ${statusBadge}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// عرض تفاصيل الفاتورة
// ============================================================
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
        const invoiceType = invoice.invoice_type || 'final';
        const typeLabel = invoiceType === 'final' ? 'فاتورة بيع' : 'فاتورة مبدئية';
        const customerTitle = `السيد/ ${customerName}`;
        
        const modal = document.getElementById('invoiceDetailModal');
        const body = document.getElementById('invoiceDetailBody');
        
        if (body) {
            body.innerHTML = `
                <div class="receipt" id="invoiceDetailContent">
                    <div class="receipt-header">
                        <h2>🏷️ JABAL ALSAFA</h2>
                        <p>${typeLabel}</p>
                        <small>رقم: #${receiptNumber}</small>
                        <small>التاريخ: ${date}</small>
                        <small>${escapeHtml(customerTitle)}</small>
                        <small>الحالة: ${invoice.status === 'completed' ? '✅ مكتملة' : '❌ ملغية'}</small>
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
                                <span class="item-name">${escapeHtml(item.products?.name || 'منتج محذوف')}</span>
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
        
    } catch (error) {
        console.error('Error viewing invoice:', error);
        showToast('حدث خطأ في عرض الفاتورة', 'error');
    }
}

// ============================================================
// طباعة الفاتورة (النسخة النهائية الاحترافية)
// ============================================================
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
        const invoiceType = invoice.invoice_type || 'final';
        const typeLabel = invoiceType === 'final' ? 'فاتورة بيع' : 'فاتورة مبدئية';
        const customerTitle = `السيد/ ${customerName}`;
        const statusText = invoiceType === 'final' ? 'معتمدة' : 'غير معتمدة';
        
        const itemsWithTotal = items.map(item => ({
            ...item,
            total: item.price * item.quantity
        }));
        
        let content = `
            <div class="receipt-print" id="receiptPrintContent">
                <div class="receipt-header">
                    <div class="company-name">🏷️ JABAL ALSAFA</div>
                    <div class="receipt-title">${typeLabel}</div>
                    <div class="receipt-meta">
                        <span>📋 #${receiptNumber}</span>
                        <span>📅 ${date}</span>
                        <span>📌 ${statusText}</span>
                    </div>
                    <div class="customer-line">
                        <span class="value">${escapeHtml(customerTitle)}</span>
                    </div>
                </div>
                
                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th style="text-align:right; width:45%; padding:10px 8px;">الصنف</th>
                            <th style="text-align:center; width:15%; padding:10px 8px;">الكمية</th>
                            <th style="text-align:left; width:20%; padding:10px 8px;">السعر</th>
                            <th style="text-align:left; width:20%; padding:10px 8px;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsWithTotal.map(item => `
                            <tr>
                                <td style="text-align:right; font-weight:500; padding:10px 8px; border-bottom:1px solid #f0f0f0;">
                                    ${escapeHtml(item.products?.name || 'منتج محذوف')}
                                </td>
                                <td style="text-align:center; padding:10px 8px; border-bottom:1px solid #f0f0f0;">
                                    ${item.quantity}
                                </td>
                                <td style="text-align:left; padding:10px 8px; border-bottom:1px solid #f0f0f0;">
                                    ${formatCurrency(item.price)}
                                </td>
                                <td style="text-align:left; font-weight:700; color:#0077b6; padding:10px 8px; border-bottom:1px solid #f0f0f0;">
                                    ${formatCurrency(item.total)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="receipt-total">
                    <span>المجموع الكلي</span>
                    <span>${formatCurrency(total)}</span>
                </div>
                
                <div class="receipt-footer">
                    <p>📞 للتواصل: 0129321654 - 0922500501</p>
                    <p>شكراً لتسوقكم معنا</p>
                    <small>تم الطباعة بواسطة JABAL ALSAFA</small>
                </div>
            </div>
        `;
        
        const printWindow = window.open('', '_blank', 'width=500,height=700');
        if (!printWindow) return;
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>فاتورة #${receiptNumber}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Arial', 'Tahoma', sans-serif;
                            background: #f0f2f5;
                            padding: 20px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            direction: rtl;
                        }
                        .receipt-print {
                            max-width: 450px;
                            width: 100%;
                            margin: 0 auto;
                            background: #ffffff;
                            padding: 35px 30px;
                            border: 2px solid #1a1a2e;
                            border-radius: 16px;
                            box-shadow: 0 12px 50px rgba(0, 0, 0, 0.12);
                        }
                        .receipt-header {
                            text-align: center;
                            margin-bottom: 20px;
                            padding-bottom: 20px;
                            border-bottom: 2px dashed #e0e0e0;
                        }
                        .company-name {
                            font-size: 26px;
                            font-weight: 800;
                            color: #0077b6;
                            letter-spacing: 0.5px;
                            margin-bottom: 4px;
                        }
                        .receipt-title {
                            font-size: 16px;
                            color: #555;
                            margin-bottom: 8px;
                        }
                        .receipt-meta {
                            display: flex;
                            justify-content: center;
                            gap: 12px;
                            font-size: 11px;
                            color: #888;
                            margin-bottom: 12px;
                            flex-wrap: wrap;
                        }
                        .receipt-meta span {
                            background: #f5f5f5;
                            padding: 4px 14px;
                            border-radius: 6px;
                        }
                        .customer-line {
                            display: flex;
                            justify-content: center;
                            padding: 10px 16px;
                            background: #f0f7ff;
                            border-radius: 10px;
                            border-right: 4px solid #0077b6;
                            font-size: 15px;
                            font-weight: 600;
                            color: #1a1a2e;
                        }
                        .receipt-divider {
                            border-top: 2px dashed #e0e0e0;
                            margin: 12px 0;
                        }
                        .receipt-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 12px 0;
                            font-size: 14px;
                        }
                        .receipt-table thead th {
                            background: #f7f9fc;
                            padding: 10px 8px;
                            text-align: center;
                            font-weight: 700;
                            color: #444;
                            border-bottom: 2px solid #d0d0d0;
                            font-size: 13px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .receipt-table thead th:first-child {
                            text-align: right;
                        }
                        .receipt-table thead th:last-child {
                            text-align: left;
                        }
                        .receipt-table tbody td {
                            padding: 10px 8px;
                            border-bottom: 1px solid #f0f0f0;
                            color: #333;
                            font-size: 14px;
                        }
                        .receipt-table tbody td:first-child {
                            text-align: right;
                            font-weight: 500;
                        }
                        .receipt-table tbody td:last-child {
                            text-align: left;
                            font-weight: 700;
                            color: #0077b6;
                        }
                        .receipt-table tbody tr:last-child td {
                            border-bottom: none;
                        }
                        .receipt-total {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 18px 5px 12px;
                            margin-top: 10px;
                            border-top: 3px double #0077b6;
                            font-size: 20px;
                            font-weight: 700;
                        }
                        .receipt-total span:last-child {
                            color: #0077b6;
                            font-size: 24px;
                        }
                        .receipt-footer {
                            text-align: center;
                            margin-top: 20px;
                            padding-top: 15px;
                            border-top: 1px solid #eee;
                        }
                        .receipt-footer p {
                            color: #555;
                            font-size: 13px;
                            font-weight: 500;
                            margin: 2px 0;
                        }
                        .receipt-footer small {
                            display: block;
                            color: #bbb;
                            font-size: 10px;
                            margin-top: 4px;
                        }
                        .print-btn {
                            display: block;
                            width: 100%;
                            padding: 12px;
                            margin-top: 15px;
                            background: #0077b6;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        }
                        .print-btn:hover {
                            background: #005a8c;
                            transform: translateY(-2px);
                            box-shadow: 0 6px 20px rgba(0, 119, 182, 0.3);
                        }
                        @media print {
                            body {
                                background: white !important;
                                padding: 5px !important;
                                margin: 0 !important;
                                display: block !important;
                            }
                            .receipt-print {
                                border: 1px solid #ddd !important;
                                box-shadow: none !important;
                                padding: 15px !important;
                                max-width: 100% !important;
                                border-radius: 0 !important;
                            }
                            .receipt-table thead th {
                                background: #f0f0f0 !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            .customer-line {
                                background: #f0f7ff !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            .print-btn {
                                display: none !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                        @media (max-width: 480px) {
                            body { padding: 10px; }
                            .receipt-print { padding: 18px 15px; }
                            .receipt-total { font-size: 16px; }
                            .receipt-total span:last-child { font-size: 18px; }
                            .receipt-table { font-size: 12px; }
                            .receipt-table thead th,
                            .receipt-table tbody td { padding: 6px 4px; }
                            .company-name { font-size: 20px; }
                            .receipt-meta { flex-wrap: wrap; gap: 6px; }
                        }
                    </style>
                </head>
                <body>
                    ${content}
                    <button class="print-btn no-print" onclick="window.print()">
                        🖨️ طباعة الفاتورة
                    </button>
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                            }, 800);
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

// ============================================================
// إتمام العملية (تحويل فاتورة مبدئية لنهائية)
// ============================================================
async function completeInvoice(invoiceId) {
    if (!confirm('⚠️ هل أنت متأكد من إتمام هذه العملية؟\nسيتم تحويل الفاتورة المبدئية إلى فاتورة بيع.')) {
        return;
    }
    
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
        
        const { error: updateError } = await supabaseClient
            .from('sales')
            .update({ 
                invoice_type: 'final',
                status: 'completed'
            })
            .eq('id', invoiceId);
        
        if (updateError) throw updateError;
        
        if (invoice.sale_items) {
            for (const item of invoice.sale_items) {
                const { data: product } = await supabaseClient
                    .from('products')
                    .select('quantity')
                    .eq('id', item.product_id)
                    .single();
                
                if (product) {
                    const newQuantity = product.quantity - item.quantity;
                    await supabaseClient
                        .from('products')
                        .update({ quantity: newQuantity })
                        .eq('id', item.product_id);
                    
                    await supabaseClient
                        .from('stock_movements')
                        .insert([{
                            product_id: item.product_id,
                            type: 'out',
                            quantity: item.quantity,
                            note: `إتمام عملية - فاتورة #${invoiceId.slice(0, 8)}`
                        }]);
                }
            }
        }
        
        showToast('✅ تم إتمام العملية بنجاح!', 'success');
        await loadInvoices();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        
    } catch (error) {
        console.error('Error completing invoice:', error);
        showToast('حدث خطأ في إتمام العملية', 'error');
    }
}

// ============================================================
// إلغاء الفاتورة
// ============================================================
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
// البحث في الفواتير
// ============================================================
function searchInvoice() {
    const searchTerm = document.getElementById('invoiceSearchInput')?.value?.toLowerCase() || '';
    const filterDate = document.getElementById('invoiceDateFilter')?.value;
    const filterStatus = document.getElementById('invoiceStatusFilter')?.value || 'all';
    
    let filtered = allInvoices;
    
    if (searchTerm) {
        filtered = filtered.filter(invoice => 
            invoice.id.toLowerCase().includes(searchTerm) ||
            (invoice.customer_name && invoice.customer_name.toLowerCase().includes(searchTerm)) ||
            invoice.sale_items?.some(item => 
                item.products?.name?.toLowerCase().includes(searchTerm)
            )
        );
    }
    
    if (filterDate) {
        const searchDate = new Date(filterDate).toDateString();
        filtered = filtered.filter(invoice => {
            const invoiceDate = new Date(invoice.created_at).toDateString();
            return invoiceDate === searchDate;
        });
    }
    
    if (filterStatus !== 'all') {
        filtered = filtered.filter(invoice => 
            (invoice.status || 'completed') === filterStatus
        );
    }
    
    renderInvoices(filtered);
}

function filterTodayInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('invoiceDateFilter').value = today;
    searchInvoice();
}

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

// ============================================================
// EVENT LISTENERS
// ============================================================
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

// ============================================================
// EXPORT
// ============================================================
window.loadInvoices = loadInvoices;
window.viewInvoice = viewInvoice;
window.printInvoice = printInvoice;
window.cancelInvoice = cancelInvoice;
window.searchInvoice = searchInvoice;
window.printInvoiceDetail = printInvoiceDetail;
window.completeInvoice = completeInvoice;
window.filterTodayInvoices = filterTodayInvoices;
window.filterThisMonthInvoices = filterThisMonthInvoices;

console.log('✅ Invoices Module Loaded');
