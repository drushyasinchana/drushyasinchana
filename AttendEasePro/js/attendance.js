/* ══════════════════════════════════════════════════════
ATTENDANCE.JS - Complete Working Version
Features:
- Photo column with placeholder fallback
- Name trimming (no extra spaces)
- Robust date parsing (Android DD-MM-YYYY + HTML YYYY-MM-DD)
- Real-time live updates
- Scrollable table support
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
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
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



/* ═════════════════════════════════════════════════════
LOAD ATTENDANCE - FIXED Date Parsing (Handles MM-DD-YYYY)
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
  
  console.log('📅 Filter Date String:', filterDateStr);

  // ✅ ROBUST DATE PARSING: Detects and handles both formats
  const fParts = filterDateStr.split('-');
  let year, month, day;
  
  if (fParts[0].length === 4) {
    // Format: YYYY-MM-DD (e.g., 2026-07-09)
    year = parseInt(fParts[0], 10);
    month = parseInt(fParts[1], 10) - 1;
    day = parseInt(fParts[2], 10);
  } else if (fParts[2].length === 4) {
    // Format: MM-DD-YYYY (e.g., 07-09-2026 from date picker)
    month = parseInt(fParts[0], 10) - 1;
    day = parseInt(fParts[1], 10);
    year = parseInt(fParts[2], 10);
  } else {
    // Fallback: assume YYYY-MM-DD
    year = parseInt(fParts[0], 10);
    month = parseInt(fParts[1], 10) - 1;
    day = parseInt(fParts[2], 10);
  }
  
  currentFilterDate = new Date(year, month, day);
  console.log('📅 Parsed Filter Date:', currentFilterDate, `(Year:${year}, Month:${month+1}, Day:${day})`);

  try {
    // Fetch ALL attendance for company
    const attSnap = await S.clientDb.collection('attendance')
      .where('companyId', '==', companyId)
      .get();
    
    console.log(`✅ Fetched ${attSnap.size} total records`);

    if (attSnap.empty) {
      tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      updateLiveStats([], S.employees ? S.employees.length : 0);
      return;
    }
    
    // Filter & enrich records
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
      // YYYY-MM-DD format
      recordDate = new Date(r.Date);
    } else {
      // DD-MM-YYYY or MM-DD-YYYY format
      const [p1, p2, p3] = parts;
      const first = parseInt(p1, 10);
      const second = parseInt(p2, 10);
      
      // Determine format based on values
      if (first > 12) {
        // First part > 12, must be DD-MM-YYYY (e.g., "31-01-2026")
        recordDate = new Date(p3, second - 1, first);
      } else if (second > 12) {
        // Second part > 12, must be MM-DD-YYYY (e.g., "01-31-2026")
        recordDate = new Date(p3, first - 1, second);
      } else {
        // Both <= 12, assume DD-MM-YYYY (Indian format)
        // e.g., "09-07-2026" = July 9, 2026
        recordDate = new Date(p3, second - 1, first);
      }
    }
  }
}
      
      if (!recordDate || isNaN(recordDate)) {
        console.log('⚠️ Skipping record - invalid date:', r.Date);
        continue;
      }
      
      // Check same day
      const recDateOnly = new Date(recordDate);
      recDateOnly.setHours(0, 0, 0, 0);
      const filterDateOnly = new Date(currentFilterDate);
      filterDateOnly.setHours(0, 0, 0, 0);
      
      if (recDateOnly.getTime() !== filterDateOnly.getTime()) {
        // console.log('️ Date mismatch:', recDateOnly, 'vs', filterDateOnly);
        continue;
      }
      
      // Enrich with employee Photo/Name
      const emp = S.employees?.find(e => e.EMPID === r.EMPID);
      const enriched = {
        ...r,
        Name: (emp?.EmpName || emp?.Name || r.Name || r.EMPID || '—').trim(),
        Photo: emp?.Photo || emp?.photoUrl || null
      };
      
      filtered.push(enriched);
    }
    
    console.log(`✅ Filtered to ${filtered.length} records for ${filterDateStr}`);

    // Render table
    if (filtered.length === 0) {
      tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    } else {
      renderAttTable(filtered);
    }

    // Update stats
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
RENDER ATTENDANCE TABLE - WITH PHOTO & POST-LUNCH (12 COLUMNS)
══════════════════════════════════════════════════════ */
function renderAttTable(list) {
  const tb = document.getElementById('attTableBody');
  if (!tb) return;
  
  // ✅ Updated colspan to 12
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
    
    // ✅ Photo Logic
    const photoHtml = r.Photo 
      ? `<img src="${r.Photo}" alt="Photo" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border);background:#fff;">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--teal-s);color:var(--teal);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.85rem;">${name.charAt(0).toUpperCase()}</div>`;

    // ✅ Post-Lunch Time: Handle nested object postLunch.time
    const postLunchTime = r.postLunch?.time || r.PostLunch?.time || r.postLunchTime || '—';

    return `
    <tr style="border-bottom:1px solid var(--border);">
      <!-- ✅ Photo Column -->
      <td style="padding:10px;text-align:center;vertical-align:middle;">${photoHtml}</td>
      <!-- ✅ Name Column -->
      <td style="padding:10px;vertical-align:middle;"><strong>${name}</strong></td>
      <td class="mono" style="padding:10px;vertical-align:middle;">${id}</td>
      <td style="padding:10px;vertical-align:middle;">${site}</td>
      <td class="mono" style="padding:10px;color:var(--green);vertical-align:middle;">${r.InTime || '—'}</td>
      <td class="mono" style="padding:10px;color:var(--red);vertical-align:middle;">${r.OutTime || '—'}</td>
      
      <!-- ✅ NEW: Post-Lunch Time Column -->
      <td class="mono" style="padding:10px;color:var(--amber);vertical-align:middle;">${postLunchTime}</td>
      
      <td class="mono" style="padding:10px;vertical-align:middle;">${calcHours(r.InTime, r.OutTime)}</td>
      <td style="padding:10px;vertical-align:middle;"><span class="badge ${statusClass}">${status}</span></td>
      <td style="padding:10px;vertical-align:middle;"><span class="badge ${locClass}">${loc}</span></td>
      <td style="padding:10px;vertical-align:middle;">${r.HalfDay || 'NO'}</td>
      <td style="padding:10px;font-size:.75rem;color:var(--muted);vertical-align:middle;">${markedBy}</td>
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

/* ══════════════════════════════════════════════════════
UPDATE ATTENDANCE SUMMARY CHIPS
══════════════════════════════════════════════════════ */
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
START LIVE UPDATES - FIXED Date Parsing
══════════════════════════════════════════════════════ */
function startLiveUpdates() {
  console.log('🔄 Starting live updates...');
  
  const dateEl = document.getElementById('attDate');
  const selected = dateEl?.value || today();
  
  if (selected !== today()) {
    toast('️ Live mode only works for today\'s date', 'error');
    const btn = document.getElementById('liveModeBtn');
    if (btn) {
      btn.classList.remove('active');
      const btnText = btn.querySelector('.btn-text');
      const btnIcon = btn.querySelector('.btn-icon');
      if (btnText) btnText.textContent = 'Live Mode';
      if (btnIcon) btnIcon.textContent = '🔄';
    }
    return;
  }

  stopLiveUpdates();
  
  if (!S?.clientDb) { toast('DB not ready', 'error'); return; }
  
  const companyId = S.prefs?.companyId;
  if (!companyId) { toast('Company ID missing', 'error'); return; }
  
  // Parse filter date (SAME as generateReport)
  const fParts = selected.split('-');
  currentFilterDate = new Date(
    parseInt(fParts[0], 10),
    parseInt(fParts[1], 10) - 1,
    parseInt(fParts[2], 10)
  );
  currentFilterDate.setHours(0, 0, 0, 0);
  
  console.log(' Listening for attendance changes for companyId:', companyId);
  
  // Set up Firestore snapshot listener (REAL-TIME)
  attLiveListener = S.clientDb.collection('attendance')
    .where('companyId', '==', companyId)
    .onSnapshot(async (snap) => {
      console.log(` Live snapshot: ${snap.size} total records`);
      
      const filtered = [];
      
      for (const doc of snap.docs) {
        const r = doc.data();
        
        // ✅ FIXED: Robust Date Parsing (Same as loadAttendance)
        let recordDate = null;
        if (r.Date?.toDate) {
          recordDate = r.Date.toDate();
        } else if (typeof r.Date === 'string') {
          const parts = r.Date.split(/[-/]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // YYYY-MM-DD
              recordDate = new Date(r.Date);
            } else {
              // DD-MM-YYYY (Android App)
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              const year = parseInt(parts[2], 10);
              recordDate = new Date(year, month, day);
            }
          }
        }
        
        if (!recordDate || isNaN(recordDate)) continue;
        
        // Check if record matches filter date (SAME DAY)
        const recDateOnly = new Date(recordDate);
        recDateOnly.setHours(0, 0, 0, 0);
        
        if (recDateOnly.getTime() !== currentFilterDate.getTime()) {
          continue;
        }
        
        // Site filter (if active)
        const siteEl = document.getElementById('attSite');
        const filterSiteId = (siteEl?.value || '').trim();
        if (filterSiteId) {
          const recSiteId = String(r.SiteID || '').trim();
          const recSiteName = String(r.Site || '').trim();
          const target = filterSiteId.trim();
          
          const matches = recSiteId.toLowerCase() === target.toLowerCase() || 
                          recSiteName.toLowerCase() === target.toLowerCase();
          if (!matches) continue;
        }
        
        // Enrich with employee name
        if (!r.Name && r.EMPID && S.employees) {
          const emp = S.employees.find(e => e.EMPID === r.EMPID);
          if (emp) r.Name = emp.EmpName || emp.Name || r.EMPID;
        }
        
        filtered.push({ id: doc.id, ...r });
      }
      
      console.log(`✅ Live filtered to ${filtered.length} records`);
      
      // Sort by InTime (newest first)
      filtered.sort((a, b) => (b.InTime || '00:00:00').localeCompare(a.InTime || '00:00:00'));
      
      // Render and update UI
      renderAttTable(filtered);
      updateAttSummary(filtered);
      updateLiveStats(filtered, await getTotalEmployeesCount());
      setAttRecords(filtered);
      
    }, (err) => { 
      console.error('❌ Live listener error:', err); 
      toast('Live updates failed: ' + err.message, 'warn');
    });
  
  // Update button UI
  const btn = document.getElementById('liveModeBtn');
  if (btn) {
    btn.classList.add('active');
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');
    if (btnText) btnText.textContent = 'Live ON';
    if (btnIcon) btnIcon.textContent = '●';
  }
  toast('✅ Live updates active for today', 'success');
}

/* ══════════════════════════════════════════════════════
STOP LIVE UPDATES
══════════════════════════════════════════════════════ */
function stopLiveUpdates() {
  console.log('⏹ Stopping live updates...');
  
  if (attLiveListener) { 
    attLiveListener(); 
    attLiveListener = null; 
  }
  if (attLiveInterval) { 
    clearInterval(attLiveInterval); 
    attLiveInterval = null; 
  }
  
  const btn = document.getElementById('liveModeBtn');
  if (btn) {
    btn.classList.remove('active');
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');
    if (btnText) btnText.textContent = 'Live Mode';
    if (btnIcon) btnIcon.textContent = '🔄';
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
AUTO-REFRESH ENGINE
══════════════════════════════════════════════════════ */
let attRefreshTimer = null;

window.startAttAutoRefresh = function() {
  console.log('🔄 Starting attendance auto-refresh...');
  window.stopAttAutoRefresh();
  
  if (typeof loadAttendance === 'function') loadAttendance();
  
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
TOGGLE LIVE MODE
══════════════════════════════════════════════════════ */
function toggleLiveMode() {
  const btn = document.getElementById('liveModeBtn');
  const isActive = btn?.classList.contains('active');
  
  if (isActive) {
    stopLiveUpdates();
  } else {
    startLiveUpdates();
  }
}

/* ══════════════════════════════════════════════════════
INACTIVITY TIMEOUT
══════════════════════════════════════════════════════ */
let inactivityTimer = null;
const INACTIVITY_LIMIT = 10 * 60 * 1000;

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (typeof stopLiveUpdates === 'function') {
      stopLiveUpdates();
      console.log('⏹ Live mode stopped: 10 min inactivity');
    }
  }, INACTIVITY_LIMIT);
}

['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

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