// Master Database Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvAyr-4CUAYPXLMBwZ-L9hBlmDcrOjWpA",
  authDomain: "attendease-963df.firebaseapp.com",
  projectId: "attendease-963df",
  storageBucket: "attendease-963df.firebasestorage.app",
  messagingSenderId: "107756709284",
  appId: "1:107756709284:web:fd8765b97a73f2ce7d8d31",
};

// Initialize Master Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Expose globally for other modules
window.db = db;
window.auth = auth;
window.firebase = firebase;

console.log('🔐 Master DB initialized');