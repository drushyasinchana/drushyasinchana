/* ══════════════════════════════════════════════════════
   ATTENDANCE.JS - Fixed Site Dropdown & Filtering
   Fixes:
     - Dedicated site dropdown population (no empty values)
     - Robust site filtering (matches ID or Name)
     - Debug logs to diagnose data mismatches
══════════════════════════════════════════════════════ */

let attLiveListener = null;
let attLiveInterval = null;
let currentFilterDate = null;
let cachedTotalEmployees = 0;

/* ══════════════════════════════════════════════════════
   SAFE: Set/Get attRecords
══════════════════════════════════════════════════════ */
function setAttRecords(records) {
  if (typeof window.S !== 'undefined' && window.S) window.S.attRecords = records;
  else window.attRecords = records;
}
function getAttRecords() {
  if (typeof window.S !== 'undefined' && window.S?.attRecords) return window.S.attRecords;
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
    const snap = await S.clientDb.collection('employees').where('companyId', '==', companyId).get();
    cachedTotalEmployees = snap.size;
    return snap.size;
  } catch (e) { return cachedTotalEmployees || 0; }
}

/* ══════════════════════════════════════════════════════
   HELPER: Parse Date & Compare Days
══════════════════════════════════════════════════════ */
function parseAttendanceDate(dateVal) {
  if (!dateVal) return null;
  try {
    if (dateVal?.toDate) return dateVal.toDate();
    if (typeof dateVal === 'string') {
      const iso = new Date(dateVal);
      if (!isNaN(iso)) return iso;
      const p = dateVal.split(/[-/]/);
      return p[0].length === 4 ? new Date(dateVal) : new Date(p[2], p[1] - 1, p[0]);
    }
    if (dateVal instanceof Date) return dateVal;
    return null;
  } catch (e) { return null; }
}
function isSameDay(d1, d2) {
  return d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

/* ══════════════════════════════════════════════════════
   POPULATE ATTENDANCE SITE DROPDOWN (Fixed)
══════════════════════════════════════════════════════ */
function populateAttSiteDropdown() {
  const sel = document.getElementById('attSite');
  if (!sel || !S.sites?.length) return;

  // Save current selection
  const savedVal = sel.value;

  // Clear all except first option
  while (sel.options.length > 1) sel.remove(1);

  S.sites.forEach(s => {
    const opt = document.createElement('option');
    // ✅ NEVER use empty value. Use SiteID, or slugify SiteName as fallback
    opt.value = s.SiteID || s.SiteName?.replace(/\s+/g, '_').toLowerCase() || 'unknown';
    opt.textContent = `${s.SiteName || s.SiteID || 'Unnamed Site'}`;
    sel.appendChild(opt);
  });

  // Restore selection if it still exists
  if (savedVal && [...sel.options].some(o => o.value === savedVal)) {
    sel.value = savedVal;
  }
}

/* ══════════════════════════════════════════════════════
   LOAD ATTENDANCE
══════════════════════════════════════════════════════ */
async function loadAttendance() {
  console.log('🔍 loadAttendance() triggered');
  
  if (!S?.clientDb) { toast('DB not connected', 'error'); return; }
  const companyId = S.prefs?.companyId || S.prefs?.companyID;
  if (!companyId) { toast('Company context missing', 'error'); return; }
  
  const tb = document.getElementById('attTableBody');
  if (!tb) return;

  // 1. Load sites if missing
  if (!S.sites || S.sites.length === 0) {
    console.log('📥 Loading sites...');
    try {
      const snap = await S.clientDb.collection('sites').where('companyId', '==', companyId).get();
      S.sites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`✅ Sites loaded: ${S.sites.length}`);
    } catch (e) { console.error('❌ Site load failed:', e); }
  }

  // 2. Load employees if not loaded (to get their site assignments)
  if (!S.employees || S.employees.length === 0) {
    console.log('📥 Loading employees for site lookup...');
    try {
      const empSnap = await S.clientDb.collection('employees').where('companyId', '==', companyId).get();
      S.employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`✅ Employees loaded: ${S.employees.length}`);
    } catch (e) { console.error('❌ Employee load failed:', e); }
  }

  // 3. Populate attendance site dropdown
  populateAttSiteDropdown();

  // 4. Get filter values
  const dateEl = document.getElementById('attDate');
  const siteEl = document.getElementById('attSite');
  const filterDateStr = dateEl?.value || today();
  const filterSiteId = (siteEl?.value || '').trim();
  
  const fParts = filterDateStr.split('-');
  currentFilterDate = new Date(fParts[0], fParts[1] - 1, fParts[2]);

  console.log(`📅 Filter → Date: ${filterDateStr} | Site: ${filterSiteId || 'ALL'}`);

  try {
    const snap = await S.clientDb.collection('attendance').where('companyId', '==', companyId).get();
    console.log(`✅ Fetched ${snap.size} attendance records`);

    if (snap.empty) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      updateLiveStats([], await getTotalEmployeesCount());
      return;
    }

    // 🔍 DEBUG: Log first record structure
    const firstRec = snap.docs[0]?.data();
    console.log('🔍 First attendance record:', {
      EMPID: firstRec?.EMPID,
      SiteID: firstRec?.SiteID,
      Site: firstRec?.Site,
      site: firstRec?.site,
      siteId: firstRec?.siteId
    });

    const filtered = [];
    for (const doc of snap.docs) {
      const r = doc.data();

      // Date filter
      const recDate = parseAttendanceDate(r.Date);
      if (!recDate || !isSameDay(recDate, currentFilterDate)) continue;

      // ✅ AUTO-FILL SITE from employee record if missing in attendance
      if (!r.SiteID && !r.Site && r.EMPID) {
        const emp = S.employees?.find(e => e.EMPID === r.EMPID);
        if (emp) {
          r.SiteID = emp.Site;  // Use employee's assigned site
          r.Site = emp.Site;
          console.log(`📍 Auto-filled site for ${r.EMPID}: ${r.SiteID}`);
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
   RENDER TABLE
══════════════════════════════════════════════════════ */
function renderAttTable(list) {
  const tb = document.getElementById('attTableBody');
  if (!tb) return;
  if (!list.length) {
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
   UPDATE STATS & BAR CHART
══════════════════════════════════════════════════════ */
function updateLiveStats(list, totalEmployees) {
  const totalAtt = list.length;
  const present = list.filter(r => r.Status === 'PRESENT').length;
  const absent = totalEmployees - present;
  
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
  if (els.absent) els.absent.textContent = absent > 0 ? absent : 0;
  
  const pPct = totalEmployees > 0 ? (present / totalEmployees * 100) : 0;
  const aPct = totalEmployees > 0 ? (absent / totalEmployees * 100) : 0;
  
  if (els.barP) els.barP.style.width = `${pPct}%`;
  if (els.barA) els.barA.style.width = `${aPct}%`;
  
  if (els.time) {
    const now = new Date();
    els.time.textContent = `Updated: ${now.toLocaleTimeString()} | Att: ${totalAtt}/${totalEmployees}`;
  }
}

function updateAttSummary(list) {
  const present = list.filter(r => r.Status === 'PRESENT').length;
  const inside = list.filter(r => r.LocationStatus === 'INSIDE').length;
  const summary = document.getElementById('attSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="chip">Total Att. <span>${list.length}</span></div>
      <div class="chip" style="color:var(--green);">Present <span>${present}</span></div>
      <div class="chip" style="color:var(--red);">Absent <span>${list.length - present}</span></div>
      <div class="chip" style="color:#1565C0;">Inside <span>${inside}</span></div>
    `;
  }
}

function filterAttTable() {
  const st = document.getElementById('attStatus');
  if (!st) return;
  const val = st.value;
  const records = getAttRecords();
  const filtered = val ? records.filter(r => r.Status === val) : records;
  renderAttTable(filtered);
}

function calcHours(i, o) {
  if (!i || !o) return '—';
  const [ih, im] = i.split(':').map(Number), [oh, om] = o.split(':').map(Number);
  const m = (oh * 60 + om) - (ih * 60 + im);
  return m <= 0 ? '—' : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/* ══════════════════════════════════════════════════════
   LIVE UPDATES
══════════════════════════════════════════════════════ */
function startLiveUpdates() {
  console.log('🔄 Starting live updates...');
  stopLiveUpdates();
  if (!S?.clientDb) { toast('DB not ready', 'error'); return; }
  
  const companyId = S.prefs?.companyId || S.prefs?.companyID;
  const dateEl = document.getElementById('attDate');
  const fParts = (dateEl?.value || today()).split('-');
  currentFilterDate = new Date(fParts[0], fParts[1] - 1, fParts[2]);
  
  attLiveListener = S.clientDb.collection('attendance')
    .where('companyId', '==', companyId)
    .onSnapshot(async (snap) => {
      const filtered = [];
      for (const doc of snap.docs) {
        const r = doc.data();
        const recDate = parseAttendanceDate(r.Date);
        if (!recDate || !isSameDay(recDate, currentFilterDate)) continue;
        
        // Live filter (same logic as loadAttendance)
        const siteEl = document.getElementById('attSite');
        const filterSiteId = (siteEl?.value || '').trim();
        if (filterSiteId) {
          const recSiteId = String(r.SiteID || '').trim();
          const recSiteName = String(r.Site || '').trim();
          const target = filterSiteId.trim();
          if (recSiteId.toLowerCase() !== target.toLowerCase() && recSiteName.toLowerCase() !== target.toLowerCase()) continue;
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
    }, (err) => { console.error('Live err:', err); startFallbackPolling(); });
  
  const btn = document.querySelector('#pgAttendance .card-hdr .btn');
  if (btn) { btn.textContent = '⏹ Stop Live'; btn.onclick = stopLiveUpdates; btn.style.background = 'var(--red)'; }
  toast('Live updates started', 'success');
}

function stopLiveUpdates() {
  if (attLiveListener) { attLiveListener(); attLiveListener = null; }
  if (attLiveInterval) { clearInterval(attLiveInterval); attLiveInterval = null; }
  const btn = document.querySelector('#pgAttendance .card-hdr .btn');
  if (btn) { btn.textContent = '🔄 Live Mode'; btn.onclick = startLiveUpdates; btn.style.background = ''; }
  toast('Live updates stopped', 'warn');
}

function startFallbackPolling() {
  attLiveInterval = setInterval(() => loadAttendance(), 15000);
}

window.addEventListener('beforeunload', stopLiveUpdates);