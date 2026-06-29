import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "./config.js";
import { initAuth, currentUserRole, currentUserAccessibleBranches, currentUserPermissions } from "./auth.js";
import { setLanguage, setupLangSwitcher, currentLang } from "./i18n.js";
import { showToast, formatDate } from "./ui.js";

let expectedOrders = [];
let allSuppliers = [];
let orderToReceive = null;

function init() {
    initAuth(() => {
        setLanguage(currentLang);
        if (!currentUserPermissions.canReceive && currentUserRole !== 'superadmin' && currentUserRole !== 'admin') {
            document.getElementById('access-denied').classList.remove('hidden');
            return setTimeout(() => window.location.href = 'index.html', 2000);
        }
        document.getElementById('app').classList.remove('hidden');
        fetchAllSuppliers();
        fetchExpectedOrders();
        setupEventListeners();
    }, false);
}

function fetchAllSuppliers() {
    onSnapshot(collection(db, "suppliers"), snap => {
        allSuppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
}

function fetchExpectedOrders() {
    const q = query(collection(db, "purchase_orders"), where("status", "==", "Processed"));
    onSnapshot(q, snap => {
        expectedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(o => currentUserRole === 'superadmin' || currentUserAccessibleBranches.includes(o.branchId));
        renderExpectedOrders();
    });
}

function renderExpectedOrders() {
    const list = document.getElementById('deliveries-list');
    document.getElementById('loading-spinner').classList.add('hidden');

    if (expectedOrders.length === 0) {
        list.innerHTML = `<div class="p-6 bg-gray-50 text-center rounded border border-dashed"><p class="text-gray-500">No deliveries expected at the moment.</p></div>`;
        return;
    }

    let html = '';
    expectedOrders.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)).forEach(order => {
        const orderDate = order.createdAt ? formatDate(order.createdAt.toDate()) : 'Unknown';
        const supplierName = allSuppliers.find(s => s.id === order.supplierId)?.name || 'Unknown Supplier';
        const nbItems = order.items.reduce((sum, i) => sum + parseInt(i.quantity||0), 0);
        
        html += `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded shadow-sm hover:shadow-md transition-shadow">
                <div>
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">Ordered: ${orderDate}</span>
                    <h3 class="text-lg font-bold text-blue-800">${supplierName}</h3>
                    <p class="text-sm text-gray-600 mt-1">${order.items.length} unique products (Total: ${nbItems} items)</p>
                </div>
                <button data-id="${order.id}" class="open-receive-btn mt-3 sm:mt-0 bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 shadow-sm transition-colors">
                    Point & Receive
                </button>
            </div>
        `;
    });
    list.innerHTML = html;
}

function calculateDueDate(paymentTerms) {
    const today = new Date();
    if (paymentTerms === 'POD' || !paymentTerms) return today.toISOString().split('T')[0];
    const days = parseInt(paymentTerms, 10);
    if (!isNaN(days)) today.setDate(today.getDate() + days);
    return today.toISOString().split('T')[0];
}

function openReceiveModal(orderId) {
    orderToReceive = expectedOrders.find(o => o.id === orderId);
    if (!orderToReceive) return;

    const container = document.getElementById('receive-items-container');
    let itemsHtml = '';
    
    orderToReceive.items.forEach(item => {
        itemsHtml += `
            <div class="flex items-center justify-between p-3 bg-gray-50 border rounded">
                <div class="flex-1">
                    <p class="font-bold text-gray-800 text-sm">${item[`productName_${currentLang}`] || item.productName}</p>
                    <p class="text-xs text-gray-500">Expected: ${item.quantity} ${item[`packaging_${currentLang}`] || item.packaging}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <label class="text-xs font-bold text-gray-600">Actually Received:</label>
                    <input type="number" min="0" class="receive-qty-input w-20 p-1 text-center border-2 border-blue-400 rounded font-bold" data-product-id="${item.productId}" value="${item.quantity}">
                </div>
            </div>`;
    });
    container.innerHTML = itemsHtml;

    const supplier = allSuppliers.find(s => s.id === orderToReceive.supplierId);
    const terms = supplier?.paymentTerms || 'POD';
    document.getElementById('payment-terms-hint').textContent = `Supplier Default Terms: ${terms === 'POD' ? 'Pay On Delivery' : terms + ' Days'}`;
    document.getElementById('payment-due-date').value = calculateDueDate(terms);
    document.getElementById('payment-method').value = terms === 'POD' ? 'Cash' : 'Bank Transfer';
    document.getElementById('invoice-total').value = '';
    document.getElementById('invoice-ref').value = '';

    document.getElementById('receive-modal').classList.replace('hidden', 'flex');
}

async function confirmReception() {
    if (!orderToReceive) return;
    const totalInput = document.getElementById('invoice-total');
    if (!totalInput.checkValidity()) { totalInput.reportValidity(); return; }

    const updatedItems = orderToReceive.items.map(item => {
        const input = document.querySelector(`.receive-qty-input[data-product-id="${item.productId}"]`);
        return { ...item, receivedQuantity: input ? parseInt(input.value, 10) : item.quantity };
    });

    const financials = {
        totalAmount: parseFloat(totalInput.value),
        invoiceRef: document.getElementById('invoice-ref').value || '',
        paymentMethod: document.getElementById('payment-method').value,
        paymentDueDate: document.getElementById('payment-due-date').value
    };

    try {
        const batch = writeBatch(db);
        // 1. Maj du PO Parent
        batch.update(doc(db, "purchase_orders", orderToReceive.id), {
            status: "Received", items: updatedItems, financials: financials
        });
        
        // 2. Maj des Enfants (Pour que le Staff voit que sa commande est arrivée)
        const childQ = query(collection(db, "orders"), where("poId", "==", orderToReceive.id));
        const childSnap = await getDocs(childQ);
        childSnap.forEach(childDoc => batch.update(childDoc.ref, { status: "Received" }));

        await batch.commit();
        showToast("Delivery marked as Received!");
        document.getElementById('receive-modal').classList.replace('flex', 'hidden');
    } catch (e) { showToast("Error processing delivery", true); }
}

function setupEventListeners() {
    document.getElementById('deliveries-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('open-receive-btn')) openReceiveModal(e.target.dataset.id);
    });
    document.getElementById('confirm-receive-btn').addEventListener('click', confirmReception);
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => {
        e.target.closest('.fixed.inset-0').classList.replace('flex', 'hidden');
    }));
}

init();