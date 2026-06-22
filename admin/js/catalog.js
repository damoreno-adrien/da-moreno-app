import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../../js/config.js";
import { initAuth, setupLogout } from "../../js/auth.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "../../js/i18n.js";
import { showToast, renderPagination, setupSearch, setupMobileMenu } from "../../js/ui.js";

let allProducts = [], allSuppliers = [];
let productsCurrentPage = 1, suppliersCurrentPage = 1;
const itemsPerPage = 10;
let currentSorts = { products: { key: 'name_en', dir: 'asc' }, suppliers: { key: 'name', dir: 'asc' } };

function init() {
    setupLangSwitcher(() => { renderProductsTable(); renderSuppliersTable(); });
    setupLogout();
    setupMobileMenu();
    
    initAuth(() => {
        setLanguage(currentLang);
        fetchAllSuppliers();
        fetchAllProducts();
        setupEventListeners();
    });
}

// --- Fetch Data ---
function fetchAllSuppliers() {
    onSnapshot(collection(db, "suppliers"), (snapshot) => {
        allSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateSupplierDropdowns();
        renderSuppliersTable();
    });
}

function fetchAllProducts() {
    onSnapshot(collection(db, "products"), (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateCategorySuggestions();
        renderProductsTable();
    });
}

// --- Utils ---
function applySort(data, sortKey, sortDir, entityType) {
    data.sort((a, b) => {
        let valA = a[sortKey]; let valB = b[sortKey];
        if (sortKey === 'supplier' && entityType === 'products') {
            valA = allSuppliers.find(s => s.id === valA)?.name || '';
            valB = allSuppliers.find(s => s.id === valB)?.name || '';
        }
        if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        if (typeof valA === 'boolean') return sortDir === 'asc' ? (valA === valB ? 0 : valA ? -1 : 1) : (valA === valB ? 0 : valA ? 1 : -1);
        return sortDir === 'asc' ? valA - valB : valB - valA;
    });
}

function populateCategorySuggestions() {
    const enList = document.getElementById('category-en-list');
    const thList = document.getElementById('category-th-list');
    if (enList) enList.innerHTML = [...new Set(allProducts.map(p => p.category_en).filter(Boolean))].map(c => `<option value="${c}"></option>`).join('');
    if (thList) thList.innerHTML = [...new Set(allProducts.map(p => p.category_th).filter(Boolean))].map(c => `<option value="${c}"></option>`).join('');
}

function populateSupplierDropdowns() {
    const filterSelect = document.getElementById('supplier-filter');
    const modalSelect = document.getElementById('product-supplier-select');
    
    if (filterSelect) {
        filterSelect.innerHTML = `<option value="All">${translations[currentLang].all_suppliers}</option>`;
        allSuppliers.forEach(s => filterSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    }
    if (modalSelect) {
        modalSelect.innerHTML = `<option value="">${currentLang === 'th' ? 'เลือกซัพพลายเออร์' : 'Select a supplier'}</option>`;
        allSuppliers.forEach(s => modalSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    }
}

// --- Render Tables ---
function renderProductsTable() {
    const tbody = document.getElementById('products-table-body');
    const supplierId = document.getElementById('supplier-filter').value;
    const searchTerm = document.getElementById('product-search').value.toLowerCase();
    
    let filtered = allProducts.filter(p => {
        const match = (p.name_en || '').toLowerCase().includes(searchTerm) || (p.name_th || '').toLowerCase().includes(searchTerm) || (p.product_reference || '').toLowerCase().includes(searchTerm) || (p.keywords || '').toLowerCase().includes(searchTerm);
        return (supplierId === 'All' || p.supplier === supplierId) && match;
    });

    applySort(filtered, currentSorts.products.key, currentSorts.products.dir, 'products');
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((productsCurrentPage - 1) * itemsPerPage, productsCurrentPage * itemsPerPage);

    tbody.innerHTML = paginated.length === 0 ? `<tr><td colspan="6" class="text-center py-4">No products found.</td></tr>` : '';
    paginated.forEach(p => {
        const supName = allSuppliers.find(s => s.id === p.supplier)?.name || 'N/A';
        const statusClass = p.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b">
                <td class="table-cell"><img src="${p.imageUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=No+Img'}" class="h-12 w-12 object-cover rounded"></td>
                <td class="table-cell font-medium">${p[`name_${currentLang}`] || p.name_en}</td>
                <td class="table-cell text-gray-600">${p.product_reference || 'N/A'}</td>
                <td class="table-cell text-gray-600">${supName}</td>
                <td class="table-cell"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${p.isActive ? 'Active' : 'Inactive'}</span></td>
                <td class="table-cell">
                    <button data-id="${p.id}" class="edit-product-btn text-blue-600 hover:underline mr-2">Edit</button>
                    <button data-id="${p.id}" class="delete-product-btn text-red-600 hover:underline">Delete</button>
                </td>
            </tr>
        `);
    });
    renderPagination(document.getElementById('products-pagination-controls'), totalPages, productsCurrentPage, (pg) => { productsCurrentPage = pg; renderProductsTable(); });
}

function renderSuppliersTable() {
    const tbody = document.getElementById('suppliers-table-body');
    const searchTerm = document.getElementById('supplier-search').value.toLowerCase();
    let filtered = allSuppliers.filter(s => s.name.toLowerCase().includes(searchTerm));

    applySort(filtered, currentSorts.suppliers.key, currentSorts.suppliers.dir, 'suppliers');
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((suppliersCurrentPage - 1) * itemsPerPage, suppliersCurrentPage * itemsPerPage);

    tbody.innerHTML = paginated.length === 0 ? `<tr><td colspan="2" class="text-center py-4">No suppliers found.</td></tr>` : '';
    paginated.forEach(s => {
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b">
                <td class="table-cell font-medium">${s.name}</td>
                <td class="table-cell">
                    <button data-id="${s.id}" class="edit-supplier-btn text-blue-600 hover:underline mr-2">Edit</button>
                    <button data-id="${s.id}" class="delete-supplier-btn text-red-600 hover:underline">Delete</button>
                </td>
            </tr>
        `);
    });
    renderPagination(document.getElementById('suppliers-pagination-controls'), totalPages, suppliersCurrentPage, (pg) => { suppliersCurrentPage = pg; renderSuppliersTable(); });
}

// --- Event Listeners & Modals ---
function setupEventListeners() {
    setupSearch('product-search', 'product-clear-search', renderProductsTable);
    setupSearch('supplier-search', 'supplier-clear-search', renderSuppliersTable);
    document.getElementById('supplier-filter')?.addEventListener('change', () => { productsCurrentPage = 1; renderProductsTable(); });

    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => {
        e.target.closest('.fixed.inset-0').classList.replace('flex', 'hidden');
    }));

    // Products
    document.getElementById('add-product-btn')?.addEventListener('click', () => {
        document.getElementById('product-form').reset(); document.getElementById('product-id').value = '';
        document.getElementById('isActive').checked = true;
        document.getElementById('product-modal').classList.replace('hidden', 'flex');
    });
    document.getElementById('product-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const data = {
            name_en: document.getElementById('name_en').value, name_th: document.getElementById('name_th').value,
            product_reference: document.getElementById('product_reference').value, supplier: document.getElementById('product-supplier-select').value,
            category_en: document.getElementById('category_en').value, category_th: document.getElementById('category_th').value,
            packaging_en: document.getElementById('packaging_en').value, packaging_th: document.getElementById('packaging_th').value,
            keywords: document.getElementById('keywords').value, imageUrl: document.getElementById('imageUrl').value, isActive: document.getElementById('isActive').checked
        };
        if (id) await updateDoc(doc(db, "products", id), data); else await addDoc(collection(db, "products"), data);
        document.getElementById('product-modal').classList.replace('flex', 'hidden'); showToast('Product saved!');
    });
    document.getElementById('products-table-body')?.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-product-btn')) {
            const p = allProducts.find(x => x.id === id);
            document.getElementById('product-id').value = p.id; document.getElementById('name_en').value = p.name_en || '';
            document.getElementById('name_th').value = p.name_th || ''; document.getElementById('product_reference').value = p.product_reference || '';
            document.getElementById('product-supplier-select').value = p.supplier || ''; document.getElementById('category_en').value = p.category_en || '';
            document.getElementById('category_th').value = p.category_th || ''; document.getElementById('packaging_en').value = p.packaging_en || '';
            document.getElementById('packaging_th').value = p.packaging_th || ''; document.getElementById('keywords').value = p.keywords || '';
            document.getElementById('imageUrl').value = p.imageUrl || ''; document.getElementById('isActive').checked = p.isActive !== false;
            document.getElementById('product-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-product-btn') && confirm("Delete this product?")) {
            await deleteDoc(doc(db, "products", id)); showToast('Product deleted.');
        }
    });

    // Suppliers
    document.getElementById('add-supplier-btn')?.addEventListener('click', () => {
        document.getElementById('supplier-form').reset(); document.getElementById('supplier-id').value = '';
        document.getElementById('supplier-modal').classList.replace('hidden', 'flex');
    });
    document.getElementById('supplier-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('supplier-id').value;
        const data = { name: document.getElementById('supplier-name').value };
        if (id) await updateDoc(doc(db, "suppliers", id), data); else await addDoc(collection(db, "suppliers"), data);
        document.getElementById('supplier-modal').classList.replace('flex', 'hidden'); showToast('Supplier saved!');
    });
    document.getElementById('suppliers-table-body')?.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-supplier-btn')) {
            const s = allSuppliers.find(x => x.id === id);
            document.getElementById('supplier-id').value = s.id; document.getElementById('supplier-name').value = s.name;
            document.getElementById('supplier-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-supplier-btn') && confirm("Delete this supplier?")) {
            await deleteDoc(doc(db, "suppliers", id)); showToast('Supplier deleted.');
        }
    });

    // CSV Import / Export Logic
    setupCSVHandlers();
}

function setupCSVHandlers() {
    function exportCSV(data, headers, filename) {
        const rows = [headers.join(',')];
        data.forEach(item => {
            rows.push(headers.map(h => `"${('' + (item[h] !== undefined ? item[h] : '')).replace(/"/g, '""')}"`).join(','));
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' }));
        link.download = filename; link.click();
    }
    function handleImport(e, collectionName, reqHeaders, dataMap) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const lines = ev.target.result.split('\n').filter(r => r.trim() !== '');
            if (lines.length < 2) return showToast('CSV is empty', true);
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const missing = reqHeaders.filter(h => !headers.includes(h));
            if (missing.length > 0) return showToast(`Missing headers: ${missing.join(',')}`, true);
            
            const batch = writeBatch(db);
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                let raw = {}; headers.forEach((h, idx) => raw[h] = values[idx]);
                const mapped = dataMap(raw);
                if (mapped) batch.set(doc(collection(db, collectionName)), mapped);
            }
            try { await batch.commit(); showToast('Import successful'); } catch (err) { showToast('Import failed', true); }
            e.target.value = '';
        };
        reader.readAsText(file, 'UTF-8');
    }

    document.getElementById('export-product-btn')?.addEventListener('click', () => exportCSV(allProducts, ["name_en", "name_th", "product_reference", "supplier", "category_en", "category_th", "packaging_en", "packaging_th", "keywords", "imageUrl", "isActive"], 'products.csv'));
    document.getElementById('export-supplier-btn')?.addEventListener('click', () => exportCSV(allSuppliers, ["name"], 'suppliers.csv'));
    
    document.getElementById('import-product-btn')?.addEventListener('click', () => document.getElementById('csv-file-input').click());
    document.getElementById('import-supplier-btn')?.addEventListener('click', () => document.getElementById('supplier-csv-input').click());
    
    document.getElementById('csv-file-input')?.addEventListener('change', (e) => handleImport(e, 'products', ['name_en'], d => ({...d, isActive: d.isActive === 'true'})));
    document.getElementById('supplier-csv-input')?.addEventListener('change', (e) => handleImport(e, 'suppliers', ['name'], d => d));
}

init();