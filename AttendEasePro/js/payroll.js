/* ══════════════════════════════════════════════════════
   PAYROLL.JS - AttendEase Pro (Unified & Optimized)
   Features: Pay Edit, Professional Payslip, Process Payroll
   Structure: payrollMaster (static) + payroll_MM_YY (monthly)
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════════════ */
function switchPayrollTab(tabName) {
  document.querySelectorAll('.payroll-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabName === 'edit' ? 'tabEdit' : 'tabProcess').classList.add('active');
  
  document.getElementById('payEditSection').style.display = tabName === 'edit' ? 'flex' : 'none';
  document.getElementById('processPayrollSection').style.display = tabName === 'process' ? 'flex' : 'none';
  
  if (tabName === 'edit') {
    document.getElementById('payEditTableBody').innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--muted);">Click "Fetch Employees" to load data</td></tr>';
  }
}

/* ══════════════════════════════════════════════════════
   MODAL LOGIC (Edit Salary)
══════════════════════════════════════════════════════ */
function openSalaryModal(empId) {
  document.getElementById('modalEmpId').value = empId;
  document.getElementById('salaryEditModal').style.display = 'flex';
  loadModalData(empId);
}

function closeSalaryModal() {
  document.getElementById('salaryEditModal').style.display = 'none';
}

// ESC Key to Close Modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeSalaryModal();
});

async function loadModalData(empId) {
  try {
    const btn = document.getElementById('btnFetchPayEdit');
    if(btn) { btn.textContent = '⏳ Loading...'; btn.disabled = true; }

    // Fetch Master Data (Static Info)
    const masterDoc = await S.clientDb.collection('payrollMaster').doc(empId).get();
    const masterData = masterDoc.exists ? masterDoc.data() : {};

    // Fetch Monthly Data (Variable Amounts)
    const monthSelect = document.getElementById('processMonth');
    const yearSelect = document.getElementById('processYear');
    const m = monthSelect ? parseInt(monthSelect.value) : new Date().getMonth();
    const y = yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear();
    const monthKey = String(m + 1).padStart(2, '0');
    const yearKey = String(y).slice(-2);
    const collName = `payroll_${monthKey}_${yearKey}`;

    const monthDoc = await S.clientDb.collection(collName).doc(empId).get();
    const monthData = monthDoc.exists ? monthDoc.data() : {};
    const earnings = monthData.earnings || {};
    const deductions = monthData.deductions || {};

    // Populate Statutory Fields (Master)
    document.getElementById('mBank').value = masterData.bankAccount || '';
    document.getElementById('mIfsc').value = masterData.ifsc || '';
    document.getElementById('mPan').value = masterData.pan || '';
    document.getElementById('mAadhaar').value = masterData.aadhaar || '';
    document.getElementById('mPfNo').value = masterData.pfAccountNo || '';

    // Populate Earnings (Monthly)
    const earnFields = ['mBasic','mDa','mHra','mConv','mMed','mSpl','mTa','mMa','mVar','mPerf','mInc','mOnsite','mBonus','mOtherEarn'];
    const earnKeys = ['basic_salary','da','hra','conveyance','medical','special_allowance','ta','ma','variable_pay','performance','incentives','onsite_allowances','bonus','other_allowances'];
    earnFields.forEach((id, i) => document.getElementById(id).value = earnings[earnKeys[i]] || 0);

    // Populate Deductions (Monthly)
    const dedFields = ['mEpf','mEsi','mTds','mMob','mPt','mLop','mVpf','mFa','mAdv','mRec','mOtherDed'];
    const dedKeys = ['epf','esi','tds','mobile_deduction','pt','lop','vpf','fa','advance','recoveries','other_deductions'];
    dedFields.forEach((id, i) => document.getElementById(id).value = deductions[dedKeys[i]] || 0);

    calcModalPreview();
    if(btn) { btn.textContent = '📥 Refresh Data'; btn.disabled = false; }
  } catch (e) { 
    console.error(e); 
    toast('Error loading data', 'error'); 
  }
}

function calcModalPreview() {
  const v = id => parseFloat(document.getElementById(id).value) || 0;
  // Sum Earnings
  const gross = ['mBasic','mDa','mHra','mConv','mMed','mSpl','mTa','mMa','mVar','mPerf','mInc','mOnsite','mBonus','mOtherEarn'].reduce((sum, id) => sum + v(id), 0);
  // Sum Deductions
  const ded = ['mEpf','mEsi','mTds','mMob','mPt','mLop','mVpf','mFa','mAdv','mRec','mOtherDed'].reduce((sum, id) => sum + v(id), 0);
  
  document.getElementById('mGross').textContent = 'Rs. ' + gross.toLocaleString('en-IN');
  document.getElementById('mDed').textContent = 'Rs. ' + ded.toLocaleString('en-IN');
  document.getElementById('mNet').textContent = 'Rs. ' + (gross - ded).toLocaleString('en-IN');
}

async function saveModalSalary() {
  const empId = document.getElementById('modalEmpId').value;
  if (!empId) return;

  const v = id => parseFloat(document.getElementById(id).value) || 0;
  
  // Calculate Totals
  const gross = ['mBasic','mDa','mHra','mConv','mMed','mSpl','mTa','mMa','mVar','mPerf','mInc','mOnsite','mBonus','mOtherEarn'].reduce((sum, id) => sum + v(id), 0);
  const ded = ['mEpf','mEsi','mTds','mMob','mPt','mLop','mVpf','mFa','mAdv','mRec','mOtherDed'].reduce((sum, id) => sum + v(id), 0);

  // Determine Target Month Collection
  const monthSelect = document.getElementById('processMonth');
  const yearSelect = document.getElementById('processYear');
  const m = monthSelect ? parseInt(monthSelect.value) : new Date().getMonth();
  const y = yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear();
  const monthKey = String(m + 1).padStart(2, '0');
  const yearKey = String(y).slice(-2);
  const collName = `payroll_${monthKey}_${yearKey}`;

  try {
    // 1. Save Static Info to payrollMaster
    await S.clientDb.collection('payrollMaster').doc(empId).set({
      companyId: S.prefs.companyId,
      EMPID: empId,
      bankAccount: document.getElementById('mBank').value,
      ifsc: document.getElementById('mIfsc').value,
      pan: document.getElementById('mPan').value,
      aadhaar: document.getElementById('mAadhaar').value,
      pfAccountNo: document.getElementById('mPfNo').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Save Variable Amounts to payroll_MM_YY
    await S.clientDb.collection(collName).doc(empId).set({
      companyId: S.prefs.companyId,
      EMPID: empId,
      earnings: {
        basic_salary: v('mBasic'), da: v('mDa'), hra: v('mHra'), conveyance: v('mConv'),
        medical: v('mMed'), special_allowance: v('mSpl'), ta: v('mTa'), ma: v('mMa'),
        variable_pay: v('mVar'), performance: v('mPerf'), incentives: v('mInc'),
        onsite_allowances: v('mOnsite'), bonus: v('mBonus'), other_allowances: v('mOtherEarn')
      },
      deductions: {
        epf: v('mEpf'), esi: v('mEsi'), tds: v('mTds'), mobile_deduction: v('mMob'),
        pt: v('mPt'), lop: v('mLop'), vpf: v('mVpf'), fa: v('mFa'), advance: v('mAdv'),
        recoveries: v('mRec'), other_deductions: v('mOtherDed')
      },
      summary: { gross, total_deductions: ded, net_pay: gross - ded },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    toast('✅ Salary components saved', 'success');
    closeSalaryModal();
    // Refresh tables
    if(document.getElementById('tabProcess').classList.contains('active')) processMonthlyPayroll();
    else fetchPayEditData(); 

  } catch (e) { 
    toast('❌ Save failed: ' + e.message, 'error'); 
  }
}

/* ══════════════════════════════════════════════════════
   PAY EDIT TABLE (Tab 1)
══════════════════════════════════════════════════════ */
async function fetchPayEditData() {
  const tbody = document.getElementById('payEditTableBody');
  const btn = document.getElementById('btnFetchPayEdit');
  btn.textContent = '⏳ Loading...'; btn.disabled = true;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;">Loading employees...</td></tr>';
  
  try {
    const snap = await S.clientDb.collection('employees').where('companyId', '==', S.prefs.companyId).get();
    
    if (snap.empty) { 
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;">No employees found</td></tr>'; 
      btn.textContent = '📥 Fetch Employees'; btn.disabled = false; 
      return; 
    }
    
    let html = '';
    for (const doc of snap.docs) {
      const emp = doc.data();
      const empId = emp.EMPID || doc.id;
      const name = emp.EmpName || emp.Name || '—';
      const desig = emp.Designation || emp.designation || '—';
      
      html += `<tr>
        <td class="mono">${empId}</td>
        <td><strong>${name}</strong></td>
        <td>${desig}</td>
        <td style="text-align:center;">
          <div class="actions-cell">
            <button class="btn-action btn-edit" onclick="openSalaryModal('${empId}')">✏️ Edit</button>
            <button class="btn-action btn-payslip" onclick="generatePayslip('${empId}')">📨 Payslip</button>
          </div>
        </td>
      </tr>`;
    }
    tbody.innerHTML = html;
    btn.textContent = '📥 Refresh Data'; btn.disabled = false;
    
  } catch (e) { 
    console.error(e); 
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--red);">Error loading</td></tr>';
    btn.textContent = '📥 Fetch Employees'; btn.disabled = false; 
  }
}

/* ══════════════════════════════════════════════════════
   PROCESS PAYROLL (Tab 2) - DISPLAY STORED VALUES ONLY
══════════════════════════════════════════════════════ */
async function processMonthlyPayroll() {
  const month = parseInt(document.getElementById('processMonth').value);
  const year = parseInt(document.getElementById('processYear').value);
  
  // ✅ Collection name format: payroll_MM_YY (e.g., payroll_05_26)
  const monthKey = String(month + 1).padStart(2, '0');
  const yearKey = String(year).slice(-2);
  const collectionName = `payroll_${monthKey}_${yearKey}`;
  
  if (!confirm(`Process payroll for ${new Date(year, month).toLocaleString('default', {month:'long'})} ${year}?`)) return;
  
  const tbody = document.getElementById('processTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">⏳ Loading payroll records...</td></tr>';
  
  try {
    // Fetch Employees
    const empSnap = await S.clientDb.collection('employees')
      .where('companyId', '==', S.prefs.companyId)
      .get();
    
    let totalGross = 0, totalNet = 0, count = 0;
    let html = '';
    
    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      const empId = emp.EMPID || empDoc.id;
      
      // ✅ Fetch stored payroll data from payroll_MM_YY collection
      const payDoc = await S.clientDb.collection(collectionName).doc(empId).get();
      
      // Skip employees without payroll records for this month
      if (!payDoc.exists) continue;
      
      const payData = payDoc.data();
      const earnings = payData.earnings || {};
      const deductions = payData.deductions || {};
      
      // ✅ Use stored values AS-IS (no recalculation)
      const grossSalary = payData.summary?.gross || payData.grossSalary || 0;
      const netSalary = payData.summary?.net_pay || payData.netSalary || 0;
      const totalDeductions = payData.summary?.total_deductions || 
                             (earnings.epf||0) + (earnings.esi||0) + (earnings.tds||0) + 
                             (earnings.pt||0) + (earnings.lop||0) || 0;
      
      // Get attendance info for display only (not for calculation)
      let presentDays = payData.presentDays || 0;
      let lopDays = payData.lopDays || 0;
      
      // If attendance not stored, fetch for display purposes only
      if (presentDays === 0 && lopDays === 0) {
        const attSnap = await S.clientDb.collection('attendance')
          .where('companyId', '==', S.prefs.companyId)
          .get();
        
        const monthAtt = attSnap.docs.filter(d => {
          const r = d.data();
          if ((r.EMPID || r.empId) !== empId) return false;
          const dt = r.Date?.toDate ? r.Date.toDate() : new Date(r.Date);
          return dt.getMonth() === month && dt.getFullYear() === year;
        });
        
        presentDays = monthAtt.filter(a => a.Status === 'PRESENT').length;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        lopDays = daysInMonth - presentDays;
      }
      
      // ✅ Accumulate totals for summary stats only
      totalGross += grossSalary;
      totalNet += netSalary;
      count++;
      
      // ✅ Display stored values exactly as saved
      html += `<tr>
        <td class="mono">${empId}</td>
        <td><strong>${emp.EmpName || emp.Name || '—'}</strong></td>
        <td style="text-align:center;color:var(--green);">${presentDays}</td>
        <td style="text-align:center;color:var(--red);">${lopDays}</td>
        <td style="text-align:right;">Rs. ${Math.round(grossSalary).toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:var(--red);">Rs. ${Math.round(totalDeductions).toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:700;color:var(--teal);">Rs. ${Math.round(netSalary).toLocaleString('en-IN')}</td>
      </tr>`;
    }
    
    // ✅ Display results
    tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;padding:30px;">No payroll records found for this month</td></tr>';
    document.getElementById('procTotalEmp').textContent = count;
    document.getElementById('procTotalGross').textContent = 'Rs. ' + Math.round(totalGross).toLocaleString('en-IN');
    document.getElementById('procTotalNet').textContent = 'Rs. ' + Math.round(totalNet).toLocaleString('en-IN');
    
    if (count > 0) {
      toast(`✅ Loaded ${count} payroll records`, 'success');
    } else {
      toast('ℹ️ No payroll records found. Edit salaries first, then process.', 'info');
    }
    
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Error: ' + e.message + '</td></tr>';
  }
}

/* ══════════════════════════════════════════════════════
   PROFESSIONAL PAYSLIP GENERATOR (LOGO ABOVE COMPANY NAME)
══════════════════════════════════════════════════════ */
async function generatePayslip(empId) {
  try {
    // Get Context
    const monthSelect = document.getElementById('processMonth');
    const yearSelect = document.getElementById('processYear');
    const m = monthSelect ? parseInt(monthSelect.value) : new Date().getMonth();
    const y = yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthKey = String(m + 1).padStart(2, '0');
    const yearKey = String(y).slice(-2);
    const collName = `payroll_${monthKey}_${yearKey}`;

    // Fetch All Data
    const [compSnap, empSnap, masterSnap, paySnap] = await Promise.all([
      S.clientDb.collection('companyProfile').doc(S.prefs.companyId).get(),
      S.clientDb.collection('employees').doc(empId).get(),
      S.clientDb.collection('payrollMaster').doc(empId).get(),
      S.clientDb.collection(collName).doc(empId).get()
    ]);

    if (!paySnap.exists) { toast('No payroll data found for this month', 'error'); return; }

    const comp = compSnap.exists ? compSnap.data() : {};
    const emp = empSnap.exists ? empSnap.data() : {};
    const master = masterSnap.exists ? masterSnap.data() : {};
    const pay = paySnap.data();
    const earnings = pay.earnings || {};
    const deductions = pay.deductions || {};

    // Generate PDF
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
    doc.text(`${monthNames[m]} ${y}`, pageWidth - margin, yPos + 18, { align: 'right' });
    
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

    // Save
    doc.save(`Payslip_${empId}_${monthNames[m]}_${y}.pdf`);
    toast('✅ Payslip generated successfully', 'success');

  } catch (e) {
    console.error(e);
    toast('Failed to generate payslip: ' + e.message, 'error');
  }
}
/* ══════════════════════════════════════════════════════
   EXPORT FUNCTIONS
══════════════════════════════════════════════════════ */
function exportPayrollCSV() {
  toast('CSV export not implemented for new structure', 'warn');
}

async function exportPayrollPDF() {
  toast('PDF report export not implemented for new structure', 'warn');
}

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
function parseAttendanceDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal?.toDate) return dateVal.toDate();
  if (dateVal instanceof Date) return dateVal;
  return new Date(dateVal);
}

function toast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  alert(`${type === 'error' ? '❌' : '✅'} ${message}`);
}