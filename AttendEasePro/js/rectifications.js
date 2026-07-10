/* ══════════════════════════════════════════════════════
LOAD RECTIFICATIONS - FIXED Date Parsing (DD-MM-YYYY)
══════════════════════════════════════════════════════ */
async function loadRectifications() {
  console.log(' loadRectifications() triggered');
  
  if (!S?.clientDb) { toast('DB not connected', 'error'); return; }
  const companyId = S.prefs?.companyId;
  if (!companyId) { toast('Company context missing', 'error'); return; }
  
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;

  // Load employees for enrichment
  try {
    const empSnap = await S.clientDb.collection('employees')
      .where('companyId', '==', companyId)
      .get();
    S.employees = empSnap.docs.map(d => d.data());
  } catch (e) { console.error('❌ Employee load failed:', e); }

  // Get filter date
  const dateEl = document.getElementById('rectDate');
  const filterDateStr = dateEl?.value || today();
  
  // Parse filter date (YYYY-MM-DD from HTML input)
  const fParts = filterDateStr.split('-');
  currentFilterDate = new Date(
    parseInt(fParts[0], 10),
    parseInt(fParts[1], 10) - 1,
    parseInt(fParts[2], 10)
  );
  currentFilterDate.setHours(0, 0, 0, 0);
  console.log('📅 Parsed Filter Date:', currentFilterDate);

  try {
    const attSnap = await S.clientDb.collection('attendance')
      .where('companyId', '==', companyId)
      .get();
    
    console.log(`✅ Fetched ${attSnap.size} total records`);

    if (attSnap.empty) {
      tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      updateRectSummary([]);
      return;
    }
    
    const filtered = [];
    
    for (const doc of attSnap.docs) {
      const r = doc.data();
      
      // ✅ FIXED: Robust Date Parsing (DD-MM-YYYY for Android)
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
            // DD-MM-YYYY format (Android App)
            // parts[0] is Day, parts[1] is Month, parts[2] is Year
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
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
      
      // Enrich with employee data
      const emp = S.employees?.find(e => e.EMPID === r.EMPID);
      const enriched = {
        id: doc.id,
        ...r,
        Name: (emp?.EmpName || emp?.Name || r.Name || r.EMPID || '—').trim(),
        Photo: emp?.Photo || emp?.photoUrl || null
      };
      
      filtered.push(enriched);
    }
    
    console.log(`✅ Filtered to ${filtered.length} records for display`);

    if (filtered.length === 0) {
      tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    } else {
      renderRectTable(filtered);
    }

    updateRectSummary(filtered);

  } catch (e) {
    console.error('❌ Error:', e);
    tb.innerHTML = `<tr><td colspan="11" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
  }
}

/* ══════════════════════════════════════════════════════
RENDER RECTIFICATIONS TABLE
══════════════════════════════════════════════════════ */
function renderRectTable(list) {
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;
  
  if (!list || list.length === 0) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);">No records for this date</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    const status = r.Status || 'UNKNOWN';
    const statusClass = status === 'PRESENT' ? 'badge-green' : status === 'ABSENT' ? 'badge-red' : status === 'ON_LEAVE' ? 'badge-blue' : 'badge-gray';
    const loc = r.LocationStatus || 'UNKNOWN';
    const locClass = loc === 'INSIDE' || loc === 'VERIFIED' ? 'badge-blue' : 'badge-amber';
    const name = (r.Name || '—').trim();
    const id = r.EMPID || '—';
    const site = r.SiteID || '—';
    
    return `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:10px;vertical-align:middle;"><strong>${name}</strong></td>
      <td class="mono" style="padding:10px;vertical-align:middle;">${id}</td>
      <td style="padding:10px;vertical-align:middle;">${site}</td>
      <td class="mono" style="padding:10px;color:var(--green);vertical-align:middle;">${r.InTime || '—'}</td>
      <td class="mono" style="padding:10px;color:var(--red);vertical-align:middle;">${r.OutTime || '—'}</td>
      <td class="mono" style="padding:10px;vertical-align:middle;">${calcHours(r.InTime, r.OutTime)}</td>
      <td style="padding:10px;vertical-align:middle;"><span class="badge ${statusClass}">${status}</span></td>
      <td style="padding:10px;vertical-align:middle;"><span class="badge ${locClass}">${loc}</span></td>
      <td style="padding:10px;vertical-align:middle;">${r.HalfDay || 'NO'}</td>
      <td style="padding:10px;vertical-align:middle;">
        <button class="btn btn-outline btn-sm" onclick='openRectifyModal(${JSON.stringify(r).replace(/"/g, '&quot;')})'>✏️ Rectify</button>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
UPDATE RECTIFICATION SUMMARY
══════════════════════════════════════════════════════ */
function updateRectSummary(list) {
  const present = list?.filter(r => r.Status === 'PRESENT').length || 0;
  const absent = list?.filter(r => r.Status === 'ABSENT').length || 0;
  const leave = list?.filter(r => r.Status === 'ON_LEAVE').length || 0;
  
  const elTotal = document.getElementById('rectTotal');
  const elPresent = document.getElementById('rectPresent');
  const elAbsent = document.getElementById('rectAbsent');
  const elLeave = document.getElementById('rectLeave');
  
  if (elTotal) elTotal.textContent = list?.length || 0;
  if (elPresent) elPresent.textContent = present;
  if (elAbsent) elAbsent.textContent = absent;
  if (elLeave) elLeave.textContent = leave;
}

/* ══════════════════════════════════════════════════════
OPEN RECTIFY MODAL
══════════════════════════════════════════════════════ */
function openRectifyModal(r) {
  document.getElementById('rectEmpId').value = r.EMPID || '';
  document.getElementById('rectEmpName').textContent = r.Name || r.EMPID || '—';
  document.getElementById('rectDate').value = r.Date || today();
  document.getElementById('rectStatus').value = r.Status || 'PRESENT';
  document.getElementById('rectLocation').value = r.LocationStatus || 'INSIDE';
  document.getElementById('rectInTime').value = r.InTime || '';
  document.getElementById('rectOutTime').value = r.OutTime || '';
  document.getElementById('rectHalfDay').value = r.HalfDay || 'NO';
  document.getElementById('rectRemarks').value = r.Remarks || '';
  
  // Store original doc ID for update
  document.getElementById('rectDocId').value = r.id || '';
  
  openModal('rectifyModal');
}

/* ══════════════════════════════════════════════════════
SAVE RECTIFICATION
══════════════════════════════════════════════════════ */
async function saveRectification() {
  const docId = document.getElementById('rectDocId').value;
  const empId = document.getElementById('rectEmpId').value;
  const date = document.getElementById('rectDate').value;
  const status = document.getElementById('rectStatus').value;
  const location = document.getElementById('rectLocation').value;
  const inTime = document.getElementById('rectInTime').value;
  const outTime = document.getElementById('rectOutTime').value;
  const halfDay = document.getElementById('rectHalfDay').value;
  const remarks = document.getElementById('rectRemarks').value;
  
  if (!empId || !date) {
    toast('Employee ID and Date are required', 'error');
    return;
  }
  
  try {
    const payload = {
      Status: status,
      LocationStatus: location,
      InTime: inTime,
      OutTime: outTime,
      HalfDay: halfDay,
      Remarks: remarks,
      RectifiedBy: 'ADMIN',
      RectifiedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
    
    if (docId) {
      // Update existing record
      await S.clientDb.collection('attendance').doc(docId).update(payload);
      toast('✅ Record rectified successfully!');
    } else {
      // Create new record (shouldn't happen in rectifications)
      toast('No record ID found', 'error');
      return;
    }
    
    closeModal('rectifyModal');
    loadRectifications();
    
  } catch (e) {
    console.error('Save rectification error:', e);
    toast('Error: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════
CALCULATE HOURS (Helper)
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