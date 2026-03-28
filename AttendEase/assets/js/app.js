/**
 * AttendEase Portal — app.js
 * Drushyasinchana Tech Solutions · drushyasinchana.in
 */

/* ── CONFIG ──────────────────────────────────────────────────── */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzCwLtdaz3XQZUn8_JY2_YXPdVDmQI0oCwlcoWWMH5iHJvJ0vscG0z5tljd-gP1MuQ/exec";

/* ── STATE ───────────────────────────────────────────────────── */
const S = {
  prefs: {},
  employees: [],
  sites: [],
  attRecords: [],
  rptRecords: [],
  editingEmpCode: null,
  editingSiteId:  null,
};

/* ── SHA-256 ──────────────────────────────────────────────────── */
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ── API ──────────────────────────────────────────────────────── */
async function api(payload) {
  const r = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
  return r.json();
}

/* ── TOAST ────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + (type || '');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => (t.className = ''), 3200);
}

/* ── MODAL ────────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-backdrop').forEach(el =>
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); })
);

/* ── SCREEN SWITCH ────────────────────────────────────────────── */
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ── NAVIGATION ───────────────────────────────────────────────── */
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  employees: 'Employee Directory',
  sites:     'Site Management',
  attendance:'Attendance Records',
  reports:   'Reports',
  manual:    'Manual Entry',
};

function nav(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('pg' + page.charAt(0).toUpperCase() + page.slice(1));
  if (pg) pg.classList.add('active');
  if (btn) btn.classList.add('active');
  document.getElementById('topbarTitle').textContent = PAGE_TITLES[page] || page;

  if (page === 'dashboard')  loadDashboard();
  if (page === 'employees')  loadEmployees();
  if (page === 'sites')      loadSites();
  if (page === 'attendance') { setTodayDate(); loadAttendance(); }
  if (page === 'reports')    setReportDefaults();
}

/* ── HELPERS ──────────────────────────────────────────────────── */
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function setTodayDate() {
  const el = document.getElementById('attDate');
  if (el && !el.value) el.value = today();
}
function setReportDefaults() {
  const f = document.getElementById('rptFrom'), t = document.getElementById('rptTo');
  if (!f.value) { const d = new Date(); d.setDate(1); f.value = d.toISOString().slice(0, 10); }
  if (!t.value) t.value = today();
}
function calcHours(inT, outT) {
  if (!inT || !outT) return '—';
  const [ih, im] = inT.split(':').map(Number);
  const [oh, om] = outT.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  if (mins <= 0) return '—';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

/* ══════════════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════════════ */
async function doLogin() {
  const btn  = document.getElementById('btnLogin');
  const err  = document.getElementById('loginError');
  const email = document.getElementById('lCompanyEmail').value.trim().toLowerCase();
  const empId = document.getElementById('lEmpId').value.trim();
  const pw    = document.getElementById('lPassword').value.trim();

  err.style.display = 'none';
  if (!email || !empId || !pw) { showErr(err, 'Please fill all fields.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';

  try {
    const hash = await sha256(pw);
    const res  = await api({ action: 'login', adminEmail: email, empId, password: hash, device: 'Web' });

    if (res.success) {
      const d = res.data;
      if (d.role !== 'ADMIN') {
        showErr(err, 'Web portal access is for admin accounts only.');
        btn.disabled = false; btn.textContent = 'Sign In';
        return;
      }
      Object.assign(S.prefs, {
        empCode: d.empCode || '', empName: d.name || '', empEmail: d.email || '',
        role: d.role || '', companyName: d.companyName || '',
        companySheetId: d.companySheetId || '', siteId: d.siteId || '',
        siteName: d.siteName || '', shiftStart: d.shiftStart || '',
        shiftEnd: d.shiftEnd || '', lunchTime: d.lunchTime || '',
      });

      document.getElementById('sbCompanyName').textContent = S.prefs.companyName || email;
      document.getElementById('topbarEmail').textContent   = S.prefs.empEmail || empId;
      document.getElementById('topbarAvatar').textContent  = (S.prefs.empName || empId).slice(0, 2).toUpperCase();

      switchScreen('appScreen');
      nav('dashboard', document.querySelector('.nav-item'));
    } else {
      showErr(err, res.message || 'Login failed. Check your credentials.');
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  } catch (e) {
    showErr(err, 'Connection error. Please check your internet connection.');
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

function doLogout() {
  Object.assign(S, { prefs: {}, employees: [], sites: [], attRecords: [], rptRecords: [], editingEmpCode: null, editingSiteId: null });
  document.getElementById('lPassword').value = '';
  switchScreen('loginScreen');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').classList.contains('active')) doLogin();
});

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const [empRes, siteRes, attRes] = await Promise.all([
      api({ action: 'getEmployees',  companySheetId: S.prefs.companySheetId }),
      api({ action: 'getSites',      companySheetId: S.prefs.companySheetId }),
      api({ action: 'getAttendance', companySheetId: S.prefs.companySheetId, date: today() }),
    ]);
    S.employees = empRes.success  ? empRes.data.employees || []  : [];
    S.sites     = siteRes.success ? siteRes.data.sites    || []  : [];
    const atts  = attRes.success  ? attRes.data.records   || []  : [];

    const present = atts.filter(r => r.status === 'PRESENT').length;
    document.getElementById('stTotalEmp').textContent = S.employees.length;
    document.getElementById('stPresent').textContent  = present;
    document.getElementById('stAbsent').textContent   = Math.max(0, S.employees.length - present);
    document.getElementById('stSites').textContent    = S.sites.filter(s => !s.status || s.status === 'ACTIVE').length;
    document.getElementById('stDate').textContent     = fmtDate(today());

    // today's attendance mini list
    const al = document.getElementById('dashAttendList');
    if (!atts.length) {
      al.innerHTML = '<div class="empty"><p>No attendance records yet today</p></div>';
    } else {
      al.innerHTML = atts.slice(0, 7).map(r => `
        <div class="mini-row">
          <div><div class="name">${r.name || r.empCode}</div><div class="sub">${r.site || '—'}</div></div>
          <div class="right">
            <span class="badge ${r.status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${r.status || '—'}</span>
            <div class="time">${r.inTime ? 'IN ' + r.inTime : ''} ${r.outTime ? '· OUT ' + r.outTime : ''}</div>
          </div>
        </div>`).join('');
    }

    // sites mini list
    const sl = document.getElementById('dashSiteList');
    sl.innerHTML = S.sites.map(s => `
      <div class="mini-row">
        <div><div class="name">${s.siteName}</div><div class="sub">${s.shiftStart || ''}${s.shiftEnd ? ' – ' + s.shiftEnd : ''}</div></div>
        <span style="font-size:.75rem;color:var(--teal);font-family:'DM Mono',monospace;">${s.radius || ''}m</span>
      </div>`).join('');

    populateSiteSelects();
  } catch (e) {
    toast('Failed to load dashboard data', 'error');
  }
}

/* ══════════════════════════════════════════════════════════════
   EMPLOYEES
══════════════════════════════════════════════════════════════ */
async function loadEmployees() {
  try {
    const res = await api({ action: 'getEmployees', companySheetId: S.prefs.companySheetId });
    S.employees = res.success ? res.data.employees || [] : [];
    renderEmployees(S.employees);
    populateSiteSelects();
  } catch (e) { toast('Failed to load employees', 'error'); }
}

function renderEmployees(list) {
  const tb = document.getElementById('empTableBody');
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="7"><div class="empty"><p>No employees found</p></div></td></tr>';
    return;
  }
  tb.innerHTML = list.map(e => `
    <tr>
      <td class="mono">${e.empCode || '—'}</td>
      <td><strong>${e.name || '—'}</strong></td>
      <td style="color:var(--muted);font-size:.82rem;">${e.email || '—'}</td>
      <td>${e.siteName || e.site || '—'}</td>
      <td style="color:var(--muted);font-size:.82rem;">${fmtDate(e.joinDate)}</td>
      <td><span class="badge ${e.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}">${e.status || 'ACTIVE'}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick='editEmployee(${JSON.stringify(e)})'>Edit</button></td>
    </tr>`).join('');
}

function filterEmployees() {
  const q  = document.getElementById('empSearch').value.toLowerCase();
  const st = document.getElementById('empStatusFilter').value;
  const si = document.getElementById('empSiteFilter').value;
  renderEmployees(S.employees.filter(e => {
    const mq = !q  || (e.name||'').toLowerCase().includes(q) || (e.empCode||'').toLowerCase().includes(q) || (e.email||'').toLowerCase().includes(q);
    const ms = !st || e.status === st;
    const mv = !si || (e.site || e.siteId || '') === si;
    return mq && ms && mv;
  }));
}

function openEmpModal() {
  S.editingEmpCode = null;
  document.getElementById('empModalTitle').textContent = 'Register Employee';
  ['eCode','eName','eEmail','ePhone','ePass'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('eCode').disabled = false;
  document.getElementById('eJoin').value    = today();
  document.getElementById('eStatus').value  = 'ACTIVE';
  showFieldErr('empModalErr', '');
  openModal('empModal');
}

function editEmployee(e) {
  S.editingEmpCode = e.empCode;
  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  document.getElementById('eCode').value    = e.empCode  || '';
  document.getElementById('eCode').disabled = true;
  document.getElementById('eName').value    = e.name     || '';
  document.getElementById('eEmail').value   = e.email    || '';
  document.getElementById('ePhone').value   = e.phone    || '';
  document.getElementById('ePass').value    = '';
  document.getElementById('eSite').value    = e.siteId   || e.site || '';
  document.getElementById('eJoin').value    = e.joinDate || today();
  document.getElementById('eStatus').value  = e.status   || 'ACTIVE';
  showFieldErr('empModalErr', '');
  openModal('empModal');
}

async function saveEmployee() {
  const empCode  = document.getElementById('eCode').value.trim().toUpperCase();
  const name     = document.getElementById('eName').value.trim().toUpperCase();
  const email    = document.getElementById('eEmail').value.trim().toLowerCase();
  const phone    = document.getElementById('ePhone').value.trim();
  const pw       = document.getElementById('ePass').value.trim();
  const siteId   = document.getElementById('eSite').value;
  const joinDate = document.getElementById('eJoin').value;
  const status   = document.getElementById('eStatus').value;

  if (!empCode || !name || !email)              { showFieldErr('empModalErr', 'Code, Name and Email are required.'); return; }
  if (!S.editingEmpCode && !pw)                 { showFieldErr('empModalErr', 'Password is required for new employees.'); return; }

  const btn = document.getElementById('btnSaveEmp');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const payload = {
      action: S.editingEmpCode ? 'updateEmployee' : 'registerEmployee',
      companySheetId: S.prefs.companySheetId,
      empCode, name, email, phone, siteId, joinDate, status,
    };
    if (pw) payload.password = await sha256(pw);
    const res = await api(payload);
    if (res.success) {
      toast(S.editingEmpCode ? 'Employee updated!' : 'Employee registered!');
      closeModal('empModal');
      document.getElementById('eCode').disabled = false;
      loadEmployees();
    } else {
      showFieldErr('empModalErr', res.message || 'Failed to save.');
    }
  } catch (e) { showFieldErr('empModalErr', 'Connection error.'); }
  btn.disabled = false; btn.textContent = 'Register';
}

/* ══════════════════════════════════════════════════════════════
   SITES
══════════════════════════════════════════════════════════════ */
async function loadSites() {
  try {
    const res = await api({ action: 'getSites', companySheetId: S.prefs.companySheetId });
    S.sites = res.success ? res.data.sites || [] : [];
    renderSites(S.sites);
    populateSiteSelects();
  } catch (e) { toast('Failed to load sites', 'error'); }
}

function renderSites(list) {
  const tb = document.getElementById('siteTableBody');
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8"><div class="empty"><p>No sites added yet</p></div></td></tr>';
    return;
  }
  tb.innerHTML = list.map(s => `
    <tr>
      <td class="mono">${s.siteId || '—'}</td>
      <td><strong>${s.siteName || '—'}</strong></td>
      <td style="font-size:.8rem;color:var(--muted);">${s.latitude || ''},${s.longitude || ''}</td>
      <td class="mono">${s.radius || '—'}m</td>
      <td style="font-size:.82rem;">${s.shiftStart || '—'} – ${s.shiftEnd || '—'}</td>
      <td style="font-size:.82rem;">${s.lunchTime || '—'}</td>
      <td><span class="badge ${(s.status || 'ACTIVE') === 'ACTIVE' ? 'badge-green' : 'badge-gray'}">${s.status || 'ACTIVE'}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick='editSite(${JSON.stringify(s)})'>Edit</button></td>
    </tr>`).join('');
}

function openSiteModal() {
  S.editingSiteId = null;
  document.getElementById('siteModalTitle').textContent = 'Add New Site';
  ['sName','sLat','sLng','sRadius','sAddr'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('sShiftS').value = '09:00';
  document.getElementById('sShiftE').value = '18:00';
  document.getElementById('sLunch').value  = '13:00';
  document.getElementById('sStatus').value = 'ACTIVE';
  showFieldErr('siteModalErr', '');
  openModal('siteModal');
}

function editSite(s) {
  S.editingSiteId = s.siteId;
  document.getElementById('siteModalTitle').textContent = 'Edit Site';
  document.getElementById('sName').value   = s.siteName  || '';
  document.getElementById('sLat').value    = s.latitude  || '';
  document.getElementById('sLng').value    = s.longitude || '';
  document.getElementById('sRadius').value = s.radius    || '';
  document.getElementById('sAddr').value   = s.address   || '';
  document.getElementById('sShiftS').value = s.shiftStart|| '09:00';
  document.getElementById('sShiftE').value = s.shiftEnd  || '18:00';
  document.getElementById('sLunch').value  = s.lunchTime || '13:00';
  document.getElementById('sStatus').value = s.status    || 'ACTIVE';
  showFieldErr('siteModalErr', '');
  openModal('siteModal');
}

async function saveSite() {
  const name       = document.getElementById('sName').value.trim().toUpperCase();
  const lat        = document.getElementById('sLat').value.trim();
  const lng        = document.getElementById('sLng').value.trim();
  const radius     = document.getElementById('sRadius').value.trim();
  const addr       = document.getElementById('sAddr').value.trim();
  const shiftStart = document.getElementById('sShiftS').value;
  const shiftEnd   = document.getElementById('sShiftE').value;
  const lunchTime  = document.getElementById('sLunch').value;
  const status     = document.getElementById('sStatus').value;

  if (!name || !lat || !lng || !radius) { showFieldErr('siteModalErr', 'Name, Lat, Lng and Radius are required.'); return; }
  try {
    const payload = {
      action: S.editingSiteId ? 'updateSite' : 'addSite',
      companySheetId: S.prefs.companySheetId,
      siteName: name, latitude: lat, longitude: lng, radius, address: addr,
      shiftStart, shiftEnd, lunchTime, status,
    };
    if (S.editingSiteId) payload.siteId = S.editingSiteId;
    const res = await api(payload);
    if (res.success) {
      toast(S.editingSiteId ? 'Site updated!' : 'Site added!');
      closeModal('siteModal');
      S.editingSiteId = null;
      loadSites();
    } else { showFieldErr('siteModalErr', res.message || 'Failed.'); }
  } catch (e) { showFieldErr('siteModalErr', 'Connection error.'); }
}

function populateSiteSelects() {
  ['empSiteFilter','eSite','attSite','rptSite'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const kept = el.querySelector('option[value=""]');
    while (el.options.length > (kept ? 1 : 0)) el.remove(kept ? 1 : 0);
    S.sites.forEach(s => {
      const o = document.createElement('option');
      o.value = s.siteId || s.siteName;
      o.textContent = s.siteName;
      el.appendChild(o);
    });
  });
  const rptEmp = document.getElementById('rptEmp');
  if (rptEmp) {
    while (rptEmp.options.length > 1) rptEmp.remove(1);
    S.employees.forEach(e => {
      const o = document.createElement('option');
      o.value = e.empCode;
      o.textContent = `${e.empCode} — ${e.name}`;
      rptEmp.appendChild(o);
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   ATTENDANCE
══════════════════════════════════════════════════════════════ */
async function loadAttendance() {
  const date = document.getElementById('attDate').value || today();
  try {
    const res = await api({ action: 'getAttendance', companySheetId: S.prefs.companySheetId, date });
    S.attRecords = res.success ? res.data.records || [] : [];
    renderAttTable(S.attRecords);
    updateAttSummary(S.attRecords);
  } catch (e) { toast('Failed to load attendance', 'error'); }
}

function filterAttTable() {
  const st = document.getElementById('attStatus').value;
  renderAttTable(st ? S.attRecords.filter(r => r.status === st) : S.attRecords);
}

function renderAttTable(list) {
  const tb = document.getElementById('attTableBody');
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="9"><div class="empty"><p>No records found for this date</p></div></td></tr>';
    return;
  }
  tb.innerHTML = list.map(r => `
    <tr>
      <td><strong>${r.name || '—'}</strong></td>
      <td class="mono">${r.empCode || '—'}</td>
      <td>${r.site || '—'}</td>
      <td class="mono" style="color:var(--success);">${r.inTime  || '—'}</td>
      <td class="mono" style="color:var(--error);" >${r.outTime || '—'}</td>
      <td><span class="badge ${r.status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${r.status || '—'}</span></td>
      <td><span class="badge ${r.locationStatus === 'INSIDE' ? 'badge-blue' : 'badge-amber'}">${r.locationStatus || '—'}</span></td>
      <td>${r.halfDay === 'YES' ? '<span class="badge badge-amber">Half</span>' : '—'}</td>
      <td style="font-size:.78rem;color:var(--muted);">${r.markedBy || '—'}</td>
    </tr>`).join('');
}

function updateAttSummary(list) {
  const present = list.filter(r => r.status === 'PRESENT').length;
  const inside  = list.filter(r => r.locationStatus === 'INSIDE').length;
  document.getElementById('attSummary').innerHTML = `
    <div class="rs-chip">Total <span>${list.length}</span></div>
    <div class="rs-chip" style="color:var(--success);">Present <span>${present}</span></div>
    <div class="rs-chip" style="color:var(--error);">Absent <span>${list.length - present}</span></div>
    <div class="rs-chip" style="color:#1565C0;">Inside Geofence <span>${inside}</span></div>`;
}

/* ══════════════════════════════════════════════════════════════
   REPORTS
══════════════════════════════════════════════════════════════ */
async function generateReport() {
  const from = document.getElementById('rptFrom').value;
  const to   = document.getElementById('rptTo').value;
  const site = document.getElementById('rptSite').value;
  const emp  = document.getElementById('rptEmp').value;
  if (!from || !to) { toast('Please select a date range', 'error'); return; }
  try {
    const res = await api({
      action: 'getAttendanceRange',
      companySheetId: S.prefs.companySheetId,
      fromDate: from, toDate: to, siteId: site, empCode: emp,
    });
    S.rptRecords = res.success ? res.data.records || [] : [];
    renderRptTable(S.rptRecords);
    const present = S.rptRecords.filter(r => r.status === 'PRESENT').length;
    document.getElementById('rptCount').textContent = `${S.rptRecords.length} records`;
    document.getElementById('rptSummary').innerHTML = `
      <div class="rs-chip">Total <span>${S.rptRecords.length}</span></div>
      <div class="rs-chip" style="color:var(--success);">Present <span>${present}</span></div>
      <div class="rs-chip" style="color:var(--error);">Absent <span>${S.rptRecords.length - present}</span></div>`;
  } catch (e) { toast('Failed to generate report', 'error'); }
}

function renderRptTable(list) {
  const tb = document.getElementById('rptTableBody');
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="9"><div class="empty"><p>No records in this date range</p></div></td></tr>';
    return;
  }
  tb.innerHTML = list.map(r => `
    <tr>
      <td class="mono">${fmtDate(r.date)}</td>
      <td><strong>${r.name || '—'}</strong></td>
      <td class="mono">${r.empCode || '—'}</td>
      <td>${r.site || '—'}</td>
      <td class="mono" style="color:var(--success);">${r.inTime  || '—'}</td>
      <td class="mono" style="color:var(--error);" >${r.outTime || '—'}</td>
      <td><span class="badge ${r.status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${r.status || '—'}</span></td>
      <td class="mono">${calcHours(r.inTime, r.outTime)}</td>
      <td style="font-size:.78rem;color:var(--muted);">${r.markedBy || '—'}</td>
    </tr>`).join('');
}

function exportCSV() {
  if (!S.rptRecords.length) { toast('Generate a report first', 'error'); return; }
  const cols = ['date','name','empCode','site','inTime','outTime','status','locationStatus','markedBy','halfDay','manualRemark'];
  const csv  = [cols.join(','), ...S.rptRecords.map(r =>
    cols.map(c => `"${(r[c] || '').toString().replace(/"/g, '""')}"`).join(',')
  )].join('\n');
  const a    = document.createElement('a');
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `AttendEase_Report_${document.getElementById('rptFrom').value}_${document.getElementById('rptTo').value}.csv`;
  a.click();
  toast('CSV exported!');
}

/* ══════════════════════════════════════════════════════════════
   MANUAL ENTRY
══════════════════════════════════════════════════════════════ */
async function submitManual() {
  const empId    = document.getElementById('mEmpId').value.trim().toUpperCase();
  const date     = document.getElementById('mDate').value;
  const checkIn  = document.getElementById('mCheckIn').value;
  const checkOut = document.getElementById('mCheckOut').value;
  const reason   = document.getElementById('mReason').value.trim();
  const resEl    = document.getElementById('manualResult');
  resEl.className = ''; resEl.style.display = 'none';

  if (!empId || !date || !checkIn) { toast('Employee ID, Date and Check-In are required', 'error'); return; }
  try {
    const res = await api({
      action: 'markAttendance', companySheetId: S.prefs.companySheetId,
      empCode: empId, date, inTime: checkIn, outTime: checkOut,
      markedBy: 'MANUAL_ADMIN', manualRemark: reason,
      locationStatus: 'MANUAL', status: 'PRESENT',
    });
    if (res.success) {
      resEl.className = 'result-ok';
      resEl.textContent = `✓ Attendance saved for ${empId} on ${fmtDate(date)}`;
      resEl.style.display = 'block';
      clearManual();
    } else {
      resEl.className = 'result-err';
      resEl.textContent = res.message || 'Failed to save.';
      resEl.style.display = 'block';
    }
  } catch (e) {
    resEl.className = 'result-err';
    resEl.textContent = 'Connection error.';
    resEl.style.display = 'block';
  }
}

function clearManual() {
  ['mEmpId','mDate','mCheckIn','mCheckOut','mReason'].forEach(id => document.getElementById(id).value = '');
}

async function submitManualModal() {
  document.getElementById('mEmpId').value    = document.getElementById('mmEmpId').value;
  document.getElementById('mDate').value     = document.getElementById('mmDate').value;
  document.getElementById('mCheckIn').value  = document.getElementById('mmIn').value;
  document.getElementById('mCheckOut').value = document.getElementById('mmOut').value;
  document.getElementById('mReason').value   = document.getElementById('mmReason').value;
  closeModal('manualModal');
  nav('manual', document.querySelectorAll('.nav-item')[6]);
  await submitManual();
}

/* ── INIT ─────────────────────────────────────────────────────── */
(function init() {
  document.getElementById('mDate').value  = today();
  document.getElementById('mmDate').value = today();
})();
