import { doc, getDoc, updateDoc, collection, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../../js/config.js";
import { initAuth, currentUserRole } from "../../js/auth.js";
import { setLanguage, setupLangSwitcher, currentLang } from "../../js/i18n.js";
import { showToast } from "../../js/ui.js";

let supplierId;
let supplierProducts = [];
let allProducts = [];

function init() {
    const hash = window.location.hash; 
    supplierId = hash.split('#id=')[1]?.trim(); 
    
    if(!supplierId || supplierId === 'undefined' || supplierId === '') { 
        document.getElementById('header-supplier-name').textContent = "Error: Invalid Supplier ID";
        return; 
    }

    setupLangSwitcher(() => { renderProducts(); });
    initAuth(() => {
        setLanguage(currentLang);
        
        // Seuls les superadmins peuvent "Hard Delete"
        if (currentUserRole === 'superadmin') {
            document.getElementById('delete-supplier-btn')?.classList.remove('hidden');
        }

        loadSupplierData();
        fetchSupplierProducts();
        setupEventListeners();
    });
}

async function loadSupplierData() {
    if (!supplierId || supplierId === 'undefined') return;

    try {
        const docRef = doc(db, "suppliers", supplierId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            document.getElementById('header-supplier-name').textContent = data.name || 'Unnamed Supplier';
            document.getElementById('comp-name').value = data.name || '';
            document.getElementById('comp-email').value = data.email || '';
            document.getElementById('comp-address').value = data.address || '';
            document.getElementById('comp-phone').value = data.phone || '';
            document.getElementById('comp-line').value = data.lineId || '';

            document.getElementById('contact-name').value = data.contactName || '';
            document.getElementById('contact-email').value = data.contactEmail || '';
            document.getElementById('contact-phone').value = data.contactPhone || '';
            document.getElementById('contact-line').value = data.contactLineId || '';

            if (data.preferredChannel) document.getElementById('pref-channel').value = data.preferredChannel;

            const pTerms = data.paymentTerms || 'POD';
            const termsSelect = document.getElementById('payment-terms');
            const otherInput = document.getElementById('payment-terms-other');

            if (['POD', '7', '15', '30'].includes(pTerms)) {
                termsSelect.value = pTerms;
                otherInput.classList.add('hidden');
            } else {
                termsSelect.value = 'other';
                otherInput.value = pTerms;
                otherInput.classList.remove('hidden');
            }

            document.getElementById('notes').value = data.notes || '';

            const bName = data.bankName || '';
            const bankSelect = document.getElementById('bank-name');
            const bankOther = document.getElementById('bank-name-other');

            if (['', 'KBank', 'SCB', 'BBL', 'KTB', 'Krungsri', 'TTB', 'GSB', 'UOB', 'CIMB'].includes(bName)) {
                bankSelect.value = bName;
                bankOther.classList.add('hidden');
            } else {
                bankSelect.value = 'other';
                bankOther.value = bName;
                bankOther.classList.remove('hidden');
            }

            document.getElementById('bank-account-name').value = data.bankAccountName || '';
            document.getElementById('bank-account-number').value = data.bankAccountNumber || '';
            
            document.getElementById('supplier-is-active').checked = data.isActive !== false;

            // Si le fournisseur est archivé, on transforme le bouton Archive en Restore
            if (data.isArchived) {
                const archBtn = document.getElementById('archive-supplier-btn');
                archBtn.textContent = "Restore Supplier & Products";
                archBtn.classList.replace('bg-orange-600', 'bg-green-600');
                archBtn.classList.replace('hover:bg-orange-700', 'hover:bg-green-700');
                archBtn.dataset.action = "restore";
            }

        } else {
            document.getElementById('header-supplier-name').textContent = "Error: Supplier not found.";
            showToast("Supplier ID does not exist in database.", true);
        }
    } catch (e) {
        showToast("Error loading data", true);
    }
}

function fetchSupplierProducts() {
    onSnapshot(collection(db, "products"), (snapshot) => {
        allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        supplierProducts = allProducts.filter(p => p.supplier === supplierId);
        supplierProducts.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''));
        renderProducts();
    });
}

function renderProducts() {
    const list = document.getElementById('products-list');
    const term = document.getElementById('product-search').value.toLowerCase();

    const filtered = supplierProducts.filter(p =>
        (p.name_en || '').toLowerCase().includes(term) ||
        (p.product_reference || '').toLowerCase().includes(term)
    );

    list.innerHTML = '';
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-500 py-4">No products found for this supplier.</p>`;
        return;
    }

    filtered.forEach(p => {
        const inactiveBadge = !p.isActive ? '<span class="text-xs text-red-500 border border-red-500 px-1 rounded ml-2">INACTIVE</span>' : '';
        list.insertAdjacentHTML('beforeend', `
            <div class="flex justify-between items-center p-3 border-b hover:bg-gray-50 rounded">
                <div>
                    <span class="font-bold text-blue-700">[${p.product_reference || 'REF'}]</span> 
                    <span class="font-medium text-gray-800 ml-1">${p[`name_${currentLang}`] || p.name_en}</span>
                    ${inactiveBadge}
                </div>
                <button type="button" onclick="window.location.href='catalog.html#edit=${p.id}'" class="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 cursor-pointer">Edit Product</button>
            </div>
        `);
    });
}

function setupEventListeners() {
    document.getElementById('same-as-company-btn')?.addEventListener('click', () => {
        document.getElementById('contact-email').value = document.getElementById('comp-email').value;
        document.getElementById('contact-phone').value = document.getElementById('comp-phone').value;
        document.getElementById('contact-line').value = document.getElementById('comp-line').value;
    });

    document.getElementById('payment-terms')?.addEventListener('change', (e) => {
        const otherInput = document.getElementById('payment-terms-other');
        if (e.target.value === 'other') {
            otherInput.classList.remove('hidden');
            otherInput.focus();
        } else {
            otherInput.classList.add('hidden');
        }
    });

    document.getElementById('bank-name')?.addEventListener('change', (e) => {
        const bankOther = document.getElementById('bank-name-other');
        if (e.target.value === 'other') {
            bankOther.classList.remove('hidden');
            bankOther.focus();
        } else {
            bankOther.classList.add('hidden');
        }
    });

    document.getElementById('product-search')?.addEventListener('input', renderProducts);

    // --- SAUVEGARDE DU PROFIL ---
    document.getElementById('save-supplier-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('comp-name').value;
        if (!name) return showToast("Company Name is required", true);

        const pTermsSelect = document.getElementById('payment-terms').value;
        const paymentTerms = pTermsSelect === 'other' ? document.getElementById('payment-terms-other').value : pTermsSelect;

        const bSelect = document.getElementById('bank-name').value;
        const bankName = bSelect === 'other' ? document.getElementById('bank-name-other').value : bSelect;
        
        const isActive = document.getElementById('supplier-is-active').checked;

        const data = {
            name: name,
            email: document.getElementById('comp-email').value,
            address: document.getElementById('comp-address').value,
            phone: document.getElementById('comp-phone').value,
            lineId: document.getElementById('comp-line').value,
            contactName: document.getElementById('contact-name').value,
            contactEmail: document.getElementById('contact-email').value,
            contactPhone: document.getElementById('contact-phone').value,
            contactLineId: document.getElementById('contact-line').value,
            preferredChannel: document.getElementById('pref-channel').value,
            paymentTerms: paymentTerms,
            notes: document.getElementById('notes').value,
            bankName: bankName,
            bankAccountName: document.getElementById('bank-account-name').value,
            bankAccountNumber: document.getElementById('bank-account-number').value,
            isActive: isActive
        };

        try {
            const batch = writeBatch(db);
            // On sauvegarde les infos du fournisseur
            batch.update(doc(db, "suppliers", supplierId), data);
            
            // Si on a désactivé le fournisseur, on désactive TOUS ses produits
            supplierProducts.forEach(p => {
                if (p.isActive !== isActive) {
                    batch.update(doc(db, "products", p.id), { isActive: isActive });
                }
            });

            await batch.commit();
            document.getElementById('header-supplier-name').textContent = name;
            showToast("Supplier & Products saved successfully!");
            setTimeout(() => window.location.href = 'suppliers.html', 1500);
        } catch (e) {
            showToast("Error saving profile", true);
        }
    });

    // --- ARCHIVE / RESTORE ---
    document.getElementById('archive-supplier-btn')?.addEventListener('click', async (e) => {
        const action = e.currentTarget.dataset.action;
        
        if (action === "restore") {
            if (!confirm("Do you want to restore this supplier and ALL its associated products?")) return;
            try {
                const batch = writeBatch(db);
                batch.update(doc(db, "suppliers", supplierId), { isArchived: false, isActive: true });
                supplierProducts.forEach(p => batch.update(doc(db, "products", p.id), { isArchived: false, isActive: true }));
                await batch.commit();
                showToast("Supplier successfully restored.");
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) { showToast("Error restoring", true); }
            return;
        }

        // Logic d'archivage
        if (!confirm("⚠️ Are you sure you want to ARCHIVE this supplier?\n\nThis will hide the supplier and ALL its products from the catalogs, but keep them for historical records.")) return;
        if (!confirm("Second confirmation: This action will disable all associated products. Proceed?")) return;

        try {
            const batch = writeBatch(db);
            batch.update(doc(db, "suppliers", supplierId), { isArchived: true, isActive: false });
            supplierProducts.forEach(p => batch.update(doc(db, "products", p.id), { isArchived: true, isActive: false }));
            await batch.commit();
            showToast("Supplier and products archived.");
            setTimeout(() => window.location.href = 'suppliers.html', 1500);
        } catch(err) { showToast("Error archiving", true); }
    });

    // --- HARD DELETE (Superadmin uniquement) ---
    document.getElementById('delete-supplier-btn')?.addEventListener('click', async () => {
        const sName = document.getElementById('header-supplier-name').textContent;
        const ans = prompt(`⚠️ DANGER: Permanent Deletion!\n\nThis will completely ERASE the supplier and ALL its products. This cannot be undone.\n\nType "${sName}" to confirm:`);
        
        if (ans === sName) {
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, "suppliers", supplierId));
                supplierProducts.forEach(p => batch.delete(doc(db, "products", p.id)));
                await batch.commit();
                showToast("Supplier & Products PERMANENTLY deleted.");
                setTimeout(() => window.location.href = 'suppliers.html', 1500);
            } catch (err) { showToast("Error deleting", true); }
        } else if (ans !== null) {
            showToast("Name did not match. Deletion cancelled.", true);
        }
    });    
}

init();