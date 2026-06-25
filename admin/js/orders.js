import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, writeBatch, addDoc, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../../js/config.js";
import { initAuth, currentUserRole, currentUserBranchId, activeBranchContext, setActiveBranchContext, setupLogout } from "../../js/auth.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "../../js/i18n.js";
import { showToast, renderPagination, setupMobileMenu, formatDate } from "../../js/ui.js";

let pendingOrders = [], processedOrders = [], allStaff = [], allDepartments = [], allSuppliers = [], allProducts = [], allBranches = [];
let historyCurrentPage = 1;
const itemsPerPage = 10;
let currentEditingOrder = { id: null, items: [] };
let historySortBy = 'date';
let historySortDesc = true;
let replaceTargetProductId = null; // Pour la modale de remplacement

function init() {
    setupLangSwitcher(() => { renderPendingOrders(); renderOrderHistory(); });
    setupLogout();
    setupMobileMenu();

    initAuth(() => {
        setLanguage(currentLang);
        fetchAllBranches();
        fetchAllDepartments();
        fetchAllStaff();
        fetchAllSuppliers();
        fetchAllProducts();
        fetchPendingOrders();
        fetchProcessedOrders();
        setupEventListeners();
    });
}

// --- Fetch Data ---
function fetchAllBranches() {
    onSnapshot(collection(db, "branches"), (snapshot) => {
        allBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const contextSelect = document.getElementById('global-branch-context-select');
        if (contextSelect) {
            contextSelect.innerHTML = currentUserRole === 'superadmin' ? `<option value="ALL">${translations[currentLang].all_branches || 'All Branches'}</option>` : '';
            allBranches.forEach(b => {
                contextSelect.innerHTML += `<option value="${b.id}" ${b.id === activeBranchContext ? 'selected' : ''}>${b.name}</option>`;
            });
        }
    });
}
function fetchAllDepartments() { onSnapshot(collection(db, "departments"), snap => allDepartments = snap.docs.map(d => ({ id: d.id, ...d.data() }))); }
function fetchAllStaff() { onSnapshot(collection(db, "users"), snap => allStaff = snap.docs.map(d => ({ id: d.id, ...d.data() }))); }
function fetchAllSuppliers() { onSnapshot(collection(db, "suppliers"), snap => allSuppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }))); }
function fetchAllProducts() { onSnapshot(collection(db, "products"), snap => allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }))); }

function fetchPendingOrders() {
    document.getElementById('orders-loading').classList.remove('hidden');
    onSnapshot(query(collection(db, "orders"), where("status", "==", "Pending")), (snapshot) => {
        pendingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('orders-loading').classList.add('hidden');
        renderPendingOrders();
    });
}

function fetchProcessedOrders() {
    document.getElementById('history-loading').classList.remove('hidden');
    const q = query(collection(db, "orders"), where("status", "!=", "Pending"), limit(300));
    onSnapshot(q, (snapshot) => {
        let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        orders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        processedOrders = orders;
        document.getElementById('history-loading').classList.add('hidden');
        renderOrderHistory();
    });
}

// --- Renders ---
function renderPendingOrders() {
    const list = document.getElementById('pending-orders-list');
    const branchContext = currentUserRole === 'admin' ? currentUserBranchId : activeBranchContext;
    const filteredOrders = pendingOrders.filter(o => branchContext === 'ALL' || o.branchId === branchContext);

    list.innerHTML = '';
    if (filteredOrders.length === 0) {
        list.innerHTML = `<p class="text-gray-500">${translations[currentLang].pending_orders?.toLowerCase() === 'คำสั่งซื้อที่รอดำเนินการ' ? 'ไม่มีคำสั่งซื้อที่รอดำเนินการ' : 'No pending orders.'}</p>`;
        document.getElementById('generate-list-btn').disabled = true;
        return;
    }
    document.getElementById('generate-list-btn').disabled = false;

    // Grouping by Branch -> Department -> User
    const ordersHierarchy = filteredOrders.reduce((acc, order) => {
        const branch = allBranches.find(b => b.id === order.branchId);
        const branchName = branch ? branch.name : 'Unknown Branch';
        const deptName = order[`departmentName_${currentLang}`] || order.departmentName || 'Unknown Dept';
        const user = allStaff.find(s => s.id === order.userId);
        const userName = user?.name || 'Unknown User';

        if (!acc[branchName]) acc[branchName] = {};
        if (!acc[branchName][deptName]) acc[branchName][deptName] = {};
        if (!acc[branchName][deptName][userName]) acc[branchName][deptName][userName] = [];
        acc[branchName][deptName][userName].push(order);
        return acc;
    }, {});

    let html = '';
    for (const branch in ordersHierarchy) {
        html += `<div class="mb-8"><h3 class="text-xl font-extrabold text-indigo-800 mb-3 border-b-2 border-indigo-200 pb-1 flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>${branch}</h3>`;
        for (const dept in ordersHierarchy[branch]) {
            html += `<div class="border rounded-lg p-4 bg-gray-50 mb-4 ml-2"><h4 class="font-bold text-lg text-gray-700">${dept}</h4>`;
            for (const user in ordersHierarchy[branch][dept]) {
                html += `<div class="mt-2 pl-4 border-l-2 border-blue-500"><p class="font-semibold text-md">${user}</p>`;
                ordersHierarchy[branch][dept][user].forEach(order => {
                    const orderDate = order.createdAt ? formatDate(order.createdAt.toDate()) : 'N/A';

                    const itemsHtml = order.items.map(item => `
        <li class="flex items-center gap-2 mb-1">
            <input type="checkbox" data-order-id="${order.id}" data-product-id="${item.productId}" class="item-select-checkbox w-4 h-4 text-blue-600 cursor-pointer" checked>
            <span class="text-gray-700">${item.quantity} x ${item[`productName_${currentLang}`] || item.productName}</span>
        </li>`).join('');

                    html += `
        <div class="relative mt-2 bg-white p-3 rounded shadow-sm">
            <p class="text-xs font-bold text-gray-400 mb-2 uppercase">${orderDate}</p>
            
            <ul class="text-gray-600">${itemsHtml}</ul>
            ${order.notes ? `<p class="text-sm text-gray-500 mt-2 italic border-l-2 border-gray-300 pl-2"><strong>Note:</strong> ${order.notes}</p>` : ''}
            <div class="flex flex-wrap gap-2 mt-3 pt-2 border-t">
                <button data-id="${order.id}" class="edit-order-btn text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Edit</button>
                <button data-id="${order.id}" class="cancel-order-btn text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200">Cancel</button>
                <button data-id="${order.id}" class="permanent-delete-order-btn text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 ml-auto flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> ${translations[currentLang].delete_permanently || 'Delete'}</button>
            </div>
        </div>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }
    list.innerHTML = html;
}

function generateSupplierList() {
    const checkedCheckboxes = Array.from(document.querySelectorAll('.item-select-checkbox:checked'));
    if (checkedCheckboxes.length === 0) return alert("Veuillez sélectionner au moins un article.");

    const selectedData = {};
    checkedCheckboxes.forEach(cb => {
        if (!selectedData[cb.dataset.orderId]) selectedData[cb.dataset.orderId] = [];
        selectedData[cb.dataset.orderId].push(cb.dataset.productId);
    });

    const mergedItems = {};
    for (const orderId in selectedData) {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) continue;
        const branchName = allBranches.find(b => b.id === order.branchId)?.name || 'Unknown Branch';

        order.items.filter(i => selectedData[orderId].includes(i.productId)).forEach(item => {
            const key = item.productId + '_' + order.branchId;
            if (!mergedItems[key]) mergedItems[key] = { ...item, branchName, quantity: 0 };
            mergedItems[key].quantity += item.quantity;
        });
    }

    const sortedBySupplier = Object.values(mergedItems).reduce((acc, item) => {
        const supplier = allSuppliers.find(s => s.id === item.supplier)?.name || 'Uncategorized';
        if (!acc[supplier]) acc[supplier] = {};
        if (!acc[supplier][item.branchName]) acc[supplier][item.branchName] = [];
        acc[supplier][item.branchName].push(item);
        return acc;
    }, {});

    const container = document.getElementById('supplier-list-container');
    let html = `
        <div class="flex flex-col sm:flex-row gap-2 mb-6">
            <button id="mark-processed-btn" class="flex-grow bg-yellow-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-600">Mark Selected as Processed</button>
            <button id="copy-all-lists-btn" class="bg-gray-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-900 flex items-center justify-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 4h6m-6 4h6m-6 4h6"></path></svg>
                Copy All
            </button>
        </div>`;

    for (const supplier in sortedBySupplier) {
        const sanitizedSupplier = supplier.replace(/"/g, '&quot;');
        html += `
            <div class="supplier-block mb-4 p-4 bg-white rounded border shadow-sm" data-supplier-name="${sanitizedSupplier}">
                <div class="flex justify-between items-center border-b pb-2 mb-3">
                    <h4 class="text-xl font-bold text-gray-800">${supplier}</h4>
                    <button class="copy-supplier-list-btn text-gray-500 hover:text-blue-600 p-1 rounded hover:bg-gray-100" title="Copy this list">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    </button>
                </div>`;

        for (const branch in sortedBySupplier[supplier]) {
            html += `<h5 class="font-semibold text-blue-700 mt-2 mb-1 flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ${branch}</h5>`;
            html += `<ul class="space-y-1 font-mono text-sm text-gray-700 supplier-items-list mb-3 pl-2 border-l-2 border-blue-200">`;

            sortedBySupplier[supplier][branch].sort((a, b) => (a.productRef || '').localeCompare(b.productRef || '')).forEach(item => {
                html += `<li data-raw-text="${item.productRef || 'NO-REF'} - ${item[`productName_${currentLang}`] || item.productName}: ${item.quantity} ${item[`packaging_${currentLang}`] || item.packaging || 'unit'}(s)">
                            <span class="font-bold text-blue-600">${item.productRef || 'NO-REF'}</span> - ${item[`productName_${currentLang}`] || item.productName}: <span class="font-bold bg-gray-100 px-1 rounded">${item.quantity}</span> ${item[`packaging_${currentLang}`] || item.packaging || 'unit'}(s)
                        </li>`;
            });
            html += `</ul>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
    container.classList.remove('hidden');

    container.dataset.selectedDataMap = JSON.stringify(selectedData);
}

function renderOrderHistory() {
    const tbody = document.getElementById('order-history-table-body');
    const branchContext = currentUserRole === 'admin' ? currentUserBranchId : activeBranchContext;
    let filteredHistory = processedOrders.filter(o => branchContext === 'ALL' || o.branchId === branchContext);

    // Application des filtres de Date
    const startInput = document.getElementById('history-start-date').value;
    const endInput = document.getElementById('history-end-date').value;

    if (startInput) {
        const start = new Date(startInput).setHours(0, 0, 0, 0);
        filteredHistory = filteredHistory.filter(o => o.createdAt && o.createdAt.toMillis() >= start);
    }
    if (endInput) {
        const end = new Date(endInput).setHours(23, 59, 59, 999);
        filteredHistory = filteredHistory.filter(o => o.createdAt && o.createdAt.toMillis() <= end);
    }

    // Application du Tri
    filteredHistory.sort((a, b) => {
        let valA, valB;
        if (historySortBy === 'date') { valA = a.createdAt?.toMillis() || 0; valB = b.createdAt?.toMillis() || 0; }
        else if (historySortBy === 'branch') { valA = allBranches.find(br => br.id === a.branchId)?.name || ''; valB = allBranches.find(br => br.id === b.branchId)?.name || ''; }
        else if (historySortBy === 'department') { valA = a.departmentName || ''; valB = b.departmentName || ''; }
        else if (historySortBy === 'user') { valA = allStaff.find(s => s.id === a.userId)?.name || ''; valB = allStaff.find(s => s.id === b.userId)?.name || ''; }
        else if (historySortBy === 'status') { valA = a.status || ''; valB = b.status || ''; }

        if (typeof valA === 'string') return historySortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        return historySortDesc ? valB - valA : valA - valB;
    });

    document.getElementById('mass-delete-history-btn').classList.add('hidden');
    document.getElementById('select-all-history').checked = false;

    tbody.innerHTML = '';
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const paginated = filteredHistory.slice((historyCurrentPage - 1) * itemsPerPage, historyCurrentPage * itemsPerPage);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No order history found.</td></tr>`;
    } else {
        paginated.forEach(order => {
            const user = allStaff.find(s => s.id === order.userId);
            const branch = allBranches.find(b => b.id === order.branchId);
            const itemsHtml = order.items.map(item => `<li class="text-gray-600">${item.quantity} x ${item[`productName_${currentLang}`] || item.productName}</li>`).join('');
            const orderDate = formatDate(order.createdAt.toDate()) || 'N/A';
            const statusClass = order.status === 'Cancelled' ? 'text-red-500' : 'text-gray-500';

            tbody.insertAdjacentHTML('beforeend', `
                <tr class="border-b order-history-row hover:bg-gray-50">
                    <td class="table-cell" onclick="event.stopPropagation()"><input type="checkbox" class="history-checkbox w-4 h-4 rounded text-blue-600 cursor-pointer" data-id="${order.id}"></td>
                    <td class="table-cell cursor-pointer toggle-details">${orderDate}</td>
                    <td class="table-cell cursor-pointer toggle-details text-gray-500 text-xs">${branch ? branch.name : 'N/A'}</td>
                    <td class="table-cell cursor-pointer toggle-details">${order.departmentName}</td>
                    <td class="table-cell cursor-pointer toggle-details">${user?.name || 'Unknown'}</td>
                    <td class="table-cell cursor-pointer toggle-details ${statusClass}">${order.status} ${order.splitFrom ? '(Split)' : ''}</td>
                </tr>
                <tr class="bg-gray-50 hidden">
                    <td colspan="6" class="p-4"><ul class="list-disc list-inside">${itemsHtml}</ul></td>
                </tr>
            `);
        });
    }
    renderPagination(document.getElementById('history-pagination-controls'), totalPages, historyCurrentPage, (p) => { historyCurrentPage = p; renderOrderHistory(); });
}

function handleCheckboxes() {
    const massDeleteBtn = document.getElementById('mass-delete-history-btn');
    const checkedBoxes = document.querySelectorAll('.history-checkbox:checked');
    if (checkedBoxes.length > 0) {
        massDeleteBtn.classList.remove('hidden');
        massDeleteBtn.querySelector('span').textContent = `${translations[currentLang].delete_selected || 'Delete'} (${checkedBoxes.length})`;
    } else {
        massDeleteBtn.classList.add('hidden');
    }
}

// --- Injection Manuelle & Remplacement ---
function setupSearchInputs() {
    const modal = document.getElementById('admin-add-order-modal');
    const staffSelect = document.getElementById('admin-order-staff-select');
    const deptDisplay = document.getElementById('admin-order-dept-display');
    const deptIdInput = document.getElementById('admin-order-dept-id');
    const searchInput = document.getElementById('admin-order-product-search');
    const resultsDiv = document.getElementById('admin-order-product-results');
    const idInput = document.getElementById('admin-order-product-id');

    document.getElementById('admin-inject-item-btn').addEventListener('click', () => {
        const branchContext = currentUserRole === 'admin' ? currentUserBranchId : activeBranchContext;
        staffSelect.innerHTML = '<option value="">Select Staff</option>';
        allStaff.filter(s => branchContext === 'ALL' || s.branchId === branchContext).forEach(s => {
            staffSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
        document.getElementById('admin-direct-order-form').reset();
        deptDisplay.value = ''; deptIdInput.value = ''; resultsDiv.classList.add('hidden');
        modal.classList.replace('hidden', 'flex');
    });

    staffSelect.addEventListener('change', () => {
        const staff = allStaff.find(s => s.id === staffSelect.value);
        if (staff && staff.departmentId) {
            const dept = allDepartments.find(d => d.id === staff.departmentId);
            if (dept) { deptDisplay.value = dept[`name_${currentLang}`] || dept.name_en; deptIdInput.value = dept.id; }
        } else {
            deptDisplay.value = ''; deptIdInput.value = '';
        }
    });

    // Fonction d'aide pour uniformiser l'affichage des résultats (Inactifs & Fournisseur)
    const renderSearchResult = (p, container, onClickCallback) => {
        const div = document.createElement('div');
        const supplierName = allSuppliers.find(s => s.id === p.supplier)?.name || 'N/A';
        const inactiveStyling = !p.isActive ? 'text-gray-400 bg-gray-50' : 'text-gray-800 hover:bg-blue-50';
        const inactiveBadge = !p.isActive ? '<span class="text-xs text-red-500 font-bold ml-2 border border-red-500 px-1 rounded">(INACTIVE)</span>' : '';

        div.className = `p-2 cursor-pointer border-b text-sm flex justify-between items-center ${inactiveStyling}`;
        div.innerHTML = `
            <div class="flex-grow flex items-center">
                <span class="font-medium truncate">[${p.product_reference || 'REF'}] ${p[`name_${currentLang}`] || p.name_en}</span>
                ${inactiveBadge}
            </div>
            <div class="text-xs text-gray-500 italic ml-4 text-right whitespace-nowrap min-w-[80px]">${supplierName}</div>
        `;
        div.onclick = onClickCallback;
        container.appendChild(div);
    };

    // Recherche Injection
    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        resultsDiv.innerHTML = '';
        if (term.length < 2) { resultsDiv.classList.add('hidden'); return; }

        const matches = allProducts.filter(p => ((p.name_en || '').toLowerCase().includes(term) || (p.product_reference || '').toLowerCase().includes(term)));
        matches.forEach(p => {
            renderSearchResult(p, resultsDiv, () => {
                searchInput.value = `[${p.product_reference || 'REF'}] ${p[`name_${currentLang}`] || p.name_en}`;
                idInput.value = p.id;
                resultsDiv.classList.add('hidden');
            });
        });
        resultsDiv.classList.remove('hidden');
    });

    document.getElementById('admin-direct-order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const product = allProducts.find(p => p.id === idInput.value);
        const staff = allStaff.find(s => s.id === staffSelect.value);
        const qty = parseInt(document.getElementById('admin-order-qty').value, 10);

        if (!product || !staff || !deptIdInput.value) return showToast("Please select a valid product and staff", true);

        const orderData = {
            branchId: staff.branchId || currentUserBranchId,
            departmentId: deptIdInput.value, departmentName: deptDisplay.value,
            status: "Pending", notes: "Manual injection", userId: staff.id, createdAt: serverTimestamp(),
            items: [{
                productId: product.id, productName: product.name_en, productName_th: product.name_th,
                packaging: product.packaging_en, packaging_th: product.packaging_th, quantity: qty,
                supplier: product.supplier, productRef: product.product_reference || ''
            }]
        };

        try {
            await addDoc(collection(db, "orders"), orderData);
            showToast("Line added successfully!");
            modal.classList.replace('flex', 'hidden');
        } catch (err) { showToast("Error adding line", true); }
    });

    // Recherche Remplacement
    const replaceInput = document.getElementById('replace-product-search');
    const replaceResults = document.getElementById('replace-product-results');

    replaceInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        replaceResults.innerHTML = '';
        if (term.length < 2) { replaceResults.classList.add('hidden'); return; }

        const matches = allProducts.filter(p => ((p.name_en || '').toLowerCase().includes(term) || (p.product_reference || '').toLowerCase().includes(term)));
        matches.forEach(p => {
            renderSearchResult(p, replaceResults, () => {
                const itemIndex = currentEditingOrder.items.findIndex(i => i.productId === replaceTargetProductId);
                if (itemIndex !== -1) {
                    currentEditingOrder.items[itemIndex] = {
                        productId: p.id, productName: p.name_en, productName_th: p.name_th,
                        packaging: p.packaging_en, packaging_th: p.packaging_th,
                        quantity: currentEditingOrder.items[itemIndex].quantity,
                        supplier: p.supplier, productRef: p.product_reference || ''
                    };
                }
                document.getElementById('replace-product-modal').classList.replace('flex', 'hidden');
                renderEditOrderModal();
            });
        });
        replaceResults.classList.remove('hidden');
    });
}

// --- Order Edit / Copy ---
function renderEditOrderModal() {
    const container = document.getElementById('edit-order-items-container');
    container.innerHTML = '';
    if (currentEditingOrder.items.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-center">This order is empty.</p>`;
    } else {
        currentEditingOrder.items.forEach(item => {
            container.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between py-3 border-b last:border-b-0">
                    <div>
                        <p class="font-semibold">${item[`productName_${currentLang}`] || item.productName}</p>
                        <p class="text-sm text-gray-500">Per ${item[`packaging_${currentLang}`] || item.packaging}</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button data-id="${item.productId}" class="quantity-btn decrease-quantity bg-gray-200 h-7 w-7 rounded-full font-bold text-lg flex items-center justify-center">-</button>
                        <input type="number" data-id="${item.productId}" class="quantity-input shadow-sm border rounded w-16 text-center py-1" value="${item.quantity}" min="0">
                        <button data-id="${item.productId}" class="quantity-btn increase-quantity bg-gray-200 h-7 w-7 rounded-full font-bold text-lg flex items-center justify-center">+</button>
                        <button data-id="${item.productId}" class="replace-item-btn text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded ml-2">${translations[currentLang].replace || 'Replace'}</button>
                        <button data-id="${item.productId}" class="remove-item text-red-500 hover:text-red-700 ml-2">X</button>
                    </div>
                </div>`);
        });
    }
}

async function markOrdersAsProcessed() {
    if (!confirm("Traiter uniquement les articles sélectionnés ? (Les articles non cochés resteront en 'Pending')")) return;
    const selectedData = JSON.parse(document.getElementById('supplier-list-container').dataset.selectedDataMap || "{}");
    if (Object.keys(selectedData).length === 0) return;

    const batch = writeBatch(db);
    for (const orderId in selectedData) {
        const selectedProductIds = selectedData[orderId];
        const originalOrder = pendingOrders.find(o => o.id === orderId);
        if (!originalOrder) continue;

        const selectedItems = originalOrder.items.filter(i => selectedProductIds.includes(i.productId));
        const remainingItems = originalOrder.items.filter(i => !selectedProductIds.includes(i.productId));

        if (remainingItems.length === 0) {
            batch.update(doc(db, "orders", orderId), { status: "Processed" });
        } else {
            batch.update(doc(db, "orders", orderId), { items: remainingItems });
            const newOrderRef = doc(collection(db, "orders"));
            const newOrderData = { ...originalOrder, items: selectedItems, status: "Processed", splitFrom: orderId };
            delete newOrderData.id;
            batch.set(newOrderRef, newOrderData);
        }
    }

    try {
        await batch.commit();
        showToast('Items processed successfully.');
        document.getElementById('supplier-list-container').classList.add('hidden');
    } catch (e) {
        showToast('Error updating orders.', true);
    }
}

// --- Listeners ---
function setupEventListeners() {
    document.getElementById('global-branch-context-select')?.addEventListener('change', (e) => {
        setActiveBranchContext(e.target.value);
        renderPendingOrders(); renderOrderHistory();
        document.getElementById('close-replace-modal')?.addEventListener('click', () => {
            document.getElementById('replace-product-modal').classList.replace('flex', 'hidden');
        });
    });

    document.querySelectorAll('.sort-header').forEach(th => {
        th.addEventListener('click', (e) => {
            const sortType = e.currentTarget.dataset.sort;
            if (historySortBy === sortType) historySortDesc = !historySortDesc;
            else { historySortBy = sortType; historySortDesc = false; }
            renderOrderHistory();
        });
    });

    const startFilter = document.getElementById('history-start-date');
    const endFilter = document.getElementById('history-end-date');
    [startFilter, endFilter].forEach(el => el.addEventListener('change', () => { historyCurrentPage = 1; renderOrderHistory(); }));
    document.getElementById('clear-history-dates').addEventListener('click', () => {
        startFilter.value = ''; endFilter.value = ''; historyCurrentPage = 1; renderOrderHistory();
    });

    document.getElementById('select-all-history').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.history-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        handleCheckboxes();
    });
    document.getElementById('order-history-table-body').addEventListener('change', (e) => {
        if (e.target.classList.contains('history-checkbox')) handleCheckboxes();
    });
    document.getElementById('mass-delete-history-btn').addEventListener('click', async () => {
        const checked = Array.from(document.querySelectorAll('.history-checkbox:checked'));
        if (checked.length === 0) return;
        if (confirm(`Permanently delete ${checked.length} orders?`)) {
            const batch = writeBatch(db);
            checked.forEach(cb => batch.delete(doc(db, "orders", cb.dataset.id)));
            await batch.commit(); showToast("Orders deleted."); renderOrderHistory();
        }
    });

    document.getElementById('generate-list-btn').addEventListener('click', generateSupplierList);

    document.getElementById('supplier-list-container').addEventListener('click', (e) => {
        if (e.target.id === 'mark-processed-btn') return markOrdersAsProcessed();

        const copyBtn = e.target.closest('.copy-supplier-list-btn');
        if (copyBtn) {
            const block = copyBtn.closest('.supplier-block');
            const branchHeaders = Array.from(block.querySelectorAll('h5'));
            let textToCopy = `=== ${block.dataset.supplierName} ===\n\n`;
            branchHeaders.forEach(h5 => {
                textToCopy += `[${h5.textContent.trim()}]\n`;
                const items = Array.from(h5.nextElementSibling.querySelectorAll('li')).map(li => li.dataset.rawText);
                textToCopy += items.join('\n') + `\n\n`;
            });
            navigator.clipboard.writeText(textToCopy.trim()).then(() => showToast(`Copied!`));
            return;
        }

        if (e.target.closest('#copy-all-lists-btn')) {
            let fullText = "";
            document.querySelectorAll('.supplier-block').forEach(block => {
                fullText += `=== ${block.dataset.supplierName} ===\n\n`;
                Array.from(block.querySelectorAll('h5')).forEach(h5 => {
                    fullText += `[${h5.textContent.trim()}]\n`;
                    fullText += Array.from(h5.nextElementSibling.querySelectorAll('li')).map(li => li.dataset.rawText).join('\n') + `\n\n`;
                });
            });
            navigator.clipboard.writeText(fullText.trim()).then(() => showToast("All Copied!"));
        }
    });

    document.getElementById('pending-orders-list').addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('.cancel-order-btn');
        const deleteBtn = e.target.closest('.permanent-delete-order-btn');
        const editBtn = e.target.closest('.edit-order-btn');

        if (cancelBtn && confirm('Cancel this order?')) updateDoc(doc(db, "orders", cancelBtn.dataset.id), { status: "Cancelled" });
        if (deleteBtn && confirm('PERMANENTLY delete this order?')) deleteDoc(doc(db, "orders", deleteBtn.dataset.id));
        if (editBtn) {
            const order = pendingOrders.find(o => o.id === editBtn.dataset.id);
            if (!order) return;
            currentEditingOrder = { id: order.id, items: JSON.parse(JSON.stringify(order.items)) };
            renderEditOrderModal();
            document.getElementById('edit-order-modal').classList.replace('hidden', 'flex');
        }
    });

    document.getElementById('order-history-table-body').addEventListener('click', (e) => {
        const toggleCell = e.target.closest('.toggle-details');
        if (toggleCell) toggleCell.closest('.order-history-row').nextElementSibling.classList.toggle('hidden');
    });

    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => {
        e.target.closest('.fixed.inset-0').classList.replace('flex', 'hidden');
    }));

    document.getElementById('edit-order-items-container').addEventListener('click', (e) => {
        const button = e.target.closest('.quantity-btn, .remove-item, .replace-item-btn');
        if (!button) return;
        const id = button.dataset.id;

        if (button.classList.contains('replace-item-btn')) {
            replaceTargetProductId = id;
            document.getElementById('replace-product-search').value = '';
            document.getElementById('replace-product-results').classList.add('hidden');
            document.getElementById('replace-product-modal').classList.replace('hidden', 'flex');
            return;
        }

        const item = currentEditingOrder.items.find(i => i.productId === id);
        if (button.classList.contains('increase-quantity')) item.quantity++;
        else if (button.classList.contains('decrease-quantity')) { if (item.quantity > 1) item.quantity--; else currentEditingOrder.items = currentEditingOrder.items.filter(i => i.productId !== id); }
        else if (button.classList.contains('remove-item')) currentEditingOrder.items = currentEditingOrder.items.filter(i => i.productId !== id);
        renderEditOrderModal();
    });

    document.getElementById('update-order-btn').addEventListener('click', async () => {
        if (!currentEditingOrder.id) return;
        if (currentEditingOrder.items.length === 0) {
            if (confirm('Delete empty order?')) await deleteDoc(doc(db, "orders", currentEditingOrder.id));
        } else {
            await updateDoc(doc(db, "orders", currentEditingOrder.id), { items: currentEditingOrder.items });
        }
        document.getElementById('edit-order-modal').classList.replace('flex', 'hidden');
        showToast('Order updated!');
    });

    setupSearchInputs();
}

init();