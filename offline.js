// ============================================================
// OFFLINE MODE MANAGER
// ============================================================

class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.pendingSync = [];
        this.syncInterval = null;
        this.dbName = 'JabalAlsafaDB';
        this.dbVersion = 3;
        this.db = null;
        this.isInitialized = false;
        this.init();
    }
    
    async init() {
        try {
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());
            await this.openDB();
            await this.loadPendingOperations();
            if (this.isOnline) this.startSyncInterval();
            this.updateConnectionStatus();
            this.isInitialized = true;
            console.log('✅ Offline Manager Initialized');
        } catch (error) {
            console.error('Error initializing Offline Manager:', error);
        }
    }
    
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const stores = ['products', 'sales', 'sale_items', 'stock_movements', 
                               'pending_operations', 'counting_sessions', 'counting_items',
                               'customers', 'purchases', 'purchase_items'];
                
                stores.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { keyPath: 'id' });
                        if (storeName === 'products') store.createIndex('name', 'name', { unique: false });
                        if (storeName === 'sales') store.createIndex('created_at', 'created_at', { unique: false });
                        if (storeName === 'stock_movements') store.createIndex('product_id', 'product_id', { unique: false });
                        if (storeName === 'pending_operations') {
                            store.createIndex('type', 'type', { unique: false });
                            store.createIndex('synced', 'synced', { unique: false });
                        }
                        if (storeName === 'customers') {
                            store.createIndex('name', 'name', { unique: false });
                            store.createIndex('phone', 'phone', { unique: false });
                        }
                    }
                });
            };
        });
    }
    
    async saveToLocalDB(storeName, data) {
        if (!this.db) {
            console.warn('Database not initialized');
            return;
        }
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                if (Array.isArray(data)) {
                    data.forEach(item => store.put(item));
                } else {
                    store.put(data);
                }
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async getFromLocalDB(storeName, id = null) {
        if (!this.db) {
            console.warn('Database not initialized');
            return [];
        }
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                if (id) {
                    const request = store.get(id);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                } else {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => reject(request.error);
                }
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async addPendingOperation(operation) {
        operation.synced = false;
        operation.created_at = new Date().toISOString();
        await this.saveToLocalDB('pending_operations', operation);
        this.pendingSync.push(operation);
        console.log(`📝 Pending operation added: ${operation.type}`);
        this.updateSyncStatus();
    }
    
    async loadPendingOperations() {
        try {
            const operations = await this.getFromLocalDB('pending_operations');
            this.pendingSync = (operations || []).filter(op => !op.synced);
            console.log(`📋 Loaded ${this.pendingSync.length} pending operations`);
            this.updateSyncStatus();
        } catch (error) {
            console.error('Error loading pending operations:', error);
            this.pendingSync = [];
        }
    }
    
    async syncWithSupabase() {
        if (!this.isOnline || this.pendingSync.length === 0) {
            this.updateSyncStatus();
            return;
        }
        console.log(`🔄 Syncing ${this.pendingSync.length} operations...`);
        this.updateSyncStatus();
        for (const operation of this.pendingSync) {
            try {
                await this.executeOperation(operation);
                operation.synced = true;
                await this.saveToLocalDB('pending_operations', operation);
                console.log(`✅ Synced: ${operation.type}`);
            } catch (error) {
                console.error(`❌ Failed to sync operation:`, error);
            }
        }
        await this.cleanupSyncedOperations();
        await this.loadPendingOperations();
        this.updateSyncStatus();
    }
    
    async executeOperation(operation) {
        switch (operation.type) {
            case 'sale':
                await this.executeSale(operation.data);
                break;
            case 'product_add':
                await this.executeProductAdd(operation.data);
                break;
            case 'product_update':
                await this.executeProductUpdate(operation.data);
                break;
            case 'product_delete':
                await this.executeProductDelete(operation.data);
                break;
            case 'stock_movement':
                await this.executeStockMovement(operation.data);
                break;
            case 'customer_add':
                await this.executeCustomerAdd(operation.data);
                break;
            case 'customer_update':
                await this.executeCustomerUpdate(operation.data);
                break;
            case 'purchase':
                await this.executePurchase(operation.data);
                break;
            default:
                console.warn(`Unknown operation type: ${operation.type}`);
        }
    }
    
    async executeSale(data) {
        const { sale, items } = data;
        const { error: saleError } = await supabaseClient.from('sales').insert([sale]);
        if (saleError) throw saleError;
        const { error: itemsError } = await supabaseClient.from('sale_items').insert(items);
        if (itemsError) throw itemsError;
        for (const item of items) {
            const { data: product } = await supabaseClient.from('products').select('quantity').eq('id', item.product_id).single();
            if (product) {
                await supabaseClient.from('products').update({ quantity: product.quantity - item.quantity }).eq('id', item.product_id);
            }
        }
    }
    
    async executeProductAdd(data) {
        const { error } = await supabaseClient.from('products').insert([data]);
        if (error) throw error;
    }
    
    async executeProductUpdate(data) {
        const { id, ...updates } = data;
        const { error } = await supabaseClient.from('products').update(updates).eq('id', id);
        if (error) throw error;
    }
    
    async executeProductDelete(data) {
        const { error } = await supabaseClient.from('products').delete().eq('id', data.id);
        if (error) throw error;
    }
    
    async executeStockMovement(data) {
        const { error } = await supabaseClient.from('stock_movements').insert([data]);
        if (error) throw error;
    }
    
    async executeCustomerAdd(data) {
        const { error } = await supabaseClient.from('customers').insert([data]);
        if (error) throw error;
    }
    
    async executeCustomerUpdate(data) {
        const { id, ...updates } = data;
        const { error } = await supabaseClient.from('customers').update(updates).eq('id', id);
        if (error) throw error;
    }
    
    async executePurchase(data) {
        const { purchase, items } = data;
        const { error: purchaseError } = await supabaseClient.from('purchases').insert([purchase]);
        if (purchaseError) throw purchaseError;
        const { error: itemsError } = await supabaseClient.from('purchase_items').insert(items);
        if (itemsError) throw itemsError;
        for (const item of items) {
            const { data: product } = await supabaseClient.from('products').select('quantity').eq('id', item.product_id).single();
            if (product) {
                await supabaseClient.from('products').update({ quantity: product.quantity + item.quantity }).eq('id', item.product_id);
            }
        }
    }
    
    async cleanupSyncedOperations() {
        try {
            const operations = await this.getFromLocalDB('pending_operations');
            const synced = (operations || []).filter(op => op.synced);
            if (synced.length === 0) return;
            const transaction = this.db.transaction('pending_operations', 'readwrite');
            const store = transaction.objectStore('pending_operations');
            synced.forEach(op => store.delete(op.id));
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            console.error('Error cleaning up:', error);
        }
    }
    
    handleOnline() {
        this.isOnline = true;
        console.log('🌐 Online - syncing data...');
        this.updateConnectionStatus();
        this.startSyncInterval();
        this.syncWithSupabase();
    }
    
    handleOffline() {
        this.isOnline = false;
        console.log('📴 Offline mode activated');
        this.updateConnectionStatus();
        this.stopSyncInterval();
    }
    
    startSyncInterval() {
        if (this.syncInterval) return;
        this.syncInterval = setInterval(() => this.syncWithSupabase(), 30000);
    }
    
    stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    updateConnectionStatus() {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.user-status span:last-child');
        if (statusDot) {
            statusDot.style.background = this.isOnline ? '#00ff96' : '#ff6b6b';
            statusDot.style.animation = this.isOnline ? 'pulse 2s infinite' : 'none';
        }
        if (statusText) {
            statusText.textContent = this.isOnline ? 'مدير النظام (🟢 متصل)' : 'مدير النظام (🔴 غير متصل)';
        }
    }
    
    updateSyncStatus() {
        const syncIndicator = document.getElementById('syncStatus');
        if (!syncIndicator) return;
        if (this.pendingSync.length > 0) {
            syncIndicator.innerHTML = `⏳ جاري المزامنة... (${this.pendingSync.length})`;
            syncIndicator.style.display = 'block';
        } else {
            syncIndicator.style.display = 'none';
        }
    }
}

// ============================================================
// INITIALIZE OFFLINE MANAGER
// ============================================================
let offlineManager = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        offlineManager = new OfflineManager();
    });
} else {
    offlineManager = new OfflineManager();
}

window.offlineManager = offlineManager;

console.log('✅ Offline Support Loaded');