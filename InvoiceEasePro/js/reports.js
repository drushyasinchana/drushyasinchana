/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - REPORTS & ANALYTICS (Updated)
Features: FY + Period Dropdown (Month/Q1-Q4), Dynamic Date Ranges, PDF/CSV Export
Profile-Aware: Filters by selected company profile
══════════════════════════════════════════════════════ */

// ✅ Helper: Get active profile ID
function getActiveProfileId() {
  return window.selectedProfileId || window.currentCompanyId || sessionStorage.getItem('activeProfileId') || 'COMP001';
}

// ✅ Toggle Month dropdown visibility based on Period selection
window.toggleReportPeriod = function() {
  const periodType = document.getElementById('repPeriodType').value;
  const monthContainer = document.getElementById('repMonthContainer');
  if (periodType === 'month') {
    monthContainer.style.display = 'block';
  } else {
    monthContainer.style.display = 'none';
  }
};

window.loadReports = async function() {
  console.log('📈 Loading reports...');
  const c = document.getElementById('reportsContainer');
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading report options...</div>';
  
  try {
    const profileId = getActiveProfileId();
    
    // Fetch Customers
    const custSnap = await window.InvoiceApp.clientDb.collection('customers')
      .where('profileId', '==', profileId)
      .where('isActive', '==', true)
      .get();
      
    let customerOptions = '<option value="">All Customers</option>';
    custSnap.forEach(d => {
      customerOptions += `<option value="${d.id}">${d.data().customerName}</option>`;
    });
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Build HTML with new Period Dropdown
    c.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:20px;">📊 Sales Report Generator</h3>
        
        <!-- Filters Grid: FY | Period | Month | Customer | Generate -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap:12px; align-items:end; margin-bottom:24px;">
          
          <!-- Financial Year -->
          <div class="fg" style="margin-bottom:0;">
            <label style="font-size:0.85rem;">Financial Year</label>
            <select id="repYear" style="padding:10px;border:1px solid var(--border);border-radius:6px;width:100%;">
              <option value="${currentYear - 1}" ${currentYear === currentYear-1 ? 'selected' : ''}>${currentYear - 1}-${(currentYear).toString().slice(-2)}</option>
              <option value="${currentYear}" ${currentYear === currentYear ? 'selected' : ''}>${currentYear}-${(currentYear+1).toString().slice(-2)}</option>
              <option value="${currentYear + 1}">${currentYear + 1}-${(currentYear+2).toString().slice(-2)}</option>
            </select>
          </div>
          
          <!-- Period Type -->
          <div class="fg" style="margin-bottom:0;">
            <label style="font-size:0.85rem;">Period</label>
            <select id="repPeriodType" onchange="window.toggleReportPeriod()" style="padding:10px;border:1px solid var(--border);border-radius:6px;width:100%;">
              <option value="month">Month</option>
              <option value="q1">Q1 (Apr-Jun)</option>
              <option value="q2">Q2 (Jul-Sep)</option>
              <option value="q3">Q3 (Oct-Dec)</option>
              <option value="q4">Q4 (Jan-Mar)</option>
            </select>
          </div>
          
          <!-- Month (Conditional) -->
          <div class="fg" id="repMonthContainer" style="margin-bottom:0;">
            <label style="font-size:0.85rem;">Month</label>
            <select id="repMonth" style="padding:10px;border:1px solid var(--border);border-radius:6px;width:100%;">
              ${Array.from({length:12},(_,i) => {
                const val = i + 1;
                return `<option value="${val}" ${val === currentMonth ? 'selected' : ''}>${new Date(0, i).toLocaleString('default', {month:'long'})}</option>`;
              }).join('')}
            </select>
          </div>
          
          <!-- Customer -->
          <div class="fg" style="margin-bottom:0;">
            <label style="font-size:0.85rem;">Customer</label>
            <select id="repCustomer" style="padding:10px;border:1px solid var(--border);border-radius:6px;width:100%;">
              ${customerOptions}
            </select>
          </div>
          
          <button class="btn btn-teal" onclick="generateReport()" style="padding:10px 20px;height:42px;"> Generate</button>
        </div>
        
        <!-- Results Area -->
        <div id="reportResult">
          <div style="text-align:center;color:var(--muted);padding:40px;border:2px dashed var(--border);border-radius:8px;">
            Select filters and click Generate to view report.
          </div>
        </div>
      </div>
    `;
    
  } catch (e) {
    console.error('Load reports error:', e);
    c.innerHTML = '<div style="color:var(--red);text-align:center;padding:40px;">Error loading reports</div>';
  }
};

window.generateReport = async function() {
  const c = document.getElementById('reportResult');
  const yearStr = document.getElementById('repYear').value;
  const periodType = document.getElementById('repPeriodType').value;
  const monthStr = document.getElementById('repMonth').value;
  const customerId = document.getElementById('repCustomer').value;
  
  const selectedYear = parseInt(yearStr);
  const selectedMonth = parseInt(monthStr);
  
  c.innerHTML = '<div style="text-align:center;padding:20px;">Generating report...</div>';
  
  try {
    // ✅ Calculate Start & End Dates based on FY & Period
    let startDate, endDate;
    const fyStart = selectedYear; // e.g., 2025 for FY 2025-26
    
    if (periodType === 'month') {
      const monthIndex = selectedMonth - 1; // JS months are 0-indexed
      const actualYear = selectedMonth < 4 ? fyStart + 1 : fyStart; // Jan-Mar belong to next calendar year
      startDate = new Date(actualYear, monthIndex, 1, 0, 0, 0);
      endDate = new Date(actualYear, monthIndex + 1, 0, 23, 59, 59);
    } else {
      const q = parseInt(periodType.slice(1));
      const qConfig = {
        1: { startM: 3, endM: 5, endD: 30, endYOffset: 0 }, // Apr-Jun
        2: { startM: 6, endM: 8, endD: 30, endYOffset: 0 }, // Jul-Sep
        3: { startM: 9, endM: 11, endD: 31, endYOffset: 0 }, // Oct-Dec
        4: { startM: 0, endM: 2, endD: 31, endYOffset: 1 }  // Jan-Mar (next year)
      };
      const cfg = qConfig[q];
      const startYear = fyStart + (cfg.startM < 3 ? 1 : 0);
      const endYear = fyStart + cfg.endYOffset;
      
      startDate = new Date(startYear, cfg.startM, 1, 0, 0, 0);
      endDate = new Date(endYear, cfg.endM, cfg.endD, 23, 59, 59);
    }
    
    console.log('📅 Report Range:', startDate.toLocaleDateString(), 'to', endDate.toLocaleDateString());
    
    // ✅ Fetch & Filter Invoices
    const profileId = getActiveProfileId();
    const snap = await window.InvoiceApp.clientDb.collection('invoices')
      .where('profileId', '==', profileId)
      .get();
      
    let filteredInvoices = [];
    let totalRevenue = 0;
    let totalTax = 0;
    
    snap.forEach(doc => {
      const inv = doc.data();
      const invDate = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate);
      
      // Filter by date range & customer
      if (invDate >= startDate && invDate <= endDate && (!customerId || inv.customerId === customerId)) {
        filteredInvoices.push({ id: doc.id, ...inv });
        totalRevenue += parseFloat(inv.grandTotal || 0);
        totalTax += (parseFloat(inv.totalCgst || 0) + parseFloat(inv.totalSgst || 0));
      }
    });
    
    // ✅ Render Results
    if (filteredInvoices.length === 0) {
      c.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
        <h3>No Invoices Found</h3>
        <p>No invoices match the selected period and filters.</p>
      </div>`;
      return;
    }
    
    const periodLabel = periodType === 'month' 
      ? `${new Date(0, selectedMonth-1).toLocaleString('default', {month:'long'})} ${endDate.getFullYear()}`
      : `Q${periodType.slice(1)} ${endDate.getFullYear()}`;
    
    let h = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="margin:0;">📅 ${periodLabel} Report</h4>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-outline" onclick="exportReportCSV()" style="font-size:0.85rem;">📊 Export CSV</button>
          <button class="btn btn-outline" onclick="exportReportPDF()" style="font-size:0.85rem;">📄 Export PDF</button>
        </div>
      </div>
      
      <div style="border:1px solid var(--border);border-radius:8px;background:#fff;max-height:450px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="position:sticky;top:0;z-index:10;background:var(--bg);box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            <tr>
              <th style="padding:12px;text-align:left;font-weight:600;color:var(--ink2);">Inv No</th>
              <th style="padding:12px;text-align:left;font-weight:600;color:var(--ink2);">Customer</th>
              <th style="padding:12px;text-align:left;font-weight:600;color:var(--ink2);">Date</th>
              <th style="padding:12px;text-align:right;font-weight:600;color:var(--ink2);">Taxable</th>
              <th style="padding:12px;text-align:right;font-weight:600;color:var(--ink2);">GST</th>
              <th style="padding:12px;text-align:right;font-weight:600;color:var(--ink2);">Total</th>
            </tr>
          </thead>
          <tbody>
    `;
      
    filteredInvoices.forEach(inv => {
      const taxable = inv.subtotal || 0;
      const gst = (inv.totalCgst || 0) + (inv.totalSgst || 0);
      const dateStr = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate().toLocaleDateString('en-IN') : new Date(inv.invoiceDate).toLocaleDateString('en-IN');
      
      h += `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:12px;font-weight:500;">${inv.invoiceNumber}</td>
        <td style="padding:12px;">${inv.customerName}</td>
        <td style="padding:12px;color:var(--muted);">${dateStr}</td>
        <td style="padding:12px;text-align:right;">₹${taxable.toFixed(2)}</td>
        <td style="padding:12px;text-align:right;">₹${gst.toFixed(2)}</td>
        <td style="padding:12px;text-align:right;font-weight:600;">₹${inv.grandTotal.toFixed(2)}</td>
      </tr>`;
    });
    
    h += `</tbody></table></div>`;
    c.innerHTML = h;
    
    // Store data for export
    window.currentReportData = filteredInvoices;
    window.reportMeta = { 
      periodLabel, 
      startDate, 
      endDate, 
      totalRevenue, 
      totalTax,
      companyName: window.InvoiceApp.companyName || 'Company Name'
    };
    
  } catch (e) {
    console.error('Report generation error:', e);
    c.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px;">Error: ${e.message}<br><button class="btn btn-teal" style="margin-top:12px;" onclick="generateReport()">Retry</button></div>`;
  }
};

// ✅ Export CSV
window.exportReportCSV = function() {
  if (!window.currentReportData) return;
  let csv = 'Invoice No,Customer,Date,Taxable,GST,Total\n';
  window.currentReportData.forEach(inv => {
    const taxable = inv.subtotal || 0;
    const gst = (inv.totalCgst || 0) + (inv.totalSgst || 0);
    const dateStr = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate().toLocaleDateString('en-IN') : new Date(inv.invoiceDate).toLocaleDateString('en-IN');
    csv += `${inv.invoiceNumber},"${inv.customerName}",${dateStr},${taxable.toFixed(2)},${gst.toFixed(2)},${inv.grandTotal.toFixed(2)}\n`;
  });
  const safeLabel = window.reportMeta.periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
  downloadFile(csv, `Report_${safeLabel}.csv`, 'text/csv');
};

// ✅ Export Report PDF
window.exportReportPDF = function() {
  if (!window.currentReportData) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const { periodLabel, totalRevenue, totalTax, companyName } = window.reportMeta;
  
  // Header
  doc.setFillColor(0, 131, 143);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('SALES REPORT', 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Period: ${periodLabel}`, 105, 23, { align: 'center' });
  
  // Company & Meta
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(companyName, 15, 40);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Invoices: ${window.currentReportData.length}`, 15, 46);
  
  // Summary Box
  doc.setFillColor(240, 248, 250);
  doc.rect(15, 52, 180, 18, 'F');
  doc.setFont(undefined, 'bold');
  doc.text(`Total Revenue: Rs. ${totalRevenue.toFixed(2)}`, 20, 60);
  doc.text(`Total GST: Rs. ${totalTax.toFixed(2)}`, 100, 60);
  
  // Table Header
  let y = 80;
  doc.setFillColor(0, 131, 143);
  doc.rect(15, y-7, 180, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Inv No', 18, y-2);
  doc.text('Customer', 45, y-2);
  doc.text('Date', 125, y-2);
  doc.text('Taxable', 160, y-2, {align: 'right'});
  doc.text('Total', 185, y-2, {align: 'right'});
  
  y += 5;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);
  
  window.currentReportData.forEach((inv, index) => {
    if (y > 270) {
      doc.addPage(); y = 20;
      doc.setFillColor(0, 131, 143); doc.rect(15, y-7, 180, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold');
      doc.text('Inv No', 18, y-2); doc.text('Customer', 45, y-2); doc.text('Date', 125, y-2);
      doc.text('Taxable', 160, y-2, {align: 'right'}); doc.text('Total', 185, y-2, {align: 'right'});
      y += 5; doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
    }
    if (index % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(15, y-4, 180, 4, 'F'); }
    
    const dateStr = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate().toLocaleDateString('en-IN') : new Date(inv.invoiceDate).toLocaleDateString('en-IN');
    doc.text(inv.invoiceNumber || '-', 18, y);
    doc.text(inv.customerName || '-', 45, y);
    doc.text(dateStr, 125, y);
    doc.text('Rs. ' + (inv.subtotal||0).toFixed(2), 165, y, {align: 'right'});
    doc.text('Rs. ' + inv.grandTotal.toFixed(2), 190, y, {align: 'right'});
    y += 5;
  });
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, {align: 'center'});
  }
  
  const safeLabel = periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Sales_Report_${safeLabel}.pdf`);
};

// Helper to download file
function downloadFile(content, fileName, mimeType) {
  const a = document.createElement('a');
  const blob = new Blob([content], {type: mimeType});
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}