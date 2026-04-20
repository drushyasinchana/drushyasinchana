/* ══════════════════════════════════════════════════════
   POSTLUNCH.JS - Post-Lunch Geo-Tracking Module
   Dependencies: S, toast, today, fmtDate (from manage.js)
   ══════════════════════════════════════════════════════ */

/**
 * Initializes the Post-Lunch Tracking page
 * Called by nav() when user clicks "Post-Lunch Tracking"
 */
// Initialize Post-Lunch Tracking page on load
async function initLunchTracking() {
  console.log('🚀 initLunchTracking() called');
  
  // 1. ALWAYS set date to today
  const dateEl = document.getElementById('lunchDate');
  if (dateEl) {
    dateEl.value = today();
    console.log('✅ Date set to:', dateEl.value);
  }
  
  // 2. Load sites if not already loaded
  if (!S.sites || S.sites.length === 0) {
    console.log('📥 Loading sites from Firestore...');
    try {
      const siteSnap = await S.clientDb.collection('sites')
        .where('companyId', '==', S.prefs.companyId)
        .get();
      S.sites = siteSnap.docs.map(d => ({id: d.id, ...d.data()}));
      console.log('✅ Sites loaded:', S.sites.length);
    } catch (e) {
      console.error('❌ Failed to load sites:', e);
    }
  }
  
  // 3. Populate site dropdown (always rebuild)
  const siteEl = document.getElementById('lunchSite');
  if (siteEl) {
    siteEl.innerHTML = '<option value="">🌐 All Sites</option>';
    if (S.sites && S.sites.length > 0) {
      S.sites.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.SiteID;
        opt.textContent = `${s.SiteID} — ${s.SiteName}`;
        siteEl.appendChild(opt);
      });
      console.log('✅ Sites populated:', S.sites.length);
    }
  }
  
  // 4. Attach event listeners (prevent duplicates)
  attachLunchListeners();
  
  // 5. Load data immediately
  await loadLunchTracking();
}

function attachLunchListeners() {
  const dateEl = document.getElementById('lunchDate');
  const siteEl = document.getElementById('lunchSite');
  const filterEl = document.getElementById('lunchFilter');
  
  if (dateEl && !dateEl.dataset.plListener) {
    dateEl.addEventListener('change', () => loadLunchTracking());
    dateEl.dataset.plListener = 'true';
  }
  if (siteEl && !siteEl.dataset.plListener) {
    siteEl.addEventListener('change', () => loadLunchTracking());
    siteEl.dataset.plListener = 'true';
  }
  if (filterEl && !filterEl.dataset.plListener) {
    filterEl.addEventListener('change', () => loadLunchTracking());
    filterEl.dataset.plListener = 'true';
  }
}

/**
 * Loads and filters post-lunch records from attendance collection
 */
async function loadLunchTracking() {
  console.log('🔍 loadLunchTracking() called');
  
  if (!S.clientDb) { 
    toast('DB not connected', 'error'); 
    return; 
  }
  
  const dateEl = document.getElementById('lunchDate');
  const siteEl = document.getElementById('lunchSite');
  const filterEl = document.getElementById('lunchFilter');
  const tb = document.getElementById('lunchTableBody');
  
  if (!tb) {
    console.error('❌ Table body #lunchTableBody not found');
    return;
  }
  
  // Get filter values (with defaults)
  const filterDateStr = dateEl?.value || today();
  const filterSiteId = siteEl?.value || '';
  const filterType = filterEl?.value || '';
  
  console.log(`📥 Filters: Date=${filterDateStr}, Site=${filterSiteId||'ALL'}, Type=${filterType||'ALL'}`);
  
  // Show loading state
  tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">⏳ Loading...</td></tr>';
  
  try {
    // Fetch ALL attendance records for company
    const snap = await S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    console.log(`✅ Fetched ${snap.size} total docs`);
    
    if (snap.empty) {
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No records found</td></tr>';
      updateLunchSummary([]);
      return;
    }
    
    // Parse filter date
    const [fy, fm, fd] = filterDateStr.split('-').map(Number);
    const filterDate = new Date(fy, fm - 1, fd);
    
    const records = [];
    
    // Filter records client-side
    for (const doc of snap.docs) {
      const r = doc.data();
      const pl = r.postLunch || {};
      
      // Filter by postLunch status
      const hasPostLunch = pl.time && pl.time.length > 0;
      const isInside = pl.inside === true;
      const isOutside = pl.inside === false;
      
      if (filterType === 'INSIDE' && !isInside) continue;
      if (filterType === 'OUTSIDE' && !isOutside) continue;
      if (filterType === 'PENDING' && hasPostLunch) continue;
      
      // Parse and compare date
      let recDate = null;
      if (r.Date?.toDate) recDate = r.Date.toDate();
      else if (r.Date) recDate = new Date(r.Date);
      
      if (!recDate || isNaN(recDate)) continue;
      
      const sameDay = recDate.getFullYear() === filterDate.getFullYear() &&
                      recDate.getMonth() === filterDate.getMonth() &&
                      recDate.getDate() === filterDate.getDate();
      
      if (!sameDay) continue;
      
      // Site filter
      if (filterSiteId && r.SiteID !== filterSiteId && r.Site !== filterSiteId) continue;
      
      records.push({ id: doc.id, ...r });
    }
    
    // Sort: Marked first, then by EMPID
    records.sort((a, b) => {
      const aHas = a.postLunch?.time ? 1 : 0;
      const bHas = b.postLunch?.time ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return (a.EMPID || '').localeCompare(b.EMPID || '');
    });
    
    console.log(`✅ Rendered ${records.length} records`);
    
    // Render
    renderLunchTable(records);
    updateLunchSummary(records);
    
    if (records.length === 0) {
      toast('No records match filters', 'warn');
    }
    
  } catch (e) {
    console.error('❌ Lunch tracking error:', e);
    if (tb) {
      tb.innerHTML = `<tr><td colspan="7" style="color:var(--red);text-align:center;padding:20px;">Error: ${e.message}</td></tr>`;
    }
  }
}

/**
 * Renders post-lunch records to table
 */
function renderLunchTable(list) {
  const tb = document.getElementById('lunchTableBody');
  if (!tb) return;
  
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No records match filters</td></tr>';
    return;
  }
  
  tb.innerHTML = list.map(r => {
    const pl = r.postLunch || {};
    const time = pl.time || '—';
    
    let statusText = 'PENDING';
    let statusClass = 'badge-gray';
    
    if (pl.time) {
      if (pl.inside === true) {
        statusText = '✅ INSIDE';
        statusClass = 'badge-green';
      } else if (pl.inside === false) {
        statusText = '❌ OUTSIDE';
        statusClass = 'badge-red';
      } else {
        statusText = '⚠️ UNKNOWN';
        statusClass = 'badge-amber';
      }
    }
    
    const coords = (pl.latitude && pl.longitude) 
      ? `${pl.latitude.toFixed(5)}, ${pl.longitude.toFixed(5)}` 
      : '—';
    
    const accuracy = pl.accuracy ? `${pl.accuracy}m` : '—';
    
    return `
    <tr>
      <td class="mono"><strong>${r.EMPID || '—'}</strong></td>
      <td>${r.Name || '—'}</td>
      <td>${r.SiteID || r.Site || '—'}</td>
      <td class="mono">${time}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td class="mono" style="font-size:.75rem;">${coords}</td>
      <td class="mono">${accuracy}</td>
    </tr>`;
  }).join('');
}

/**
 * Updates summary chips
 */
function updateLunchSummary(list) {
  const marked = list.filter(r => r.postLunch?.time).length;
  const pending = list.length - marked;
  const inside = list.filter(r => r.postLunch?.inside === true).length;
  const outside = list.filter(r => r.postLunch?.inside === false).length;
  
  const summary = document.getElementById('lunchSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="chip">Total <span>${list.length}</span></div>
      <div class="chip" style="color:var(--green);">Marked <span>${marked}</span></div>
      <div class="chip" style="color:var(--muted);">Pending <span>${pending}</span></div>
      <div class="chip" style="color:#1565C0;">Inside <span>${inside}</span></div>
      <div class="chip" style="color:var(--red);">Outside <span>${outside}</span></div>
    `;
  }
}