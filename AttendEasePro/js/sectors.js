/* ══════════════════════════════════════════════════════
   SECTORS.JS - Categorized Designation Loader
   Office vs Field roles for cleaner dropdowns
   Dependencies: S.prefs.companyId, S.clientDb (from manage.js)
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   SECTOR REGISTRY - Full designation lists per sector
══════════════════════════════════════════════════════ */
const SECTOR_REGISTRY = {
  "CONST": {
    name: "Construction & Infrastructure",
    designations: {
      "Office/Corporate": [
        "Managing Director","Director","General Manager", "AGM", "Project Manager", "HR Manager", "HR Executive",
        "Admin Manager", "Admin Executive", "Accounts Manager", "Accountant", "CA/Finance Manager",
        "Design Engineer", "Structural Engineer", "Architect", "Estimator", "Quantity Surveyor",
        "Procurement Manager", "Store Manager", "Front Desk Executive", "Receptionist",
        "Office Assistant", "Peon/Attendant", "Chef/Cook", "Kitchen Helper", "Steward", "Dy.Manager", "Service Manager"
      ],
      "Field/Operations": [
        "Site Engineer", "Site Supervisor", "Safety Officer", "Safety Supervisor",
        "Foreman", "Mason", "Carpenter", "Electrician", "Plumber", "Welder",
        "Heavy Equipment Operator", "Crane Operator", "Surveyor", "Survey Assistant",
        "Laborer", "Helper", "Bar Bender", "Concrete Mixer Operator", "Tile Fitter",
        "Painter", "Driver", "Security Guard", "Field Worker"
      ]
    }
  },
  "MFG": {
    name: "Manufacturing & Factory Operations",
    designations: {
      "Office/Corporate": [
        "Plant Manager", "Factory Manager", "Production Manager", "QA/QC Manager",
        "HR Manager", "HR Executive", "Admin Manager", "Accounts Manager", "Accountant",
        "Purchase Manager", "Store Manager", "Inventory Controller", "Sales Manager",
        "Maintenance Manager", "Design Engineer", "Process Engineer", "Industrial Engineer",
        "Front Desk Executive", "Receptionist", "Office Assistant", "Peon/Attendant",
        "Chef/Cook", "Kitchen Helper", "Canteen Staff"
      ],
      "Field/Operations": [
        "Production Supervisor", "Shift Incharge", "Line Supervisor", "Machine Operator",
        "CNC Operator", "Fitter", "Electrician", "Mechanic", "Welder", "Quality Inspector",
        "Maintenance Technician", "Store Keeper", "Material Handler", "Forklift Operator",
        "Assembly Worker", "Helper", "Packaging Operator", "Loading/Unloading Worker",
        "Safety Officer", "Fire & Safety Worker", "Housekeeping Staff", "Security Guard"
      ]
    }
  },
  "SEC": {
    name: "Security & Facility Management",
    designations: {
      "Office/Corporate": [
        "Operations Manager", "Facility Manager", "Contract Manager", "HR Manager",
        "HR Executive", "Admin Manager", "Accounts Manager", "Accountant", "Billing Executive",
        "Client Relationship Manager", "Quality Manager", "Training Manager", "Procurement Officer",
        "Front Desk Executive", "Receptionist", "Office Assistant", "Peon/Attendant",
        "Chef/Cook", "Kitchen Helper", "Canteen Staff"
      ],
      "Field/Operations": [
        "Security Supervisor", "Security Guard", "CCTV Operator", "Access Control Operator",
        "Patrol Supervisor", "Control Room Operator", "Fire & Safety Officer", "Safety Supervisor",
        "Housekeeping Supervisor", "Housekeeping Staff", "Cleaning Worker", "Pest Control Technician",
        "Maintenance Worker", "Electrician", "Plumber", "HVAC Technician", "Gardener/Landscaper",
        "Driver", "Lift Operator", "Pantry Boy/Girl", "Office Attendant"
      ]
    }
  },
  "LOG": {
    name: "Logistics, Warehousing & Supply Chain",
    designations: {
      "Office/Corporate": [
        "Operations Manager", "Warehouse Manager", "Logistics Manager", "Supply Chain Manager",
        "Fleet Manager", "HR Manager", "HR Executive", "Admin Manager", "Accounts Manager",
        "Accountant", "Inventory Manager", "Purchase Manager", "Sales Manager", "Dispatch Manager",
        "Customer Service Manager", "Front Desk Executive", "Receptionist", "Office Assistant",
        "Peon/Attendant", "Chef/Cook", "Kitchen Helper", "Canteen Staff"
      ],
      "Field/Operations": [
        "Warehouse Supervisor", "Store Supervisor", "Inventory Controller", "Store Keeper",
        "Forklift Operator", "Crane Operator", "Picker/Packer", "Loading/Unloading Supervisor",
        "Loading Worker", "Delivery Driver", "Transport Driver", "Fleet Coordinator",
        "Dispatch Executive", "Gate Keeper", "Security Guard", "Helper", "Material Handler",
        "Quality Checker", "Documentation Assistant", "Housekeeping Staff"
      ]
    }
  },
  "RET": {
    name: "Retail & Multi-Store Chains",
    designations: {
      "Office/Corporate": [
        "Store Manager", "Regional Manager", "Area Manager", "Operations Manager",
        "HR Manager", "HR Executive", "Admin Manager", "Accounts Manager", "Accountant",
        "Merchandising Manager", "Visual Merchandiser", "Marketing Executive", "Purchase Manager",
        "Inventory Manager", "Customer Service Manager", "Front Desk Executive", "Receptionist",
        "Office Assistant", "Peon/Attendant", "Chef/Cook", "Kitchen Helper", "Canteen Staff"
      ],
      "Field/Operations": [
        "Floor Supervisor", "Department Supervisor", "Sales Associate", "Sales Executive",
        "Cashier", "Billing Executive", "Customer Service Rep", "Stock Handler",
        "Inventory Executive", "Visual Merchandising Assistant", "Security Incharge",
        "Security Guard", "Housekeeping Staff", "Helper", "Packer", "Delivery Boy",
        "Promoter", "Brand Ambassador", "Housekeeping Supervisor"
      ]
    }
  },
  "HLT": {
    name: "Healthcare & Hospital Networks",
    designations: {
      "Office/Corporate": [
        "Hospital Administrator", "Medical Superintendent", "Operations Manager", "HR Manager",
        "HR Executive", "Admin Manager", "Accounts Manager", "Accountant", "Finance Manager",
        "Medical Records Manager", "Quality Manager", "IT Manager", "Biomedical Engineer",
        "Pharmacy Manager", "Laboratory Manager", "Front Desk Executive", "Receptionist",
        "Office Assistant", "Peon/Attendant", "Chef/Cook", "Kitchen Helper", "Dietician", "Steward"
      ],
      "Field/Operations": [
        "Staff Nurse", "Nursing Supervisor", "Ward Boy/Attendant", "Patient Care Assistant",
        "Medical Lab Technician", "Radiology Technician", "OT Assistant", "Operation Theatre Assistant",
        "Pharmacy Executive", "Pharmacist", "Front Desk Coordinator", "Counselor", "Physiotherapist",
        "X-Ray Technician", "ECG Technician", "Dialysis Technician", "Housekeeping Staff",
        "Laundry Worker", "Security Guard", "Driver", "Ambulance Driver", "Sweeper/Cleaner"
      ]
    }
  },
  "FLD": {
    name: "Field Services & IT Deployment",
    designations: {
      "Office/Corporate": [
        "Operations Manager", "Project Manager", "Service Manager", "Technical Manager",
        "HR Manager", "HR Executive", "Admin Manager", "Accounts Manager", "Accountant",
        "Procurement Manager", "Store Manager", "Sales Manager", "Client Relationship Manager",
        "Design Engineer", "Network Architect", "System Engineer", "Front Desk Executive",
        "Receptionist", "Office Assistant", "Peon/Attendant", "Chef/Cook", "Kitchen Helper"
      ],
      "Field/Operations": [
        "Field Technician", "Field Engineer", "Site Supervisor", "Installation Specialist",
        "Telecom Technician", "Network Engineer", "Service Engineer", "Maintenance Technician",
        "Survey Engineer", "Rigger", "Testing & Commissioning Engineer", "Project Coordinator",
        "Cable Technician", "Fiber Optic Technician", "Tower Technician", "Driver",
        "Helper", "Security Guard", "Store Keeper", "Material Handler"
      ]
    }
  },
  "EDU": {
    name: "Education & Universities",
    designations: {
      "Office/Corporate": [
        "Principal/Director", "Vice Principal", "Administrative Officer", "Registrar",
        "HR Manager", "HR Executive", "Admin Manager", "Accounts Manager", "Accountant",
        "Exam Controller", "Admission Officer", "Placement Officer", "Librarian", "IT Manager",
        "Purchase Officer", "Store Manager", "Front Desk Executive", "Receptionist",
        "Office Assistant", "Peon/Attendant", "Chef/Cook", "Kitchen Helper", "Canteen Staff"
      ],
      "Field/Operations": [
        "Faculty/Professor", "Lecturer", "Teaching Assistant", "Lab Assistant",
        "Lab Technician", "Hostel Warden", "Hostel Supervisor", "Maintenance Supervisor",
        "Electrician", "Plumber", "Housekeeping Staff", "Security Incharge", "Security Guard",
        "Gardener", "Driver", "Library Assistant", "Sports Coach", "Counselor", "Sweeper/Cleaner"
      ]
    }
  },
  "AGR": {
    name: "Agriculture & Plantations",
    designations: {
      "Office/Corporate": [
        "Farm Manager", "Operations Manager", "Estate Manager", "HR Manager", "HR Executive",
        "Admin Manager", "Accounts Manager", "Accountant", "Procurement Manager",
        "Quality Manager", "Agronomist", "Agricultural Engineer", "Sales Manager",
        "Store Manager", "Front Desk Executive", "Receptionist", "Office Assistant",
        "Peon/Attendant", "Chef/Cook", "Kitchen Helper", "Canteen Staff"
      ],
      "Field/Operations": [
        "Farm Supervisor", "Field Supervisor", "Irrigation Technician", "Harvesting Supervisor",
        "Tractor Operator", "Heavy Equipment Operator", "Field Worker", "Laborer", "Helper",
        "Plant Protection Officer", "Pest Control Technician", "Quality Checker", "Grading Supervisor",
        "Cold Storage Manager", "Cold Storage Operator", "Driver", "Security Guard",
        "Gardener", "Animal Caretaker", "Milker"
      ]
    }
  },
  "GOV": {
    name: "Government & PSU",
    designations: {
      "Office/Corporate": [
        "Section Officer", "Under Secretary", "Deputy Secretary", "Director",
        "HR Manager", "HR Executive", "Admin Manager", "Accounts Manager", "Accountant",
        "Audit Officer", "IT Officer", "Purchase Officer", "Store Officer", "Liaison Officer",
        "Public Relations Officer", "Front Desk Executive", "Receptionist", "Office Assistant",
        "Peon/Attendant", "Driver", "Chef/Cook", "Kitchen Helper", "Canteen Staff"
      ],
      "Field/Operations": [
        "Inspector", "Sub-Inspector", "Constable", "Junior Engineer", "Assistant Engineer",
        "Technical Assistant", "Clerk", "Data Entry Operator", "Stenographer", "Typist",
        "Office Superintendent", "Field Assistant", "Surveyor", "Enumerator", "Security Personnel",
        "Security Guard", "Housekeeping Staff", "Sweeper/Cleaner", "Mali/Gardener", "Helper"
      ]
    }
  }
};

/* ══════════════════════════════════════════════════════
   Get sector code for current company (with caching)
══════════════════════════════════════════════════════ */
async function getSectorCode() {
  // 1. Return cached if available
  if (window.S?.prefs?.sectorCode) {
    return window.S.prefs.sectorCode;
  }
  
  // 2. Get from client settings collection
  try {
    const companyId = window.S?.prefs?.companyId;
    const clientDb = window.S?.clientDb;
    
    if (!companyId || !clientDb) {
      console.warn('⚠️ Cannot fetch sector: missing companyId or clientDb');
      return 'CONST'; // Default fallback
    }
    
    const settingsDoc = await clientDb.collection('settings').doc(companyId).get();
    if (settingsDoc.exists && settingsDoc.data().sectorCode) {
      const sectorCode = settingsDoc.data().sectorCode;
      // Cache for future use
      if (!window.S.prefs) window.S.prefs = {};
      window.S.prefs.sectorCode = sectorCode;
      return sectorCode;
    }
  } catch (e) {
    console.warn('⚠️ Failed to fetch sector from Firestore:', e.message);
  }
  
  // 3. Default fallback
  return 'CONST';
}

/* ══════════════════════════════════════════════════════
   Load ALL designations for current sector into dropdown
   Creates optgroups for Office/Field separation
══════════════════════════════════════════════════════ */
async function loadDesignationsForSector() {
  const select = document.getElementById('eDesignation');
  if (!select) return;
  
  // Clear existing options
  select.innerHTML = '<option value="">— Select Designation —</option>';
  
  try {
    // Get sector code (with caching)
    const sectorCode = await getSectorCode();
    const sectorData = SECTOR_REGISTRY[sectorCode];
    
    if (!sectorData) {
      console.warn(`⚠️ Sector "${sectorCode}" not found in registry`);
      loadFallbackDesignations(select, null); // Load all fallback
      return;
    }
    
    const categories = sectorData.designations;
    
    // Create optgroups for each category
    Object.keys(categories).forEach(category => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = category;
      
      categories[category].forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        optgroup.appendChild(opt);
      });
      
      select.appendChild(optgroup);
    });
    
    console.log(`✅ Loaded designations for sector: ${sectorCode}`);
    
  } catch (e) {
    console.error('❌ Failed to load designations:', e);
    loadFallbackDesignations(select, null); // Load all fallback
  }
}

/* ══════════════════════════════════════════════════════
   Filter designations by category (Office/Field)
   Called when #eCategory dropdown changes in Employee Modal
══════════════════════════════════════════════════════ */
async function onCategoryChange() {
  console.log('🔄 Category changed, loading designations...');
  
  const category = document.getElementById('eCategory')?.value;
  const designationSelect = document.getElementById('eDesignation');
  
  if (!category || !designationSelect) {
    console.warn('⚠️ Category or designation select not found');
    return;
  }
  
  // Reset designation dropdown
  designationSelect.innerHTML = '<option value="">— Select Designation —</option>';
  
  try {
    // Get sector code (with caching)
    const sectorCode = await getSectorCode();
    const sectorData = SECTOR_REGISTRY[sectorCode];
    
    if (!sectorData) {
      console.warn(`⚠️ Sector "${sectorCode}" not found in registry`);
      loadFallbackDesignations(designationSelect, category);
      return;
    }
    
    // Get designations for selected category
    const designations = sectorData.designations?.[category] || [];
    
    if (designations.length === 0) {
      designationSelect.innerHTML = '<option value="">— No Designations Found —</option>';
      console.log(`⚠️ No designations for category: ${category}`);
      return;
    }
    
    // Populate designation dropdown
    designations.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      designationSelect.appendChild(opt);
    });
    
    console.log(`✅ Loaded ${designations.length} designations for ${category} (${sectorCode})`);
    
  } catch (e) {
    console.error('❌ Failed to load designations:', e);
    loadFallbackDesignations(designationSelect, category);
  }
}

/* ══════════════════════════════════════════════════════
   Fallback: Loads FULL hardcoded designations if Firestore fails
   Uses the same data as SECTOR_REGISTRY for consistency
══════════════════════════════════════════════════════ */
function loadFallbackDesignations(select, category) {
  // Use CONST sector as default fallback (has comprehensive lists)
  const fallbackData = SECTOR_REGISTRY["CONST"];
  
  if (!fallbackData) {
    select.innerHTML = '<option value="">— Error Loading Designations —</option>';
    return;
  }
  
  // If category specified, filter; otherwise load all
  let designations = [];
  if (category && fallbackData.designations[category]) {
    designations = fallbackData.designations[category];
  } else {
    // Load all designations from both categories
    Object.values(fallbackData.designations).forEach(catList => {
      designations = designations.concat(catList);
    });
  }
  
  if (designations.length === 0) {
    select.innerHTML = '<option value="">— No Designations —</option>';
    return;
  }
  
  // Populate dropdown
  designations.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
  
  console.log(`⚠️ Loaded ${designations.length} fallback designations${category ? ` for ${category}` : ''}`);
}

/* ══════════════════════════════════════════════════════
   Helper: Reset designation dropdown when category is cleared
══════════════════════════════════════════════════════ */
function resetDesignationDropdown() {
  const select = document.getElementById('eDesignation');
  if (select) {
    select.innerHTML = '<option value="">— Select Category First —</option>';
  }
}