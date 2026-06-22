import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "./config.js";
import { initAuth, currentUser, userDepartmentId, setupLogout } from "./auth.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "./i18n.js";
import { showToast, setupMobileMenu } from "./ui.js";

let allProducts = [], allStaff = [];
let teamPendingOrders = [];
let cart = [];
let currentFilter = 'All';
let userDepartment = null;

function init() {
    setupLangSwitcher(() => { renderProducts(); renderCategoryFilters(); renderTeamPendingOrders(); renderCart(); });
    setupLogout();
    setupMobileMenu();

    // initAuth avec requireAdmin = false
    initAuth(async (userData) => {
        setLanguage(currentLang);
        await loadUserData(userData);
        loadCart();
        fetchProducts();
        setupEventListeners();
    }, false);
}

async function loadUserData(userData) {
    if (userData && userData.departmentId) {
        try {
            const deptDoc = await getDoc(doc(db, "departments", userData.departmentId));
            if (deptDoc.exists()) {
                userDepartment = { id: deptDoc.id, ...deptDoc.data() };
                fetchAllStaff();
                fetchTeamPendingOrders();
            }
        } catch (error) { console.error("Error fetching department:", error); }
    }
}

// --- Cart Logic ---
function saveCart() {
    if (currentUser) sessionStorage.setItem(`cart_${currentUser.uid}`, JSON.stringify(cart));
}

function loadCart() {
    if (!currentUser) return;
    const reorderData = localStorage.getItem('reorderCart');
    if (reorderData) {
        cart = JSON.parse(reorderData);
        localStorage.removeItem('reorderCart');
        saveCart();
        toggleModal(true); 
    } else {
        const savedCart = sessionStorage.getItem(`cart_${currentUser.uid}`);
        cart = savedCart ? JSON.parse(savedCart) : [];
    }
    renderCart();
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const cartItem = cart.find(item => item.productId === productId);
    if (cartItem) { 
        cartItem.quantity++; 
    } else { 
        cart.push({ productId: product.id, productName: product.name_en, productName_th: product.name_th, packaging: product.packaging_en, packaging_th: product.packaging_th, quantity: 1, supplier: product.supplier, productRef: product.product_reference }); 
    }
    showToast(`${product[`name_${currentLang}`] || product.name_en} added to order.`);
    renderCart();
}

function renderCart() {
    const cartCount = document.getElementById('cart-count');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const placeOrderBtn = document.getElementById('place-order-btn');

    cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p class="text-gray-500 text-center">${currentLang === 'th' ? 'คำสั่งซื้อของคุณว่างเปล่า' : 'Your order is empty.'}</p>`;
        placeOrderBtn.disabled = true;
        placeOrderBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        placeOrderBtn.disabled = false; 
        placeOrderBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        cart.forEach(item => {
            const itemHtml = `<div class="flex items-center justify-between py-3 border-b last:border-b-0"><div><p class="font-semibold">${item[`productName_${currentLang}`] || item.productName}</p><p class="text-sm text-gray-500">${currentLang === 'th' ? 'ต่อ' : 'Per'} ${item[`packaging_${currentLang}`] || item.packaging}</p></div><div class="flex items-center gap-3"><button data-id="${item.productId}" class="quantity-btn decrease-quantity bg-gray-200 h-7 w-7 rounded-full font-bold text-lg flex items-center justify-center">-</button><input type="number" data-id="${item.productId}" class="quantity-input shadow-sm border rounded w-16 text-center py-1" value="${item.quantity}" min="0"><button data-id="${item.productId}" class="quantity-btn increase-quantity bg-gray-200 h-7 w-7 rounded-full font-bold text-lg flex items-center justify-center">+</button><button data-id="${item.productId}" class="remove-item text-red-500 hover:text-red-700 ml-2">X</button></div></div>`;
            cartItemsContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
    }
    saveCart();
}

async function handlePlaceOrder() {
    if (!userDepartment) return showToast(currentLang === 'th' ? 'ไม่ได้กำหนดแผนก' : 'Department not assigned.', true);
    if (cart.length === 0) return showToast(currentLang === 'th' ? 'คำสั่งซื้อของคุณว่างเปล่า' : 'Your order is empty.', true);

    const placeOrderBtn = document.getElementById('place-order-btn');
    const placeOrderText = document.getElementById('place-order-text');
    const orderSpinner = document.getElementById('order-spinner');

    placeOrderBtn.disabled = true; placeOrderText.classList.add('hidden'); orderSpinner.classList.remove('hidden');

    try {
        const orderData = { 
            branchId: currentUser.branchId || userDepartment.branchId, // Rattaché à la branche
            departmentId: userDepartment.id, departmentName: userDepartment.name_en, departmentName_th: userDepartment.name_th, 
            status: "Pending", notes: document.getElementById('order-notes').value.trim(), 
            items: cart, userId: currentUser.uid, createdAt: serverTimestamp() 
        };
        await addDoc(collection(db, "orders"), orderData);
        showToast(currentLang === 'th' ? 'สั่งซื้อสำเร็จ' : 'Order placed successfully!');
        toggleModal(false);
        cart = []; document.getElementById('order-notes').value = ''; renderCart();
    } catch (error) { 
        showToast(currentLang === 'th' ? 'ไม่สามารถบันทึกคำสั่งซื้อได้' : 'Failed to save order.', true);
    } finally { 
        placeOrderBtn.disabled = false; placeOrderText.classList.remove('hidden'); orderSpinner.classList.add('hidden'); 
    }
}

function toggleModal(show) {
    const cartModal = document.getElementById('cart-modal');
    if (show) { cartModal.classList.replace('hidden', 'flex'); document.body.classList.add('modal-open'); } 
    else { cartModal.classList.replace('flex', 'hidden'); document.body.classList.remove('modal-open'); }
}

// --- Catalog Rendering ---
function renderProducts() {
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filteredProducts = allProducts.filter(product => {
        const nameEn = product.name_en || ''; const nameTh = product.name_th || ''; const ref = product.product_reference || ''; const keywords = product.keywords || '';
        return (currentFilter === (currentLang === 'th' ? 'ทั้งหมด' : 'All') || product[`category_${currentLang}`] === currentFilter) && 
               (nameEn.toLowerCase().includes(searchTerm) || nameTh.toLowerCase().includes(searchTerm) || ref.toLowerCase().includes(searchTerm) || keywords.toLowerCase().includes(searchTerm));
    });
    
    if (filteredProducts.length === 0 && allProducts.length > 0) { productGrid.innerHTML = `<p class="text-gray-500 col-span-full text-center">No products found.</p>`; return; }
    
    filteredProducts.forEach(product => {
        const card = `<div class="bg-white rounded-lg shadow-md overflow-hidden transition-transform transform hover:-translate-y-1 flex flex-col"><img src="${product.imageUrl || 'https://placehold.co/400x400/e2e8f0/64748b?text=No+Img'}" alt="${product.name_en}" class="w-full h-40 object-cover"><div class="p-4 flex flex-col flex-grow"><h3 class="font-semibold text-lg truncate">${product[`name_${currentLang}`] || product.name_en}</h3><p class="text-gray-500 text-sm">Ref: ${product.product_reference || 'N/A'}</p><div class="flex items-center justify-between mt-4 pt-2 border-t mt-auto"><span class="text-gray-600 font-medium">${currentLang === 'th' ? 'ต่อ' : 'Per'} ${product[`packaging_${currentLang}`]}</span><button data-id="${product.id}" class="add-to-cart-btn bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600">Add</button></div></div></div>`;
        productGrid.insertAdjacentHTML('beforeend', card);
    });
}

function renderCategoryFilters() {
    const categoryFiltersContainer = document.getElementById('category-filters');
    const allKey = currentLang === 'th' ? 'ทั้งหมด' : 'All';
    const categories = [allKey, ...new Set(allProducts.map(p => p[`category_${currentLang}`]).filter(Boolean).sort())];
    categoryFiltersContainer.innerHTML = '';
    categories.forEach(category => {
        const isActive = category === currentFilter;
        const buttonClass = isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300';
        categoryFiltersContainer.insertAdjacentHTML('beforeend', `<button data-category="${category}" class="category-filter-btn whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${buttonClass}">${category}</button>`);
    });
}

function fetchProducts() {
    document.getElementById('loading').classList.remove('hidden');
    onSnapshot(collection(db, "products"), (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => p.isActive !== false);
        document.getElementById('loading').classList.add('hidden');
        renderCategoryFilters(); renderProducts();
    });
}

// --- Team Orders Logic ---
function renderTeamPendingOrders() {
    const teamList = document.getElementById('team-pending-orders-list');
    teamList.innerHTML = '';
    if (teamPendingOrders.length === 0) {
        teamList.innerHTML = `<div class="bg-white p-4 rounded-lg shadow-sm text-center text-gray-500">No pending orders in your team.</div>`;
        return;
    }
    teamPendingOrders.forEach(order => {
        const user = allStaff.find(u => u.id === order.userId);
        const itemsHtml = order.items.map(item => `<li class="text-gray-600">${item.quantity} x ${item[`productName_${currentLang}`] || item.productName}</li>`).join('');
        teamList.insertAdjacentHTML('beforeend', `<div class="bg-white p-4 rounded-lg shadow-sm"><p class="font-bold">${user ? user.name : 'Unknown'}</p><ul class="list-disc list-inside mt-2">${itemsHtml}</ul></div>`);
    });
}

function fetchTeamPendingOrders() {
    if (!userDepartmentId) return;
    document.getElementById('team-orders-loading').classList.remove('hidden');
    onSnapshot(query(collection(db, "orders"), where("departmentId", "==", userDepartmentId), where("status", "==", "Pending")), (snapshot) => {
        teamPendingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('team-orders-loading').classList.add('hidden');
        renderTeamPendingOrders();
    });
}

function fetchAllStaff() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        allStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTeamPendingOrders();
    });
}

// --- Listeners ---
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', () => { clearSearch.classList.toggle('hidden', !searchInput.value); renderProducts(); });
    clearSearch.addEventListener('click', () => { searchInput.value = ''; clearSearch.classList.add('hidden'); renderProducts(); });

    document.getElementById('category-filters').addEventListener('click', (e) => { 
        const btn = e.target.closest('.category-filter-btn');
        if (btn) { currentFilter = btn.dataset.category; renderCategoryFilters(); renderProducts(); } 
    });

    document.getElementById('product-grid').addEventListener('click', (e) => { 
        if (e.target.closest('.add-to-cart-btn')) addToCart(e.target.closest('.add-to-cart-btn').dataset.id); 
    });

    document.getElementById('cart-items-container').addEventListener('click', (e) => {
        const btn = e.target.closest('.quantity-btn, .remove-item');
        if (!btn) return;
        const id = btn.dataset.id;
        const item = cart.find(i => i.productId === id);
        if (btn.classList.contains('increase-quantity')) item.quantity++; 
        else if (btn.classList.contains('decrease-quantity')) { if (item.quantity > 1) item.quantity--; else cart = cart.filter(i => i.productId !== id); } 
        else if (btn.classList.contains('remove-item')) cart = cart.filter(i => i.productId !== id);
        renderCart();
    });

    document.getElementById('cart-items-container').addEventListener('change', (e) => {
        if (e.target.classList.contains('quantity-input')) {
            const id = e.target.dataset.id;
            let qty = parseInt(e.target.value, 10);
            if (isNaN(qty) || qty <= 0) cart = cart.filter(i => i.productId !== id); else { cart.find(i => i.productId === id).quantity = qty; }
            renderCart();
        }
    });

    document.getElementById('cart-button').addEventListener('click', () => { renderCart(); toggleModal(true); });
    document.getElementById('close-modal-btn').addEventListener('click', () => toggleModal(false));
    document.getElementById('close-modal-btn-footer').addEventListener('click', () => toggleModal(false));
    document.getElementById('cart-modal').addEventListener('click', (e) => { if (e.target === document.getElementById('cart-modal')) toggleModal(false); });
    document.getElementById('place-order-btn').addEventListener('click', handlePlaceOrder);
}

init();