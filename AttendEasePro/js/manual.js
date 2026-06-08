/* ══════════════════════════════════════════════════════
   MANUAL.JS - Manual Attendance Entry (Uniform Format)
   Ensures manual entries match Android app data structure
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   HELPER: Calculate Hours (Shared Utility)
   ── Added to fix "calcHours is not defined" error
══════════════════════════════════════════════════════ */
function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  try {
    // If already time strings (HH:mm:ss), parse directly
    if (typeof inTime === 'string' && typeof outTime === 'string') {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      const diff = (outH * 60 + outM) - (inH * 60 + inM);
      if (diff <= 0) return '—';
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h ${m}m`;
    }
    // If timestamps
    const inDate = inTime.toDate ? inTime.toDate() : new Date(inTime);
    const outDate = outTime.toDate ? outDate.toDate() : new Date(outTime);
    const diffMs = outDate - inDate;
    if (diffMs <= 0) return '—';
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  } catch(e) {
    return '—';
  }
}

/* ══════════════════════════════════════════════════════
   LOAD MANUAL ENTRY PAGE
══════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════
   POPULATE EMPLOYEE DROPDOWN BY SITE
══════════════════════════════════════════════════════ */
function onManualSiteChange() {
  const siteId = document.getElementById('mSite')?.value;
  const mEmpId = document.getElementById('mEmpId');
  if (!siteId || !mEmpId) return;
  
  const siteEmps = S.employees.filter(e => e.Site === siteId || e.SiteID === siteId);
  while (mEmpId.options.length > 1) mEmpId.remove(1);
  
  siteEmps.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.EMPID;
    opt.textContent = `${e.EMPID} — ${e.EmpName || e.Name || 'Unknown'}`;
    mEmpId.appendChild(opt);
  });
  
  // Auto-fill defaults if enabled
  if (document.getElementById('mUseDefaults')?.checked) {
    toggleManualDefaults();
  }
}

/* ══════════════════════════════════════════════════════
   TOGGLE DEFAULT TIMES FROM SITE SETTINGS
══════════════════════════════════════════════════════ */
function toggleManualDefaults() {
  const useDefaults = document.getElementById('mUseDefaults')?.checked;
  const mCheckIn = document.getElementById('mCheckIn');
  const mCheckOut = document.getElementById('mCheckOut');
  const mEmpId = document.getElementById('mEmpId');
  
  if (!useDefaults || !mCheckIn || !mCheckOut) return;
  
  const emp = S.employees.find(e => e.EMPID === mEmpId?.value);
  if (!emp || !emp.Site) return;
  
  const site = S.sites.find(s => s.SiteID === emp.Site || s.id === emp.Site);
  if (site) {
    if (mCheckIn) mCheckIn.value = site.ShiftStart || site.shiftStart || '09:00';
    if (mCheckOut) mCheckOut.value = site.ShiftEnd || site.shiftEnd || '18:00';
  }
}

/* ══════════════════════════════════════════════════════
   SUBMIT MANUAL ENTRY - UNIFORM WITH ANDROID FORMAT
══════════════════════════════════════════════════════ */
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
    // ✅ 1. Format date as DD-MM-YYYY STRING (matches Android app)
    const [y, m, d] = dateStr.split('-');
    const dateStrAndroid = `${d.padStart(2,'0')}-${m.padStart(2,'0')}-${y}`; // "02-05-2026"
    
    // ✅ 2. Doc ID format: EMPID_DD-MM-YYYY (matches Android)
    const docId = `${empId}_${dateStrAndroid}`;
    
    // ✅ 3. Date Timestamp for queries (midnight local time)
    const dateTimestamp = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    
    // ✅ 4. Normalize Times to HH:MM:SS (Android format)
    if (checkIn && checkIn.length === 5) checkIn += ':00';
    if (checkOut && checkOut.length === 5) checkOut += ':00';
    
    // ✅ 5. Current timestamp for audit
    const nowTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    
    // ✅ 6. UNIFIED PAYLOAD - Matches Android app structure exactly
    const payload = {
      companyId:      S.prefs.companyId,
      
      // ✅ KEY FIX: Date as STRING (DD-MM-YYYY) - matches Android
      Date:           dateStrAndroid,
      
      EMPID:          empId,
      HalfDay:        halfDay,
      InTime:         checkIn,
      LocationStatus: 'MANUAL',
      MarkedBy:       'ADMIN',
      Name:           empName,
      OutTime:        checkOut,
      SiteID:         siteId,
      Status:         status,
      
      // ✅ postLunch nested map - matches Android structure
      postLunch: {
        time: checkOut || null,
        latitude: null,
        longitude: null,
        inside: null,
        accuracy: null,
        timestamp: nowTimestamp
      },
      
      // Audit fields
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    
    // Save with merge:true to allow app to update postLunch later
    await S.clientDb.collection('attendance').doc(docId).set(payload, { merge: true });
    
    toast('✅ Manual attendance saved successfully!');
    clearManual();
    
    // Refresh dependent views
    if (typeof loadRectifications === 'function') await loadRectifications();
    if (typeof loadAttendance === 'function') await loadAttendance();
    
  } catch (e) {
    console.error('Manual entry error:', e);
    toast('Failed to save: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════
   CLEAR MANUAL FORM
══════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════
   UTILITY: Get today's date in YYYY-MM-DD format
══════════════════════════════════════════════════════ */
function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}