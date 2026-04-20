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
  
  // ✅ THIS LINE WAS MISSING:
  if (page === 'postlunch') initLunchTracking(); 
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
// ATTENDANCE
// ══════════════════════════════════════════════════════
async function loadAttendance() {
  console.log('🔍 loadAttendance() triggered');
  
  // 1. Safety Checks
  if (!S.clientDb) { console.error('❌ S.clientDb not ready'); toast('DB not connected', 'error'); return; }
  const companyId = S.prefs?.companyId || S.prefs?.companyID;
  if (!companyId) { console.error('❌ Company ID missing in S.prefs'); toast('Company context not loaded', 'error'); return; }
  
  const tb = document.getElementById('attTableBody');
  if (!tb) { console.error('❌ HTML element #attTableBody not found'); return; }

  // 2. Get Filter Values (default to today)
  const dateEl = document.getElementById('attDate');
  const siteEl = document.getElementById('attSite');
  const filterDateStr = dateEl?.value || today();
  const filterSiteId = siteEl?.value || '';

  console.log(`📅 Filtering → Date: ${filterDateStr} | Site: ${filterSiteId || 'ALL'} | Company: ${companyId}`);

  try {
    // 3. Fetch ALL records for this company (avoids Firestore index errors)
    console.log('📥 Fetching from Firestore...');
    const snap = await S.clientDb.collection('attendance')
      .where('companyId', '==', companyId)
      .get();

    console.log(`✅ Fetched ${snap.size} total records`);

    if (snap.empty) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      return;
    }

    // 4. Parse Filter Date for Comparison
    const fParts = filterDateStr.split('-');
    const fDate = new Date(fParts[0], fParts[1] - 1, fParts[2]); // YYYY-MM-DD → JS Date

    // 5. Client-Side Filtering (Robust & Index-Free)
    const filtered = [];
    for (const doc of snap.docs) {
      const r = doc.data();

      // Handle Date: Timestamp, String, or JS Date
      let recDate = null;
      if (r.Date?.toDate) recDate = r.Date.toDate();
      else if (typeof r.Date === 'string') {
        const dParts = r.Date.split(/[-/]/);
        if (dParts[0].length === 4) recDate = new Date(r.Date); // YYYY-MM-DD
        else recDate = new Date(dParts[2], dParts[1] - 1, dParts[0]); // DD-MM-YYYY
      } else if (r.Date) recDate = new Date(r.Date);

      if (!recDate || isNaN(recDate)) continue;

      // Match ONLY Year, Month, Day (ignore time/timezone)
      const sameDay = recDate.getFullYear() === fDate.getFullYear() &&
                      recDate.getMonth() === fDate.getMonth() &&
                      recDate.getDate() === fDate.getDate();
      if (!sameDay) continue;

      // Site Filter
      if (filterSiteId && r.SiteID !== filterSiteId && r.Site !== filterSiteId) continue;

      // Auto-fill Name if missing
      if (!r.Name && r.EMPID) {
        const emp = S.employees?.find(e => e.EMPID === r.EMPID);
        if (emp) r.Name = emp.EmpName || emp.Name || r.EMPID;
      }

      filtered.push({ id: doc.id, ...r });
    }

    console.log(`✅ Filtered to ${filtered.length} records for display`);

    // 6. Sort by InTime (Newest First)
    filtered.sort((a, b) => (b.InTime || '00:00:00').localeCompare(a.InTime || '00:00:00'));

    // 7. Render
    renderAttTable(filtered);
    updateAttSummary(filtered);

  } catch (e) {
    console.error('❌ Attendance Load Error:', e);
    tb.innerHTML = `<tr><td colspan="10" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
    toast('Failed to load attendance', 'error');
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
  tb.innerHTML = list.map(r => {
    // ✅ Handle "Marked By" with multiple possible field names
    const markedBy = r.MarkedBy || r.markedBy || r.Marked_by || r.marked_by || r.markedby || 'SELF';
    
    // ✅ Handle Location Status variations
    const locationStatus = r.LocationStatus || r.locationStatus || r.Location || r.location || 'UNKNOWN';
    const locationClass = locationStatus === 'INSIDE' ? 'badge-blue' : 'badge-amber';
    
    // ✅ Handle Status badge color
    const status = r.Status || 'UNKNOWN';
    const statusClass = status === 'PRESENT' ? 'badge-green' : 'badge-red';
    
    // ✅ Handle Name variations
    const empName = r.Name || r.empName || r.EmpName || r.name || '—';
    const empId = r.EMPID || r.empId || r.Empid || '—';
    const siteId = r.SiteID || r.Site || r.siteId || '—';
    
    return `
    <tr>
      <td><strong>${empName}</strong></td>                              <!-- 1. Employee -->
      <td class="mono">${empId}</td>                                    <!-- 2. EMPID -->
      <td>${siteId}</td>                                                <!-- 3. Site -->
      <td class="mono" style="color:var(--green);">${r.InTime || '—'}</td>  <!-- 4. IN -->
      <td class="mono" style="color:var(--red);">${r.OutTime || '—'}</td>   <!-- 5. OUT -->
      <td class="mono">${calcHours(r.InTime, r.OutTime)}</td>           <!-- 6. HOURS -->
      <td><span class="badge ${statusClass}">${status}</span></td>      <!-- 7. STATUS -->
      <td><span class="badge ${locationClass}">${locationStatus}</span></td> <!-- 8. LOCATION -->
      <td>${r.HalfDay || r.halfDay || 'NO'}</td>                        <!-- 9. HALF DAY -->
      <td style="font-size:.75rem;color:var(--muted);">${markedBy}</td> <!-- 10. MARKED BY -->
    </tr>
  `}).join('');
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

//════════════════════════════════════════════════════
// MANUAL ENTRY - With postLunch Field Support
//════════════════════════════════════════════════════
async function submitManual() {
  const empId   = document.getElementById('mEmpId')?.value;
  const dateStr = document.getElementById('mDate')?.value; // "YYYY-MM-DD"
  let checkIn   = document.getElementById('mCheckIn')?.value || null;
  let checkOut  = document.getElementById('mCheckOut')?.value || null;
  const halfDay = (document.getElementById('mHalfDay')?.value || 'NO').toUpperCase();
  const status  = document.getElementById('mStatus')?.value || 'PRESENT';
  
  if (!empId || !dateStr) {
    toast('Employee and Date are required', 'error');
    return;
  }
  
  const emp = S.employees.find(e => e.EMPID === empId);
  if (!emp) { toast('Employee not found', 'error'); return; }
  
  const empName = emp.EmpName || emp.Name || empId;
  const siteId  = emp.Site || emp.SiteID || 'SITE001';
  
  try {
    // 1. Format date parts for Doc ID: EMPID_DD-MM-YYYY (matches Android)
    const [y, m, d] = dateStr.split('-');
    const formattedDate = `${d}-${m}-${y}`; // "15-04-2026"
    const docId = `${empId}_${formattedDate}`;
    
    // 2. Date Timestamp: Midnight 00:00:00 local time
    const dateTimestamp = new Date(y, m - 1, d);
    
    // 3. Normalize Times to HH:MM:SS (App format)
    if (checkIn && checkIn.length === 5) checkIn += ':00';
    if (checkOut && checkOut.length === 5) checkOut += ':00';
    
    // 4. STRICT PAYLOAD with postLunch nested map (all nulls for manual entry)
    const payload = {
      companyId:      S.prefs.companyId,
      Date:           dateTimestamp,
      EMPID:          empId,
      HalfDay:        halfDay,
      InTime:         checkIn,
      LocationStatus: 'MANUAL',
      MarkedBy:       'ADMIN',
      Name:           empName,
      OutTime:        checkOut,
      SiteID:         siteId,
      Status:         status,
      
      // ✅ NEW: postLunch nested map with typed nulls
      postLunch: {
        time: null,           // String or null
        latitude: null,       // Number or null
        longitude: null,      // Number or null
        inside: null,         // Boolean or null
        accuracy: null        // Number or null
      }
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    
    // Save with merge:true to allow app to add postLunch later
    await S.clientDb.collection('attendance').doc(docId).set(payload, { merge: true });
    
    toast('✅ Manual attendance saved successfully!');
    clearManual();
    loadRectifications();
    loadAttendance();
    
  } catch (e) {
    console.error('Manual entry error:', e);
    toast('Failed to save: ' + e.message, 'error');
  }
}

function clearManual() {
  ['mCheckIn','mCheckOut'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  const mHalfDay = document.getElementById('mHalfDay');
  if (mHalfDay) mHalfDay.value = 'NO';
  
  const mStatus = document.getElementById('mStatus');
  if (mStatus) mStatus.value = 'PRESENT';
  
  const mDate = document.getElementById('mDate');
  if (mDate) mDate.value = today();
  
  const mUseDefaults = document.getElementById('mUseDefaults');
  if (mUseDefaults) mUseDefaults.checked = false;
  
  // Clear result message if exists
  const resEl = document.getElementById('manualResult');
  if (resEl) resEl.innerHTML = '';
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
  console.log('🔍 loadRectifications() called');
  
  // 1. Safety checks
  if (!S.clientDb) { 
    console.error('❌ S.clientDb not ready');
    toast('Database not connected', 'error'); 
    return; 
  }
  
  const dateEl = document.getElementById('rectDate');
  const siteEl = document.getElementById('rectSite');
  const tb = document.getElementById('rectTableBody');
  
  if (!dateEl || !siteEl || !tb) {
    console.error('❌ Missing HTML elements');
    return;
  }
  
  // 2. Get filter values
  if (!dateEl.value) dateEl.value = today();
  const filterDateStr = dateEl.value; // "YYYY-MM-DD"
  const filterSiteId = siteEl.value || '';
  
  console.log(`📅 Filtering → Date: ${filterDateStr} | Site: ${filterSiteId || 'ALL'}`);
  
  try {
    // 3. Fetch ALL attendance for company (no query filters to avoid index errors)
    console.log('📥 Fetching attendance from Firestore...');
    const snap = await S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    console.log(`✅ Fetched ${snap.size} total records`);
    
    if (snap.empty) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      return;
    }
    
    // 4. Parse filter date for comparison (midnight local time)
    const [fy, fm, fd] = filterDateStr.split('-').map(Number);
    const filterDate = new Date(fy, fm - 1, fd); // Month is 0-indexed
    
    // 5. Filter in JavaScript (handles Timestamp, string, or Date object)
    const filtered = [];
    
    for (const doc of snap.docs) {
      const r = doc.data();
      
      // Parse record date robustly
      let recDate = null;
      
      if (r.Date?.toDate) {
        // Firestore Timestamp
        recDate = r.Date.toDate();
      } else if (typeof r.Date === 'string') {
        // String: "YYYY-MM-DD" or "DD-MM-YYYY"
        const parts = r.Date.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            recDate = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            // DD-MM-YYYY or MM-DD-YYYY
            const [p1, p2, p3] = parts;
            if (parseInt(p1) > 12) {
              recDate = new Date(p3, p2 - 1, p1); // DD-MM-YYYY
            } else {
              recDate = new Date(p1, p2 - 1, p3); // MM-DD-YYYY fallback
            }
          }
        }
      } else if (r.Date instanceof Date) {
        recDate = r.Date;
      }
      
      // Skip if date couldn't be parsed
      if (!recDate || isNaN(recDate)) {
        console.warn('⚠️ Skipping record with invalid date:', r.EMPID, r.Date);
        continue;
      }
      
      // Compare ONLY Year, Month, Day (ignore time/timezone)
      const sameDay = 
        recDate.getFullYear() === filterDate.getFullYear() &&
        recDate.getMonth() === filterDate.getMonth() &&
        recDate.getDate() === filterDate.getDate();
      
      if (!sameDay) continue;
      
      // Site filter
      if (filterSiteId && r.SiteID !== filterSiteId && r.Site !== filterSiteId) continue;
      
      // Add to results
      filtered.push({ id: doc.id, ...r });
    }
    
    console.log(`✅ Filtered to ${filtered.length} records for display`);
    
    // 6. Sort by InTime (newest first)
    filtered.sort((a, b) => {
      const timeA = a.InTime || '00:00:00';
      const timeB = b.InTime || '00:00:00';
      return timeB.localeCompare(timeA);
    });
    
    // 7. Render
    renderRectTable(filtered);
    updateRectSummary(filtered);
    
    if (filtered.length === 0) {
      toast('No records found for selected date', 'warn');
    }
    
  } catch (e) {
    console.error('❌ Rect load error:', e);
    toast('Failed to load: ' + e.message, 'error');
    
    // Show error in table
    if (tb) {
      tb.innerHTML = `<tr><td colspan="10" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
    }
  }
}


//════════════════════════════════════════════════════
// RECTIFICATIONS - Render Table with postLunch Column
//════════════════════════════════════════════════════
function renderRectTable(list) {
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;
  
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    // Status badge
    const status = r.Status || 'UNKNOWN';
    let statusClass = 'badge-gray';
    if (status === 'PRESENT') statusClass = 'badge-green';
    else if (status === 'ABSENT') statusClass = 'badge-red';
    else if (status === 'ON_LEAVE') statusClass = 'badge-amber';
    
    // Location badge
    const location = r.LocationStatus || r.Location || 'UNKNOWN';
    let locClass = 'badge-gray';
    if (location === 'INSIDE') locClass = 'badge-green';
    else if (location === 'MANUAL' || location === 'OUTSIDE') locClass = 'badge-amber';
    
    // ✅ Post-Lunch Status Badge
    const pl = r.postLunch || {};
    let plStatus = '—';
    let plClass = 'badge-gray';
    if (pl.time) {
      plStatus = pl.inside === true ? '✅ INSIDE' : '❌ OUTSIDE';
      plClass = pl.inside ? 'badge-green' : 'badge-red';
    } else {
      plStatus = '⏳ PENDING';
      plClass = 'badge-amber';
    }
    
    // ✅ Safe modal data with postLunch
    const modalData = encodeURIComponent(JSON.stringify({
      id: r.id,
      EMPID: r.EMPID,
      Name: r.Name,
      SiteID: r.SiteID || r.Site,
      InTime: r.InTime,
      OutTime: r.OutTime,
      Status: r.Status,
      LocationStatus: location,
      HalfDay: r.HalfDay || 'NO',
      Remarks: r.Remarks || '',
      Date: r.Date,
      postLunch: pl // Pass nested map
    }));
    
    return `
      <tr>
        <td><strong>${r.Name || '—'}</strong></td>                    <!-- Employee -->
        <td class="mono">${r.EMPID || '—'}</td>                       <!-- EMPID -->
        <td>${r.SiteID || r.Site || '—'}</td>                         <!-- Site -->
        <td class="mono" style="color:var(--green);">${r.InTime || '—'}</td>  <!-- In -->
        <td class="mono" style="color:var(--red);">${r.OutTime || '—'}</td>   <!-- Out -->
        <td class="mono">${calcHours(r.InTime, r.OutTime)}</td>       <!-- Hours -->
        <td><span class="badge ${statusClass}">${status}</span></td>  <!-- Status -->
        <td><span class="badge ${locClass}">${location}</span></td>   <!-- Location -->
        <td>${r.HalfDay || 'NO'}</td>                                 <!-- Half Day -->
        <td><span class="badge ${plClass}">${plStatus}</span></td>    <!-- Post-Lunch -->
        <td>
          <button class="btn btn-outline btn-sm" 
                  onclick="openRectifyModal('${modalData}')">✏️ Edit</button>
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

//════════════════════════════════════════════════════
// RECTIFICATIONS - Modal with postLunch Display
//════════════════════════════════════════════════════
function openRectifyModal(encodedData) {
  console.log('🔓 Opening modal with data');
  
  let r;
  try {
    r = JSON.parse(decodeURIComponent(encodedData));
    console.log('✅ Parsed modal data:', r);
  } catch (e) {
    console.error('❌ Modal parse error:', e);
    toast('Error loading record', 'error');
    return;
  }
  
  // Populate standard fields
  document.getElementById('rectDocId').value = r.id || '';
  document.getElementById('rectEmpName').value = r.Name || r.EMPID || '—';
  
  // Date display
  let displayDate = '—';
  if (r.Date) {
    try {
      const dt = r.Date.toDate ? r.Date.toDate() : new Date(r.Date);
      if (!isNaN(dt)) {
        displayDate = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
      }
    } catch(e) {}
  }
  document.getElementById('rectDateDisp').value = displayDate;
  
  // Other fields
  document.getElementById('rectStatus').value = r.Status || 'PRESENT';
  document.getElementById('rectLocation').value = r.LocationStatus || r.Location || 'MANUAL';
  document.getElementById('rectIn').value = r.InTime || '';
  document.getElementById('rectOut').value = r.OutTime || '';
  document.getElementById('rectHalfDay').value = r.HalfDay || 'NO';
  document.getElementById('rectRemarks').value = r.Remarks || '';
  
  // ✅ Display postLunch status (read-only in modal)
  const pl = r.postLunch || {};
  const plStatusEl = document.getElementById('rectPostLunchStatus');
  if (plStatusEl) {
    if (pl.time) {
      plStatusEl.textContent = `${pl.inside ? '✅ Inside' : '❌ Outside'} at ${pl.time}`;
      plStatusEl.style.color = pl.inside ? 'var(--green)' : 'var(--red)';
    } else {
      plStatusEl.textContent = '⏳ Not marked';
      plStatusEl.style.color = 'var(--muted)';
    }
  }
  
  showFieldErr('rectErr', '');
  openModal('attRectModal');
}

//════════════════════════════════════════════════════
// RECTIFICATIONS - Save with postLunch Support
//════════════════════════════════════════════════════
async function saveRectification() {
  const docId = document.getElementById('rectDocId').value;
  if (!docId) { toast('Error: No record ID', 'error'); return; }

  try {
    // Normalize times
    let inTime  = document.getElementById('rectIn').value;
    let outTime = document.getElementById('rectOut').value;
    if (inTime && inTime.length === 5) inTime += ':00';
    if (outTime && outTime.length === 5) outTime += ':00';

    // ✅ PAYLOAD: Core fields + preserve existing postLunch
    const payload = {
      Status:         document.getElementById('rectStatus').value,
      LocationStatus: document.getElementById('rectLocation').value,
      InTime:         inTime || null,
      OutTime:        outTime || null,
      HalfDay:        document.getElementById('rectHalfDay').value,
      // ✅ Do NOT overwrite postLunch - let Android app manage it
      // If admin needs to clear postLunch, add: 'postLunch': null
    };

    // Use .update() to touch only specified fields
    await S.clientDb.collection('attendance').doc(docId).update(payload);

    toast('✅ Record updated successfully!');
    closeModal('attRectModal');
    loadRectifications();
    
  } catch (e) {
    console.error('Rectification error:', e);
    showFieldErr('rectErr', 'Failed: ' + e.message);
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