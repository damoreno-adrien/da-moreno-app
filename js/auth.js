import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from "./config.js";
import { translations, currentLang } from "./i18n.js";

export let currentUserRole = "staff"; 
export let currentUserBranchId = ""; 
export let currentUserAccessibleBranches = []; 
export let currentUserPermissions = { canReceive: false, canPay: false, canProcessOrders: false }; 
export let activeBranchContext = "ALL"; 
export let currentUser = null;
export let userDepartmentId = null;

export function initAuth(onSuccessCallback, requireAdmin = true) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            try {
                const userDocRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(userDocRef);
                
                if (docSnap.exists()){
                    const userData = docSnap.data();
                    currentUserRole = userData.role || 'staff';
                    currentUserBranchId = userData.branchId || '';
                    
                    currentUserAccessibleBranches = userData.accessibleBranches || (userData.branchId ? [userData.branchId] : []);
                    currentUserPermissions = userData.permissions || { canReceive: false, canPay: false, canProcessOrders: false };
                    userDepartmentId = userData.departmentId || null;
                    
                    const savedContext = localStorage.getItem('activeBranchContext');
                    if (currentUserRole === 'superadmin') {
                        activeBranchContext = savedContext || 'ALL';
                    } else if (currentUserRole === 'admin' || currentUserPermissions.canProcessOrders) {
                        if (!savedContext || savedContext === 'ALL' || !currentUserAccessibleBranches.includes(savedContext)) {
                            activeBranchContext = currentUserAccessibleBranches[0] || '';
                        } else {
                            activeBranchContext = savedContext;
                        }
                    } else {
                        activeBranchContext = currentUserAccessibleBranches[0] || currentUserBranchId;
                    }

                    const userDisplay = document.getElementById('user-display');
                    if(userDisplay && userData.name) {
                        userDisplay.textContent = `${translations[currentLang].logged_in_as} ${userData.name}`;
                    }
                    
                    // AUTORISATION : Admin, Superadmin, OU Staff avec canProcessOrders
                    if (requireAdmin && currentUserRole !== 'admin' && currentUserRole !== 'superadmin' && !currentUserPermissions.canProcessOrders) {
                        denyAccess();
                        return;
                    }

                    const appContainer = document.getElementById('app');
                    if(appContainer) appContainer.classList.remove('hidden');
                    
                    // CORRECTION : Ré-affichage du bouton Admin sur le Front-end pour les rôles autorisés
                    if (!requireAdmin && (currentUserRole === 'superadmin' || currentUserRole === 'admin' || currentUserPermissions.canProcessOrders)) {
                        const adminLink = document.getElementById('admin-link');
                        const adminLinkMobile = document.getElementById('admin-link-mobile');
                        if (adminLink) {
                            adminLink.classList.remove('hidden');
                            adminLink.classList.add('flex');
                        }
                        if (adminLinkMobile) {
                            adminLinkMobile.classList.remove('hidden');
                            adminLinkMobile.classList.add('block');
                        }
                    }

                    if(requireAdmin) applyRoleBasedUI();
                    
                    if (currentUserRole === 'superadmin' || currentUserAccessibleBranches.length > 1) {
                        await setupBranchContext();
                    }

                    setupOrdersBadge();
                    if(onSuccessCallback) onSuccessCallback(userData);

                } else {
                    if(requireAdmin) denyAccess(); 
                    else if(onSuccessCallback) onSuccessCallback(null);
                }
            } catch (error) {
                console.error("Auth Error:", error);
                document.body.innerHTML = `<div class="p-8 text-center mt-10"><h1 class="text-2xl text-red-600 font-bold mb-4">Error</h1><p>${error.message}</p></div>`;
            }
        } else {
            if (!window.location.pathname.includes('login')) {
                const isDir = window.location.pathname.includes('/admin/');
                window.location.replace(isDir ? '../login.html' : './login.html'); 
            }
        }
    });
}

async function setupBranchContext() {
    const select = document.getElementById('branch-context-select');
    if (!select) return;

    try {
        const snapshot = await getDocs(collection(db, "branches"));
        select.innerHTML = '';
        
        if (currentUserRole === 'superadmin') {
            select.innerHTML += '<option value="ALL">ALL BRANCHES</option>';
            snapshot.forEach(docSnap => {
                select.insertAdjacentHTML('beforeend', `<option value="${docSnap.id}">${docSnap.data().name}</option>`);
            });
        } else {
            snapshot.forEach(docSnap => {
                if (currentUserAccessibleBranches.includes(docSnap.id)) {
                    select.insertAdjacentHTML('beforeend', `<option value="${docSnap.id}">${docSnap.data().name}</option>`);
                }
            });
        }

        select.value = activeBranchContext;

        select.addEventListener('change', (e) => {
            activeBranchContext = e.target.value;
            localStorage.setItem('activeBranchContext', activeBranchContext);
            window.dispatchEvent(new CustomEvent('branchContextChanged', {
                detail: { branchId: activeBranchContext }
            }));
        });
    } catch (error) {
        console.error("Error loading branches:", error);
    }
}

function setupOrdersBadge() {
    const badge = document.getElementById('pending-orders-badge');
    if (!badge) return;
    
    const q = query(collection(db, "orders"), where("status", "==", "Pending"));
    onSnapshot(q, (snapshot) => {
        let count = 0;
        snapshot.docs.forEach(doc => {
            const order = doc.data();
            if (currentUserRole === 'superadmin' || currentUserAccessibleBranches.includes(order.branchId)) {
                count++;
            }
        });

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

function denyAccess() {
    const accessDeniedMessage = document.getElementById('access-denied');
    if(accessDeniedMessage) accessDeniedMessage.classList.remove('hidden');
    const isDir = window.location.pathname.includes('/admin/');
    setTimeout(() => { window.location.href = isDir ? '../index.html' : './index.html'; }, 2000); 
}

export function applyRoleBasedUI() {
    const branchContextContainer = document.getElementById('branch-context-container');
    const superadminBranchesSection = document.getElementById('superadmin-branches-section');
    const roleBadge = document.getElementById('role-badge');

    if (roleBadge) {
        let displayRole = currentUserRole;
        if (currentUserRole === 'staff' && currentUserPermissions.canProcessOrders) displayRole = "Procurement Staff";
        
        roleBadge.textContent = displayRole;
        roleBadge.classList.remove('hidden');
        roleBadge.className = "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ml-2"; 
        
        if (currentUserRole === 'superadmin') roleBadge.classList.add('bg-purple-100', 'text-purple-800');
        else if (currentUserRole === 'admin') roleBadge.classList.add('bg-blue-100', 'text-blue-800');
        else roleBadge.classList.add('bg-green-100', 'text-green-800');
    }

    if (currentUserRole === 'superadmin' || currentUserAccessibleBranches.length > 1) {
        if(branchContextContainer) branchContextContainer.classList.replace('hidden', 'flex');
    } else {
        if(branchContextContainer) branchContextContainer.classList.add('hidden');
    }

    if (currentUserRole === 'superadmin') {
        if(superadminBranchesSection) superadminBranchesSection.classList.remove('hidden');
        document.getElementById('admin-link')?.classList.remove('hidden');
        document.getElementById('admin-link')?.classList.add('flex');
    } else {
        if(superadminBranchesSection) superadminBranchesSection.classList.add('hidden');
    }

    // Sécurité UI : On masque le reste de l'Admin Panel si c'est juste un Staff Procurement
    if (currentUserRole === 'staff') {
        document.querySelectorAll('a[href="catalog.html"], a[href="suppliers.html"], a[href="organization.html"]').forEach(el => el.classList.add('hidden'));
    }
}

export function setupLogout() {
    const logoutAction = () => {
        signOut(auth);
        localStorage.removeItem('appLanguage');
        if(currentUser) sessionStorage.removeItem(`cart_${currentUser.uid}`);
        const isDir = window.location.pathname.includes('/admin/');
        window.location.href = isDir ? '../login.html' : './login.html';
    };
    document.getElementById('logout-btn')?.addEventListener('click', logoutAction);
    document.getElementById('logout-btn-mobile')?.addEventListener('click', logoutAction);
}

export function setActiveBranchContext(context) { 
    activeBranchContext = context; 
    localStorage.setItem('activeBranchContext', context);
}