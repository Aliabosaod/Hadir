import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, setDoc, doc, getDocs, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABP_eeOuqYlpSd848PlpKvx71oFLsxREQ",
  authDomain: "hadir-c203e.firebaseapp.com",
  projectId: "hadir-c203e",
  storageBucket: "hadir-c203e.firebasestorage.app",
  messagingSenderId: "510890207479",
  appId: "1:510890207479:web:7f710f815631b4c8f80bf2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
window.auth = auth;
window.db = db;

window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.onAuthStateChanged = onAuthStateChanged;
window.signOut = signOut;

window.collection = collection;
window.setDoc = setDoc;
window.doc = doc;
window.getDocs = getDocs;
window.getDoc = getDoc;
window.query = query;
window.where = where;