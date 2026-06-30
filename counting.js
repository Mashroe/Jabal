// ============================================================
// INVENTORY COUNTING SYSTEM (JARD)
// ============================================================

let countingItems = [];
let countingSession = null;
let isCountingActive = false;

// ============================================================
// تحميل بيانات الجرد
// ============================================================
async function loadCountingData() {
    try {
        console.log('🔄 Loading counting data...');
        
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return;
        }
        
        await checkActiveSession();
        await loadProductsForCounting();
        await loadCountingHistory();
        
        console.log('✅ Counting data loaded');
    } catch (error) {
        console.error('Error loading counting data:', error);
    }
}

// ============================================================
// التحقق من الجلسة النشطة
// ============================================================
async function checkActiveSession() {
    try {
        if (typeof supabaseClient === 'undefined') {
            isCountingActive = false;
            countingSession = null;
            updateCountingUI();
            return;
        }
        
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('counting_sessions')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) {
                console.error('Error checking session:', error);
                isCountingActive = false;
                countingSession = null;
                updateCountingUI();
                return;
            }
            
            if (data && data.length > 0) {
                countingSession = data[0];
                isCountingActive = true;
                console.log('✅ Found active counting session');
            } else {
                countingSession = null;
                isCountingActive = false;
                console.log('ℹ️ No active counting session');
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            const sessions = await offlineManager.getFromLocalDB('counting_sessions') || [];
            const active = sessions.find(s => s.status === 'active');
            if (active) {
                countingSession = active;
                isCountingActive = true;
            } else {
                countingSession = null;
                isCountingActive = false;
            }
        }
        updateCountingUI();
    } catch (error) {
        console.error('Error checking active session:', error);
        isCountingActive = false;
        updateCountingUI();
    }
}

// ============================================================
// تحديث واجهة الجرد
// ============================================================
function updateCountingUI() {
    const statusEl = document.getElementById('countingStatus');
    const startBtn = document.getElementById('startCountingBtn');
    const finishBtn = document.getElementById('finishCountingBtn');
    const exportBtn = document.getElementById('exportCountingBtn');
    const progressEl = document.getElementById('countingProgress');
    
    if (isCountingActive) {
        if (statusEl) { statusEl.textContent = '✅ نشط'; statusEl.style.color = '#00ff96'; }
        if (startBtn) startBtn.style.display = 'none';
        if (finishBtn) finishBtn.style.display = 'inline-flex';
        if (exportBtn) exportBtn.style.display = 'inline-flex';
        if (progressEl) progressEl.style.display = 'block';
    } else {
        if (statusEl) { statusEl.textContent = '⏸ غير نشط'; statusEl.style.color = 'rgba(255,255,255,0.3)'; }
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (finishBtn) finishBtn.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
        if (progressEl) progressEl.style.display = 'none';
    }
}

// ============================================================
// تحميل المنتجات للجرد
// ============================================================
async function loadProductsForCounting() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.warn('⚠️ supabaseClient not available');
            return;
        }
        
        let products = [];
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .order('name');
            
            if (error) {
                console.error('Error loading products:', error);
                return;
            }
            products = data || [];
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            products = await offlineManager.getFromLocalDB('products');
        }
        
        if (countingSession) {
            let items = [];
            if (navigator.onLine && typeof supabaseClient !== 'undefined') {
                const { data, error } = await supabaseClient
                    .from('counting_items')
                    .select('*')
                    .eq('session_id', countingSession.id);
                if (!error && data) items = data;
            } else if (typeof offlineManager !== 'undefined' && offlineManager) {
                const allItems = await offlineManager.getFromLocalDB('counting_items');
                items = allItems.filter(i => i.session_id === countingSession.id);
            }
            
            countingItems = products.map(product => {
                const existing = items.find(item => item.product_id === product.id);
                return {
                    ...product,
                    counted_quantity: existing ? existing.counted_quantity : null,
                    difference: existing ? existing.difference : null,
                    status: existing ? existing.status : 'pending'
                };
            });
        } else {
            countingItems = products.map(product => ({
                ...product,
                counted_quantity: null,
                difference: null,
                status: 'pending'
            }));
        }
        
        renderCountingItems(countingItems);
        updateCountingProgress(countingItems);
    } catch (error) {
        console.error('Error loading products for counting:', error);
    }
}

// ============================================================
// عرض عناصر الجرد
// ============================================================
function renderCountingItems(items) {
    const tbody = document.getElementById('countingTableBody');
    if (!tbody) {
        console.warn('⚠️ countingTableBody not found');
        return;
    }
    
    if (!items || items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                    📦 لا توجد منتجات للجرد
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = items.map((item, index) => {
        const difference = item.difference !== null ? item.difference : 0;
        const diffClass = difference > 0 ? 'positive' : difference < 0 ? 'negative' : '';
        const statusBadge = getCountingStatusBadge(item.status);
        const isEditable = isCountingActive && (item.status === 'pending' || item.status === 'counted');
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td>${item.quantity}</td>
                <td>
                    <input type="number" 
                           class="counting-input" 
                           data-id="${item.id}"
                           value="${item.counted_quantity !== null ? item.counted_quantity : ''}"
                           ${!isEditable ? 'disabled' : ''}
                           placeholder="أدخل الكمية"
                           onchange="updateCountedQuantity('${item.id}', this.value)"
                    />
                </td>
                <td class="${diffClass}">
                    ${difference !== 0 ? difference : '--'}
                </td>
                <td>${statusBadge}</td>
                <td>
                    ${isEditable ? `
                        <button class="action-btn edit-btn" onclick="confirmCount('${item.id}')" title="تأكيد الجرد">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function getCountingStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge badge-secondary">⏳ قيد الانتظار</span>',
        'counted': '<span class="badge badge-info">📝 تم الجرد</span>',
        'verified': '<span class="badge badge-success">✅ تم التحقق</span>',
        'discrepancy': '<span class="badge badge-warning">⚠️ اختلاف</span>'
    };
    return badges[status] || badges['pending'];
}

// ============================================================
// تحديث الكمية المقروءة
// ============================================================
async function updateCountedQuantity(productId, value) {
    if (!isCountingActive) { 
        showToast('⚠️ لا توجد جلسة جرد نشطة', 'error'); 
        return; 
    }
    const quantity = parseInt(value);
    if (isNaN(quantity) || quantity < 0) return;
    const item = countingItems.find(i => i.id === productId);
    if (!item) return;
    
    item.counted_quantity = quantity;
    item.difference = quantity - item.quantity;
    item.status = 'counted';
    
    try {
        const itemData = {
            session_id: countingSession.id,
            product_id: productId,
            counted_quantity: quantity,
            difference: item.difference,
            status: 'counted'
        };
        
        if (navigator.onLine && typeof supabaseClient !== 'undefined') {
            const { data: existing } = await supabaseClient
                .from('counting_items')
                .select('id')
                .eq('session_id', countingSession.id)
                .eq('product_id', productId)
                .maybeSingle();
            
            if (existing) {
                await supabaseClient
                    .from('counting_items')
                    .update(itemData)
                    .eq('id', existing.id);
            } else {
                await supabaseClient
                    .from('counting_items')
                    .insert([itemData]);
            }
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            const allItems = await offlineManager.getFromLocalDB('counting_items');
            const existing = allItems.find(i => i.session_id === countingSession.id && i.product_id === productId);
            
            if (existing) {
                await offlineManager.saveToLocalDB('counting_items', { ...existing, ...itemData });
            } else {
                const newItem = { id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), ...itemData };
                await offlineManager.saveToLocalDB('counting_items', newItem);
            }
        }
        
        updateCountingProgress(countingItems);
        renderCountingItems(countingItems);
    } catch (error) {
        console.error('Error updating counted quantity:', error);
        showToast('حدث خطأ في تحديث الكمية', 'error');
    }
}

// ============================================================
// تأكيد الجرد
// ============================================================
async function confirmCount(productId) {
    const item = countingItems.find(i => i.id === productId);
    if (!item || item.counted_quantity === null) {
        showToast('⚠️ يرجى إدخال الكمية الفعلية أولاً', 'warning');
        return;
    }
    
    item.status = 'verified';
    
    try {
        if (navigator.onLine && typeof supabaseClient !== 'undefined') {
            await supabaseClient
                .from('counting_items')
                .update({ status: 'verified' })
                .eq('session_id', countingSession.id)
                .eq('product_id', productId);
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            const allItems = await offlineManager.getFromLocalDB('counting_items');
            const existing = allItems.find(i => i.session_id === countingSession.id && i.product_id === productId);
            if (existing) {
                await offlineManager.saveToLocalDB('counting_items', { ...existing, status: 'verified' });
            }
        }
        
        renderCountingItems(countingItems);
        updateCountingProgress(countingItems);
        showToast('✅ تم تأكيد جرد المنتج', 'success');
    } catch (error) {
        console.error('Error confirming count:', error);
        showToast('حدث خطأ في تأكيد الجرد', 'error');
    }
}

// ============================================================
// تحديث التقدم
// ============================================================
function updateCountingProgress(items) {
    const total = items.length;
    const counted = items.filter(i => i.status === 'counted' || i.status === 'verified').length;
    const discrepancies = items.filter(i => i.difference !== null && i.difference !== 0).length;
    
    const countedEl = document.getElementById('countedItems');
    const remainingEl = document.getElementById('remainingItems');
    const discrepancyEl = document.getElementById('discrepancyCount');
    const progressBar = document.getElementById('countingProgressBar');
    
    if (countedEl) countedEl.textContent = counted;
    if (remainingEl) remainingEl.textContent = total - counted;
    if (discrepancyEl) discrepancyEl.textContent = discrepancies;
    
    const progress = total > 0 ? (counted / total) * 100 : 0;
    if (progressBar) progressBar.style.width = `${progress}%`;
}

// ============================================================
// سجل الجرد
// ============================================================
async function loadCountingHistory() {
    try {
        let sessions = [];
        if (navigator.onLine && typeof supabaseClient !== 'undefined') {
            const { data, error } = await supabaseClient
                .from('counting_sessions')
                .select('*')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) {
                console.error('Error loading history:', error);
                return;
            }
            sessions = data || [];
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            const allSessions = await offlineManager.getFromLocalDB('counting_sessions');
            sessions = allSessions.filter(s => s.status === 'completed');
        }
        
        const tbody = document.getElementById('countingHistoryBody');
        if (!tbody) return;
        
        if (!sessions || sessions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: rgba(255,255,255,0.3); padding: 2rem;">
                        📜 لا يوجد سجل جرد سابق
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = sessions.map(session => {
            const date = new Date(session.created_at).toLocaleString('ar-SA');
            const itemsCount = countingItems.length || 0;
            const discrepancyCount = countingItems.filter(i => i.difference !== 0).length || 0;
            
            return `
                <tr>
                    <td>${date}</td>
                    <td>${itemsCount}</td>
                    <td>${discrepancyCount}</td>
                    <td><span class="badge badge-success">✅ مكتمل</span></td>
                    <td>
                        <button class="action-btn edit-btn" onclick="viewCountingReport('${session.id}')" title="عرض التقرير">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading counting history:', error);
    }
}

// ============================================================
// عرض تقرير الجرد
// ============================================================
async function viewCountingReport(sessionId) {
    try {
        let items = [];
        if (navigator.onLine && typeof supabaseClient !== 'undefined') {
            const { data, error } = await supabaseClient
                .from('counting_items')
                .select('*, products (name, quantity)')
                .eq('session_id', sessionId);
            
            if (error) {
                console.error('Error loading report:', error);
                showToast('حدث خطأ في تحميل التقرير', 'error');
                return;
            }
            items = data || [];
        } else if (typeof offlineManager !== 'undefined' && offlineManager) {
            const allItems = await offlineManager.getFromLocalDB('counting_items');
            items = allItems.filter(i => i.session_id === sessionId);
        }
        
        let report = '📋 تقرير الجرد\n';
        report += '='.repeat(50) + '\n\n';
        report += `📅 التاريخ: ${new Date().toLocaleString('ar-SA')}\n`;
        report += `📦 إجمالي المنتجات: ${items.length}\n\n`;
        report += '-'.repeat(50) + '\n\n';
        
        items.forEach(item => {
            report += `🔹 المنتج: ${item.products?.name || 'غير معروف'}\n`;
            report += `   المخزون النظري: ${item.products?.quantity || item.quantity || 0}\n`;
            report += `   الكمية الفعلية: ${item.counted_quantity || 0}\n`;
            report += `   الفرق: ${item.difference || 0}\n`;
            report += '-'.repeat(30) + '\n';
        });
        
        alert(report);
    } catch (error) {
        console.error('Error viewing counting report:', error);
        showToast('حدث خطأ في عرض التقرير', 'error');
    }
}

// ============================================================
// تطبيق التعديلات
// ============================================================
async function applyAdjustments(discrepancies) {
    try {
        for (const item of discrepancies) {
            if (navigator.onLine && typeof supabaseClient !== 'undefined') {
                await supabaseClient
                    .from('products')
                    .update({ quantity: item.counted_quantity })
                    .eq('id', item.id);
                
                await supabaseClient
                    .from('stock_movements')
                    .insert([{
                        product_id: item.id,
                        type: 'adjustment',
                        quantity: Math.abs(item.difference),
                        note: `تعديل جرد - الكمية الفعلية: ${item.counted_quantity}`
                    }]);
            } else if (typeof offlineManager !== 'undefined' && offlineManager) {
                const products = await offlineManager.getFromLocalDB('products');
                const product = products.find(p => p.id === item.id);
                if (product) {
                    product.quantity = item.counted_quantity;
                    await offlineManager.saveToLocalDB('products', product);
                }
            }
        }
        showToast('✅ تم تطبيق التعديلات على المخزون', 'success');
    } catch (error) {
        console.error('Error applying adjustments:', error);
        showToast('حدث خطأ في تطبيق التعديلات', 'error');
    }
}

// ============================================================
// أزرار الجرد
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // بدء الجرد
    document.getElementById('startCountingBtn')?.addEventListener('click', async function() {
        try {
            if (isCountingActive) { 
                showToast('⚠️ يوجد جلسة جرد نشطة بالفعل', 'warning'); 
                return; 
            }
            if (typeof supabaseClient === 'undefined') {
                showToast('⚠️ خطأ في الاتصال بقاعدة البيانات', 'error');
                return;
            }
            
            const session = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                status: 'active',
                started_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            };
            
            if (navigator.onLine) {
                const { data, error } = await supabaseClient
                    .from('counting_sessions')
                    .insert([session])
                    .select()
                    .single();
                
                if (error) {
                    console.error('Error starting session:', error);
                    showToast('حدث خطأ في بدء الجرد', 'error');
                    return;
                }
                countingSession = data;
            } else if (typeof offlineManager !== 'undefined' && offlineManager) {
                await offlineManager.saveToLocalDB('counting_sessions', session);
                await offlineManager.addPendingOperation({
                    type: 'counting_start',
                    data: session
                });
                countingSession = session;
            }
            
            isCountingActive = true;
            await loadCountingData();
            showToast('✅ تم بدء جلسة الجرد بنجاح', 'success');
        } catch (error) {
            console.error('Error starting counting session:', error);
            showToast('حدث خطأ في بدء الجرد', 'error');
        }
    });

    // إنهاء الجرد
    document.getElementById('finishCountingBtn')?.addEventListener('click', async function() {
        if (!countingSession) { 
            showToast('⚠️ لا توجد جلسة جرد نشطة', 'error'); 
            return; 
        }
        const uncounted = countingItems.filter(i => i.status === 'pending');
        if (uncounted.length > 0 && !confirm(`⚠️ هناك ${uncounted.length} منتج لم يتم جردها. هل تريد إنهاء الجرد؟`)) return;
        
        try {
            const completedAt = new Date().toISOString();
            
            if (navigator.onLine && typeof supabaseClient !== 'undefined') {
                await supabaseClient
                    .from('counting_sessions')
                    .update({
                        status: 'completed',
                        completed_at: completedAt
                    })
                    .eq('id', countingSession.id);
            } else if (typeof offlineManager !== 'undefined' && offlineManager) {
                const sessions = await offlineManager.getFromLocalDB('counting_sessions');
                const session = sessions.find(s => s.id === countingSession.id);
                if (session) {
                    session.status = 'completed';
                    session.completed_at = completedAt;
                    await offlineManager.saveToLocalDB('counting_sessions', session);
                }
                await offlineManager.addPendingOperation({
                    type: 'counting_finish',
                    data: { id: countingSession.id, completed_at: completedAt }
                });
            }
            
            const discrepancies = countingItems.filter(i => i.difference !== null && i.difference !== 0);
            if (discrepancies.length > 0 && confirm(`⚠️ هناك ${discrepancies.length} اختلافات. هل تريد تطبيق التعديلات على المخزون؟`)) {
                await applyAdjustments(discrepancies);
            }
            
            isCountingActive = false;
            countingSession = null;
            await loadCountingData();
            if (typeof loadDashboardData === 'function') {
                await loadDashboardData();
            }
            showToast('✅ تم إنهاء جلسة الجرد بنجاح', 'success');
        } catch (error) {
            console.error('Error finishing counting session:', error);
            showToast('حدث خطأ في إنهاء الجرد', 'error');
        }
    });

    // تصدير تقرير الجرد
    document.getElementById('exportCountingBtn')?.addEventListener('click', function() {
        if (!countingSession) { 
            showToast('⚠️ لا توجد جلسة جرد', 'error'); 
            return; 
        }
        
        const counted = countingItems.filter(i => i.status === 'counted' || i.status === 'verified');
        const discrepancies = countingItems.filter(i => i.difference !== null && i.difference !== 0);
        
        let report = '📋 تقرير جرد المخزون\n';
        report += '='.repeat(50) + '\n\n';
        report += `📅 التاريخ: ${new Date().toLocaleString('ar-SA')}\n`;
        report += `📦 إجمالي المنتجات: ${countingItems.length}\n`;
        report += `✅ تم جردها: ${counted.length}\n`;
        report += `⚠️ الاختلافات: ${discrepancies.length}\n\n`;
        report += '-'.repeat(50) + '\n\n';
        
        if (discrepancies.length > 0) {
            report += '🔹 المنتجات التي بها اختلافات:\n';
            discrepancies.forEach(item => {
                report += `   - ${item.name}: نظري ${item.quantity}, فعلي ${item.counted_quantity}, فرق ${item.difference}\n`;
            });
        } else {
            report += '✅ لا توجد اختلافات في المخزون.\n';
        }
        
        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `تقرير_الجرد_${new Date().toISOString().slice(0,10)}.txt`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        showToast('✅ تم تصدير التقرير بنجاح', 'success');
    });
});

// ============================================================
// اختصار لوحة المفاتيح Ctrl+Enter لتأكيد الجرد
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        const activeInput = document.activeElement;
        if (activeInput && activeInput.classList.contains('counting-input')) {
            const productId = activeInput.dataset.id;
            if (productId) confirmCount(productId);
        }
    }
});

// ============================================================
// EXPORT
// ============================================================
window.loadCountingData = loadCountingData;
window.updateCountedQuantity = updateCountedQuantity;
window.confirmCount = confirmCount;
window.viewCountingReport = viewCountingReport;

console.log('✅ Counting Module Loaded');