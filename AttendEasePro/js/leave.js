/* ══════════════════════════════════════════════════════
   LEAVE.JS - Leave Entry Module
   Dependencies: core.js (S, toast, today, fmtDate), 
                 employees.js (loadEmployees), 
                 sites.js (loadSites, populateSiteSelects)
   Creates attendance records with Status = leave type
   ══════════════════════════════════════════════════════ */

/**
 * Initializes the Leave Entry page
 * Loads employees, sites, and sets default dates
 */
async function loadLeave() {
  console.log('🔍 loadLeave() called');
  
  if (!S.clientDb) { 
    toast('DB not connected', 'error'); 
    return; 
  }
  
  try {
    // Load dependencies
    await loadEmployees();
    await loadSites();
    populateSiteSelects();
    
    // Set default dates to today
    const leaveFrom = document.getElementById('leaveFrom');
    const leaveTo = document.getElementById('leaveTo');
    if (leaveFrom) leaveFrom.value = today();
    if (leaveTo) leaveTo.value = today();
    
    console.log('✅ Leave page initialized');
    
  } catch (e) {
    console.error('❌ Load leave error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

/**
 * Filters employee dropdown based on selected site
 * Called when site dropdown changes in leave form
 */
function onLeaveSiteChange() {
  const siteId = document.getElementById('leaveSite')?.value;
  const leaveEmpId = document.getElementById('leaveEmpId');
  
  if (!siteId || !leaveEmpId) return;
  
  // Filter employees by site
  const siteEmps = S.employees.filter(e => e.Site === siteId);
  
  // Clear existing options (keep placeholder)
  while (leaveEmpId.options.length > 1) leaveEmpId.remove(1);
  
  // Populate with site employees
  siteEmps.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.EMPID;
    opt.textContent = `${e.EMPID} — ${e.EmpName}`;
    leaveEmpId.appendChild(opt);
  });
  
  console.log(`✅ Loaded ${siteEmps.length} employees for site ${siteId}`);
}

/**
 * Submits leave application - creates attendance records for date range
 * Each day in range gets a separate record with Status = leave type
 */
async function submitLeave() {
  const empId = document.getElementById('leaveEmpId')?.value;
  const fromDate = document.getElementById('leaveFrom')?.value;
  const toDate = document.getElementById('leaveTo')?.value;
  const leaveType = document.getElementById('leaveType')?.value;
  const reason = document.getElementById('leaveReason')?.value.trim();
  
  // Validation
  if (!empId || !fromDate || !toDate || !leaveType) {
    toast('Employee, From Date, To Date and Leave Type are required', 'error');
    return;
  }
  
  // Verify employee exists
  const emp = S.employees.find(e => e.EMPID === empId);
  if (!emp) {
    toast('Employee not found', 'error');
    return;
  }
  
  try {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    // Calculate number of days (inclusive)
    const timeDiff = Math.abs(endDate - startDate);
    const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    
    let createdCount = 0;
    
    // Create attendance record for each day in range
    for (let i = 0; i < dayDiff; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Format date for document ID: DD-MM-YYYY (matches Android app)
      const day = String(currentDate.getDate()).padStart(2, '0');
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();
      const docId = `${empId}_${day}-${month}-${year}`;
      
      const payload = {
        companyId: S.prefs.companyId,
        EMPID: empId,
        Name: emp.EmpName,
        SiteID: emp.Site,
        Date: currentDate,  // Firestore Timestamp
        InTime: null,
        OutTime: null,
        Status: leaveType,  // e.g., "ON_LEAVE", "SICK_LEAVE"
        LocationStatus: 'LEAVE',
        HalfDay: 'NO',
        MarkedBy: 'ADMIN',
        ManualRemark: `${leaveType} - ${reason}`,
        CreatedAt: new Date()
      };
      
      await S.clientDb.collection('attendance').doc(docId).set(payload);
      createdCount++;
    }
    
    // Success feedback
    toast(`✅ Leave application saved for ${createdCount} day(s)!`);
    document.getElementById('leaveResult').innerHTML = 
      `<div class="result-ok">✓ Leave records created for ${empId} from ${fmtDate(fromDate)} to ${fmtDate(toDate)}</div>`;
    
    clearLeave();
    
  } catch (e) {
    console.error('❌ Leave entry error:', e);
    document.getElementById('leaveResult').innerHTML = 
      `<div class="result-err">Error: ${e.message}</div>`;
  }
}

/**
 * Clears the leave form and resets to defaults
 */
function clearLeave() {
  // Clear text fields
  ['leaveReason'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  // Reset dates to today
  const leaveFrom = document.getElementById('leaveFrom');
  const leaveTo = document.getElementById('leaveTo');
  if (leaveFrom) leaveFrom.value = today();
  if (leaveTo) leaveTo.value = today();
  
  console.log('🧹 Leave form cleared');
}