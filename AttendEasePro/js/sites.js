// ══════════════════════════════════════════════════════
// SITES
// ══════════════════════════════════════════════════════

/**
 * Load sites from Firestore
 */
async function loadSites() {
  console.log('🔍 loadSites() called');
  
  if (!S.clientDb) { 
    console.error('❌ S.clientDb not ready');
    toast('DB not connected', 'error'); 
    return; 
  }
  
  try {
    console.log('📥 Fetching sites...');
    S.sites = await fetchSites();
    console.log(`✅ Loaded ${S.sites.length} sites`);
    renderSites(S.sites);
  } catch (e) {
    console.error('❌ Load sites error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

/**
 * Render sites list
 */
function renderSites(list) {
  const grid = document.getElementById('sitesList');
  if (!grid) return;
  
  if (!list.length) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><p>No sites found</p><button class="btn btn-teal" onclick="openSiteModal()" style="margin-top:16px;">+ Add First Site</button></div>';
    return;
  }
  
  // Table layout instead of cards
  grid.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:var(--bg);border-bottom:2px solid var(--border);">
            <th style="padding:12px;text-align:left;">Site Name</th>
            <th style="padding:12px;text-align:left;">Site ID</th>
            <th style="padding:12px;text-align:left;">Address</th>
            <th style="padding:12px;text-align:center;">Radius</th>
            <th style="padding:12px;text-align:center;">Shift</th>
            <th style="padding:12px;text-align:center;">Coordinates</th>
            <th style="padding:12px;text-align:center;">Status</th>
            <th style="padding:12px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:12px;"><strong>${s.SiteName}</strong></td>
              <td style="padding:12px;font-family:monospace;font-size:0.85rem;">${s.SiteID}</td>
              <td style="padding:12px;color:var(--muted);font-size:0.85rem;">${s.Address || '—'}</td>
              <td style="padding:12px;text-align:center;font-size:0.85rem;">${s.Radius}m</td>
              <td style="padding:12px;text-align:center;font-size:0.85rem;">${s.ShiftStart || '—'} - ${s.ShiftEnd || '—'}</td>
              <td style="padding:12px;text-align:center;font-size:0.85rem;font-family:monospace;">${s.Latitude}, ${s.Longitude}</td>
              <td style="padding:12px;text-align:center;"><span class="badge ${(s.Status||'').toUpperCase()==='ACTIVE'?'badge-green':'badge-gray'}">${s.Status||'ACTIVE'}</span></td>
              <td style="padding:12px;text-align:center;">
                <button class="btn btn-outline btn-sm" onclick='editSite(${JSON.stringify(s)})' style="margin-right:4px;">Edit</button>
                <button class="btn btn-outline btn-sm" onclick="deleteSite('${s.SiteID}')" style="color:var(--red);">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}


/**
 * Filter sites
 */
function filterSites() {
  const q = document.getElementById('siteSearch');
  const st = document.getElementById('siteStatusFilter');
  if (!q || !st) return;
  
  const qVal = q.value.toLowerCase();
  const stVal = st.value;
  
  const filtered = S.sites.filter(s => {
    const mq = !qVal || [s.SiteName, s.SiteID, s.Address].some(v => (v||'').toLowerCase().includes(qVal));
    return mq && (!stVal || s.Status === stVal);
  });
  
  renderSites(filtered);
}

/**
 * Open site modal (Add new)
 */
function openSiteModal() {
  ['sCode','sName','sLat','sLng','sRadius','sAddress'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  const sShiftStart = document.getElementById('sShiftStart');
  const sShiftEnd = document.getElementById('sShiftEnd');
  const sLunch = document.getElementById('sLunch');
  const sStatus = document.getElementById('sStatus');
  
  if (sShiftStart) sShiftStart.value = '09:00';
  if (sShiftEnd) sShiftEnd.value = '18:00';
  if (sLunch) sLunch.value = '13:00';
  if (sStatus) sStatus.value = 'ACTIVE';
  
  const title = document.getElementById('siteModalTitle');
  if (title) title.textContent = 'Add Site';
  
  showFieldErr('siteModalErr', '');
  openModal('siteModal');
}

/**
 * Edit site
 */
function editSite(s) {
  console.log('✏️ Editing site:', s.SiteID);
  
  const fields = {
    'sCode': s.SiteID, 
    'sName': s.SiteName, 
    'sLat': s.Latitude,
    'sLng': s.Longitude, 
    'sRadius': s.Radius, 
    'sAddress': s.Address || ''
  };
  
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fields[id] || '';
  });
  
  const sShiftStart = document.getElementById('sShiftStart');
  const sShiftEnd = document.getElementById('sShiftEnd');
  const sLunch = document.getElementById('sLunch');
  const sStatus = document.getElementById('sStatus');
  
  if (sShiftStart) sShiftStart.value = s.ShiftStart || '09:00';
  if (sShiftEnd) sShiftEnd.value = s.ShiftEnd || '18:00';
  if (sLunch) sLunch.value = s.LunchTime || '13:00';
  if (sStatus) sStatus.value = s.Status || 'ACTIVE';
  
  const title = document.getElementById('siteModalTitle');
  if (title) title.textContent = 'Edit Site';
  
  showFieldErr('siteModalErr', '');
  openModal('siteModal');
}

/**
 * Save site
 */
async function saveSite() {
  const siteId = document.getElementById('sCode')?.value.trim().toUpperCase();
  const name = document.getElementById('sName')?.value.trim();
  const lat = parseFloat(document.getElementById('sLat')?.value);
  const lng = parseFloat(document.getElementById('sLng')?.value);
  const radius = parseInt(document.getElementById('sRadius')?.value);
  const shiftStart = document.getElementById('sShiftStart')?.value;
  const shiftEnd = document.getElementById('sShiftEnd')?.value;
  const lunch = document.getElementById('sLunch')?.value;
  const address = document.getElementById('sAddress')?.value.trim();
  const status = document.getElementById('sStatus')?.value;
  
  if (!siteId || !name || isNaN(lat) || isNaN(lng) || !radius) {
    showFieldErr('siteModalErr', 'Site ID, Name, Latitude, Longitude and Radius are required.');
    return;
  }
  
  try {
    const payload = {
      companyId: S.prefs.companyId,
      SiteID: siteId,
      SiteName: name,
      Latitude: lat,
      Longitude: lng,
      Radius: radius,
      ShiftStart: shiftStart,
      ShiftEnd: shiftEnd,
      LunchTime: lunch,
      Address: address,
      Status: status,
      CreatedAt: new Date(),
      UpdatedAt: new Date()
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('sites').doc(siteId).set(payload);
    
    toast('Site saved successfully!');
    closeModal('siteModal');
    loadSites();
  } catch (e) {
    console.error('Save site error:', e);
    showFieldErr('siteModalErr', e.message || 'Failed to save');
  }
}

/**
 * Delete site
 */
async function deleteSite(siteId) {
  if (!confirm('Are you sure you want to delete site ' + siteId + '?')) return;
  
  try {
    await S.clientDb.collection('sites').doc(siteId).delete();
    toast('Site deleted successfully!');
    loadSites();
  } catch (e) {
    console.error('Delete site error:', e);
    toast('Failed to delete: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' || event.keyCode === 27) {
    const modals = document.querySelectorAll('.modal-backdrop.open');
    modals.forEach(m => {
      m.classList.remove('open');
      m.style.display = 'none';
    });
  }
});