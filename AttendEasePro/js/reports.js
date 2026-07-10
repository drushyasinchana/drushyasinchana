
// ══════════════════════════════════════════════════════
// REPORTS (Client-side filtering to avoid index error)
// ══════════════════════════════════════════════════════
async function loadReports() {
  if (!S.clientDb) { toast('DB not connected', 'error'); return; }
  try {
    await loadEmployees();
    await loadSites();
    populateSiteSelects();
    const rptFrom = document.getElementById('rptFrom');
    const rptTo = document.getElementById('rptTo');
    if (rptFrom) rptFrom.value = new Date(new Date().setDate(1)).toISOString().slice(0,10);
    if (rptTo) rptTo.value = today();
  } catch (e) {
    console.error('Load reports error:', e);
  }
}


// Global storage for report data
S.reportData = [];

/* ══════════════════════════════════════════════════════
GENERATE REPORT - FIXED Date Parsing (DD-MM-YYYY)
══════════════════════════════════════════════════════ */
async function generateReport() {
  const fromInput = document.getElementById('rptFrom')?.value;
  const toInput = document.getElementById('rptTo')?.value;
  
  if (!fromInput || !toInput) { 
    toast('Please select both From and To dates', 'error'); 
    return; 
  }

  // Parse Input Dates (YYYY-MM-DD)
  const fromDate = new Date(fromInput);
  const toDate = new Date(toInput);
  toDate.setHours(23, 59, 59, 999);

  try {
    console.log('📊 Generating report:', fromInput, 'to', toInput);
    
    // 1. Fetch ALL attendance for company
    const attSnap = await S.clientDb.collection('attendance')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    if (attSnap.empty) {
      toast('No attendance records found', 'error');
      S.reportData = [];
      renderReportTable([]);
      return;
    }
    
    // 2. Fetch employees to map EMPID → Name
    const empSnap = await S.clientDb.collection('employees')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    const empMap = {};
    empSnap.docs.forEach(d => {
      const e = d.data();
      empMap[e.EMPID] = e.EmpName || e.Name || e.empName || '—';
    });
    
    // 3. Filter & enrich records
    S.reportData = [];
    
    for (const doc of attSnap.docs) {
      const r = doc.data();
      
      // ✅ FIXED: Robust Date Parsing (DD-MM-YYYY for Android)
      let recordDate = null;
      if (r.Date?.toDate) {
        recordDate = r.Date.toDate();
      } else if (typeof r.Date === 'string') {
        const parts = r.Date.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD format
            recordDate = new Date(r.Date);
          } else {
            // DD-MM-YYYY format (Android App)
            // parts[0] is Day, parts[1] is Month, parts[2] is Year
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            recordDate = new Date(year, month, day);
          }
        }
      }
      
      if (!recordDate || isNaN(recordDate)) continue;
      
      // Check date range
      if (recordDate >= fromDate && recordDate <= toDate) {
        // Enrich with employee name
        S.reportData.push({
          ...r,
          Name: empMap[r.EMPID] || r.Name || r.EmpName || '—',
          SiteID: r.SiteID || r.Site || '—'
        });
      }
    }
    
    console.log(`✅ Found ${S.reportData.length} records in range`);
    
    // 4. Render
    renderReportTable(S.reportData);
    updateReportSummary(S.reportData);
    
    if (S.reportData.length === 0) {
      toast('No records found for selected dates', 'warn');
    } else {
      toast(`Report generated: ${S.reportData.length} records`);
    }
    
  } catch (e) {
    console.error('❌ Report error:', e);
    toast('Failed: ' + e.message, 'error');
  }
}

function exportReportCSV() {
  if (!S.reportData.length) { toast('No data to export', 'error'); return; }
  
  let csv = 'Date,Employee,EMPID,Site,In Time,Out Time,Hours,Status,Half Day\n';
  S.reportData.forEach(r => {
    csv += [
      fmtDate(r.Date), r.Name, r.EMPID, r.SiteID, 
      r.InTime || '-', r.OutTime || '-', calcHours(r.InTime, r.OutTime), 
      r.Status, r.HalfDay || 'NO'
    ].map(v => `"${v}"`).join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_report_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV exported successfully!');
}

function exportReportPDF() {
  if (!S.reportData || !S.reportData.length) { 
    toast('No data to export. Generate a report first.', 'error'); 
    return; 
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // ─── HEADER ───────────────────────────────────────
  doc.setFontSize(18);
  doc.setTextColor(0, 106, 114);
  doc.text('Attendance Report', 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // ✅ Get company name properly
  const companyName = S.prefs.companyName || 'Company';
  
  // ✅ Format date manually as DD/MM/YYYY
  const now = new Date();
  const genDate = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  
  // Left align: Company Name
  doc.text(`Company: ${companyName}`, 14, 22);
  
  // Right align: Generated Date
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(`Generated: ${genDate}`, pageWidth - 14, 22, { align: 'right' });

  // ─── TABLE ───────────────────────────────────────
  doc.autoTable({
    head: [['Date', 'Employee', 'EMPID', 'Site', 'In', 'Out', 'Hours', 'Status', 'Half Day']],
    body: S.reportData.map(r => [
      fmtDate(r.Date),  // ✅ Now returns dd/mm/yyyy
      r.Name || '—', 
      r.EMPID || '—', 
      r.SiteID || '—', 
      r.InTime || '—', 
      r.OutTime || '—', 
      calcHours(r.InTime, r.OutTime), 
      r.Status || '—', 
      r.HalfDay || 'NO'
    ]),
    startY: 30,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 106, 114], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  doc.save(`attendance_report_${today().replace(/-/g, '')}.pdf`);
  toast('✅ PDF exported successfully!');
}

function renderReportTable(list) {
  const tb = document.getElementById('rptTableBody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No records in this range</td></tr>';
    return;
  }
  tb.innerHTML = list.map(r => `
    <tr>
      <td class="mono">${fmtDate(r.Date)}</td>
      <td><strong>${r.Name || '—'}</strong></td>
      <td class="mono">${r.EMPID || '—'}</td>
      <td>${r.SiteID || '—'}</td>
      <td class="mono" style="color:var(--green);">${r.InTime || '—'}</td>
      <td class="mono" style="color:var(--red);">${r.OutTime || '—'}</td>
      <td class="mono">${calcHours(r.InTime, r.OutTime)}</td>
      <td><span class="badge ${r.Status === 'PRESENT' ? 'badge-green' : 'badge-red'}">${r.Status || '—'}</span></td>
      <td>${r.HalfDay || 'NO'}</td>
      <td style="font-size:.75rem;color:var(--muted);">${r.MarkedBy || '—'}</td>
    </tr>
  `).join('');
}

function updateReportSummary(list) {
  const present = list.filter(r => r.Status === 'PRESENT').length;
  const summary = document.getElementById('rptSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="chip">Total <span>${list.length}</span></div>
      <div class="chip" style="color:var(--green);">Present <span>${present}</span></div>
      <div class="chip" style="color:var(--red);">Absent <span>${list.length - present}</span></div>
    `;
  }
}

function exportCSV() {
  const tb = document.getElementById('rptTableBody');
  if (!tb || tb.rows.length <= 1) {
    toast('No data to export', 'error');
    return;
  }
  
  let csv = 'Date,Employee,EMPID,Site,In Time,Out Time,Hours,Status,Half Day,Marked By\n';
  for (let i = 1; i < tb.rows.length; i++) {
    const row = tb.rows[i];
    const cells = row.cells;
    csv += Array.from(cells).map(cell => `"${cell.textContent}"`).join(',') + '\n';
  }
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'attendance_report_' + today() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  
  toast('CSV exported successfully!');
}

/* ══════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS (Escape Key)
   ══════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' || event.keyCode === 27) {
    // Close all open modals
    const modals = document.querySelectorAll('.modal-backdrop.open');
    modals.forEach(m => {
      m.classList.remove('open');
      m.style.display = 'none';
    });
  }
});