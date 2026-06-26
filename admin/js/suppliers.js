import { collection, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../../js/config.js";
import { initAuth, setupLogout } from "../../js/auth.js";
import { setLanguage, setupLangSwitcher, currentLang } from "../../js/i18n.js";
import { showToast } from "../../js/ui.js";

let allSuppliers = [];
let allProducts = [];
let sortKey = 'name';
let sortDesc = false;

function init() {
    setupLangSwitcher(renderSuppliers);
    setupLogout();
    
    initAuth(() => {
        setLanguage(currentLang);
        fetchProducts(); 
        fetchSuppliers();
        setupEventListeners();
    });
}

function fetchProducts() {
    onSnapshot(collection(db, "products"), (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSuppliers();
    });
}

function fetchSuppliers() {
    onSnapshot(collection(db, "suppliers"), (snapshot) => {
        allSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSuppliers();
    });
}

function renderSuppliers() {
    const tbody = document.getElementById('suppliers-table-body');
    const term = document.getElementById('supplier-search').value.toLowerCase();
    const showArchived = document.getElementById('show-archived')?.checked || false;
    
    let filtered = allSuppliers.filter(s => 
        (showArchived ? true : !s.isArchived) &&
        ((s.name || '').toLowerCase().includes(term) ||
        (s.contactName || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.phone || '').toLowerCase().includes(term) ||
        (s.contactPhone || '').toLowerCase().includes(term) ||
        (s.contactEmail || '').toLowerCase().includes(term))
    );
    
    filtered.sort((a, b) => {
        const valA = (a[sortKey] || '').toLowerCase();
        const valB = (b[sortKey] || '').toLowerCase();
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    });
    
    tbody.innerHTML = '';
    filtered.forEach(supplier => {
        const supplierProducts = allProducts.filter(p => p.supplier === supplier.id);
        const totalProducts = supplierProducts.length;
        const activeProducts = supplierProducts.filter(p => p.isActive !== false && !p.isArchived).length;
        
        let statusBadge = '';
        if (supplier.isArchived) {
            statusBadge = '<span class="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded font-bold">ARCHIVED</span>';
        } else {
            statusBadge = supplier.isActive === false 
                ? '<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-bold">INACTIVE</span>' 
                : '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">ACTIVE</span>';
        }

        const row = document.createElement('tr');
        row.className = `border-b hover:bg-gray-50 cursor-pointer supplier-row ${supplier.isArchived ? 'opacity-60' : ''}`;
        row.dataset.id = supplier.id;
        row.innerHTML = `
            <td class="table-cell font-bold text-gray-800">${supplier.name || 'Unnamed'}</td>
            <td class="table-cell text-gray-600">${supplier.contactName || '-'}</td>
            <td class="table-cell text-center">${statusBadge}</td>
            <td class="table-cell text-center font-mono text-sm">${activeProducts} / ${totalProducts}</td>
            <td class="table-cell text-right">
                <button type="button" 
                    onclick="event.stopPropagation(); window.location.href='supplier-detail.html#id=${supplier.id}'"
                    class="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm font-medium cursor-pointer">
                    Edit Profile
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openQuickView(supplierId) {
    const s = allSuppliers.find(x => x.id === supplierId);
    if(!s) return;

    document.getElementById('qv-name').textContent = s.name || '-';
    document.getElementById('qv-email').textContent = s.email || s.contactEmail || '-';
    document.getElementById('qv-contact').textContent = s.contactName || '-';
    document.getElementById('qv-phone').textContent = s.phone || s.contactPhone || '-';
    document.getElementById('qv-line').textContent = s.lineId || s.contactLineId || '-';
    
    document.getElementById('qv-bank-name').textContent = s.bankName || '-';
    document.getElementById('qv-bank-account').textContent = s.bankAccountNumber || '-';
    document.getElementById('qv-bank-holder').textContent = s.bankAccountName || '-';

    document.getElementById('supplier-view-modal').classList.replace('hidden', 'flex');
}

function setupEventListeners() {
    document.getElementById('supplier-search')?.addEventListener('input', renderSuppliers);
    document.getElementById('show-archived')?.addEventListener('change', renderSuppliers); 
    
    document.querySelectorAll('.sort-header').forEach(th => {
        th.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.sort;
            if(sortKey === type) sortDesc = !sortDesc;
            else { sortKey = type; sortDesc = false; }
            renderSuppliers();
        });
    });

    document.getElementById('suppliers-table-body')?.addEventListener('click', (e) => {
        const row = e.target.closest('.supplier-row');
        if (row) openQuickView(row.dataset.id);
    });

    document.querySelectorAll('.close-view-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('supplier-view-modal').classList.replace('flex', 'hidden');
        });
    });

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.dataset.target;
            const textToCopy = document.getElementById(targetId).textContent;
            if(textToCopy && textToCopy !== '-') {
                navigator.clipboard.writeText(textToCopy);
                showToast("Copied to clipboard!");
            }
        });
    });

    document.getElementById('modal-export-btn')?.addEventListener('click', () => {
        const targetArea = document.getElementById('printable-supplier-card');
        targetArea.classList.add('exporting'); 
        
        html2canvas(targetArea, { scale: 3, backgroundColor: '#ffffff' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Supplier_Card_${document.getElementById('qv-name').textContent.replace(/\s+/g, '_')}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 1.0);
            link.click();
            targetArea.classList.remove('exporting');
        }).catch(() => {
            targetArea.classList.remove('exporting');
            showToast("Export failed", true);
        });
    });

    document.getElementById('add-supplier-btn')?.addEventListener('click', async () => {
        const name = prompt("Enter the new supplier's company name:");
        if(!name || name.trim() === '') return;
        try {
            const docRef = await addDoc(collection(db, "suppliers"), { name: name.trim(), isActive: true, isArchived: false });
            window.location.href = `supplier-detail.html#id=${docRef.id}`;
        } catch (e) {
            showToast("Error creating supplier", true);
        }
    });

    // ÉCOUTEUR SPA (Relance l'affichage en direct lors du changement de branch)
    window.addEventListener('branchContextChanged', (e) => {
        showToast("Branch context updated");
        renderSuppliers();
    });
}

init();