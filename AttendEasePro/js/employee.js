/**
 * EMPLOYEE.JS - Employee Portal Module (FIXED for new payroll structure)
 * ✅ Compatible with payroll_MM_YY collections (e.g., payroll_05_26)
 * ✅ Professional payslip PDF generation with logo support
 */

// Global State
window.EP = window.EP || {
  session: null,
  companyPlan: 'basic',
  db: null,
  clientDb: null,
  allAttendanceRecords: []
};

console.log('🔌 employee.js loaded | Firebase:', typeof firebase !== 'undefined', '| db:', typeof db !== 'undefined');

// SHA-256 Hash
async function hashPassword(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Toggle Password
function togglePw(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

// Check Company Plan
async function checkCompanyPlan() {
  const compId = document.getElementById('eCompanyId')?.value.trim().toUpperCase();
  const statusEl = document.getElementById('planStatus');
  
  if (!compId) { if (statusEl) statusEl.textContent = ''; return; }
  if (statusEl) { statusEl.textContent = 'Checking...'; statusEl.style.color = 'var(--muted)'; }
  
  try {
    const doc = await db.collection('companies').doc(compId).get();
    if (!doc.exists) {
      if (statusEl) { statusEl.textContent = 'Company not found'; statusEl.style.color = 'var(--red)'; }
      return;
    }
    
    const data = doc.data();
    window.EP.companyPlan = data.plan || 'basic';
    
    if (statusEl) {
      statusEl.textContent = window.EP.companyPlan === 'premium' ? '✓ Premium Plan' : '✓ Standard Plan';
      statusEl.style.color = window.EP.companyPlan === 'premium' ? 'var(--green)' : 'var(--teal)';
    }
  } catch(e) {
    console.error(e);
    if (statusEl) { statusEl.textContent = 'Connection Error'; statusEl.style.color = 'var(--red)'; }
  }
}

// Handle Login
async function handleEmployeeLogin() {
  const compId = document.getElementById('eCompanyId')?.value.trim().toUpperCase();
  const empId  = document.getElementById('eEmpId')?.value.trim().toUpperCase();
  const pass   = document.getElementById('ePassword')?.value;
  
  if (!compId || !empId || !pass) { showError('Please fill all fields'); return; }
  
  const btn = document.getElementById('btnEmpLogin');
  const btnText = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');
  
  btn.disabled = true; btnText.textContent = 'Connecting...'; spinner.style.display = 'inline-block';
  
  try {
    // 1. Get Client Config from MASTER DB
    const companyDoc = await db.collection('companies').doc(compId).get();
    if (!companyDoc.exists) throw new Error("Invalid Company ID");
    
    const companyData = companyDoc.data();
    const clientConfig = companyData.firebaseConfig;
    if (!clientConfig?.apiKey) throw new Error("Company configuration missing.");

    // 2. Initialize Client DB
    let clientApp = firebase.apps.find(a => a.name === 'clientApp') || 
                    firebase.initializeApp(clientConfig, 'clientApp');
    window.EP.clientDb = clientApp.firestore();
    
    console.log('✅ Client DB initialized:', !!window.EP.clientDb);
    
    // 3. Fetch Employee
    const empDoc = await window.EP.clientDb.collection('employees').doc(empId).get();
    if (!empDoc.exists) throw new Error("Invalid Employee ID");
    
    const empData = empDoc.data();
    console.log('📦 Employee data:', empData);
    
    if (empData.companyId !== compId) throw new Error("Employee does not belong to this company");
    
    // 4. Password Verification
    const storedVal = empData.PasswordHash || empData.passwordHash || empData.password || '';
    let isValid = false;
    
    if (storedVal === pass) isValid = true;
    else {
      const inputHash = await hashPassword(pass);
      if (storedVal === inputHash) isValid = true;
    }

    if (!isValid) throw new Error("Invalid Password");
    
    // 5. Fetch Site Name if Site ID exists
    let siteName = empData.Site || empData.site || empData.SiteID || empData.siteId || '—';
    if ((empData.Site || empData.SiteID) && window.EP.clientDb) {
      try {
        const siteId = empData.Site || empData.SiteID;
        const siteDoc = await window.EP.clientDb.collection('sites').doc(siteId).get();
        if (siteDoc.exists) {
          const siteData = siteDoc.data();
          siteName = siteData.siteName || siteData.SiteName || siteData.name || siteData.Name || siteId;
        }
      } catch(e) {
        console.log('⚠️ Could not fetch site name:', e.message);
      }
    }
    
    // 6. Create Session
    window.EP.session = {
      companyId: compId,
      companyName: companyData.companyName || compId,
      employeeId: empId,
      name: empData.EmpName || empData.empName || empData.Name || empData.name || empId,
      email: empData.Email || empData.email || '',
      phone: empData.Phone || empData.phone || '',
      designation: empData.Designation || empData.designation || '—',
      site: siteName,
      joinDate: empData.JoinDate || empData.joinDate || empData.EffectiveDate || empData.JoiningDate || '',
      photoUrl: empData.Photo || empData.photoUrl || empData.photo || '',
      plan: window.EP.companyPlan
    };
    
    console.log('✅ Session created:', window.EP.session);
    sessionStorage.setItem('empSession', JSON.stringify(window.EP.session));
    
    showScreen('empDashboard');
    await loadEmployeeDashboard();
    
  } catch(e) {
    console.error('Login error:', e);
    showError(e.message);
    window.EP.clientDb = null;
  } finally {
    btn.disabled = false; btnText.textContent = 'Sign In'; spinner.style.display = 'none';
  }
}

// Load Dashboard
async function loadEmployeeDashboard() {
  if (!window.EP.session) { 
    console.log('⚠️ No session, showing login');
    showScreen('loginScreen'); 
    return; 
  }
  
  console.log('🎯 Loading dashboard for:', window.EP.session.name);
  
  document.getElementById('empName').textContent = window.EP.session.name;
  document.getElementById('empCompany').textContent = window.EP.session.companyName;
  
  // Set default filter values
  populateYearDropdowns();
  setDefaultAttendanceFilter();
  setDefaultPayslipFilter();
  
  loadProfile();
  await loadAttendance();
}

// Populate Year Dropdowns
function populateYearDropdowns() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  
  ['filterYear', 'payslipYear'].forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = '<option value="">Select Year</option>';
      years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
      });
    }
  });
}

// Set Default Attendance Filter (Current Year/Month)
function setDefaultAttendanceFilter() {
  const now = new Date();
  const yearEl = document.getElementById('filterYear');
  const monthEl = document.getElementById('filterMonth');
  
  if (yearEl) yearEl.value = now.getFullYear();
  if (monthEl) monthEl.value = now.getMonth();
}

// Set Default Payslip Filter (Previous Month)
function setDefaultPayslipFilter() {
  const now = new Date();
  let prevMonth = now.getMonth() - 1;
  let prevYear = now.getFullYear();
  
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear--;
  }
  
  const yearEl = document.getElementById('payslipYear');
  const monthEl = document.getElementById('payslipMonth');
  
  if (yearEl) yearEl.value = prevYear;
  if (monthEl) monthEl.value = prevMonth;
}

// Load Profile
function loadProfile() {
  const s = window.EP.session;
  if (!s) return;
  
  // Photo
  const photoContainer = document.getElementById('profilePhotoContainer');
  if (photoContainer) {
    if (s.photoUrl && s.photoUrl.trim() !== '') {
      photoContainer.innerHTML = `<img src="${s.photoUrl}" alt="Profile" class="profile-photo" onerror="this.outerHTML='<div class=\\'profile-photo-placeholder\\'>👤</div>'"/>`;
    } else {
      photoContainer.innerHTML = '<div class="profile-photo-placeholder">👤</div>';
    }
  }
  
  // Fields
  const fields = {
    profEmpId: s.employeeId,
    profName: s.name,
    profEmail: s.email,
    profPhone: s.phone,
    profDesig: s.designation,
    profSite: s.site,
    profJoin: s.joinDate
  };
  
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'profJoin' && fields[id]) {
        try {
          let dateObj;
          const val = fields[id];
          
          if (val?.toDate) {
            dateObj = val.toDate();
          } else if (typeof val === 'string') {
            dateObj = new Date(val);
            if (isNaN(dateObj.getTime()) && val.includes('-')) {
              const parts = val.split('-');
              if (parts.length === 3) {
                dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
              }
            }
          } else if (val?.seconds) {
            dateObj = new Date(val.seconds * 1000);
          } else {
            dateObj = new Date(val);
          }
          
          if (!isNaN(dateObj.getTime())) {
            el.textContent = dateObj.toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          } else {
            el.textContent = fields[id];
          }
        } catch(e) {
          console.log('Date parse error:', e);
          el.textContent = fields[id] || '—';
        }
      } else {
        el.textContent = fields[id] || '—';
      }
    }
  });
}

// Update the display text when filters change
function updateFilterDisplay() {
  const year = document.getElementById('filterYear')?.value;
  const month = document.getElementById('filterMonth')?.value;
  const display = document.getElementById('filterPeriodDisplay');
  if (!display) return;
  
  if (!year || !month) {
    display.textContent = 'All Records (Last 20)';
    return;
  }
  
  const months = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
  display.textContent = `${months[parseInt(month)]} ${year}`;
}

// Reset to current month/year
function resetAttendanceFilter() {
  const now = new Date();
  const yearEl = document.getElementById('filterYear');
  const monthEl = document.getElementById('filterMonth');
  
  if (yearEl) yearEl.value = now.getFullYear();
  if (monthEl) monthEl.value = now.getMonth();
  
  updateFilterDisplay();
  loadAttendance(year, month);
}

// Filter Attendance
function filterAttendance() {
  const year = document.getElementById('filterYear')?.value;
  const month = document.getElementById('filterMonth')?.value;
  
  if (!year || !month) {
    alert('Please select both year and month');
    return;
  }
  
  if (!window.EP.allAttendanceRecords || !Array.isArray(window.EP.allAttendanceRecords)) {
    console.log('⚠️ No attendance records cached, reloading...');
    loadAttendance(year, month);
    return;
  }
  
  let filtered = window.EP.allAttendanceRecords;
  
  filtered = filtered.filter(r => {
    const date = r.date || r.Date;
    if (!date) return false;
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(month);
    } catch(e) {
      return false;
    }
  });
  
  renderAttendanceTable(filtered);
}

// Load Attendance
async function loadAttendance(year = null, month = null) {
  const tbody = document.getElementById('attendanceTableBody');
  
  if (!tbody) { console.error('❌ tbody not found'); return; }
  if (!window.EP.clientDb) {
    console.error('❌ clientDb not initialized');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--red);">Database not connected. Please login again.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;"><span class="spinner-sm"></span> Loading...</td></tr>';
  
  try {
    const empId = window.EP.session.employeeId;
    console.log('🔍 Querying attendance for EMPID:', empId);
    
    const snap = await window.EP.clientDb
      .collection('attendance')
      .where('companyId', '==', window.EP.session.companyId)
      .get();
    
    console.log('📊 Fetched', snap.size, 'attendance records');
    
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No attendance records found</td></tr>';
      updateStats(0, 0, 0);
      window.EP.allAttendanceRecords = [];
      return;
    }

    let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    records = records.filter(r => {
      const recEmpId = r.EMPID || r.employeeId || r.Empid || r.empId;
      return recEmpId === empId;
    });
    
    console.log('📋 After employee filter:', records.length, 'records');
    
    records.sort((a, b) => {
      const dateA = a.Date || a.date;
      const dateB = b.Date || b.date;
      if (!dateA) return 1;
      if (!dateB) return -1;
      try {
        const timeA = dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
        const timeB = dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
        return timeB - timeA;
      } catch(e) { return 0; }
    });
    
    window.EP.allAttendanceRecords = records;
    
    if (year !== null && month !== null) {
      records = records.filter(r => {
        const dateVal = r.Date || r.date;
        try {
          const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
          return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(month);
        } catch(e) { return false; }
      });
      console.log('📅 After date filter:', records.length, 'records');
    } else {
      records = records.slice(0, 20);
    }
    
    renderAttendanceTable(records);
    
  } catch(e) {
    console.error('❌ Attendance load error:', e);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--red);">Failed to load<br><small>' + e.message + '</small></td></tr>';
  }
}

// Render Attendance Table
function renderAttendanceTable(records) {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;
  
  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No records found for selected period</td></tr>';
    updateStats(0, 0, 0);
    return;
  }
  
  const present = records.filter(r => {
    const status = (r.Status || r.status || '').toLowerCase();
    return status === 'present';
  }).length;
  
  const late = records.filter(r => r.isLate || r.Late === true || r.IsLate === true).length;
  
  const leave = records.filter(r => {
    const status = (r.Status || r.status || '').toLowerCase();
    return status === 'leave';
  }).length;
  
  updateStats(present, late, leave);
  
  tbody.innerHTML = records.map(r => {
    const dateVal = r.Date || r.date;
    const checkIn = r.InTime || r.checkIn || r.CheckIn;
    const checkOut = r.OutTime || r.checkOut || r.CheckOut;
    const hours = r.Hours || r.hours || calcHours(checkIn, checkOut);
    const status = r.Status || r.status || '—';
    const location = r.Site || r.SiteID || r.location || r.Location || r.site || '—';
    
    const formatTime = (val) => {
      if (!val) return '—';
      try {
        if (typeof val === 'string' && val.includes(':')) return val;
        const time = val.toDate ? val.toDate() : new Date(val);
        return time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      } catch(e) { return val; }
    };
    
    const formatDate = (val) => {
      if (!val) return '—';
      try {
        const d = val.toDate ? val.toDate() : new Date(val);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch(e) { return val; }
    };
    
    const statusLower = status.toLowerCase();
    const statusClass = statusLower === 'present' ? 'badge-green' : 
                       statusLower === 'leave' ? 'badge-amber' : 'badge-red';
    
    return `
      <tr>
        <td style="padding:12px;font-weight:500;">${formatDate(dateVal)}</td>
        <td style="padding:12px;">${formatTime(checkIn)}</td>
        <td style="padding:12px;">${formatTime(checkOut)}</td>
        <td style="padding:12px;">${hours}</td>
        <td style="padding:12px;"><span class="badge ${statusClass}">${status}</span></td>
        <td style="padding:12px;font-size:.8rem;color:var(--muted);">${location}</td>
      </tr>
    `;
  }).join('');
}

// Calculate hours helper
function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  try {
    if (typeof inTime === 'string' && typeof outTime === 'string') {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      const diff = (outH * 60 + outM) - (inH * 60 + inM);
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h ${m}m`;
    }
    const inDate = inTime.toDate ? inTime.toDate() : new Date(inTime);
    const outDate = outTime.toDate ? outTime.toDate() : new Date(outTime);
    const diffMs = outDate - inDate;
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  } catch(e) {
    return '—';
  }
}

// Update Stats
function updateStats(present, late, leave) {
  const els = { statPresent: present, statLate: late, statLeave: leave };
  Object.keys(els).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = els[id];
  });
}

// ✅ FIXED: Load Payslip for NEW payroll structure (payroll_MM_YY collections)
async function loadPayslip() {
  const year = document.getElementById('payslipYear')?.value;
  const month = document.getElementById('payslipMonth')?.value;
  const container = document.getElementById('payslipContainer');
  
  if (!year || !month) {
    alert('Please select both year and month');
    return;
  }
  
  if (!window.EP.clientDb) {
    container.innerHTML = '<div class="payslip-container" style="color:var(--red);">Database not connected. Please login again.</div>';
    return;
  }
  
  container.innerHTML = '<div class="payslip-container"><span class="spinner-sm"></span><div style="margin-top:12px;">Loading payslip...</div></div>';
  
  try {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthStr = `${monthNames[parseInt(month)]} ${year}`;
    
    // ✅ NEW: Query from payroll_MM_YY collection (e.g., payroll_05_26)
    const monthKey = String(parseInt(month) + 1).padStart(2, '0');
    const yearKey = String(year).slice(-2);
    const collName = `payroll_${monthKey}_${yearKey}`;
    
    console.log(`🔍 Querying collection: ${collName} for employee: ${window.EP.session.employeeId}`);
    
    const payDoc = await window.EP.clientDb.collection(collName).doc(window.EP.session.employeeId).get();
    
    if (!payDoc.exists) {
      container.innerHTML = `
        <div class="payslip-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div style="font-size:1.1rem;color:var(--ink2);margin-bottom:8px;">No payslip found for ${monthStr}</div>
          <div style="font-size:.85rem;color:var(--muted);">Payslip will be generated by admin soon</div>
        </div>
      `;
      return;
    }
    
    const payData = payDoc.data();
    const earnings = payData.earnings || {};
    const deductions = payData.deductions || {};
    
    // ✅ Format earnings/deductions for display
    const earnKeys = [
      { k: 'basic_salary', l: 'Basic Salary' }, { k: 'da', l: 'Dearness Allowance' },
      { k: 'hra', l: 'House Rent Allowance' }, { k: 'conveyance', l: 'Conveyance' },
      { k: 'medical', l: 'Medical Allowance' }, { k: 'special_allowance', l: 'Special Allowance' },
      { k: 'ta', l: 'Travel Allowance' }, { k: 'ma', l: 'Medical Assistance' },
      { k: 'variable_pay', l: 'Variable Pay' }, { k: 'performance', l: 'Performance Bonus' },
      { k: 'incentives', l: 'Incentives' }, { k: 'onsite_allowances', l: 'Onsite Allowance' },
      { k: 'bonus', l: 'Bonus' }, { k: 'other_allowances', l: 'Other Allowances' }
    ];
    const dedKeys = [
      { k: 'epf', l: 'EPF' }, { k: 'esi', l: 'ESI' }, { k: 'tds', l: 'TDS' },
      { k: 'mobile_deduction', l: 'Mobile Deduction' }, { k: 'pt', l: 'Prof. Tax' },
      { k: 'lop', l: 'Loss of Pay' }, { k: 'vpf', l: 'VPF' }, { k: 'fa', l: 'Fine/Adjustment' },
      { k: 'advance', l: 'Advance' }, { k: 'recoveries', l: 'Recoveries' },
      { k: 'other_deductions', l: 'Other Deductions' }
    ];
    
    container.innerHTML = `
      <div style="max-width:600px;margin:0 auto;text-align:left;">
        <div style="background:var(--teal-s);padding:20px;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:1.3rem;font-weight:700;color:var(--teal-d);text-align:center;margin-bottom:8px;">Payslip</div>
          <div style="text-align:center;color:var(--muted);font-size:.9rem;">${monthStr}</div>
        </div>
        
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:8px;color:var(--ink2);">Employee Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.9rem;">
            <div><span style="color:var(--muted);">Name:</span> <strong>${window.EP.session.name}</strong></div>
            <div><span style="color:var(--muted);">Employee ID:</span> <strong>${window.EP.session.employeeId}</strong></div>
            <div><span style="color:var(--muted);">Designation:</span> <strong>${window.EP.session.designation}</strong></div>
            <div><span style="color:var(--muted);">Site:</span> <strong>${window.EP.session.site}</strong></div>
          </div>
        </div>
        
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:8px;color:var(--ink2);">Earnings</div>
          <div style="background:var(--bg);padding:12px;border-radius:6px;">
            ${earnKeys.map(e => {
              const val = earnings[e.k] || 0;
              return val > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
                  <span>${e.l}</span>
                  <strong>Rs. ${Number(val).toLocaleString('en-IN')}</strong>
                </div>
              ` : '';
            }).filter(Boolean).join('') || '<div style="color:var(--muted);padding:6px 0;">No earnings</div>'}
          </div>
        </div>
        
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:8px;color:var(--ink2);">Deductions</div>
          <div style="background:var(--bg);padding:12px;border-radius:6px;">
            ${dedKeys.map(d => {
              const val = deductions[d.k] || 0;
              return val > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
                  <span>${d.l}</span>
                  <strong>Rs. ${Number(val).toLocaleString('en-IN')}</strong>
                </div>
              ` : '';
            }).filter(Boolean).join('') || '<div style="color:var(--muted);padding:6px 0;">No deductions</div>'}
          </div>
        </div>
        
        <div style="background:var(--teal);color:#fff;padding:16px;border-radius:8px;text-align:center;">
          <div style="font-size:.9rem;margin-bottom:4px;">Net Salary</div>
          <div style="font-size:2rem;font-weight:700;">Rs. ${Number(payData.summary?.net_pay || payData.netSalary || 0).toLocaleString('en-IN')}</div>
        </div>
        
        <button class="btn-download" onclick="generateEmployeePayslip('${window.EP.session.employeeId}', '${monthStr}', ${parseInt(year)}, ${parseInt(month)})" style="width:100%;margin-top:16px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download PDF
        </button>
      </div>
    `;
    
  } catch(e) {
    console.error('Payslip error:', e);
    container.innerHTML = `
      <div class="payslip-container">
        <div style="color:var(--red);">Failed to load payslip<br><small>${e.message}</small></div>
      </div>
    `;
  }
}

// ✅ FIXED: Generate Professional Payslip PDF for Employee Portal
async function generateEmployeePayslip(empId, monthStr, year, month) {
  try {
    if (!window.EP.clientDb) throw new Error('Database not connected');
    
    // Fetch company profile for logo
    const compSnap = await window.EP.clientDb.collection('companyProfile').doc(window.EP.session.companyId).get();
    const comp = compSnap.exists ? compSnap.data() : {};
    
    // Fetch employee details
    const empSnap = await window.EP.clientDb.collection('employees').doc(empId).get();
    const emp = empSnap.exists ? empSnap.data() : {};
    
    // Fetch payroll master for statutory info
    const masterSnap = await window.EP.clientDb.collection('payrollMaster').doc(empId).get();
    const master = masterSnap.exists ? masterSnap.data() : {};
    
    // ✅ Fetch monthly payroll data from payroll_MM_YY collection
    const monthKey = String(month + 1).padStart(2, '0');
    const yearKey = String(year).slice(-2);
    const collName = `payroll_${monthKey}_${yearKey}`;
    
    const paySnap = await window.EP.clientDb.collection(collName).doc(empId).get();
    if (!paySnap.exists) throw new Error('Payslip data not found for this month');
    
    const pay = paySnap.data();
    const earnings = pay.earnings || {};
    const deductions = pay.deductions || {};
    
    // Generate PDF using jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = 210;
    const margin = 15;
    let yPos = 15;
    
    // --- PAYSLIP TITLE (Top Right) ---
    doc.setFontSize(18); 
    doc.setFont(undefined, 'bold'); 
    doc.setTextColor(40, 80, 140);
    doc.text('PAYSLIP', pageWidth - margin, yPos + 10, { align: 'right' });
    doc.setFontSize(12); 
    doc.text(monthStr, pageWidth - margin, yPos + 18, { align: 'right' });
    
    yPos += 35; // Gap after header title
    
    // ✅ LOGO NOW APPEARS JUST ABOVE COMPANY NAME
    if (comp.logoUrl && comp.logoUrl.length > 20) {
      try {
        let logoSrc = comp.logoUrl;
        // Ensure proper data URI format for jsPDF
        if (!logoSrc.startsWith('data:')) {
          if (logoSrc.startsWith('image/')) {
            logoSrc = 'data:' + logoSrc;
          } else {
            // Assume it's base64 JPEG
            logoSrc = 'data:image/jpeg;base64,' + logoSrc;
          }
        }
        doc.addImage(logoSrc, 'JPEG', margin, yPos, 40, 20);
        yPos += 25; // Add space for logo before company name
      } catch (e) { 
        console.log('Logo error:', e); 
        yPos += 5; 
      }
    }
    
    // --- COMPANY INFO (appears right after logo) ---
    doc.setFontSize(15); 
    doc.setTextColor(0, 0, 0); 
    doc.setFont(undefined, 'bold');
    doc.text(comp.companyName || 'Company Name', margin, yPos);
    doc.setFont(undefined, 'normal');
    
    if (comp.address) {
      const addrLines = doc.splitTextToSize(comp.address, 100);
      doc.text(addrLines, margin, yPos + 5);
      yPos += (addrLines.length * 5) + 8;
    } else { 
      yPos += 13; 
    }
    
    // --- EMPLOYEE & STATUTORY INFO BOX ---
    doc.setFillColor(240, 248, 255);
    doc.rect(margin, yPos, pageWidth - (margin * 2), 35, 'F');
    doc.setFontSize(9);
    
    // Left Column
    doc.setFont(undefined, 'bold'); doc.text('Employee Name:', margin + 5, yPos + 8);
    doc.setFont(undefined, 'normal'); doc.text(emp.EmpName || emp.Name || '-', margin + 35, yPos + 8);
    doc.setFont(undefined, 'bold'); doc.text('Designation:', margin + 5, yPos + 14);
    doc.setFont(undefined, 'normal'); doc.text(emp.Designation || emp.designation || '-', margin + 35, yPos + 14);
    doc.setFont(undefined, 'bold'); doc.text('Emp ID:', margin + 5, yPos + 20);
    doc.setFont(undefined, 'normal'); doc.text(empId, margin + 35, yPos + 20);
    doc.setFont(undefined, 'bold'); doc.text('PF No:', margin + 5, yPos + 26);
    doc.setFont(undefined, 'normal'); doc.text(master.pfAccountNo || '-', margin + 35, yPos + 26);
    
    // Right Column
    const rightX = pageWidth / 2 + 10;
    doc.setFont(undefined, 'bold'); doc.text('PAN:', rightX, yPos + 8);
    doc.setFont(undefined, 'normal'); doc.text(master.pan || '-', rightX + 20, yPos + 8);
    doc.setFont(undefined, 'bold'); doc.text('Bank A/C:', rightX, yPos + 14);
    doc.setFont(undefined, 'normal'); doc.text(master.bankAccount || '-', rightX + 20, yPos + 14);
    doc.setFont(undefined, 'bold'); doc.text('IFSC:', rightX, yPos + 20);
    doc.setFont(undefined, 'normal'); doc.text(master.ifsc || '-', rightX + 20, yPos + 20);
    doc.setFont(undefined, 'bold'); doc.text('Aadhaar:', rightX, yPos + 26);
    doc.setFont(undefined, 'normal'); doc.text(master.aadhaar || '-', rightX + 20, yPos + 26);
    
    yPos += 48;
    
    // --- TABLE HEADERS ---
    doc.setFillColor(40, 80, 140);
    doc.rect(margin, yPos, pageWidth - (margin * 2), 6, 'F');
    doc.setTextColor(255, 255, 255); 
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    
    const earnLabelX = margin + 5;
    const earnAmtX = margin + 70;
    const dedLabelX = margin + 90;
    const dedAmtX = margin + 155;
    
    doc.text('EARNINGS', earnLabelX, yPos + 4);
    doc.text('AMOUNT', earnAmtX, yPos + 4, { align: 'right' });
    doc.text('DEDUCTIONS', dedLabelX, yPos + 4);
    doc.text('AMOUNT', dedAmtX, yPos + 4, { align: 'right' });
    
    doc.setFontSize(8);
    yPos += 10;
    doc.setTextColor(0, 0, 0); 
    doc.setFont(undefined, 'normal');
    
    // --- TABLE ROWS ---
    const earnKeys = [
      { k: 'basic_salary', l: 'Basic Salary' }, { k: 'da', l: 'Dearness Allowance' },
      { k: 'hra', l: 'House Rent Allowance' }, { k: 'conveyance', l: 'Conveyance' },
      { k: 'medical', l: 'Medical Allowance' }, { k: 'special_allowance', l: 'Special Allowance' },
      { k: 'ta', l: 'Travel Allowance' }, { k: 'ma', l: 'Medical Assistance' },
      { k: 'variable_pay', l: 'Variable Pay' }, { k: 'performance', l: 'Performance Bonus' },
      { k: 'incentives', l: 'Incentives' }, { k: 'onsite_allowances', l: 'Onsite Allowance' },
      { k: 'bonus', l: 'Bonus' }, { k: 'other_allowances', l: 'Other Allowances' }
    ];
    const dedKeys = [
      { k: 'epf', l: 'EPF' }, { k: 'esi', l: 'ESI' }, { k: 'tds', l: 'TDS' },
      { k: 'mobile_deduction', l: 'Mobile Deduction' }, { k: 'pt', l: 'Prof. Tax' },
      { k: 'lop', l: 'Loss of Pay' }, { k: 'vpf', l: 'VPF' }, { k: 'fa', l: 'Fine/Adjustment' },
      { k: 'advance', l: 'Advance' }, { k: 'recoveries', l: 'Recoveries' },
      { k: 'other_deductions', l: 'Other Deductions' }
    ];
    
    let maxRows = Math.max(earnKeys.length, dedKeys.length);
    let totalEarn = 0, totalDed = 0;
    
    for (let i = 0; i < maxRows; i++) {
      if (earnKeys[i]) {
        const val = earnings[earnKeys[i].k] || 0;
        if (val > 0) {
          doc.text(earnKeys[i].l, earnLabelX, yPos);
          doc.text('Rs. ' + val.toLocaleString('en-IN'), earnAmtX, yPos, { align: 'right' });
          totalEarn += val;
        }
      }
      if (dedKeys[i]) {
        const val = deductions[dedKeys[i].k] || 0;
        if (val > 0) {
          doc.text(dedKeys[i].l, dedLabelX, yPos);
          doc.text('Rs. ' + val.toLocaleString('en-IN'), dedAmtX, yPos, { align: 'right' });
          totalDed += val;
        }
      }
      yPos += 6;
    }
    
    // --- TOTALS ---
    yPos += 5;
    doc.setDrawColor(40, 80, 140);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL EARNINGS', earnLabelX, yPos);
    doc.text('Rs. ' + totalEarn.toLocaleString('en-IN'), earnAmtX, yPos, { align: 'right' });
    
    doc.text('TOTAL DEDUCTIONS', dedLabelX, yPos);
    doc.text('Rs. ' + totalDed.toLocaleString('en-IN'), dedAmtX, yPos, { align: 'right' });
    
    yPos += 10;
    doc.setFillColor(40, 80, 140);
    doc.rect(margin, yPos, pageWidth - (margin * 2), 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('NET SALARY', earnLabelX, yPos + 6.5);
    doc.text('Rs. ' + (totalEarn - totalDed).toLocaleString('en-IN'), dedAmtX, yPos + 6.5, { align: 'right' });
    
    // --- FOOTER ---
    yPos += 25;
    doc.setTextColor(100, 100, 100); 
    doc.setFontSize(8); 
    doc.setFont(undefined, 'italic');
    doc.text('This is a computer-generated payslip and does not require a signature.', pageWidth / 2, yPos, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, yPos + 5, { align: 'center' });
    
    // Save PDF
    doc.save(`Payslip_${empId}_${monthStr.replace(/ /g, '_')}.pdf`);
    toast('✅ Payslip downloaded successfully', 'success');
    
  } catch(e) {
    console.error('PDF generation error:', e);
    toast('Failed to generate PDF: ' + e.message, 'error');
  }
}

// Switch Tabs
function switchTab(tabName) {
  document.querySelectorAll('.emp-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.emp-nav-btn[data-tab="${tabName}"]`)?.classList.add('active');
  
  document.querySelectorAll('.emp-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`sec${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');
  
  if (tabName === 'payslip') {
    loadPayslip();
  }
}

// Logout
function handleLogout() {
  sessionStorage.removeItem('empSession');
  window.EP.session = null;
  window.EP.clientDb = null;
  window.EP.allAttendanceRecords = [];
  showScreen('loginScreen');
  ['eCompanyId','eEmpId','ePassword'].forEach(id => document.getElementById(id).value = '');
}

// Utils
function showError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 DOMContentLoaded');
  const saved = sessionStorage.getItem('empSession');
  if (saved) {
    try {
      window.EP.session = JSON.parse(saved);
      console.log('✅ Restored session:', window.EP.session.name);
      showScreen('empDashboard');
      loadEmployeeDashboard();
    } catch(e) {
      console.error('Session parse error:', e);
      sessionStorage.removeItem('empSession');
    }
  }
});

// Simple toast notification
function toast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;padding:12px 20px;
    background:${type === 'error' ? '#C62828' : type === 'warn' ? '#E65100' : '#00838F'};
    color:#fff;border-radius:8px;font-size:0.9rem;font-weight:500;
    box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;
    animation:fadeUp 0.2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}