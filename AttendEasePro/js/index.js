/* ══════════════════════════════════════════════════════
   ATTENDEASE - INDEX.JS (Login Page Logic)
   Purpose: Handle admin login, validate company, store session, redirect cleanly
   Security: Company ID stored in sessionStorage (NOT in URL)
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   MASTER FIREBASE CONFIG (Hardcoded - Super Admin Project)
══════════════════════════════════════════════════════ */
const MASTER_CONFIG = {
  apiKey: "AIzaSyCvAyr-4CUAYPXLMBwZ-L9hBlmDcrOjWpA",
  authDomain: "attendease-963df.firebaseapp.com",
  projectId: "attendease-963df",
  storageBucket: "attendease-963df.firebasestorage.app",
  messagingSenderId: "107756709284",
  appId: "1:107756709284:web:fd8765b97a73f2ce7d8d31",
};

/* ══════════════════════════════════════════════════════
   Initialize Master Firebase
══════════════════════════════════════════════════════ */
if (!firebase.apps.length) {
  firebase.initializeApp(MASTER_CONFIG);
  console.log('✅ Master Firebase initialized');
}
const masterAuth = firebase.auth();
const masterDb = firebase.firestore();

console.log("✅ Master Firebase ready");

/* ══════════════════════════════════════════════════════
   Utility: Show error message
══════════════════════════════════════════════════════ */
function showErr(el, msg) {
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

/* ══════════════════════════════════════════════════════
   Toggle password visibility
══════════════════════════════════════════════════════ */
function togglePw() {
  const inp = document.getElementById('lPassword');
  const ic = document.getElementById('eyeIcon');
  if (!inp || !ic) return;
  
  if (inp.type === 'password') {
    inp.type = 'text';
    ic.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type = 'password';
    ic.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

/* ══════════════════════════════════════════════════════
   Clear form on page load
══════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  const cid = document.getElementById('lCompanyId');
  const eml = document.getElementById('lEmail');
  const pw = document.getElementById('lPassword');
  const err = document.getElementById('loginError');
  
  if (cid) cid.value = '';
  if (eml) eml.value = '';
  if (pw) pw.value = '';
  if (err) { err.textContent = ''; err.style.display = 'none'; }
});

/* ══════════════════════════════════════════════════════
   LOGIN FUNCTION - Main auth logic
══════════════════════════════════════════════════════ */
async function doLogin() {
  console.log('🔐 Login called');
  
  const btn = document.getElementById('btnLogin');
  const err = document.getElementById('loginError');
  const cidIn = document.getElementById('lCompanyId');
  const emlIn = document.getElementById('lEmail');
  const pwIn = document.getElementById('lPassword');
  
  // Validate elements exist
  if (!btn || !err || !cidIn || !emlIn || !pwIn) { 
    console.error('❌ Missing form elements'); 
    return; 
  }
  
  // Get input values
  const companyId = cidIn.value.trim().toUpperCase();
  const email = emlIn.value.trim().toLowerCase();
  const password = pwIn.value;
  
  // Clear previous errors
  err.style.display = 'none';
  
  // Basic validation
  if (!companyId) { showErr(err, 'Company ID required'); return; }
  if (!email) { showErr(err, 'Email required'); return; }
  if (!password) { showErr(err, 'Password required'); return; }
  
  // Disable button, show loading
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';
  
  try {
    // 1. Authenticate with Firebase Auth (Master project)
    console.log('🔑 Authenticating with Firebase...');
    await masterAuth.signInWithEmailAndPassword(email, password);
    console.log('✅ Auth success:', email);
    
    // 2. Fetch and validate company config from Master Firestore
    console.log('🔍 Validating company:', companyId);
    const snap = await masterDb.collection('companies').doc(companyId).get();
    
    if (!snap.exists) {
      throw new Error('Company "' + companyId + '" not found. Contact Super Admin.');
    }
    
    const data = snap.data();
    
    // 3. Validate admin email matches company record
    if (data.adminEmail && data.adminEmail.toLowerCase() !== email) {
      throw new Error('Email not registered for company ' + companyId);
    }
    
    // 4. Check if company is active
    if (data.isActive === false) {
      throw new Error('Company ' + companyId + ' is inactive');
    }
    
    // 5. ✅ STORE COMPANY ID IN SESSION STORAGE (NOT in URL)
    sessionStorage.setItem('currentCompanyId', companyId);
    sessionStorage.setItem('currentUserEmail', email);
    console.log('✅ Session stored for company:', companyId);
    
    // 6. ✅ REDIRECT TO CLEAN URL (no query params, no hash)
    console.log('🚀 Redirecting to: manage.html');
    window.location.href = 'manage.html';  // ← Clean URL!
    
  } catch (e) {
    console.error('❌ Login error:', e);
    
    // User-friendly error messages
    let msg = e.message;
    if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
      msg = 'Invalid email or password';
    } else if (e.code === 'auth/too-many-requests') {
      msg = 'Too many attempts. Try again later';
    } else if (e.code === 'auth/invalid-email') {
      msg = 'Invalid email format';
    } else if (e.code === 'auth/network-request-failed') {
      msg = 'Network error. Please check your connection';
    }
    
    showErr(err, msg);
    btn.disabled = false;
    btn.innerHTML = 'Sign In';
    
    // Sign out on error to clean auth state
    masterAuth.signOut().catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════
   Handle Enter key in form fields
══════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen')?.classList.contains('active')) {
    const el = document.activeElement;
    if (el && ['lCompanyId','lEmail','lPassword'].includes(el.id)) {
      e.preventDefault();
      doLogin();
    }
  }
});

/* ══════════════════════════════════════════════════════
   Export for external use (if needed)
══════════════════════════════════════════════════════ */
// These functions are already global, but explicit for clarity:
// - doLogin()
// - togglePw()
// - showErr()