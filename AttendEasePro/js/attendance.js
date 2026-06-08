/* ══════════════════════════════════════════════════════
   ATTENDANCE.JS - Complete Fixed Version
   Fixes:
     - Missing helper functions (isSameDay, today)
     - Uniform date parsing (Android string + Timestamp)
     - Live updates with real-time listener
     - Site dropdown population without empty values
══════════════════════════════════════════════════════ */

// Global state for attendance module
let attLiveListener = null;
let attLiveInterval = null;
let currentFilterDate = null;
let cachedTotalEmployees = 0;

/* ══════════════════════════════════════════════════════
   HELPER: Get today's date in YYYY-MM-DD format
══════════════════════════════════════════════════════ */
function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ══════════════════════════════════════════════════════
   HELPER: Parse Date - Handles Android string + Timestamp
══════════════════════════════════════════════════════ */
function parseAttendanceDate(dateVal) {
  if (!dateVal) return null;
  try {
    // Firestore Timestamp
    if (dateVal?.toDate) return dateVal.toDate();
    
    // String format: "DD-MM-YYYY" (Android) or "YYYY-MM-DD" (HTML)
    if (typeof dateVal === 'string' && dateVal.includes('-')) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        // DD-MM-YYYY format (Android app)
        if (parts[0].length === 2 && parts[1].length === 2) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        // YYYY-MM-DD format (HTML input)
        if (parts[0].length === 4) {
          return new Date(dateVal);
        }
      }
    }
    
    // Standard Date object
    if (dateVal instanceof Date && !isNaN(dateVal)) return dateVal;
    
    return null;
  } catch (e) { 
    console.error('❌ Date parse error:', e, 'Value:', dateVal);
    return null; 
  }
}

/* ══════════════════════════════════════════════════════
   HELPER: Compare if two dates are same day
══════════════════════════════════════════════════════ */
function isSameDay(d1, d2) {
  return d1 && d2 && 
         d1.getFullYear() === d2.getFullYear() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getDate() === d2.getDate();
}

/* ══════════════════════════════════════════════════════
   HELPER: Calculate Hours from time strings
══════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════
   SAFE: Set/Get attRecords (cross-file compatibility)
══════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════
   GET TOTAL EMPLOYEES COUNT
══════════════════════════════════════════════════════ */
async function getTotalEmployeesCount() {
  if (window.S?.employees?.length > 0) return window.S.employees.length;
  try {
    const companyId = S.prefs?.companyId || S.prefs?.companyID;
    if (!companyId || !S?.clientDb) return 0;
    const snap = await S.clientDb.collection('employees')
      .where('companyId', '==', companyId)
      .get();
    cachedTotalEmployees = snap.size;
    return snap.size;
  } catch (e) { 
    return cachedTotalEmployees || 0; 
  }
}

/* ══════════════════════════════════════════════════════
   POPULATE ATTENDANCE SITE DROPDOWN
══════════════════════════════════════════════════════ */
function populateAttSiteDropdown() {
  const sel = document.getElementById('attSite');
  if (!sel || !S.sites?.length) return;

  const savedVal = sel.value;
  while (sel.options.length > 1) sel.remove(1);

  S.sites.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.SiteID || s.SiteName?.replace(/\s+/g, '_').toLowerCase() || 'unknown';
    opt.textContent = `${s.SiteName || s.SiteID || 'Unnamed Site'}`;
    sel.appendChild(opt);
  });

  if (savedVal && [...sel.options].some(o => o.value === savedVal)) {
    sel.value = savedVal;
  }
}

/* ══════════════════════════════════════════════════════
   LOAD ATTENDANCE - Main Function (EXPORTED)
══════════════════════════════════════════════════════ */
async function loadAttendance() {
  console.log('🔍 loadAttendance() triggered');
  
  if (!S?.clientDb) { toast('DB not connected', 'error'); return; }
  const companyId = S.prefs?.companyId || S.prefs?.companyID;
  if (!companyId) { toast('Company context missing', 'error'); return; }
  
  const tb = document.getElementById('attTableBody');
  if (!tb) return;

  // Load sites if missing
  if (!S.sites || S.sites.length === 0) {
    console.log('📥 Loading sites...');
    try {
      const snap = await S.clientDb.collection('sites')
        .where('companyId', '==', companyId)
        .get();
      S.sites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`✅ Sites loaded: ${S.sites.length}`);
    } catch (e) { console.error('❌ Site load failed:', e); }
  }

  // Load employees if missing
  if (!S.employees || S.employees.length === 0) {
    console.log('📥 Loading employees...');
    try {
      const empSnap = await S.clientDb.collection('employees')
        .where('companyId', '==', companyId)
        .get();
      S.employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`✅ Employees loaded: ${S.employees.length}`);
    } catch (e) { console.error('❌ Employee load failed:', e); }
  }

  populateAttSiteDropdown();

  // Get filter values
  const dateEl = document.getElementById('attDate');
  const siteEl = document.getElementById('attSite');
  const filterDateStr = dateEl?.value || today();
  const filterSiteId = (siteEl?.value || '').trim();
  
  const fParts = filterDateStr.split('-');
  currentFilterDate = new Date(parseInt(fParts[0]), parseInt(fParts[1]) - 1, parseInt(fParts[2]));

  console.log(`📅 Filter → Date: ${filterDateStr} | Site: ${filterSiteId || 'ALL'}`);

  try {
    const snap = await S.clientDb.collection('attendance')
      .where('companyId', '==', companyId)
      .get();
    
    console.log(`✅ Fetched ${snap.size} attendance records`);

    if (snap.empty) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      updateLiveStats([], await getTotalEmployeesCount());
      return;
    }

    // Debug: Log sample records
    console.log('🔍 Sample records:');
    snap.docs.slice(0, 3).forEach((doc, i) => {
      const r = doc.data();
      console.log(`  [${i}] Date: ${r.Date} (${typeof r.Date}), EMPID: ${r.EMPID}, Parsed:`, parseAttendanceDate(r.Date));
    });

    const filtered = [];
    for (const doc of snap.docs) {
      const r = doc.data();

      // Date filter
      const recDate = parseAttendanceDate(r.Date);
      if (!recDate) {
        console.log('⚠️ Skipping record - invalid date:', r.Date);
        continue;
      }
      
      if (!isSameDay(recDate, currentFilterDate)) continue;

      // Auto-fill site from employee if missing
      if ((!r.SiteID && !r.Site) && r.EMPID) {
        const emp = S.employees?.find(e => e.EMPID === r.EMPID);
        if (emp) {
          r.SiteID = emp.Site || emp.SiteID;
          r.Site = emp.Site || emp.SiteID;
        }
      }

      // Site filter
      if (filterSiteId) {
        const recSiteId = String(r.SiteID || '').trim();
        const recSiteName = String(r.Site || '').trim();
        const target = filterSiteId.trim();
        
        const matches = recSiteId.toLowerCase() === target.toLowerCase() || 
                        recSiteName.toLowerCase() === target.toLowerCase();
        if (!matches) continue;
      }

      // Auto-fill name if missing
      if (!r.Name && r.EMPID) {
        const emp = S.employees?.find(e => e.EMPID === r.EMPID);
        if (emp) r.Name = emp.EmpName || emp.Name || r.EMPID;
      }

      filtered.push({ id: doc.id, ...r });
    }

    console.log(`✅ Filtered to ${filtered.length} records`);
    filtered.sort((a, b) => (b.InTime || '00:00:00').localeCompare(a.InTime || '00:00:00'));

    renderAttTable(filtered);
    updateAttSummary(filtered);
    
    const totalEmp = await getTotalEmployeesCount();
    updateLiveStats(filtered, totalEmp);
    setAttRecords(filtered);

  } catch (e) {
    console.error('❌ Error:', e);
    tb.innerHTML = `<tr><td colspan="10" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
  }
}

/* ══════════════════════════════════════════════════════
   RENDER ATTENDANCE TABLE
══════════════════════════════════════════════════════ */
function renderAttTable(list) {
  const tb = document.getElementById('attTableBody');
  if (!tb) return;
  
  if (!list || list.length === 0) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    const markedBy = r.MarkedBy || r.markedBy || r.Marked_by || r.marked_by || r.markedby || 'SELF';
    const loc = r.LocationStatus || r.locationStatus || r.Location || r.location || 'UNKNOWN';
    const locClass = loc === 'INSIDE' ? 'badge-blue' : 'badge-amber';
    const status = r.Status || 'UNKNOWN';
    const statusClass = status === 'PRESENT' ? 'badge-green' : 'badge-red';
    const name = r.Name || r.empName || r.EmpName || r.name || '—';
    const id = r.EMPID || r.empId || r.Empid || '—';
    const site = r.SiteID || r.Site || r.siteId || r.site || '—';
    
    return `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:10px;"><strong>${name}</strong></td>
      <td class="mono" style="padding:10px;">${id}</td>
      <td style="padding:10px;">${site}</td>
      <td class="mono" style="padding:10px;color:var(--green);">${r.InTime || '—'}</td>
      <td class="mono" style="padding:10px;color:var(--red);">${r.OutTime || '—'}</td>
      <td class="mono" style="padding:10px;">${calcHours(r.InTime, r.OutTime)}</td>
      <td style="padding:10px;"><span class="badge ${statusClass}">${status}</span></td>
      <td style="padding:10px;"><span class="badge ${locClass}">${loc}</span></td>
      <td style="padding:10px;">${r.HalfDay || r.halfDay || 'NO'}</td>
      <td style="padding:10px;font-size:.75rem;color:var(--muted);">${markedBy}</td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   UPDATE LIVE STATS & BAR CHART
══════════════════════════════════════════════════════ */
function updateLiveStats(list, totalEmployees) {
  const totalAtt = list?.length || 0;
  const present = list?.filter(r => r.Status === 'PRESENT').length || 0;
  const absent = Math.max(0, totalEmployees - present);
  
  const els = {
    total: document.getElementById('liveTotal'),
    present: document.getElementById('livePresent'),
    absent: document.getElementById('liveAbsent'),
    barP: document.getElementById('barPresent'),
    barA: document.getElementById('barAbsent'),
    time: document.getElementById('liveTimestamp')
  };
  
  if (els.total) els.total.textContent = totalEmployees;
  if (els.present) els.present.textContent = present;
  if (els.absent) els.absent.textContent = absent;
  
  const pPct = totalEmployees > 0 ? (present / totalEmployees * 100) : 0;
  const aPct = totalEmployees > 0 ? (absent / totalEmployees * 100) : 0;
  
  if (els.barP) els.barP.style.width = `${pPct}%`;
  if (els.barA) els.barA.style.width = `${aPct}%`;
  
  if (els.time) {
    const now = new Date();
    els.time.textContent = `Updated: ${now.toLocaleTimeString()} | Att: ${totalAtt}/${totalEmployees}`;
  }
}

/* ══════════════════════════════════════════════════════
   UPDATE ATTENDANCE SUMMARY CHIPS
══════════════════════════════════════════════════════ */
function updateAttSummary(list) {
  const present = list?.filter(r => r.Status === 'PRESENT').length || 0;
  const inside = list?.filter(r => r.LocationStatus === 'INSIDE').length || 0;
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

/* ══════════════════════════════════════════════════════
   FILTER TABLE BY STATUS
══════════════════════════════════════════════════════ */
function filterAttTable() {
  const st = document.getElementById('attStatus');
  if (!st) return;
  const val = st.value;
  const records = getAttRecords();
  const filtered = val ? records.filter(r => r.Status === val) : records;
  renderAttTable(filtered);
}

/* ══════════════════════════════════════════════════════
   LIVE UPDATES - Real-time Listener
══════════════════════════════════════════════════════ */
function startLiveUpdates() {
  // ✅ CHECK IF SELECTED DATE IS TODAY
  const dateEl = document.getElementById('attDate');
  const selected = dateEl ? dateEl.value : today();
  
  if (selected !== today()) {
    toast('⚠️ Live mode only works for today\'s date', 'error');
    const btn = document.getElementById('liveModeBtn');
    if (btn) {
      btn.classList.remove('active');
      btn.querySelector('.btn-text').textContent = 'Live Mode';
      btn.querySelector('.btn-icon').textContent = '🔄';
    }
    return; // Stop immediately
  }

  console.log('🔄 Starting live updates...');
  stopLiveUpdates();
  
  if (!S?.clientDb) { toast('DB not ready', 'error'); return; }
  
  const companyId = S.prefs?.companyId || S.prefs?.companyID;
  const fParts = selected.split('-');
  currentFilterDate = new Date(parseInt(fParts[0]), parseInt(fParts[1]) - 1, parseInt(fParts[2]));
  
  console.log('📡 Listening for attendance changes...');
  
  attLiveListener = S.clientDb.collection('attendance')
    .where('companyId', '==', companyId)
    .onSnapshot(async (snap) => {
      console.log(`📡 Live update: ${snap.size} total records`);
      const filtered = [];
      for (const doc of snap.docs) {
        const r = doc.data();
        const recDate = parseAttendanceDate(r.Date);
        if (!recDate || !isSameDay(recDate, currentFilterDate)) continue;
        
        const siteEl = document.getElementById('attSite');
        const filterSiteId = (siteEl?.value || '').trim();
        if (filterSiteId) {
          const recSiteId = String(r.SiteID || '').trim();
          const recSiteName = String(r.Site || '').trim();
          const target = filterSiteId.trim();
          if (recSiteId.toLowerCase() !== target.toLowerCase() && 
              recSiteName.toLowerCase() !== target.toLowerCase()) continue;
        }
        if (!r.Name && r.EMPID && window.S?.employees) {
          const emp = window.S.employees.find(e => e.EMPID === r.EMPID);
          if (emp) r.Name = emp.EmpName || emp.Name || r.EMPID;
        }
        filtered.push({ id: doc.id, ...r });
      }
      
      filtered.sort((a, b) => (b.InTime || '00:00:00').localeCompare(a.InTime || '00:00:00'));
      renderAttTable(filtered);
      updateAttSummary(filtered);
      updateLiveStats(filtered, await getTotalEmployeesCount());
      setAttRecords(filtered);
    }, (err) => { 
      console.error('❌ Live listener error:', err); 
      toast('Live updates failed', 'warn');
    });
  
  const btn = document.getElementById('liveModeBtn');
  if (btn) {
    btn.classList.add('active');
    btn.querySelector('.btn-text').textContent = 'Live ON';
    btn.querySelector('.btn-icon').textContent = '●';
  }
  toast('✅ Live updates active for today', 'success');
}



function stopLiveUpdates() {
  if (attLiveListener) { 
    attLiveListener(); 
    attLiveListener = null; 
    console.log('⏹ Live updates stopped');
  }
  if (attLiveInterval) { 
    clearInterval(attLiveInterval); 
    attLiveInterval = null; 
  }
  
  // ✅ UPDATE BUTTON TO INACTIVE STATE (GRAY)
  const btn = document.getElementById('liveModeBtn');
  if (btn) {
    btn.classList.remove('active');
    btn.querySelector('.btn-text').textContent = 'Live Mode';
    btn.querySelector('.btn-icon').textContent = '🔄';
  }
  
  toast('⏹ Live updates stopped', 'warn');
}
/* ══════════════════════════════════════════════════════
   CLEANUP: Stop listeners on page unload
══════════════════════════════════════════════════════ */
window.addEventListener('beforeunload', () => {
  if (attLiveListener) {
    attLiveListener();
    attLiveListener = null;
  }
  if (attLiveInterval) {
    clearInterval(attLiveInterval);
    attLiveInterval = null;
  }
});

/* ══════════════════════════════════════════════════════
   AUTO-REFRESH ENGINE (Attendance Page Only)
══════════════════════════════════════════════════════ */
let attRefreshTimer = null;

window.startAttAutoRefresh = function() {
  console.log('🔄 Starting attendance auto-refresh...');
  window.stopAttAutoRefresh(); // Clear any existing timer
  
  // Refresh immediately
  if (typeof loadAttendance === 'function') loadAttendance();
  
  // Then every 10 seconds
  attRefreshTimer = setInterval(() => {
    console.log('🔄 Auto-refreshing attendance data...');
    if (typeof loadAttendance === 'function') loadAttendance();
  }, 10000);
  
  updateAttAutoUI(true);
};

window.stopAttAutoRefresh = function() {
  if (attRefreshTimer) {
    clearInterval(attRefreshTimer);
    attRefreshTimer = null;
    console.log('⏹ Attendance auto-refresh stopped');
  }
  updateAttAutoUI(false);
};

function updateAttAutoUI(active) {
  const el = document.getElementById('attAutoStatus');
  if (!el) return;
  
  if (active) {
    el.textContent = '⟳ Auto-refresh ON (10s)';
    el.style.color = '#00838F';
    el.style.cursor = 'pointer';
    el.title = 'Click to pause auto-refresh';
    el.onclick = window.stopAttAutoRefresh;
  } else {
    el.textContent = '⏸ Auto-refresh OFF';
    el.style.color = '#6B8A8F';
    el.style.cursor = 'pointer';
    el.title = 'Click to start auto-refresh';
    el.onclick = window.startAttAutoRefresh;
  }
}

/* ══════════════════════════════════════════════════════
   TOGGLE LIVE MODE (Wrapper for start/stop)
══════════════════════════════════════════════════════ */
function toggleLiveMode() {
  // Check if listener is active by checking button state
  const btn = document.getElementById('liveModeBtn');
  const isActive = btn?.classList.contains('active');
  
  if (isActive) {
    stopLiveUpdates();
  } else {
    startLiveUpdates();
  }
}

/* ══════════════════════════════════════════════════════
   INACTIVITY TIMEOUT (10 Minutes)
══════════════════════════════════════════════════════ */
let inactivityTimer = null;
const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (typeof stopLiveUpdates === 'function') {
      stopLiveUpdates();
      console.log('⏹ Live mode stopped: 10 min inactivity');
    }
  }, INACTIVITY_LIMIT);
}

// Attach activity listeners
['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// Start timer on load
document.addEventListener('DOMContentLoaded', resetInactivityTimer);






document.addEventListener('DOMContentLoaded', () => {
  const dateEl = document.getElementById('attDate');
  if (dateEl) {
    dateEl.addEventListener('change', () => {
      if (dateEl.value !== today() && typeof stopLiveUpdates === 'function') {
        stopLiveUpdates();
      }
    });
  }
});