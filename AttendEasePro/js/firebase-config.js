// js/firebase-config.js
// ══════════════════════════════════════════════════════
// FIREBASE CONFIG - Master Database Connection
// ══════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "AIzaSyCvAyr-4CUAYPXLMBwZ-L9hBlmDcrOjWpA",
  authDomain:        "attendease-963df.firebaseapp.com",
  projectId:         "attendease-963df",
  storageBucket:     "attendease-963df.firebasestorage.app",
  messagingSenderId: "107756709284",
  appId:             "1:107756709284:web:fd8765b97a73f2ce7d8d31",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Create instances
const db = firebase.firestore();
const auth = firebase.auth();

// ✅ CRITICAL: Expose to GLOBAL window object so other files can access
window.db = db;
window.auth = auth;
window.firebase = firebase;

// Debug log to confirm it ran
console.log('🔐 firebase-config.js loaded | window.db:', typeof window.db);

// Session Guard
function requireAuth(redirect = 'index.html') {
  const user = sessionStorage.getItem('attendEaseUser');
  if (!user) {
    document.body.innerHTML = `<div class="d-flex align-items-center justify-content-center vh-100 bg-light"><div class="text-center p-5 bg-white rounded shadow"><h3 class="text-danger">🔒 Session not found</h3><p class="text-muted">Please log in first to access the admin portal.</p><a href="${redirect}" class="btn btn-primary mt-2">Go to Login</a></div></div>`;
    return false;
  }
  return JSON.parse(user);
}

// Helpers
const formatDate = (ts) => ts ? new Date(ts.seconds * 1000).toISOString().split('T')[0] : '';
const formatTime = (val) => val || '--:--';

async function loadTable(collection, tableId, renderFn) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="100%" class="text-center text-muted py-3">Loading…</td></tr>';
  try {
    const snap = await db.collection(collection).orderBy('createdAt', 'desc').get();
    const rows = [];
    snap.forEach(doc => rows.push(renderFn(doc.id, doc.data())));
    tbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="100%" class="text-center text-muted py-3">No records found</td></tr>';
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="100%" class="text-center text-danger py-3">Failed to load data</td></tr>`;
  }
}

async function saveDoc(collection, data, docId = null) {
  data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  if (docId) await db.collection(collection).doc(docId).set(data, { merge: true });
  else await db.collection(collection).add(data);
}

window.deleteDoc = async (collection, docId) => {
  if (confirm('Are you sure? This action cannot be undone.')) {
    await db.collection(collection).doc(docId).delete();
    location.reload();
  }
};