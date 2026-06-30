// ============================================================
// CUSTOMERS MANAGEMENT
// ============================================================

let allCustomers = [];
let editingCustomerId = null;

async function loadCustomers() {
    try {
        console.log('🔄 Loading customers...');
        
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return [];
        }
        
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('customers')
                .select('*')
                .order('name', { ascending: true });
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            allCustomers = data || [];
            console.log(`✅ Loaded ${allCustomers.length} customers`);
            
            if (typeof offlineManager !== 'undefined' && offlineManager && allCustomers.length > 0) {
                await offlineManager.saveToLocalDB('customers', allCustomers);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            allCustomers = await offlineManager.getFromLocalDB('customers');
            console.log(`📴 Loaded ${allCustomers.length} customers from local DB`);
            if (allCustomers.length > 0) {
                showToast('📴 عرض العملاء من الذاكرة المحلية', 'info');
            }
        }
        
        renderCustomers(allCustomers);
        updateCustomersCount(allCustomers.length);
        return allCustomers;
        
    } catch (error) {
        console.error('Error loading customers:', error);
        showToast('حدث خطأ في تحميل العملاء', 'error');
        return [];
    }
}

function renderCustomers(customers) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) {
        console.warn('⚠️ customersTableBody not found');
        return;
    }
    
    if (!customers || customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                    👤 لا يوجد عملاء
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = customers.map((customer, index) => {
        const totalSpent = customer.total_spent || 0;
        const lastVisit = customer.last_visit ? new Date(customer.last_visit).toLocaleDateString('ar-SA') : '---';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(customer.name)}</strong></td>
                <td>${escapeHtml(customer.phone || '---')}</td>
                <td>${escapeHtml(customer.email || '---')}</td>
                <td>${formatCurrency(totalSpent)}</td>
                <td>${lastVisit}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editCustomer('${customer.id}')" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn edit-btn" onclick="viewCustomerHistory('${customer.id}')" title="سجل المشتريات">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteCustomer('${customer.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddCustomerModal() {
    editingCustomerId = null;
    document.getElementById('customerModalTitle').textContent = '👤 إضافة عميل جديد';
    document.getElementById('customerForm').reset();
    document.getElementById('customerId').value = '';
    document.getElementById('customerModal').classList.add('active');
}

function editCustomer(id) {
    const customer = allCustomers.find(c => c.id === id);
    if (!customer) {
        showToast('العميل غير موجود', 'error');
        return;
    }
    
    editingCustomerId = id;
    document.getElementById('customerModalTitle').textContent = '✏️ تعديل العميل';
    document.getElementById('customerId').value = customer.id;
    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerPhone').value = customer.phone || '';
    document.getElementById('customerEmail').value = customer.email || '';
    document.getElementById('customerAddress').value = customer.address || '';
    document.getElementById('customerModal').classList.add('active');
}

// ===== CUSTOMER FORM SUBMIT =====
document.getElementById('customerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('customerId').value;
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    
    if (!name) {
        showToast('يرجى إدخال اسم العميل', 'error');
        return;
    }
    
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const customerData = { 
            name, 
            phone: phone || null,
            email: email || null,
            address: address || null,
            updated_at: new Date().toISOString()
        };
        
        if (id) {
            // ===== EDIT =====
            const { error } = await supabaseClient
                .from('customers')
                .update(customerData)
                .eq('id', id);
            
            if (error) throw error;
            showToast('✅ تم تحديث العميل بنجاح', 'success');
            
        } else {
            // ===== ADD =====
            customerData.created_at = new Date().toISOString();
            customerData.total_spent = 0;
            
            const { data, error } = await supabaseClient
                .from('customers')
                .insert([customerData])
                .select();
            
            if (error) {
                console.error('Insert error:', error);
                throw error;
            }
            console.log('✅ Customer added:', data);
            showToast('✅ تم إضافة العميل بنجاح', 'success');
        }
        
        closeCustomerModal();
        await loadCustomers();
        
    } catch (error) {
        console.error('Error saving customer:', error);
        showToast('حدث خطأ في حفظ العميل: ' + (error.message || 'غير معروف'), 'error');
    }
});

async function deleteCustomer(id) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا العميل؟')) return;
    
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const { error } = await supabaseClient
            .from('customers')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('✅ تم حذف العميل بنجاح', 'success');
        await loadCustomers();
        
    } catch (error) {
        console.error('Error deleting customer:', error);
        showToast('حدث خطأ في حذف العميل', 'error');
    }
}

async function viewCustomerHistory(customerId) {
    try {
        if (typeof supabaseClient === 'undefined') {
            showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        const customer = allCustomers.find(c => c.id === customerId);
        if (!customer) {
            showToast('العميل غير موجود', 'error');
            return;
        }
        
        let sales = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        *,
                        products (name)
                    )
                `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error loading sales:', error);
                throw error;
            }
            sales = data || [];
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            const allSales = await offlineManager.getFromLocalDB('sales');
            sales = allSales.filter(s => s.customer_id === customerId);
        }
        
        const modal = document.getElementById('customerHistoryModal');
        const body = document.getElementById('customerHistoryBody');
        
        if (body) {
            let historyHTML = `
                <div class="customer-history">
                    <div class="customer-info">
                        <h4>👤 ${escapeHtml(customer.name)}</h4>
                        <p>📞 ${escapeHtml(customer.phone || '---')}</p>
                        <p>📧 ${escapeHtml(customer.email || '---')}</p>
                        <p>💰 إجمالي المشتريات: ${formatCurrency(customer.total_spent || 0)}</p>
                    </div>
                    <div class="receipt-divider"></div>
                    <h5>📋 سجل المشتريات (${sales.length})</h5>
            `;
            
            if (sales.length === 0) {
                historyHTML += `<p style="color: rgba(255,255,255,0.3); text-align: center; padding: 1rem;">لا توجد مشتريات سابقة</p>`;
            } else {
                sales.forEach(sale => {
                    const date = new Date(sale.created_at).toLocaleString('ar-SA');
                    const items = sale.sale_items || [];
                    
                    historyHTML += `
                        <div class="history-item">
                            <div class="history-header">
                                <span>📅 ${date}</span>
                                <span>💰 ${formatCurrency(sale.total)}</span>
                            </div>
                            <div class="history-items">
                                ${items.map(item => `
                                    <span>${escapeHtml(item.products?.name || 'منتج محذوف')} × ${item.quantity}</span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                });
            }
            
            historyHTML += `</div>`;
            body.innerHTML = historyHTML;
        }
        
        if (modal) modal.classList.add('active');
        
    } catch (error) {
        console.error('Error viewing customer history:', error);
        showToast('حدث خطأ في عرض سجل العميل', 'error');
    }
}

function searchCustomer() {
    const searchTerm = document.getElementById('customerSearchInput')?.value?.toLowerCase() || '';
    const filtered = allCustomers.filter(c => 
        c.name.toLowerCase().includes(searchTerm) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.email && c.email.toLowerCase().includes(searchTerm))
    );
    renderCustomers(filtered);
}

function updateCustomersCount(count) {
    const element = document.getElementById('customersCount');
    if (element) element.textContent = `${count} عميل`;
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.remove('active');
    document.getElementById('customerForm').reset();
}

function closeCustomerHistoryModal() {
    document.getElementById('customerHistoryModal').classList.remove('active');
}

// ===== EXPORT =====
window.loadCustomers = loadCustomers;
window.openAddCustomerModal = openAddCustomerModal;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.viewCustomerHistory = viewCustomerHistory;
window.searchCustomer = searchCustomer;

console.log('✅ Customers Module Loaded');