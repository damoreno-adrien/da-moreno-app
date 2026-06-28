import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../../js/config.js";
import { initAuth, currentUserRole, currentUserAccessibleBranches, activeBranchContext, setActiveBranchContext, setupLogout } from "../../js/auth.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "../../js/i18n.js";
import { showToast, renderPagination, setupSearch, setupMobileMenu } from "../../js/ui.js";

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
        renderDepartmentsTable();
    });
}

function fetchAllStaff() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        allStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStaffTable();
    });
}

function applySort(data, sortKey, sortDir) {
    data.sort((a, b) => {
        let valA = a[sortKey] || '';
        let valB = b[sortKey] || '';
        if (sortKey === 'departmentId') {
            valA = allDepartments.find(d => d.id === valA)?.[`name_${currentLang}`] || allDepartments.find(d => d.id === valA)?.name_en || '';
            valB = allDepartments.find(d => d.id === valB)?.[`name_${currentLang}`] || allDepartments.find(d => d.id === valB)?.name_en || '';
        }
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
}

function populateBranchDropdowns() {
    const deptSelect = document.getElementById('department-branch-select');
    if (deptSelect) {
        deptSelect.innerHTML = '';
        allBranches.forEach(b => deptSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`);
    }
}

function renderStaffBranchCheckboxes(selectedBranchIds = []) {
    const container = document.getElementById('staff-branch-checkboxes');
    if (!container) return;
    container.innerHTML = '';

    allBranches.forEach(b => {
        if (currentUserRole === 'superadmin' || currentUserAccessibleBranches.includes(b.id)) {
            const isChecked = selectedBranchIds.includes(b.id) ? 'checked' : '';
            container.insertAdjacentHTML('beforeend', `
                <label class="flex items-center gap-2 bg-gray-50 p-2 rounded border cursor-pointer hover:bg-gray-100">
                    <input type="checkbox" value="${b.id}" class="branch-checkbox rounded text-blue-600 w-4 h-4" ${isChecked}>
                    <span class="text-sm font-medium text-gray-700">${b.name}</span>
                </label>
            `);
        }
    });
    
    document.querySelectorAll('.branch-checkbox').forEach(cb => cb.addEventListener('change', updateStaffDepartmentOptions));
}

function updateStaffDepartmentOptions(selectedDeptId = null) {
    const select = document.getElementById('staff-department-select');
    if (!select) return;
    
    const checkedBranches = Array.from(document.querySelectorAll('.branch-checkbox:checked')).map(cb => cb.value);
    select.innerHTML = `<option value="">${currentLang === 'th' ? 'เลือกแผนก' : 'Select a department'}</option>`;
    
    allDepartments.filter(d => checkedBranches.includes(d.branchId)).forEach(dept => {
        const isSelected = (typeof selectedDeptId === 'string' && dept.id === selectedDeptId) ? 'selected' : '';
        select.innerHTML += `<option value="${dept.id}" ${isSelected}>${dept[`name_${currentLang}`] || dept.name_en}</option>`;
    });
}

function restrictRoleSelection() {
    const roleSelect = document.getElementById('staff-role-select');
    if (roleSelect) {
        Array.from(roleSelect.options).forEach(opt => {
            if (opt.value === 'superadmin' || opt.value === 'admin') {
                opt.disabled = (currentUserRole !== 'superadmin');
                opt.hidden = (currentUserRole !== 'superadmin');
            }
        });
        if (currentUserRole !== 'superadmin' && (roleSelect.value === 'superadmin' || roleSelect.value === 'admin')) {
            roleSelect.value = 'staff';
        }
    }
}

function renderBranchesTable() {
    const tbody = document.getElementById('branches-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    allBranches.forEach(branch => {
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-gray-50">
                <td class="table-cell font-medium">${branch.name}</td>
                <td class="table-cell text-gray-600 text-sm">${branch.companyName || '-'}</td>
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
        const sBranches = s.accessibleBranches || (s.branchId ? [s.branchId] : []);
        
        if (currentUserRole === 'superadmin') {
            return match && (activeBranchContext === 'ALL' || sBranches.includes(activeBranchContext));
        } else {
            return match && sBranches.some(b => currentUserAccessibleBranches.includes(b));
        }
    });

    applySort(filtered, currentSorts.staff.key, currentSorts.staff.dir);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((staffCurrentPage - 1) * itemsPerPage, staffCurrentPage * itemsPerPage);

    tbody.innerHTML = paginated.length === 0 ? `<tr><td colspan="5" class="text-center py-4">No staff found.</td></tr>` : '';
    paginated.forEach(staff => {
        const dept = allDepartments.find(d => d.id === staff.departmentId);
        const sBranches = staff.accessibleBranches || (staff.branchId ? [staff.branchId] : []);
        const branchNames = sBranches.map(bId => allBranches.find(b => b.id === bId)?.name || 'N/A').join(', ');
        
        let permsHtml = '';
        if (staff.permissions?.canProcessOrders) permsHtml += '<span class="bg-blue-100 text-blue-700 text-[10px] px-1 rounded mr-1" title="Can Process Orders">PRC</span>';
        if (staff.permissions?.canReceive) permsHtml += '<span class="bg-green-100 text-green-700 text-[10px] px-1 rounded mr-1" title="Can Receive">RCV</span>';
        if (staff.permissions?.canPay) permsHtml += '<span class="bg-yellow-100 text-yellow-700 text-[10px] px-1 rounded" title="Can Pay">PAY</span>';

        let actionButtons = '';
        if (currentUserRole === 'superadmin' || (staff.role !== 'superadmin' && staff.role !== 'admin')) {
            actionButtons = `
                <button data-id="${staff.id}" class="edit-staff-btn text-blue-600 hover:underline mr-2">Edit</button>
                <button data-id="${staff.id}" class="delete-staff-btn text-red-600 hover:underline">Delete</button>
            `;
        } else {
            actionButtons = `<span class="text-xs text-gray-400 font-bold uppercase">Restricted</span>`;
        }

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-gray-50">
                <td class="table-cell font-medium">
                    ${staff.name || 'N/A'}
                    <div class="mt-1">${permsHtml}</div>
                </td>
                <td class="table-cell text-gray-600">${dept ? dept[`name_${currentLang}`] || dept.name_en : 'N/A'}</td>
                <td class="table-cell text-xs text-gray-500">${branchNames || 'N/A'}</td>
                <td class="table-cell text-xs font-bold uppercase">${staff.role}</td>
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
        if (currentUserRole === 'superadmin') {
            return match && (activeBranchContext === 'ALL' || d.branchId === activeBranchContext);
        } else {
            return match && currentUserAccessibleBranches.includes(d.branchId);
        }
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

function setupEventListeners() {
    setupSearch('staff-search', 'staff-clear-search', () => { staffCurrentPage = 1; renderStaffTable(); });
    setupSearch('department-search', 'department-clear-search', () => { deptsCurrentPage = 1; renderDepartmentsTable(); });

    document.querySelectorAll('.sort-header').forEach(th => {
        th.addEventListener('click', (e) => {
            const table = e.currentTarget.dataset.table;
            const sortType = e.currentTarget.dataset.sort;
            if(currentSorts[table].key === sortType) { currentSorts[table].dir = currentSorts[table].dir === 'asc' ? 'desc' : 'asc'; } 
            else { currentSorts[table].key = sortType; currentSorts[table].dir = 'asc'; }
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

    document.getElementById('add-branch-btn')?.addEventListener('click', () => {
        document.getElementById('branch-form').reset(); document.getElementById('branch-id').value = '';
        document.getElementById('branch-modal').classList.replace('hidden', 'flex');
    });
    document.getElementById('branch-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('branch-id').value;
        const data = { name: document.getElementById('branch-name').value, companyName: document.getElementById('branch-company-name').value };
        if (id) await updateDoc(doc(db, "branches", id), data); else await addDoc(collection(db, "branches"), data);
        document.getElementById('branch-modal').classList.replace('flex', 'hidden'); showToast('Branch saved!');
    });
    document.getElementById('branches-table-body')?.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-branch-btn')) {
            const b = allBranches.find(x => x.id === id);
            document.getElementById('branch-id').value = b.id; document.getElementById('branch-name').value = b.name;
            document.getElementById('branch-company-name').value = b.companyName || '';
            document.getElementById('branch-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-branch-btn') && confirm("Delete this branch?")) {
            deleteDoc(doc(db, "branches", id)); showToast('Branch deleted.');
        }
    });

    document.getElementById('add-staff-btn')?.addEventListener('click', () => {
        document.getElementById('staff-form').reset(); 
        document.getElementById('staff-id').value = '';
        document.getElementById('staff-uid').readOnly = false;
        
        restrictRoleSelection();
        renderStaffBranchCheckboxes(currentUserRole === 'admin' ? currentUserAccessibleBranches : []);
        updateStaffDepartmentOptions();
        
        document.getElementById('staff-modal').classList.replace('hidden', 'flex');
    });

    document.getElementById('staff-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const docId = document.getElementById('staff-id').value || document.getElementById('staff-uid').value;
        if (!docId) return showToast('User Auth UID is required.', true);
        
        const selectedBranches = Array.from(document.querySelectorAll('.branch-checkbox:checked')).map(cb => cb.value);
        if (selectedBranches.length === 0) return showToast('Select at least one branch', true);

        const data = { 
            name: document.getElementById('staff-name').value, 
            departmentId: document.getElementById('staff-department-select').value,
            accessibleBranches: selectedBranches,
            branchId: selectedBranches[0],
            role: document.getElementById('staff-role-select').value,
            permissions: {
                canProcessOrders: document.getElementById('perm-process').checked,
                canReceive: document.getElementById('perm-receive').checked,
                canPay: document.getElementById('perm-pay').checked
            }
        };
        await setDoc(doc(db, "users", docId), data);
        document.getElementById('staff-modal').classList.replace('flex', 'hidden'); showToast('Staff saved!');
    });

    document.getElementById('staff-table-body')?.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-staff-btn')) {
            const s = allStaff.find(x => x.id === id);
            if (currentUserRole !== 'superadmin' && (s.role === 'admin' || s.role === 'superadmin')) { return showToast("Action restricted.", true); }

            document.getElementById('staff-id').value = s.id; document.getElementById('staff-uid').value = s.id;
            document.getElementById('staff-uid').readOnly = true; document.getElementById('staff-name').value = s.name;
            
            restrictRoleSelection();
            document.getElementById('staff-role-select').value = s.role;
            
            const sBranches = s.accessibleBranches || (s.branchId ? [s.branchId] : []);
            renderStaffBranchCheckboxes(sBranches);
            updateStaffDepartmentOptions(s.departmentId);
            
            document.getElementById('perm-process').checked = !!s.permissions?.canProcessOrders;
            document.getElementById('perm-receive').checked = !!s.permissions?.canReceive;
            document.getElementById('perm-pay').checked = !!s.permissions?.canPay;

            document.getElementById('staff-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-staff-btn') && confirm("Remove staff from app?")) {
            const s = allStaff.find(x => x.id === id);
            if (currentUserRole !== 'superadmin' && (s.role === 'admin' || s.role === 'superadmin')) return showToast("Action restricted.", true);
            await deleteDoc(doc(db, "users", id)); showToast('Staff removed.');
        }
    });

    document.getElementById('add-department-btn')?.addEventListener('click', () => {
        document.getElementById('department-form').reset(); document.getElementById('department-id').value = '';
        const deptBranchSelect = document.getElementById('department-branch-select');
        
        if (currentUserRole === 'admin') {
            deptBranchSelect.innerHTML = '';
            currentUserAccessibleBranches.forEach(bId => {
                const b = allBranches.find(x => x.id === bId);
                if (b) deptBranchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
            });
        }
        document.getElementById('department-modal').classList.replace('hidden', 'flex');
    });

    document.getElementById('department-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('department-id').value;
        const data = { 
            name_en: document.getElementById('department-name_en').value, name_th: document.getElementById('department-name_th').value,
            branchId: document.getElementById('department-branch-select').value
        };
        if (id) await updateDoc(doc(db, "departments", id), data); else await addDoc(collection(db, "departments"), data);
        document.getElementById('department-modal').classList.replace('flex', 'hidden'); showToast('Department saved!');
    });

    document.getElementById('departments-table-body')?.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-department-btn')) {
            const d = allDepartments.find(x => x.id === id);
            document.getElementById('department-id').value = d.id; document.getElementById('department-name_en').value = d.name_en;
            document.getElementById('department-name_th').value = d.name_th; 
            
            const deptBranchSelect = document.getElementById('department-branch-select');
            if (currentUserRole === 'admin') {
                deptBranchSelect.innerHTML = '';
                currentUserAccessibleBranches.forEach(bId => {
                    const b = allBranches.find(x => x.id === bId);
                    if (b) deptBranchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
                });
            }
            deptBranchSelect.value = d.branchId;
            document.getElementById('department-modal').classList.replace('hidden', 'flex');
        }
        if (e.target.classList.contains('delete-department-btn') && confirm("Delete department?")) {
            if (allStaff.some(s => s.departmentId === id)) return alert('Cannot delete: assigned to staff.');
            await deleteDoc(doc(db, "departments", id)); showToast('Department deleted.');
        }
    });
    
    window.addEventListener('branchContextChanged', (e) => {
        renderStaffTable();
        renderDepartmentsTable();
        renderBranchesTable();
    }); 
}

init();