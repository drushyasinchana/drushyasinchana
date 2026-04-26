/* ══════════════════════════════════════════════════════
   IMPORTDATA.JS - Bulk Employee Import from Excel
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
 * Maps to exact Firestore schema for employees collection
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
  
  data.forEach((row, index) => {
    // Generate random 6-digit password and hash it
    const randomPassword = generateRandomPassword();
    const encoder = new TextEncoder();
    const passwordHash = Array.from(new Uint8Array(
      crypto.subtle.digest('SHA-256', encoder.encode(randomPassword))
    )).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Parse JoinDate - handle various formats
    let joinDate = new Date(today);
    if (row.JoinDate || row.joindate) {
      const jd = row.JoinDate || row.joindate;
      if (typeof jd === 'string') {
        // Try ISO format first, then fallback
        const parsed = new Date(jd);
        if (!isNaN(parsed)) joinDate = parsed;
      }
    }
    
    const emp = {
      row: index + 1,
      // Required fields from Excel
      EMPID: (row.EMPID || row.empid || '').toString().trim().toUpperCase(),
      EmpName: (row.EmpName || row.empname || row.Name || '').toString().trim(),
      
      // Optional fields from Excel (null if not provided)
      Email: (row.Email || row.email || '').toString().trim().toLowerCase() || null,
      Phone: (row.Phone || row.phone || '').toString().trim() || null,
      
      // Category/Designation with defaults
      Category: (row.Category || row.category || 'Office/Corporate').toString().trim(),
      Designation: (row.Designation || row.designation || '').toString().trim(),
      
      // Date fields
      JoinDate: joinDate,
      
      // Auto-filled fields per schema
      companyId: currentCompanyId,
      EffectiveDate: dateTimestamp,
      PasswordHash: passwordHash,
      PlainPassword: randomPassword, // Store for export only
      Role: 'EMPLOYEE',
      Status: 'ACTIVE',
      Photo: null,
      photoUrl: null,
      biometricData: [],
      UpdatedAt: new Date().toISOString(),
      
      // Validation
      isValid: true,
      errors: []
    };
    
    // Validation rules
    if (!emp.EMPID) { emp.isValid = false; emp.errors.push('EMPID required'); }
    if (!emp.EmpName) { emp.isValid = false; emp.errors.push('Name required'); }
    if (emp.Designation && allDesignations.length > 0 && !allDesignations.includes(emp.Designation)) {
      emp.isValid = false; emp.errors.push(`Invalid designation: ${emp.Designation}`);
    }
    
    processed.push(emp);
  });
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
  
  // Show preview, hide empty state
  previewSection.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  
  // Enable/disable confirm button
  const hasInvalid = employees.some(e => !e.isValid);
  const btnConfirm = document.getElementById('btnConfirmImport');
  if (btnConfirm) {
    btnConfirm.disabled = hasInvalid;
    btnConfirm.textContent = hasInvalid ? '⚠️ Fix Errors First' : '✅ Confirm Import';
    btnConfirm.style.background = hasInvalid ? 'var(--gray)' : 'var(--teal)';
  }
}



/**
 * Confirms and imports employees to Firestore
 */
async function confirmImport() {
  if (!currentCompanyId || parsedEmployees.length === 0) { alert('No data to import'); return; }
  const validEmployees = parsedEmployees.filter(e => e.isValid);
  if (validEmployees.length === 0) { alert('No valid employees to import'); return; }
  
  const confirmMsg = `Import ${validEmployees.length} employees to Company ${currentCompanyId}?\n\n` +
    `✓ Valid records: ${validEmployees.length}\n` +
    `✗ Invalid records: ${parsedEmployees.length - validEmployees.length}\n\n` +
    `⚠️ Each employee will get a random 6-digit password.\n` +
    `Passwords will be included in the export file.`;
  
  if (!confirm(confirmMsg)) return;
  
  const resultDiv = document.getElementById('importResult');
  const btnConfirm = document.getElementById('btnConfirmImport');
  
  btnConfirm.disabled = true;
  btnConfirm.textContent = '⏳ Importing...';
  resultDiv.innerHTML = '<div style="padding:15px;background:var(--bg);border-radius:6px;">Importing employees...</div>';
  
  let successCount = 0, errorCount = 0;
  importResults = [];
  
  try {
    // Get client Firebase config from Master
    const companySnap = await masterDb.collection('companies').doc(currentCompanyId).get();
    const clientConfig = companySnap.data().firebaseConfig;
    
    if (!clientConfig) {
      throw new Error('Client Firebase config not found. Please update config first.');
    }
    
    // Initialize client Firebase app
    let clientApp;
    try {
      clientApp = firebase.app('import-client');
    } catch (e) {
      clientApp = firebase.initializeApp(clientConfig, 'import-client');
    }
    const clientDb = clientApp.firestore();
    
    // Import each valid employee
    for (const emp of validEmployees) {
      try {
        // Build payload matching exact Firestore schema
        const payload = {
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
          Photo: emp.Photo,
          photoUrl: emp.photoUrl,
          biometricData: emp.biometricData,
          UpdatedAt: emp.UpdatedAt
        };
        
        // Save to Firestore
        await clientDb.collection('employees').doc(emp.EMPID).set(payload);
        
        successCount++;
        importResults.push({
          EMPID: emp.EMPID,
          EmpName: emp.EmpName,
          Email: emp.Email,
          Phone: emp.Phone,
          Category: emp.Category,
          Designation: emp.Designation,
          Status: 'ACTIVE',  // ✅ Show ACTIVE in export, not "Success"
          Password: emp.PlainPassword,  // Include random password
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
          Error: e.message
        });
        console.error(`Failed to import ${emp.EMPID}:`, e);
      }
    }
    
    // Show results with export button
    let resultHtml = `
      <div style="padding:15px;background:#f0fff4;border:1px solid var(--green);border-radius:6px;">
        <strong style="color:var(--green);font-size:1rem;">✅ Import Complete!</strong><br>
        <span style="font-size:0.95rem;">✓ Success: ${successCount}</span><br>
        ${errorCount > 0 ? `<span style="font-size:0.95rem;">✗ Failed: ${errorCount}</span><br>` : ''}
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
    
    // Cleanup client app
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
 * Exports import results to Excel with passwords
 * Status column shows "ACTIVE" for successful imports
 */
function exportResults() {
  if (importResults.length === 0) { alert('No results to export'); return; }
  
  // Format data for export - Status shows ACTIVE/FAILED
  const exportData = importResults.map(r => ({
    'EMPID': r.EMPID,
    'Name': r.EmpName,
    'Email': r.Email || '',
    'Phone': r.Phone || '',
    'Category': r.Category,
    'Designation': r.Designation,
    'Status': r.Status,  // ✅ Shows "ACTIVE" not "Success"
    'Password': r.Password || 'N/A',  // Random 6-digit password
    'Error': r.Error || ''
  }));
  
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths for better readability
  const wscols = [
    {wch: 12}, // EMPID
    {wch: 25}, // Name
    {wch: 30}, // Email
    {wch: 15}, // Phone
    {wch: 20}, // Category
    {wch: 25}, // Designation
    {wch: 10}, // Status
    {wch: 12}, // Password
    {wch: 30}  // Error
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
  
  // Show empty state
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'flex';
  
  parsedEmployees = [];
  importResults = [];
  currentCompanyId = '';
}