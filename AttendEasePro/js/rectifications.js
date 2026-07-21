/* ══════════════════════════════════════════════════════
RECTIFICATIONS.JS - Clean Fixed Version (No Duplicates)
══════════════════════════════════════════════════════ */

// Load Rectifications with Site Filtering
async function loadRectifications() {
  console.log('🔍 loadRectifications() triggered');
  
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  
  // 1. Load Sites if not already loaded
  if (!S.sites || S.sites.length === 0) {
    try {
      const snap = await S.clientDb.collection('sites').where('companyId', '==', S.prefs.companyId).get();
      S.sites = snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch (e) { console.error('Site load failed', e); }
  }

  // 2. Load Employees if not already loaded
  if (!S.employees || S.employees.length === 0) {
    try {
      const snap = await S.clientDb.collection('employees').where('companyId', '==', S.prefs.companyId).get();
      S.employees = snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch (e) { console.error('Employee load failed', e); }
  }

  // 3. Populate Site Dropdowns
  if (typeof populateSiteSelects === 'function') {
    populateSiteSelects();
  }

  // 4. Get Filters
  const dateStr = document.getElementById('rectDate')?.value || today();
  const siteId = document.getElementById('rectSite')?.value || '';
  
  if (!dateStr) {
    document.getElementById('rectTableBody').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;">Select a date</td></tr>';
    return;
  }

  try {
    // Fetch Attendance
    let records = await fetchAttendance(dateStr);
    
    // ✅ Apply Site Filter
    if (siteId) {
      records = records.filter(r => r.SiteID === siteId);
    }

    // Enrich with Names
    records.forEach(r => {
      const emp = S.employees.find(e => e.EMPID === r.EMPID);
      r.Name = emp ? emp.EmpName : r.Name || r.EMPID;
    });

    renderRectifications(records);
    updateRectSummary(records);

  } catch (e) {
    console.error(e);
    toast('Error loading rectifications', 'error');
  }
}

// Render Rectifications Table
function renderRectifications(list) {
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;
  
  if (!list || list.length === 0) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;">No records found</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    // Create a clean object with ALL fields
    const recordData = {
      id: r.id,  // ✅ Critical: Must have document ID
      EMPID: r.EMPID,
      Name: r.Name || r.EmpName || 'Unknown',
      Date: r.Date,
      Status: r.Status,
      LocationStatus: r.LocationStatus,
      InTime: r.InTime,
      OutTime: r.OutTime,
      HalfDay: r.HalfDay,
      Remarks: r.Remarks || '',
      SiteID: r.SiteID
    };
    
    // Stringify to pass to onclick
    const rStr = JSON.stringify(recordData);
    
    return `
    <tr>
      <td>${recordData.Name}</td>
      <td class="mono">${recordData.EMPID}</td>
      <td>${r.SiteID}</td>
      <td class="mono">${recordData.InTime || '—'}</td>
      <td class="mono">${recordData.OutTime || '—'}</td>
      <td class="mono">${calcHours(recordData.InTime, recordData.OutTime)}</td>
      <td><span class="badge ${recordData.Status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${recordData.Status || '—'}</span></td>
      <td>${recordData.LocationStatus || '—'}</td>
      <td>${recordData.HalfDay || 'NO'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='openRectifyModal(${rStr})'>Edit</button>
      </td>
    </tr>`;
  }).join('');
}


// ✅ FIXED: Open Modal - With Debug Logging
function openRectifyModal(record) {
  console.log('📦 Opening modal with record:', record);
  
  if (!record) {
    toast('Error: No data passed to modal', 'error');
    return;
  }
  
  if (!record.id) {
    console.error('❌ record.id is undefined!');
    toast('Error: Record ID missing', 'error');
    return;
  }

  // Helper to safely set values
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = value || '';
      console.log(`✅ Set #${id} to:`, value);
    } else {
      console.warn(`️ Element #${id} not found`);
    }
  };

  // Set values - Employee field shows "Name (EMPID)"
  setVal('rectDocId', record.id);
  setVal('rectEmpId', `${record.Name} (${record.EMPID})`);  // ✅ Show both Name and ID
  setVal('rectDateDisp', record.Date);
  setVal('rectStatus', record.Status || 'PRESENT');
  setVal('rectLocation', record.LocationStatus || 'INSIDE');  // ✅ Will match VERIFIED now
  setVal('rectIn', record.InTime || '');
  setVal('rectOut', record.OutTime || '');
  setVal('rectHalfDay', record.HalfDay || 'NO');
  setVal('rectRemarks', record.Remarks || '');

  openModal('attRectModal');
}

// ✅ FIXED: Save Rectification - Matches HTML IDs exactly (SINGLE VERSION)
async function saveRectification() {
  // Get the document ID from the hidden field
  const docId = document.getElementById('rectDocId')?.value;
  
  if (!docId) {
    toast('Error: No Record ID found', 'error');
    console.error('rectDocId is empty!');
    return;
  }

  // Collect updated values from the form using correct IDs
  const updatedData = {
    Status: document.getElementById('rectStatus')?.value,
    LocationStatus: document.getElementById('rectLocation')?.value,
    InTime: document.getElementById('rectIn')?.value,      // ✅ rectIn (not rectInTime)
    OutTime: document.getElementById('rectOut')?.value,    // ✅ rectOut (not rectOutTime)
    HalfDay: document.getElementById('rectHalfDay')?.value,
    Remarks: document.getElementById('rectRemarks')?.value,
    UpdatedAt: new Date()
  };

  try {
    // Update Firestore document using the ID we stored
    console.log('💾 Saving updates to doc:', docId);
    await S.clientDb.collection('attendance').doc(docId).update(updatedData);
    
    toast('✅ Record updated successfully!', 'success');
    closeModal('attRectModal');  // ✅ Correct modal ID
    
    // Refresh the table
    loadRectifications();
    
  } catch (e) {
    console.error('💥 Save error:', e);
    toast('Error: ' + e.message, 'error');
  }
}

// Update Rectification Summary (SINGLE VERSION)
function updateRectSummary(list) {
  const present = list?.filter(r => r.Status === 'PRESENT').length || 0;
  const absent = list?.filter(r => r.Status === 'ABSENT').length || 0;
  const leave = list?.filter(r => r.Status === 'ON_LEAVE').length || 0;
  
  const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  
  setTxt('rectTotal', list.length);
  setTxt('rectPresent', present);
  setTxt('rectAbsent', absent);
  setTxt('rectLeave', leave);
}

// Calculate Hours Helper (SINGLE VERSION)
function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  const [h1, m1] = inTime.split(':').map(Number);
  const [h2, m2] = outTime.split(':').map(Number);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff <= 0) return '—';
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}