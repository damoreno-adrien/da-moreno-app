import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDIqmK_P2JWz3Vr5-u_2b6s6hhyWO9c-sg",
    authDomain: "da-moreno-orders-app.firebaseapp.com",
    projectId: "da-moreno-orders-app",
    storageBucket: "da-moreno-orders-app.appspot.com",
    messagingSenderId: "545175404745",
    appId: "1:545175404745:web:4dc2df2c7d3f7b040d18",
    measurementId: "G-D7K1PT81Q4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);