/* ══════════════════════════════════════════════════════
   CONFIG.JS - Master Firebase Config & Client Config Manager
   Dependencies: 
     - firebase SDK (global)
     - DOM elements in superadmin.html
   Creates: window.masterDb (if not already defined)
   ══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   MASTER FIREBASE CONFIG (Hardcoded)
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
   Initialize Master Firebase (if not already done)
   ══════════════════════════════════════════════════════ */
function initMasterFirebase() {
  // Only initialize if not already done and firebase is available
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(MASTER_CONFIG);
    console.log('✅ Master Firebase initialized');
  }
  
  // Expose masterDb globally if not already defined
  if (typeof window.masterDb === 'undefined') {
    window.masterDb = firebase.firestore();
    console.log('✅ window.masterDb exposed');
  }
  
  return window.masterDb;
}

// Auto-initialize on script load
initMasterFirebase();

/* ══════════════════════════════════════════════════════
   PAGE LOAD HANDLERS
   ══════════════════════════════════════════════════════ */

/**
 * Loads Master config display on Config page
 */
function loadConfigPage() {
  console.log('🔧 loadConfigPage() called');
  
  const display = document.getElementById('masterConfigDisplay');
  if (display) {
    display.value = JSON.stringify(MASTER_CONFIG, null, 2);
  }
}

/**
 * Loads Init page (placeholder for future init logic)
 */
function loadInitPage() {
  console.log('🚀 loadInitPage() called');
}

/* ══════════════════════════════════════════════════════
   CONFIG PARSING & PREVIEW
   ══════════════════════════════════════════════════════ */

/**
 * Parses client Firebase config from textarea input
 * Shows structured preview and validates required fields
 */
function parseClientConfig() {
  console.log('🔍 parseClientConfig() called');
  
  const input = document.getElementById('clientConfigInput')?.value.trim();
  const result = document.getElementById('configResult');
  const preview = document.getElementById('configPreview');
  const previewContent = document.getElementById('configPreviewContent');
  const btnUpdate = document.getElementById('btnUpdateConfig');
  
  if (!input) {
    if (result) result.innerHTML = '<div class="result-box error">❌ Please paste a Firebase config first.</div>';
    if (preview) preview.style.display = 'none';
    if (btnUpdate) btnUpdate.disabled = true;
    return;
  }
  
  try {
    // Try to parse as JSON first
    let config;
    try {
      config = JSON.parse(input);
    } catch (e) {
      // Try to parse as JavaScript object format
      config = _parseJSObject(input);
    }
    
    // Validate required fields
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Show structured preview with ALL 6 fields
    if (previewContent) {
      previewContent.innerHTML = `
        <div style="background:#f8f9fa;padding:12px;border-radius:6px;font-family:monospace;font-size:0.85rem;">
          <div style="margin-bottom:8px;"><strong style="color:#00838F;">firebaseConfig</strong> <span style="color:#6B8A8F;font-size:0.8rem;">(map)</span></div>
          <div style="padding-left:16px;">
            <div class="preview-field"><span class="preview-label">apiKey:</span><span class="preview-value">${config.apiKey ? config.apiKey.substring(0, 20) + '...' : '—'}</span></div>
            <div class="preview-field"><span class="preview-label">authDomain:</span><span class="preview-value">${config.authDomain}</span></div>
            <div class="preview-field"><span class="preview-label">projectId:</span><span class="preview-value">${config.projectId}</span></div>
            <div class="preview-field"><span class="preview-label">storageBucket:</span><span class="preview-value">${config.storageBucket}</span></div>
            <div class="preview-field"><span class="preview-label">messagingSenderId:</span><span class="preview-value">${config.messagingSenderId}</span></div>
            <div class="preview-field"><span class="preview-label">appId:</span><span class="preview-value">${config.appId ? config.appId.substring(0, 20) + '...' : '—'}</span></div>
          </div>
        </div>
      `;
    }
    if (preview) preview.style.display = 'block';
    if (result) result.innerHTML = '<div class="result-box success">✅ Config parsed successfully! All 6 fields detected. Click "💾 Update Config" to save to Firestore.</div>';
    
    // Store parsed config for later use
    window._parsedClientConfig = config;
    if (btnUpdate) btnUpdate.disabled = false;
    
    console.log('✅ Config parsed:', { projectId: config.projectId });
    
  } catch (e) {
    console.error('❌ Parse error:', e);
    if (result) {
      result.innerHTML = `<div class="result-box error">❌ Parse Error: ${e.message}<br><br>Expected format:<br><pre>{
  "apiKey": "AIzaSy...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}</pre></div>`;
    }
    if (preview) preview.style.display = 'none';
    if (btnUpdate) btnUpdate.disabled = true;
  }
}

/**
 * Helper: Parse JavaScript object format (non-JSON)
 * @private
 */
function _parseJSObject(str) {
  str = str.replace(/\/\/.*$/gm, '').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  const config = {};
  const lines = str.split('\n');
  
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('//')) continue;
    
    const match = line.match(/["']?(\w+)["']?\s*:\s*["']?([^"',}]+)["']?/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      config[key] = value;
    }
  }
  
  return config;
}

/* ══════════════════════════════════════════════════════
   FIRESTORE OPERATIONS (Master DB)
   ══════════════════════════════════════════════════════ */

/**
 * Checks if company exists in Master Firestore
 */
async function checkCompanyExists() {
  console.log('🔍 checkCompanyExists() called');
  
  const companyId = document.getElementById('configCompanyId')?.value.trim().toUpperCase();
  const btnUpdate = document.getElementById('btnUpdateConfig');
  
  if (!companyId) {
    if (btnUpdate) btnUpdate.disabled = true;
    return;
  }
  
  try {
    const snap = await window.masterDb.collection('companies').doc(companyId).get();
    if (!snap.exists) {
      const result = document.getElementById('configResult');
      if (result) result.innerHTML = '<div class="result-box error">❌ Company not found in Master Firestore.</div>';
      if (btnUpdate) btnUpdate.disabled = true;
    } else {
      const data = snap.data();
      const result = document.getElementById('configResult');
      if (result) result.innerHTML = `<div class="result-box success">✅ Company found: ${data.companyName || companyId}</div>`;
      if (btnUpdate) btnUpdate.disabled = !window._parsedClientConfig;
    }
  } catch (e) {
    console.error('❌ Check error:', e);
    if (btnUpdate) btnUpdate.disabled = true;
  }
}

/**
 * Updates client Firebase config for a company in Master Firestore
 */
async function updateClientConfig() {
  console.log('💾 updateClientConfig() called');
  
  const companyId = document.getElementById('configCompanyId')?.value.trim().toUpperCase();
  const result = document.getElementById('configResult');
  const config = window._parsedClientConfig;
  
  if (!companyId || !config) {
    if (result) result.innerHTML = '<div class="result-box error">❌ Please enter Company ID and parse config first.</div>';
    return;
  }
  
  // Show confirmation with field details
  const confirmMsg = `Update Client Firebase Config for Company: ${companyId}?\n\n📦 firebaseConfig map:\n• apiKey: ${config.apiKey?.substring(0, 20)}...\n• authDomain: ${config.authDomain}\n• projectId: ${config.projectId}\n• storageBucket: ${config.storageBucket}\n• messagingSenderId: ${config.messagingSenderId}\n• appId: ${config.appId?.substring(0, 20)}...`;
  
  if (!confirm(confirmMsg)) {
    return;
  }
  
  const btn = document.getElementById('btnUpdateConfig');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
  
  try {
    // Save to Firestore with correct structure
    await window.masterDb.collection('companies').doc(companyId).update({
      firebaseConfig: {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      },
      updatedAt: new Date()
    });
    
    if (result) {
      result.innerHTML = `<div class="result-box success">✅ Config updated successfully for ${companyId}!<br><br>📦 firebaseConfig saved with 6 fields:<br>• projectId: ${config.projectId}<br>• authDomain: ${config.authDomain}</div>`;
    }
    console.log('✅ Config updated for:', companyId);
    
  } catch (e) {
    console.error('❌ Update error:', e);
    if (result) result.innerHTML = `<div class="result-box error">❌ Update Error: ${e.message}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Update Config'; }
  }
}

/* ══════════════════════════════════════════════════════
   EXPORTS (for external use if needed)
   ══════════════════════════════════════════════════════ */
// These are already global functions, but explicit export for clarity:
// - initMasterFirebase()
// - loadConfigPage()
// - loadInitPage()
// - parseClientConfig()
// - checkCompanyExists()
// - updateClientConfig()