import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "./config.js";
import { initAuth, currentUserRole, currentUserAccessibleBranches, currentUserPermissions } from "./auth.js";
import { setLanguage, setupLangSwitcher, currentLang } from "./i18n.js";
import { showToast, formatDate } from "./ui.js";

let receivedOrders = [];
let allSuppliers = [];
let allBranches = [];
let orderToPay = null;
let currentBranchFilter = 'ALL';

function init() {
    initAuth(() => {
        setLanguage(currentLang);
        // Sécurité : Uniquement superadmin, admin, ou staff avec le flag canPay
        if (!currentUserPermissions.canPay && currentUserRole !== 'superadmin' && currentUserRole !== 'admin') {
            document.getElementById('access-denied').classList.remove('hidden');
            return setTimeout(() => window.location.href = 'index.html', 2000);
        }
        
        document.getElementById('app').classList.remove('hidden');
        
        fetchAllBranches();
        fetchAllSuppliers();
        fetchReceivedOrders();
        setupEventListeners();
    }, false);
}

function fetchAllBranches() {
    onSnapshot(collection(db, "branches"), snap => {
        allBranches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const filterSelect = document.getElementById('accounting-branch-select');
        const filterContainer = document.getElementById('branch-filter-container');
        
        if (currentUserRole === 'superadmin' || currentUserAccessibleBranches.length > 1) {
            filterContainer.classList.replace('hidden', 'flex');
            filterSelect.innerHTML = '<option value="ALL">ALL BRANCHES</option>';
            allBranches.forEach(b => {
                if (currentUserRole === 'superadmin' || currentUserAccessibleBranches.includes(b.id)) {
                    filterSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
                }
            });
        } else {
            currentBranchFilter = currentUserAccessibleBranches[0] || 'ALL';
        }
        renderPaymentsList();
    });
}

function fetchAllSuppliers() {
    onSnapshot(collection(db, "suppliers"), snap => {
        allSuppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPaymentsList();
    });
}

function fetchReceivedOrders() {
    // On ne récupère que les commandes réceptionnées
    const q = query(collection(db, "orders"), where("status", "==", "Received"));
    onSnapshot(q, snap => {
        receivedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(o => currentUserRole === 'superadmin' || currentUserAccessibleBranches.includes(o.branchId));
        
        renderPaymentsList();
    });
}

function renderPaymentsList() {
    if (allBranches.length === 0 || allSuppliers.length === 0) return; // Attente des données
    
    const list = document.getElementById('payments-list');
    document.getElementById('loading-spinner').classList.add('hidden');

    const filteredOrders = receivedOrders.filter(o => currentBranchFilter === 'ALL' || o.branchId === currentBranchFilter);

    if (filteredOrders.length === 0) {
        list.innerHTML = `<div class="p-6 bg-gray-50 text-center rounded border border-dashed"><p class="text-gray-500">No pending payments.</p></div>`;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Tri par Date d'échéance (Les plus urgentes en premier)
    filteredOrders.sort((a,b) => {
        const dateA = a.financials?.paymentDueDate || '9999-12-31';
        const dateB = b.financials?.paymentDueDate || '9999-12-31';
        return dateA.localeCompare(dateB);
    });

    let html = '';
    filteredOrders.forEach(order => {
        const supplierId = order.items[0]?.supplier;
        const supplierName = allSuppliers.find(s => s.id === supplierId)?.name || 'Unknown Supplier';
        const branchName = allBranches.find(b => b.id === order.branchId)?.name || 'Unknown Branch';
        
        const financials = order.financials || {};
        const totalAmount = financials.totalAmount ? financials.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';
        const dueDate = financials.paymentDueDate || 'N/A';
        
        // Logique visuelle pour les retards
        let dateBadgeColor = 'bg-gray-100 text-gray-700 border-gray-200';
        let dateIcon = '📅';
        if (dueDate < todayStr) {
            dateBadgeColor = 'bg-red-100 text-red-800 border-red-200 font-bold animate-pulse';
            dateIcon = '⚠️ OVERDUE';
        } else if (dueDate === todayStr) {
            dateBadgeColor = 'bg-orange-100 text-orange-800 border-orange-200 font-bold';
            dateIcon = '⏳ TODAY';
        }

        html += `
            <div class="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border rounded shadow-sm hover:shadow-md transition-shadow gap-4">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h3 class="text-lg font-extrabold text-gray-800">${supplierName}</h3>
                        <span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold uppercase tracking-wider">${branchName}</span>
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        <p><strong>Inv:</strong> ${financials.invoiceRef || 'N/A'}</p>
                        <p><strong>Method:</strong> ${financials.paymentMethod || 'N/A'}</p>
                        <p><strong>Received:</strong> ${order.createdAt ? formatDate(order.createdAt.toDate()) : 'N/A'}</p>
                    </div>
                </div>
                
                <div class="flex flex-col md:items-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                    <div class="flex items-center gap-4 md:justify-end">
                        <div class="text-right">
                            <span class="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Due Date</span>
                            <span class="text-xs px-2 py-1 rounded border ${dateBadgeColor}">${dateIcon} ${dueDate}</span>
                        </div>
                        <div class="text-right">
                            <span class="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Amount</span>
                            <span class="text-xl font-black text-blue-700 font-mono">${totalAmount} <span class="text-sm text-gray-500">THB</span></span>
                        </div>
                    </div>
                    <button data-id="${order.id}" class="open-pay-btn w-full md:w-auto bg-purple-600 text-white font-bold py-2 px-6 rounded hover:bg-purple-700 shadow-sm transition-colors mt-1">
                        Pay Order
                    </button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function openPayModal(orderId) {
    orderToPay = receivedOrders.find(o => o.id === orderId);
    if (!orderToPay) return;

    const financials = orderToPay.financials || {};
    const totalAmount = financials.totalAmount ? financials.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';

    document.getElementById('pay-amount-display').textContent = `${totalAmount} THB`;
    document.getElementById('pay-method-display').textContent = `Via ${financials.paymentMethod || 'Unknown Method'} (Inv: ${financials.invoiceRef || 'N/A'})`;
    
    document.getElementById('actual-payment-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('transaction-ref').value = '';

    document.getElementById('pay-modal').classList.replace('hidden', 'flex');
}

async function confirmPayment() {
    if (!orderToPay) return;

    const payDateInput = document.getElementById('actual-payment-date');
    if (!payDateInput.checkValidity()) {
        payDateInput.reportValidity();
        return;
    }

    const financials = orderToPay.financials || {};
    financials.actualPaymentDate = payDateInput.value;
    financials.transactionRef = document.getElementById('transaction-ref').value;

    try {
        await updateDoc(doc(db, "orders", orderToPay.id), {
            status: "Paid",
            financials: financials
        });

        showToast("Order marked as Paid!");
        document.getElementById('pay-modal').classList.replace('flex', 'hidden');
    } catch (e) {
        showToast("Error processing payment", true);
    }
}

function setupEventListeners() {
    document.getElementById('accounting-branch-select')?.addEventListener('change', (e) => {
        currentBranchFilter = e.target.value;
        renderPaymentsList();
    });

    document.getElementById('payments-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('open-pay-btn')) {
            openPayModal(e.target.dataset.id);
        }
    });

    document.getElementById('confirm-payment-btn').addEventListener('click', confirmPayment);

    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => {
        e.target.closest('.fixed.inset-0').classList.replace('flex', 'hidden');
    }));
}

init();