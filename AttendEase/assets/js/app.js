// ========================
//  AttendEase Portal JS
//  Drushyasinchana Tech Solutions
// ========================

// ---------- GLOBAL STATE ----------
let currentUser = null;           // { companyEmail, adminId, adminName }
let employees = [];               // employee objects
let sites = [];                   // site objects
let attendanceRecords = [];       // attendance objects
let editingEmployeeId = null;
let editingSiteId = null;

// ---------- MOCK DATA (demo/fallback) ----------
const MOCK_EMPLOYEES = [
  { id: "emp1", code: "EMP001", name: "Ramesh K", email: "ramesh@dtech.com", phone: "9988776655", siteId: "site1", joinDate: "2024-01-10", status: "ACTIVE", password: "pass123" },
  { id: "emp2", code: "EMP002", name: "Sneha L", email: "sneha@dtech.com", phone: "9988776654", siteId: "site2", joinDate: "2024-02-15", status: "ACTIVE", password: "pass123" },
  { id: "emp3", code: "EMP003", name: "Arjun M", email: "arjun@dtech.com", phone: "9988776653", siteId: "site1", joinDate: "2024-03-20", status: "ACTIVE", password: "pass123" },
  { id: "emp4", code: "EMP004", name: "Divya N", email: "divya@dtech.com", phone: "9988776652", siteId: "", joinDate: "2024-04-10", status: "INACTIVE", password: "pass123" }
];

const MOCK_SITES = [
  { id: "site1", name: "Koramangala HQ", lat: 12.9352, lng: 77.6245, radius: 150, address: "Koramangala, Bengaluru", shiftStart: "09:00", shiftEnd: "18:00", lunchTime: "13:00", status: "ACTIVE" },
  { id: "site2", name: "Whitefield Site", lat: 12.9698, lng: 77.7499, radius: 200, address: "Whitefield, Bengaluru", shiftStart: "08:30", shiftEnd: "17:30", lunchTime: "12:30", status: "ACTIVE" },
  { id: "site3", name: "Electronic City", lat: 12.8455, lng: 77.6600, radius: 180, address: "Electronic City, Bengaluru", shiftStart: "09:30", shiftEnd: "18:30", lunchTime: "13:30", status: "INACTIVE" }
];

const MOCK_ATTENDANCE = [
  { id: "att1", employeeId: "emp1", date: new Date().toISOString().split('T')[0], checkIn: "09:15", checkOut: "17:45", status: "PRESENT", location: "Koramangala HQ", halfDay: false, markedBy: "mobile", note: "" },
  { id: "att2", employeeId: "emp2", date: new Date().toISOString().split('T')[0], checkIn: "08:45", checkOut: "17:30", status: "PRESENT", location: "Whitefield Site", halfDay: false, markedBy: "mobile", note: "" },
  { id: "att3", employeeId: "emp3", date: new Date().toISOString().split('T')[0], checkIn: "", checkOut: "", status: "ABSENT", location: "", halfDay: false, markedBy: "system", note: "" },
  { id: "att4", employeeId: "emp4", date: new Date().toISOString().split('T')[0], checkIn: "", checkOut: "", status: "ABSENT", location: "", halfDay: false, markedBy: "system", note: "" }
];

// ---------- HELPER: load mock if localStorage empty ----------
function loadInitialData() {
  let storedEmps = localStorage.getItem("attendEase_employees");
  if (!storedEmps || storedEmps === "[]") {
    employees = JSON.parse(JSON.stringify(MOCK_EMPLOYEES));
    localStorage.setItem("attendEase_employees", JSON.stringify(employees));
  } else {
    employees = JSON.parse(storedEmps);
  }

  let storedSites = localStorage.getItem("attendEase_sites");
  if (!storedSites || storedSites === "[]") {
    sites = JSON.parse(JSON.stringify(MOCK_SITES));
    localStorage.setItem("attendEase_sites", JSON.stringify(sites));
  } else {
    sites = JSON.parse(storedSites);
  }

  let storedAtt = localStorage.getItem("attendEase_attendance");
  if (!storedAtt || storedAtt === "[]") {
    attendanceRecords = JSON.parse(JSON.stringify(MOCK_ATTENDANCE));
    localStorage.setItem("attendEase_attendance", JSON.stringify(attendanceRecords));
  } else {
    attendanceRecords = JSON.parse(storedAtt);
  }
}

function persistEmployees() { localStorage.setItem("attendEase_employees", JSON.stringify(employees)); }
function persistSites() { localStorage.setItem("attendEase_sites", JSON.stringify(sites)); }
function persistAttendance() { localStorage.setItem("attendEase_attendance", JSON.stringify(attendanceRecords)); }

// ---------- AUTH ----------
function doLogin() {
  const companyEmail = document.getElementById("lCompanyEmail").value.trim();
  const adminId = document.getElementById("lEmpId").value.trim();
  const password = document.getElementById("lPassword").value.trim();
  const errorDiv = document.getElementById("loginError");

  if (!companyEmail || !adminId || !password) {
    errorDiv.innerText = "All fields are required.";
    errorDiv.style.display = "block";
    return;
  }
  // Simulate network / validation: for demo accept any non-empty.
  // In real scenario, validate against backend.
  // For demo, we set currentUser with provided details.
  // Additional check: admin must exist in employees? optional.
  const empExists = employees.find(e => e.email === adminId || e.code === adminId);
  if (!empExists && adminId !== "admin@drushyasinchana.in") {
    // allow fallback admin
    if(adminId !== "admin@drushyasinchana.in" && !empExists){
      errorDiv.innerText = "Admin ID not recognized. Use EMP001 or admin@...";
      errorDiv.style.display = "block";
      return;
    }
  }
  currentUser = {
    companyEmail: companyEmail,
    adminId: adminId,
    adminName: empExists ? empExists.name : "Administrator"
  };
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("appScreen").classList.add("active");
  document.getElementById("sbCompanyName").innerText = companyEmail;
  document.getElementById("topbarEmail").innerText = adminId;
  document.getElementById("topbarAvatar").innerText = (currentUser.adminName.charAt(0) || "A").toUpperCase();

  // load all data into UI
  refreshDashboard();
  loadEmployeesTable();
  loadSitesTable();
  loadAttendanceFilters();
  loadAttendance();
  loadReportsFilters();
}

function doLogout() {
  currentUser = null;
  document.getElementById("appScreen").classList.remove("active");
  document.getElementById("loginScreen").classList.add("active");
  document.getElementById("lCompanyEmail").value = "";
  document.getElementById("lEmpId").value = "";
  document.getElementById("lPassword").value = "";
  document.getElementById("loginError").style.display = "none";
}

// ---------- NAVIGATION ----------
function nav(page, btnElem) {
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
  btnElem.classList.add("active");
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`pg${page.charAt(0).toUpperCase() + page.slice(1)}`).classList.add("active");
  let title = "";
  switch(page) {
    case "dashboard": title = "Dashboard"; break;
    case "employees": title = "Employees"; loadEmployeesTable(); break;
    case "sites": title = "Sites"; loadSitesTable(); break;
    case "attendance": title = "Attendance"; loadAttendance(); break;
    case "reports": title = "Reports"; generateReport(); break;
    case "manual": title = "Manual Entry"; break;
    default: title = "AttendEase";
  }
  document.getElementById("topbarTitle").innerText = title;
}

// ---------- DASHBOARD ----------
function refreshDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const totalEmp = employees.filter(e => e.status === "ACTIVE").length;
  const presentToday = attendanceRecords.filter(a => a.date === today && a.status === "PRESENT").length;
  const absentToday = totalEmp - presentToday;
  const activeSites = sites.filter(s => s.status === "ACTIVE").length;

  document.getElementById("stTotalEmp").innerText = totalEmp;
  document.getElementById("stPresent").innerText = presentToday;
  document.getElementById("stAbsent").innerText = absentToday;
  document.getElementById("stSites").innerText = activeSites;
  document.getElementById("stDate").innerText = today;

  // Today's attendance list (first 5)
  const todayAtt = attendanceRecords.filter(a => a.date === today);
  const container = document.getElementById("dashAttendList");
  if (todayAtt.length === 0) {
    container.innerHTML = '<div class="empty"><p>No attendance records today.</p></div>';
  } else {
    let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
    todayAtt.slice(0,5).forEach(att => {
      const emp = employees.find(e => e.id === att.employeeId);
      const empName = emp ? emp.name : "Unknown";
      html += `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:6px 0;"><span><strong>${empName}</strong> (${att.status})</span><span>${att.checkIn || "--"} → ${att.checkOut || "--"}</span></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  const siteContainer = document.getElementById("dashSiteList");
  if (sites.length === 0) {
    siteContainer.innerHTML = '<div class="empty"><p>No sites configured.</p></div>';
  } else {
    let html = '<div style="display:flex;flex-direction:column;gap:6px;">';
    sites.forEach(s => {
      html += `<div style="display:flex;justify-content:space-between;"><span>📍 ${s.name}</span><span class="badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${s.status}</span></div>`;
    });
    html += '</div>';
    siteContainer.innerHTML = html;
  }
}

// ---------- EMPLOYEES ----------
function loadEmployeesTable() {
  const search = document.getElementById("empSearch").value.toLowerCase();
  const statusFilter = document.getElementById("empStatusFilter").value;
  const siteFilter = document.getElementById("empSiteFilter").value;

  // populate site filter
  const siteSelect = document.getElementById("empSiteFilter");
  let currentSiteVal = siteSelect.value;
  siteSelect.innerHTML = '<option value="">All Sites</option>';
  sites.forEach(s => {
    siteSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
  siteSelect.value = currentSiteVal;

  let filtered = employees.filter(emp => {
    const matchSearch = emp.name.toLowerCase().includes(search) || emp.code.toLowerCase().includes(search) || emp.email.toLowerCase().includes(search);
    const matchStatus = statusFilter === "" || emp.status === statusFilter;
    const matchSite = siteFilter === "" || emp.siteId === siteFilter;
    return matchSearch && matchStatus && matchSite;
  });

  const tbody = document.getElementById("empTableBody");
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">No employees found</td></tr>';
    return;
  }
  let html = "";
  filtered.forEach(emp => {
    const siteObj = sites.find(s => s.id === emp.siteId);
    const siteName = siteObj ? siteObj.name : "Unassigned";
    html += `<tr>
      <td>${emp.code}</td>
      <td>${emp.name}</td>
      <td>${emp.email}</td>
      <td>${siteName}</td>
      <td>${emp.joinDate || "—"}</td>
      <td><span class="badge ${emp.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${emp.status}</span></td>
      <td class="action-icons">
        <button class="icon-btn" onclick="editEmployee('${emp.id}')">✏️</button>
        <button class="icon-btn" onclick="deleteEmployee('${emp.id}')">🗑️</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function filterEmployees() { loadEmployeesTable(); }

function openEmpModal(empId = null) {
  editingEmployeeId = empId;
  const modal = document.getElementById("empModal");
  const title = document.getElementById("empModalTitle");
  const btnSave = document.getElementById("btnSaveEmp");
  if (empId) {
    title.innerText = "Edit Employee";
    btnSave.innerText = "Update";
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      document.getElementById("eCode").value = emp.code;
      document.getElementById("eName").value = emp.name;
      document.getElementById("eEmail").value = emp.email;
      document.getElementById("ePhone").value = emp.phone || "";
      document.getElementById("ePass").value = "";
      document.getElementById("eSite").value = emp.siteId || "";
      document.getElementById("eJoin").value = emp.joinDate || "";
      document.getElementById("eStatus").value = emp.status;
    }
  } else {
    title.innerText = "Register Employee";
    btnSave.innerText = "Register";
    document.getElementById("eCode").value = "";
    document.getElementById("eName").value = "";
    document.getElementById("eEmail").value = "";
    document.getElementById("ePhone").value = "";
    document.getElementById("ePass").value = "";
    document.getElementById("eSite").value = "";
    document.getElementById("eJoin").value = "";
    document.getElementById("eStatus").value = "ACTIVE";
  }
  // populate site dropdown
  const siteDropdown = document.getElementById("eSite");
  siteDropdown.innerHTML = '<option value="">— Select site —</option>';
  sites.forEach(s => {
    siteDropdown.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
  modal.style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
  editingEmployeeId = null;
  editingSiteId = null;
  document.getElementById("empModalErr").style.display = "none";
  document.getElementById("siteModalErr").style.display = "none";
}

function saveEmployee() {
  const code = document.getElementById("eCode").value.trim();
  const name = document.getElementById("eName").value.trim();
  const email = document.getElementById("eEmail").value.trim();
  const phone = document.getElementById("ePhone").value.trim();
  const siteId = document.getElementById("eSite").value;
  const joinDate = document.getElementById("eJoin").value;
  const status = document.getElementById("eStatus").value;
  const password = document.getElementById("ePass").value.trim();

  if (!code || !name || !email) {
    showError("empModalErr", "Employee code, name and email are required.");
    return;
  }
  if (editingEmployeeId) {
    const idx = employees.findIndex(e => e.id === editingEmployeeId);
    if (idx !== -1) {
      employees[idx].code = code;
      employees[idx].name = name;
      employees[idx].email = email;
      employees[idx].phone = phone;
      employees[idx].siteId = siteId || "";
      employees[idx].joinDate = joinDate;
      employees[idx].status = status;
      if (password) employees[idx].password = password;
      persistEmployees();
      showToast("Employee updated successfully");
    }
  } else {
    // check duplicate code/email
    if (employees.some(e => e.code === code)) { showError("empModalErr", "Employee code already exists."); return; }
    if (employees.some(e => e.email === email)) { showError("empModalErr", "Email already registered."); return; }
    const newId = "emp" + Date.now();
    employees.push({
      id: newId, code, name, email, phone: phone || "", siteId: siteId || "", joinDate: joinDate || new Date().toISOString().split('T')[0],
      status: status, password: password || "pass123"
    });
    persistEmployees();
    showToast("Employee registered successfully");
  }
  closeModal("empModal");
  loadEmployeesTable();
  refreshDashboard();
  loadAttendanceFilters();
  loadReportsFilters();
}

function deleteEmployee(id) {
  if (confirm("Are you sure? This will also delete related attendance records.")) {
    employees = employees.filter(e => e.id !== id);
    attendanceRecords = attendanceRecords.filter(a => a.employeeId !== id);
    persistEmployees();
    persistAttendance();
    loadEmployeesTable();
    refreshDashboard();
    loadAttendance();
  }
}

function editEmployee(id) { openEmpModal(id); }

// ---------- SITES ----------
function loadSitesTable() {
  const tbody = document.getElementById("siteTableBody");
  if (sites.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">No sites added</td></tr>';
    return;
  }
  let html = "";
  sites.forEach(site => {
    html += `<tr>
      <td>${site.id.slice(0,6)}</td>
      <td>${site.name}</td>
      <td>${site.lat}, ${site.lng}</td>
      <td>${site.radius}m</td>
      <td>${site.shiftStart} - ${site.shiftEnd}</td>
      <td>${site.lunchTime}</td>
      <td><span class="badge ${site.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${site.status}</span></td>
      <td class="action-icons">
        <button class="icon-btn" onclick="editSite('${site.id}')">✏️</button>
        <button class="icon-btn" onclick="deleteSite('${site.id}')">🗑️</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function openSiteModal(siteId = null) {
  editingSiteId = siteId;
  const modal = document.getElementById("siteModal");
  const title = document.getElementById("siteModalTitle");
  if (siteId) {
    const site = sites.find(s => s.id === siteId);
    if (site) {
      title.innerText = "Edit Site";
      document.getElementById("sName").value = site.name;
      document.getElementById("sStatus").value = site.status;
      document.getElementById("sLat").value = site.lat;
      document.getElementById("sLng").value = site.lng;
      document.getElementById("sRadius").value = site.radius;
      document.getElementById("sAddr").value = site.address || "";
      document.getElementById("sShiftS").value = site.shiftStart;
      document.getElementById("sShiftE").value = site.shiftEnd;
      document.getElementById("sLunch").value = site.lunchTime;
    }
  } else {
    title.innerText = "Add New Site";
    document.getElementById("sName").value = "";
    document.getElementById("sStatus").value = "ACTIVE";
    document.getElementById("sLat").value = "";
    document.getElementById("sLng").value = "";
    document.getElementById("sRadius").value = "100";
    document.getElementById("sAddr").value = "";
    document.getElementById("sShiftS").value = "09:00";
    document.getElementById("sShiftE").value = "18:00";
    document.getElementById("sLunch").value = "13:00";
  }
  modal.style.display = "flex";
}

function saveSite() {
  const name = document.getElementById("sName").value.trim();
  const status = document.getElementById("sStatus").value;
  const lat = parseFloat(document.getElementById("sLat").value);
  const lng = parseFloat(document.getElementById("sLng").value);
  const radius = parseInt(document.getElementById("sRadius").value, 10);
  const address = document.getElementById("sAddr").value;
  const shiftStart = document.getElementById("sShiftS").value;
  const shiftEnd = document.getElementById("sShiftE").value;
  const lunchTime = document.getElementById("sLunch").value;

  if (!name || isNaN(lat) || isNaN(lng) || !radius) {
    showError("siteModalErr", "Name, valid lat/lng and radius are required.");
    return;
  }
  if (editingSiteId) {
    const idx = sites.findIndex(s => s.id === editingSiteId);
    if (idx !== -1) {
      sites[idx] = { ...sites[idx], name, status, lat, lng, radius, address, shiftStart, shiftEnd, lunchTime };
      persistSites();
      showToast("Site updated");
    }
  } else {
    const newId = "site" + Date.now();
    sites.push({ id: newId, name, status, lat, lng, radius, address, shiftStart, shiftEnd, lunchTime });
    persistSites();
    showToast("Site added");
  }
  closeModal("siteModal");
  loadSitesTable();
  refreshDashboard();
  loadAttendanceFilters();
  loadEmployeesTable();
}

function deleteSite(id) {
  if (confirm("Remove site? Employees assigned will have site unassigned.")) {
    sites = sites.filter(s => s.id !== id);
    employees.forEach(e => { if (e.siteId === id) e.siteId = ""; });
    persistSites();
    persistEmployees();
    loadSitesTable();
    loadEmployeesTable();
    refreshDashboard();
    loadAttendanceFilters();
    showToast("Site deleted");
  }
}

function editSite(id) { openSiteModal(id); }

// ---------- ATTENDANCE ----------
function loadAttendanceFilters() {
  const siteSelect = document.getElementById("attSite");
  siteSelect.innerHTML = '<option value="">All Sites</option>';
  sites.forEach(s => {
    siteSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
  document.getElementById("attDate").value = new Date().toISOString().split('T')[0];
}

function loadAttendance() {
  const date = document.getElementById("attDate").value;
  const siteId = document.getElementById("attSite").value;
  let filtered = attendanceRecords.filter(a => a.date === date);
  if (siteId) {
    const empIdsInSite = employees.filter(e => e.siteId === siteId).map(e => e.id);
    filtered = filtered.filter(a => empIdsInSite.includes(a.employeeId));
  }
  renderAttendanceTable(filtered);
  // summary
  const present = filtered.filter(a => a.status === "PRESENT").length;
  const absent = filtered.filter(a => a.status === "ABSENT").length;
  document.getElementById("attSummary").innerHTML = `<span>📅 ${date} &nbsp;| ✅ Present: ${present} &nbsp;| ❌ Absent: ${absent}</span>`;
}

function renderAttendanceTable(records) {
  const tbody = document.getElementById("attTableBody");
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9">No records</td></tr>';
    return;
  }
  let html = "";
  records.forEach(rec => {
    const emp = employees.find(e => e.id === rec.employeeId);
    const empName = emp ? emp.name : "Unknown";
    const empCode = emp ? emp.code : "—";
    const siteObj = emp && emp.siteId ? sites.find(s => s.id === emp.siteId) : null;
    const siteName = siteObj ? siteObj.name : "—";
    html += `<tr>
      <td>${empName}</td><td>${empCode}</td><td>${siteName}</td>
      <td>${rec.checkIn || "--"}</td><td>${rec.checkOut || "--"}</td>
      <td><span class="badge ${rec.status === 'PRESENT' ? 'badge-active' : 'badge-inactive'}">${rec.status}</span></td>
      <td>${rec.location || "--"}</td><td>${rec.halfDay ? "Yes" : "No"}</td><td>${rec.markedBy || "system"}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function filterAttTable() {
  loadAttendance(); // quick reapply
}

// ---------- REPORTS ----------
function loadReportsFilters() {
  const siteSelect = document.getElementById("rptSite");
  siteSelect.innerHTML = '<option value="">All Sites</option>';
  sites.forEach(s => {
    siteSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
  const empSelect = document.getElementById("rptEmp");
  empSelect.innerHTML = '<option value="">All Employees</option>';
  employees.forEach(e => {
    empSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.code})</option>`;
  });
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  document.getElementById("rptFrom").value = firstDay;
  document.getElementById("rptTo").value = today;
}

function generateReport() {
  const fromDate = document.getElementById("rptFrom").value;
  const toDate = document.getElementById("rptTo").value;
  const siteId = document.getElementById("rptSite").value;
  const empId = document.getElementById("rptEmp").value;

  let filtered = attendanceRecords.filter(a => a.date >= fromDate && a.date <= toDate);
  if (siteId) {
    const empIds = employees.filter(e => e.siteId === siteId).map(e => e.id);
    filtered = filtered.filter(a => empIds.includes(a.employeeId));
  }
  if (empId) {
    filtered = filtered.filter(a => a.employeeId === empId);
  }

  document.getElementById("rptCount").innerText = `(${filtered.length} records)`;
  if (filtered.length === 0) {
    document.getElementById("rptTableBody").innerHTML = '<tr><td colspan="9">No records</td></tr>';
    document.getElementById("rptSummary").innerHTML = "";
    return;
  }

  let totalPresent = filtered.filter(a => a.status === "PRESENT").length;
  let totalAbsent = filtered.filter(a => a.status === "ABSENT").length;
  document.getElementById("rptSummary").innerHTML = `<span>✅ Present: ${totalPresent} &nbsp; ❌ Absent: ${totalAbsent}</span>`;

  let html = "";
  filtered.forEach(rec => {
    const emp = employees.find(e => e.id === rec.employeeId);
    const empName = emp ? emp.name : "Unknown";
    const empCode = emp ? emp.code : "—";
    const siteObj = emp && emp.siteId ? sites.find(s => s.id === emp.siteId) : null;
    const siteName = siteObj ? siteObj.name : "—";
    const hours = rec.checkIn && rec.checkOut ? "~8h" : "-";
    html += `<tr>
      <td>${rec.date}</td><td>${empName}</td><td>${empCode}</td><td>${siteName}</td>
      <td>${rec.checkIn || "--"}</td><td>${rec.checkOut || "--"}</td>
      <td>${rec.status}</td><td>${hours}</td><td>${rec.markedBy}</td>
    </tr>`;
  });
  document.getElementById("rptTableBody").innerHTML = html;
}

function exportCSV() {
  const rows = document.querySelectorAll("#rptTableBody tr");
  if (!rows.length || rows[0].innerText.includes("No records")) {
    showToast("No data to export");
    return;
  }
  let csv = "Date,Employee,Code,Site,CheckIn,CheckOut,Status,Hours,MarkedBy\n";
  for (let row of rows) {
    const cols = row.querySelectorAll("td");
    const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`).join(",");
    csv += rowData + "\n";
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendEase_report_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- MANUAL ENTRY ----------
function submitManual() {
  const empIdInput = document.getElementById("mEmpId").value.trim();
  const date = document.getElementById("mDate").value;
  const checkIn = document.getElementById("mCheckIn").value;
  const checkOut = document.getElementById("mCheckOut").value;
  const reason = document.getElementById("mReason").value;

  if (!empIdInput || !date || !checkIn) {
    showToast("Employee ID, Date and Check-In required", true);
    return;
  }
  const employee = employees.find(e => e.code === empIdInput || e.id === empIdInput);
  if (!employee) {
    showToast("Employee not found", true);
    return;
  }
  const exists = attendanceRecords.some(a => a.employeeId === employee.id && a.date === date);
  if (exists) {
    showToast("Attendance already exists for this date. Use edit function instead.", true);
    return;
  }
  const newRecord = {
    id: "att" + Date.now(),
    employeeId: employee.id,
    date: date,
    checkIn: checkIn,
    checkOut: checkOut || "",
    status: "PRESENT",
    location: "Manual Entry",
    halfDay: false,
    markedBy: "admin:" + (currentUser?.adminId || "admin"),
    note: reason
  };
  attendanceRecords.push(newRecord);
  persistAttendance();
  showToast("Manual attendance added");
  clearManual();
  if (document.getElementById("pgAttendance").classList.contains("active")) loadAttendance();
}

function clearManual() {
  document.getElementById("mEmpId").value = "";
  document.getElementById("mDate").value = "";
  document.getElementById("mCheckIn").value = "";
  document.getElementById("mCheckOut").value = "";
  document.getElementById("mReason").value = "";
}

function submitManualModal() {
  const empId = document.getElementById("mmEmpId").value.trim();
  const date = document.getElementById("mmDate").value;
  const checkIn = document.getElementById("mmIn").value;
  const checkOut = document.getElementById("mmOut").value;
  const reason = document.getElementById("mmReason").value;

  if (!empId || !date || !checkIn) { showToast("Required fields missing", true); return; }
  const employee = employees.find(e => e.code === empId || e.id === empId);
  if (!employee) { showToast("Employee not found", true); return; }
  if (attendanceRecords.some(a => a.employeeId === employee.id && a.date === date)) {
    showToast("Already marked", true); return;
  }
  attendanceRecords.push({
    id: "att" + Date.now(),
    employeeId: employee.id,
    date, checkIn, checkOut: checkOut || "",
    status: "PRESENT", location: "Manual Entry", halfDay: false,
    markedBy: "admin:" + (currentUser?.adminId || "admin"), note: reason
  });
  persistAttendance();
  showToast("Manual entry saved");
  closeModal("manualModal");
  if (document.getElementById("pgAttendance").classList.contains("active")) loadAttendance();
  if (document.getElementById("pgReports").classList.contains("active")) generateReport();
}

// ---------- UTILITIES ----------
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.backgroundColor = isError ? "#d9534f" : "#2c7a4b";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function showError(elementId, message) {
  const errDiv = document.getElementById(elementId);
  errDiv.innerText = message;
  errDiv.style.display = "block";
  setTimeout(() => errDiv.style.display = "none", 3000);
}

// ---------- INIT ----------
window.onload = () => {
  loadInitialData();
  // close all modals on backdrop click
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  });
  // set default dates for manual
  document.getElementById("mDate").value = new Date().toISOString().split('T')[0];
  document.getElementById("mmDate").value = new Date().toISOString().split('T')[0];
  // ensure dashboard data if login skipped? not needed.
  if (currentUser) {
    refreshDashboard();
    loadEmployeesTable();
    loadSitesTable();
    loadAttendanceFilters();
    loadAttendance();
  }
};
