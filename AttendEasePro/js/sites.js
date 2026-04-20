
// ══════════════════════════════════════════════════════
// SITES
// ══════════════════════════════════════════════════════
async function loadSites() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    S.sites = await fetchSites();
    renderSites(S.sites);
  } catch (e) {
    console.error('Load sites error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

function renderSites(list) {
  const grid = document.getElementById('sitesList');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="empty"><p>No sites found</p></div>';
    return;
  }
  grid.innerHTML = list.map(s => `
    <div class="site-card">
      <div class="site-card-bar" style="background:${s.Status==='ACTIVE'?'var(--green)':'var(--red)'}"></div>
      <div class="site-card-name">${s.SiteName}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:8px;">
        ID: ${s.SiteID}<br>
        Radius: ${s.Radius}m<br>
        Shift: ${s.ShiftStart} - ${s.ShiftEnd}<br>
        Address: ${s.Address || '—'}<br>
        Lat/Lng: ${s.Latitude}, ${s.Longitude}
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick='editSite(${JSON.stringify(s)})'>Edit</button>
        <button class="btn btn-outline btn-sm" onclick="deleteSite('${s.SiteID}')" style="color:var(--red);">Delete</button>
      </div>
    </div>
  `).join('');
}

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

function editSite(s) {
  const fields = {
    'sCode': s.SiteID, 'sName': s.SiteName, 'sLat': s.Latitude,
    'sLng': s.Longitude, 'sRadius': s.Radius, 'sAddress': s.Address || ''
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
   KEYBOARD SHORTCUTS (Escape Key)
   ══════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' || event.keyCode === 27) {
    // Close all open modals
    const modals = document.querySelectorAll('.modal-backdrop.open');
    modals.forEach(m => {
      m.classList.remove('open');
      m.style.display = 'none';
    });
  }
});