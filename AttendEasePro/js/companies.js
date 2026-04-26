/* ══════════════════════════════════════════════════════
   COMPANIES.JS - Company Management Module (Super Admin)
   Dependencies: 
     - fbDB (Master Firestore instance)
     - SA (Super Admin global state)
     - toast(), showRes(), nav(), populateCompanySelect(), confirmDelete()
     - logoBlob, logoType (global vars for logo upload)
   ══════════════════════════════════════════════════════ */

/**
 * Loads companies from Master Firestore and renders table
 */
async function loadCompanies() {
  console.log('🔍 loadCompanies() called');
  
  const tb = document.getElementById('companyTableBody');
  if (tb) tb.innerHTML = '<tr class="empty-row"><td colspan="10">Loading…</td></tr>';
  
  try {
    const snap = await fbDB.collection('companies').get();
    SA.companies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCompanies(SA.companies);
    if (typeof populateCompanySelect === 'function') populateCompanySelect();
    console.log(`✅ Loaded ${SA.companies.length} companies`);
  } catch(e) {
    console.error('❌ Load companies error:', e);
    if (typeof toast === 'function') toast('Failed to load companies: ' + e.message, 'error');
  }
}

/**
 * Renders company list to table body
 * @param {Array} list - Array of company objects
 */
function renderCompanies(list) {
  const tb = document.getElementById('companyTableBody');
  if (!tb) return;
  
  if (!list.length) { 
    tb.innerHTML = '<tr class="empty-row"><td colspan="10">No companies found</td></tr>'; 
    return; 
  }
  
  tb.innerHTML = list.map(c => {
    // Logo display
    const logoHtml = c.logo 
      ? `<img src="data:${c.logoType||'image/png'};base64,${c.logo}" style="width:32px;height:32px;object-fit:contain;border-radius:4px;" alt="Logo">`
      : '<div style="width:32px;height:32px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.9rem;">🏢</div>';
    
    // Release badge
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
 * @param {Object} c - Company object
 */
function editCompany(c) {
  console.log('✏️ Editing company:', c.companyId);
  
  SA.editingCompanyId = c.id;
  document.getElementById('compFormTitle').textContent = 'Edit Company — ' + c.companyId;
  
  // Text fields
  document.getElementById('cId').value = c.companyId || c.id;
  document.getElementById('cId').disabled = true; // Can't change ID
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
  
  // ✅ Firebase Config textarea (pretty-printed)
  if (c.firebaseConfig && Object.keys(c.firebaseConfig).length > 0) {
    document.getElementById('cFirebaseConfig').value = JSON.stringify(c.firebaseConfig, null, 2);
  } else {
    document.getElementById('cFirebaseConfig').value = '';
  }
  
  // ✅ Logo preview
  if (c.logo) {
    const preview = document.getElementById('logoPreview');
    const mimeType = c.logoType || 'image/png';
    preview.innerHTML = `<img src="${mimeType};base64,${c.logo}" style="width:100%;height:100%;object-fit:contain;"/>`;
    
    // Store for potential re-upload
    window.logoBlob = `${mimeType};base64,${c.logo}`;
    window.logoType = c.logoType || 'image/png';
  }
  
  // ✅ Release field
  document.getElementById('cRelease').value = c.release || '';
  
  // Navigate to form page
  if (typeof nav === 'function') {
    const navBtn = document.querySelectorAll('.nav-item')[2]; // Adjust index as needed
    nav('addCompany', navBtn);
  }
}

/**
 * Saves company (Add or Edit) to Master Firestore
 */
async function saveCompany() {
  const btn = document.getElementById('btnSaveCompany');
  const id  = document.getElementById('cId')?.value.trim().toUpperCase();
  const name= document.getElementById('cName')?.value.trim();
  const email=document.getElementById('cAdminEmail')?.value.trim();
  const url = document.getElementById('cScriptUrl')?.value.trim();
  const sheetId = document.getElementById('cSheetId')?.value.trim();
  
  // Validation
  if (!id || !name || !email) {
    if (typeof showRes === 'function') showRes('companyResult','companyErr','Company ID, Name and Admin Email are required.', true);
    return;
  }
  
  // 🔥 Validate Firebase Config JSON
  let firebaseConfig = {};
  try {
    const raw = document.getElementById('cFirebaseConfig')?.value.trim();
    if (raw) firebaseConfig = JSON.parse(raw);
  } catch(e) {
    if (typeof showRes === 'function') showRes('companyResult','companyErr','Invalid JSON in Firebase Config field. Please check formatting.', true);
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save Company'; }
    return;
  }
  
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…'; }
  
  const data = {
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
    
    // 🔥 Client Firebase config
    firebaseConfig: firebaseConfig,
    
    // 🔥 Logo (Base64 string)
    logo: window.logoBlob ? window.logoBlob.replace(/^data:image\/[a-z]+;base64,/, '') : null,
    logoType: window.logoType || null,
    
    // 🔥 GitHub Release
    release: document.getElementById('cRelease')?.value.trim(),
    
    companySheetId: sheetId,
    companyScriptUrl: url,
    notes: document.getElementById('cNotes')?.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  
  if (!SA.editingCompanyId) data.createdAt = new Date().toISOString();
  
  try {
    await fbDB.collection('companies').doc(id).set(data, { merge: true });
    
    if (typeof toast === 'function') toast(SA.editingCompanyId ? 'Company updated!' : 'Company added!');
    if (typeof showRes === 'function') showRes('companyResult','companyErr', SA.editingCompanyId ? '✓ Company updated successfully' : '✓ Company added successfully');
    
    SA.editingCompanyId = null;
    document.getElementById('compFormTitle').textContent = 'Add New Company';
    document.getElementById('cId').disabled = false;
    
    // Refresh list
    loadCompanies();
    
  } catch(e) {
    console.error('❌ Save company error:', e);
    if (typeof showRes === 'function') showRes('companyResult','companyErr','Error: ' + e.message, true);
  } finally {
    if (btn) { 
      btn.disabled = false; 
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save Company'; 
    }
  }
}

/**
 * Clears the company form for adding new company
 */
function clearCompanyForm() {
  SA.editingCompanyId = null;
  document.getElementById('compFormTitle').textContent = 'Add New Company';
  document.getElementById('cId').disabled = false;
  
  // Clear all fields
  ['cId','cName','cAdminEmail','cPhone','cPlan','cMaxEmp','cStartDate','cEndDate','cCity','cSheetId','cScriptUrl','cNotes','cFirebaseConfig','cRelease'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('cIsActive').value = 'true';
  
  // Clear logo preview
  const preview = document.getElementById('logoPreview');
  if (preview) preview.innerHTML = '<div style="width:100%;height:100px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--muted);">No logo uploaded</div>';
  
  // Clear globals
  window.logoBlob = null;
  window.logoType = null;
  
  // Clear messages
  if (typeof showRes === 'function') showRes('companyResult','companyErr','');
}