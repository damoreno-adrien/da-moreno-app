import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, writeBatch, addDoc, serverTimestamp, limit, getDocs, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../../js/config.js";
import { initAuth, currentUserRole, currentUserAccessibleBranches, currentUserBranchId, activeBranchContext, setActiveBranchContext, setupLogout, currentUser } from "../../js/auth.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "../../js/i18n.js";
import { showToast, setupMobileMenu, formatDate } from "../../js/ui.js";

let pendingOrders = [], purchaseOrders = [], allStaff = [], allDepartments = [], allSuppliers = [], allProducts = [], allBranches = [];
let currentEditingOrder = { id: null, items: [] };
let replaceTargetProductId = null; 

function init() {
    setupLangSwitcher(() => triggerRenders());
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
        fetchPurchaseOrders();
        setupEventListeners();
    });
}

function triggerRenders() {
    if (pendingOrders.length >= 0 && allStaff.length > 0 && allBranches.length > 0) renderPendingOrders();
    if (purchaseOrders.length >= 0 && allStaff.length > 0 && allBranches.length > 0) renderOrderHistory();
}

function fetchAllBranches() {
    onSnapshot(collection(db, "branches"), snap => {
        allBranches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const branchFilter = document.getElementById('history-branch-filter');
        if (branchFilter) {
            branchFilter.innerHTML = '<option value="">All Branches</option>';
            allBranches.forEach(b => {
                if (currentUserRole === 'superadmin' || currentUserAccessibleBranches.includes(b.id)) {
                    branchFilter.innerHTML += `<option value="${b.id}">${b.name}</option>`;
                }
            });
        }
        triggerRenders();
    });
}
function fetchAllDepartments() { 
    onSnapshot(collection(db, "departments"), snap => {
        allDepartments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const deptFilter = document.getElementById('history-dept-filter');
        if (deptFilter) {
            deptFilter.innerHTML = '<option value="">All Departments</option>';
            allDepartments.forEach(d => deptFilter.innerHTML += `<option value="${d.id}">${d.name_en}</option>`);
        }
        triggerRenders();
    }); 
}
function fetchAllStaff() { onSnapshot(collection(db, "users"), snap => { allStaff = snap.docs.map(d => ({ id: d.id, ...d.data() })); triggerRenders(); }); }
function fetchAllSuppliers() { onSnapshot(collection(db, "suppliers"), snap => { allSuppliers = snap.docs.map(d => ({ id: d.id, ...d.data() })); triggerRenders(); }); }
function fetchAllProducts() { onSnapshot(collection(db, "products"), snap => { allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() })); triggerRenders(); }); }

function fetchPendingOrders() {
    onSnapshot(query(collection(db, "orders"), where("status", "==", "Pending")), snap => {
        pendingOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('orders-loading')?.classList.add('hidden');
        triggerRenders();
    });
}

function fetchPurchaseOrders() {
    const q = query(collection(db, "purchase_orders"), limit(400));
    onSnapshot(q, snap => {
        purchaseOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('history-loading')?.classList.add('hidden');
        triggerRenders();
    });
}

function renderPendingOrders() {
    const list = document.getElementById('pending-orders-list');
    if(!list) return;
    const branchContext = currentUserRole === 'admin' ? currentUserBranchId : activeBranchContext;
    const filteredOrders = pendingOrders.filter(o => branchContext === 'ALL' || o.branchId === branchContext);

    if (filteredOrders.length === 0) {
        list.innerHTML = `<p class="text-gray-500 p-4 border rounded bg-gray-50 text-center">${translations[currentLang].pending_orders?.toLowerCase() === 'คำสั่งซื้อที่รอดำเนินการ' ? 'ไม่มีคำสั่งซื้อที่รอดำเนินการ' : 'No pending orders.'}</p>`;
        document.getElementById('generate-list-btn').disabled = true;
        return;
    }
    document.getElementById('generate-list-btn').disabled = false;

    let html = `
    <div class="overflow-x-auto rounded-lg border">
        <table class="min-w-full bg-white">
            <thead class="bg-gray-100 border-b">
                <tr>
                    <th class="p-3 w-8 text-center"><input type="checkbox" id="select-all-pending" class="w-4 h-4 rounded text-blue-600 cursor-pointer" checked></th>
                    <th class="p-3 text-left text-xs font-bold text-gray-600 uppercase">Date</th>
                    <th class="p-3 text-left text-xs font-bold text-gray-600 uppercase">Branch</th>
                    <th class="p-3 text-left text-xs font-bold text-gray-600 uppercase">Dept</th>
                    <th class="p-3 text-left text-xs font-bold text-gray-600 uppercase">Staff</th>
                    <th class="p-3 text-center text-xs font-bold text-gray-600 uppercase">Items</th>
                </tr>
            </thead>
            <tbody>
    `;

    filteredOrders.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).forEach(order => {
        const branchName = allBranches.find(b => b.id === order.branchId)?.name || 'N/A';
        const deptName = order[`departmentName_${currentLang}`] || order.departmentName || 'N/A';
        const userName = allStaff.find(s => s.id === order.userId)?.name || 'N/A';
        const orderDate = order.createdAt ? formatDate(order.createdAt.toDate()) : 'N/A';
        const nbItems = order.items.length;
        
        const itemsHtml = order.items.map(item => `
            <li class="flex items-center gap-3 mb-2 p-1 hover:bg-gray-50 rounded">
                <input type="checkbox" data-order-id="${order.id}" data-product-id="${item.productId}" class="item-select-checkbox w-4 h-4 text-blue-600 cursor-pointer" checked>
                <span class="text-gray-800 text-sm"><span class="font-bold bg-blue-50 px-1 rounded text-blue-700">${item.quantity}</span> x ${item[`productName_${currentLang}`] || item.productName}</span>
            </li>
        `).join('');

        let reassignBtnHtml = '';
        if (currentUserRole === 'superadmin') {
            reassignBtnHtml = `<button data-id="${order.id}" class="reassign-order-btn text-xs bg-purple-100 text-purple-700 px-4 py-2 rounded shadow-sm hover:bg-purple-200 font-bold" data-key="reassign_order">Reassign</button>`;
        }

        html += `
            <tr class="border-b hover:bg-gray-50 cursor-pointer pending-order-row transition-colors">
                <td class="p-3 text-center" onclick="event.stopPropagation()"><input type="checkbox" class="pending-master-checkbox w-4 h-4 rounded text-blue-600 cursor-pointer" checked></td>
                <td class="p-3 text-sm text-gray-700 font-medium toggle-pending-details">${orderDate}</td>
                <td class="p-3 text-sm text-gray-700 font-bold toggle-pending-details">${branchName}</td>
                <td class="p-3 text-sm text-gray-600 toggle-pending-details">${deptName}</td>
                <td class="p-3 text-sm text-gray-600 toggle-pending-details">${userName}</td>
                <td class="p-3 text-sm text-gray-600 toggle-pending-details text-center font-bold bg-gray-50 rounded">${nbItems}</td>
            </tr>
            <tr class="hidden bg-slate-50 border-b-2 border-blue-200">
                <td colspan="6" class="p-4">
                    <div class="ml-4 border-l-2 border-blue-400 pl-4">
                        <ul class="mb-3">${itemsHtml}</ul>
                        ${order.notes ? `<p class="text-sm text-gray-600 italic mb-4 bg-yellow-50 p-2 rounded border border-yellow-200"><strong>Note:</strong> ${order.notes}</p>` : ''}
                        <div class="flex gap-2">
                            <button data-id="${order.id}" class="edit-order-btn text-xs bg-blue-100 text-blue-700 px-4 py-2 rounded shadow-sm hover:bg-blue-200 font-bold">Edit</button>
                            ${reassignBtnHtml}
                            <button data-id="${order.id}" class="cancel-order-btn text-xs bg-orange-100 text-orange-700 px-4 py-2 rounded shadow-sm hover:bg-orange-200 font-bold">Cancel</button>
                            <button data-id="${order.id}" class="permanent-delete-order-btn text-xs bg-red-600 text-white px-4 py-2 rounded shadow-sm hover:bg-red-700 font-bold ml-auto flex items-center gap-1">Delete Permanently</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    list.innerHTML = html;
}

function generateSupplierList() {
    const checkedCheckboxes = Array.from(document.querySelectorAll('.item-select-checkbox:checked'));
    if (checkedCheckboxes.length === 0) return alert(translations[currentLang].alert_select_item || "Please select at least one item.");

    const selectedData = {};
    checkedCheckboxes.forEach(cb => {
        if (!selectedData[cb.dataset.orderId]) selectedData[cb.dataset.orderId] = [];
        selectedData[cb.dataset.orderId].push(cb.dataset.productId);
    });

    const mergedItems = {};
    for (const orderId in selectedData) {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) continue;
        const branchObj = allBranches.find(b => b.id === order.branchId);
        const branchFormattedName = branchObj ? `${branchObj.name} - ${branchObj.companyName || 'No Company Name'}` : 'Unknown Branch';

        order.items.filter(i => selectedData[orderId].includes(i.productId)).forEach(item => {
            const key = item.productId + '_' + order.branchId;
            if (!mergedItems[key]) {
                mergedItems[key] = { 
                    ...item, branchId: order.branchId, branchFormattedName, quantity: 0, orderIds: [] 
                };
            }
            mergedItems[key].quantity += item.quantity;
            if(!mergedItems[key].orderIds.includes(order.id)) mergedItems[key].orderIds.push(order.id);
        });
    }

    const sortedByBranch = Object.values(mergedItems).reduce((acc, item) => {
        const supplier = allSuppliers.find(s => s.id === item.supplier);
        const supplierName = supplier ? supplier.name : 'Uncategorized';
        const supplierId = supplier ? supplier.id : 'unknown';
        
        if (!acc[item.branchId]) acc[item.branchId] = { branchFormattedName: item.branchFormattedName, suppliers: {} };
        if (!acc[item.branchId].suppliers[supplierId]) acc[item.branchId].suppliers[supplierId] = { name: supplierName, items: [] };
        
        acc[item.branchId].suppliers[supplierId].items.push(item);
        return acc;
    }, {});

    const container = document.getElementById('supplier-list-container');
    let tabsHtml = `<div class="flex border-b mb-4 overflow-x-auto scrollbar-hide">`;
    let contentHtml = `<div id="tab-contents">`;
    let isFirst = true;

    for (const branchId in sortedByBranch) {
        const branchData = sortedByBranch[branchId];
        const activeTabClass = isFirst ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:bg-gray-50';
        const activeContentClass = isFirst ? '' : 'hidden';

        tabsHtml += `<button class="branch-tab-btn px-4 py-3 border-b-2 font-bold text-sm whitespace-nowrap ${activeTabClass}" data-target="tab-pane-${branchId}">${branchData.branchFormattedName.split('-')[0].trim()}</button>`;
        contentHtml += `<div id="tab-pane-${branchId}" class="branch-tab-pane ${activeContentClass}" data-branch-id="${branchId}" data-branch-full-name="${branchData.branchFormattedName.replace(/"/g, '&quot;')}">`;
        
        for (const supplierId in branchData.suppliers) {
            const suppData = branchData.suppliers[supplierId];
            
            // L'ajout du bouton "Copy this list" est ici
            contentHtml += `
                <div class="supplier-block mb-4 p-4 bg-white rounded border shadow-sm" data-supplier-id="${supplierId}" data-supplier-name="${suppData.name.replace(/"/g, '&quot;')}">
                    <div class="flex justify-between items-center border-b pb-2 mb-3">
                        <h4 class="text-xl font-bold text-gray-800">${suppData.name}</h4>
                        <button class="copy-supplier-list-btn text-gray-500 hover:text-blue-600 p-1 rounded hover:bg-gray-100" title="Copy this list">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        </button>
                    </div>
                    <ul class="space-y-2 font-mono text-sm text-gray-700 pl-2 border-l-2 border-blue-200">`;

            suppData.items.sort((a, b) => (a.productRef || '').localeCompare(b.productRef || '')).forEach(item => {
                contentHtml += `
                    <li class="flex items-center gap-2 hover:bg-gray-50 p-1 rounded transition-colors" data-raw-text="${item.productRef || 'NO-REF'} - ${item[`productName_${currentLang}`] || item.productName}: ${item.quantity} ${item[`packaging_${currentLang}`] || item.packaging || 'unit'}(s)">
                        <input type="checkbox" class="final-item-checkbox w-4 h-4 text-blue-600 rounded cursor-pointer" 
                            data-product-id="${item.productId}" data-product-name="${item.productName?.replace(/"/g, '&quot;') || ''}"
                            data-product-name-th="${item.productName_th?.replace(/"/g, '&quot;') || ''}" data-product-ref="${item.productRef?.replace(/"/g, '&quot;') || ''}"
                            data-packaging="${item.packaging?.replace(/"/g, '&quot;') || ''}" data-packaging-th="${item.packaging_th?.replace(/"/g, '&quot;') || ''}"
                            data-quantity="${item.quantity}" data-order-ids='${JSON.stringify(item.orderIds)}' checked>
                        <span><span class="font-bold text-blue-600">${item.productRef || 'NO-REF'}</span> - ${item[`productName_${currentLang}`] || item.productName}: <span class="font-bold bg-gray-100 px-1 rounded">${item.quantity}</span> ${item[`packaging_${currentLang}`] || item.packaging || 'unit'}(s)</span>
                    </li>`;
            });
            contentHtml += `</ul></div>`;
        }
        contentHtml += `</div>`;
        isFirst = false;
    }
    tabsHtml += `</div>`;

    container.innerHTML = tabsHtml + contentHtml + `
        <div class="flex flex-col sm:flex-row gap-2 mt-4">
            <button id="mark-processed-btn" class="flex-grow bg-yellow-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-600 shadow-sm" data-key="mark_tab_processed">Mark Checked Items in THIS Tab as Processed</button>
            <button id="copy-all-lists-btn" class="bg-gray-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-900 flex items-center justify-center gap-2 shadow-sm" data-key="copy_displayed_branch">Copy Displayed Branch</button>
        </div>`;
    
    // TRANSITION UX: Cache Pending, Montre Supplier List
    document.getElementById('pending-orders-wrapper').classList.add('hidden');
    document.getElementById('supplier-list-wrapper').classList.remove('hidden');
    showToast(translations[currentLang].list_generated || "List generated successfully!");
    setLanguage(currentLang);
}

async function markOrdersAsProcessed() {
    const activePane = document.querySelector('.branch-tab-pane:not(.hidden)');
    if (!activePane) return showToast(translations[currentLang].alert_no_branch || "No active branch selected.", true);

    const checkedFinal = activePane.querySelectorAll('.final-item-checkbox:checked');
    if (checkedFinal.length === 0) return alert(translations[currentLang].alert_select_item || "Please select at least one item.");
    if (!confirm(translations[currentLang].confirm_process_tab || "Process ONLY checked items in THIS tab?")) return;

    const batch = writeBatch(db);
    const activeBranchId = activePane.dataset.branchId;
    const affectedOrderIds = new Set();
    const processedProductIdsByOrder = {};

    checkedFinal.forEach(cb => {
        const pId = cb.dataset.productId;
        const oIds = JSON.parse(cb.dataset.orderIds);
        oIds.forEach(oId => {
            affectedOrderIds.add(oId);
            if (!processedProductIdsByOrder[oId]) processedProductIdsByOrder[oId] = [];
            processedProductIdsByOrder[oId].push(pId);
        });
    });

    const supplierBlocks = activePane.querySelectorAll('.supplier-block');
    
    supplierBlocks.forEach(block => {
        const supplierId = block.dataset.supplierId;
        const checkedBoxesInBlock = block.querySelectorAll('.final-item-checkbox:checked');
        if (checkedBoxesInBlock.length === 0) return;

        const consolidatedItems = Array.from(checkedBoxesInBlock).map(cb => {
            return {
                productId: cb.dataset.productId, productName: cb.dataset.productName || '',
                productName_th: cb.dataset.productNameTh || '', productRef: cb.dataset.productRef || '',
                packaging: cb.dataset.packaging || '', packaging_th: cb.dataset.packagingTh || '',
                quantity: parseInt(cb.dataset.quantity, 10), supplier: supplierId
            };
        });

        const newPoRef = doc(collection(db, "purchase_orders"));
        batch.set(newPoRef, {
            branchId: activeBranchId, status: "Processed", createdAt: serverTimestamp(),
            supplierId: supplierId, items: consolidatedItems
        });

        affectedOrderIds.forEach(orderId => {
            const originalOrder = pendingOrders.find(o => o.id === orderId);
            if (!originalOrder) return;
            
            const pIdsToRemove = processedProductIdsByOrder[orderId] || [];
            const itemsForThisSupplier = originalOrder.items.filter(i => pIdsToRemove.includes(i.productId) && i.supplier === supplierId);
            const remainingItems = originalOrder.items.filter(i => !pIdsToRemove.includes(i.productId));

            if (itemsForThisSupplier.length > 0) {
                if (remainingItems.length === 0) {
                    batch.update(doc(db, "orders", orderId), { status: "Processed", poId: newPoRef.id });
                } else {
                    batch.update(doc(db, "orders", orderId), { items: remainingItems });
                    const newChildRef = doc(collection(db, "orders"));
                    const newChildData = { ...originalOrder, items: itemsForThisSupplier, status: "Processed", splitFrom: orderId, poId: newPoRef.id };
                    delete newChildData.id;
                    batch.set(newChildRef, newChildData);
                }
            }
        });
    });

    try {
        await batch.commit();
        showToast('Purchase Orders generated successfully.');
        document.getElementById('supplier-list-wrapper').classList.add('hidden');
        document.getElementById('pending-orders-wrapper').classList.remove('hidden');
    } catch (e) { showToast('Error updating orders.', true); }
}

function renderOrderHistory() {
    const container = document.getElementById('grouped-history-container');
    if(!container) return;
    const branchContext = currentUserRole === 'admin' ? currentUserBranchId : activeBranchContext;
    let filteredHistory = purchaseOrders.filter(o => branchContext === 'ALL' || o.branchId === branchContext);

    const statusF = document.getElementById('history-status-filter')?.value;
    const branchF = document.getElementById('history-branch-filter')?.value;
    const startInput = document.getElementById('history-start-date')?.value;
    const endInput = document.getElementById('history-end-date')?.value;

    if (statusF) filteredHistory = filteredHistory.filter(o => o.status === statusF);
    if (branchF) filteredHistory = filteredHistory.filter(o => o.branchId === branchF);
    if (startInput) filteredHistory = filteredHistory.filter(o => o.createdAt && o.createdAt.toMillis() >= new Date(startInput).setHours(0,0,0,0));
    if (endInput) filteredHistory = filteredHistory.filter(o => o.createdAt && o.createdAt.toMillis() <= new Date(endInput).setHours(23,59,59,999));

    if (filteredHistory.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-center p-6 bg-gray-50 rounded border">No Purchase Orders found.</p>`;
        return;
    }

    const hierarchy = {};
    filteredHistory.forEach(po => {
        const dateStr = po.createdAt ? formatDate(po.createdAt.toDate()) : 'N/A';
        const branchName = allBranches.find(b => b.id === po.branchId)?.name || 'Unknown Branch';
        
        if(!hierarchy[dateStr]) hierarchy[dateStr] = {};
        if(!hierarchy[dateStr][branchName]) hierarchy[dateStr][branchName] = [];
        hierarchy[dateStr][branchName].push(po);
    });

    let html = '';
    const dates = Object.keys(hierarchy).sort((a,b) => new Date(b) - new Date(a));
    
    dates.forEach(dateStr => {
        html += `<div class="mb-6"><h4 class="text-lg font-extrabold text-gray-800 border-b-2 border-gray-800 pb-1 mb-3">📅 ${dateStr}</h4>`;
        Object.keys(hierarchy[dateStr]).sort().forEach(branch => {
            html += `<div class="ml-2 mb-4"><h5 class="font-bold text-blue-700 bg-blue-50 p-2 rounded mb-2 flex items-center gap-2">🏢 ${branch}</h5><div class="space-y-3 pl-3 border-l-2 border-gray-300">`;
            
            hierarchy[dateStr][branch].forEach(po => {
                const supplierName = allSuppliers.find(s => s.id === po.supplierId)?.name || 'Unknown Supplier';
                const itemsHtml = po.items.map(i => `${i.quantity}x ${i[`productName_${currentLang}`]||i.productName}`).join(', ');
                
                let statusBadge = '';
                if (po.status === 'Processed') statusBadge = 'bg-yellow-100 text-yellow-800';
                else if (po.status === 'Received') statusBadge = 'bg-blue-100 text-blue-800';
                else if (po.status === 'Paid') statusBadge = 'bg-green-100 text-green-800';

                let rollbackBtn = '';
                if (po.status === 'Processed' && (currentUserRole === 'superadmin' || currentUserRole === 'admin')) {
                    rollbackBtn = `<button data-poid="${po.id}" class="rollback-po-btn text-xs bg-red-100 text-red-700 px-3 py-1 rounded shadow-sm hover:bg-red-200 font-bold" data-key="rollback">Rollback to Pending</button>`;
                }

                html += `
                    <div class="bg-white p-4 rounded border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-md transition-shadow">
                        <div class="flex-1">
                            <p class="font-bold text-gray-800 text-lg">${supplierName}</p>
                            <p class="text-gray-500 text-xs font-bold uppercase mb-2" data-key="consolidated">Purchase Order</p>
                            <p class="text-gray-600 text-sm mt-1 leading-relaxed">${itemsHtml}</p>
                        </div>
                        <div class="flex flex-col items-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                            <span class="px-3 py-1 rounded text-xs font-bold uppercase ${statusBadge}">${po.status}</span>
                            ${rollbackBtn}
                            <span class="text-[10px] text-gray-400 font-mono mt-1">${po.id}</span>
                        </div>
                    </div>`;
            });
            html += `</div></div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
}

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
                        <button data-id="${item.productId}" class="replace-item-btn text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded ml-2" data-key="replace">Replace</button>
                        <button data-id="${item.productId}" class="remove-item text-red-500 hover:text-red-700 ml-2">&times;</button>
                    </div>
                </div>`);
        });
    }
}

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

function setupEventListeners() {
    window.addEventListener('branchContextChanged', (e) => {
        triggerRenders();
        document.getElementById('supplier-list-wrapper').classList.add('hidden');
        document.getElementById('pending-orders-wrapper').classList.remove('hidden');
    });

    document.getElementById('back-to-pending-btn')?.addEventListener('click', () => {
        document.getElementById('supplier-list-wrapper').classList.add('hidden');
        document.getElementById('pending-orders-wrapper').classList.remove('hidden');
    });

    ['history-status-filter', 'history-branch-filter', 'history-start-date', 'history-end-date'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderOrderHistory);
    });
    document.getElementById('clear-history-filters')?.addEventListener('click', () => {
        ['history-status-filter', 'history-branch-filter', 'history-start-date', 'history-end-date'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).value = '';
        });
        renderOrderHistory();
    });

    document.getElementById('generate-list-btn').addEventListener('click', generateSupplierList);

    document.getElementById('pending-orders-list').addEventListener('click', (e) => {
        const toggleCell = e.target.closest('.toggle-pending-details');
        if (toggleCell) toggleCell.closest('.pending-order-row').nextElementSibling.classList.toggle('hidden');

        if (e.target.id === 'select-all-pending') {
            const isChecked = e.target.checked;
            document.querySelectorAll('.pending-master-checkbox, .item-select-checkbox').forEach(cb => cb.checked = isChecked);
        }
        if (e.target.classList.contains('pending-master-checkbox')) {
            const isChecked = e.target.checked;
            const nextRow = e.target.closest('tr').nextElementSibling;
            if(nextRow) nextRow.querySelectorAll('.item-select-checkbox').forEach(cb => cb.checked = isChecked);
        }

        const cancelBtn = e.target.closest('.cancel-order-btn');
        const deleteBtn = e.target.closest('.permanent-delete-order-btn');
        const editBtn = e.target.closest('.edit-order-btn');
        const reassignBtn = e.target.closest('.reassign-order-btn');

        if (cancelBtn && confirm('Cancel this order?')) updateDoc(doc(db, "orders", cancelBtn.dataset.id), { status: "Cancelled" });
        if (deleteBtn && confirm('PERMANENTLY delete this order?')) deleteDoc(doc(db, "orders", deleteBtn.dataset.id));
        if (editBtn) {
            const order = pendingOrders.find(o => o.id === editBtn.dataset.id);
            if (!order) return;
            currentEditingOrder = { id: order.id, items: JSON.parse(JSON.stringify(order.items)) };
            renderEditOrderModal();
            document.getElementById('edit-order-modal').classList.replace('hidden', 'flex');
        }

        if (reassignBtn && currentUserRole === 'superadmin') {
            const orderId = reassignBtn.dataset.id;
            document.getElementById('reassign-order-id').value = orderId;
            const branchSelect = document.getElementById('reassign-branch');
            branchSelect.innerHTML = '<option value="">Select Branch</option>';
            allBranches.forEach(b => branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`);
            document.getElementById('reassign-staff').innerHTML = '<option value="">Select Branch First</option>';
            document.getElementById('reassign-modal').classList.replace('hidden', 'flex');
        }
    });

    document.getElementById('reassign-branch')?.addEventListener('change', (e) => {
        const branchId = e.target.value;
        const staffSelect = document.getElementById('reassign-staff');
        staffSelect.innerHTML = '<option value="">Select Staff</option>';
        allStaff.filter(s => s.branchId === branchId || (s.accessibleBranches && s.accessibleBranches.includes(branchId))).forEach(s => {
            staffSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    });

    document.getElementById('confirm-reassign-btn')?.addEventListener('click', async () => {
        const orderId = document.getElementById('reassign-order-id').value;
        const staffId = document.getElementById('reassign-staff').value;
        const branchId = document.getElementById('reassign-branch').value;
        if (!orderId || !staffId || !branchId) return;

        const staff = allStaff.find(s => s.id === staffId);
        const dept = allDepartments.find(d => d.id === staff.departmentId);

        await updateDoc(doc(db, "orders", orderId), {
            branchId: branchId,
            userId: staffId,
            departmentId: staff.departmentId,
            departmentName: dept ? (dept[`name_${currentLang}`] || dept.name_en) : 'Unknown'
        });
        showToast("Order reassigned successfully.");
        document.getElementById('reassign-modal').classList.replace('flex', 'hidden');
    });

    document.getElementById('supplier-list-wrapper').addEventListener('click', (e) => {
        if (e.target.id === 'mark-processed-btn') return markOrdersAsProcessed();
        
        if (e.target.classList.contains('branch-tab-btn')) {
            document.querySelectorAll('.branch-tab-btn').forEach(btn => {
                btn.classList.remove('border-blue-600', 'text-blue-600', 'bg-blue-50');
                btn.classList.add('border-transparent', 'text-gray-500');
            });
            document.querySelectorAll('.branch-tab-pane').forEach(pane => pane.classList.add('hidden'));
            
            e.target.classList.remove('border-transparent', 'text-gray-500');
            e.target.classList.add('border-blue-600', 'text-blue-600', 'bg-blue-50');
            document.getElementById(e.target.dataset.target).classList.remove('hidden');
            return;
        }

        // Bonton Copier Global
        if (e.target.closest('#copy-all-lists-btn')) {
            const activePane = document.querySelector('.branch-tab-pane:not(.hidden)');
            if (!activePane) return;
            const branchFullName = activePane.dataset.branchFullName;
            let fullText = "";
            activePane.querySelectorAll('.supplier-block').forEach(block => {
                const checkedItems = Array.from(block.querySelectorAll('.final-item-checkbox:checked')).map(cb => cb.closest('li').dataset.rawText);
                if(checkedItems.length > 0) {
                    fullText += `=== ${block.dataset.supplierName} ===\n\n[${branchFullName}]\n`;
                    fullText += checkedItems.join('\n') + `\n\n`;
                }
            });
            if(!fullText) return showToast(translations[currentLang].nothing_to_copy || "Nothing checked to copy.", true);
            navigator.clipboard.writeText(fullText.trim()).then(() => showToast(translations[currentLang].copied || "Copied!"));
            return;
        }
        
        // Bouton Copier Individuel
        const copyBtn = e.target.closest('.copy-supplier-list-btn');
        if (copyBtn) {
            const block = copyBtn.closest('.supplier-block');
            const supplierName = block.dataset.supplierName;
            const branchFullName = block.closest('.branch-tab-pane').dataset.branchFullName;
            let textToCopy = `=== ${supplierName} ===\n\n[${branchFullName}]\n`;
            const checkedItems = Array.from(block.querySelectorAll('.final-item-checkbox:checked')).map(cb => cb.closest('li').dataset.rawText);
            if(checkedItems.length > 0) {
                textToCopy += checkedItems.join('\n') + `\n`;
                navigator.clipboard.writeText(textToCopy.trim()).then(() => showToast(translations[currentLang].copied || "Copied!"));
            } else {
                showToast(translations[currentLang].nothing_to_copy || "Nothing checked to copy.", true);
            }
            return;
        }
    });

    document.getElementById('grouped-history-container')?.addEventListener('click', async (e) => {
        const rollbackBtn = e.target.closest('.rollback-po-btn');
        if (rollbackBtn) {
            if(!confirm(translations[currentLang].confirm_rollback || "Cancel Purchase Order? Linked requests will revert to Pending.")) return;
            
            const poId = rollbackBtn.dataset.poid;
            const batch = writeBatch(db);
            
            batch.delete(doc(db, "purchase_orders", poId));
            
            const childQ = query(collection(db, "orders"), where("poId", "==", poId));
            const childSnap = await getDocs(childQ);
            childSnap.forEach(childDoc => {
                batch.update(childDoc.ref, { status: "Pending", poId: deleteField() });
            });
            
            await batch.commit();
            showToast("Purchase Order cancelled. Orders restored.");
        }
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