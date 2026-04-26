/* ══════════════════════════════════════════════════════
   ADMINS.JS - Admin Management Module (Super Admin)
   Dependencies: 
     - fbDB (Master Firestore instance)
     - SA (Super Admin global state: { admins: [], editingAdminEmail: null, companies: [] })
     - FIREBASE_CONFIG (Firebase config object with apiKey)
     - toast(), showRes(), nav(), openModal(), closeModal(), confirmDelete()
   ══════════════════════════════════════════════════════ */

/**
 * Loads admins from Master Firestore and renders table
 */
async function loadAdmins() {
  console.log('🔍 loadAdmins() called');
  
  const tb = document.getElementById('adminTableBody');
  if (tb) tb.innerHTML = '<tr class="empty-row"><td colspan="6">Loading…</td></tr>';
  
  try {
    const snap = await fbDB.collection('admins').get();
    SA.admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdmins(SA.admins);
    console.log(`✅ Loaded ${SA.admins.length} admins`);
  } catch(e) {
    console.error('❌ Load admins error:', e);
    if (typeof toast === 'function') toast('Failed to load admins: ' + e.message, 'error');
  }
}

/**
 * Renders admin list to table body
 * @param {Array} list - Array of admin objects
 */
function renderAdmins(list) {
  const tb = document.getElementById('adminTableBody');
  if (!tb) return;
  
  if (!list.length) { 
    tb.innerHTML = '<tr class="empty-row"><td colspan="6">No admins found</td></tr>'; 
    return; 
  }
  
  tb.innerHTML = list.map(a => `
    <tr>
      <td class="mono">${a.empCode||'—'}</td>
      <td><strong>${a.name||'—'}</strong></td>
      <td style="font-size:.8rem;color:var(--muted);">${a.email||a.id}</td>
      <td class="mono">${a.companyId||'—'}</td>
      <td><span class="badge ${a.role==='SUPERADMIN'?'badge-amber':'badge-blue'}">${a.role||'ADMIN'}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='editAdmin(${JSON.stringify(a)})'>Edit</button>
        <button class="btn btn-red btn-sm" onclick="confirmDelete('admin','${a.id}','${(a.name||a.id).replace(/'/g,"\\'")}')">Delete</button>
      </td>
    </tr>`).join('');
}

/**
 * Filters admins by search query
 */
function filterAdmins() {
  const q = document.getElementById('adminSearch')?.value.toLowerCase() || '';
  
  const filtered = SA.admins.filter(a =>
    !q || [a.name, a.email, a.empCode, a.companyId].some(v => (v||'').toLowerCase().includes(q))
  );
  
  renderAdmins(filtered);
}

/**
 * Opens edit modal with admin data pre-filled
 * @param {Object} a - Admin object
 */
function editAdmin(a) {
  console.log('✏️ Editing admin:', a.email);
  
  SA.editingAdminEmail = a.id; // id = email for admins
  document.getElementById('adminFormTitle').textContent = 'Edit Admin — ' + (a.name || a.id);
  
  // Text fields
  document.getElementById('aName').value = a.name || '';
  document.getElementById('aEmpCode').value = a.empCode || '';
  document.getElementById('aEmail').value = a.email || a.id;
  document.getElementById('aEmail').disabled = true; // email = doc ID, can't change
  document.getElementById('aPassword').value = ''; // never pre-fill password
  document.getElementById('aCompanyId').value = a.companyId || '';
  document.getElementById('aRole').value = a.role || 'ADMIN';
  
  // Navigate to form page
  if (typeof nav === 'function') {
    const navBtn = document.querySelectorAll('.nav-item')[5]; // Adjust index as needed
    nav('addAdmin', navBtn);
  }
}

/**
 * Clears the admin form for adding new admin
 */
function clearAdminForm() {
  SA.editingAdminEmail = null;
  document.getElementById('adminFormTitle').textContent = 'Add New Admin';
  document.getElementById('aEmail').disabled = false;
  
  // Clear all fields
  ['aName','aEmpCode','aEmail','aPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('aCompanyId').value = '';
  document.getElementById('aRole').value = 'ADMIN';
  
  // Clear messages
  const res = document.getElementById('adminResult');
  const err = document.getElementById('adminErr');
  if (res) res.style.display = 'none';
  if (err) err.style.display = 'none';
}

/**
 * Populates company dropdown for admin form
 * Called after companies are loaded
 */
function populateAdminCompanySelect() {
  const sel = document.getElementById('aCompanyId');
  if (!sel) return;
  
  const cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  
  if (SA.companies && SA.companies.length > 0) {
    SA.companies.forEach(c => {
      const o = document.createElement('option');
      o.value = c.companyId || c.id;
      o.textContent = `${c.companyId||c.id} — ${c.companyName||''}`;
      sel.appendChild(o);
    });
  }
  
  if (cur) sel.value = cur;
}

/**
 * Saves admin (Add or Edit) to Master Firestore + Firebase Auth
 */
async function saveAdmin() {
  const btn = document.getElementById('btnSaveAdmin');
  const name = document.getElementById('aName')?.value.trim();
  const empCode = document.getElementById('aEmpCode')?.value.trim().toUpperCase();
  const email = document.getElementById('aEmail')?.value.trim().toLowerCase();
  const password = document.getElementById('aPassword')?.value.trim();
  const company = document.getElementById('aCompanyId')?.value;
  const role = document.getElementById('aRole')?.value;
  
  // Validation
  if (!name || !empCode || !email || !company) {
    if (typeof showRes === 'function') showRes('adminResult','adminErr','Name, Emp Code, Email and Company are required.', true);
    return;
  }
  if (!SA.editingAdminEmail && !password) {
    if (typeof showRes === 'function') showRes('adminResult','adminErr','Password is required for new admins.', true);
    return;
  }
  if (password && password.length < 6) {
    if (typeof showRes === 'function') showRes('adminResult','adminErr','Password must be at least 6 characters.', true);
    return;
  }
  
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…'; }
  
  const data = {
    name,
    empCode,
    email,
    companyId: company,
    role,
    updatedAt: new Date().toISOString(),
  };
  if (!SA.editingAdminEmail) data.createdAt = new Date().toISOString();
  
  try {
    // Step 1 — Create Firebase Auth user via REST API (new admins only)
    const isNew = !SA.editingAdminEmail;
    if (isNew && password && typeof FIREBASE_CONFIG !== 'undefined') {
      try {
        const authRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              password: password,
              returnSecureToken: false,
            }),
          }
        );
        const authData = await authRes.json();
        
        if (authData.error) {
          // Email already exists in Auth — that's OK, just update Firestore
          if (authData.error.message !== 'EMAIL_EXISTS') {
            if (typeof showRes === 'function') showRes('adminResult','adminErr', 'Firebase Auth error: ' + authData.error.message, true);
            if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save Admin'; }
            return;
          }
          console.warn('Auth user already exists — updating Firestore only');
        } else {
          console.log('✅ Firebase Auth user created:', email);
        }
      } catch(authErr) {
        console.warn('Auth creation failed:', authErr.message);
        // Continue — save Firestore even if Auth fails
      }
    }
    
    // Step 2 — Save to Firestore admins collection
    await fbDB.collection('admins').doc(email).set(data, { merge: true });
    
    if (typeof toast === 'function') toast(isNew ? '✅ Admin created with Firebase Auth + Firestore!' : 'Admin updated!');
    if (typeof showRes === 'function') showRes('adminResult','adminErr',
      isNew
        ? '✓ Admin created successfully. They can now log in with: ' + email
        : '✓ Admin updated successfully'
    );
    
    SA.editingAdminEmail = null;
    document.getElementById('adminFormTitle').textContent = 'Add New Admin';
    document.getElementById('aEmail').disabled = false;
    
    // Refresh list
    loadAdmins();
    
  } catch(e) {
    console.error('❌ Save admin error:', e);
    if (typeof showRes === 'function') showRes('adminResult','adminErr','Error: ' + e.message, true);
  } finally {
    if (btn) { 
      btn.disabled = false; 
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save Admin'; 
    }
  }
}