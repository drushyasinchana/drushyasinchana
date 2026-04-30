
// ══════════════════════════════════════════════════════
// RECTIFICATIONS FUNCTIONS
// ══════════════════════════════════════════════════════

S.rectRecords = []; // Initialize storage

async function loadRectifications() {
  console.log('🔍 loadRectifications() called');
  
  // 1. Safety checks
  if (!S.clientDb) { 
    console.error('❌ S.clientDb not ready');
    toast('Database not connected', 'error'); 
    return; 
  }
  
  const dateEl = document.getElementById('rectDate');
  const siteEl = document.getElementById('rectSite');
  const tb = document.getElementById('rectTableBody');
  
  if (!dateEl || !siteEl || !tb) {
    console.error('❌ Missing HTML elements');
    return;
  }
  
  // 2. Get filter values
  if (!dateEl.value) dateEl.value = today();
  const filterDateStr = dateEl.value; // "YYYY-MM-DD"
  const filterSiteId = siteEl.value || '';
  
  console.log(`📅 Filtering → Date: ${filterDateStr} | Site: ${filterSiteId || 'ALL'}`);
  
  try {
    // 3. Fetch ALL attendance for company (no query filters to avoid index errors)
    console.log('📥 Fetching attendance from Firestore...');
    const snap = await S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    console.log(`✅ Fetched ${snap.size} total records`);
    
    if (snap.empty) {
      tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      return;
    }
    
    // 4. Parse filter date for comparison (midnight local time)
    const [fy, fm, fd] = filterDateStr.split('-').map(Number);
    const filterDate = new Date(fy, fm - 1, fd); // Month is 0-indexed
    
    // 5. Filter in JavaScript (handles Timestamp, string, or Date object)
    const filtered = [];
    
    for (const doc of snap.docs) {
      const r = doc.data();
      
      // Parse record date robustly
      let recDate = null;
      
      if (r.Date?.toDate) {
        // Firestore Timestamp
        recDate = r.Date.toDate();
      } else if (typeof r.Date === 'string') {
        // String: "YYYY-MM-DD" or "DD-MM-YYYY"
        const parts = r.Date.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            recDate = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            // DD-MM-YYYY or MM-DD-YYYY
            const [p1, p2, p3] = parts;
            if (parseInt(p1) > 12) {
              recDate = new Date(p3, p2 - 1, p1); // DD-MM-YYYY
            } else {
              recDate = new Date(p1, p2 - 1, p3); // MM-DD-YYYY fallback
            }
          }
        }
      } else if (r.Date instanceof Date) {
        recDate = r.Date;
      }
      
      // Skip if date couldn't be parsed
      if (!recDate || isNaN(recDate)) {
        console.warn('⚠️ Skipping record with invalid date:', r.EMPID, r.Date);
        continue;
      }
      
      // Compare ONLY Year, Month, Day (ignore time/timezone)
      const sameDay = 
        recDate.getFullYear() === filterDate.getFullYear() &&
        recDate.getMonth() === filterDate.getMonth() &&
        recDate.getDate() === filterDate.getDate();
      
      if (!sameDay) continue;
      
      // Site filter
      if (filterSiteId && r.SiteID !== filterSiteId && r.Site !== filterSiteId) continue;
      
      // Add to results
      filtered.push({ id: doc.id, ...r });
    }
    
    console.log(`✅ Filtered to ${filtered.length} records for display`);
    
    // 6. Sort by InTime (newest first)
    filtered.sort((a, b) => {
      const timeA = a.InTime || '00:00:00';
      const timeB = b.InTime || '00:00:00';
      return timeB.localeCompare(timeA);
    });
    
    // 7. Render
    renderRectTable(filtered);
    updateRectSummary(filtered);
    
    if (filtered.length === 0) {
      toast('No records found for selected date', 'warn');
    }
    
  } catch (e) {
    console.error('❌ Rect load error:', e);
    toast('Failed to load: ' + e.message, 'error');
    
    // Show error in table
    if (tb) {
      tb.innerHTML = `<tr><td colspan="10" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
    }
  }
}


//════════════════════════════════════════════════════
// RECTIFICATIONS - Render Table with postLunch Column
//════════════════════════════════════════════════════
function renderRectTable(list) {
  const tb = document.getElementById('rectTableBody');
  if (!tb) return;
  
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    // Status badge
    const status = r.Status || 'UNKNOWN';
    let statusClass = 'badge-gray';
    if (status === 'PRESENT') statusClass = 'badge-green';
    else if (status === 'ABSENT') statusClass = 'badge-red';
    else if (status === 'ON_LEAVE') statusClass = 'badge-amber';
    
    // Location badge
    const location = r.LocationStatus || r.Location || 'UNKNOWN';
    let locClass = 'badge-gray';
    if (location === 'INSIDE') locClass = 'badge-green';
    else if (location === 'MANUAL' || location === 'OUTSIDE') locClass = 'badge-amber';
    
    // ✅ Post-Lunch Status Badge
    const pl = r.postLunch || {};
    let plStatus = '—';
    let plClass = 'badge-gray';
    if (pl.time) {
      plStatus = pl.inside === true ? '✅ INSIDE' : '❌ OUTSIDE';
      plClass = pl.inside ? 'badge-green' : 'badge-red';
    } else {
      plStatus = '⏳ PENDING';
      plClass = 'badge-amber';
    }
    
    // ✅ Safe modal data with postLunch
    const modalData = encodeURIComponent(JSON.stringify({
      id: r.id,
      EMPID: r.EMPID,
      Name: r.Name,
      SiteID: r.SiteID || r.Site,
      InTime: r.InTime,
      OutTime: r.OutTime,
      Status: r.Status,
      LocationStatus: location,
      HalfDay: r.HalfDay || 'NO',
      Remarks: r.Remarks || '',
      Date: r.Date,
      postLunch: pl // Pass nested map
    }));
    
    return `
      <tr>
        <td><strong>${r.Name || '—'}</strong></td>                    <!-- Employee -->
        <td class="mono">${r.EMPID || '—'}</td>                       <!-- EMPID -->
        <td>${r.SiteID || r.Site || '—'}</td>                         <!-- Site -->
        <td class="mono" style="color:var(--green);">${r.InTime || '—'}</td>  <!-- In -->
        <td class="mono" style="color:var(--red);">${r.OutTime || '—'}</td>   <!-- Out -->
        <td class="mono">${calcHours(r.InTime, r.OutTime)}</td>       <!-- Hours -->
        <td><span class="badge ${statusClass}">${status}</span></td>  <!-- Status -->
        <td><span class="badge ${locClass}">${location}</span></td>   <!-- Location -->
        <td>${r.HalfDay || 'NO'}</td>                                 <!-- Half Day -->
        <td><span class="badge ${plClass}">${plStatus}</span></td>    <!-- Post-Lunch -->
        <td>
          <button class="btn btn-outline btn-sm" 
                  onclick="openRectifyModal('${modalData}')">✏️ Edit</button>
        </td>
      </tr>
    `;
  }).join('');
}
function updateRectSummary(list) {
  document.getElementById('rectTotal').textContent = list.length;
  document.getElementById('rectPresent').textContent = list.filter(x => x.Status === 'PRESENT').length;
  document.getElementById('rectAbsent').textContent = list.filter(x => x.Status === 'ABSENT').length;
  document.getElementById('rectLeave').textContent = list.filter(x => x.Status === 'ON_LEAVE').length;
}

// Modal for Editing

//════════════════════════════════════════════════════
// RECTIFICATIONS - Modal with postLunch Display
//════════════════════════════════════════════════════
function openRectifyModal(encodedData) {
  console.log('🔓 Opening modal with data');
  
  let r;
  try {
    r = JSON.parse(decodeURIComponent(encodedData));
    console.log('✅ Parsed modal data:', r);
  } catch (e) {
    console.error('❌ Modal parse error:', e);
    toast('Error loading record', 'error');
    return;
  }
  
  // Populate standard fields
  document.getElementById('rectDocId').value = r.id || '';
  document.getElementById('rectEmpName').value = r.Name || r.EMPID || '—';
  
  // Date display
  let displayDate = '—';
  if (r.Date) {
    try {
      const dt = r.Date.toDate ? r.Date.toDate() : new Date(r.Date);
      if (!isNaN(dt)) {
        displayDate = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
      }
    } catch(e) {}
  }
  document.getElementById('rectDateDisp').value = displayDate;
  
  // Other fields
  document.getElementById('rectStatus').value = r.Status || 'PRESENT';
  document.getElementById('rectLocation').value = r.LocationStatus || r.Location || 'MANUAL';
  document.getElementById('rectIn').value = r.InTime || '';
  document.getElementById('rectOut').value = r.OutTime || '';
  document.getElementById('rectHalfDay').value = r.HalfDay || 'NO';
  document.getElementById('rectRemarks').value = r.Remarks || '';
  
  // ✅ Display postLunch status (read-only in modal)
  const pl = r.postLunch || {};
  const plStatusEl = document.getElementById('rectPostLunchStatus');
  if (plStatusEl) {
    if (pl.time) {
      plStatusEl.textContent = `${pl.inside ? '✅ Inside' : '❌ Outside'} at ${pl.time}`;
      plStatusEl.style.color = pl.inside ? 'var(--green)' : 'var(--red)';
    } else {
      plStatusEl.textContent = '⏳ Not marked';
      plStatusEl.style.color = 'var(--muted)';
    }
  }
  
  showFieldErr('rectErr', '');
  openModal('attRectModal');
}

//════════════════════════════════════════════════════
// RECTIFICATIONS - Save with postLunch Support
//════════════════════════════════════════════════════
async function saveRectification() {
  const docId = document.getElementById('rectDocId').value;
  if (!docId) { toast('Error: No record ID', 'error'); return; }

  try {
    // Normalize times
    let inTime  = document.getElementById('rectIn').value;
    let outTime = document.getElementById('rectOut').value;
    if (inTime && inTime.length === 5) inTime += ':00';
    if (outTime && outTime.length === 5) outTime += ':00';

    // ✅ PAYLOAD: Core fields + preserve existing postLunch
    const payload = {
      Status:         document.getElementById('rectStatus').value,
      LocationStatus: document.getElementById('rectLocation').value,
      InTime:         inTime || null,
      OutTime:        outTime || null,
      HalfDay:        document.getElementById('rectHalfDay').value,
      // ✅ Do NOT overwrite postLunch - let Android app manage it
      // If admin needs to clear postLunch, add: 'postLunch': null
    };

    // Use .update() to touch only specified fields
    await S.clientDb.collection('attendance').doc(docId).update(payload);

    toast('✅ Record updated successfully!');
    closeModal('attRectModal');
    loadRectifications();
    
  } catch (e) {
    console.error('Rectification error:', e);
    showFieldErr('rectErr', 'Failed: ' + e.message);
  }
}

