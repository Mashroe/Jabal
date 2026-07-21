// ============================================================
// PRODUCTS MANAGEMENT
// ============================================================

let currentProducts = [];
let deleteProductId = null;

// ============================================================
// HELPER: التحقق من وجود offlineManager
// ============================================================
function isOfflineManagerReady() {
    return typeof offlineManager !== 'undefined' && offlineManager !== null;
}

async function loadProducts() {
    try {
        console.log('🔄 Loading products...');
        let products = [];
        
        if (navigator.onLine) {
            const { data, error } = await supabaseClient
                .from('products')
                .select('id, name, price, created_at')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            products = data || [];
            console.log(`✅ Loaded ${products.length} products from Supabase`);
            
            if (isOfflineManagerReady() && products.length > 0) {
                await offlineManager.saveToLocalDB('products', products);
            }
        } else if (isOfflineManagerReady()) {
            products = await offlineManager.getFromLocalDB('products');
            console.log(`📴 Loaded ${products.length} products from local DB`);
            if (products.length > 0) {
                showToast('📴 عرض المنتجات من الذاكرة المحلية', 'info');
            }
        } else {
            console.warn('⚠️ Offline Manager not available');
        }
        
        localStorage.setItem('currentProducts', JSON.stringify(products));
        
        currentProducts = products;
        renderProducts(currentProducts);
        updateProductsCount(currentProducts.length);
        return products;
        
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('حدث خطأ في تحميل المنتجات', 'error');
        return [];
    }
}

function renderProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('emptyState');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) tableContainer.style.display = 'none';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) tableContainer.style.display = 'block';
    
    tbody.innerHTML = products.map((product, index) => {
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(product.name)}</strong></td>
                <td>${formatCurrency(product.price)}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editProduct('${product.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="confirmDeleteProduct('${product.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

document.getElementById('searchInput')?.addEventListener('input', function() { filterProducts(); });

function filterProducts() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    let filtered = currentProducts || [];
    if (searchTerm) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
    }
    renderProducts(filtered);
}

document.getElementById('addProductBtn')?.addEventListener('click', openAddModal);

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'إضافة منتج جديد';
    document.getElementById('productId').value = '';
    document.getElementById('productForm').reset();
    document.getElementById('productModal').classList.add('active');
}

function editProduct(id) {
    const product = currentProducts.find(p => p.id === id);
    if (!product) return;
    document.getElementById('modalTitle').textContent = 'تعديل المنتج';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productModal').classList.add('active');
}

document.getElementById('productForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    
    if (!name) {
        showToast('يرجى إدخال اسم المنتج', 'error');
        return;
    }
    if (isNaN(price) || price < 0) {
        showToast('يرجى إدخال سعر صحيح', 'error');
        return;
    }
    
    try {
        if (id) {
            // ===== EDIT =====
            const { error } = await supabaseClient
                .from('products')
                .update({ name, price })
                .eq('id', id);
            
            if (error) throw error;
            showToast('تم تحديث المنتج بنجاح', 'success');
            
        } else {
            // ===== ADD =====
            const productData = { name, price };
            
            const { data, error } = await supabaseClient
                .from('products')
                .insert([productData])
                .select();
            
            if (error) {
                console.error('Supabase insert error:', error);
                throw error;
            }
            
            console.log('✅ Product added:', data);
            showToast('تم إضافة المنتج بنجاح', 'success');
        }
        
        closeProductModal();
        await loadProducts();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('حدث خطأ في حفظ المنتج: ' + (error.message || 'غير معروف'), 'error');
    }
});

function confirmDeleteProduct(id) {
    deleteProductId = id;
    document.getElementById('deleteModal').classList.add('active');
}

document.getElementById('confirmDelete')?.addEventListener('click', async function() {
    if (!deleteProductId) return;
    try {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', deleteProductId);
        
        if (error) throw error;
        
        showToast('تم حذف المنتج بنجاح', 'success');
        closeDeleteModal();
        await loadProducts();
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('حدث خطأ في حذف المنتج', 'error');
    }
});

document.getElementById('closeProductModal')?.addEventListener('click', closeProductModal);
document.getElementById('cancelProductModal')?.addEventListener('click', closeProductModal);
document.getElementById('closeDeleteModal')?.addEventListener('click', closeDeleteModal);
document.getElementById('cancelDelete')?.addEventListener('click', closeDeleteModal);

document.getElementById('productModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeProductModal();
});
document.getElementById('deleteModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
});

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.getElementById('productForm').reset();
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteProductId = null;
}

function updateProductsCount(count) {
    const element = document.getElementById('productsCount');
    if (element) element.textContent = `${count} منتج`;
}

window.openAddModal = openAddModal;
window.editProduct = editProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.loadProducts = loadProducts;

console.log('✅ Products Module Loaded');
