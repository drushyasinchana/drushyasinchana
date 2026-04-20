/* ══════════════════════════════════════════════════════
   EMPLOYEES.JS - Employee Management Module
   Firestore Schema (employees collection):
   ├─ companyId, Category, Designation, EffectiveDate
   ├─ EMPID, Email, EmpName, JoinDate, PasswordHash
   ├─ Phone, Role, Site, Status
   ├─ Photo (bytes, ONLY via 📷 modal), photoUrl, biometricData
   ══════════════════════════════════════════════════════ */

/**
 * Loads employees for current company
 */
async function loadEmployees() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    S.employees = await fetchEmployees();
    renderEmployees(S.employees);
    populateSiteSelects();
  } catch (e) {
    console.error('Load employees error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

/**
 * Renders employee list to table
 */
function renderEmployees(list) {
  const tb = document.getElementById('empTableBody');
  if (!tb) return;
  
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);">No employees found</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(e => {
    // Photo display
    let photoHtml = `<div style="width:40px;height:40px;border-radius:50%;background:var(--teal-s);border:2px solid var(--teal-l);display:flex;align-items:center;justify-content:center;color:var(--teal);font-weight:bold;font-size:0.9rem;">
      ${(e.EmpName || '?').charAt(0).toUpperCase()}
    </div>`;

    if (e.Photo && typeof e.Photo === 'string') {
      try {
        const mimeType = e.PhotoType || 'image/jpeg';
        const initial = (e.EmpName || '?').charAt(0).toUpperCase();
        let base64Data = e.Photo;
        if (base64Data.startsWith('')) {
          base64Data = base64Data.split(',')[1];
        }
        const imgSrc = `data:${mimeType};base64,${base64Data}`;
        photoHtml = `<img src="${imgSrc}" 
                         style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--teal-l);background:#fff;"
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:40px;height:40px;border-radius:50%;background:var(--teal-s);border:2px solid var(--teal-l);display:flex;align-items:center;justify-content:center;color:var(--teal);font-weight:bold;font-size:0.9rem;\\'>${initial}</div>'"/>`;
      } catch (err) {
        console.warn('Photo error for', e.EMPID, ':', err);
      }
    }
    
    // Safe edit data - ONLY include fields from schema
    const safeEditData = {
      EMPID: e.EMPID,
      EmpName: e.EmpName,
      Email: e.Email,
      Phone: e.Phone,
      Designation: e.Designation,
      Category: e.Category || '',
      Site: e.Site,
      Role: e.Role,
      Status: e.Status,
      JoinDate: e.JoinDate,
      EffectiveDate: e.EffectiveDate
      // Photo NOT included - handled via 📷 modal only
    };
    
    return `
    <tr>
      <td style="text-align:center;">${photoHtml}</td>
      <td class="mono"><strong>${e.EMPID || '—'}</strong></td>
      <td>${e.EmpName || '—'}</td>
      <td style="color:var(--muted);font-size:.85rem;">${e.Email || '—'}</td>
      <td>${e.Designation || '—'}</td>
      <td>${e.Phone || '—'}</td>
      <td>${e.Site || '—'}</td>
      <td class="mono" style="font-size:.85rem;">${fmtDate(e.JoinDate)}</td>
      <td><span class="badge ${(e.Role||'').toUpperCase()==='SUPER_ADMIN'?'badge-purple':(e.Role||'').toUpperCase()==='ADMIN'?'badge-blue':'badge-gray'}">${e.Role||'EMPLOYEE'}</span></td>
      <td><span class="badge ${(e.Status||'').toUpperCase()==='ACTIVE'?'badge-green':'badge-gray'}">${e.Status||'ACTIVE'}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='editEmployee(${JSON.stringify(safeEditData).replace(/'/g, "\\'")})'>Edit</button>
        <button class="btn btn-outline btn-sm" onclick="openPhotoModal('${e.EMPID}', '${e.EmpName}')" style="margin:0 4px;" title="Upload Photo">📷</button>
        <button class="btn btn-outline btn-sm" onclick="deleteEmployee('${e.EMPID}')" style="color:var(--red);margin-left:4px;">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

/**
 * Opens modal for adding new employee
 */
async function openEmpModal() {
  // Reset Category & Designation
  const eCategory = document.getElementById('eCategory');
  if (eCategory) { eCategory.value = ''; eCategory.dispatchEvent(new Event('change')); }
  
  const eDesignation = document.getElementById('eDesignation');
  if (eDesignation) eDesignation.innerHTML = '<option value="">— Select Category First —</option>';
  
  // Clear text fields
  ['eCode','eName','eEmail','ePhone','ePass','ePhotoURL'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  const eCode = document.getElementById('eCode');
  if (eCode) eCode.disabled = false;
  
  // Set defaults
  const eJoin = document.getElementById('eJoin');
  const eEffDate = document.getElementById('eEffDate');
  const eStatus = document.getElementById('eStatus');
  const eRole = document.getElementById('eRole');
  if (eJoin) eJoin.value = today();
  if (eEffDate) eEffDate.value = today();
  if (eStatus) eStatus.value = 'ACTIVE';
  if (eRole) eRole.value = 'EMPLOYEE';
  
  populateSiteSelects();
  
  document.getElementById('empModalTitle').textContent = 'Add Employee';
  showFieldErr('empModalErr', '');
  openModal('empModal');
}

/**
 * Loads designations based on selected category (from sectors.js)
 */
async function loadDesignationsForSector() {
  const select = document.getElementById('eDesignation');
  if (!select) return;
  
  select.innerHTML = '<option value="">— Select Designation —</option>';
  
  try {
    const companyId = S.prefs?.companyId;
    if (!companyId) return;
    
    const settingsDoc = await S.clientDb.collection('settings').doc(companyId).get();
    if (!settingsDoc.exists) { loadFallbackDesignations(select); return; }
    
    const sectorCode = settingsDoc.data().sectorCode;
    if (!sectorCode) { loadFallbackDesignations(select); return; }
    
    const sectorDoc = await S.clientDb.collection('sectors').doc(sectorCode).get();
    if (!sectorDoc.exists) { loadFallbackDesignations(select); return; }
    
    const designations = sectorDoc.data().designations;
    if (!designations) { loadFallbackDesignations(select); return; }
    
    Object.keys(designations).forEach(category => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = category;
      designations[category].forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        optgroup.appendChild(opt);
      });
      select.appendChild(optgroup);
    });
    
  } catch (e) {
    console.error('Failed to load designations:', e);
    loadFallbackDesignations(select);
  }
}

function loadFallbackDesignations(select) {
  const fallback = ["Manager", "Supervisor", "Foreman", "Engineer", "Technician", "Worker", "Security", "Driver", "Admin"];
  fallback.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
}

/**
 * Opens modal for editing employee with pre-filled data
 */
/**
 * HELPER: Converts Firestore Timestamps or Strings to YYYY-MM-DD
 * Place this at the top of your script file.
 */
const toInputDate = (val) => {
  if (!val) return '';
  try {
    let d;
    // 1. Handle Firestore Timestamp Object
    if (val && typeof val.toDate === 'function') {
      d = val.toDate();
    } 
    // 2. Handle Serialized JSON Timestamp ({seconds: ...})
    else if (val && (val.seconds !== undefined || val._seconds !== undefined)) {
      const s = val.seconds || val._seconds;
      const n = val.nanoseconds || val._nanoseconds || 0;
      d = new Date(s * 1000 + n / 1e6);
    }
    // 3. Handle standard Date strings or JS Date objects
    else {
      d = new Date(val);
    }

    if (isNaN(d.getTime())) return '';
    
    // Format strictly as YYYY-MM-DD for HTML date inputs
    return d.toISOString().split('T')[0];
  } catch (err) {
    console.warn("Date conversion error:", err);
    return '';
  }
};

/**
 * MAIN FUNCTION: Populates the Edit Modal
 */
function editEmployee(e) {
  console.log('✏️ Editing employee:', e.EMPID);
  
  // 1. Text fields - Fixed mapping for EmpName, Email, and photoUrl
  const elMap = {
    'eCode': e.EMPID,
    'eName': e.EmpName,    // Matches your 'yash' record
    'eEmail': e.Email,     // Matches your 'yash' record
    'ePhone': e.Phone,
    'ePhotoURL': e.photoUrl // Matches your lowercase 'photoUrl' field
  };

  Object.keys(elMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = elMap[id] || '';
  });

  document.getElementById('eCode').disabled = true;

  // 2. ✅ Dates: Population using the helper above
  document.getElementById('eJoin').value = toInputDate(e.JoinDate);
  document.getElementById('eEffDate').value = toInputDate(e.EffectiveDate);

  // 3. Category & Designation
  const catEl = document.getElementById('eCategory');
  const desigEl = document.getElementById('eDesignation');
  if (catEl) {
    catEl.value = e.Category || 'Office/Corporate';
    if (typeof onCategoryChange === 'function' && catEl.value) {
      onCategoryChange().then(() => {
        setTimeout(() => { if (desigEl && e.Designation) desigEl.value = e.Designation; }, 300);
      }).catch(() => { if (desigEl && e.Designation) desigEl.value = e.Designation; });
    } else if (desigEl && e.Designation) {
      desigEl.value = e.Designation;
    }
  }

  // 4. Other selects
  document.getElementById('eStatus').value = e.Status || 'ACTIVE';
  document.getElementById('eRole').value = e.Role || 'EMPLOYEE';

  // 5. Site: populate then select
  if (typeof populateSiteSelects === 'function') populateSiteSelects();
  setTimeout(() => {
    const siteEl = document.getElementById('eSite');
    if (siteEl && e.Site) siteEl.value = e.Site;
  }, 100);

  // 6. Photo preview
  const photoImg = document.getElementById('photoImg');
  const photoInitial = document.getElementById('photoInitial');
  if (photoImg && photoInitial) {
    photoImg.style.display = 'none';
    photoInitial.style.display = 'block';
    photoInitial.textContent = (e.EmpName || '?').charAt(0).toUpperCase();
    
    // Show photo if available (either as string or bytes)
    if (e.Photo || e.photoUrl) {
      photoImg.src = e.photoUrl || e.Photo;
      photoImg.style.display = 'block';
      photoInitial.style.display = 'none';
    }
  }

  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  if (typeof showFieldErr === 'function') showFieldErr('empModalErr', '');
  if (typeof openModal === 'function') openModal('empModal');
}

/**
 * SAVE FUNCTION: Sends data to Firestore
 */
async function saveEmployee() {
  const empCode = document.getElementById('eCode')?.value.trim().toUpperCase();
  const name = document.getElementById('eName')?.value.trim();
  const email = document.getElementById('eEmail')?.value.trim().toLowerCase();
  const phone = document.getElementById('ePhone')?.value.trim();
  const designation = document.getElementById('eDesignation')?.value;
  const category = document.getElementById('eCategory')?.value || '';
  const pw = document.getElementById('ePass')?.value.trim();
  const role = document.getElementById('eRole')?.value;
  const siteId = document.getElementById('eSite')?.value;
  const joinDate = document.getElementById('eJoin')?.value;
  const effDate = document.getElementById('eEffDate')?.value;
  const status = document.getElementById('eStatus')?.value;
  const photoURL = document.getElementById('ePhotoURL')?.value.trim();
  
  if (!empCode || !name || !email) {
    showFieldErr('empModalErr', 'Code, Name and Email are required.');
    return;
  }
  
  const saveBtn = document.getElementById('btnSaveEmp');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  
  try {
    const payload = {
      companyId: S.prefs.companyId,
      EMPID: empCode,
      EmpName: name,
      Email: email,
      Phone: phone,
      Designation: designation,
      Category: category,
      Site: siteId,
      Role: role,
      Status: status,
      // Store as Date objects for Firestore
      JoinDate: joinDate ? new Date(joinDate) : new Date(),
      EffectiveDate: effDate ? new Date(effDate) : new Date(),
      photoUrl: photoURL || '',
      UpdatedAt: new Date().toISOString()
    };
    
    if (pw) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pw));
      payload.PasswordHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    if (!S.clientDb) throw new Error('Database not connected');
    
    // Using merge:true to avoid overwriting photo/biometrics
    await S.clientDb.collection('employees').doc(empCode).set(payload, { merge: true });
    
    if (typeof toast === 'function') toast('Employee saved successfully!');
    if (typeof closeModal === 'function') closeModal('empModal');
    if (document.getElementById('pgEmployees')?.classList.contains('active')) {
      loadEmployees();
    }
    
  } catch (e) {
    console.error('Save error:', e);
    showFieldErr('empModalErr', e.message || 'Failed to save');
  } finally {
    const saveBtn2 = document.getElementById('btnSaveEmp');
    if (saveBtn2) { saveBtn2.disabled = false; saveBtn2.textContent = 'Save'; }
  }
}

/**
 * Filters employee list by search/status/site
 */
function filterEmployees() {
  const search = (document.getElementById('empSearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('empStatusFilter')?.value || '';
  const siteFilter = document.getElementById('empSiteFilter')?.value || '';
  
  const filtered = S.employees.filter(e => {
    const matchSearch = !search || [e.EmpName, e.EMPID, e.Email].some(v => (v||'').toLowerCase().includes(search));
    const matchStatus = !statusFilter || (e.Status && e.Status.toUpperCase() === statusFilter.toUpperCase());
    const matchSite = !siteFilter || (e.Site && e.Site === siteFilter);
    return matchSearch && matchStatus && matchSite;
  });
  
  renderEmployees(filtered);
}

/**
 * Saves employee (Add or Edit) - ONLY updates defined schema fields
 */

/**
 * Deletes employee document
 */
async function deleteEmployee(empId) {
  if (!confirm('Are you sure you want to delete employee ' + empId + '?')) return;
  try {
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('employees').doc(empId).delete();
    toast('Employee deleted successfully!');
    loadEmployees();
  } catch (e) {
    console.error('Delete error:', e);
    toast('Failed to delete: ' + e.message, 'error');
  }
}

/**
 * Populates site/employee dropdowns across modules
 */
function populateSiteSelects() {
  // Site dropdowns
  ['eSite','empSiteFilter','attSite','rptSite','mSite','leaveSite','correctSite','revokeSite'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.querySelector('option[value=""]');
    while (sel.options.length > (first ? 1 : 0)) sel.remove(first ? 1 : 0);
    S.sites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.SiteID || s.SiteName;
      opt.textContent = s.SiteName || s.SiteID;
      sel.appendChild(opt);
    });
  });
  
  // Employee dropdowns
  ['rptEmp','mEmpId','leaveEmpId'].forEach(id => {
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

/* ══════════════════════════════════════════════════════
   PHOTO UPLOAD (📷 Modal) - ONLY this updates Photo field
   ══════════════════════════════════════════════════════ */
let currentPhotoEmpId = null;

function openPhotoModal(empId, empName) {
  currentPhotoEmpId = empId;
  document.getElementById('photoEmpId').textContent = empId;
  document.getElementById('photoEmpName').textContent = empName;
  document.getElementById('photoFile').value = '';
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('photoImg').src = '';
  showFieldErr('photoErr', '');
  openModal('photoModal');
}

document.getElementById('photoFile')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('photoPreview');
  const img = document.getElementById('photoImg');
  const err = document.getElementById('photoErr');
  
  if (!file) { preview.style.display = 'none'; return; }
  if (!['image/jpeg','image/png'].includes(file.type)) {
    err.textContent = '❌ Only JPG or PNG files allowed'; err.style.display = 'block'; preview.style.display = 'none'; return;
  }
  if (file.size > 20 * 1024) {
    err.textContent = '❌ File must be under 20KB'; err.style.display = 'block'; preview.style.display = 'none'; return;
  }
  
  const reader = new FileReader();
  reader.onload = (ev) => { img.src = ev.target.result; preview.style.display = 'block'; err.style.display = 'none'; };
  reader.readAsDataURL(file);
});

async function savePhoto() {
  const file = document.getElementById('photoFile').files[0];
  const err = document.getElementById('photoErr');
  const btn = document.getElementById('btnSavePhoto');
  
  if (!file || !['image/jpeg','image/jpg','image/png'].includes(file.type.toLowerCase())) {
    err.textContent = 'Select a valid JPG/PNG file'; err.style.display = 'block'; return;
  }
  if (!currentPhotoEmpId || !S.clientDb) { err.textContent = 'System not ready'; err.style.display = 'block'; return; }
  
  btn.disabled = true; btn.textContent = 'Compressing...'; err.style.display = 'none';
  
  try {
    const compressedBlob = await compressJPG(file, 300, 0.8);
    const base64String = await blobToBase64(compressedBlob);
    const cleanBase64 = base64String.replace(/^image\/jpeg;base64,/, '');
    
    // ✅ ONLY update Photo-related fields via .update()
    await S.clientDb.collection('employees').doc(currentPhotoEmpId).update({
      Photo: cleanBase64,
      PhotoType: 'image/jpeg',
      PhotoSize: cleanBase64.length,
      UpdatedAt: new Date().toISOString()
    });
    
    toast('✅ Photo saved!');
    closeModal('photoModal');
    loadEmployees();
    
  } catch (error) {
    console.error('Upload failed:', error);
    err.textContent = error.message || 'Upload failed'; err.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = '💾 Upload Photo';
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function compressJPG(file, maxSize = 300, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width, height = img.height;
        if (width > height) { if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; } }
        else { if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; } }
        canvas.width = width; canvas.height = height;
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,width,height); ctx.drawImage(img,0,0,width,height);
        
        const tryCompress = (q) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            if (blob.size > 50*1024 && q > 0.3) { tryCompress(q - 0.1); }
            else { resolve(blob); }
          }, 'image/jpeg', q);
        };
        tryCompress(quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


/* ══════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS (Escape Key)
   ══════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' || event.keyCode === 27) {
    // Close all open modals
    const modals = document.querySelectorAll('.modal-backdrop.open');
    modals.forEach(m => {
      m.classList.remove('open');
      m.style.display = 'none';
    });
  }
});