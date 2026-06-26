import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../../js/config.js";
import { initAuth, currentUserRole, currentUserBranchId, activeBranchContext, setActiveBranchContext, setupLogout } from "../../js/auth.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "../../js/i18n.js";
import { showToast, renderPagination, setupSearch, setupMobileMenu, formatDate } from "../../js/ui.js";

let allBranches = [], allStaff = [], allDepartments = [];
let staffCurrentPage = 1, deptsCurrentPage = 1;
const itemsPerPage = 10;
let currentSorts = { staff: { key: 'name', dir: 'asc' }, departments: { key: 'name_en', dir: 'asc' } };

function init() {
    setupLangSwitcher(() => { renderStaffTable(); renderDepartmentsTable(); renderBranchesTable(); });
    setupLogout();
    setupMobileMenu();
    
    initAuth(() => {
        setLanguage(currentLang);
        fetchAllBranches();
        fetchAllDepartments();
        fetchAllStaff();
        setupEventListeners();
    });
}

// --- Fetch Data ---
function fetchAllBranches() {
    onSnapshot(collection(db, "branches"), (snapshot) => {
        allBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const contextSelect = document.getElementById('global-branch-context-select');
        if(contextSelect) {
            contextSelect.innerHTML = currentUserRole === 'superadmin' ? `<option value="ALL">${translations[currentLang].all_branches}</option>` : '';
            allBranches.forEach(b => {
                contextSelect.innerHTML += `<option value="${b.id}" ${b.id === activeBranchContext ? 'selected' : ''}>${b.name}</option>`;
            });
        }
        renderBranchesTable();
        populateBranchDropdowns();
    });
}

function fetchAllDepartments() {
    onSnapshot(collection(db, "departments"), (snapshot) => {
        allDepartments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (allStaff.length > 0 && currentUserBranchId) filterDepartmentsByBranch(currentUserBranchId);
        renderDepartmentsTable();
    });
}

function fetchAllStaff() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        allStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStaffTable();
    });
}

// --- Utils ---
function applySort(data, sortKey, sortDir) {
    data.sort((a, b) => {
        let valA = a[sortKey] || '';
        let valB = b[sortKey] || '';
        
        if (sortKey === 'departmentId') {
            valA = allDepartments.find(d => d.id === valA)?.[`name_${currentLang}`] || allDepartments.find(d => d.id === valA)?.name_en || '';
            valB = allDepartments.find(d => d.id === valB)?.[`name_${currentLang}`] || allDepartments.find(d => d.id === valB)?.name_en || '';
        }
        if (sortKey === 'branchId') {
            valA = allBranches.find(br => br.id === valA)?.name || '';
            valB = allBranches.find(br => br.id === valB)?.name || '';
        }
        
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
}

function populateBranchDropdowns() {
    ['staff-branch-select', 'department-branch-select'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '';
            allBranches.forEach(b => select.innerHTML += `<option value="${b.id}">${b.name}</option>`);
        }
    });
}

function filterDepartmentsByBranch(branchId, selectedDeptId = null) {
    const select = document.getElementById('staff-department-select');
    if (!select) return;
    select.innerHTML = `<option value="">${currentLang === 'th' ? 'เลือกแผนก' : 'Select a department'}</option>`;
    allDepartments.filter(d => d.branchId === branchId).forEach(dept => {
        select.innerHTML += `<option value="${dept.id}" ${dept.id === selectedDeptId ? 'selected' : ''}>${dept[`name_${currentLang}`] || dept.name_en}</option>`;
    });
}

// Fonction de sécurité pour le formulaire Staff
function restrictRoleSelection() {
    const roleSelect = document.getElementById('staff-role-select');
    if (roleSelect) {
        Array.from(roleSelect.options).forEach(opt => {
            // Si on n'est pas superadmin, on bloque les options "admin" et "superadmin"
            if (opt.value === 'superadmin' || opt.value === 'admin') {
                opt.disabled = (currentUserRole !== 'superadmin');
                opt.hidden = (currentUserRole !== 'superadmin');
            }
        });
        // On force la valeur sur 'staff' si un simple Admin essaie d'ouvrir un ajout vierge
        if (currentUserRole !== 'superadmin' && (roleSelect.value === 'superadmin' || roleSelect.value === 'admin')) {
            roleSelect.value = 'staff';
        }
    }
}

// --- Render Tables ---
function renderBranchesTable() {
    const tbody = document.getElementById('branches-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    allBranches.forEach(branch => {
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-gray-50">
                <td class="table-cell text-gray-500 font-mono text-xs">${branch.id}</td>
                <td class="table-cell font-medium">${branch.name}</td>
                <td class="table-cell">
                    <button data-id="${branch.id}" class="edit-branch-btn text-blue-600 hover:underline mr-2">Edit</button>
                    <button data-id="${branch.id}" class="delete-branch-btn text-red-600 hover:underline">Delete</button>
                </td>
            </tr>
        `);
    });
}

function renderStaffTable() {
    const tbody = document.getElementById('staff-table-body');
    const searchTerm = document.getElementById('staff-search').value.toLowerCase();
    
    let filtered = allStaff.filter(s => {
        const match = (s.name || '').toLowerCase().includes(searchTerm);
        return currentUserRole === 'superadmin' ? match && (activeBranchContext === 'ALL' || s.branchId === activeBranchContext) : match && s.branchId === currentUserBranchId;
    });

    applySort(filtered, currentSorts.staff.key, currentSorts.staff.dir);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((staffCurrentPage - 1) * itemsPerPage, staffCurrentPage * itemsPerPage);

    tbody.innerHTML = paginated.length === 0 ? `<tr><td colspan="4" class="text-center py-4">No staff found.</td></tr>` : '';
    paginated.forEach(staff => {
        const dept = allDepartments.find(d => d.id === staff.departmentId);
        const branchName = allBranches.find(b => b.id === staff.branchId)?.name || 'N/A';
        
        let actionButtons = '';
        // Sécurité de modification dans le tableau
        if (currentUserRole === 'superadmin' || (staff.role !== 'superadmin' && staff.role !== 'admin')) {
            actionButtons = `
                <button data-id="${staff.id}" class="edit-staff-btn text-blue-600 hover:underline mr-2">Edit</button>
                <button data-id="${staff.id}" class="delete-staff-btn text-red-600 hover:underline">Delete</button>
            `;
        } else {
            // Un Admin ne peut pas modifier un autre Admin ou Superadmin
            actionButtons = `<span class="text-xs text-gray-400 font-bold uppercase">Restricted</span>`;
        }

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-gray-50">
                <td class="table-cell font-medium">${staff.name || 'N/A'}</td>
                <td class="table-cell text-gray-600">${dept ? dept[`name_${currentLang}`] || dept.name_en : 'N/A'}</td>
                <td class="table-cell text-sm text-gray-500">${branchName}</td>
                <td class="table-cell">${actionButtons}</td>
            </tr>
        `);
    });
    renderPagination(document.getElementById('staff-pagination-controls'), totalPages, staffCurrentPage, (p) => { staffCurrentPage = p; renderStaffTable(); });
}

function renderDepartmentsTable() {
    const tbody = document.getElementById('departments-table-body');
    const searchTerm = document.getElementById('department-search').value.toLowerCase();
    
    let filtered = allDepartments.filter(d => {
        const match = (d.name_en || '').toLowerCase().includes(searchTerm) || (d.name_th || '').toLowerCase().includes(searchTerm);
        return currentUserRole === 'superadmin' ? match && (activeBranchContext === 'ALL' || d.branchId === activeBranchContext) : match && d.branchId === currentUserBranchId;
    });

    applySort(filtered, currentSorts.departments.key, currentSorts.departments.dir);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((deptsCurrentPage - 1) * itemsPerPage, deptsCurrentPage * itemsPerPage);

    tbody.innerHTML = paginated.length === 0 ? `<tr><td colspan="3" class="text-center py-4">No departments found.</td></tr>` : '';
    paginated.forEach(dept => {
        const branch = allBranches.find(b => b.id === dept.branchId);
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-gray-50">
                <td class="table-cell font-medium">${dept.name_en || ''}</td>
                <td class="table-cell text-gray-600 font-semibold text-sm">${branch ? branch.name : 'N/A'}</td>
                <td class="table-cell">
                    <button data-id="${dept.id}" class="edit-department-btn text-blue-600 hover:underline mr-2">Edit</button>
                    <button data-id="${dept.id}" class="delete-department-btn text-red-600 hover:underline">Delete</button>
                </td>
            </tr>
        `);
    });
    renderPagination(document.getElementById('departments-pagination-controls'), totalPages, deptsCurrentPage, (p) => { deptsCurrentPage = p; renderDepartmentsTable(); });
}

// --- Event Listeners & Modals ---
function setupEventListeners() {
    setupSearch('staff-search', 'staff-clear-search', () => { staffCurrentPage = 1; renderStaffTable(); });
    setupSearch('department-search', 'department-clear-search', () => { deptsCurrentPage = 1; renderDepartmentsTable(); });

    // Dynamic Sort Listeners
    document.querySelectorAll('.sort-header').forEach(th => {
        th.addEventListener('click', (e) => {
            const table = e.currentTarget.dataset.table;
            const sortType = e.currentTarget.dataset.sort;
            if(currentSorts[table].key === sortType) {
                currentSorts[table].dir = currentSorts[table].dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSorts[table].key = sortType;
                currentSorts[table].dir = 'asc';
            }
            if(table === 'staff') renderStaffTable();
            if(table === 'departments') renderDepartmentsTable();
        });
    });

    document.getElementById('global-branch-context-select')?.addEventListener('change', (e) => {
        setActiveBranchContext(e.target.value);
        staffCurrentPage = 1; deptsCurrentPage = 1;
        renderStaffTable(); renderDepartmentsTable();
    });

    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => {
        e.target.closest('.fixed.inset-0').classList.replace('flex', 'hidden');
    }));

    // Branch Events
    document.getElementById('add-branch-btn')?.addEventListener('click', () => {
        document.getElementById('branch-form').reset(); document.getElementById('branch-id').value = '';
        document.getElementById('branch-modal').classList.replace('hidden', 'flex');
    });
    document.getElementById('branch-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('branch-id').value;
        const data = { name: document.getElementById('branch-name').value };
        if (id) await updateDoc(doc(db, "branches", id), data); else await addDoc(collection(db, "branches"), data);
        document.getElementById('branch-modal').classList.replace('flex', 'hidden');
        showToast('Branch saved!');
    });
    document.getElementById('branches-table-body')?.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-branch-btn')) {
            const b = allBranches.find(x => x.id === id);
            document.getElementById('branch-id').value = b.id; document.getElementById('branch-name').value = b.name;
            document.getElementById('branch-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-branch-btn') && confirm("Delete this branch?")) {
            deleteDoc(doc(db, "branches", id)); showToast('Branch deleted.');
        }
    });

    // Staff Events
    document.getElementById('staff-branch-select')?.addEventListener('change', (e) => filterDepartmentsByBranch(e.target.value));
    document.getElementById('add-staff-btn')?.addEventListener('click', () => {
        document.getElementById('staff-form').reset(); document.getElementById('staff-id').value = '';
        document.getElementById('staff-uid').readOnly = false;
        
        // --- Sécurité ---
        restrictRoleSelection();
        
        document.getElementById('staff-branch-select').disabled = currentUserRole === 'admin';
        document.getElementById('staff-branch-select').value = currentUserRole === 'admin' ? currentUserBranchId : (allBranches[0]?.id || '');
        filterDepartmentsByBranch(document.getElementById('staff-branch-select').value);
        document.getElementById('staff-modal').classList.replace('hidden', 'flex');
    });
    document.getElementById('staff-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const docId = document.getElementById('staff-id').value || document.getElementById('staff-uid').value;
        if (!docId) return showToast('User Auth UID is required.', true);
        const data = { 
            name: document.getElementById('staff-name').value, 
            departmentId: document.getElementById('staff-department-select').value,
            branchId: currentUserRole === 'admin' ? currentUserBranchId : document.getElementById('staff-branch-select').value,
            role: document.getElementById('staff-role-select').value
        };
        await setDoc(doc(db, "users", docId), data);
        document.getElementById('staff-modal').classList.replace('flex', 'hidden'); showToast('Staff saved!');
    });
    document.getElementById('staff-table-body')?.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-staff-btn')) {
            const s = allStaff.find(x => x.id === id);
            
            // Sécurité anti-triche via manipulation HTML
            if (currentUserRole !== 'superadmin' && (s.role === 'admin' || s.role === 'superadmin')) {
                showToast("Action restricted.", true);
                return;
            }

            document.getElementById('staff-id').value = s.id; document.getElementById('staff-uid').value = s.id;
            document.getElementById('staff-uid').readOnly = true; document.getElementById('staff-name').value = s.name;
            
            // --- Sécurité ---
            restrictRoleSelection();
            
            document.getElementById('staff-role-select').value = s.role; document.getElementById('staff-branch-select').value = s.branchId;
            document.getElementById('staff-branch-select').disabled = currentUserRole === 'admin';
            filterDepartmentsByBranch(s.branchId, s.departmentId);
            document.getElementById('staff-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-staff-btn') && confirm("Remove staff from app?")) {
            const s = allStaff.find(x => x.id === id);
            if (currentUserRole !== 'superadmin' && (s.role === 'admin' || s.role === 'superadmin')) {
                return showToast("Action restricted.", true);
            }
            await deleteDoc(doc(db, "users", id)); showToast('Staff removed.');
        }
    });

    // Department Events
    document.getElementById('add-department-btn')?.addEventListener('click', () => {
        document.getElementById('department-form').reset(); document.getElementById('department-id').value = '';
        document.getElementById('department-branch-select').disabled = currentUserRole === 'admin';
        if (currentUserRole === 'admin') document.getElementById('department-branch-select').value = currentUserBranchId;
        document.getElementById('department-modal').classList.replace('hidden', 'flex');
    });
    document.getElementById('department-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('department-id').value;
        const data = { 
            name_en: document.getElementById('department-name_en').value, name_th: document.getElementById('department-name_th').value,
            branchId: currentUserRole === 'admin' ? currentUserBranchId : document.getElementById('department-branch-select').value
        };
        if (id) await updateDoc(doc(db, "departments", id), data); else await addDoc(collection(db, "departments"), data);
        document.getElementById('department-modal').classList.replace('flex', 'hidden'); showToast('Department saved!');
    });
    document.getElementById('departments-table-body')?.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-department-btn')) {
            const d = allDepartments.find(x => x.id === id);
            document.getElementById('department-id').value = d.id; document.getElementById('department-name_en').value = d.name_en;
            document.getElementById('department-name_th').value = d.name_th; document.getElementById('department-branch-select').value = d.branchId;
            document.getElementById('department-branch-select').disabled = currentUserRole === 'admin';
            document.getElementById('department-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-department-btn') && confirm("Delete department?")) {
            if (allStaff.some(s => s.departmentId === id)) return alert('Cannot delete: assigned to staff.');
            await deleteDoc(doc(db, "departments", id)); showToast('Department deleted.');
        }
    });
    
    // Écoute le changement de succursale pour un rendu instantané
    window.addEventListener('branchContextChanged', (e) => {
        showToast("Branch context updated");
        renderStaffTable();
        renderDepartmentsTable();
        renderBranchesTable();
    }); 
}

init();