// ============================================================
// EXPORT MODULE - تصدير البيانات (Excel/PDF)
// ============================================================

async function exportProductsToExcel() {
    try {
        showToast('⏳ جاري تحضير ملف المنتجات...', 'info');
        
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const products = await loadProducts();
        if (!products || products.length === 0) {
            showToast('لا توجد منتجات للتصدير', 'error');
            return;
        }
        
        const data = products.map((p, index) => ({
            '#': index + 1,
            'اسم المنتج': p.name,
            'السعر (SDG)': p.price,
            'الكمية': p.quantity,
            'القيمة الإجمالية (SDG)': p.price * p.quantity,
            'الحالة': p.quantity <= 0 ? 'نفذ' : p.quantity <= 5 ? 'منخفض' : 'متوفر'
        }));
        
        const csvContent = convertToCSV(data);
        downloadFile(csvContent, 'المنتجات.csv', 'text/csv');
        showToast('✅ تم تصدير المنتجات بنجاح', 'success');
    } catch (error) {
        console.error('Error exporting products:', error);
        showToast('حدث خطأ في تصدير المنتجات', 'error');
    }
}

async function exportSalesToExcel() {
    try {
        showToast('⏳ جاري تحضير ملف المبيعات...', 'info');
        
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        let sales = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('sales')
                .select('*, sale_items (quantity, price, products (name))')
                .order('created_at', { ascending: false });
            if (error) throw error;
            sales = data || [];
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            sales = await offlineManager.getFromLocalDB('sales');
        }
        
        if (!sales || sales.length === 0) {
            showToast('لا توجد مبيعات للتصدير', 'error');
            return;
        }
        
        const data = sales.map((sale, index) => ({
            '#': index + 1,
            'رقم الفاتورة': sale.id.slice(0, 8).toUpperCase(),
            'التاريخ': new Date(sale.created_at).toLocaleString('ar-SA'),
            'عدد المنتجات': sale.sale_items?.length || 0,
            'الإجمالي (SDG)': sale.total,
            'الحالة': sale.status || 'مكتملة'
        }));
        
        const csvContent = convertToCSV(data);
        downloadFile(csvContent, 'المبيعات.csv', 'text/csv');
        showToast('✅ تم تصدير المبيعات بنجاح', 'success');
    } catch (error) {
        console.error('Error exporting sales:', error);
        showToast('حدث خطأ في تصدير المبيعات', 'error');
    }
}

async function exportInventoryToExcel() {
    try {
        showToast('⏳ جاري تحضير ملف المخزون...', 'info');
        
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const products = await loadProducts();
        if (!products || products.length === 0) {
            showToast('لا توجد بيانات مخزون للتصدير', 'error');
            return;
        }
        
        const data = products.map((p, index) => ({
            '#': index + 1,
            'اسم المنتج': p.name,
            'الكمية': p.quantity,
            'السعر (SDG)': p.price,
            'القيمة الإجمالية (SDG)': p.price * p.quantity,
            'الحالة': p.quantity <= 0 ? 'نفذ' : p.quantity <= 5 ? 'منخفض' : 'متوفر'
        }));
        
        const csvContent = convertToCSV(data);
        downloadFile(csvContent, 'المخزون.csv', 'text/csv');
        showToast('✅ تم تصدير المخزون بنجاح', 'success');
    } catch (error) {
        console.error('Error exporting inventory:', error);
        showToast('حدث خطأ في تصدير المخزون', 'error');
    }
}

async function exportCustomersToExcel() {
    try {
        showToast('⏳ جاري تحضير ملف العملاء...', 'info');
        
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const customers = await loadCustomers();
        if (!customers || customers.length === 0) {
            showToast('لا يوجد عملاء للتصدير', 'error');
            return;
        }
        
        const data = customers.map((c, index) => ({
            '#': index + 1,
            'اسم العميل': c.name,
            'الهاتف': c.phone || '---',
            'البريد الإلكتروني': c.email || '---',
            'العنوان': c.address || '---',
            'إجمالي المشتريات (SDG)': c.total_spent || 0,
            'آخر زيارة': c.last_visit ? new Date(c.last_visit).toLocaleDateString('ar-SA') : '---'
        }));
        
        const csvContent = convertToCSV(data);
        downloadFile(csvContent, 'العملاء.csv', 'text/csv');
        showToast('✅ تم تصدير العملاء بنجاح', 'success');
    } catch (error) {
        console.error('Error exporting customers:', error);
        showToast('حدث خطأ في تصدير العملاء', 'error');
    }
}

async function exportPurchasesToExcel() {
    try {
        showToast('⏳ جاري تحضير ملف المشتريات...', 'info');
        
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const purchases = await loadPurchases();
        if (!purchases || purchases.length === 0) {
            showToast('لا توجد مشتريات للتصدير', 'error');
            return;
        }
        
        const data = purchases.map((p, index) => ({
            '#': index + 1,
            'رقم الفاتورة': p.id.slice(0, 8).toUpperCase(),
            'التاريخ': new Date(p.created_at).toLocaleString('ar-SA'),
            'المورد': p.customers?.name || '---',
            'عدد المنتجات': p.purchase_items?.length || 0,
            'الإجمالي (SDG)': p.total,
            'الحالة': p.status || 'مكتملة'
        }));
        
        const csvContent = convertToCSV(data);
        downloadFile(csvContent, 'المشتريات.csv', 'text/csv');
        showToast('✅ تم تصدير المشتريات بنجاح', 'success');
    } catch (error) {
        console.error('Error exporting purchases:', error);
        showToast('حدث خطأ في تصدير المشتريات', 'error');
    }
}

async function exportFullReportPDF() {
    try {
        showToast('⏳ جاري تحضير التقرير الكامل...', 'info');
        
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const [products, sales, customers] = await Promise.all([
            loadProducts(),
            getTotalSales(),
            loadCustomers()
        ]);
        
        let content = `
            <html>
            <head>
                <title>التقرير الكامل - JABAL ALSAFA</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
                    h1 { color: #00b4d8; text-align: center; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header p { color: #666; }
                    .section { margin: 30px 0; }
                    .section h2 { color: #0077b6; border-bottom: 2px solid #00b4d8; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th { background: #00b4d8; color: white; padding: 10px; text-align: right; }
                    td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
                    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
                    .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
                    .summary-card h3 { margin: 0; color: #666; font-size: 14px; }
                    .summary-card .value { font-size: 24px; font-weight: bold; color: #0077b6; }
                    .footer { text-align: center; margin-top: 50px; color: #999; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏷️ JABAL ALSAFA</h1>
                    <p>التقرير الكامل - ${new Date().toLocaleDateString('ar-SA')}</p>
                </div>
                
                <div class="summary">
                    <div class="summary-card">
                        <h3>إجمالي المنتجات</h3>
                        <div class="value">${products.length}</div>
                    </div>
                    <div class="summary-card">
                        <h3>إجمالي المبيعات</h3>
                        <div class="value">${formatCurrency(sales)}</div>
                    </div>
                    <div class="summary-card">
                        <h3>عدد العملاء</h3>
                        <div class="value">${customers.length}</div>
                    </div>
                    <div class="summary-card">
                        <h3>التاريخ</h3>
                        <div class="value" style="font-size: 14px;">${new Date().toLocaleDateString('ar-SA')}</div>
                    </div>
                </div>
                
                <div class="section">
                    <h2>📦 قائمة المنتجات</h2>
                    <table>
                        <thead>
                            <tr><th>#</th><th>اسم المنتج</th><th>السعر (SDG)</th><th>الكمية</th><th>القيمة الإجمالية (SDG)</th></tr>
                        </thead>
                        <tbody>
                            ${products.map((p, i) => `
                                <tr><td>${i + 1}</td><td>${p.name}</td><td>${p.price}</td><td>${p.quantity}</td><td>${p.price * p.quantity}</td></tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2>👤 قائمة العملاء</h2>
                    <table>
                        <thead>
                            <tr><th>#</th><th>اسم العميل</th><th>الهاتف</th><th>إجمالي المشتريات (SDG)</th></tr>
                        </thead>
                        <tbody>
                            ${customers.map((c, i) => `
                                <tr><td>${i + 1}</td><td>${c.name}</td><td>${c.phone || '---'}</td><td>${c.total_spent || 0}</td></tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="footer">
                    <p>تم إنشاء هذا التقرير بواسطة نظام JABAL ALSAFA</p>
                    <p>© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            showToast('الرجاء السماح للنوافذ المنبثقة', 'error');
            return;
        }
        printWindow.document.write(content);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 1000);
        showToast('✅ تم فتح التقرير للطباعة', 'success');
    } catch (error) {
        console.error('Error exporting full report:', error);
        showToast('حدث خطأ في تصدير التقرير', 'error');
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

function downloadFile(content, filename, mimeType = 'text/csv') {
    const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8;` });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

window.exportProductsToExcel = exportProductsToExcel;
window.exportSalesToExcel = exportSalesToExcel;
window.exportInventoryToExcel = exportInventoryToExcel;
window.exportCustomersToExcel = exportCustomersToExcel;
window.exportPurchasesToExcel = exportPurchasesToExcel;
window.exportFullReportPDF = exportFullReportPDF;

console.log('✅ Export Module Loaded');