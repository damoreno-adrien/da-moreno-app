import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from "./config.js";
import { setLanguage, setupLangSwitcher, translations, currentLang } from "./i18n.js";

// Traductions locales propres au login
translations.en = { ...translations.en, 
    error_title: "Error:", email_label: "Email Address", password_label: "Password", sign_in: "Sign In", 
    forgot_password: "Forgot Password?", invalid_credentials: "Invalid email or password. Please try again.",
    reset_prompt: "Please enter your email address to receive a password reset link.", 
    reset_success: "Password reset email sent! Please check your inbox.", reset_error: "Could not send password reset email. Please check the address and try again."
};
translations.th = { ...translations.th, 
    error_title: "ข้อผิดพลาด:", email_label: "ที่อยู่อีเมล", password_label: "รหัสผ่าน", sign_in: "เข้าสู่ระบบ", 
    forgot_password: "ลืมรหัสผ่าน?", invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง",
    reset_prompt: "โปรดป้อนที่อยู่อีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน", 
    reset_success: "ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว! โปรดตรวจสอบกล่องจดหมายของคุณ", reset_error: "ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้ โปรดตรวจสอบที่อยู่และลองอีกครั้ง"
};

// Fonction de routage centralisée
async function handleRedirection(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        let targetUrl = './index.html'; 
        
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role === 'admin' || role === 'superadmin') {
                targetUrl = './admin/orders.html';
            }
        }
        window.location.replace(targetUrl); 
    } catch (error) {
        console.error("Erreur de routage :", error);
        throw error; // Permet au bloc catch du formulaire de stopper l'animation
    }
}

function init() {
    setLanguage(currentLang);
    setupLangSwitcher();
    setupEventListeners();

    // Auto-redirection si l'utilisateur arrive sur la page en étant déjà connecté
    onAuthStateChanged(auth, (user) => {
        if (user) {
            handleRedirection(user).catch(() => {});
        }
    });
}

function setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');
    const errorMessageDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginButton.disabled = true;
        loginText.classList.add('hidden');
        loginSpinner.classList.remove('hidden');
        errorMessageDiv.classList.add('hidden');

        try {
            // Tentative de connexion
            const userCredential = await signInWithEmailAndPassword(auth, loginForm.email.value, loginForm.password.value);
            // Redirection immédiate
            await handleRedirection(userCredential.user);
        } catch (error) {
            console.error("Login Error:", error);
            errorText.textContent = translations[currentLang].invalid_credentials;
            errorMessageDiv.classList.remove('hidden');
            
            // On stoppe l'animation et on rend la main à l'utilisateur
            loginButton.disabled = false;
            loginText.classList.remove('hidden');
            loginSpinner.classList.add('hidden');
        }
    });

    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        const email = prompt(translations[currentLang].reset_prompt);
        if(email) {
            sendPasswordResetEmail(auth, email)
                .then(() => alert(translations[currentLang].reset_success))
                .catch(() => alert(translations[currentLang].reset_error));
        }
    });
}

init();