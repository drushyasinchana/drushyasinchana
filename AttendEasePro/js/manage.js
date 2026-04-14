/* ══════════════════════════════════════════════════════
   ATTENDEASE - MANAGE.JS (CLEAN WORKING VERSION)
══════════════════════════════════════════════════════ 

const TEST_COMPANY_ID = 'TEST001';
const S = { 
  employees: [], 
  sites: [], 
  attRecords: [], 
  holidays: [],
  weeklyOffs: [],
  prefs: { companyId: TEST_COMPANY_ID } 
};*/

// ══════════════════════════════════════════════════════
// ATTENDEASE - MANAGE.JS (MULTI-TENANT READY)
// ══════════════════════════════════════════════════════

// Global state - companyId will be set after login
const S = { 
  employees: [], 
  sites: [], 
  attRecords: [], 
  holidays: [],
  weeklyOffs: [],
  leaveBalances: [],
  prefs: { companyId: null, companyName: '', adminEmail: '' },
  clientApp: null,
  clientDb: null
};

// Get company ID from URL param, sessionStorage, or prompt
function getCompanyId() {
  // 1. URL parameter (manage.html?companyId=SRI001)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('companyId')) {
    return urlParams.get('companyId').toUpperCase();
  }
  
  // 2. Session storage (set during login)
  if (sessionStorage.getItem('companyId')) {
    return sessionStorage.getItem('companyId').toUpperCase();
  }
  
  // 3. Hash fallback (manage.html#SRI001)
  if (window.location.hash && window.location.hash.length > 1) {
    return window.location.hash.substring(1).toUpperCase();
  }
  
  // 4. Last resort: force re-login with clear message
  console.error('❌ Company ID not found in URL, session, or hash.');
  toast('Session expired. Please login again.', 'error');
  setTimeout(() => {
    sessionStorage.clear();
    window.location.href = 'index.html';
  }, 1500);
  return null;
}

// ══════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════
function toast(msg, type='success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; 
  t.className = 'show ' + type;
  clearTimeout(t._tid); 
  t._tid = setTimeout(() => t.className = '', 3000);
}

function today() { 
  return new Date().toISOString().slice(0,10); 
}

// Format date to dd-mm-yyyy
function fmtDate(d) {
  if (!d) return '—';
  const dt = d.toDate ? d.toDate() : new Date(d);
  if (isNaN(dt)) return d;
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { 
    el.textContent = msg; 
    el.style.display = msg ? 'block' : 'none'; 
  }
}

// ══════════════════════════════════════════════════════
// MODAL FUNCTIONS
// ══════════════════════════════════════════════════════
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    el.style.display = 'flex';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════
function nav(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('pg' + page.charAt(0).toUpperCase() + page.slice(1));
  if (pg) pg.classList.add('active');
  if (btn) btn.classList.add('active');
  const tl = document.getElementById('topbarTitle');
  if (tl) tl.textContent = page.charAt(0).toUpperCase() + page.slice(1);
  
  if (page === 'dashboard') loadDashboard();
  if (page === 'employees') loadEmployees();
  if (page === 'sites') loadSites();
  if (page === 'attendance') loadAttendance();
  if (page === 'reports') loadReports();
  if (page === 'manual') loadManual();
  if (page === 'leave') loadLeave();
  if (page === 'holidays') loadHolidays();
  if (page === 'weeklyoff') loadWeeklyOff();
  if (page === 'support') loadSupport();
if (page === 'rectifications') loadRectifications();
}

function toggleAvatarMenu() {
  const dd = document.getElementById('avatarDropdown');
  if (dd) dd.classList.toggle('open');
}

function doLogout() {
  // Sign out
  firebase.auth()?.signOut().catch(()=>{});
  
  // Clear session
  sessionStorage.removeItem('companyId');
  
  // Delete client app
  try {
    firebase.app('client')?.delete();
  } catch (e) {}
  
  // Reset global state
  S.clientApp = null;
  S.clientDb = null;
  S.prefs = { companyId: null, companyName: '', adminEmail: '' };
  S.employees = [];
  S.sites = [];
  S.attRecords = [];
  
  // Redirect
  window.location.href = 'index.html';
}

// ══════════════════════════════════════════════════════
// FIREBASE INIT
// ══════════════════════════════════════════════════════
async function initClientFirebase(cfg) {
  if (!cfg || !cfg.apiKey) throw new Error('Client config missing');
  try {
    const ex = firebase.app('client');
    if (ex) { 
      S.clientApp = ex; 
      S.clientDb = ex.firestore(); 
      return; 
    }
  } catch(e) {}
  S.clientApp = firebase.initializeApp(cfg, 'client');
  S.clientDb = S.clientApp.firestore();
}

// ══════════════════════════════════════════════════════
// DATA FETCHERS
// ══════════════════════════════════════════════════════
async function fetchEmployees() {
  if (!S.clientDb) return [];
  const snap = await S.clientDb.collection('employees')
    .where('companyId','==',S.prefs.companyId).get();
  return snap.docs.map(d => ({id:d.id,...d.data()}));
}

async function fetchSites() {
  if (!S.clientDb) return [];
  const snap = await S.clientDb.collection('sites')
    .where('companyId','==',S.prefs.companyId).get();
  return snap.docs.map(d => ({id:d.id,...d.data()}));
}

async function fetchAttendance(date) {
  if (!S.clientDb) return [];
  const snap = await S.clientDb.collection('attendance')
    .where('companyId','==',S.prefs.companyId)
    .where('Date','==',date).get();
  return snap.docs.map(d => d.data());
}

// ══════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════
async function loadDashboard() {
  if (!S.clientDb) { toast('DB not connected','error'); return; }
  try {
    const [emp, sites, att] = await Promise.all([
      fetchEmployees(), 
      fetchSites(), 
      fetchAttendance(today())
    ]);
    S.employees = emp; 
    S.sites = sites;
    
    const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    el('stTotalEmp', emp.length);
    el('stPresent', att.filter(r=>r.Status==='PRESENT').length);
    el('stAbsent', Math.max(0, emp.length - att.filter(r=>r.Status==='PRESENT').length));
    el('stSites', sites.filter(s=>!s.Status||s.Status==='ACTIVE').length);
    el('stDate', fmtDate(today()));
    el('dashSiteDate', fmtDate(today()));
    
    const grid = document.getElementById('dashSiteCards');
    if (grid) {
      const active = sites.filter(s=>!s.Status||s.Status==='ACTIVE');
      if (!active.length) {
        grid.innerHTML = '<div class="empty"><p>No active sites</p></div>';
      } else {
        grid.innerHTML = active.map(s=>{
          const a = att.filter(r=>r.SiteID===s.SiteID);
          const p = a.filter(r=>r.Status==='PRESENT').length;
          const t = emp.filter(e=>e.Site===s.SiteID).length || a.length;
          const ab = Math.max(0,t-p);
          const pct = t>0?Math.round(p/t*100):0;
          const bar = pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
          return `<div class="site-card">
            <div class="site-card-bar" style="background:${bar}"></div>
            <div class="site-card-name">${s.SiteName}</div>
            <div class="site-card-nums">
              <div class="site-num">
                <div class="site-num-val" style="color:var(--green)">${p}</div>
                <div class="site-num-lbl">Present</div>
              </div>
              <div class="site-num">
                <div class="site-num-val" style="color:var(--red)">${ab}</div>
                <div class="site-num-lbl">Absent</div>
              </div>
            </div>
          </div>`;
        }).join('');
      }
    }
    
    const al = document.getElementById('dashAttendList');
    if (al) {
      al.innerHTML = att.length 
        ? att.slice(0,5).map(r=>`
          <div class="mini-row">
            <div><div class="mname">${r.Name||r.EMPID}</div></div>
            <div class="mright">
              <span class="badge ${r.Status==='PRESENT'?'badge-green':'badge-red'}">${r.Status}</span>
            </div>
          </div>`).join('')
        : '<div class="empty"><p>No attendance records today</p></div>';
    }
  } catch(e) { 
    console.error('Dashboard error:',e); 
    toast('Load failed: '+e.message,'error'); 
  }
}

// ══════════════════════════════════════════════════════
// EMPLOYEES
// ══════════════════════════════════════════════════════
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



function renderEmployees(list) {
  const tb = document.getElementById('empTableBody');
  if (!tb) return;
  
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);">No employees found</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(e => {
    // --- PHOTO HANDLING START ---
    let photoHtml = '';
    
    if (e.Photo) {
      try {
        let imgUrl = '';
        
        // Case 1: Firestore Blob (Standard Web SDK format)
        // This matches the Android getBlob() method
        if (typeof e.Photo.toBytes === 'function') {
          console.log('✅ Detected Blob for', e.EMPID);
          const bytes = e.Photo.toBytes(); // Extract bytes
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          imgUrl = URL.createObjectURL(blob); // Convert to URL
        } 
        // Case 2: Base64 String (Fallback if somehow stored as string)
        else if (typeof e.Photo === 'string') {
          console.log('✅ Detected String for', e.EMPID);
          imgUrl = e.Photo.startsWith('data:image') 
                   ? e.Photo 
                   : `image/jpeg;base64,${e.Photo}`;
        }
        // Case 3: Deep Object search (If SDK deserializes oddly)
        else if (typeof e.Photo === 'object') {
           // Try to find bytes in common internal keys
           const keys = Object.keys(e.Photo);
           for (let k of keys) {
              if (e.Photo[k] instanceof Uint8Array) {
                 const blob = new Blob([e.Photo[k]], { type: 'image/jpeg' });
                 imgUrl = URL.createObjectURL(blob);
                 console.log('✅ Found bytes in key:', k);
                 break;
              }
           }
        }

        // If we successfully got a URL, render the image
        if (imgUrl) {
          photoHtml = `<img src="${imgUrl}" 
                           style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--teal-l);background:#fff;"
                           onerror="this.onerror=null;this.style.display='none';"/>`;
        } else {
           // If URL failed but Photo existed, fallback to Initials
           photoHtml = `<div style="width:40px;height:40px;border-radius:50%;background:var(--teal-s);border:2px solid var(--teal-l);display:flex;align-items:center;justify-content:center;color:var(--teal);font-weight:bold;font-size:0.9rem;">
              ${(e.EmpName || '?').charAt(0).toUpperCase()}
           </div>`;
        }
      } catch (err) {
         console.error('❌ Photo render error for', e.EMPID, err);
         // Fallback on error
         photoHtml = `<div style="width:40px;height:40px;border-radius:50%;background:var(--teal-s);border:2px solid var(--teal-l);display:flex;align-items:center;justify-content:center;color:var(--teal);font-weight:bold;font-size:0.9rem;">
            ${(e.EmpName || '?').charAt(0).toUpperCase()}
         </div>`;
      }
    } else {
      // No photo: Show Initials
      photoHtml = `<div style="width:40px;height:40px;border-radius:50%;background:var(--teal-s);border:2px solid var(--teal-l);display:flex;align-items:center;justify-content:center;color:var(--teal);font-weight:bold;font-size:0.9rem;">
        ${(e.EmpName || '?').charAt(0).toUpperCase()}
      </div>`;
    }
    // --- PHOTO HANDLING END ---

    // Safe Edit Data (Excludes Photo Blob to prevent JSON errors)
    const safeEditData = {
      EMPID: e.EMPID,
      EmpName: e.EmpName,
      Email: e.Email,
      Phone: e.Phone,
      Designation: e.Designation,
      Site: e.Site,
      Role: e.Role,
      Status: e.Status,
      JoinDate: e.JoinDate,
      EffectiveDate: e.EffectiveDate
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


function openEmpModal() {
  ['eCode','eName','eEmail','ePhone','ePass','ePhotoURL'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const eCode = document.getElementById('eCode');
  if (eCode) eCode.disabled = false;
  const eJoin = document.getElementById('eJoin');
  const eEffDate = document.getElementById('eEffDate');
  const eStatus = document.getElementById('eStatus');
  const eRole = document.getElementById('eRole');
  if (eJoin) eJoin.value = today();
  if (eEffDate) eEffDate.value = today();
  if (eStatus) eStatus.value = 'ACTIVE';
  if (eRole) eRole.value = 'EMPLOYEE';
  populateSiteSelects();
  const title = document.getElementById('empModalTitle');
  if (title) title.textContent = 'Add Employee';
  showFieldErr('empModalErr', '');
  openModal('empModal');
}

function editEmployee(e) {
  // Populate form fields
  const fields = {
    'eCode': e.EMPID,
    'eName': e.EmpName,
    'eEmail': e.Email,
    'ePhone': e.Phone,
    'ePhotoURL': e.PhotoURL || ''
  };
  
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fields[id] || '';
  });
  
  // Disable Employee ID field
  const eCode = document.getElementById('eCode');
  if (eCode) eCode.disabled = true;
  
  // Set other fields
  const eJoin = document.getElementById('eJoin');
  const eEffDate = document.getElementById('eEffDate');
  const eStatus = document.getElementById('eStatus');
  const eRole = document.getElementById('eRole');
  
  if (eJoin) eJoin.value = fmtDate(e.JoinDate);
  if (eEffDate) eEffDate.value = fmtDate(e.EffectiveDate);
  if (eStatus) eStatus.value = e.Status || 'ACTIVE';
  if (eRole) eRole.value = e.Role || 'EMPLOYEE';
  
  // ✅ DISPLAY PHOTO IN MODAL
  const photoPreview = document.getElementById('editPhotoPreview');
  const photoImg = document.getElementById('editPhotoImg');
  const photoInitial = document.getElementById('editPhotoInitial');
  
  if (photoPreview && photoImg && photoInitial) {
    // Reset to show initial letter
    photoImg.style.display = 'none';
    photoInitial.style.display = 'block';
    photoInitial.textContent = (e.EmpName || '?').charAt(0).toUpperCase();
    
    // If photo exists, try to display it
    if (e.Photo) {
      try {
        let imgUrl = null;
        
        // Case 1: Firestore Blob
        if (typeof e.Photo.toBytes === 'function') {
          const bytes = e.Photo.toBytes();
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          imgUrl = URL.createObjectURL(blob);
        }
        // Case 2: Base64 String
        else if (typeof e.Photo === 'string') {
          imgUrl = e.Photo.startsWith('image') 
                   ? e.Photo 
                   : `image/jpeg;base64,${e.Photo}`;
        }
        
        // Display the image if we got a URL
        if (imgUrl) {
          photoImg.src = imgUrl;
          photoImg.style.display = 'block';
          photoInitial.style.display = 'none';
          console.log('✅ Photo loaded in edit modal for', e.EMPID);
        }
      } catch (err) {
        console.warn('Photo load error in edit modal:', err);
      }
    }
  }
  
  // Populate site selects
  populateSiteSelects();
  
  // Update modal title
  const title = document.getElementById('empModalTitle');
  if (title) title.textContent = 'Edit Employee';
  
  // Clear errors and open modal
  showFieldErr('empModalErr', '');
  openModal('empModal');
}


function filterEmployees() {
  const search = (document.getElementById('empSearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('empStatusFilter')?.value || '';
  const siteFilter = document.getElementById('empSiteFilter')?.value || '';
  
  let filtered = S.employees.filter(e => {
    // Search filter
    const matchSearch = !search || 
      (e.EmpName && e.EmpName.toLowerCase().includes(search)) ||
      (e.EMPID && e.EMPID.toLowerCase().includes(search)) ||
      (e.Email && e.Email.toLowerCase().includes(search));
    
    // Status filter
    const matchStatus = !statusFilter || (e.Status && e.Status.toUpperCase() === statusFilter.toUpperCase());
    
    // Site filter
    const matchSite = !siteFilter || (e.Site && e.Site === siteFilter);
    
    return matchSearch && matchStatus && matchSite;
  });
  
  renderEmployees(filtered);
}

// ══════════════════════════════════════════════════════
// EMPLOYEE SAVE FUNCTION
// ══════════════════════════════════════════════════════
async function saveEmployee() {
  const empCode = document.getElementById('eCode')?.value.trim().toUpperCase();
  const name = document.getElementById('eName')?.value.trim();
  const email = document.getElementById('eEmail')?.value.trim().toLowerCase();
  const phone = document.getElementById('ePhone')?.value.trim();
  const designation = document.getElementById('eDesignation')?.value;
  const pw = document.getElementById('ePass')?.value.trim();
  const role = document.getElementById('eRole')?.value;
  const siteId = document.getElementById('eSite')?.value;
  const joinDate = document.getElementById('eJoin')?.value;
  const effDate = document.getElementById('eEffDate')?.value;
  const status = document.getElementById('eStatus')?.value;
  const photoURL = document.getElementById('ePhotoURL')?.value.trim();
  
  // Validation
  if (!empCode || !name || !email) {
    showFieldErr('empModalErr', 'Code, Name and Email are required.');
    return;
  }
  
  const saveBtn = document.getElementById('btnSaveEmp');
  if (saveBtn) { 
    saveBtn.disabled = true; 
    saveBtn.textContent = 'Saving…'; 
  }
  
  try {
    // Construct payload matching Firestore Structure
    const payload = {
      companyId: S.prefs.companyId,
      EMPID: empCode, 
      EmpName: name, 
      Email: email,
      Phone: phone, 
      Designation: designation,
      Site: siteId, 
      Role: role, 
      Status: status,
      
      // Handle Dates
      JoinDate: joinDate ? new Date(joinDate) : new Date(),
      EffectiveDate: effDate ? new Date(effDate) : new Date(),
      
      // Photo fields (Photo is for Bytes, photoUrl is for Biometric link)
      Photo: null, // Reset Photo bytes if re-saving, or handle elsewhere
      photoUrl: photoURL, 
      
      UpdatedAt: new Date().toISOString()
    };
    
    // Handle Password Hashing
    if (pw) {
      const encoder = new TextEncoder();
      const data = encoder.encode(pw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      payload.PasswordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    if (!S.clientDb) throw new Error('Database not connected');
    
    // Save to Firestore
    await S.clientDb.collection('employees').doc(empCode).set(payload);
    
    toast('Employee saved successfully!');
    closeModal('empModal');
    
    // Refresh list if on the employee page
    if (document.getElementById('pgEmployees')?.classList.contains('active')) {
      loadEmployees();
    }
  } catch (e) {
    console.error('Save error:', e);
    showFieldErr('empModalErr', e.message || 'Failed to save');
  } finally {
    const saveBtn2 = document.getElementById('btnSaveEmp');
    if (saveBtn2) { 
      saveBtn2.disabled = false; 
      saveBtn2.textContent = 'Save'; 
    }
  }
}

// ══════════════════════════════════════════════════════
// EMPLOYEE DELETE FUNCTION
// ══════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════
// POPULATE SELECTS (Sites & Employees)
// ══════════════════════════════════════════════════════
function populateSiteSelects() {
  // 1. Populate Site Dropdowns
  const siteSelectIds = ['eSite', 'empSiteFilter', 'attSite', 'rptSite', 'mSite', 'leaveSite', 'correctSite', 'revokeSite'];
  
  siteSelectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return; // Safety check: Element might not exist on current page
    
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
    if (!sel) return; // Safety check
    
    while (sel.options.length > 1) sel.remove(1);
    
    S.employees.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.EMPID;
      opt.textContent = `${e.EMPID} — ${e.EmpName}`;
      sel.appendChild(opt);
    });
  });
}

// ══════════════════════════════════════════════════════
// SITES
// ══════════════════════════════════════════════════════
async function loadSites() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    S.sites = await fetchSites();
    renderSites(S.sites);
  } catch (e) {
    console.error('Load sites error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

function renderSites(list) {
  const grid = document.getElementById('sitesList');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="empty"><p>No sites found</p></div>';
    return;
  }
  grid.innerHTML = list.map(s => `
    <div class="site-card">
      <div class="site-card-bar" style="background:${s.Status==='ACTIVE'?'var(--green)':'var(--red)'}"></div>
      <div class="site-card-name">${s.SiteName}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:8px;">
        ID: ${s.SiteID}<br>
        Radius: ${s.Radius}m<br>
        Shift: ${s.ShiftStart} - ${s.ShiftEnd}<br>
        Address: ${s.Address || '—'}<br>
        Lat/Lng: ${s.Latitude}, ${s.Longitude}
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick='editSite(${JSON.stringify(s)})'>Edit</button>
        <button class="btn btn-outline btn-sm" onclick="deleteSite('${s.SiteID}')" style="color:var(--red);">Delete</button>
      </div>
    </div>
  `).join('');
}

function filterSites() {
  const q = document.getElementById('siteSearch');
  const st = document.getElementById('siteStatusFilter');
  if (!q || !st) return;
  const qVal = q.value.toLowerCase();
  const stVal = st.value;
  const filtered = S.sites.filter(s => {
    const mq = !qVal || [s.SiteName, s.SiteID, s.Address].some(v => (v||'').toLowerCase().includes(qVal));
    return mq && (!stVal || s.Status === stVal);
  });
  renderSites(filtered);
}

function openSiteModal() {
  ['sCode','sName','sLat','sLng','sRadius','sAddress'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sShiftStart = document.getElementById('sShiftStart');
  const sShiftEnd = document.getElementById('sShiftEnd');
  const sLunch = document.getElementById('sLunch');
  const sStatus = document.getElementById('sStatus');
  if (sShiftStart) sShiftStart.value = '09:00';
  if (sShiftEnd) sShiftEnd.value = '18:00';
  if (sLunch) sLunch.value = '13:00';
  if (sStatus) sStatus.value = 'ACTIVE';
  const title = document.getElementById('siteModalTitle');
  if (title) title.textContent = 'Add Site';
  showFieldErr('siteModalErr', '');
  openModal('siteModal');
}

function editSite(s) {
  const fields = {
    'sCode': s.SiteID, 'sName': s.SiteName, 'sLat': s.Latitude,
    'sLng': s.Longitude, 'sRadius': s.Radius, 'sAddress': s.Address || ''
  };
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fields[id] || '';
  });
  const sShiftStart = document.getElementById('sShiftStart');
  const sShiftEnd = document.getElementById('sShiftEnd');
  const sLunch = document.getElementById('sLunch');
  const sStatus = document.getElementById('sStatus');
  if (sShiftStart) sShiftStart.value = s.ShiftStart || '09:00';
  if (sShiftEnd) sShiftEnd.value = s.ShiftEnd || '18:00';
  if (sLunch) sLunch.value = s.LunchTime || '13:00';
  if (sStatus) sStatus.value = s.Status || 'ACTIVE';
  const title = document.getElementById('siteModalTitle');
  if (title) title.textContent = 'Edit Site';
  showFieldErr('siteModalErr', '');
  openModal('siteModal');
}

async function saveSite() {
  const siteId = document.getElementById('sCode')?.value.trim().toUpperCase();
  const name = document.getElementById('sName')?.value.trim();
  const lat = parseFloat(document.getElementById('sLat')?.value);
  const lng = parseFloat(document.getElementById('sLng')?.value);
  const radius = parseInt(document.getElementById('sRadius')?.value);
  const shiftStart = document.getElementById('sShiftStart')?.value;
  const shiftEnd = document.getElementById('sShiftEnd')?.value;
  const lunch = document.getElementById('sLunch')?.value;
  const address = document.getElementById('sAddress')?.value.trim();
  const status = document.getElementById('sStatus')?.value;
  
  if (!siteId || !name || isNaN(lat) || isNaN(lng) || !radius) {
    showFieldErr('siteModalErr', 'Site ID, Name, Latitude, Longitude and Radius are required.');
    return;
  }
  
  try {
    const payload = {
      companyId: S.prefs.companyId,
      SiteID: siteId,
      SiteName: name,
      Latitude: lat,
      Longitude: lng,
      Radius: radius,
      ShiftStart: shiftStart,
      ShiftEnd: shiftEnd,
      LunchTime: lunch,
      Address: address,
      Status: status,
      CreatedAt: new Date(),
      UpdatedAt: new Date()
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('sites').doc(siteId).set(payload);
    
    toast('Site saved successfully!');
    closeModal('siteModal');
    loadSites();
  } catch (e) {
    console.error('Save site error:', e);
    showFieldErr('siteModalErr', e.message || 'Failed to save');
  }
}

async function deleteSite(siteId) {
  if (!confirm('Are you sure you want to delete site ' + siteId + '?')) return;
  try {
    await S.clientDb.collection('sites').doc(siteId).delete();
    toast('Site deleted successfully!');
    loadSites();
  } catch (e) {
    console.error('Delete site error:', e);
    toast('Failed to delete: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════
// ATTENDANCE
// ══════════════════════════════════════════════════════
async function loadAttendance() {
  
  if (!S.clientDb) { 
    toast('DB not connected', 'error'); 
    return; 
  }
  
  try {
    // Load sites first if not loaded
    if (S.sites.length === 0) {
      const siteSnap = await S.clientDb.collection('sites')
        .where('companyId', '==', S.prefs.companyId)
        .get();
      S.sites = siteSnap.docs.map(d => ({id:d.id,...d.data()}));
    }
    
    // Populate site dropdown
    const siteEl = document.getElementById('attSite');
    if (siteEl) {
      while (siteEl.options.length > 1) siteEl.remove(1);
      S.sites.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.SiteID;
        opt.textContent = s.SiteName || s.SiteID;
        siteEl.appendChild(opt);
      });
    }
    
    // Set current date if not set
    const dateEl = document.getElementById('attDate');
    if (dateEl && !dateEl.value) {
      dateEl.value = today();
    }
    
    const dateStr = dateEl?.value || today();
    const siteId = siteEl?.value;
    
    
    // Convert date string to Date object for Firestore query
    const queryDate = new Date(dateStr);
    
    // Fetch attendance
    let query = S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .where('Date', '==', queryDate);
    
    if (siteId && siteId !== '') {
      query = query.where('SiteID', '==', siteId);
    }
    
    const snap = await query.get();
    
    S.attRecords = snap.docs.map(d => {
      const data = d.data();
      return data;
    });
    
    renderAttTable(S.attRecords);
    updateAttSummary(S.attRecords);
    
  } catch (e) {
    console.error('❌ Attendance error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

//--------------------------------------End Load Attendance--------------------

function renderAttTable(list) {
  const tb = document.getElementById('attTableBody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    return;
  }
  tb.innerHTML = list.map(r => `
    <tr>
      <td><strong>${r.Name || '—'}</strong></td>
      <td class="mono">${r.EMPID || '—'}</td>
      <td>${r.SiteID || '—'}</td>
      <td class="mono" style="color:var(--green);">${r.InTime || '—'}</td>
      <td class="mono" style="color:var(--red);">${r.OutTime || '—'}</td>
      <td class="mono">${calcHours(r.InTime, r.OutTime)}</td>
      <td><span class="badge ${r.Status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${r.Status || '—'}</span></td>
      <td><span class="badge ${r.LocationStatus === 'INSIDE' ? 'badge-blue' : 'badge-amber'}">${r.LocationStatus || '—'}</span></td>
      <td>${r.HalfDay || 'NO'}</td>
      <td style="font-size:.75rem;color:var(--muted);">${r.MarkedBy || '—'}</td>
    </tr>
  `).join('');
}

function updateAttSummary(list) {
  const present = list.filter(r => r.Status === 'PRESENT').length;
  const inside = list.filter(r => r.LocationStatus === 'INSIDE').length;
  const summary = document.getElementById('attSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="chip">Total <span>${list.length}</span></div>
      <div class="chip" style="color:var(--green);">Present <span>${present}</span></div>
      <div class="chip" style="color:var(--red);">Absent <span>${list.length - present}</span></div>
      <div class="chip" style="color:#1565C0;">Inside Geofence <span>${inside}</span></div>
    `;
  }
}

function filterAttTable() {
  const st = document.getElementById('attStatus');
  if (!st) return;
  const stVal = st.value;
  renderAttTable(stVal ? S.attRecords.filter(r => r.Status === stVal) : S.attRecords);
}

function calcHours(i, o) {
  if (!i || !o) return '—';
  const [ih, im] = i.split(':').map(Number), [oh, om] = o.split(':').map(Number);
  const m = (oh * 60 + om) - (ih * 60 + im);
  return m <= 0 ? '—' : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ══════════════════════════════════════════════════════
// MANUAL ENTRY
// ══════════════════════════════════════════════════════
async function loadManual() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    await loadEmployees();
    await loadSites();
    populateSiteSelects();
    const mDate = document.getElementById('mDate');
    if (mDate) mDate.value = today();
  } catch (e) {
    console.error('Load manual error:', e);
  }
}

function onManualSiteChange() {
  const siteId = document.getElementById('mSite')?.value;
  const mEmpId = document.getElementById('mEmpId');
  if (!siteId || !mEmpId) return;
  const siteEmps = S.employees.filter(e => e.Site === siteId);
  while (mEmpId.options.length > 1) mEmpId.remove(1);
  siteEmps.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.EMPID;
    opt.textContent = `${e.EMPID} — ${e.EmpName}`;
    mEmpId.appendChild(opt);
  });
}

function toggleManualDefaults() {
  const useDefaults = document.getElementById('mUseDefaults')?.checked;
  const mCheckIn = document.getElementById('mCheckIn');
  const mCheckOut = document.getElementById('mCheckOut');
  const mEmpId = document.getElementById('mEmpId');
  if (!useDefaults || !mCheckIn || !mCheckOut) return;
  const emp = S.employees.find(e => e.EMPID === mEmpId?.value);
  if (!emp || !emp.Site) return;
  const site = S.sites.find(s => s.SiteID === emp.Site);
  if (site) {
    if (mCheckIn) mCheckIn.value = site.ShiftStart || '09:00';
    if (mCheckOut) mCheckOut.value = site.ShiftEnd || '18:00';
  }
}

async function submitManual() {
  const empId = document.getElementById('mEmpId')?.value;
  const date = document.getElementById('mDate')?.value;
  const checkIn = document.getElementById('mCheckIn')?.value;
  const checkOut = document.getElementById('mCheckOut')?.value;
  const halfDay = document.getElementById('mHalfDay')?.value;
  const status = document.getElementById('mStatus')?.value;
  const reason = document.getElementById('mReason')?.value.trim();
  
  if (!empId || !date) {
    toast('Employee and Date are required', 'error');
    return;
  }
  
  const emp = S.employees.find(e => e.EMPID === empId);
  if (!emp) {
    toast('Employee not found', 'error');
    return;
  }
  
  try {
    const dateObj = new Date(date);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const docId = `${empId}_${day}-${month}-${year}`;
    
    const payload = {
      companyId: S.prefs.companyId,
      EMPID: empId,
      Name: emp.EmpName,
      SiteID: emp.Site,
      Date: dateObj,
      InTime: checkIn,
      OutTime: checkOut,
      Status: status,
      LocationStatus: 'MANUAL',
      HalfDay: halfDay,
      MarkedBy: 'ADMIN',
      ManualRemark: reason,
      CreatedAt: new Date()
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('attendance').doc(docId).set(payload);
    
    toast('Manual entry saved successfully!');
    document.getElementById('manualResult').innerHTML = '<div class="result-ok">✓ Attendance saved for ' + empId + ' on ' + fmtDate(date) + '</div>';
    clearManual();
  } catch (e) {
    console.error('Manual entry error:', e);
    document.getElementById('manualResult').innerHTML = '<div class="result-err">Error: ' + e.message + '</div>';
  }
}

function clearManual() {
  ['mCheckIn','mCheckOut','mReason'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const mHalfDay = document.getElementById('mHalfDay');
  const mStatus = document.getElementById('mStatus');
  if (mHalfDay) mHalfDay.value = 'NO';
  if (mStatus) mStatus.value = 'PRESENT';
  const mDate = document.getElementById('mDate');
  if (mDate) mDate.value = today();
  const mUseDefaults = document.getElementById('mUseDefaults');
  if (mUseDefaults) mUseDefaults.checked = false;
}

// ══════════════════════════════════════════════════════
// LEAVE ENTRY → Creates records in attendance collection
// ══════════════════════════════════════════════════════
async function loadLeave() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    await loadEmployees();
    await loadSites();
    populateSiteSelects();
    const leaveFrom = document.getElementById('leaveFrom');
    const leaveTo = document.getElementById('leaveTo');
    if (leaveFrom) leaveFrom.value = today();
    if (leaveTo) leaveTo.value = today();
  } catch (e) {
    console.error('Load leave error:', e);
  }
}

function onLeaveSiteChange() {
  const siteId = document.getElementById('leaveSite')?.value;
  const leaveEmpId = document.getElementById('leaveEmpId');
  if (!siteId || !leaveEmpId) return;
  const siteEmps = S.employees.filter(e => e.Site === siteId);
  while (leaveEmpId.options.length > 1) leaveEmpId.remove(1);
  siteEmps.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.EMPID;
    opt.textContent = `${e.EMPID} — ${e.EmpName}`;
    leaveEmpId.appendChild(opt);
  });
}

async function submitLeave() {
  const empId = document.getElementById('leaveEmpId')?.value;
  const fromDate = document.getElementById('leaveFrom')?.value;
  const toDate = document.getElementById('leaveTo')?.value;
  const leaveType = document.getElementById('leaveType')?.value;
  const reason = document.getElementById('leaveReason')?.value.trim();
  
  if (!empId || !fromDate || !toDate || !leaveType) {
    toast('Employee, From Date, To Date and Leave Type are required', 'error');
    return;
  }
  
  const emp = S.employees.find(e => e.EMPID === empId);
  if (!emp) {
    toast('Employee not found', 'error');
    return;
  }
  
  try {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    const timeDiff = Math.abs(endDate - startDate);
    const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    
    let createdCount = 0;
    
    for (let i = 0; i < dayDiff; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const day = String(currentDate.getDate()).padStart(2, '0');
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();
      const docId = `${empId}_${day}-${month}-${year}`;
      
      const payload = {
        companyId: S.prefs.companyId,
        EMPID: empId,
        Name: emp.EmpName,
        SiteID: emp.Site,
        Date: currentDate,
        InTime: null,
        OutTime: null,
        Status: leaveType,
        LocationStatus: 'LEAVE',
        HalfDay: 'NO',
        MarkedBy: 'ADMIN',
        ManualRemark: `${leaveType} - ${reason}`,
        CreatedAt: new Date()
      };
      
      await S.clientDb.collection('attendance').doc(docId).set(payload);
      createdCount++;
    }
    
    toast(`Leave application saved for ${createdCount} day(s)!`);
    document.getElementById('leaveResult').innerHTML = `<div class="result-ok">✓ Leave records created for ${empId} from ${fmtDate(fromDate)} to ${fmtDate(toDate)}</div>`;
    clearLeave();
    
  } catch (e) {
    console.error('Leave entry error:', e);
    document.getElementById('leaveResult').innerHTML = `<div class="result-err">Error: ${e.message}</div>`;
  }
}

function clearLeave() {
  ['leaveReason'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const leaveFrom = document.getElementById('leaveFrom');
  const leaveTo = document.getElementById('leaveTo');
  if (leaveFrom) leaveFrom.value = today();
  if (leaveTo) leaveTo.value = today();
}

// ══════════════════════════════════════════════════════
// REPORTS (Client-side filtering to avoid index error)
// ══════════════════════════════════════════════════════
async function loadReports() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    await loadEmployees();
    await loadSites();
    populateSiteSelects();
    const rptFrom = document.getElementById('rptFrom');
    const rptTo = document.getElementById('rptTo');
    if (rptFrom) rptFrom.value = new Date(new Date().setDate(1)).toISOString().slice(0,10);
    if (rptTo) rptTo.value = today();
  } catch (e) {
    console.error('Load reports error:', e);
  }
}


// Global storage for report data
S.reportData = [];

async function generateReport() {
  const fromInput = document.getElementById('rptFrom')?.value;
  const toInput = document.getElementById('rptTo')?.value;
  
  if (!fromInput || !toInput) { 
    toast('Please select both From and To dates', 'error'); 
    return; 
  }

  const fromDate = new Date(fromInput);
  const toDate = new Date(toInput);
  // Set time to end of day for inclusive filtering
  toDate.setHours(23, 59, 59, 999);

  try {
    // Fetch all attendance for the company
    const snap = await S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    // Filter in memory for date range (more flexible than Firestore composite queries)
    S.reportData = snap.docs.map(d => d.data()).filter(r => {
      const rDate = r.Date?.toDate ? r.Date.toDate() : new Date(r.Date);
      return rDate >= fromDate && rDate <= toDate;
    });
    
    // Render the table
    renderReportTable(S.reportData);
    toast(`Report generated: ${S.reportData.length} records found`);
    
  } catch (e) {
    console.error('Report error:', e);
    toast('Failed to generate report: ' + e.message, 'error');
  }
}


function exportReportCSV() {
  if (!S.reportData.length) { toast('No data to export', 'error'); return; }
  
  let csv = 'Date,Employee,EMPID,Site,In Time,Out Time,Hours,Status,Half Day\n';
  S.reportData.forEach(r => {
    csv += [
      fmtDate(r.Date), r.Name, r.EMPID, r.SiteID, 
      r.InTime || '-', r.OutTime || '-', calcHours(r.InTime, r.OutTime), 
      r.Status, r.HalfDay || 'NO'
    ].map(v => `"${v}"`).join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_report_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV exported successfully!');
}

function exportReportPDF() {
  if (!S.reportData || !S.reportData.length) { 
    toast('No data to export. Generate a report first.', 'error'); 
    return; 
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // ─── HEADER ───────────────────────────────────────
  doc.setFontSize(18);
  doc.setTextColor(0, 106, 114);
  doc.text('Attendance Report', 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // ✅ Get company name properly
  const companyName = S.prefs.companyName || 'Company';
  
  // ✅ Format date manually as DD/MM/YYYY
  const now = new Date();
  const genDate = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  
  // Left align: Company Name
  doc.text(`Company: ${companyName}`, 14, 22);
  
  // Right align: Generated Date
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(`Generated: ${genDate}`, pageWidth - 14, 22, { align: 'right' });

  // ─── TABLE ───────────────────────────────────────
  doc.autoTable({
    head: [['Date', 'Employee', 'EMPID', 'Site', 'In', 'Out', 'Hours', 'Status', 'Half Day']],
    body: S.reportData.map(r => [
      fmtDate(r.Date),  // ✅ Now returns dd/mm/yyyy
      r.Name || '—', 
      r.EMPID || '—', 
      r.SiteID || '—', 
      r.InTime || '—', 
      r.OutTime || '—', 
      calcHours(r.InTime, r.OutTime), 
      r.Status || '—', 
      r.HalfDay || 'NO'
    ]),
    startY: 30,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 106, 114], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  doc.save(`attendance_report_${today().replace(/-/g, '')}.pdf`);
  toast('✅ PDF exported successfully!');
}

function renderReportTable(list) {
  const tb = document.getElementById('rptTableBody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records in this range</td></tr>';
    return;
  }
  tb.innerHTML = list.map(r => `
    <tr>
      <td class="mono">${fmtDate(r.Date)}</td>
      <td><strong>${r.Name || '—'}</strong></td>
      <td class="mono">${r.EMPID || '—'}</td>
      <td>${r.SiteID || '—'}</td>
      <td class="mono" style="color:var(--green);">${r.InTime || '—'}</td>
      <td class="mono" style="color:var(--red);">${r.OutTime || '—'}</td>
      <td class="mono">${calcHours(r.InTime, r.OutTime)}</td>
      <td><span class="badge ${r.Status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${r.Status || '—'}</span></td>
      <td>${r.HalfDay || 'NO'}</td>
      <td style="font-size:.75rem;color:var(--muted);">${r.MarkedBy || '—'}</td>
    </tr>
  `).join('');
}

function updateReportSummary(list) {
  const present = list.filter(r => r.Status === 'PRESENT').length;
  const summary = document.getElementById('rptSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="chip">Total <span>${list.length}</span></div>
      <div class="chip" style="color:var(--green);">Present <span>${present}</span></div>
      <div class="chip" style="color:var(--red);">Absent <span>${list.length - present}</span></div>
    `;
  }
}

function exportCSV() {
  const tb = document.getElementById('rptTableBody');
  if (!tb || tb.rows.length <= 1) {
    toast('No data to export', 'error');
    return;
  }
  
  let csv = 'Date,Employee,EMPID,Site,In Time,Out Time,Hours,Status,Half Day,Marked By\n';
  for (let i = 1; i < tb.rows.length; i++) {
    const row = tb.rows[i];
    const cells = row.cells;
    csv += Array.from(cells).map(cell => `"${cell.textContent}"`).join(',') + '\n';
  }
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'attendance_report_' + today() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  
  toast('CSV exported successfully!');
}

// ══════════════════════════════════════════════════════
// HOLIDAYS
// ══════════════════════════════════════════════════════
async function loadHolidays() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    const snap = await S.clientDb.collection('holidays')
      .where('companyId','==',S.prefs.companyId).get();
    S.holidays = snap.docs.map(d => ({id:d.id,...d.data()}));
    renderHolidays(S.holidays);
  } catch (e) {
    console.error('Load holidays error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

function renderHolidays(list) {
  const tb = document.getElementById('holidaysTableBody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--muted);">No holidays found</td></tr>';
    return;
  }
  tb.innerHTML = list.map(h => `
    <tr>
      <td>${h.HolidayID || '—'}</td>
      <td class="mono">${fmtDate(h.Date)}</td>
      <td><strong>${h.HolidayName || '—'}</strong></td>
      <td>${h.Type || '—'}</td>
      <td>${h.Day || '—'}</td>
      <td>${h.ApplicableSites || 'ALL'}</td>
      <td>${h.State || 'ALL'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='editHoliday(${JSON.stringify(h)})'>Edit</button>
        <button class="btn btn-outline btn-sm" onclick="deleteHoliday('${h.HolidayID}')" style="color:var(--red);margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterHolidays() {
  const q = document.getElementById('holidaySearch');
  const type = document.getElementById('holidayTypeFilter');
  if (!q || !type) return;
  const qVal = q.value.toLowerCase();
  const typeVal = type.value;
  const filtered = S.holidays.filter(h => {
    const mq = !qVal || [h.HolidayName, h.HolidayID].some(v => (v||'').toLowerCase().includes(qVal));
    return mq && (!typeVal || h.Type === typeVal);
  });
  renderHolidays(filtered);
}

function openHolidayModal() {
  ['hCode','hName','hState','hDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const hDate = document.getElementById('hDate');
  const hType = document.getElementById('hType');
  const hDay = document.getElementById('hDay');
  const hSites = document.getElementById('hSites');
  if (hDate) hDate.value = today();
  if (hType) hType.value = 'National Holiday';
  if (hSites) hSites.value = 'ALL';
  const title = document.getElementById('holidayModalTitle');
  if (title) title.textContent = 'Add Holiday';
  showFieldErr('holidayModalErr', '');
  openModal('holidayModal');
}

function editHoliday(h) {
  const fields = {
    'hCode': h.HolidayID, 'hName': h.HolidayName, 
    'hState': h.State || '', 'hDesc': h.Description || ''
  };
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fields[id] || '';
  });
  const hDate = document.getElementById('hDate');
  const hType = document.getElementById('hType');
  const hDay = document.getElementById('hDay');
  const hSites = document.getElementById('hSites');
  if (hDate) hDate.value = h.Date || '';
  if (hType) hType.value = h.Type || 'National Holiday';
  if (hDay) hDay.value = h.Day || '';
  if (hSites) hSites.value = h.ApplicableSites || 'ALL';
  const title = document.getElementById('holidayModalTitle');
  if (title) title.textContent = 'Edit Holiday';
  showFieldErr('holidayModalErr', '');
  openModal('holidayModal');
}

async function saveHoliday() {
  const hCode = document.getElementById('hCode')?.value.trim().toUpperCase();
  const hName = document.getElementById('hName')?.value.trim();
  const hDate = document.getElementById('hDate')?.value;
  const hType = document.getElementById('hType')?.value;
  const hDay = document.getElementById('hDay')?.value;
  const hSites = document.getElementById('hSites')?.value;
  const hState = document.getElementById('hState')?.value.trim();
  const hDesc = document.getElementById('hDesc')?.value.trim();
  
  if (!hCode || !hName || !hDate) {
    showFieldErr('holidayModalErr', 'Holiday ID, Name and Date are required.');
    return;
  }
  
  try {
    const payload = {
      companyId: S.prefs.companyId,
      HolidayID: hCode,
      HolidayName: hName,
      Date: new Date(hDate),
      Type: hType,
      Day: hDay,
      ApplicableSites: hSites,
      State: hState,
      Description: hDesc,
      CreatedAt: new Date()
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('holidays').doc(hCode).set(payload);
    
    toast('Holiday saved successfully!');
    closeModal('holidayModal');
    loadHolidays();
  } catch (e) {
    console.error('Save holiday error:', e);
    showFieldErr('holidayModalErr', e.message || 'Failed to save');
  }
}

async function deleteHoliday(holidayId) {
  if (!confirm('Are you sure you want to delete holiday ' + holidayId + '?')) return;
  try {
    await S.clientDb.collection('holidays').doc(holidayId).delete();
    toast('Holiday deleted successfully!');
    loadHolidays();
  } catch (e) {
    console.error('Delete holiday error:', e);
    toast('Failed to delete: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════
// PHOTO UPLOAD FUNCTIONS (Local File Upload)
// ══════════════════════════════════════════════════════
// Global variable for photo upload
let currentPhotoEmpId = null;

// Open photo modal
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

// Preview and validate image
document.getElementById('photoFile')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('photoPreview');
  const img = document.getElementById('photoImg');
  const err = document.getElementById('photoErr');
  
  if (!file) {
    preview.style.display = 'none';
    return;
  }
  
  // Validate file type
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    err.textContent = '❌ Only JPG or PNG files are allowed';
    err.style.display = 'block';
    preview.style.display = 'none';
    return;
  }
  
  // Validate file size (max 20KB)
  if (file.size > 20 * 1024) {
    err.textContent = '❌ File size must be under 20KB (current: ' + Math.round(file.size/1024) + 'KB)';
    err.style.display = 'block';
    preview.style.display = 'none';
    return;
  }
  
  // Show preview
  const reader = new FileReader();
  reader.onload = function(event) {
    img.src = event.target.result;
    preview.style.display = 'block';
    err.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

// Save photo to Firebase Storage
// ══════════════════════════════════════════════════════
// PHOTO UPLOAD - JPG ONLY, <50KB, BYTES TYPE
// ══════════════════════════════════════════════════════
async function savePhoto() {
  const fileInput = document.getElementById('photoFile');
  const file = fileInput.files[0];
  const err = document.getElementById('photoErr');
  const btn = document.getElementById('btnSavePhoto');

  if (!file) { err.textContent = 'Select a JPG file'; err.style.display = 'block'; return; }
  if (!['image/jpeg', 'image/jpg'].includes(file.type.toLowerCase())) {
    err.textContent = '❌ Only JPG files allowed'; err.style.display = 'block'; return;
  }
  if (file.size > 200 * 1024) {
    err.textContent = '❌ File too large. Please use image under 200KB'; err.style.display = 'block'; return;
  }
  if (!currentPhotoEmpId || !S.clientDb) {
    err.textContent = 'System not ready'; err.style.display = 'block'; return;
  }

  btn.disabled = true;
  btn.textContent = 'Compressing...';
  err.style.display = 'none';

  try {
    console.log('📤 Starting upload for:', currentPhotoEmpId);

    // 1. Compress to JPG <50KB
    const compressedBlob = await compressJPG(file, 300, 0.7);
    const finalSizeKB = Math.round(compressedBlob.size / 1024);
    
    if (finalSizeKB > 50) {
      throw new Error('Image still too large (' + finalSizeKB + 'KB). Max 50KB.');
    }

    // 2. Convert to Uint8Array
    const arrayBuffer = await compressedBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // ✅ 3. Convert to Firestore Blob (CRITICAL FIX)
    const photoBlob = firebase.firestore.Blob.fromUint8Array(uint8Array);

    console.log('📦 Converted to Firestore Blob:', uint8Array.length, 'bytes');

    // 4. Save to Firestore
    await S.clientDb.collection('employees').doc(currentPhotoEmpId).update({
      Photo: photoBlob,           // ✅ Firestore Blob type
      PhotoType: 'image/jpeg',
      PhotoSize: uint8Array.length,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Saved to Firestore');
    toast('✅ Photo saved (' + finalSizeKB + 'KB)!');
    closeModal('photoModal');
    loadEmployees();

  } catch (error) {
    console.error('❌ Upload failed:', error);
    err.textContent = error.message || 'Upload failed';
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Upload Photo';
  }
}

// ══════════════════════════════════════════════════════
// HELPER: Compress to JPG Blob (<50KB target)
// ══════════════════════════════════════════════════════
function compressJPG(file, maxSize = 300, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate dimensions (max 300x300)
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // ✅ Fill white background (JPG doesn't support transparency)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // ✅ Convert to JPG Blob with quality adjustment
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // If still too large, reduce quality and retry (max 3 attempts)
              if (blob.size > 50 * 1024 && quality > 0.4) {
                compressJPG(file, maxSize, quality - 0.1).then(resolve).catch(reject);
              } else {
                resolve(blob);
              }
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',  // ✅ Force JPG output
          quality
        );
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════════
// LEAVE BALANCES FUNCTIONS
// ══════════════════════════════════════════════════════

function addLeaveBalance() {
  // Clear form
  document.getElementById('lbEmpId').value = '';
  document.getElementById('lbYear').value = new Date().getFullYear();
  document.getElementById('lbPlTotal').value = 20;
  document.getElementById('lbPlUsed').value = 0;
  document.getElementById('lbClTotal').value = 12;
  document.getElementById('lbClUsed').value = 0;
  document.getElementById('lbSlTotal').value = 12;
  document.getElementById('lbSlUsed').value = 0;
  document.getElementById('lbCoTotal').value = 0;
  document.getElementById('lbCoUsed').value = 0;
  document.getElementById('lbLop').value = 0;
  
  // Populate employee dropdown
  const empSelect = document.getElementById('lbEmpId');
  while (empSelect.options.length > 1) empSelect.remove(1);
  S.employees.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.EMPID;
    opt.textContent = `${e.EMPID} — ${e.EmpName}`;
    empSelect.appendChild(opt);
  });
  
  openModal('leaveBalModal');
}


async function loadLeaveBalances() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    // Auto-set current year as default
    const yearFilter = document.getElementById('leaveYearFilter');
    if (yearFilter && !yearFilter.value) {
      yearFilter.value = new Date().getFullYear();
    }
    const currentYear = parseInt(yearFilter.value) || new Date().getFullYear();
    
    console.log('🔍 Loading leave balances for year:', currentYear);
    const snap = await S.clientDb.collection('leave_balances')
      .where('companyId', '==', S.prefs.companyId)
      .where('leaveYear', '==', currentYear)
      .get();
    
    S.leaveBalances = snap.docs.map(d => ({id:d.id,...d.data()}));
    
    if (S.leaveBalances.length > 0 && S.employees.length === 0) {
      S.employees = await fetchEmployees();
    }
    
    renderLeaveBalances(S.leaveBalances);
    console.log('✅ Leave balances loaded:', S.leaveBalances.length);
  } catch (e) {
    console.error('Load leave balances error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

function renderLeaveBalances(list) {
  const tb = document.getElementById('leaveBalTableBody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted);">No leave balances found for this year. Click "Add Balance" to create one.</td></tr>';
    return;
  }
  tb.innerHTML = list.map(lb => {
    const emp = S.employees.find(e => e.EMPID === lb.EMPID);
    const empName = lb.empName || (emp ? emp.EmpName : 'Unknown');
    return `
    <tr>
      <td><strong>${lb.EMPID || '—'}</strong></td>
      <td>${empName}</td>
      <td><span style="color:var(--teal);font-weight:bold;">${lb.privilege_leave?.balance || 0}</span></td>
      <td><span style="color:var(--teal);font-weight:bold;">${lb.casual_leave?.balance || 0}</span></td>
      <td><span style="color:var(--teal);font-weight:bold;">${lb.sick_leave?.balance || 0}</span></td>
      <td>${lb.comp_off?.balance || 0}</td>
      <td>${lb.loss_of_pay || 0}</td>
      <td class="mono">${lb.leaveYear || '—'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='editLeaveBalance("${lb.id}", ${JSON.stringify(lb).replace(/"/g, '&quot;')})'>Edit</button>
      </td>
    </tr>`;
  }).join('');
}

function filterLeaveBalances() {
  const q = document.getElementById('leaveSearch')?.value.toLowerCase() || '';
  renderLeaveBalances(q ? S.leaveBalances.filter(lb => (lb.EMPID||'').toLowerCase().includes(q) || (lb.empName||'').toLowerCase().includes(q)) : S.leaveBalances);
}

// ✅ NEW: Add Leave Balance
function addLeaveBalance() {
  if (S.employees.length === 0) fetchEmployees().then(() => populateLeaveEmpDropdown());
  else populateLeaveEmpDropdown();
  
  // Set defaults
  document.getElementById('lbEmpId').value = '';
  document.getElementById('lbYear').value = new Date().getFullYear();
  document.getElementById('lbPlTotal').value = 20; document.getElementById('lbPlUsed').value = 0;
  document.getElementById('lbClTotal').value = 12; document.getElementById('lbClUsed').value = 0;
  document.getElementById('lbSlTotal').value = 12; document.getElementById('lbSlUsed').value = 0;
  document.getElementById('lbCoTotal').value = 0; document.getElementById('lbCoUsed').value = 0;
  document.getElementById('lbLop').value = 0;
  
  document.getElementById('leaveBalModalTitle').textContent = 'Add Leave Balance';
  openModal('leaveBalModal');
}

function populateLeaveEmpDropdown() {
  const empSelect = document.getElementById('lbEmpId');
  while(empSelect.options.length > 1) empSelect.remove(1);
  S.employees.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.EMPID;
    opt.textContent = `${e.EMPID} — ${e.EmpName}`;
    empSelect.appendChild(opt);
  });
}

function editLeaveBalance(docId, lb) {
  document.getElementById('lbEmpId').value = lb.EMPID || '';
  document.getElementById('lbYear').value = lb.leaveYear || new Date().getFullYear();
  document.getElementById('lbPlTotal').value = lb.privilege_leave?.total || 0;
  document.getElementById('lbPlUsed').value = lb.privilege_leave?.utilized || 0;
  document.getElementById('lbClTotal').value = lb.casual_leave?.total || 0;
  document.getElementById('lbClUsed').value = lb.casual_leave?.utilized || 0;
  document.getElementById('lbSlTotal').value = lb.sick_leave?.total || 0;
  document.getElementById('lbSlUsed').value = lb.sick_leave?.utilized || 0;
  document.getElementById('lbCoTotal').value = lb.comp_off?.total || 0;
  document.getElementById('lbCoUsed').value = lb.comp_off?.utilized || 0;
  document.getElementById('lbLop').value = lb.loss_of_pay || 0;
  
  // Store docId for saving
  document.getElementById('lbDocId').value = docId || 'NEW';
  document.getElementById('leaveBalModalTitle').textContent = docId ? 'Edit Leave Balance' : 'Add Leave Balance';
  openModal('leaveBalModal');
}

async function saveLeaveBalance() {
  const empId = document.getElementById('lbEmpId').value;
  const year = parseInt(document.getElementById('lbYear').value) || new Date().getFullYear();
  const docId = document.getElementById('lbDocId').value;
  
  if (!empId) { toast('Please select an employee', 'error'); return; }
  
  const plT = parseInt(document.getElementById('lbPlTotal').value) || 0;
  const plU = parseInt(document.getElementById('lbPlUsed').value) || 0;
  const clT = parseInt(document.getElementById('lbClTotal').value) || 0;
  const clU = parseInt(document.getElementById('lbClUsed').value) || 0;
  const slT = parseInt(document.getElementById('lbSlTotal').value) || 0;
  const slU = parseInt(document.getElementById('lbSlUsed').value) || 0;
  const coT = parseInt(document.getElementById('lbCoTotal').value) || 0;
  const coU = parseInt(document.getElementById('lbCoUsed').value) || 0;
  const lop = parseInt(document.getElementById('lbLop').value) || 0;
  
  const emp = S.employees.find(e => e.EMPID === empId);
  const payload = {
    companyId: S.prefs.companyId,
    EMPID: empId,
    empName: emp ? emp.EmpName : '',
    leaveYear: year,
    privilege_leave: { total: plT, utilized: plU, balance: plT - plU, carried_fwd: 0 },
    casual_leave: { total: clT, utilized: clU, balance: clT - clU },
    sick_leave: { total: slT, utilized: slU, balance: slT - slU },
    comp_off: { total: coT, utilized: coU, balance: coT - coU },
    loss_of_pay: lop,
    lastUpdated: new Date()
  };
  
  try {
    const targetId = docId === 'NEW' ? `${S.prefs.companyId}_${empId}_${year}` : docId;
    await S.clientDb.collection('leave_balances').doc(targetId).set(payload);
    toast('✅ Leave balance saved successfully!');
    closeModal('leaveBalModal');
    loadLeaveBalances();
  } catch (e) {
    console.error('Save leave balance error:', e);
    toast('Error: ' + e.message, 'error');
  }
}



// ══════════════════════════════════════════════════════
// RECTIFICATIONS FUNCTIONS
// ══════════════════════════════════════════════════════

S.rectRecords = []; // Initialize storage

async function loadRectifications() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  
  const dateEl = document.getElementById('rectDate');
  const siteEl = document.getElementById('rectSite');
  
  // Default to today
  if (!dateEl.value) dateEl.value = today();
  
  // Populate Sites
  if (siteEl.options.length <= 1 && S.sites.length > 0) {
    while (siteEl.options.length > 1) siteEl.remove(1);
    S.sites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.SiteID; opt.textContent = s.SiteName || s.SiteID;
      siteEl.appendChild(opt);
    });
  }
  
  const dateStr = dateEl.value;
  const siteId = siteEl.value;
  
  try {
    // Query Attendance for the selected date
    let query = S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .where('Date', '==', new Date(dateStr));
    
    if (siteId) query = query.where('SiteID', '==', siteId);
    
    const snap = await query.get();
    S.rectRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    renderRectTable(S.rectRecords);
    updateRectSummary(S.rectRecords);
    
  } catch (e) {
    console.error('Rect load error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

function renderRectTable(list) {
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;
  
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    // Status Color Logic
    let statusText = r.Status || '—';
    let statusClass = 'badge-gray';
    if (statusText === 'PRESENT') statusClass = 'badge-green';
    else if (statusText === 'ABSENT') statusClass = 'badge-red';
    else if (statusText === 'ON_LEAVE') { statusClass = 'badge-amber'; statusText = 'ON_LEAVE'; }
    
    // Location Badge
    let locText = r.LocationStatus || '—';
    let locClass = 'badge-gray';
    if (locText === 'INSIDE') locClass = 'badge-green';
    else if (locText === 'MANUAL') locClass = 'badge-amber';

    return `
      <tr>
        <td><strong>${r.Name || '—'}</strong></td>
        <td class="mono">${r.EMPID || '—'}</td>
        <td>${r.SiteID || '—'}</td>
        <td class="mono">${r.InTime || '—'}</td>
        <td class="mono">${r.OutTime || '—'}</td>
        <td class="mono">${calcHours(r.InTime, r.OutTime)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td><span class="badge ${locClass}">${locText}</span></td>
        <td>${r.HalfDay || 'NO'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='openRectifyModal(${JSON.stringify(r).replace(/"/g, '&quot;')})'>✏️ Edit</button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateRectSummary(list) {
  document.getElementById('rectTotal').textContent = list.length;
  document.getElementById('rectPresent').textContent = list.filter(x => x.Status === 'PRESENT').length;
  document.getElementById('rectAbsent').textContent = list.filter(x => x.Status === 'ABSENT').length;
  document.getElementById('rectLeave').textContent = list.filter(x => x.Status === 'ON_LEAVE').length;
}

// Modal for Editing
function openRectifyModal(r) {
  document.getElementById('rectDocId').value = r.id || '';
  document.getElementById('rectEmpName').value = r.Name || r.EMPID;
  
  // ✅ FIX: Manually convert Timestamp to "DD/MM/YYYY" string
  let displayDate = '—';
  if (r.Date) {
    const dt = r.Date.toDate ? r.Date.toDate() : new Date(r.Date);
    if (!isNaN(dt)) {
      displayDate = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    }
  }
  document.getElementById('rectDateDisp').value = displayDate;

  // Set other fields
  document.getElementById('rectStatus').value = r.Status || 'PRESENT';
  document.getElementById('rectLocation').value = r.LocationStatus || 'MANUAL';
  document.getElementById('rectIn').value = r.InTime || '';
  document.getElementById('rectOut').value = r.OutTime || '';
  document.getElementById('rectHalfDay').value = r.HalfDay || 'NO';
  document.getElementById('rectRemarks').value = r.Remarks || '';
  
  showFieldErr('rectErr', '');
  openModal('attRectModal');
}

async function saveRectification() {
  const docId = document.getElementById('rectDocId').value;
  if (!docId) { toast('Error: No record ID', 'error'); return; }
  
  try {
    const payload = {
      Status: document.getElementById('rectStatus').value,
      LocationStatus: document.getElementById('rectLocation').value,
      InTime: document.getElementById('rectIn').value || null,
      OutTime: document.getElementById('rectOut').value || null,
      HalfDay: document.getElementById('rectHalfDay').value,
      Remarks: document.getElementById('rectRemarks').value.trim(),
      RectifiedAt: new Date(),
      RectifiedBy: 'ADMIN'
    };
    
    await S.clientDb.collection('attendance').doc(docId).update(payload);
    
    toast('✅ Record updated successfully!');
    closeModal('attRectModal');
    loadRectifications(); // Refresh table
  } catch (e) {
    console.error(e);
    showFieldErr('rectErr', 'Failed: ' + e.message);
  }
}


// ══════════════════════════════════════════════════════
// WEEKLY OFF - COMPLETE FUNCTIONS
// ══════════════════════════════════════════════════════

async function loadWeeklyOff() {
  
  if (!S.clientDb) { 
    toast('DB not connected', 'error'); 
    return; 
  }
  
  try {
    // Load sites first
    if (S.sites.length === 0) {
      const siteSnap = await S.clientDb.collection('sites')
        .where('companyId', '==', S.prefs.companyId)
        .get();
      S.sites = siteSnap.docs.map(d => ({id:d.id,...d.data()}));
    }
    
    // Fetch weekly offs
    const snap = await S.clientDb.collection('weekly_offs')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    const weeklyOffs = snap.docs.map(d => ({id:d.id,...d.data()}));
    
    // Find table
    const tb = document.getElementById('weeklyOffTableBody');
    if (!tb) {
      console.error('❌ [WeeklyOff] Table body not found!');
      return;
    }
    
    // Render
    if (!weeklyOffs.length) {
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No weekly off configurations found. Click "Add Weekly Off" to create one.</td></tr>';
      return;
    }
    
    tb.innerHTML = weeklyOffs.map(wo => {
      const site = S.sites.find(s => s.SiteID === wo.SiteID);
      return `
      <tr>
        <td class="mono">${wo.SiteID || '—'}</td>
        <td><strong>${site ? site.SiteName : wo.SiteName || '—'}</strong></td>
        <td>${wo.WeeklyOff1 || '—'}</td>
        <td>${wo.WeeklyOff2 || 'None'}</td>
        <td class="mono">${fmtDate(wo.EffectiveFrom)}</td>
        <td>${wo.Remarks || '—'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='editWeeklyOff(${JSON.stringify(wo)})'>Edit</button>
          <button class="btn btn-outline btn-sm" onclick="deleteWeeklyOff('${wo.SiteID}')" style="color:var(--red);margin-left:4px;">Delete</button>
        </td>
      </tr>
    `}).join('');
    
    
  } catch (e) {
    console.error('❌ [WeeklyOff] Error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

function populateWoSiteSelect() {
  const woSite = document.getElementById('woSite');
  if (!woSite) return;

  // Clear existing options except the first placeholder
  while (woSite.options.length > 1) woSite.remove(1);

  // 1. Add "All Sites" option at the very top
  const allOpt = document.createElement('option');
  allOpt.value = 'ALL';
  allOpt.textContent = '🌐 All Sites';
  woSite.appendChild(allOpt);

  // 2. Add actual sites from the database
  S.sites.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.SiteID;
    opt.textContent = `${s.SiteID} — ${s.SiteName}`;
    woSite.appendChild(opt);
  });

}

function openWeeklyOffModal() {
 
  // Clear form
  document.getElementById('woSite').value = '';
  document.getElementById('woDay1').value = 'Sunday';
  document.getElementById('woDay2').value = 'None';
  document.getElementById('woEffDate').value = today();
  document.getElementById('woRemarks').value = '';
  
  // Populate sites
  populateWoSiteSelect();
  
  // Set title
  document.getElementById('weeklyOffModalTitle').textContent = 'Add Weekly Off Config';
  showFieldErr('weeklyOffModalErr', '');
  
  openModal('weeklyOffModal');
}

function editWeeklyOff(wo) {
 
  // Fill form
  document.getElementById('woSite').value = wo.SiteID || '';
  document.getElementById('woDay1').value = wo.WeeklyOff1 || 'Sunday';
  document.getElementById('woDay2').value = wo.WeeklyOff2 || 'None';
  
  // Convert date for input (yyyy-mm-dd)
  let effDateStr = '';
  if (wo.EffectiveFrom) {
    const dt = wo.EffectiveFrom.toDate ? wo.EffectiveFrom.toDate() : new Date(wo.EffectiveFrom);
    if (!isNaN(dt)) {
      effDateStr = dt.toISOString().split('T')[0];
    }
  }
  document.getElementById('woEffDate').value = effDateStr || today();
  
  document.getElementById('woRemarks').value = wo.Remarks || '';
  
  // Populate sites
  populateWoSiteSelect();
  
  // Set title
  document.getElementById('weeklyOffModalTitle').textContent = 'Edit Weekly Off Config';
  showFieldErr('weeklyOffModalErr', '');
  
  openModal('weeklyOffModal');
}

async function saveWeeklyOff() {
  
  const woSite = document.getElementById('woSite')?.value;
  const woDay1 = document.getElementById('woDay1')?.value;
  const woDay2 = document.getElementById('woDay2')?.value;
  const woEffDate = document.getElementById('woEffDate')?.value;
  const woRemarks = document.getElementById('woRemarks')?.value.trim();
  
  // Validation
  if (!woSite || !woDay1 || !woEffDate) {
    showFieldErr('weeklyOffModalErr', 'Site, Weekly Off Day 1 and Effective From are required.');
    return;
  }
  
  try {
    const effDate = new Date(woEffDate);
    
    const payload = {
      companyId: S.prefs.companyId,
      SiteID: woSite,
      WeeklyOff1: woDay1,
      WeeklyOff2: woDay2,
      EffectiveFrom: effDate,
      Remarks: woRemarks,
      CreatedAt: new Date(),
      UpdatedAt: new Date()
    };
    
    
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('weekly_offs').doc(woSite).set(payload);
    
    toast('✅ Weekly off configuration saved successfully!');
    closeModal('weeklyOffModal');
    loadWeeklyOff();
    
  } catch (e) {
    console.error('❌ [WeeklyOff] Save error:', e);
    showFieldErr('weeklyOffModalErr', e.message || 'Failed to save');
  }
}

async function deleteWeeklyOff(siteId) {
  if (!confirm('Are you sure you want to delete weekly off config for ' + siteId + '?')) return;
  
  try {
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('weekly_offs').doc(siteId).delete();
    
    toast('✅ Weekly off configuration deleted successfully!');
    loadWeeklyOff();
    
  } catch (e) {
    console.error('❌ [WeeklyOff] Delete error:', e);
    toast('Failed to delete: ' + e.message, 'error');
  }
}


//-------------- end of weekly off functions ----------------



// ══════════════════════════════════════════════════════
// SUPPORT
// ══════════════════════════════════════════════════════

async function loadSupport() {
  
  try {
    // Fetch company data to populate plan details
    const companySnap = await S.clientDb.collection('companies')
      .doc(S.prefs.companyId)
      .get();
    
    if (companySnap.exists) {
      const companyData = companySnap.data();
      
      // Update plan details
      const planEl = document.querySelector('#pgSupport .card:nth-child(1) .card-body div:nth-child(2) div:nth-child(1) div:nth-child(2)');
      const validUntilEl = document.querySelector('#pgSupport .card:nth-child(1) .card-body div:nth-child(2) div:nth-child(2) div:nth-child(2)');
      const companyEl = document.querySelector('#pgSupport .card:nth-child(1) .card-body div:nth-child(3) div:nth-child(1) div:nth-child(2)');
      const adminEl = document.querySelector('#pgSupport .card:nth-child(1) .card-body div:nth-child(3) div:nth-child(2) div:nth-child(2)');
      
      if (planEl) planEl.textContent = companyData.plan || '—';
      if (validUntilEl) validUntilEl.textContent = companyData.endDate ? fmtDate(companyData.endDate) : '—';
      if (companyEl) companyEl.textContent = companyData.companyName || '—';
      if (adminEl) adminEl.textContent = companyData.adminEmail || '—';
    }
  } catch (e) {
    console.error('Error loading support data:', e);
  }
}
// ══════════════════════════════════════════════════════
// AUTO-INITIALIZE COMPANY DATA (Creates template docs for new companies)
// ══════════════════════════════════════════════════════
async function initializeCompanyData(companyId, adminEmail, companyName) {
  console.log('🚀 [INIT] Checking collections for', companyId);
  
  if (!S.clientDb) {
    console.warn('⚠️ [INIT] Client DB not ready, skipping initialization');
    return;
  }
  
  try {
    const now = new Date();
    const dateTimestamp = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
    const defaultPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // SHA-256 of "123456"
    const empId = companyId.slice(0, 3).toUpperCase() + '101';

    // Helper: Check if collection has data, or create template doc
    const ensureCollection = async (colName, docId, docData, isEmployee = false) => {
      try {
        const check = await S.clientDb.collection(colName).limit(1).get();
        
        // Skip if collection already has data (except for employees which we check individually)
        if (!check.empty && !isEmployee) {
          console.log(`  ✓ ${colName} already has data. Skipping.`);
          return true;
        }
        
        // For employees: check if this specific doc exists
        if (isEmployee) {
          const empDoc = await S.clientDb.collection(colName).doc(docId).get();
          if (empDoc.exists) {
            console.log(`  ✓ Employee ${docId} exists. Skipping.`);
            return true;
          }
        }
        
        // Create template document
        const payload = { 
          ...docData, 
          companyId, 
          _template: true, 
          createdAt: now,
          updatedAt: now
        };
        
        await S.clientDb.collection(colName).doc(docId).set(payload);
        console.log(`  ✓ Created ${colName}/${docId}`);
        return true;
      } catch (e) {
        console.error(`  ✗ Failed ${colName}:`, e.message);
        return false;
      }
    };

    let created = false;

    // 1. Employees (initial admin)
    const empCreated = await ensureCollection('employees', empId, {
      EMPID: empId, 
      EmpName: 'Admin User', 
      Email: adminEmail, 
      Phone: '',
      Designation: 'Administrator', 
      PasswordHash: defaultPasswordHash, 
      Role: 'ADMIN',
      Site: 'SITE001', 
      Status: 'ACTIVE', 
      JoinDate: dateTimestamp,
      EffectiveDate: dateTimestamp,
      Photo: null,
      photoUrl: null
    }, true);
    if (empCreated) created = true;

    // 2. Leave Balances (for initial admin)
    await ensureCollection('leave_balances', `${companyId}_${empId}_${now.getFullYear()}`, {
      EMPID: empId,
      empName: 'Admin User',
      leaveYear: now.getFullYear(),
      privilege_leave: { total: 20, utilized: 0, balance: 20, carried_fwd: 0 },
      casual_leave: { total: 12, utilized: 0, balance: 12 },
      sick_leave: { total: 12, utilized: 0, balance: 12 },
      comp_off: { total: 0, utilized: 0, balance: 0 },
      loss_of_pay: 0,
      lastUpdated: now
    }, true);

    // 3. Sites (default site)
    const sitesCreated = await ensureCollection('sites', 'SITE001', {
      SiteID: 'SITE001', SiteName: 'Head Office', Address: 'Update Address',
      Latitude: 12.9716, Longitude: 77.5946, Radius: 100,
      ShiftStart: '09:00', ShiftEnd: '18:00', LunchTime: '13:00', Status: 'ACTIVE'
    });
    if (sitesCreated) created = true;

    // 4. Holidays (sample holiday)
    await ensureCollection('holidays', 'HOL001', {
      HolidayID: 'HOL001', HolidayName: 'Republic Day',
      Date: new Date(now.getFullYear(), 0, 26), Type: 'National Holiday',
      Day: 'Monday', ApplicableSites: 'ALL', State: 'ALL', Description: 'Gazetted Holiday'
    });

    // 5. Weekly Offs (default config)
    await ensureCollection('weekly_offs', 'SITE001', {
      SiteID: 'SITE001', WeeklyOff1: 'Sunday', WeeklyOff2: 'None',
      EffectiveFrom: dateTimestamp, Remarks: 'Standard single off'
    });

    // 6. Attendance (template marker)
    await ensureCollection('attendance', '_template', {
      Note: 'Template doc - safe to delete when real records exist', Status: 'TEMPLATE'
    });

    if (created) {
      console.log('[INIT] 🏁 Template data created for', companyId);
      toast('✅ Setup complete! Default admin created.', 'success');
    } else {
      console.log('[INIT] ✅ All collections already exist.');
    }

  } catch (globalErr) {
    console.error('[INIT] 💥 Error:', globalErr);
    // Don't throw - let app continue even if init fails
  }
}
// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// MULTI-TENANT INITIALIZATION
// ══════════════════════════════════════════════════════
(function init() {
  console.log('🔍 Initializing AttendEase (Multi-Tenant Mode)...');
  
  // 1. Get company ID from login/session
  const companyId = getCompanyId();
  if (!companyId) {
    toast('❌ Company ID not found. Please login again.', 'error');
    window.location.href = 'index.html';
    return;
  }
  
  console.log('🏢 Target Company:', companyId);
  S.prefs.companyId = companyId;
  
  // 2. Master Firebase config (hardcoded)
  const MASTER_CONFIG = {
    apiKey: "AIzaSyCvAyr-4CUAYPXLMBwZ-L9hBlmDcrOjWpA",
    authDomain: "attendease-963df.firebaseapp.com",
    projectId: "attendease-963df",
    storageBucket: "attendease-963df.firebasestorage.app",
    messagingSenderId: "107756709284",
    appId: "1:107756709284:web:fd8765b97a73f2ce7d8d31",
  };
  
  // 3. Initialize Master Firebase (if not already)
  if (!firebase.apps.length) {
    firebase.initializeApp(MASTER_CONFIG);
  }
  const masterDb = firebase.firestore();
  
  // 4. Fetch company config and initialize client Firebase
  console.log('🔐 Fetching config for:', companyId);
  
  masterDb.collection('companies').doc(companyId).get()
    .then(snap => {
      if (!snap.exists) {
        throw new Error(`Company "${companyId}" not found in Master Firestore. Please create it in Super Admin first.`);
      }
      
      const companyData = snap.data();
      const clientCfg = companyData.firebaseConfig;
      
      if (!clientCfg || !clientCfg.apiKey) {
        throw new Error('Client Firebase config missing. Update in Super Admin.');
      }
      
      console.log('✅ Config fetched:', { 
        projectId: clientCfg.projectId, 
        name: companyData.companyName,
        adminEmail: companyData.adminEmail 
      });
      
      // Update global state
      S.prefs.companyName = companyData.companyName || companyId;
      S.prefs.adminEmail = companyData.adminEmail || '';
      
      // Delete old client app if exists (prevent cross-company data leak)
      try {
        const oldApp = firebase.app('client');
        if (oldApp) oldApp.delete();
      } catch (e) {}
      
      // Initialize Client Firebase with company-specific config
      S.clientApp = firebase.initializeApp(clientCfg, 'client');
      S.clientDb = S.clientApp.firestore();
      
      console.log('✅ Client Firebase ready for', companyId);
      
      // Update UI
      document.getElementById('loginFallback')?.classList.remove('active');
      document.getElementById('appScreen')?.classList.add('active');
      
      const sb = document.getElementById('sbCompanyName');
      const av = document.getElementById('topbarAvatar');
      if (sb) sb.textContent = S.prefs.companyName;
      if (av) av.textContent = S.prefs.companyName.slice(0,2).toUpperCase();
      
      const ddName = document.getElementById('ddName');
      const ddEmail = document.getElementById('ddEmail');
      if (ddName) ddName.textContent = 'Admin User';
      if (ddEmail) ddEmail.textContent = S.prefs.adminEmail;
      
      // Set date pickers to today
      ['attDate', 'mDate', 'rptFrom', 'rptTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = today();
      });
      
      // Initialize company data if needed (creates template docs)
      return initializeCompanyData(companyId, S.prefs.adminEmail, S.prefs.companyName);
    })
    .then(() => {
      console.log('🚀 Loading dashboard...');
      return loadDashboard();
    })
    .catch(err => {
      console.error('❌ Init error:', err);
      toast('Error: ' + err.message, 'error');
      
      // Fallback: show login
      document.getElementById('appScreen')?.classList.remove('active');
      document.getElementById('loginFallback')?.classList.add('active');
    });
})();