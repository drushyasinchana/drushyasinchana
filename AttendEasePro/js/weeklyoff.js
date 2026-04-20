/* ══════════════════════════════════════════════════════
   WEEKLYOFF.JS - Weekly Off Configuration Module
   Dependencies: core.js (S, fmtDate, toast, showFieldErr, openModal, closeModal)
   ══════════════════════════════════════════════════════ */

/**
 * Loads weekly off configurations for the current company
 * Called when user navigates to Weekly Off tab
 */
async function loadWeeklyOff() {
  console.log('🔍 loadWeeklyOff() called');
  
  if (!S.clientDb) { 
    toast('DB not connected', 'error'); 
    return; 
  }
  
  try {
    // Load sites first if not already loaded
    if (S.sites.length === 0) {
      const siteSnap = await S.clientDb.collection('sites')
        .where('companyId', '==', S.prefs.companyId)
        .get();
      S.sites = siteSnap.docs.map(d => ({id:d.id,...d.data()}));
    }
    
    // Fetch weekly offs
    const snap = await S.clientDb.collection('weekly_offs')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    const weeklyOffs = snap.docs.map(d => ({id:d.id,...d.data()}));
    
    // Find table
    const tb = document.getElementById('weeklyOffTableBody');
    if (!tb) {
      console.error('❌ [WeeklyOff] Table body not found!');
      return;
    }
    
    // Render
    if (!weeklyOffs.length) {
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No weekly off configurations found. Click "Add Weekly Off" to create one.</td></tr>';
      return;
    }
    
    tb.innerHTML = weeklyOffs.map(wo => {
      const site = S.sites.find(s => s.SiteID === wo.SiteID);
      return `
      <tr>
        <td class="mono">${wo.SiteID || '—'}</td>
        <td><strong>${site ? site.SiteName : wo.SiteName || '—'}</strong></td>
        <td>${wo.WeeklyOff1 || '—'}</td>
        <td>${wo.WeeklyOff2 || 'None'}</td>
        <td class="mono">${fmtDate(wo.EffectiveFrom)}</td>
        <td>${wo.Remarks || '—'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='editWeeklyOff(${JSON.stringify(wo)})'>Edit</button>
          <button class="btn btn-outline btn-sm" onclick="deleteWeeklyOff('${wo.SiteID}')" style="color:var(--red);margin-left:4px;">Delete</button>
        </td>
      </tr>`;
    }).join('');
    
    console.log(`✅ Loaded ${weeklyOffs.length} weekly off configs`);
    
  } catch (e) {
    console.error('❌ [WeeklyOff] Error:', e);
    toast('Failed to load: ' + e.message, 'error');
  }
}

/**
 * Populates the site dropdown in the Weekly Off modal
 */
function populateWoSiteSelect() {
  const woSite = document.getElementById('woSite');
  if (!woSite) return;

  // Clear existing options except the first placeholder
  while (woSite.options.length > 1) woSite.remove(1);

  // Add actual sites from the database
  S.sites.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.SiteID;
    opt.textContent = `${s.SiteID} — ${s.SiteName}`;
    woSite.appendChild(opt);
  });
}

/**
 * Opens the Weekly Off modal in "Add" mode
 */
function openWeeklyOffModal() {
  // Clear form
  document.getElementById('woSite').value = '';
  document.getElementById('woDay1').value = 'Sunday';
  document.getElementById('woDay2').value = 'None';
  document.getElementById('woEffDate').value = today();
  document.getElementById('woRemarks').value = '';
  
  // Populate sites
  populateWoSiteSelect();
  
  // Set title
  document.getElementById('weeklyOffModalTitle').textContent = 'Add Weekly Off Config';
  showFieldErr('weeklyOffModalErr', '');
  
  openModal('weeklyOffModal');
}

/**
 * Opens the Weekly Off modal in "Edit" mode with existing data
 * @param {Object} wo - Weekly off configuration object
 */
function editWeeklyOff(wo) {
  // ✅ FIX: Populate sites FIRST before setting values
  populateWoSiteSelect();
  
  // Small delay to ensure options are loaded
  setTimeout(() => {
    // Now set the site value
    const woSite = document.getElementById('woSite');
    if (woSite && wo.SiteID) {
      woSite.value = wo.SiteID;
      console.log('Site set to:', wo.SiteID);
    }
  }, 100);
  
  // Set other fields
  document.getElementById('woDay1').value = wo.WeeklyOff1 || 'Sunday';
  document.getElementById('woDay2').value = wo.WeeklyOff2 || 'None';
  
  // Convert date for input (yyyy-mm-dd)
  let effDateStr = '';
  if (wo.EffectiveFrom) {
    const dt = wo.EffectiveFrom.toDate ? wo.EffectiveFrom.toDate() : new Date(wo.EffectiveFrom);
    if (!isNaN(dt)) {
      effDateStr = dt.toISOString().split('T')[0];
    }
  }
  document.getElementById('woEffDate').value = effDateStr || today();
  
  document.getElementById('woRemarks').value = wo.Remarks || '';
  
  // Set title
  document.getElementById('weeklyOffModalTitle').textContent = 'Edit Weekly Off Config';
  showFieldErr('weeklyOffModalErr', '');
  
  openModal('weeklyOffModal');
}

/**
 * Saves weekly off configuration (Add or Edit)
 */
async function saveWeeklyOff() {
  const woSite = document.getElementById('woSite')?.value;
  const woDay1 = document.getElementById('woDay1')?.value;
  const woDay2 = document.getElementById('woDay2')?.value;
  const woEffDate = document.getElementById('woEffDate')?.value;
  const woRemarks = document.getElementById('woRemarks')?.value.trim();
  
  // Validation
  if (!woSite || !woDay1 || !woEffDate) {
    showFieldErr('weeklyOffModalErr', 'Site, Weekly Off Day 1 and Effective From are required.');
    return;
  }
  
  try {
    const effDate = new Date(woEffDate);
    
    const payload = {
      companyId: S.prefs.companyId,
      SiteID: woSite,
      WeeklyOff1: woDay1,
      WeeklyOff2: woDay2,
      EffectiveFrom: effDate,
      Remarks: woRemarks,
      CreatedAt: new Date(),
      UpdatedAt: new Date()
    };
    
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('weekly_offs').doc(woSite).set(payload);
    
    toast('✅ Weekly off configuration saved successfully!');
    closeModal('weeklyOffModal');
    loadWeeklyOff();
    
  } catch (e) {
    console.error('❌ [WeeklyOff] Save error:', e);
    showFieldErr('weeklyOffModalErr', e.message || 'Failed to save');
  }
}

/**
 * Deletes a weekly off configuration
 * @param {string} siteId - Site ID to delete config for
 */
async function deleteWeeklyOff(siteId) {
  if (!confirm('Are you sure you want to delete weekly off config for ' + siteId + '?')) return;
  
  try {
    if (!S.clientDb) throw new Error('Database not connected');
    await S.clientDb.collection('weekly_offs').doc(siteId).delete();
    
    toast('✅ Weekly off configuration deleted successfully!');
    loadWeeklyOff();
    
  } catch (e) {
    console.error('❌ [WeeklyOff] Delete error:', e);
    toast('Failed to delete: ' + e.message, 'error');
  }
}