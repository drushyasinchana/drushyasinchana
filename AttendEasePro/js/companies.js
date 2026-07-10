/* ══════════════════════════════════════════════════════
   COMPANIES.JS - Company Management Module (Super Admin)
   ✅ FIXED: Logo field properly updates in Firestore
══════════════════════════════════════════════════════ */

// ✅ Global logo tracking variables
window.logoBlob = null;
window.logoType = null;
window.logoChanged = false;

/**
 * Loads companies from Master Firestore and renders table
 */
async function loadCompanies() {
  const tb = document.getElementById('companyTableBody');
  if (tb) tb.innerHTML = '<tr class="empty-row"><td colspan="10">Loading…</td></tr>';
  
  try {
    const snap = await fbDB.collection('companies').get();
    SA.companies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCompanies(SA.companies);
    if (typeof populateCompanySelect === 'function') populateCompanySelect();
  } catch(e) {
    console.error('❌ Load companies error:', e);
    if (typeof toast === 'function') toast('Failed to load companies: ' + e.message, 'error');
  }
}

/**
 * Renders company list to table body
 */
function renderCompanies(list) {
  const tb = document.getElementById('companyTableBody');
  if (!tb) return;
  
  if (!list.length) { 
    tb.innerHTML = '<tr class="empty-row"><td colspan="10">No companies found</td></tr>'; 
    return; 
  }
  
  tb.innerHTML = list.map(c => {
    // ✅ Logo display - Proper data URL reconstruction
    const logoHtml = c.logo && c.logo.length > 100
      ? `<img src="data:${c.logoType||'image/jpeg'};base64,${c.logo}" style="width:32px;height:32px;object-fit:contain;border-radius:4px;" alt="Logo">`
      : '<div style="width:32px;height:32px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.9rem;">🏢</div>';
    
    const releaseHtml = c.release 
      ? `<span class="badge badge-amber">${c.release}</span>`
      : '<span style="color:var(--muted);font-size:.75rem;">—</span>';
    
    return `
    <tr>
      <td style="text-align:center;">${logoHtml}</td>
      <td class="mono">${c.companyId||c.id}</td>
      <td><strong>${c.companyName||'—'}</strong></td>
      <td style="font-size:.8rem;color:var(--muted);">${c.adminEmail||'—'}</td>
      <td><span class="badge badge-blue">${c.plan||'basic'}</span></td>
      <td class="mono">${c.maxEmployees||'—'}</td>
      <td>${releaseHtml}</td>
      <td><span class="badge ${c.isActive?'badge-green':'badge-gray'}">${c.isActive?'Active':'Inactive'}</span></td>
      <td style="font-size:.78rem;">${c.endDate||'—'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='editCompany(${JSON.stringify(c)})'>Edit</button>
        <button class="btn btn-red btn-sm" onclick="confirmDelete('company','${c.id}','${(c.companyName||c.id).replace(/'/g,"\\'")}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

/**
 * Filters companies by search query and status
 */
function filterCompanies() {
  const q  = document.getElementById('companySearch')?.value.toLowerCase() || '';
  const st = document.getElementById('companyStatusFilter')?.value || '';
  
  const filtered = SA.companies.filter(c => {
    const mq = !q || [c.companyId, c.companyName, c.adminEmail, c.city].some(v => (v||'').toLowerCase().includes(q));
    const ms = !st || String(c.isActive) === st;
    return mq && ms;
  });
  
  renderCompanies(filtered);
}

/**
 * Opens edit modal with company data pre-filled
 */
function editCompany(c) {
  SA.editingCompanyId = c.id;
  document.getElementById('compFormTitle').textContent = 'Edit Company — ' + c.companyId;
  
  // ✅ CRITICAL: Reset logo tracking for this edit session
  window.logoChanged = false;
  
  // Text fields
  document.getElementById('cId').value = c.companyId || c.id;
  document.getElementById('cId').disabled = true;
  document.getElementById('cName').value = c.companyName || '';
  document.getElementById('cAdminEmail').value = c.adminEmail || '';
  document.getElementById('cPhone').value = c.contactPhone || '';
  document.getElementById('cPlan').value = c.plan || 'basic';
  document.getElementById('cMaxEmp').value = c.maxEmployees || 50;
  document.getElementById('cStartDate').value = c.startDate || '';
  document.getElementById('cEndDate').value = c.endDate || '';
  document.getElementById('cCity').value = c.city || '';
  document.getElementById('cIsActive').value = String(c.isActive !== false);
  document.getElementById('cSheetId').value = c.companySheetId || '';
  document.getElementById('cScriptUrl').value = c.companyScriptUrl || '';
  document.getElementById('cNotes').value = c.notes || '';
  
  // Firebase Config
  if (c.firebaseConfig && Object.keys(c.firebaseConfig).length > 0) {
    document.getElementById('cFirebaseConfig').value = JSON.stringify(c.firebaseConfig, null, 2);
  } else {
    document.getElementById('cFirebaseConfig').value = '';
  }
  
  // ✅ Logo preview - Load existing logo if present
  if (c.logo && c.logo.length > 100) {
    const preview = document.getElementById('logoPreview');
    const mimeType = c.logoType || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${c.logo}`;
    preview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;"/>`;
    
    // Store for display only - DON'T mark as changed
    window.logoBlob = dataUrl;
    window.logoType = mimeType;
  } else {
    window.logoBlob = null;
    window.logoType = null;
    const preview = document.getElementById('logoPreview');
    if (preview) {
      preview.innerHTML = '<div style="width:100%;height:100px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--muted);">No logo uploaded</div>';
    }
  }
  
  document.getElementById('cRelease').value = c.release || '';
  
  if (typeof nav === 'function') {
    const navBtn = document.querySelectorAll('.nav-item')[2];
    nav('addCompany', navBtn);
  }
}

/**
 * Preview and compress logo upload - ensures it fits Firestore 1MB limit
 */
function previewLogo(input) {
  const file = input.files[0];
  if (!file) return;
  
  console.log('📤 File selected:', file.name, file.type, file.size);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // ✅ Compress to max 800px width, JPEG at 0.7 quality
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate new dimensions (max 800px width, maintain aspect ratio)
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      
      console.log('📥 Compressed logo length:', compressed.length);
      
      // ✅ Validate size: must be under ~900KB to leave room for other fields
      if (compressed.length < 900000) {
        const preview = document.getElementById('logoPreview');
        preview.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:contain;"/>`;
        
        window.logoBlob = compressed;
        window.logoType = 'image/jpeg';
        window.logoChanged = true;
        
        console.log('✅ Compressed logo ready - logoChanged = true');
      } else {
        console.error('❌ Compressed logo still too large:', compressed.length, 'bytes');
        alert('Logo too large even after compression. Please use a smaller image.');
        input.value = ''; // Clear the input
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Saves company (Add or Edit) to Master Firestore AND syncs logo to Client Firestore
 * ✅ FIXED: Logo saves to both collections with size validation
 */
async function saveCompany() {
  console.log('🔍 saveCompany() START');
  
  const btn = document.getElementById('btnSaveCompany');
  const id  = document.getElementById('cId')?.value.trim().toUpperCase();
  const name= document.getElementById('cName')?.value.trim();
  const email=document.getElementById('cAdminEmail')?.value.trim();
  
  // Validation
  if (!id || !name || !email) {
    if (typeof showRes === 'function') showRes('companyResult','companyErr','Company ID, Name and Admin Email are required.', true);
    return;
  }
  
  // Validate Firebase Config JSON
  let firebaseConfig = {};
  try {
    const raw = document.getElementById('cFirebaseConfig')?.value.trim();
    if (raw) firebaseConfig = JSON.parse(raw);
  } catch(e) {
    if (typeof showRes === 'function') showRes('companyResult','companyErr','Invalid JSON in Firebase Config field.', true);
    return;
  }
  
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…'; }
  
  // ✅ LOGO EXTRACTION - WITH COMPRESSION & SIZE CHECK
  let logoBase64 = null;
  let logoType = null;
  
  if (window.logoChanged && window.logoBlob && window.logoBlob.startsWith('data:')) {
    try {
      const commaIndex = window.logoBlob.indexOf(',');
      if (commaIndex > 0) {
        const base64Data = window.logoBlob.substring(commaIndex + 1);
        
        // ✅ Validate: must be under ~900KB for Firestore limit
        if (base64Data && base64Data.length > 100 && base64Data.length < 900000) {
          logoBase64 = base64Data;
          const header = window.logoBlob.substring(0, commaIndex);
          const mimeMatch = header.match(/data:(image\/[a-z+]+);base64/);
          logoType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          
          console.log('✅ Logo extracted:', logoType, 'length:', logoBase64.length);
        } else {
          console.error('❌ Logo invalid or too large:', base64Data?.length, 'bytes');
          if (typeof showRes === 'function') showRes('companyResult','companyErr','Logo too large. Please use a smaller image (<900KB).', true);
          if (btn) { btn.disabled = false; btn.innerHTML = 'Save Company'; }
          return;
        }
      }
    } catch(err) {
      console.error('❌ Logo extraction error:', err);
    }
  }
  
  // ✅ Build Master data object
  const masterData = {
    companyId: id,
    companyName: name,
    adminEmail: email,
    contactPhone: document.getElementById('cPhone')?.value.trim(),
    plan: document.getElementById('cPlan')?.value,
    maxEmployees: parseInt(document.getElementById('cMaxEmp')?.value) || 50,
    startDate: document.getElementById('cStartDate')?.value,
    endDate: document.getElementById('cEndDate')?.value,
    city: document.getElementById('cCity')?.value.trim(),
    isActive: document.getElementById('cIsActive')?.value === 'true',
    firebaseConfig: firebaseConfig,
    release: document.getElementById('cRelease')?.value.trim(),
    companySheetId: document.getElementById('cSheetId')?.value.trim(),
    companyScriptUrl: document.getElementById('cScriptUrl')?.value.trim(),
    notes: document.getElementById('cNotes')?.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  
  // ✅ Add logo fields to Master data if valid
  if (logoBase64 && logoType) {
    masterData.logo = logoBase64;
    masterData.logoType = logoType;
    console.log('💾 Master: Logo fields added');
  }
  
  if (!SA.editingCompanyId) masterData.createdAt = new Date().toISOString();
  
  console.log('💾 Saving to Master Firestore:', {
    companyId: masterData.companyId,
    willUpdateLogo: !!(masterData.logo && masterData.logo.length > 100)
  });
  
  try {
    // ✅ 1. Save to MASTER Firestore (companies collection)
    await fbDB.collection('companies').doc(id).set(masterData, { merge: true });
    console.log('✅ Master Firestore saved');
    
    // ✅ 2. Sync logo to CLIENT Firestore (companyProfile collection)
    if (logoBase64 && logoType && firebaseConfig?.projectId) {
      console.log('🔄 Syncing logo to Client Firestore...');
      
      // Initialize temporary client app
      let clientApp;
      try {
        // Try to get existing app or create new one
        try {
          clientApp = firebase.app(`client-sync-${id}`);
        } catch(e) {
          clientApp = firebase.initializeApp(firebaseConfig, `client-sync-${id}`);
        }
        const clientDb = clientApp.firestore();
        
        // Update companyProfile with logoUrl (same base64 value)
        await clientDb.collection('companyProfile').doc(id).set({
          logoUrl: logoBase64,    // ✅ Same base64 as Master's logo field
          logoType: logoType,     // ✅ Same type as Master
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Client Firestore synced: logoUrl updated');
        
        // Cleanup temp app
        await clientApp.delete();
        
      } catch(clientErr) {
        console.error('⚠️ Client sync warning:', clientErr);
        // Don't fail the whole save if client sync fails
      }
    }
    
    // ✅ Success messages
    console.log('✅ Company saved successfully!');
    if (typeof toast === 'function') toast(SA.editingCompanyId ? 'Company updated!' : 'Company added!');
    if (typeof showRes === 'function') showRes('companyResult','companyErr', SA.editingCompanyId ? '✓ Company updated successfully' : '✓ Company added successfully');
    
    // ✅ Reset state
    SA.editingCompanyId = null;
    window.logoBlob = null;
    window.logoType = null;
    window.logoChanged = false;
    document.getElementById('compFormTitle').textContent = 'Add New Company';
    document.getElementById('cId').disabled = false;
    
    // Refresh lists
    loadCompanies();
    
  } catch(e) {
    console.error('❌ Save error:', e);
    if (typeof showRes === 'function') showRes('companyResult','companyErr','Error: ' + e.message, true);
  } finally {
    if (btn) { 
      btn.disabled = false; 
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save Company'; 
    }
  }
  
  console.log('🔍 saveCompany() END');
}

/**
 * Clears the company form
 */
function clearCompanyForm() {
  SA.editingCompanyId = null;
  window.logoBlob = null;
  window.logoType = null;
  window.logoChanged = false;
  
  document.getElementById('compFormTitle').textContent = 'Add New Company';
  document.getElementById('cId').disabled = false;
  
  ['cId','cName','cAdminEmail','cPhone','cPlan','cMaxEmp','cStartDate','cEndDate','cCity','cSheetId','cScriptUrl','cNotes','cFirebaseConfig','cRelease'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('cIsActive').value = 'true';
  
  const preview = document.getElementById('logoPreview');
  if (preview) preview.innerHTML = '<div style="width:100%;height:100px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--muted);">No logo uploaded</div>';
  
  if (typeof showRes === 'function') showRes('companyResult','companyErr','');
}


/* ══════════════════════════════════════════════════════
POPULATE SITE/EMPLOYEE DROPDOWNS - UPDATED
══════════════════════════════════════════════════════ */
function populateSiteSelects() {
  // ✅ Added 'rectSite' and 'lunchSite' to the list
  const siteSelectIds = ['eSite', 'empSiteFilter', 'attSite', 'rptSite', 'mSite', 'leaveSite', 'correctSite', 'revokeSite', 'rectSite', 'lunchSite'];
  
  siteSelectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    
    const first = sel.querySelector('option[value=""]');
    while (sel.options.length > (first ? 1 : 0)) { 
      sel.remove(first ? 1 : 0); 
    }
    
    S.sites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.SiteID || s.SiteName;
      opt.textContent = s.SiteName || s.SiteID;
      sel.appendChild(opt);
    });
  });
  
  // 2. Populate Employee Dropdowns (for Reports, Manual Entry, Leave)
  const empSelectIds = ['rptEmp', 'mEmpId', 'leaveEmpId'];
  
  empSelectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    
    while (sel.options.length > 1) sel.remove(1);
    
    S.employees.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.EMPID;
      opt.textContent = `${e.EMPID} — ${e.EmpName}`;
      sel.appendChild(opt);
    });
  });
}