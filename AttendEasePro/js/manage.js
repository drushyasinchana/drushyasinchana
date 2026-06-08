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

/* ══════════════════════════════════════════════════════
   Get Company ID - sessionStorage ONLY (no URL exposure)
══════════════════════════════════════════════════════ */
function getCompanyId() {
  // ✅ ONLY check sessionStorage (set during login in index.js)
  const companyId = sessionStorage.getItem('currentCompanyId');
  
  if (!companyId) {
    // No company in session - redirect to login with clear message
    console.warn('⚠️ No company session found - redirecting to login');
    toast('Session expired. Please login again.', 'error');
    
    // Clear any leftover session data and redirect
    setTimeout(() => {
      sessionStorage.clear();
      window.location.href = 'index.html';
    }, 1500);
    
    return null;
  }
  
  // Return uppercase company ID
  return companyId.toUpperCase();
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
  // Hide ALL pages first (force via inline style to override any CSS conflicts)
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none'; // ✅ Force hide
  });
  
  // Show ONLY the selected page
  const pageId = 'pg' + page.charAt(0).toUpperCase() + page.slice(1);
  const target = document.getElementById(pageId);
  
  if (target) {
    target.classList.add('active');
    // Use flex for pages that need flex layout (dashboard, payroll)
    target.style.display = (page === 'dashboard' || page === 'payroll') ? 'flex' : 'block';
  }
  
  // Update active menu styling
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  // Update topbar title
  const tl = document.getElementById('topbarTitle');
  if (tl) tl.textContent = page.charAt(0).toUpperCase() + page.slice(1);
  
  // Load page-specific data
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
  if (page === 'payroll') {
    // Initialize payroll tab to Edit by default
    switchPayrollTab('edit');
  }
  if (page === 'postlunch') initLunchTracking(); 
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


/* ══════════════════════════════════════════════════════
   CHECK PLAN & ENABLE PREMIUM MENUS (FIXED)
   - Queries MASTER DB (db), not client DB
══════════════════════════════════════════════════════ */
async function checkPlanAndEnableMenus() {
  const companyId = S.prefs?.companyId;
  console.log('🔍 Checking plan for company:', companyId);
  
  if (!companyId) {
    console.log('⚠️ No companyId in session');
    return;
  }

  try {
    // ✅ USE MASTER DB (db), NOT S.clientDb
    // 'db' is the global Firestore instance from firebase-config.js
    const doc = await db.collection('companies').doc(companyId).get();
    
    console.log('📦 Company doc exists:', doc.exists);
    
    if (doc.exists) {
      const plan = doc.data().plan;
      console.log('✅ Company plan:', plan);
      
      const isPremium = (plan === 'premium');
      
      // 1. Enable/Disable Payroll Menu
      const payrollEl = document.getElementById('navPayroll');
      const payrollBadge = document.getElementById('payrollBadge');
      
      if (payrollEl) {
        payrollEl.style.opacity = isPremium ? '1' : '0.5';
        payrollEl.style.pointerEvents = isPremium ? 'auto' : 'none';
        console.log(`🎯 Payroll menu: ${isPremium ? 'ENABLED' : 'DISABLED'}`);
      }
      if (payrollBadge) {
        payrollBadge.style.display = isPremium ? 'inline' : 'none';
      }

      // 2. Enable/Disable Leave Balances Menu
      const leaveEl = document.getElementById('navLeaveBalances');
      if (leaveEl) {
        leaveEl.style.opacity = isPremium ? '1' : '0.5';
        leaveEl.style.pointerEvents = isPremium ? 'auto' : 'none';
        console.log(`🎯 Leave Balances menu: ${isPremium ? 'ENABLED' : 'DISABLED'}`);
      }
    } else {
      console.error('❌ Company document not found in Master DB');
    }
  } catch (err) {
    console.error('❌ Plan check error:', err.code, err.message);
  }
}

// ✅ AUTO-ENABLE PREMIUM MENUS
setTimeout(() => {
  if (typeof checkPlanAndEnableMenus === 'function') {
    checkPlanAndEnableMenus();
  }
}, 1000); 



// Auto-enable on page load if session exists
document.addEventListener('DOMContentLoaded', () => {
  if (S?.prefs?.companyId && typeof checkPlanAndEnableMenus === 'function') {
    setTimeout(checkPlanAndEnableMenus, 1500);
  }
});


/* ══════════════════════════════════════════════════════
   DEFAULT PAY COMPONENTS TEMPLATE
══════════════════════════════════════════════════════ */
function getDefaultPayComponents() {
  return {
    allowances: [
      { id: 'basic', name: 'Basic Salary', type: 'earning', fixed: true, editable: false },
      { id: 'hra', name: 'House Rent Allowance', type: 'earning', fixed: false, editable: true },
      { id: 'conveyance', name: 'Conveyance Allowance', type: 'earning', fixed: false, editable: true },
      { id: 'medical', name: 'Medical Allowance', type: 'earning', fixed: false, editable: true },
      { id: 'special', name: 'Special Allowance', type: 'earning', fixed: false, editable: true },
      { id: 'other', name: 'Other Allowances', type: 'earning', fixed: false, editable: true }
    ],
    deductions: [
      { id: 'pf', name: 'Provident Fund', type: 'deduction', fixed: false, editable: true },
      { id: 'tds', name: 'Tax Deducted at Source', type: 'deduction', fixed: false, editable: true },
      { id: 'esi', name: 'Employee State Insurance', type: 'deduction', fixed: false, editable: true },
      { id: 'lop', name: 'Loss of Pay', type: 'deduction', fixed: false, editable: true }
    ],
    settings: {
      currency: 'INR',
      currencySymbol: '₹',
      decimalPlaces: 2,
      calculateLOP: true,
      proRateSalary: true
    }
  };
}


function navigateTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
  });
  
  // Show selected page
  const target = document.getElementById(pageId);
  if (target) {
    target.style.display = 'flex';
  }
  
  // Update active menu
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const activeMenu = document.querySelector(`[onclick="navigateTo('${pageId}')"]`);
  if (activeMenu) activeMenu.classList.add('active');
}


async function doLogout() {
  console.log('🔄 Starting logout...');
  
  try {
    console.log('🔐 Attempting Firebase signOut...');
    await firebase.auth().signOut();
    console.log('✅ Firebase signOut completed');
  } catch (error) {
    console.error('❌ Firebase signOut failed:', error.code, error.message);
    alert('Sign out error: ' + error.message);
  }
  
  // ... rest of cleanup code ...
  
  console.log('🔀 Redirecting to index.html');
  window.location.replace('index.html');
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



