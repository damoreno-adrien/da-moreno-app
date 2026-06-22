export function showToast(message, isError = false) {
    const toastContainer = document.getElementById('toast-container');
    if(!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast text-white py-3 px-6 rounded-lg shadow-lg mb-2 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
}

export function renderPagination(container, totalPages, currentPage, pageClickHandler) {
    if(!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&lt;';
    prevButton.disabled = currentPage === 1;
    prevButton.className = "px-3 py-1 bg-gray-200 rounded disabled:opacity-50";
    prevButton.addEventListener('click', () => pageClickHandler(currentPage - 1));

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '&gt;';
    nextButton.disabled = currentPage === totalPages;
    nextButton.className = "px-3 py-1 bg-gray-200 rounded disabled:opacity-50";
    nextButton.addEventListener('click', () => pageClickHandler(currentPage + 1));
    
    container.append(prevButton, pageInfo, nextButton);
}

export function setupSearch(inputId, clearId, renderFunc) {
    const input = document.getElementById(inputId);
    const clear = document.getElementById(clearId);
    if(!input || !clear) return;
    input.addEventListener('input', () => {
        clear.classList.toggle('hidden', !input.value);
        renderFunc();
    });
    clear.addEventListener('click', () => {
        input.value = '';
        clear.classList.add('hidden');
        renderFunc();
    });
}

export function setupMobileMenu() {
    const menuButton = document.getElementById('menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if(menuButton && mobileMenu) {
        menuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        document.addEventListener('click', (e) => {
            if (!menuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }
}