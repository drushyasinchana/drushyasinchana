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
  prefs: { companyId: null, companyName: '', adminEmail: '', sectorCode: '' },
  clientApp: null,
  clientDb: null
};

// ✅ Make S accessible globally for sectors.js
window.S = S;

/* ═════════════════════════════════════════════════════
   Get Company ID - sessionStorage ONLY (no URL exposure)
══════════════════════════════════════════════════════ */
function getCompanyId() {
  // ✅ ONLY check sessionStorage (set during login in index.js)
  const companyId = sessionStorage.getItem('currentCompanyId');
  
  if (!companyId) {
    // No company in session - redirect to login with clear message
    console.warn('️ No company session found - redirecting to login');
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
/* ══════════════════════════════════════════════════════
NAVIGATION - UPDATED to load sites before dropdowns
══════════════════════════════════════════════════════ */
async function nav(page, btn) {
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
  
  // ✅ Helper: Ensure sites are loaded before page load
  const ensureSitesLoaded = async () => {
    if (!S.sites || S.sites.length === 0) {
      try {
        S.sites = await fetchSites();
        console.log(`✅ Sites loaded: ${S.sites.length}`);
      } catch (e) {
        console.error('❌ Failed to load sites:', e);
      }
    }
  };
  
  // Load page-specific data
  if (page === 'dashboard') {
    await ensureSitesLoaded();
    loadDashboard();
  }
  if (page === 'employees') {
    await ensureSitesLoaded();
    loadEmployees();
  }
  if (page === 'sites') {
    loadSites();
  }
  if (page === 'attendance') {
    // ✅ Load sites first, then populate dropdowns, then load attendance
    await ensureSitesLoaded();
    populateSiteSelects();
    loadAttendance();
  }
  if (page === 'reports') {
    // ✅ Load sites first, then populate dropdowns, then load reports
    await ensureSitesLoaded();
    populateSiteSelects();
    loadReports();
  }
  if (page === 'manual') {
    await ensureSitesLoaded();
    populateSiteSelects();
    loadManual();
  }
  if (page === 'leave') {
    await ensureSitesLoaded();
    populateSiteSelects();
    loadLeave();
  }
  if (page === 'holidays') loadHolidays();
  if (page === 'weeklyoff') loadWeeklyOff();
  if (page === 'support') loadSupport();
  if (page === 'rectifications') {
    // ✅ Load sites first, then populate dropdowns, then load rectifications
    await ensureSitesLoaded();
    populateSiteSelects();
    loadRectifications();
  }
  if (page === 'payroll') {
    // Initialize payroll tab to Edit by default
    switchPayrollTab('edit');
  }
  if (page === 'postlunch') {
    // ✅ Load sites first, then populate dropdowns, then init lunch tracking
    await ensureSitesLoaded();
    populateSiteSelects();
    initLunchTracking();
  }
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
// ═════════════════════════════════════════════════════
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

/* ══════════════════════════════════════════════════════
FETCH ATTENDANCE - FIXED: Preserves Document ID
══════════════════════════════════════════════════════ */
async function fetchAttendance(filterDateStr, filterSiteId = null) {
  if (!S.clientDb) return [];
  try {
    const snap = await S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    const fParts = filterDateStr.split('-');
    const targetDate = new Date(
      parseInt(fParts[0], 10),
      parseInt(fParts[1], 10) - 1,
      parseInt(fParts[2], 10)
    );
    
    const filtered = [];
    for (const doc of snap.docs) {
      const r = doc.data();
      
      // ✅ CRITICAL: Preserve the Firestore document ID
      r.id = doc.id;
      
      let recDate = null;
      if (r.Date && typeof r.Date === 'string' && r.Date.includes('-')) {
        const normalized = r.Date.replace(/[–—]/g, '-');
        const parts = normalized.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
            recDate = new Date(parts[2], parts[1] - 1, parts[0]);
          } else if (parts[0].length === 4) {
            recDate = new Date(r.Date);
          }
        }
      } else if (r.Date?.toDate) {
        recDate = r.Date.toDate();
      }
      
      if (recDate && 
          recDate.getFullYear() === targetDate.getFullYear() &&
          recDate.getMonth() === targetDate.getMonth() &&
          recDate.getDate() === targetDate.getDate()) {
        
        if (filterSiteId && r.SiteID !== filterSiteId) continue;
        
        filtered.push(r);
      }
    }
    
    return filtered;
  } catch (e) {
    console.error('Fetch attendance error:', e);
    return [];
  }
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
    el('stPresent', att.filter(r => r.Status==='PRESENT').length);
    el('stAbsent', Math.max(0, emp.length - att.filter(r => r.Status==='PRESENT').length));
    el('stSites', sites.filter(s => !s.Status || s.Status==='ACTIVE').length);
    el('stDate', fmtDate(today()));
    el('dashSiteDate', fmtDate(today()));
    
    const grid = document.getElementById('dashSiteCards');
    if (grid) {
      const active = sites.filter(s => !s.Status || s.Status==='ACTIVE');
      if (!active.length) {
        grid.innerHTML = '<div class="empty"><p>No active sites</p></div>';
      } else {
        grid.innerHTML = active.map(s => {
          const a = att.filter(r => r.SiteID===s.SiteID);
          const p = a.filter(r => r.Status==='PRESENT').length;
          const t = emp.filter(e => e.Site===s.SiteID).length || a.length;
          const ab = Math.max(0,t-p);
          const pct = t > 0 ? Math.round(p/t*100) : 0;
          const bar = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
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
        ? att.slice(0,5).map(r => `
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

// ═════════════════════════════════════════════════════
// POPULATE SELECTS (Sites & Employees)
// ══════════════════════════════════════════════════════
/* ══════════════════════════════════════════════════════
POPULATE SELECTS (Sites & Employees) - UPDATED
══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
POPULATE SELECTS (Sites & Employees) - UPDATED
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


/* ══════════════════════════════════════════════════════
LOAD RECTIFICATIONS - Loads Sites First
══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
LOAD RECTIFICATIONS - FIXED: Loads Sites & Filters by Site
══════════════════════════════════════════════════════ */
async function loadRectifications() {
  console.log('🔍 loadRectifications() triggered');
  
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  const companyId = S.prefs?.companyId;
  if (!companyId) { toast('Company context missing', 'error'); return; }
  
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;

  // ✅ STEP 1: Load Sites if not already loaded
  if (!S.sites || S.sites.length === 0) {
    console.log('📥 Loading sites...');
    try {
      const sitesSnap = await S.clientDb.collection('sites')
        .where('companyId', '==', companyId)
        .get();
      S.sites = sitesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`✅ Sites loaded: ${S.sites.length}`);
    } catch (e) { 
      console.error('❌ Site load failed:', e); 
    }
  }

  // ✅ STEP 2: Load Employees if not already loaded
  if (!S.employees || S.employees.length === 0) {
    console.log('📥 Loading employees...');
    try {
      const empSnap = await S.clientDb.collection('employees')
        .where('companyId', '==', companyId)
        .get();
      S.employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`✅ Employees loaded: ${S.employees.length}`);
    } catch (e) { 
      console.error('❌ Employee load failed:', e); 
    }
  }

  // ✅ STEP 3: NOW populate site dropdowns
  populateSiteSelects();

  // Get filter date and site
  const dateEl = document.getElementById('rectDate');
  const siteEl = document.getElementById('rectSite');
  const filterDateStr = dateEl?.value || today();
  const filterSiteId = siteEl?.value || '';  // ✅ Get selected site
  
  // Parse filter date
  const fParts = filterDateStr.split('-');
  const currentFilterDate = new Date(
    parseInt(fParts[0], 10),
    parseInt(fParts[1], 10) - 1,
    parseInt(fParts[2], 10)
  );
  currentFilterDate.setHours(0, 0, 0, 0);
  
  console.log('📅 Filter Date:', filterDateStr, '| Site:', filterSiteId || 'ALL');

  try {
    const attSnap = await S.clientDb.collection('attendance')
      .where('companyId', '==', companyId)
      .get();
    
    console.log(`✅ Fetched ${attSnap.size} total records`);

    if (attSnap.empty) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      updateRectSummary([]);
      return;
    }
    
    const filtered = [];
    
    for (const doc of attSnap.docs) {
      const r = doc.data();
      
      // Parse record date (DD-MM-YYYY format)
      let recordDate = null;
      if (r.Date?.toDate) {
        recordDate = r.Date.toDate();
      } else if (typeof r.Date === 'string') {
        const parts = r.Date.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            recordDate = new Date(r.Date);
          } else {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            recordDate = new Date(year, month, day);
          }
        }
      }
      
      if (!recordDate || isNaN(recordDate)) continue;
      
      // Check same day
      const recDateOnly = new Date(recordDate);
      recDateOnly.setHours(0, 0, 0, 0);
      
      if (recDateOnly.getTime() !== currentFilterDate.getTime()) continue;
      
      // ✅ Filter by Site if selected
      if (filterSiteId && r.SiteID !== filterSiteId) continue;
      
      // Enrich with employee data
      const emp = S.employees?.find(e => e.EMPID === r.EMPID);
      const enriched = {
        id: doc.id,
        ...r,
        Name: (emp?.EmpName || emp?.Name || r.Name || r.EMPID || '—').trim()
      };
      
      filtered.push(enriched);
    }
    
    console.log(`✅ Filtered to ${filtered.length} records`);

    if (filtered.length === 0) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    } else {
      renderRectTable(filtered);
    }

    updateRectSummary(filtered);

  } catch (e) {
    console.error('❌ Error:', e);
    tb.innerHTML = `<tr><td colspan="10" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
  }
}



function renderRectTable(list) {
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;
  
  tb.innerHTML = list.map(r => {
    const status = r.Status || 'UNKNOWN';
    const statusClass = status === 'PRESENT' ? 'badge-green' : status === 'ABSENT' ? 'badge-red' : status === 'ON_LEAVE' ? 'badge-blue' : 'badge-gray';
    const loc = r.LocationStatus || 'UNKNOWN';
    const locClass = loc === 'INSIDE' || loc === 'VERIFIED' ? 'badge-blue' : 'badge-amber';
    
    return `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:10px;"><strong>${r.Name || '—'}</strong></td>
      <td class="mono" style="padding:10px;">${r.EMPID || '—'}</td>
      <td style="padding:10px;">${r.SiteID || '—'}</td>
      <td class="mono" style="padding:10px;color:var(--green);">${r.InTime || '—'}</td>
      <td class="mono" style="padding:10px;color:var(--red);">${r.OutTime || '—'}</td>
      <td class="mono" style="padding:10px;">${calcHours(r.InTime, r.OutTime)}</td>
      <td style="padding:10px;"><span class="badge ${statusClass}">${status}</span></td>
      <td style="padding:10px;"><span class="badge ${locClass}">${loc}</span></td>
      <td style="padding:10px;">${r.HalfDay || 'NO'}</td>
      <td style="padding:10px;">
        <button class="btn btn-outline btn-sm" onclick="openRectifyModal('${r.id}')">️ Edit</button>
      </td>
    </tr>`;
  }).join('');
}

function updateRectSummary(list) {
  const present = list?.filter(r => r.Status === 'PRESENT').length || 0;
  const absent = list?.filter(r => r.Status === 'ABSENT').length || 0;
  const leave = list?.filter(r => r.Status === 'ON_LEAVE').length || 0;
  
  document.getElementById('rectTotal').textContent = list?.length || 0;
  document.getElementById('rectPresent').textContent = present;
  document.getElementById('rectAbsent').textContent = absent;
  document.getElementById('rectLeave').textContent = leave;
}

function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  try {
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff <= 0) return '—';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  } catch(e) {
    return '—';
  }
}



/* ══════════════════════════════════════════════════════
LOAD POST-LUNCH TRACKING - FIXED: Filtering & Columns
══════════════════════════════════════════════════════ */
async function loadLunchTracking() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  
  // Ensure sites and employees are loaded
  if (!S.sites || S.sites.length === 0) {
    try { S.sites = await fetchSites(); } catch (e) { console.error(e); }
  }
  if (!S.employees || S.employees.length === 0) {
    try { S.employees = await fetchEmployees(); } catch (e) { console.error(e); }
  }
  
  // Populate site dropdowns (crucial for loading the sites into the select)
  populateSiteSelects();

  const dateStr = document.getElementById('lunchDate')?.value;
  const siteId = document.getElementById('lunchSite')?.value;
  const statusFilter = document.getElementById('lunchFilter')?.value;
  const tb = document.getElementById('lunchTableBody');

  if (!dateStr) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Select a date to load records</td></tr>';
    return;
  }

  // Parse Date
  const fParts = dateStr.split('-');
  const filterDate = new Date(fParts[0], fParts[1] - 1, fParts[2]);
  filterDate.setHours(0,0,0,0);
  const nextDate = new Date(filterDate);
  nextDate.setDate(nextDate.getDate() + 1);

  try {
    const snap = await S.clientDb.collection('post_lunch_tracking')
      .where('companyId', '==', S.prefs.companyId)
      .get();

    let records = [];
    snap.forEach(doc => {
      const data = doc.data();
      let recDate;
      // Handle date parsing similar to attendance
      if (data.Date && data.Date.toDate) recDate = data.Date.toDate();
      else if (data.Date) {
        const parts = data.Date.split(/[-/]/);
        if (parts[0].length === 4) recDate = new Date(data.Date);
        else recDate = new Date(parts[2], parts[1]-1, parts[0]);
      }

      // Date Filter
      if (recDate && recDate >= filterDate && recDate < nextDate) {
        
        // Site Filter
        if (siteId && data.SiteID !== siteId) return;
        
        // Status Filter
        const status = data.Status || data.postLunch?.status || 'UNKNOWN';
        if (statusFilter && status !== statusFilter) return;

        const emp = S.employees.find(e => e.EMPID === data.EMPID);
        data.Name = emp ? emp.EmpName : data.Name || data.EMPID;
        
        records.push(data);
      }
    });

    if (records.length === 0) {
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No records found for this date</td></tr>';
    } else {
      tb.innerHTML = records.map(r => {
        // ✅ FIXED: Display Time from nested object or flat field
        const time = r.Time || r.postLunch?.time || '—';
        const status = r.Status || r.postLunch?.status || 'UNKNOWN';
        const coords = (r.Latitude && r.Longitude) ? `${r.Latitude.toFixed(4)}, ${r.Longitude.toFixed(4)}` : '—';
        const accuracy = r.Accuracy || r.postLunch?.accuracy || '—';
        
        const statusClass = status === 'INSIDE' ? 'badge-green' : status === 'OUTSIDE' ? 'badge-red' : 'badge-amber';

        return `
          <tr>
            <td style="padding:10px;"><strong>${r.EMPID}</strong></td>
            <td style="padding:10px;">${r.Name}</td>
            <td style="padding:10px;">${r.SiteID}</td>
            <td class="mono" style="padding:10px;">${time}</td>
            <td style="padding:10px;"><span class="badge ${statusClass}">${status}</span></td>
            <td class="mono" style="padding:10px;font-size:0.8rem;">${coords}</td>
            <td style="padding:10px;">${accuracy}m</td>
          </tr>
        `;
      }).join('');
    }

    // Update Summary Chips
    const summaryEl = document.getElementById('lunchSummary');
    if (summaryEl) {
      const inside = records.filter(r => (r.Status || 'UNKNOWN') === 'INSIDE').length;
      const outside = records.filter(r => (r.Status || 'UNKNOWN') === 'OUTSIDE').length;
      summaryEl.innerHTML = `
        <div class="chip" style="color:var(--green);">Inside: ${inside}</div>
        <div class="chip" style="color:var(--red);">Outside: ${outside}</div>
        <div class="chip">Total: ${records.length}</div>
      `;
    }

  } catch (e) {
    console.error(e);
    toast('Error loading lunch tracking', 'error');
  }
}

function initLunchTracking() {
  const dateEl = document.getElementById('lunchDate');
  if (dateEl && !dateEl.value) dateEl.value = today();
  loadLunchTracking();
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
  // ✅ FIXED: Removed space in arrow function 'lb = >' -> 'lb =>'
  tb.innerHTML = list.map(lb => {
    // ✅ FIXED: Removed space in arrow function 'e = >' -> 'e =>'
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
    //  toast('✅ Setup complete! Default admin created.', 'success');
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
// ════════════════════════════════════════════════════
(function init() {
  console.log('🔍 Initializing AttendEase (Multi-Tenant Mode)...');
  
  // 1. Get company ID from login/session
  const companyId = getCompanyId();
  if (!companyId) {
    toast(' Company ID not found. Please login again.', 'error');
    window.location.href = 'index.html';
    return;
  }
  
  console.log(' Target Company:', companyId);
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
  console.log(' Fetching config for:', companyId);
  
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

      // ✅ FIX: Extract Sector Code from Master Firestore
      // The sector field is in format "CODE-Name" (e.g., "HOTEL_PG-Hotel & PG Management")
      const rawSector = companyData.sector || 'CONST';
      const sectorCode = rawSector.split('-')[0].trim();
      S.prefs.sectorCode = sectorCode;
      console.log('✅ Sector code stored:', S.prefs.sectorCode);
      
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
      
      // ✅ FIXED: Update UI elements with correct IDs
      const sb = document.getElementById('sbCompanyName');
      const userAvatar = document.getElementById('userAvatar');
      const userName = document.getElementById('userName');
      const userEmail = document.getElementById('userEmail');

      if (sb) sb.textContent = S.prefs.companyName || '—';
      if (userAvatar) userAvatar.textContent = (S.prefs.companyName || '??').slice(0,2).toUpperCase();
      if (userName) userName.textContent = 'Admin User';
      if (userEmail) userEmail.textContent = S.prefs.adminEmail || '—';
      
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
   CHECK PLAN & ENABLE PREMIUM MENUS
══════════════════════════════════════════════════════ */
async function checkPlanAndEnableMenus() {
  const companyId = S.prefs?.companyId;
  console.log(' Checking plan for company:', companyId);
  
  if (!companyId) {
    console.log('️ No companyId in session');
    return;
  }

  try {
    const doc = await db.collection('companies').doc(companyId).get();
    
    console.log(' Company doc exists:', doc.exists);
    
    if (doc.exists) {
      const plan = doc.data().plan;
      console.log('✅ Company plan:', plan);
      
      const isPremium = (plan === 'premium');
      
      const payrollEl = document.getElementById('navPayroll');
      const payrollBadge = document.getElementById('payrollBadge');
      
      if (payrollEl) {
        payrollEl.style.opacity = isPremium ? '1' : '0.5';
        payrollEl.style.pointerEvents = isPremium ? 'auto' : 'none';
        console.log(` Payroll menu: ${isPremium ? 'ENABLED' : 'DISABLED'}`);
      }
      if (payrollBadge) {
        payrollBadge.style.display = isPremium ? 'inline' : 'none';
      }

      const leaveEl = document.getElementById('navLeaveBalances');
      if (leaveEl) {
        leaveEl.style.opacity = isPremium ? '1' : '0.5';
        leaveEl.style.pointerEvents = isPremium ? 'auto' : 'none';
        console.log(` Leave Balances menu: ${isPremium ? 'ENABLED' : 'DISABLED'}`);
      }
    } else {
      console.error(' Company document not found in Master DB');
    }
  } catch (err) {
    console.error(' Plan check error:', err.code, err.message);
  }
}

setTimeout(() => {
  if (typeof checkPlanAndEnableMenus === 'function') {
    checkPlanAndEnableMenus();
  }
}, 1000); 

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
      currencySymbol: '',
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
  console.log(' Starting logout...');
  
  try {
    console.log('🔐 Attempting Firebase signOut...');
    await firebase.auth().signOut();
    console.log('✅ Firebase signOut completed');
  } catch (error) {
    console.error(' Firebase signOut failed:', error);
    alert('Sign out error: ' + error.message);
  }
  
  console.log('🔀 Redirecting to index.html');
  window.location.replace('index.html');
}

/* ══════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ══════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' || event.keyCode === 27) {
    const modals = document.querySelectorAll('.modal-backdrop.open');
    modals.forEach(m => {
      m.classList.remove('open');
      m.style.display = 'none';
    });
  }
});

/* ══════════════════════════════════════════════════════
   ATTENDANCE PAGE FUNCTIONS (MISSING IN PREVIOUS FILE)
══════════════════════════════════════════════════════ */

async function loadAttendance() {
  console.log('🔍 loadAttendance() triggered');
  
  if (!S?.clientDb) { toast('DB not connected', 'error'); return; }
  const companyId = S.prefs?.companyId;
  if (!companyId) { toast('Company context missing', 'error'); return; }
  
  const tb = document.getElementById('attTableBody');
  if (!tb) return;

  // Load employees for Photo/Name enrichment
  console.log('📥 Loading employees for Photos...');
  try {
    const empSnap = await S.clientDb.collection('employees')
      .where('companyId', '==', companyId)
      .get();
    S.employees = empSnap.docs.map(d => d.data());
  } catch (e) { console.error('❌ Employee load failed:', e); }

  // Get filter date
  const dateEl = document.getElementById('attDate');
  const filterDateStr = dateEl?.value || today();
  
  // Parse date - handle both YYYY-MM-DD and MM-DD-YYYY
  const fParts = filterDateStr.split('-');
  let year, month, day;
  
  if (fParts[0].length === 4) {
    // YYYY-MM-DD
    year = parseInt(fParts[0], 10);
    month = parseInt(fParts[1], 10) - 1;
    day = parseInt(fParts[2], 10);
  } else if (fParts[2].length === 4) {
    // MM-DD-YYYY or DD-MM-YYYY
    const first = parseInt(fParts[0], 10);
    const second = parseInt(fParts[1], 10);
    
    if (first > 12) {
      // DD-MM-YYYY
      day = first;
      month = second - 1;
      year = parseInt(fParts[2], 10);
    } else if (second > 12) {
      // MM-DD-YYYY
      month = first - 1;
      day = second;
      year = parseInt(fParts[2], 10);
    } else {
      // Assume DD-MM-YYYY (Indian format)
      day = first;
      month = second - 1;
      year = parseInt(fParts[2], 10);
    }
  } else {
    year = parseInt(fParts[0], 10);
    month = parseInt(fParts[1], 10) - 1;
    day = parseInt(fParts[2], 10);
  }
  
  currentFilterDate = new Date(year, month, day);
  console.log('📅 Parsed Filter Date:', currentFilterDate);

  try {
    const attSnap = await S.clientDb.collection('attendance')
      .where('companyId', '==', companyId)
      .get();
    
    console.log(`✅ Fetched ${attSnap.size} total records`);

    if (attSnap.empty) {
      tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      updateLiveStats([], S.employees ? S.employees.length : 0);
      return;
    }
    
    const filtered = [];
    
    for (const doc of attSnap.docs) {
      const r = doc.data();
      
      // Parse record date (handles DD-MM-YYYY from Android)
      let recordDate = null;
      if (r.Date?.toDate) {
        recordDate = r.Date.toDate();
      } else if (typeof r.Date === 'string') {
        const parts = r.Date.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            recordDate = new Date(r.Date);
          } else {
            const [p1, p2, p3] = parts;
            if (parseInt(p1, 10) > 12) {
              recordDate = new Date(p3, p2 - 1, p1); 
            } else {
              recordDate = new Date(p1, p2 - 1, p3); 
            }
          }
        }
      }
      
      if (!recordDate || isNaN(recordDate)) continue;
      
      // Check same day
      const recDateOnly = new Date(recordDate);
      recDateOnly.setHours(0, 0, 0, 0);
      const filterDateOnly = new Date(currentFilterDate);
      filterDateOnly.setHours(0, 0, 0, 0);
      
      if (recDateOnly.getTime() !== filterDateOnly.getTime()) continue;
      
      // Enrich with employee data
      const emp = S.employees?.find(e => e.EMPID === r.EMPID);
      const enriched = {
        ...r,
        Name: (emp?.EmpName || emp?.Name || r.Name || r.EMPID || '—').trim(),
        Photo: emp?.Photo || emp?.photoUrl || null
      };
      
      filtered.push(enriched);
    }
    
    console.log(`✅ Filtered to ${filtered.length} records`);

    if (filtered.length === 0) {
      tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    } else {
      renderAttTable(filtered);
    }

    updateAttSummary(filtered);
    const totalEmp = S.employees ? S.employees.length : await getTotalEmployeesCount();
    updateLiveStats(filtered, totalEmp);
    setAttRecords(filtered);

  } catch (e) {
    console.error('❌ Error:', e);
    tb.innerHTML = `<tr><td colspan="12" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
  }
}

/* ══════════════════════════════════════════════════════
HELPER FUNCTIONS FOR ATTENDANCE
══════════════════════════════════════════════════════ */
function renderAttTable(list) {
  const tb = document.getElementById('attTableBody');
  if (!tb) return;
  
  if (!list || list.length === 0) {
    tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    const markedBy = r.MarkedBy || r.markedBy || 'SELF';
    const loc = r.LocationStatus || 'UNKNOWN';
    const locClass = loc === 'INSIDE' || loc === 'VERIFIED' ? 'badge-blue' : 'badge-amber';
    const status = r.Status || 'UNKNOWN';
    const statusClass = status === 'PRESENT' ? 'badge-green' : 'badge-red';
    const name = (r.Name || '—').trim();
    const id = r.EMPID || '—';
    const site = r.SiteID || '—';
    
    const photoHtml = r.Photo 
      ? `<img src="${r.Photo}" alt="Photo" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border);background:#fff;">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--teal-s);color:var(--teal);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.85rem;">${name.charAt(0).toUpperCase()}</div>`;

    const postLunchTime = r.postLunch?.time || r.PostLunch?.time || r.postLunchTime || '—';

    return `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:10px;text-align:center;vertical-align:middle;">${photoHtml}</td>
      <td style="padding:10px;vertical-align:middle;"><strong>${name}</strong></td>
      <td class="mono" style="padding:10px;vertical-align:middle;">${id}</td>
      <td style="padding:10px;vertical-align:middle;">${site}</td>
      <td class="mono" style="padding:10px;color:var(--green);vertical-align:middle;">${r.InTime || '—'}</td>
      <td class="mono" style="padding:10px;color:var(--red);vertical-align:middle;">${r.OutTime || '—'}</td>
      <td class="mono" style="padding:10px;color:var(--amber);vertical-align:middle;">${postLunchTime}</td>
      <td class="mono" style="padding:10px;vertical-align:middle;">${calcHours(r.InTime, r.OutTime)}</td>
      <td style="padding:10px;vertical-align:middle;"><span class="badge ${statusClass}">${status}</span></td>
      <td style="padding:10px;vertical-align:middle;"><span class="badge ${locClass}">${loc}</span></td>
      <td style="padding:10px;vertical-align:middle;">${r.HalfDay || 'NO'}</td>
      <td style="padding:10px;font-size:.75rem;color:var(--muted);vertical-align:middle;">${markedBy}</td>
    </tr>`;
  }).join('');
}

function updateLiveStats(list, totalEmployees) {
  const totalAtt = list?.length || 0;
  const present = list?.filter(r => r.Status === 'PRESENT').length || 0;
  const absent = Math.max(0, totalEmployees - present);
  
  const elTotal = document.getElementById('liveTotal');
  const elPresent = document.getElementById('livePresent');
  const elAbsent = document.getElementById('liveAbsent');
  
  if (elTotal) elTotal.textContent = totalEmployees;
  if (elPresent) elPresent.textContent = present;
  if (elAbsent) elAbsent.textContent = absent;

  const pPct = totalEmployees > 0 ? (present / totalEmployees * 100) : 0;
  const aPct = totalEmployees > 0 ? (absent / totalEmployees * 100) : 0;
  
  const barP = document.getElementById('barPresent');
  const barA = document.getElementById('barAbsent');
  
  if (barP) barP.style.width = `${pPct}%`;
  if (barA) barA.style.width = `${aPct}%`;

  const timeEl = document.getElementById('liveTimestamp');
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = `Updated: ${now.toLocaleTimeString()} | Att: ${totalAtt}/${totalEmployees}`;
  }
}

function updateAttSummary(list) {
  const present = list?.filter(r => r.Status === 'PRESENT').length || 0;
  const inside = list?.filter(r => r.LocationStatus === 'INSIDE' || r.LocationStatus === 'VERIFIED').length || 0;
  const summary = document.getElementById('attSummary');
  
  if (summary && list) {
    summary.innerHTML = `
      <div class="chip">Total Att. <span>${list.length}</span></div>
      <div class="chip" style="color:var(--green);">Present <span>${present}</span></div>
      <div class="chip" style="color:var(--red);">Absent <span>${list.length - present}</span></div>
      <div class="chip" style="color:#1565C0;">Inside <span>${inside}</span></div>
    `;
  }
}

function setAttRecords(records) {
  if (typeof window.S !== 'undefined' && window.S) {
    window.S.attRecords = records;
  } else {
    window.attRecords = records;
  }
}

function getAttRecords() {
  if (typeof window.S !== 'undefined' && window.S?.attRecords) {
    return window.S.attRecords;
  }
  return window.attRecords || [];
}

async function getTotalEmployeesCount() {
  if (window.S?.employees?.length > 0) return window.S.employees.length;
  try {
    const companyId = S.prefs?.companyId || S.prefs?.companyID;
    if (!companyId || !S?.clientDb) return 0;
    const snap = await S.clientDb.collection('employees')
      .where('companyId', '==', companyId)
      .get();
    return snap.size;
  } catch (e) { 
    return 0; 
  }
}

function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  try {
    if (typeof inTime === 'string' && typeof outTime === 'string') {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      const diff = (outH * 60 + outM) - (inH * 60 + inM);
      if (diff <= 0) return '—';
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h ${m}m`;
    }
    return '—';
  } catch(e) {
    return '—';
  }
}

