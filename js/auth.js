import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
                    
                    // Récupère le contexte sauvegardé ou met la valeur par défaut
                    const savedContext = localStorage.getItem('activeBranchContext');
                    activeBranchContext = currentUserRole === 'superadmin' ? (savedContext || 'ALL') : currentUserBranchId;

                    const userDisplay = document.getElementById('user-display');
                    if(userDisplay && userData.name) {
                        userDisplay.textContent = `${translations[currentLang].logged_in_as} ${userData.name}`;
                    }
                    
                    if (requireAdmin && currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
                        denyAccess();
                        return;
                    }

                    const appContainer = document.getElementById('app');
                    if(appContainer) appContainer.classList.remove('hidden');
                    
                    if(!requireAdmin && (currentUserRole === 'admin' || currentUserRole === 'superadmin')) {
                        document.getElementById('admin-link')?.classList.replace('hidden', 'flex');
                    }

                    if(requireAdmin) applyRoleBasedUI();
                    
                    // Initialisation du sélecteur de succursale pour le Superadmin
                    if (currentUserRole === 'superadmin') {
                        await setupBranchContext();
                    }

                    // Initialisation de la pastille de commandes
                    setupOrdersBadge();

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
            if (!window.location.pathname.includes('login')) {
                const isDir = window.location.pathname.includes('/admin/');
                window.location.replace(isDir ? '../login.html' : './login.html'); 
            }
        }
    });
}

// Fonction qui charge les branches et gère le changement de contexte
async function setupBranchContext() {
    const select = document.getElementById('branch-context-select');
    if (!select) return;

    try {
        const snapshot = await getDocs(collection(db, "branches"));
        select.innerHTML = '<option value="ALL">ALL BRANCHES</option>';
        
        snapshot.forEach(docSnap => {
            select.insertAdjacentHTML('beforeend', `<option value="${docSnap.id}">${docSnap.data().name}</option>`);
        });

        // Applique la valeur sauvegardée
        select.value = activeBranchContext;

        // Écoute les changements (Sans rechargement de page)
        select.addEventListener('change', (e) => {
            activeBranchContext = e.target.value;
            localStorage.setItem('activeBranchContext', activeBranchContext);
            
            // Diffusion de l'événement à toutes les pages
            window.dispatchEvent(new CustomEvent('branchContextChanged', {
                detail: { branchId: activeBranchContext }
            }));
        });
    } catch (error) {
        console.error("Erreur chargement branches:", error);
    }
}

function setupOrdersBadge() {
    const badge = document.getElementById('pending-orders-badge');
    if (!badge) return;
    
    // Requête pour écouter les commandes en attente (Modifie "pending" si ton statut est différent)
    const q = query(collection(db, "orders"), where("status", "==", "pending"));
    
    onSnapshot(q, (snapshot) => {
        const count = snapshot.docs.length;
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
    setTimeout(() => { window.location.href = isDir ? '../index.html' : './index.html'; }, 3000); 
}

export function applyRoleBasedUI() {
    const branchContextContainer = document.getElementById('branch-context-container');
    const superadminBranchesSection = document.getElementById('superadmin-branches-section');
    const roleBadge = document.getElementById('role-badge');

    // Affichage dynamique du rôle à côté du titre
    if (roleBadge) {
        roleBadge.textContent = currentUserRole;
        roleBadge.classList.remove('hidden');
        roleBadge.className = "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ml-2"; 
        
        if (currentUserRole === 'superadmin') roleBadge.classList.add('bg-purple-100', 'text-purple-800');
        else if (currentUserRole === 'admin') roleBadge.classList.add('bg-blue-100', 'text-blue-800');
        else roleBadge.classList.add('bg-gray-100', 'text-gray-800');
    }

    if (currentUserRole === 'superadmin') {
        if(branchContextContainer) branchContextContainer.classList.replace('hidden', 'flex');
        if(superadminBranchesSection) superadminBranchesSection.classList.remove('hidden');
        document.getElementById('admin-link')?.classList.replace('hidden', 'flex');
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

export function setActiveBranchContext(context) { 
    activeBranchContext = context; 
    localStorage.setItem('activeBranchContext', context);
}