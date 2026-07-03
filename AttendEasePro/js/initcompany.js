/* ══════════════════════════════════════════════════════
   INITCOMPANY.JS - Company Initialization Module
   Dependencies: superadmin.html globals (masterDb, firebase, logToConsole, clearConsole)
   ══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   SECTOR REGISTRY (Categorized Office vs Field)
   ══════════════════════════════════════════════════════ */
const SECTOR_REGISTRY = {
  "CONST": { 
    name: "Construction & Infrastructure", 
    designations: { 
      "Office/Corporate": ["General Manager","AGM","Project Manager","HR Manager","HR Executive","Admin Manager","Admin Executive","Accounts Manager","Accountant","CA/Finance Manager","Design Engineer","Structural Engineer","Architect","Estimator","Quantity Surveyor","Procurement Manager","Store Manager","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Steward"], 
      "Field/Operations": ["Site Engineer","Site Supervisor","Safety Officer","Safety Supervisor","Foreman","Mason","Carpenter","Electrician","Plumber","Welder","Heavy Equipment Operator","Crane Operator","Surveyor","Survey Assistant","Laborer","Helper","Bar Bender","Concrete Mixer Operator","Tile Fitter","Painter","Driver","Security Guard"] 
    } 
  },
  "MFG": { 
    name: "Manufacturing & Factory Operations", 
    designations: { 
      "Office/Corporate": ["Plant Manager","Factory Manager","Production Manager","QA/QC Manager","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Purchase Manager","Store Manager","Inventory Controller","Sales Manager","Maintenance Manager","Design Engineer","Process Engineer","Industrial Engineer","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Canteen Staff"], 
      "Field/Operations": ["Production Supervisor","Shift Incharge","Line Supervisor","Machine Operator","CNC Operator","Fitter","Electrician","Mechanic","Welder","Quality Inspector","Maintenance Technician","Store Keeper","Material Handler","Forklift Operator","Assembly Worker","Helper","Packaging Operator","Loading/Unloading Worker","Safety Officer","Fire & Safety Worker","Housekeeping Staff","Security Guard"] 
    } 
  },
  "SEC": { 
    name: "Security & Facility Management", 
    designations: { 
      "Office/Corporate": ["Operations Manager","Facility Manager","Contract Manager","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Billing Executive","Client Relationship Manager","Quality Manager","Training Manager","Procurement Officer","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Canteen Staff"], 
      "Field/Operations": ["Security Supervisor","Security Guard","CCTV Operator","Access Control Operator","Patrol Supervisor","Control Room Operator","Fire & Safety Officer","Safety Supervisor","Housekeeping Supervisor","Housekeeping Staff","Cleaning Worker","Pest Control Technician","Maintenance Worker","Electrician","Plumber","HVAC Technician","Gardener/Landscaper","Driver","Lift Operator","Pantry Boy/Girl","Office Attendant"] 
    } 
  },
  "LOG": { 
    name: "Logistics, Warehousing & Supply Chain", 
    designations: { 
      "Office/Corporate": ["Operations Manager","Warehouse Manager","Logistics Manager","Supply Chain Manager","Fleet Manager","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Inventory Manager","Purchase Manager","Sales Manager","Dispatch Manager","Customer Service Manager","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Canteen Staff"], 
      "Field/Operations": ["Warehouse Supervisor","Store Supervisor","Inventory Controller","Store Keeper","Forklift Operator","Crane Operator","Picker/Packer","Loading/Unloading Supervisor","Loading Worker","Delivery Driver","Transport Driver","Fleet Coordinator","Dispatch Executive","Gate Keeper","Security Guard","Helper","Material Handler","Quality Checker","Documentation Assistant","Housekeeping Staff"] 
    } 
  },
  "RET": { 
    name: "Retail & Multi-Store Chains", 
    designations: { 
      "Office/Corporate": ["Store Manager","Regional Manager","Area Manager","Operations Manager","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Merchandising Manager","Visual Merchandiser","Marketing Executive","Purchase Manager","Inventory Manager","Customer Service Manager","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Canteen Staff"], 
      "Field/Operations": ["Floor Supervisor","Department Supervisor","Sales Associate","Sales Executive","Cashier","Billing Executive","Customer Service Rep","Stock Handler","Inventory Executive","Visual Merchandising Assistant","Security Incharge","Security Guard","Housekeeping Staff","Helper","Packer","Delivery Boy","Promoter","Brand Ambassador","Housekeeping Supervisor"] 
    } 
  },
  "HLT": { 
    name: "Healthcare & Hospital Networks", 
    designations: { 
      "Office/Corporate": ["Hospital Administrator","Medical Superintendent","Operations Manager","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Finance Manager","Medical Records Manager","Quality Manager","IT Manager","Biomedical Engineer","Pharmacy Manager","Laboratory Manager","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Dietician","Steward"], 
      "Field/Operations": ["Staff Nurse","Nursing Supervisor","Ward Boy/Attendant","Patient Care Assistant","Medical Lab Technician","Radiology Technician","OT Assistant","Operation Theatre Assistant","Pharmacy Executive","Pharmacist","Front Desk Coordinator","Counselor","Physiotherapist","X-Ray Technician","ECG Technician","Dialysis Technician","Housekeeping Staff","Laundry Worker","Security Guard","Driver","Ambulance Driver","Sweeper/Cleaner"] 
    } 
  },
  "FLD": { 
    name: "Field Services & IT Deployment", 
    designations: { 
      "Office/Corporate": ["Operations Manager","Project Manager","Service Manager","Technical Manager","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Procurement Manager","Store Manager","Sales Manager","Client Relationship Manager","Design Engineer","Network Architect","System Engineer","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper"], 
      "Field/Operations": ["Field Technician","Field Engineer","Site Supervisor","Installation Specialist","Telecom Technician","Network Engineer","Service Engineer","Maintenance Technician","Survey Engineer","Rigger","Testing & Commissioning Engineer","Project Coordinator","Cable Technician","Fiber Optic Technician","Tower Technician","Driver","Helper","Security Guard","Store Keeper","Material Handler"] 
    } 
  },
  "EDU": { 
    name: "Education & Universities", 
    designations: { 
      "Office/Corporate": ["Principal/Director","Vice Principal","Administrative Officer","Registrar","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Exam Controller","Admission Officer","Placement Officer","Librarian","IT Manager","Purchase Officer","Store Manager","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Canteen Staff"], 
      "Field/Operations": ["Faculty/Professor","Lecturer","Teaching Assistant","Lab Assistant","Lab Technician","Hostel Warden","Hostel Supervisor","Maintenance Supervisor","Electrician","Plumber","Housekeeping Staff","Security Incharge","Security Guard","Gardener","Driver","Library Assistant","Sports Coach","Counselor","Sweeper/Cleaner"] 
    } 
  },
  "AGR": { 
    name: "Agriculture & Plantations", 
    designations: { 
      "Office/Corporate": ["Farm Manager","Operations Manager","Estate Manager","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Procurement Manager","Quality Manager","Agronomist","Agricultural Engineer","Sales Manager","Store Manager","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Chef/Cook","Kitchen Helper","Canteen Staff"], 
      "Field/Operations": ["Farm Supervisor","Field Supervisor","Irrigation Technician","Harvesting Supervisor","Tractor Operator","Heavy Equipment Operator","Field Worker","Laborer","Helper","Plant Protection Officer","Pest Control Technician","Quality Checker","Grading Supervisor","Cold Storage Manager","Cold Storage Operator","Driver","Security Guard","Gardener","Animal Caretaker","Milker"] 
    } 
  },
  "GOV": { 
    name: "Government & PSU", 
    designations: { 
      "Office/Corporate": ["Section Officer","Under Secretary","Deputy Secretary","Director","HR Manager","HR Executive","Admin Manager","Accounts Manager","Accountant","Audit Officer","IT Officer","Purchase Officer","Store Officer","Liaison Officer","Public Relations Officer","Front Desk Executive","Receptionist","Office Assistant","Peon/Attendant","Driver","Chef/Cook","Kitchen Helper","Canteen Staff"], 
      "Field/Operations": ["Inspector","Sub-Inspector","Constable","Junior Engineer","Assistant Engineer","Technical Assistant","Clerk","Data Entry Operator","Stenographer","Typist","Office Superintendent","Field Assistant","Surveyor","Enumerator","Security Personnel","Security Guard","Housekeeping Staff","Sweeper/Cleaner","Mali/Gardener","Helper"] 
    } 
  },
"CA_LEGAL": {
    name: "CA & Legal Services",
    designations: {
        "Office/Corporate": ["Managing Partner", "Senior Associate", "Junior Associate", "Company Secretary", "Compliance Officer", "Legal Advisor", "Chartered Accountant", "Audit Manager", "Tax Consultant", "Financial Controller", "Accounts Executive", "Office Manager", "HR Manager", "Legal Researcher", "Data Entry Operator", "Front Desk Executive", "Receptionist", "Office Assistant"],
        "Field/Operations": ["Litigation Associate", "Court Clerk", "Paralegal", "Internal Auditor", "Field Verification Officer", "Recovery Agent", "Documentation Assistant", "IT Support", "Driver", "Office Boy/Attendant"]
    }
},
"HOTEL_PG": {
    name: "Hotel & PG Management",
    designations: {
        "Office/Corporate": ["General Manager", "Operations Manager", "Revenue Manager", "Sales & Marketing Manager", "HR Manager", "Accounts Manager", "Front Office Manager", "Reservation Executive", "Purchase Manager", "Front Desk Executive", "Receptionist", "Admin Executive"],
        "Field/Operations": ["Paying Guest","Duty Manager", "Guest Relation Executive", "Housekeeping Supervisor", "Room Attendant", "Chef", "Kitchen Helper", "Restaurant Manager", "Waiter/Steward", "Maintenance Supervisor", "Electrician", "Plumber", "Security Guard", "Laundry Staff", "Hostel Warden", "Caretaker", "Gardener", "Driver"]
    }
}


};

/* ══════════════════════════════════════════════════════
   INTERNAL HELPER: Ensure collection/doc exists
   ══════════════════════════════════════════════════════ */
async function _ensureCollection(clientDb, companyId, colName, docId, docData, isEmployee = false, fields = {}) {
  const now = new Date();
  const dateTimestamp = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  const defaultPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
  
  try {
    const check = await clientDb.collection(colName).limit(1).get();
    
    // ✅ For employees: migrate ALL existing employees to new field structure
    if (isEmployee && !check.empty) {
      logToConsole(`  ✓ Employees collection has data. Migrating ALL employees to new structure...`, 'info');
      
      const allEmps = await clientDb.collection(colName)
        .where('companyId', '==', companyId)
        .get();
      
      let updatedCount = 0;
      for (const empDoc of allEmps.docs) {
        const empData = empDoc.data();
        const updateData = {};
        
        // ✅ Check and migrate OLD fields to NEW structure
        if (empData.Photo === undefined) updateData.Photo = null;
        if (empData.biometricData === undefined) {
          if (empData.photoUrl) {
            updateData.biometricData = [empData.photoUrl];
            updateData.photoUrl = firebase.firestore.FieldValue.delete();
          } else {
            updateData.biometricData = [];
          }
        }
        
        // Ensure other missing fields
        if (empData.Designation === undefined) updateData.Designation = '';
        if (empData.EffectiveDate === undefined) updateData.EffectiveDate = dateTimestamp;
        if (empData.JoinDate === undefined) updateData.JoinDate = dateTimestamp;
        if (empData.PasswordHash === undefined) updateData.PasswordHash = '';
        if (empData.Role === undefined) updateData.Role = 'EMPLOYEE';
        if (empData.Site === undefined) updateData.Site = '';
        if (empData.Status === undefined) updateData.Status = 'ACTIVE';
        if (empData.UpdatedAt === undefined) updateData.UpdatedAt = new Date().toISOString();
        
        if (Object.keys(updateData).length > 0) {
          updateData.updatedAt = new Date();
          await empDoc.ref.update(updateData);
          updatedCount++;
          logToConsole(`  ✓ Migrated ${empData.EMPID || empDoc.id}`, 'success');
          if (updateData.biometricData) {
            logToConsole(`    └─ biometricData: ${updateData.biometricData.length} template(s)`, 'info');
          }
        }
      }
      
      logToConsole(`  ✓ Migrated ${updatedCount} employee(s) to new structure`, 'success');
      return true;
    }
    
    // For other collections: skip if has data
    if (!check.empty && !isEmployee) {
      logToConsole(`  ✓ Collection already has data. Skipping.`, 'warn');
      return true;
    }
    
    // For new employee: create initial admin with NEW field structure
    if (isEmployee && check.empty) {
      const payload = { 
        ...docData, 
        companyId, 
        _template: true, 
        createdAt: now, 
        ...fields,
        Photo: null,              // ✅ BYTES type (null initially)
        biometricData: []         // ✅ ARRAY type (empty initially)
      };
      await clientDb.collection(colName).doc(docId).set(payload);
      logToConsole(`  ✓ Created initial employee: ${docId}`, 'success');
      logToConsole(`  └─ Photo: null (BYTES)`, 'info');
      logToConsole(`  └─ biometricData: [] (ARRAY)`, 'info');
      return true;
    }
    
    // For other new collections: create template doc
    const payload = { ...docData, companyId, _template: true, createdAt: now, ...fields };
    await clientDb.collection(colName).doc(docId).set(payload);
    logToConsole(`  ✓ Created document: ${docId}`, 'success');
    logToConsole(`  └─ Fields: ${Object.keys(payload).join(', ')}`, 'info');
    return true;
  } catch (e) {
    logToConsole(`  ✗ Failed: ${e.message}`, 'error');
    return false;
  }
}

/* ══════════════════════════════════════════════════════
   NEW PAYROLL INITIALIZATION (Master + Monthly)
══════════════════════════════════════════════════════ */
async function initializePayrollStructure(clientDb, companyId) {
  try {
    console.log('📝 Initializing new Payroll Structure...');

    // 1. Create Payroll Master (Static Info)
    await clientDb.collection('payrollMaster').doc('EMP001').set({
      companyId: companyId,
      EMPID: 'EMP001',
      bankAccount: '123456789012',
      ifsc: 'HDFC0001234',
      pan: 'ABCDE1234F',
      aadhaar: '123456789012',
      pfAccountNo: 'KA/BLR/12345/000/0001234',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Create Sample Monthly Data (Current Month)
    const now = new Date();
    const monthKey = String(now.getMonth() + 1).padStart(2, '0');
    const yearKey = String(now.getFullYear()).slice(-2);
    const monthlyCollName = `payroll_${monthKey}_${yearKey}`;

    await clientDb.collection(monthlyCollName).doc('EMP001').set({
      companyId: companyId,
      EMPID: 'EMP001',
      earnings: {
        basic_salary: 25000,
        da: 0,
        hra: 12000,
        conveyance: 5000,
        medical: 250,
        special_allowance: 500,
        ta: 0,
        ma: 0,
        variable_pay: 0,
        performance: 0,
        incentives: 0,
        onsite_allowances: 0,
        bonus: 0,
        other_allowances: 0
      },
      deductions: {
        epf: 1500,
        esi: 0,
        tds: 2000,
        mobile_deduction: 0,
        pt: 200,
        lop: 0,
        vpf: 0,
        fa: 0,
        advance: 0,
        recoveries: 0,
        other_deductions: 0
      },
      summary: {
        gross: 42750,
        total_deductions: 3700,
        net_pay: 39050
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ New Payroll Structure Initialized');
    return true;
  } catch (e) {
    console.error('❌ Payroll Init Error:', e);
    return false;
  }
}
// Call this in your main init flow: await initializePayrollStructure(clientDb, companyId);



/* ══════════════════════════════════════════════════════
   CORE: Run company initialization
   ══════════════════════════════════════════════════════ */
async function runCompanyInitialization(companyId) {
  logToConsole(`🚀 Starting company initialization for: ${companyId}`, 'info');
  
  // Fetch company data to get admin email
  logToConsole('📥 Fetching company data from Master Firestore...', 'info');
  const snap = await masterDb.collection('companies').doc(companyId).get();
  if (!snap.exists) throw new Error('Company not found');
  
  const companyData = snap.data();
  const adminEmail = companyData.adminEmail || `admin@${companyId.toLowerCase()}.com`;
  const companyName = companyData.companyName || companyId;
  
  // Get Client Firebase config
  const clientConfig = companyData.firebaseConfig;
  if (!clientConfig || !clientConfig.apiKey) {
    throw new Error('Client Firebase config not found. Please update config first.');
  }
  
  logToConsole(`✓ Found Config: ${clientConfig.projectId}`, 'success');
  logToConsole('🔌 Connecting to Client Firebase...', 'info');
  
  // Initialize Client Firebase (temporary app for initialization)
  let clientApp;
  try {
    try {
      clientApp = firebase.app('client-init');
    } catch (e) {
      clientApp = firebase.initializeApp(clientConfig, 'client-init');
    }
    const clientDb = clientApp.firestore();
    logToConsole('✓ Connected to Client Firestore', 'success');
    logToConsole('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    
    // ══════════════════════════════════════════════════════
    // ✅ SECTOR INITIALIZATION (Zero Data Loss)
    // ══════════════════════════════════════════════════════
    const sectorCode = window.initializingSector || 'CONST';
    const sectorData = SECTOR_REGISTRY[sectorCode] || SECTOR_REGISTRY["CONST"];
    const sectorLabel = `${sectorCode}-${sectorData.name}`;
    
    // 1. Master Firestore: Add sector field safely (merge: true)
    logToConsole(`\n📦 Updating Master Company record...`, 'info');
    await masterDb.collection('companies').doc(companyId).set({
      sector: sectorLabel
    }, { merge: true });
    logToConsole(`  ✓ sector field added: "${sectorLabel}"`, 'success');
    
    // 2. Client Firestore: Create sectors collection & doc
    logToConsole(`\n📦 Creating Client sectors collection...`, 'info');
    await clientDb.collection('sectors').doc(sectorCode).set({
      code: sectorCode,
      name: sectorData.name,
      designations: sectorData.designations,
      createdAt: new Date()
    });
    const totalDesig = Object.values(sectorData.designations).flat().length;
    logToConsole(`  ✓ sectors/${sectorCode} created with ${totalDesig} designations`, 'success');
    logToConsole(`  └─ Office/Corporate: ${sectorData.designations["Office/Corporate"].length}`, 'info');
    logToConsole(`  └─ Field/Operations: ${sectorData.designations["Field/Operations"].length}`, 'info');
    logToConsole('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    
    const now = new Date();
    const dateTimestamp = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
    const defaultPasswordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
    const empId = companyId.slice(0, 3).toUpperCase() + '101';
    
    let created = false;
    
    // 1. Employees (with NEW field structure + migration)
    const empCreated = await _ensureCollection(clientDb, companyId, 'employees', empId, {
      EMPID: empId, 
      EmpName: 'Update Name', 
      Email: adminEmail, 
      Phone: ' ',
      Designation: 'Manager', 
      PasswordHash: defaultPasswordHash, 
      Role: 'ADMIN',
      Site: 'SITE001', 
      Status: 'ACTIVE', 
      JoinDate: dateTimestamp,
      EffectiveDate: dateTimestamp, 
      updatedAt: now
    }, true, {
      PasswordHash: defaultPasswordHash,
      Role: 'ADMIN',
      Site: 'SITE001',
      Status: 'ACTIVE',
      Photo: null,
      biometricData: []
    });
    if (empCreated) created = true;
    
    // 2. Leave Balances
    const lbCreated = await _ensureCollection(clientDb, companyId, 'leave_balances', empId, {
      EMPID: empId,
      empName: 'Update Name',
      leaveYear: now.getFullYear(),
      privilege_leave: { total: 20, utilized: 0, balance: 20, carried_fwd: 0 },
      casual_leave: { total: 12, utilized: 0, balance: 12 },
      sick_leave: { total: 12, utilized: 0, balance: 12 },
      comp_off: { total: 0, utilized: 0, balance: 0 },
      maternity_leave: { total: 0, utilized: 0 },
      loss_of_pay: 0,
      lastUpdated: now
    }, true);
    if (lbCreated) created = true;
    
    // 3. Sites
    const sitesCreated = await _ensureCollection(clientDb, companyId, 'sites', 'SITE001', {
      SiteID: 'SITE001', SiteName: 'Head Office', Address: 'Update Address',
      Latitude: 12.9716, Longitude: 77.5946, Radius: 100,
      ShiftStart: '09:00', ShiftEnd: '18:00', LunchTime: '13:00', Status: 'ACTIVE'
    }, false, {
      SiteName: 'Head Office',
      Latitude: 12.9716,
      Longitude: 77.5946,
      Radius: 100,
      ShiftStart: '09:00',
      ShiftEnd: '18:00'
    });
    if (sitesCreated) created = true;
    
    // 4. Holidays
    const holCreated = await _ensureCollection(clientDb, companyId, 'holidays', 'HOL001', {
      HolidayID: 'HOL001', HolidayName: 'Republic Day',
      Date: new Date(now.getFullYear(), 0, 26), Type: 'National Holiday',
      Day: 'Monday', ApplicableSites: 'ALL', State: 'ALL', Description: 'Gazetted Holiday'
    }, false, {
      HolidayName: 'Republic Day',
      Type: 'National Holiday',
      Day: 'Monday'
    });
    if (holCreated) created = true;
    
    // 5. Weekly Offs
    const woCreated = await _ensureCollection(clientDb, companyId, 'weekly_offs', 'SITE001', {
      SiteID: 'SITE001', WeeklyOff1: 'Sunday', WeeklyOff2: 'None',
      EffectiveFrom: dateTimestamp, Remarks: 'Standard single off'
    }, false, {
      WeeklyOff1: 'Sunday',
      WeeklyOff2: 'None',
      Remarks: 'Standard single off'
    });
    if (woCreated) created = true;
    
    // 6. Attendance
    const attCreated = await _ensureCollection(clientDb, companyId, 'attendance', '_visible', {
      Note: 'Template doc - safe to delete when real records exist', Status: 'TEMPLATE'
    }, false, {
      Note: 'Template doc',
      Status: 'TEMPLATE'
    });
    if (attCreated) created = true;
    
    // 7. Settings Collection (Company Branding + App Update Config)
    const settingsCreated = await _ensureCollection(clientDb, companyId, 'settings', companyId, {
      companyId: companyId,
      branding: {
        logo: null,
        primaryColor: '#00838F'
      },
      updateConfig: {
        latestVersionCode: 100,
        downloadUrl: 'https://github.com/drushyasinchana/drushyasinchana/releases/latest/download/AttendEasePro.apk',
        isForceUpdate: false,
        releaseNotes: 'Initial release - AttendEase Pro v1.0',
        updatedAt: new Date().toISOString()
      }
    }, false, {
      branding: { logo: null, primaryColor: '#00838F' },
      updateConfig: {
        latestVersionCode: 100,
        downloadUrl: 'https://github.com/drushyasinchana/drushyasinchana/releases/latest/download/AttendEasePro.apk',
        isForceUpdate: false
      }
    });
    if (settingsCreated) created = true;
    
    logToConsole('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    
    // ══════════════════════════════════════════════════════
    // ✅ ATTENDEASE PRO - PAYROLL INITIALIZATION
    // ══════════════════════════════════════════════════════
    try {
      const payrollInit = await initializePayrollStructure(clientDb, companyId);
      if (payrollInit) {
        logToConsole(`  ✅ AttendEase Pro Payroll collections created`, 'success');
      }
    } catch (payErr) {
      logToConsole(`  ⚠️ Payroll init skipped: ${payErr.message}`, 'warn');
    }
    
    // ══════════════════════════════════════════════════════
    // ✅ INVOICEEASE PRO - MINIMAL INIT (Same clientDb scope)
    // ══════════════════════════════════════════════════════
    try {
      const prefix = companyId.slice(0,3).toUpperCase();
      const fy = `${new Date().getFullYear()}-${(new Date().getFullYear()+1).toString().slice(-2)}`;
      
      // 1. Company Profile
      await clientDb.collection('companyProfile').doc(companyId).set({
        companyId, 
        companyName, 
        gstn: '', 
        pan: '', 
        address: '', 
        city: '', 
        state: '', 
        pincode: '',
        phone: companyData.contactPhone || '', 
        email: adminEmail, 
        accountName: companyName,
        bankDetails: { bankName: '', accountNumber: '', ifscCode: '', branch: '' },
        logoUrl: '', 
        signatureUrl: '', 
        logoType: '', 
        signatureType: '',
        invoicePrefix: prefix, 
        invoiceStartNumber: 935, 
        financialYear: fy,
        createdAt: new Date(), 
        updatedAt: new Date()
      });
      
      // 2. Sequences
      await clientDb.collection('sequences').doc('invoiceNumber').set({
        prefix, currentNumber: 935, financialYear: fy,
        lastResetDate: new Date(), updatedAt: new Date()
      });
      
      // 3. Particulars (3 items from PDF)
      const items = [
        {itemName:'3 TON 2 MTRS SILLING BELT', sacCode:'997313', rate:859, unit:'NO', gstRate:18, cgstRate:9, sgstRate:9, isActive:true},
        {itemName:'Installation Charges', sacCode:'995413', rate:1000, unit:'LS', gstRate:18, cgstRate:9, sgstRate:9, isActive:true},
        {itemName:'Maintenance Service', sacCode:'998713', rate:500, unit:'HRS', gstRate:18, cgstRate:9, sgstRate:9, isActive:true}
      ];
      for (const it of items) {
        await clientDb.collection('invoiceParticulars').add({...it, companyId, createdAt:new Date(), _sample:true});
      }
      
      // 4. Customer (Funder Max from PDF)
      await clientDb.collection('customers').doc('CUST001').set({
        customerId:'CUST001', customerName:'INDIA PVT LTD',
        gstn:'DUMMYGSTN', pan:'ABCD1232Z',
        address:'Sy No. , Village, Hobli, Bangalore, Karnataka, INDIA',
        city:'Bangalore', state:'Karnataka', pincode:'560064',
        contactPerson:'', phone:'', email:'', isActive:true,
        companyId, createdAt:new Date(), _sample:true
      });
      
      // 5. Invoices template
      await clientDb.collection('invoices').doc('_template').set({
        _note:'Template - safe to delete', companyId, createdAt:new Date()
      });
      
      logToConsole(`  ✅ InvoiceEase Pro collections created in CLIENT Firestore`, 'success');
    } catch (invErr) {
      logToConsole(`  ⚠️ Invoice init skipped: ${invErr.message}`, 'warn');
      // Don't throw - allow rest of initialization to complete
    }
    
    if (created) {
      logToConsole('🏁 Initialization complete! All collections created.', 'success');
      logToConsole(`\n📋 Initial Admin Credentials:`, 'info');
      logToConsole(`   Employee ID: ${empId}`, 'info');
      logToConsole(`   Password: 123456`, 'info');
      logToConsole(`   Email: ${adminEmail}`, 'info');
      logToConsole(`\n📋 NEW Employee Field Structure:`, 'info');
      logToConsole(`   - Photo: null (BYTES type - for profile photo)`, 'info');
      logToConsole(`   - biometricData: [] (ARRAY type - for face/fingerprint templates)`, 'info');
      logToConsole(`\n Migration Applied:`, 'info');
      logToConsole(`   - Old photoUrl field converted to biometricData array`, 'info');
      logToConsole(`   - All existing employees updated with new structure`, 'info');
    } else {
      logToConsole('✅ All collections already exist. Fields migrated if needed.', 'warn');
    }
    
    // Cleanup
    try {
      firebase.app('client-init').delete();
      logToConsole('\n🔌 Disconnected from Client Firebase', 'info');
    } catch (e) {}
    
  } catch (e) {
    logToConsole(`💥 Initialization failed: ${e.message}`, 'error');
    try {
      firebase.app('client-init').delete();
    } catch (e) {}
    throw e;
  }
}

/* ══════════════════════════════════════════════════════
   PUBLIC: Initialize Company (called from HTML button)
   ══════════════════════════════════════════════════════ */
async function initializeCompany() {
  const companyId = document.getElementById('initCompanyId')?.value.trim().toUpperCase();
  const sectorCode = document.getElementById('companySector')?.value;
  const result = document.getElementById('initResult');
  
  if (!companyId) {
    if (result) result.innerHTML = '<div class="result-box error">Please enter a Company ID.</div>';
    return;
  }
  if (!sectorCode) {
    if (result) result.innerHTML = '<div class="result-box error">Please select an Industry Sector.</div>';
    return;
  }
  
  if (!confirm(`Initialize Company: ${companyId}?\n\nSector: ${sectorCode}\n\nThis will create initial collections and data.\nRun only once per company!`)) {
    return;
  }
  
  if (typeof clearConsole === 'function') clearConsole();
  if (typeof logToConsole === 'function') logToConsole('🚀 Starting company initialization...', 'info');
  
  try {
    const btn = document.getElementById('btnInitCompany');
    if (btn) { btn.disabled = true; btn.textContent = 'Initializing...'; }
    
    // Pass sector to initialization function via global temp variable
    window.initializingSector = sectorCode;
    await runCompanyInitialization(companyId);
    delete window.initializingSector;
    
    if (result) result.innerHTML = '<div class="result-box success">✅ Company initialized successfully!</div>';
    
  } catch (e) {
    if (result) result.innerHTML = `<div class="result-box error">❌ Initialization Error: ${e.message}</div>`;
    if (typeof logToConsole === 'function') logToConsole(`💥 Error: ${e.message}`, 'error');
    console.error('Init error:', e);
  } finally {
    const btn = document.getElementById('btnInitCompany');
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Initialize Company'; }
  }
}