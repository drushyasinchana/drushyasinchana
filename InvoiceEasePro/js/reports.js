/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - REPORTS & ANALYTICS
Features: Filter by Year, Month, Customer
══════════════════════════════════════════════════════ */

window.loadReports = async function() {
  console.log('📈 Loading reports...');
  const c = document.getElementById('reportsContainer');
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading report options...</div>';
  
  try {
    // 1. Fetch Customers for the dropdown
    const custSnap = await window.InvoiceApp.clientDb.collection('customers')
      .where('companyId', '==', window.InvoiceApp.companyId)
      .where('isActive', '==', true)
      .get();
      
    let customerOptions = '<option value="">All Customers</option>';
    custSnap.forEach(d => {
      customerOptions += `<option value="${d.id}">${d.data().customerName}</option>`;
    });
    
    // 2. Get current date defaults
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // 3. Build HTML
    c.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:20px;">📊 Sales Report Generator</h3>
        
        <!-- Filters -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr auto; gap:12px; align-items:end; margin-bottom:24px;">
          <div class="fg" style="margin-bottom:0;">
            <label style="font-size:0.85rem;">Financial Year</label>
            <select id="repYear" style="padding:10px;border:1px solid var(--border);border-radius:6px;width:100%;">
              <option value="${currentYear - 1}" ${currentYear === currentYear-1 ? 'selected' : ''}>${currentYear - 1}-${(currentYear).toString().slice(-2)}</option>
              <option value="${currentYear}" ${currentYear === currentYear ? 'selected' : ''}>${currentYear}-${(currentYear+1).toString().slice(-2)}</option>
              <option value="${currentYear + 1}">${currentYear + 1}-${(currentYear+2).toString().slice(-2)}</option>
            </select>
          </div>
          
          <div class="fg" style="margin-bottom:0;">
            <label style="font-size:0.85rem;">Month</label>
            <select id="repMonth" style="padding:10px;border:1px solid var(--border);border-radius:6px;width:100%;">
              ${Array.from({length:12},(_,i) => {
                const val = i + 1;
                return `<option value="${val}" ${val === currentMonth ? 'selected' : ''}>${new Date(0, i).toLocaleString('default', {month:'long'})}</option>`;
              }).join('')}
            </select>
          </div>
          
          <div class="fg" style="margin-bottom:0;">
            <label style="font-size:0.85rem;">Customer</label>
            <select id="repCustomer" style="padding:10px;border:1px solid var(--border);border-radius:6px;width:100%;">
              ${customerOptions}
            </select>
          </div>
          
          <button class="btn btn-teal" onclick="generateReport()" style="padding:10px 20px;height:42px;">🔍 Generate</button>
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
  const monthStr = document.getElementById('repMonth').value;
  const customerId = document.getElementById('repCustomer').value;
  
  // Parse year (expecting "2026")
  const selectedYear = parseInt(yearStr);
  const selectedMonth = parseInt(monthStr);
  
  c.innerHTML = '<div style="text-align:center;padding:20px;">Generating report...</div>';
  
  try {
    // 1. Fetch all invoices for the company
    // Note: We fetch all and filter in JS to avoid complex Firestore indexes for every variation
    const snap = await window.InvoiceApp.clientDb.collection('invoices')
      .where('companyId', '==', window.InvoiceApp.companyId)
      .get();
    
    let totalRevenue = 0;
    let totalTax = 0;
    let count = 0;
    let filteredInvoices = [];
    
    snap.forEach(doc => {
      const inv = doc.data();
      // Determine invoice date
      const invDate = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate);
      
      // Check Filters
      const isYearMatch = invDate.getFullYear() === selectedYear;
      const isMonthMatch = (invDate.getMonth() + 1) === selectedMonth;
      const isCustMatch = !customerId || inv.customerId === customerId;
      
      if (isYearMatch && isMonthMatch && isCustMatch) {
        filteredInvoices.push({ id: doc.id, ...inv });
        totalRevenue += parseFloat(inv.grandTotal || 0);
        totalTax += (parseFloat(inv.totalCgst || 0) + parseFloat(inv.totalSgst || 0));
        count++;
      }
    });
    
    // 2. Render Results
    if (filteredInvoices.length === 0) {
      c.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
        <h3>No Invoices Found</h3>
        <p>No invoices match the selected filters.</p>
      </div>`;
      return;
    }
    
       // ✅ SCROLLABLE TABLE CONTAINER
    let h = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px;gap:10px;">
        <button class="btn btn-outline" onclick="exportReportCSV()" style="font-size:0.85rem;">📊 Export CSV</button>
        <button class="btn btn-outline" onclick="exportReportPDF()" style="font-size:0.85rem;">📄 Export PDF</button>
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
    
    // Store data for export functions
    window.currentReportData = filteredInvoices;
    window.reportSummary = { year: selectedYear, month: selectedMonth };
    
  } catch (e) {
    console.error('Report generation error:', e);
    c.innerHTML = '<div style="color:var(--red);text-align:center;padding:40px;">Error generating report</div>';
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
  downloadFile(csv, `Report_${window.reportSummary.year}_${window.reportSummary.month}.csv`, 'text/csv');
};

// ✅ Export PDF - Professional Format
window.exportReportPDF = function() {
  if (!window.currentReportData) return;
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Get company info
  const companyId = window.InvoiceApp.companyId;
  const companyProfile = window.InvoiceApp.clientDb.collection('companyProfile').doc(companyId).get().then(doc => {
    if (doc.exists) return doc.data();
    return {};
  });
  
  // For now, we'll use basic info. In production, fetch company profile first.
  const companyName = window.InvoiceApp.companyName || 'Company Name';
  
  // Header
  doc.setFillColor(0, 131, 143); // Teal color
  doc.rect(0, 0, 210, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('SALES REPORT', 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const monthName = new Date(0, window.reportSummary.month - 1).toLocaleString('default', {month: 'long'});
  doc.text(`${monthName} ${window.reportSummary.year}`, 105, 23, { align: 'center' });
  
  // Company Name
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(companyName, 15, 40);
  
  // Report Details
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 15, 46);
  doc.text(`Total Invoices: ${window.currentReportData.length}`, 15, 51);
  
  // Calculate totals
  let totalTaxable = 0;
  let totalGST = 0;
  let totalAmount = 0;
  
  window.currentReportData.forEach(inv => {
    totalTaxable += inv.subtotal || 0;
    totalGST += (inv.totalCgst || 0) + (inv.totalSgst || 0);
    totalAmount += inv.grandTotal || 0;
  });
  
  // Summary Box
  doc.setFillColor(240, 248, 250);
  doc.rect(15, 55, 180, 20, 'F');
  doc.setFont(undefined, 'bold');
  doc.text(`Taxable Value: ₹${totalTaxable.toFixed(2)}`, 20, 63);
  doc.text(`Total GST: ₹${totalGST.toFixed(2)}`, 80, 63);
  doc.text(`Grand Total: ₹${totalAmount.toFixed(2)}`, 140, 63);
  
  // Table Header
  let y = 85;
  doc.setFillColor(0, 131, 143);
  doc.rect(15, y - 7, 180, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  
  doc.text('Inv No', 18, y - 2);
  doc.text('Customer', 45, y - 2);
  doc.text('Date', 95, y - 2);
  doc.text('Taxable', 130, y - 2, {align: 'right'});
  doc.text('GST', 160, y - 2, {align: 'right'});
  doc.text('Total', 185, y - 2, {align: 'right'});
  
  // Table Body
  y += 5;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  
  window.currentReportData.forEach((inv, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      // Repeat header on new page
      doc.setFillColor(0, 131, 143);
      doc.rect(15, y - 7, 180, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('Inv No', 18, y - 2);
      doc.text('Customer', 45, y - 2);
      doc.text('Date', 95, y - 2);
      doc.text('Taxable', 130, y - 2, {align: 'right'});
      doc.text('GST', 160, y - 2, {align: 'right'});
      doc.text('Total', 185, y - 2, {align: 'right'});
      y += 5;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
    }
    
    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(15, y - 4, 180, 4, 'F');
    }
    
    const taxable = inv.subtotal || 0;
    const gst = (inv.totalCgst || 0) + (inv.totalSgst || 0);
    const dateStr = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate().toLocaleDateString('en-IN') : 
                    inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-';
    
    doc.text(inv.invoiceNumber || '-', 18, y);
    doc.text(inv.customerName || '-', 45, y);
    doc.text(dateStr, 95, y);
    doc.text('₹' + taxable.toFixed(2), 130, y, {align: 'right'});
    doc.text('₹' + gst.toFixed(2), 160, y, {align: 'right'});
    doc.text('₹' + inv.grandTotal.toFixed(2), 185, y, {align: 'right'});
    
    y += 5;
  });
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, {align: 'center'});
    doc.text('Thank you for your business!', 105, 295, {align: 'center'});
  }
  
  doc.save(`Sales_Report_${window.reportSummary.year}_${window.reportSummary.month}.pdf`);
};

// Helper to download file
function downloadFile(content, fileName, mimeType) {
  const a = document.createElement('a');
  const blob = new Blob([content], {type: mimeType});
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}