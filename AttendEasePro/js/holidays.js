/* ══════════════════════════════════════════════════════
   HOLIDAYS.JS - Holiday Master Module
   Dependencies: core.js (S, fmtDate, toast, showFieldErr, openModal, closeModal, today)
   ══════════════════════════════════════════════════════ */

/**
 * Loads holiday configurations for the current company
 * Called when user navigates to Holidays tab
 */
async function loadHolidays() {
  console.log('🔍 loadHolidays() called');
  
  if (!S.clientDb) { 
    toast('DB not connected', 'error'); 
    return; 
  }
  
  try {
    const snap = await S.clientDb.collection('holidays')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    S.holidays = snap.docs.map(d => ({id: d.id, ...d.data()}));
    renderHolidays(S.holidays);
    
    console.log(`✅ Loaded ${S.holidays.length} holidays`);
    
  } catch (e) {
    console.error('❌ Load holidays error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

/**
 * Renders holiday list into the table body
 * @param {Array} list - Array of holiday objects
 */
function renderHolidays(list) {
  const tb = document.getElementById('holidaysTableBody');
  if (!tb) return;
  
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--muted);">No holidays found. Click "Add Holiday" to create one.</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(h => `
    <tr>
      <td>${h.HolidayID || '—'}</td>
      <td class="mono">${fmtDate(h.Date)}</td>
      <td><strong>${h.HolidayName || '—'}</strong></td>
      <td>${h.Type || '—'}</td>
      <td>${h.Day || '—'}</td>
      <td>${h.ApplicableSites || 'ALL'}</td>
      <td>${h.State || 'ALL'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='editHoliday(${JSON.stringify(h)})'>Edit</button>
        <button class="btn btn-outline btn-sm" onclick="deleteHoliday('${h.HolidayID}')" style="color:var(--red);margin-left:4px;">Delete</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Filters holidays by search query and type
 * Called on input change in filter bar
 */
function filterHolidays() {
  const q = document.getElementById('holidaySearch');
  const type = document.getElementById('holidayTypeFilter');
  if (!q || !type) return;
  
  const qVal = q.value.toLowerCase();
  const typeVal = type.value;
  
  const filtered = S.holidays.filter(h => {
    const matchQuery = !qVal || [h.HolidayName, h.HolidayID].some(v => (v || '').toLowerCase().includes(qVal));
    const matchType = !typeVal || h.Type === typeVal;
    return matchQuery && matchType;
  });
  
  renderHolidays(filtered);
}

/**
 * Opens the Holiday modal in "Add" mode
 */
function openHolidayModal() {
  // Clear text fields
  ['hCode', 'hName', 'hState', 'hDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  // Set defaults for selects and date
  const hDate = document.getElementById('hDate');
  const hType = document.getElementById('hType');
  const hDay = document.getElementById('hDay');
  const hSites = document.getElementById('hSites');
  
  if (hDate) hDate.value = today();
  if (hType) hType.value = 'National Holiday';
  if (hSites) hSites.value = 'ALL';
  
  // Update modal title and open
  const title = document.getElementById('holidayModalTitle');
  if (title) title.textContent = 'Add Holiday';
  
  showFieldErr('holidayModalErr', '');
  openModal('holidayModal');
}

/**
 * Opens the Holiday modal in "Edit" mode with existing data
 * @param {Object} h - Holiday object
 */
function editHoliday(h) {
  // Fill text fields
  const fields = {
    'hCode': h.HolidayID,
    'hName': h.HolidayName,
    'hState': h.State || '',
    'hDesc': h.Description || ''
  };
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fields[id] || '';
  });
  
  // Set selects and date
  const hDate = document.getElementById('hDate');
  const hType = document.getElementById('hType');
  const hDay = document.getElementById('hDay');
  const hSites = document.getElementById('hSites');
  
  if (hDate) {
    // Convert Firestore date to YYYY-MM-DD for input
    const dt = h.Date?.toDate ? h.Date.toDate() : new Date(h.Date);
    if (!isNaN(dt)) {
      hDate.value = dt.toISOString().split('T')[0];
    }
  }
  if (hType) hType.value = h.Type || 'National Holiday';
  if (hDay) hDay.value = h.Day || '';
  if (hSites) hSites.value = h.ApplicableSites || 'ALL';
  
  // Update modal title and open
  const title = document.getElementById('holidayModalTitle');
  if (title) title.textContent = 'Edit Holiday';
  
  showFieldErr('holidayModalErr', '');
  openModal('holidayModal');
}

/**
 * Saves holiday configuration (Add or Edit)
 */
async function saveHoliday() {
  const hCode = document.getElementById('hCode')?.value.trim().toUpperCase();
  const hName = document.getElementById('hName')?.value.trim();
  const hDate = document.getElementById('hDate')?.value;
  const hType = document.getElementById('hType')?.value;
  const hDay = document.getElementById('hDay')?.value;
  const hSites = document.getElementById('hSites')?.value;
  const hState = document.getElementById('hState')?.value.trim();
  const hDesc = document.getElementById('hDesc')?.value.trim();
  
  // Validation
  if (!hCode || !hName || !hDate) {
    showFieldErr('holidayModalErr', 'Holiday ID, Name and Date are required.');
    return;
  }
  
  try {
    const payload = {
      companyId: S.prefs.companyId,
      HolidayID: hCode,
      HolidayName: hName,
      Date: new Date(hDate),
      Type: hType,
      Day: hDay,
      ApplicableSites: hSites,
      State: hState,
      Description: hDesc,
      CreatedAt: new Date(),
      UpdatedAt: new Date()
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('holidays').doc(hCode).set(payload);
    
    toast('✅ Holiday saved successfully!');
    closeModal('holidayModal');
    loadHolidays();
    
  } catch (e) {
    console.error('❌ Save holiday error:', e);
    showFieldErr('holidayModalErr', e.message || 'Failed to save');
  }
}

/**
 * Deletes a holiday configuration
 * @param {string} holidayId - Holiday ID to delete
 */
async function deleteHoliday(holidayId) {
  if (!confirm('Are you sure you want to delete holiday ' + holidayId + '?')) return;
  
  try {
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('holidays').doc(holidayId).delete();
    
    toast('✅ Holiday deleted successfully!');
    loadHolidays();
    
  } catch (e) {
    console.error('❌ Delete holiday error:', e);
    toast('Failed to delete: ' + e.message, 'error');
  }
}