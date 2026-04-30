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

