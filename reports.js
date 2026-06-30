// ============================================================
// REPORTS MODULE - متقدم مع رسوم بيانية
// ============================================================

let salesChart = null;
let productsChart = null;

async function loadReportsData() {
    try {
        const from = document.getElementById('reportDateFrom')?.value;
        const to = document.getElementById('reportDateTo')?.value;
        
        showLoadingReports();
        
        await Promise.all([
            loadSalesReport(from, to),
            loadTopProducts(from, to),
            loadStockReport(),
            loadDailySalesChart(from, to),
            loadSalesPieChart(from, to)
        ]);
        
        hideLoadingReports();
        showToast('تم تحديث التقارير', 'success');
        
    } catch (error) {
        console.error('Error loading reports:', error);
        showToast('حدث خطأ في تحميل التقارير', 'error');
        hideLoadingReports();
    }
}

async function loadSalesReport(from, to) {
    try {
        let sales = [];
        if (navigator.onLine) {
            let query = supabaseClient.from('sales').select('total, created_at');
            if (from) query = query.gte('created_at', `${from}T00:00:00`);
            if (to) query = query.lte('created_at', `${to}T23:59:59`);
            const { data, error } = await query;
            if (error) throw error;
            sales = data || [];
        } else if (offlineManager) {
            sales = await offlineManager.getFromLocalDB('sales');
        }
        
        const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const invoiceCount = sales.length;
        const averageInvoice = invoiceCount > 0 ? totalSales / invoiceCount : 0;
        
        document.getElementById('reportTotalSales').textContent = formatCurrency(totalSales);
        document.getElementById('reportInvoiceCount').textContent = invoiceCount;
        document.getElementById('reportAverageInvoice').textContent = formatCurrency(averageInvoice);
    } catch (error) {
        console.error('Error loading sales report:', error);
    }
}

async function loadTopProducts(from, to) {
    try {
        let items = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('sale_items')
                .select('product_id, quantity, products (name, price)');
            
            if (error) throw error;
            items = data || [];
        } else if (offlineManager) {
            items = await offlineManager.getFromLocalDB('sale_items');
        }
        
        const productSales = {};
        items.forEach(item => {
            const productId = item.product_id;
            if (!productSales[productId]) {
                productSales[productId] = {
                    name: item.products?.name || 'منتج محذوف',
                    quantity: 0,
                    total: 0
                };
            }
            productSales[productId].quantity += item.quantity;
            productSales[productId].total += (item.products?.price || 0) * item.quantity;
        });
        
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
        
        const container = document.getElementById('topProductsList');
        if (!container) return;
        
        if (topProducts.length === 0) {
            container.innerHTML = `
                <p style="color: rgba(255,255,255,0.3); text-align: center; padding: 1rem;">
                    لا توجد بيانات كافية
                </p>
            `;
            return;
        }
        
        container.innerHTML = topProducts.map((product, index) => `
            <div class="top-product-item">
                <span class="rank">#${index + 1}</span>
                <div class="product-info">
                    <span class="name">${escapeHtml(product.name)}</span>
                    <span class="stats">
                        ${product.quantity} × ${formatCurrency(product.total / product.quantity)}
                    </span>
                </div>
                <span class="total">${formatCurrency(product.total)}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading top products:', error);
    }
}

async function loadStockReport() {
    try {
        let products = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient.from('products').select('*');
            if (error) throw error;
            products = data || [];
        } else if (offlineManager) {
            products = await offlineManager.getFromLocalDB('products');
        }
        
        const totalProducts = products.length;
        const stockValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const lowStockCount = products.filter(p => p.quantity <= 5).length;
        
        document.getElementById('reportTotalProducts').textContent = totalProducts;
        document.getElementById('reportStockValue').textContent = formatCurrency(stockValue);
        document.getElementById('reportLowStockCount').textContent = lowStockCount;
    } catch (error) {
        console.error('Error loading stock report:', error);
    }
}

async function loadDailySalesChart(from, to) {
    try {
        let sales = [];
        if (navigator.onLine) {
            let query = supabaseClient.from('sales').select('total, created_at');
            if (from) query = query.gte('created_at', `${from}T00:00:00`);
            if (to) query = query.lte('created_at', `${to}T23:59:59`);
            const { data, error } = await query;
            if (error) throw error;
            sales = data || [];
        } else if (offlineManager) {
            sales = await offlineManager.getFromLocalDB('sales');
        }
        
        const dailySales = {};
        sales.forEach(sale => {
            const date = new Date(sale.created_at).toLocaleDateString('ar-SA');
            if (!dailySales[date]) {
                dailySales[date] = 0;
            }
            dailySales[date] += sale.total || 0;
        });
        
        const labels = Object.keys(dailySales);
        const data = Object.values(dailySales);
        
        const ctx = document.getElementById('salesChart')?.getContext('2d');
        if (!ctx) return;
        
        if (salesChart) {
            salesChart.destroy();
        }
        
        if (data.length === 0) {
            document.getElementById('salesChart').parentElement.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: rgba(255,255,255,0.3);">
                    <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    <p>لا توجد بيانات كافية للرسم البياني</p>
                </div>
            `;
            return;
        }
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 200, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
        
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'المبيعات اليومية (SDG)',
                    data: data,
                    borderColor: '#00c8ff',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#00c8ff',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: 'rgba(255,255,255,0.7)',
                            font: { size: 12, family: 'Inter' }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            color: 'rgba(255,255,255,0.5)',
                            callback: function(value) {
                                return value.toLocaleString() + ' SDG';
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    x: {
                        ticks: {
                            color: 'rgba(255,255,255,0.5)',
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading daily sales chart:', error);
    }
}

async function loadSalesPieChart(from, to) {
    try {
        let items = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('sale_items')
                .select('product_id, quantity, products (name)');
            
            if (error) throw error;
            items = data || [];
        } else if (offlineManager) {
            items = await offlineManager.getFromLocalDB('sale_items');
        }
        
        const productSales = {};
        items.forEach(item => {
            const productId = item.product_id;
            if (!productSales[productId]) {
                productSales[productId] = {
                    name: item.products?.name || 'منتج محذوف',
                    quantity: 0
                };
            }
            productSales[productId].quantity += item.quantity;
        });
        
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
        
        const labels = topProducts.map(p => p.name);
        const data = topProducts.map(p => p.quantity);
        
        if (Object.values(productSales).length > 5) {
            const otherCount = Object.values(productSales)
                .slice(5)
                .reduce((sum, p) => sum + p.quantity, 0);
            labels.push('منتجات أخرى');
            data.push(otherCount);
        }
        
        const colors = [
            'rgba(0, 200, 255, 0.8)',
            'rgba(0, 255, 150, 0.8)',
            'rgba(255, 200, 0, 0.8)',
            'rgba(150, 0, 255, 0.8)',
            'rgba(255, 100, 100, 0.8)',
            'rgba(100, 200, 255, 0.8)'
        ];
        
        const ctx = document.getElementById('productsPieChart')?.getContext('2d');
        if (!ctx) return;
        
        if (productsChart) {
            productsChart.destroy();
        }
        
        if (data.length === 0 || data.every(d => d === 0)) {
            document.getElementById('pieChartPlaceholder').style.display = 'block';
            return;
        }
        
        document.getElementById('pieChartPlaceholder').style.display = 'none';
        
        productsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: 'rgba(10, 22, 40, 0.8)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255,255,255,0.7)',
                            font: { size: 11, family: 'Inter' },
                            padding: 15
                        }
                    }
                },
                cutout: '60%'
            }
        });
    } catch (error) {
        console.error('Error loading products pie chart:', error);
    }
}

function showLoadingReports() {
    document.querySelectorAll('.report-stat strong').forEach(el => {
        el.textContent = '...';
    });
}

function hideLoadingReports() {}

document.getElementById('generateReportBtn')?.addEventListener('click', function() {
    loadReportsData();
});

window.loadReportsData = loadReportsData;

console.log('✅ Reports Module Loaded with Charts');