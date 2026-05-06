

/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - CORE APP & NAVIGATION
══════════════════════════════════════════════════════ */

// Initialize global app object
window.InvoiceApp = { 
  clientDb: null, 
  companyId: null, 
  companyName: null, 
  adminEmail: null 
};

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
    
    // Load dashboard
    loadDashboard();
  } catch (e) {
    console.error('App init failed:', e);
    window.location.href = 'index.html';
  }
});

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

// Dashboard stats
async function loadDashboard() {
  try {
    const invSnap = await window.InvoiceApp.clientDb.collection('invoices')
      .where('companyId','==',window.InvoiceApp.companyId).get();
    const custSnap = await window.InvoiceApp.clientDb.collection('customers')
      .where('companyId','==',window.InvoiceApp.companyId)
      .where('isActive','==',true).get();
    
    const now = new Date();
    let rev = 0;
    invSnap.forEach(d => {
      const dt = d.data().invoiceDate?.toDate ? d.data().invoiceDate.toDate() : new Date(d.data().invoiceDate);
      if (dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()) 
        rev += parseFloat(d.data().grandTotal || 0);
    });
    
    document.getElementById('statInvoices').textContent = invSnap.size;
    document.getElementById('statCustomers').textContent = custSnap.size;
    document.getElementById('statRevenue').textContent = '₹' + rev.toLocaleString('en-IN', {maximumFractionDigits:0});
  } catch(e) { 
    console.error('Dashboard error:', e); 
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
    // Close any open modal
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
  }
});