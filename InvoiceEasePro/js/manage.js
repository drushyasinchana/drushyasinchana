/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - CORE APP & NAVIGATION (Fixed Dashboard)
Modified: Dashboard filters by selected profileId from dropdown
══════════════════════════════════════════════════════ */

// Initialize global app object
window.InvoiceApp = { 
  clientDb: null, 
  companyId: null, 
  companyName: null, 
  adminEmail: null 
};

// ✅ Track selected profile ID (COMP001-COMP005)
window.selectedProfileId = sessionStorage.getItem('selectedProfileId') || 'COMP001';

document.addEventListener('DOMContentLoaded', async () => {
  const session = sessionStorage.getItem('invoiceProSession');
  const companyId = sessionStorage.getItem('currentCompanyId');
  
  if (!session || !companyId) { 
    window.location.href = 'index.html'; 
    return; 
  }

  try {
    const data = JSON.parse(session);
    const doc = await window.db.collection('companies').doc(companyId).get();
    const config = doc.data().firebaseConfig;
    
    // Initialize client Firebase
    let app;
    try { 
      app = firebase.app('invoiceClient'); 
    } catch(e) { 
      app = firebase.initializeApp(config, 'invoiceClient'); 
    }
    
    // Set global app object
    window.InvoiceApp = {
      clientDb: app.firestore(),
      companyId: companyId,
      companyName: data.companyName,
      adminEmail: data.adminEmail
    };

    console.log('✅ InvoiceApp initialized:', window.InvoiceApp);

    // Update UI
    document.getElementById('userName').textContent = window.InvoiceApp.companyName;
    document.getElementById('userEmail').textContent = window.InvoiceApp.adminEmail;
    
    // ✅ Inject company selector dropdown into top bar
    injectCompanySelector();
    
    // Load dashboard
    loadDashboard();
  } catch (e) {
    console.error('App init failed:', e);
    window.location.href = 'index.html';
  }
});

// ✅ Inject company selector dropdown with ACTUAL company names from Firestore
async function injectCompanySelector() {
  const topRight = document.querySelector('.top-right');
  if (!topRight) return;
  
  // Check if dropdown already exists
  if (document.getElementById('companyProfileSelector')) return;
  
  try {
    // ✅ Fetch all 5 company profiles to get actual names
    const profilePromises = [];
    for (let i = 1; i <= 5; i++) {
      const profileId = `COMP00${i}`;
      profilePromises.push(
        window.InvoiceApp.clientDb.collection('companyProfile').doc(profileId).get()
      );
    }
    
    const profileDocs = await Promise.all(profilePromises);
    
    // ✅ Build options with actual company names
    let optionsHTML = '';
    profileDocs.forEach((doc, idx) => {
      const profileId = `COMP00${idx + 1}`;
      const profileData = doc.exists ? doc.data() : {};
      const companyName = profileData.companyName?.trim() || `Company ${idx + 1}`;
      const isSelected = profileId === window.selectedProfileId;
      
      optionsHTML += `<option value="${profileId}" ${isSelected ? 'selected' : ''}>${companyName}</option>`;
    });
    
    // Create selector container
    const selector = document.createElement('div');
    selector.style.cssText = 'display:flex;align-items:center;gap:12px;margin-right:16px;';
    selector.innerHTML = `
      <label style="font-size:0.85rem;color:var(--muted);font-weight:600;">Profile:</label>
      <select id="companyProfileSelector" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.9rem;background:#fff;cursor:pointer;min-width:200px;">
        ${optionsHTML}
      </select>
    `;
    
    // Insert before logout button
    const logoutBtn = topRight.querySelector('.btn-logout');
    if (logoutBtn) {
      topRight.insertBefore(selector, logoutBtn);
    } else {
      topRight.appendChild(selector);
    }
    
    // ✅ Handle dropdown change - reload ALL visible modules
    document.getElementById('companyProfileSelector').addEventListener('change', function(e) {
      window.selectedProfileId = e.target.value;
      sessionStorage.setItem('selectedProfileId', e.target.value);
      
      console.log('🔄 Profile changed to:', window.selectedProfileId);
      
      // Reload currently active page
      const activePage = document.querySelector('.page.active');
      if (activePage) {
        const pageId = activePage.id.replace('pg', '').toLowerCase();
        
        if (pageId === 'dashboard') {
          loadDashboard();
        } else if (pageId === 'invoices' && typeof window.loadInvoices === 'function') {
          window.loadInvoices();
        } else if (pageId === 'customers' && typeof window.loadCustomers === 'function') {
          window.loadCustomers();
        } else if (pageId === 'particulars' && typeof window.loadParticulars === 'function') {
          window.loadParticulars();
        } else if (pageId === 'reports' && typeof window.loadReports === 'function') {
          window.loadReports();
        }
      }
    });
    
  } catch (e) {
    console.error('Error loading company profiles for dropdown:', e);
    // Fallback to hardcoded names if fetch fails
    const selector = document.createElement('div');
    selector.style.cssText = 'display:flex;align-items:center;gap:12px;margin-right:16px;';
    selector.innerHTML = `
      <label style="font-size:0.85rem;color:var(--muted);font-weight:600;">Profile:</label>
      <select id="companyProfileSelector" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.9rem;background:#fff;cursor:pointer;min-width:150px;">
        <option value="COMP001" ${window.selectedProfileId==='COMP001'?'selected':''}>Company 1</option>
        <option value="COMP002" ${window.selectedProfileId==='COMP002'?'selected':''}>Company 2</option>
        <option value="COMP003" ${window.selectedProfileId==='COMP003'?'selected':''}>Company 3</option>
        <option value="COMP004" ${window.selectedProfileId==='COMP004'?'selected':''}>Company 4</option>
        <option value="COMP005" ${window.selectedProfileId==='COMP005'?'selected':''}>Company 5</option>
      </select>
    `;
    
    const logoutBtn = topRight.querySelector('.btn-logout');
    if (logoutBtn) {
      topRight.insertBefore(selector, logoutBtn);
    } else {
      topRight.appendChild(selector);
    }
    
    // Add same event listener for fallback
    document.getElementById('companyProfileSelector').addEventListener('change', function(e) {
      window.selectedProfileId = e.target.value;
      sessionStorage.setItem('selectedProfileId', e.target.value);
      location.reload();
    });
  }
}
// Navigation function
window.nav = function(page, btn) {
  console.log('🔹 Navigating to:', page);
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // Show selected page
  const pg = document.getElementById('pg' + page.charAt(0).toUpperCase() + page.slice(1));
  if (pg) {
    pg.classList.add('active');
    if (btn) btn.classList.add('active');
    
    const titles = {
      dashboard:'Dashboard',
      invoices:'Invoice Management',
      customers:'Customer Master',
      particulars:'Particulars & Items',
      reports:'Reports & Analytics',
      company:'Company Profile'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    
    // Call the appropriate load function
    if (page === 'dashboard') loadDashboard();
    else if (page === 'invoices') {
      if (typeof window.loadInvoices === 'function') window.loadInvoices();
      else console.error('❌ loadInvoices not found');
    }
    else if (page === 'customers') {
      if (typeof window.loadCustomers === 'function') window.loadCustomers();
      else console.error('❌ loadCustomers not found');
    }
    else if (page === 'particulars') {
      if (typeof window.loadParticulars === 'function') window.loadParticulars();
      else console.error('❌ loadParticulars not found');
    }
    else if (page === 'reports') {
      if (typeof window.loadReports === 'function') window.loadReports();
      else console.error('❌ loadReports not found');
    }
    else if (page === 'company') {
      if (typeof window.loadCompanyProfile === 'function') window.loadCompanyProfile();
      else console.error('❌ loadCompanyProfile not found');
    }
  }
};

// ✅ Dashboard stats - FIXED: Filter by selected profileId
async function loadDashboard() {
  try {
    console.log('📊 Loading dashboard for profile:', window.selectedProfileId);
    
    const profileId = window.selectedProfileId;
    const db = window.InvoiceApp.clientDb;
    
    // ✅ Fetch invoices filtered by profileId (no orderBy to avoid index)
    const invSnap = await db.collection('invoices')
      .where('profileId', '==', profileId)
      .get();
    
    // ✅ Fetch customers filtered by profileId and isActive
    const custSnap = await db.collection('customers')
      .where('profileId', '==', profileId)
      .where('isActive', '==', true)
      .get();
    
    // Calculate revenue for current month
    const now = new Date();
    let rev = 0;
    
    invSnap.forEach(d => {
      const inv = d.data();
      const dt = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate);
      
      // Check if invoice is from current month and year
      if (dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()) {
        rev += parseFloat(inv.grandTotal || 0);
      }
    });
    
    // Update dashboard stats
    document.getElementById('statInvoices').textContent = invSnap.size;
    document.getElementById('statCustomers').textContent = custSnap.size;
    document.getElementById('statRevenue').textContent = '₹' + rev.toLocaleString('en-IN', {maximumFractionDigits:0});
    
    console.log('✅ Dashboard loaded:', {
      invoices: invSnap.size,
      customers: custSnap.size,
      revenue: rev
    });
    
  } catch(e) { 
    console.error('Dashboard error:', e); 
    // Set zeros on error
    document.getElementById('statInvoices').textContent = '0';
    document.getElementById('statCustomers').textContent = '0';
    document.getElementById('statRevenue').textContent = '₹0';
  }
}

// Logout
window.handleLogout = function() {
  sessionStorage.clear();
  try { 
    const a = firebase.apps.find(x => x.name === 'invoiceClient'); 
    if(a) a.delete(); 
  } catch(e){}
  window.location.href = 'index.html';
};

// Add ESC key handler
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
  }
});