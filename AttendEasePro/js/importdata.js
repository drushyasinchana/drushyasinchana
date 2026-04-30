/* ══════════════════════════════════════════════════════
   IMPORTDATA.JS - Bulk Employee Import from Excel
   Features:
     - Smart upsert: Update only empty fields if employee exists
     - Insert new record if employee doesn't exist
     - Random 6-digit password with proper SHA-256 hashing
     - Export results with passwords
   Dependencies: masterDb, SA, XLSX library (SheetJS)
   Schema: employees collection with exact field mapping
══════════════════════════════════════════════════════ */

let parsedEmployees = [];
let currentCompanyId = '';
let importResults = [];

/**
 * Generates random 6-digit password
 */
function generateRandomPassword() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hashes password using SHA-256 (async)
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Downloads Excel template for employee import
 */
function downloadTemplate() {
  const template = [
    { 'EMPID': 'TES101', 'EmpName': 'John Doe', 'Email': 'john@example.com', 'Phone': '9876543210', 'Category': 'Office/Corporate', 'Designation': 'Manager', 'JoinDate': '2026-04-20' },
    { 'EMPID': 'TES102', 'EmpName': 'Jane Smith', 'Email': 'jane@example.com', 'Phone': '9876543211', 'Category': 'Field/Operations', 'Designation': 'Safety Officer', 'JoinDate': '2026-04-20' }
  ];
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  XLSX.writeFile(wb, 'Employee_Import_Template.xlsx');
}

/**
 * Validates company exists in Master Firestore
 */
async function validateCompany() {
  const companyId = document.getElementById('importCompanyId')?.value.trim().toUpperCase();
  const validationDiv = document.getElementById('companyValidation');
  
  if (!companyId) { validationDiv.innerHTML = ''; return false; }
  
  try {
    const snap = await masterDb.collection('companies').doc(companyId).get();
    if (!snap.exists) {
      validationDiv.innerHTML = '<span style="color:var(--red);">❌ Company not found</span>';
      currentCompanyId = ''; return false;
    }
    const data = snap.data();
    validationDiv.innerHTML = `<span style="color:var(--green);">✅ Company found: ${data.companyName || companyId}</span>`;
    currentCompanyId = companyId; return true;
  } catch (e) {
    console.error('Validation error:', e);
    validationDiv.innerHTML = `<span style="color:var(--red);">❌ Error: ${e.message}</span>`;
    currentCompanyId = ''; return false;
  }
}

/**
 * Parses Excel file and displays preview
 */
async function parseExcelFile() {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  if (!file) { alert('Please select a file'); return; }
  if (!await validateCompany()) { alert('Please enter a valid Company ID first'); fileInput.value = ''; return; }
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      if (jsonData.length === 0) { alert('Excel file is empty'); return; }
      parsedEmployees = await processEmployeeData(jsonData);
      displayPreview(parsedEmployees);
    } catch (error) {
      console.error('Parse error:', error);
      alert('Error parsing Excel file: ' + error.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

/**
 * Processes and validates employee data from Excel
 */
async function processEmployeeData(data) {
  const processed = [];
  const today = new Date();
  const dateTimestamp = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  
  // Fetch sector designations for validation
  let sectorDesignations = {};
  try {
    const settingsSnap = await masterDb.collection('companies').doc(currentCompanyId).get();
    if (settingsSnap.exists) {
      const settings = settingsSnap.data();
      if (settings.sector) {
        const sectorCode = settings.sector.split('-')[0];
        const sectorSnap = await masterDb.collection('sectors').doc(sectorCode).get();
        if (sectorSnap.exists) {
          sectorDesignations = sectorSnap.data().designations || {};
        }
      }
    }
  } catch (e) { console.warn('Could not fetch sector designations:', e); }
  
  const allDesignations = Object.values(sectorDesignations).flat();
  
  // Process each row with async password hashing
  for (const row of data) {
    const randomPassword = generateRandomPassword();
    const passwordHash = await hashPassword(randomPassword);
    
    // Parse JoinDate
    let joinDate = new Date(today);
    if (row.JoinDate || row.joindate) {
      const jd = row.JoinDate || row.joindate;
      if (typeof jd === 'string') {
        const parsed = new Date(jd);
        if (!isNaN(parsed)) joinDate = parsed;
      }
    }
    
    // Inside processEmployeeData(), in the emp object:

const emp = {
  row: data.indexOf(row) + 1,
  EMPID: (row.EMPID || row.empid || '').toString().trim().toUpperCase(),
  EmpName: (row.EmpName || row.empname || row.Name || '').toString().trim(),
  Email: (row.Email || row.email || '').toString().trim().toLowerCase() || null,
  Phone: (row.Phone || row.phone || '').toString().trim() || null,
  Category: (row.Category || row.category || 'Office/Corporate').toString().trim(),
  Designation: (row.Designation || row.designation || '').toString().trim(),
  JoinDate: joinDate,
  
  // Auto-filled fields per schema
  companyId: currentCompanyId,
  EffectiveDate: dateTimestamp,
  PasswordHash: passwordHash,
  PlainPassword: randomPassword,  // For export only
  Role: 'EMPLOYEE',
  Status: 'ACTIVE',
  
  // ✅ ADD SITE FIELD with default value
  Site: 'SITE001',  // Default site for all imported employees
  
  Photo: null,
  photoUrl: null,
  biometricData: [],
  UpdatedAt: new Date().toISOString(),
  
  // Validation
  isValid: true,
  errors: []
};
    
    // Validation
    if (!emp.EMPID) { emp.isValid = false; emp.errors.push('EMPID required'); }
    if (!emp.EmpName) { emp.isValid = false; emp.errors.push('Name required'); }
    if (emp.Designation && allDesignations.length > 0 && !allDesignations.includes(emp.Designation)) {
      emp.isValid = false; emp.errors.push(`Invalid designation: ${emp.Designation}`);
    }
    
    processed.push(emp);
  }
  return processed;
}

/**
 * Displays preview table
 */
function displayPreview(employees) {
  const previewSection = document.getElementById('previewSection');
  const emptyState = document.getElementById('emptyState');
  const previewCount = document.getElementById('previewCount');
  const tbody = document.getElementById('previewTableBody');
  
  previewCount.textContent = employees.length;
  tbody.innerHTML = '';
  
  employees.forEach(emp => {
    const tr = document.createElement('tr');
    tr.style.background = emp.isValid ? '#fff' : '#fff5f5';
    tr.style.borderBottom = '1px solid var(--border)';
    
    const statusHtml = emp.isValid 
      ? '<span style="color: var(--green); font-weight: 500;">ACTIVE</span>'
      : `<span style="color: var(--red);">✗ ${emp.errors.join(', ')}</span>`;
    
    tr.innerHTML = `
      <td style="padding: 10px; font-family: monospace;">${emp.row}</td>
      <td style="padding: 10px; font-family: monospace; font-weight: 500;">${emp.EMPID || '—'}</td>
      <td style="padding: 10px;">${emp.EmpName || '—'}</td>
      <td style="padding: 10px; color: var(--muted);">${emp.Email || '—'}</td>
      <td style="padding: 10px;">${emp.Phone || '—'}</td>
      <td style="padding: 10px;">${emp.Category || '—'}</td>
      <td style="padding: 10px;">${emp.Designation || '—'}</td>
      <td style="padding: 10px;">${statusHtml}</td>
    `;
    
    tbody.appendChild(tr);
  });
  
  previewSection.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  
  const hasInvalid = employees.some(e => !e.isValid);
  const btnConfirm = document.getElementById('btnConfirmImport');
  if (btnConfirm) {
    btnConfirm.disabled = hasInvalid;
    btnConfirm.textContent = hasInvalid ? '⚠️ Fix Errors First' : '✅ Confirm Import';
    btnConfirm.style.background = hasInvalid ? 'var(--gray)' : 'var(--teal)';
  }
}

/**
 * ✅ SMART UPSERT: Merge new data with existing, only filling empty fields
 */
function mergeEmployeeData(existing, newData) {
  const merged = { ...existing };
  
  // Fields to potentially update (only if existing value is null/empty)
const updatableFields = [
  'EmpName', 'Email', 'Phone', 'Category', 'Designation',
  'JoinDate', 'EffectiveDate', 'Role', 'Status',
  'Site',  // ✅ Add Site to updatable fields
  'Photo', 'photoUrl', 'biometricData'
];

  updatableFields.forEach(field => {
    const existingVal = existing[field];
    const newVal = newData[field];
    
    // Only update if existing is null/empty/undefined AND new value is valid
    if ((existingVal === null || existingVal === undefined || existingVal === '') && 
        newVal !== null && newVal !== undefined && newVal !== '') {
      merged[field] = newVal;
    }
  });
  
  // Always update these metadata fields
  merged.UpdatedAt = new Date().toISOString();
  
  return merged;
}

/**
 * Confirms and imports employees to Firestore with smart upsert
 */
async function confirmImport() {
  if (!currentCompanyId || parsedEmployees.length === 0) { alert('No data to import'); return; }
  const validEmployees = parsedEmployees.filter(e => e.isValid);
  if (validEmployees.length === 0) { alert('No valid employees to import'); return; }
  
  const confirmMsg = `Import ${validEmployees.length} employees to Company ${currentCompanyId}?\n\n` +
    `✓ Valid records: ${validEmployees.length}\n` +
    `✗ Invalid records: ${parsedEmployees.length - validEmployees.length}\n\n` +
    `🔄 Smart Upsert Mode:\n` +
    `   • If employee exists: Update fields (PasswordHash will be updated)\n` +
    `   • If employee new: Insert full record\n\n` +
    `⚠️ Passwords will be updated to the random values shown in export.`;
  
  if (!confirm(confirmMsg)) return;
  
  const resultDiv = document.getElementById('importResult');
  const btnConfirm = document.getElementById('btnConfirmImport');
  
  btnConfirm.disabled = true;
  btnConfirm.textContent = '⏳ Processing...';
  resultDiv.innerHTML = '<div style="padding:15px;background:var(--bg);border-radius:6px;">Processing employees...</div>';
  
  let successCount = 0, errorCount = 0, insertCount = 0, updateCount = 0;
  importResults = [];
  
  try {
    const companySnap = await masterDb.collection('companies').doc(currentCompanyId).get();
    const clientConfig = companySnap.data().firebaseConfig;
    
    if (!clientConfig) {
      throw new Error('Client Firebase config not found. Please update config first.');
    }
    
    let clientApp;
    try {
      clientApp = firebase.app('import-client');
    } catch (e) {
      clientApp = firebase.initializeApp(clientConfig, 'import-client');
    }
    const clientDb = clientApp.firestore();
    
    for (const emp of validEmployees) {
      try {
        const empId = emp.EMPID;
        const existingDoc = await clientDb.collection('employees').doc(empId).get();
        const exists = existingDoc.exists;
        
        let payload, action;
        
        if (exists) {
          // ✅ UPDATE: Merge data, but ALWAYS update PasswordHash
          const existingData = existingDoc.data();
          
          // Start with existing data
          payload = { ...existingData };
          
          // Update fields from import (overwrite existing values)
          const updatableFields = [
            'EmpName', 'Email', 'Phone', 'Category', 'Designation',
            'JoinDate', 'EffectiveDate', 'Role', 'Status',
            'Photo', 'photoUrl', 'biometricData'
          ];
          
          updatableFields.forEach(field => {
            if (emp[field] !== undefined && emp[field] !== null && emp[field] !== '') {
              payload[field] = emp[field];
            }
          });
          
          // ✅ ALWAYS update PasswordHash for imports (source of truth)
          payload.PasswordHash = emp.PasswordHash;
          
          // Always update metadata
          payload.UpdatedAt = new Date().toISOString();
          payload.companyId = emp.companyId; // Ensure company ID is set
          
          action = 'Updated';
          updateCount++;
          
          await clientDb.collection('employees').doc(empId).set(payload, { merge: true });
          
        } else {
          // ✅ INSERT: New employee with full payload
          payload = {
  companyId: emp.companyId,
  EMPID: emp.EMPID,
  EmpName: emp.EmpName,
  Email: emp.Email,
  Phone: emp.Phone,
  Category: emp.Category,
  Designation: emp.Designation,
  JoinDate: emp.JoinDate,
  EffectiveDate: emp.EffectiveDate,
  PasswordHash: emp.PasswordHash,
  Role: emp.Role,
  Status: emp.Status,
  
  // ✅ ADD SITE FIELD
  Site: emp.Site,  // Will be 'SITE001' from processEmployeeData
  
  Photo: emp.Photo,
  photoUrl: emp.photoUrl,
  biometricData: emp.biometricData,
  UpdatedAt: emp.UpdatedAt
};
          action = 'Inserted';
          insertCount++;
          
          await clientDb.collection('employees').doc(empId).set(payload);
        }
        
        successCount++;
        importResults.push({
          EMPID: emp.EMPID,
          EmpName: emp.EmpName,
          Email: emp.Email,
          Phone: emp.Phone,
          Category: emp.Category,
          Designation: emp.Designation,
          Status: 'ACTIVE',
          Password: emp.PlainPassword,  // Show the password that now works
          Action: action,
          Error: ''
        });
        
      } catch (e) {
        errorCount++;
        importResults.push({
          EMPID: emp.EMPID,
          EmpName: emp.EmpName,
          Email: emp.Email,
          Phone: emp.Phone,
          Category: emp.Category,
          Designation: emp.Designation,
          Status: 'FAILED',
          Password: emp.PlainPassword,
          Action: 'Error',
          Error: e.message
        });
        console.error(`Failed to process ${emp.EMPID}:`, e);
      }
    }
    
    // Show results
    let resultHtml = `
      <div style="padding:15px;background:#f0fff4;border:1px solid var(--green);border-radius:6px;">
        <strong style="color:var(--green);font-size:1rem;">✅ Import Complete!</strong><br>
        <span style="font-size:0.95rem;">✓ Success: ${successCount}</span><br>
        <span style="font-size:0.95rem;">📥 Inserted: ${insertCount} | 🔄 Updated: ${updateCount}</span><br>
        ${errorCount > 0 ? `<span style="font-size:0.95rem;">✗ Failed: ${errorCount}</span><br>` : ''}
        <div style="margin-top:8px;font-size:0.85rem;color:var(--muted);">
          🔐 Passwords in export file are now active for all imported employees
        </div>
      </div>
      <div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-teal" onclick="exportResults()" style="padding:10px 16px;">
          📥 Export Results with Passwords
        </button>
        <button class="btn btn-outline" onclick="clearImportForm()" style="padding:10px 16px;">
          🔄 New Import
        </button>
      </div>
    `;
    
    if (errorCount > 0) {
      resultHtml += `
        <div style="margin-top:10px;padding:10px;background:#fff5f5;border:1px solid var(--red);border-radius:6px;font-size:0.85rem;">
          <strong style="color:var(--red);">Errors:</strong><br>
          ${importResults.filter(r => r.Status === 'FAILED').slice(0, 5).map(r => `${r.EMPID}: ${r.Error}`).join('<br>')}
          ${errorCount > 5 ? `<br><em>...and ${errorCount - 5} more</em>` : ''}
        </div>
      `;
    }
    
    resultDiv.innerHTML = resultHtml;
    
    try {
      firebase.app('import-client').delete();
    } catch (e) {}
    
  } catch (e) {
    console.error('Import error:', e);
    resultDiv.innerHTML = `
      <div style="padding:15px;background:#fff5f5;border:1px solid var(--red);border-radius:6px;">
        <strong style="color:var(--red);font-size:1rem;">❌ Import Failed</strong><br>
        <span style="font-size:0.95rem;">${e.message}</span>
      </div>
    `;
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = '✅ Confirm Import';
  }
}
/**
 * Exports import results to Excel with passwords and action type
 */
function exportResults() {
  if (importResults.length === 0) { alert('No results to export'); return; }
  
const exportData = importResults.map(r => ({
  'EMPID': r.EMPID,
  'Name': r.EmpName,
  'Email': r.Email || '',
  'Phone': r.Phone || '',
  'Category': r.Category,
  'Designation': r.Designation,
  'Site': r.Site || 'SITE001',  // ✅ Add Site column
  'Status': r.Status,
  'Action': r.Action || 'N/A',
  'Password': r.Password || 'N/A',
  'Error': r.Error || ''
}));
  
  const ws = XLSX.utils.json_to_sheet(exportData);
  
const wscols = [
  {wch: 12}, {wch: 25}, {wch: 30}, {wch: 15}, {wch: 20},
  {wch: 25}, {wch: 12},  // ✅ Site column width
  {wch: 10}, {wch: 10}, {wch: 12}, {wch: 30}
];
  ws['!cols'] = wscols;
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import Results');
  
  const filename = `Employee_Import_Results_${currentCompanyId}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Clears import form
 */
function clearImportForm() {
  document.getElementById('importCompanyId').value = '';
  document.getElementById('importFile').value = '';
  document.getElementById('companyValidation').innerHTML = '';
  document.getElementById('previewSection').style.display = 'none';
  document.getElementById('importResult').innerHTML = '';
  
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'flex';
  
  parsedEmployees = [];
  importResults = [];
  currentCompanyId = '';
}