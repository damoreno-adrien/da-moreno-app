import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "./config.js";
import { initAuth, currentUser, setupLogout } from "./auth.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "./i18n.js";
import { setupMobileMenu } from "./ui.js";

let allMyOrders = [];
let currentPage = 1;
const ordersPerPage = 10;

function init() {
    setupLangSwitcher(() => { renderMyOrders(); });
    setupLogout();
    setupMobileMenu();

    // initAuth avec requireAdmin = false
    initAuth((userData) => {
        setLanguage(currentLang);
        fetchMyOrders();
        setupEventListeners();
    }, false);
}

function fetchMyOrders() {
    if (!currentUser) return;
    const ordersLoading = document.getElementById('orders-loading');
    ordersLoading.classList.remove('hidden');
    
    const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        allMyOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allMyOrders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        ordersLoading.classList.add('hidden');
        renderMyOrders();
    }, (error) => {
        console.error("Error fetching my orders:", error);
        ordersLoading.innerHTML = `<p class="text-red-500 text-center">${translations[currentLang].loading_my_orders || 'Could not load your orders.'}</p>`;
    });
}

function renderPaginationControls(totalOrders) {
    const paginationControls = document.getElementById('pagination-controls');
    paginationControls.innerHTML = '';
    const totalPages = Math.ceil(totalOrders / ordersPerPage);
    if (totalPages <= 1) return;

    const prevButton = `<button id="prev-page" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">&lt;</button>`;
    const pageInfo = `<span>Page ${currentPage} of ${totalPages}</span>`;
    const nextButton = `<button id="next-page" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">&gt;</button>`;
    paginationControls.innerHTML = prevButton + pageInfo + nextButton;
}

function renderMyOrders() {
    const myOrdersList = document.getElementById('my-orders-list');
    const statusFilter = document.getElementById('status-filter');
    myOrdersList.innerHTML = '';
    
    const status = statusFilter.value;
    const filteredOrders = status === 'All' ? allMyOrders : allMyOrders.filter(o => o.status === status);

    if (filteredOrders.length === 0) {
        myOrdersList.innerHTML = `<div class="bg-white p-4 rounded-lg shadow-sm text-center text-gray-500">${currentLang === 'th' ? 'ไม่พบคำสั่งซื้อ' : 'No orders found.'}</div>`;
        renderPaginationControls(0);
        return;
    }

    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    paginatedOrders.forEach(order => {
        const itemsHtml = order.items.map(item => `<li class="text-gray-600">${item.quantity} x ${item[`productName_${currentLang}`] || item.productName}</li>`).join('');
        const orderDate = formatDate(order.createdAt.toDate()) || 'N/A';
        const statusText = order.status || 'Pending';
        
        let statusClass = 'text-yellow-600 bg-yellow-100';
        if(statusText === 'Cancelled') statusClass = 'text-red-600 bg-red-100';
        if(statusText === 'Processed') statusClass = 'text-green-600 bg-green-100';

        const orderHtml = `
            <div class="bg-white rounded-lg shadow-sm">
                <div class="p-4 cursor-pointer order-header flex justify-between items-center">
                    <div>
                        <p class="font-bold">${currentLang === 'th' ? 'คำสั่งซื้อจาก' : 'Order from'} ${orderDate} <span class="text-sm font-medium px-2 py-1 rounded-full ${statusClass}">${translations[currentLang][statusText.toLowerCase()] || statusText}</span></p>
                    </div>
                    <div class="flex items-center gap-2">
                       <button data-id="${order.id}" class="reorder-btn text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">${translations[currentLang].reorder}</button>
                       <svg class="w-5 h-5 chevron-icon transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
                <div class="details-list px-4 pb-4">
                     <ul class="list-disc list-inside mt-2">${itemsHtml}</ul>
                </div>
            </div>
        `;
        myOrdersList.insertAdjacentHTML('beforeend', orderHtml);
    });
    renderPaginationControls(filteredOrders.length);
}

function handleReorder(orderId) {
    const order = allMyOrders.find(o => o.id === orderId);
    if(order && order.items) {
        localStorage.setItem('reorderCart', JSON.stringify(order.items));
        window.location.href = './index.html';
    }
}

function setupEventListeners() {
    const statusFilter = document.getElementById('status-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const myOrdersList = document.getElementById('my-orders-list');

    statusFilter.addEventListener('change', () => {
        currentPage = 1;
        renderMyOrders();
    });

    paginationControls.addEventListener('click', (e) => {
        const status = statusFilter.value;
        const filteredOrders = status === 'All' ? allMyOrders : allMyOrders.filter(o => o.status === status);
        const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
        
        if (e.target.id === 'prev-page' && currentPage > 1) {
            currentPage--;
            renderMyOrders();
        } else if (e.target.id === 'next-page' && currentPage < totalPages) {
            currentPage++;
            renderMyOrders();
        }
    });

    myOrdersList.addEventListener('click', (e) => {
        const reorderBtn = e.target.closest('.reorder-btn');
        if(reorderBtn) {
            e.stopPropagation();
            handleReorder(reorderBtn.dataset.id);
            return;
        }

        const header = e.target.closest('.order-header');
        if(header) {
            const details = header.nextElementSibling;
            const icon = header.querySelector('.chevron-icon');
            if(details.style.maxHeight) {
                details.style.maxHeight = null;
                icon.style.transform = 'rotate(0deg)';
            } else {
                details.style.maxHeight = details.scrollHeight + "px";
                icon.style.transform = 'rotate(180deg)';
            }
        }
    });
}

init();