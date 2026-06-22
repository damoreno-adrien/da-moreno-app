import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from "./config.js";
import { translations, currentLang } from "./i18n.js";

export let currentUserRole = "staff"; 
export let currentUserBranchId = "";  
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
                    userDepartmentId = userData.departmentId || null;
                    activeBranchContext = currentUserRole === 'superadmin' ? 'ALL' : currentUserBranchId;

                    const userDisplay = document.getElementById('user-display');
                    if(userDisplay && userData.name) {
                        userDisplay.textContent = `${translations[currentLang].logged_in_as} ${userData.name} (${currentUserRole.toUpperCase()})`;
                    }
                    
                    if (requireAdmin && currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
                        denyAccess();
                        return;
                    }

                    const appContainer = document.getElementById('app');
                    if(appContainer) appContainer.classList.remove('hidden');
                    
                    if(!requireAdmin && (currentUserRole === 'admin' || currentUserRole === 'superadmin')) {
                        document.getElementById('admin-link')?.classList.remove('hidden');
                        document.getElementById('admin-link-mobile')?.classList.remove('hidden');
                    }

                    if(requireAdmin) applyRoleBasedUI();
                    if(onSuccessCallback) onSuccessCallback(userData);

                } else {
                    if(requireAdmin) denyAccess(); 
                    else if(onSuccessCallback) onSuccessCallback(null);
                }
            } catch (error) {
                console.error("Erreur d'initialisation Auth :", error);
                document.body.innerHTML = `<div class="p-8 text-center mt-10"><h1 class="text-2xl text-red-600 font-bold mb-4">Erreur Firebase</h1><p>${error.message}</p></div>`;
            }
        } else {
            // SÉCURITÉ ANTI-BOUCLE : Ne pas rediriger si on est déjà sur login
            if (!window.location.pathname.includes('login')) {
                const isDir = window.location.pathname.includes('/admin/');
                window.location.replace(isDir ? '../login.html' : './login.html'); 
            }
        }
    });
}

function denyAccess() {
    const accessDeniedMessage = document.getElementById('access-denied');
    if(accessDeniedMessage) accessDeniedMessage.classList.remove('hidden');
    const isDir = window.location.pathname.includes('/admin/');
    setTimeout(() => { window.location.href = isDir ? '../index.html' : './index.html'; }, 3000); 
}

export function applyRoleBasedUI() {
    const branchContextContainer = document.getElementById('branch-context-container');
    const superadminBranchesSection = document.getElementById('superadmin-branches-section');
    if (currentUserRole === 'superadmin') {
        if(branchContextContainer) branchContextContainer.classList.remove('hidden');
        if(superadminBranchesSection) superadminBranchesSection.classList.remove('hidden');
    } else {
        if(branchContextContainer) branchContextContainer.classList.add('hidden');
        if(superadminBranchesSection) superadminBranchesSection.classList.add('hidden');
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

export function setActiveBranchContext(context) { activeBranchContext = context; }