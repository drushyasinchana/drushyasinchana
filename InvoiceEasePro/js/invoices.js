/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - INVOICE MANAGEMENT (Complete Fixed)
Features: Save, Edit, Delete, Preview, Signature Toggle, Bill No. Preview, SAC/Rate Auto-fill
Profile-Aware: Filter by dropdown profileId (NO index required)
══════════════════════════════════════════════════════ */

// ✅ Helper: Get active profile ID from dropdown or session
function getActiveProfileId() {
  return window.selectedProfileId || window.currentCompanyId || sessionStorage.getItem('activeProfileId') || 'COMP001';
}

// ✅ Helper: Generate short unique ID (6 digits)
function generateUniqueId() {
  return Date.now().toString().slice(-6);
}

// ✅ Helper: Get current financial year (April-March)
function getCurrentFinancialYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) {
    return `${year}-${(year+1).toString().slice(-2)}`;
  } else {
    return `${year-1}-${year.toString().slice(-2)}`;
  }
}

// ✅ Helper: Generate preview invoice number (for display before save)
async function getPreviewInvoiceNumber() {
  try {
    const profileId = getActiveProfileId();
    const profile = await window.InvoiceApp.clientDb.collection('companyProfile').doc(profileId).get();
    const profileData = profile.data() || {};
    
    const prefix = profileData.invoicePrefix || window.InvoiceApp.companyId.slice(0,3).toUpperCase();
    const financialYear = profileData.financialYear || getCurrentFinancialYear();
    const startNumber = profileData.invoiceStartNumber || 1;
    
    const seqRef = window.InvoiceApp.clientDb.collection('sequences').doc(prefix);
    const seqDoc = await seqRef.get();
    
    let nextNum;
    if (seqDoc.exists) {
      const seqData = seqDoc.data();
      if (seqData.financialYear !== financialYear) {
        nextNum = startNumber;
      } else {
        nextNum = seqData.currentNumber;
      }
    } else {
      nextNum = startNumber;
    }
    
    const formattedNum = String(nextNum).padStart(3, '0');
    let invoiceNumber = `${prefix}/${financialYear}/${formattedNum}`;
    
    // Enforce 16-char max (GST rule)
    if (invoiceNumber.length > 16) {
      invoiceNumber = `${prefix}-${formattedNum}`;
      if (invoiceNumber.length > 16) {
        invoiceNumber = `${prefix}${nextNum}`;
      }
    }
    
    return invoiceNumber;
  } catch (e) {
    console.error('Preview number error:', e);
    return 'KAR-001'; // Fallback
  }
}

window.loadInvoices = async function() {
  console.log('📄 Loading invoices...');
  const c = document.getElementById('invoicesContainer');
  if (!c) { console.error('invoicesContainer not found'); return; }
  
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading invoices...</div>';
  
  try {
    const db = window.InvoiceApp.clientDb;
    const profileId = getActiveProfileId();
    
    if (!db || !profileId) {
      throw new Error('Database or Profile ID not initialized');
    }
    
    // ✅ Filter by profileId ONLY (no orderBy = no index needed)
    const snap = await db.collection('invoices').where('profileId', '==', profileId).get();
    
    console.log('📄 Invoices loaded:', snap.size);
    
    if (snap.empty) {
      c.innerHTML = `<div style="text-align:center;padding:60px;"><div style="font-size:3rem;">📄</div><h3 style="color:var(--muted);">No Invoices Yet</h3><button class="btn btn-teal" style="margin-top:16px;" onclick="showInvoiceModal()">+ Create Invoice</button></div>`;
      return;
    }
    
    // ✅ Sort in JavaScript instead of Firestore
    const invoices = [];
    snap.forEach(doc => {
      invoices.push({ id: doc.id, ...doc.data() });
    });
    invoices.sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bDate - aDate; // Descending
    });
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="margin:0;">Invoices</h2><button class="btn btn-teal" onclick="showInvoiceModal()">+ Create Invoice</button></div><div class="table-container"><table><thead><tr><th>Invoice No</th><th>Customer</th><th>Date</th><th style="text-align:right;">Amount</th><th style="text-align:center;">Status</th><th style="text-align:center;">Actions</th></tr></thead><tbody>`;
    
    invoices.forEach(inv => {
      const d = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate().toLocaleDateString('en-IN') : 
                inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-';
      const sc = inv.status === 'paid' ? 'badge-green' : inv.status === 'sent' ? 'badge-amber' : 'badge-gray';
      
      h += `<tr>
        <td style="font-weight:600;">${inv.invoiceNumber || '-'}</td>
        <td>${inv.customerName || '-'}</td>
        <td style="color:var(--muted);">${d}</td>
        <td style="text-align:right;font-weight:600;">₹${parseFloat(inv.grandTotal || 0).toLocaleString('en-IN')}</td>
        <td style="text-align:center;"><span class="badge ${sc}">${inv.status || 'draft'}</span></td>
<td style="text-align:center;">
  <button class="btn-icon" onclick="showInvoicePreview('${inv.id}')" title="View PDF">👁️</button>
  <button class="btn-icon" onclick="editInvoice('${inv.id}')" title="Edit">✏️</button>
  <button class="btn-icon" onclick="downloadInvoicePDF('${inv.id}')" title="Download PDF">📄</button>
  <button class="btn-icon" onclick="deleteInvoice('${inv.id}')" title="Delete" style="color:var(--red);">🗑</button>
</td>
      </tr>`;
    });
    
    h += '</tbody></table></div>';
    c.innerHTML = h;
  } catch (e) {
    console.error('Load invoices error:', e);
    c.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px;">Error loading invoices: ${e.message}<br><button class="btn btn-teal" style="margin-top:12px;" onclick="window.loadInvoices()">Retry</button></div>`;
  }
};

// ✅ Edit Function
window.editInvoice = async function(id) {
  const doc = await window.InvoiceApp.clientDb.collection('invoices').doc(id).get();
  if (!doc.exists) return alert('Invoice not found');
  
  const inv = doc.data();
  showInvoiceModal(id, inv);
};

// ✅ Delete Function
window.deleteInvoice = async function(id) {
  if(!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;
  try {
    await window.InvoiceApp.clientDb.collection('invoices').doc(id).delete();
    window.loadInvoices();
  } catch (e) {
    console.error('Delete error:', e);
    alert('Failed to delete: ' + e.message);
  }
};

// ✅ Show Modal (Create or Edit) - WITH GST/IGST/NON-GST TOGGLE & BILL NO. PREVIEW
window.showInvoiceModal = async function(editId = null, editData = null) {
  // Remove old modal if exists
  const oldModal = document.getElementById('invoiceModal');
  if (oldModal) oldModal.remove();
  
  // ✅ Use profile ID for filtering customers/particulars
  const profileId = getActiveProfileId();
  
  const custSnap = await window.InvoiceApp.clientDb.collection('customers')
    .where('profileId','==',profileId)
    .where('isActive','==',true).get();
    
  const partSnap = await window.InvoiceApp.clientDb.collection('invoiceParticulars')
    .where('profileId','==',profileId)
    .where('isActive','==',true).get();
    
  const today = new Date().toISOString().split('T')[0];
  
  // Default values for GST toggles
  const isNonGstDefault = editData && editData.isNonGst === true;
  const isIgstDefault = editData && editData.isIgst === true;
  
  const modal = document.createElement('div');
  modal.id = 'invoiceModal';
  modal.className = 'modal';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:1100px; width:95%; padding:32px; max-height:90vh; overflow-y:auto;">
      <div id="invoiceFormContainer">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h2 style="margin:0;font-size:1.4rem;">${editId ? 'Edit' : 'Create'} Invoice</h2>
          <button class="btn-close" onclick="closeModal('invoiceModal')" style="font-size:2rem;line-height:1;background:none;border:none;cursor:pointer;color:var(--muted);">&times;</button>
        </div>
        
        <form id="invoiceForm" onsubmit="saveInvoice(event)">
          <input type="hidden" id="editDocId" value="${editId || ''}">
          
          <div class="form-grid" style="grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:18px;">
            <!-- Bill No. Preview -->
            <div class="fg">
              <label>Bill No. (Preview)</label>
              <input type="text" id="invBillNoPreview" readonly value="Loading..." style="padding:12px;font-size:1rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;"/>
              <div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">This number will be assigned on save</div>
            </div>
            
            <!-- Customer -->
            <div class="fg"><label>Customer *</label><select id="invCustomer" required style="padding:12px;font-size:1rem;">
              <option value="">Select Customer</option>
              ${custSnap.docs.map(d=>{
                const c=d.data();
                const selected = editData && editData.customerId === d.id ? 'selected' : '';
                return `<option value="${d.id}" data-gstn="${c.gstn||''}" data-pan="${c.pan||''}" data-address="${c.address||''}" ${selected}>${c.customerName}</option>`;
              }).join('')}
            </select></div>
            
            <!-- Invoice Date -->
            <div class="fg"><label>Invoice Date *</label><input type="date" id="invDate" required value="${editData ? (editData.invoiceDate?.toDate ? editData.invoiceDate.toDate().toISOString().split('T')[0] : new Date(editData.invoiceDate).toISOString().split('T')[0]) : today}" style="padding:12px;font-size:1rem;"/></div>
            
            <!-- PO Number -->
            <div class="fg"><label>PO Number</label><input type="text" id="invPONumber" value="${editData ? editData.poNumber || '' : ''}" style="padding:12px;font-size:1rem;"/></div>
            
            <!-- PO Date -->
            <div class="fg"><label>PO Date</label><input type="date" id="invPODate" value="${editData ? (editData.poDate?.toDate ? editData.poDate.toDate().toISOString().split('T')[0] : editData.poDate ? new Date(editData.poDate).toISOString().split('T')[0] : '') : today}" style="padding:12px;font-size:1rem;"/></div>
          </div>
          
          <!-- ✅ GST Type Toggle (Non-GST / IGST / CGST+SGST) -->
          <div style="margin:16px 0; padding:15px; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
             <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
               <input type="checkbox" id="isNonGst" ${isNonGstDefault ? 'checked' : ''} style="width:18px;height:18px;">
               <span style="font-weight:600;">Non-GST (Tax = 0%)</span>
             </label>
             <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
               <input type="checkbox" id="isIgst" ${isIgstDefault ? 'checked' : ''} style="width:18px;height:18px;">
               <span style="font-weight:600;">IGST (Inter-State)</span>
             </label>
             <span style="font-size:0.8rem;color:var(--muted);margin-left:auto;">Default: CGST+SGST (Intra-State)</span>
          </div>
          
          <div style="background:var(--bg);padding:20px;border-radius:10px;margin:20px 0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;">Items</h3>
              <button type="button" class="btn btn-outline" onclick="addInvoiceItem()" style="padding:10px 16px;font-size:0.95rem;">+ Add Item</button>
            </div>
            <div id="invoiceItems"></div>
          </div>
          
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:20px;">
            <div class="fg"><label>Remarks</label><textarea id="invRemarks" rows="3" style="padding:12px;font-size:1rem;">${editData ? editData.remarks || '' : ''}</textarea></div>
            <div style="background:var(--teal-s);padding:20px;border-radius:10px;display:flex;flex-direction:column;justify-content:space-between;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Subtotal:</span><strong id="calcSubtotal" style="font-size:1.1rem;">₹${editData ? editData.subtotal.toFixed(2) : '0.00'}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span id="taxLabel1">CGST:</span><strong id="calcCgst" style="font-size:1.1rem;">₹${editData ? editData.totalCgst.toFixed(2) : '0.00'}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span id="taxLabel2">SGST:</span><strong id="calcSgst" style="font-size:1.1rem;">₹${editData ? editData.totalSgst.toFixed(2) : '0.00'}</strong></div>
              <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:2px solid var(--teal);margin-top:8px;">
                <span style="font-size:1.2rem;font-weight:700;">Grand Total:</span><strong id="calcGrandTotal" style="font-size:1.3rem;color:var(--teal-d);">₹${editData ? editData.grandTotal.toFixed(2) : '0.00'}</strong>
              </div>
            </div>
          </div>
          
          <!-- Signature Checkbox -->
          <div style="margin:20px 0; padding:15px; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; gap:12px;">
             <input type="checkbox" id="includeSignature" ${editData && editData.signatureIncluded === false ? '' : 'checked'} style="width:20px; height:20px;">
             <label for="includeSignature" style="font-weight:600; cursor:pointer;">Include Digital Signature on PDF</label>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
            <button type="button" class="btn btn-outline" onclick="closeModal('invoiceModal')" style="padding:12px 24px;font-size:1rem;">Cancel</button>
            <button type="submit" class="btn btn-teal" style="padding:12px 24px;font-size:1rem;">💾 Save & Preview</button>
          </div>
        </form>
      </div>
      
      <!-- Preview Section (Hidden initially) -->
      <div id="invoicePreviewContainer" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;color:var(--green);">✅ Invoice Saved! Review below.</h2>
          <button class="btn-close" onclick="closeModal('invoiceModal')" style="font-size:2rem;line-height:1;background:none;border:none;cursor:pointer;color:var(--muted);">&times;</button>
        </div>
        <iframe id="pdfPreviewFrame" style="width:100%; height:70vh; border:1px solid var(--border); border-radius:8px; margin-bottom:16px;"></iframe>
        <div style="display:flex;justify-content:center;gap:16px;">
          <button class="btn btn-teal" id="btnDownloadPreview" style="padding:12px 30px;font-size:1.1rem;">📥 Download PDF</button>
          <button class="btn btn-outline" onclick="showInvoiceModal()" style="padding:12px 24px;">➕ Create Another</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  
  // Load Bill No. Preview
  getPreviewInvoiceNumber().then(num => {
    const previewInput = document.getElementById('invBillNoPreview');
    if (previewInput) previewInput.value = num;
  });
  
  // Add items
  if (editData && editData.items) {
    editData.items.forEach(item => addInvoiceItem(item));
  } else {
    addInvoiceItem();
  }
  
  // ✅ Add event listeners for GST toggles to recalculate totals
  document.getElementById('isNonGst')?.addEventListener('change', calcTotal);
  document.getElementById('isIgst')?.addEventListener('change', calcTotal);
  
  // ✅ Initialize tax labels based on edit data
  if (isNonGstDefault) {
    document.getElementById('taxLabel1').textContent = 'Tax:';
    document.getElementById('taxLabel2').style.display = 'none';
  } else if (isIgstDefault) {
    document.getElementById('taxLabel1').textContent = 'IGST:';
    document.getElementById('taxLabel2').style.display = 'none';
  }
};

// ✅ Add Item Row - WITH CLASS NAME FOR RELIABLE SELECTION
window.addInvoiceItem = async function(presetItem = null) {
  const c = document.getElementById('invoiceItems');
  if(!c) return;
  const idx = c.children.length;
  // ✅ Use profileId for filtering particulars
  const profileId = getActiveProfileId();
  const snap = await window.InvoiceApp.clientDb.collection('invoiceParticulars').where('profileId','==',profileId).where('isActive','==',true).get();
  
  const row = document.createElement('div');
  // ✅ Add className for reliable selection
  row.className = 'invoice-item-row';
  row.style.cssText = 'display:grid;grid-template-columns:2.5fr 1fr 1.2fr 1fr 1.2fr auto;gap:14px;margin-bottom:14px;align-items:end;padding-bottom:14px;border-bottom:1px dashed var(--border);';
  row.innerHTML = `
    <div><label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Particulars</label>
      <select class="item-particular" onchange="onItemChange(this,${idx})" style="padding:10px;font-size:0.95rem;width:100%;">
        <option value="">Select Item</option>
        ${snap.docs.map(d=>{const p=d.data();return `<option value="${d.id}" data-rate="${p.rate||0}" data-gst="${p.gstRate||0}" data-sac="${p.sacCode||''}">${p.itemName}</option>`}).join('')}
      </select>
    </div>
    <div><label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">SAC</label><input class="item-sac" readonly style="padding:10px;background:var(--bg);font-size:0.95rem;width:100%;"/></div>
    <div><label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Rate (₹)</label><input type="number" class="item-rate" step="0.01" onchange="calcItem(${idx})" style="padding:10px;font-size:0.95rem;width:100%;"/></div>
    <div><label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Qty</label><input type="number" class="item-qty" value="${presetItem ? presetItem.quantity : 1}" min="1" onchange="calcItem(${idx})" style="padding:10px;font-size:0.95rem;width:100%;"/></div>
    <div><label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Amount</label><input type="number" class="item-amount" readonly style="padding:10px;background:var(--bg);font-size:0.95rem;width:100%;"/></div>
    <button type="button" onclick="this.parentElement.remove();calcTotal()" style="padding:10px;background:var(--red);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1.2rem;height:42px;">×</button>
  `;
  c.appendChild(row);
  
  if (presetItem) {
    const select = row.querySelector('.item-particular');
    select.value = presetItem.particular;
    const opt = select.options[select.selectedIndex];
    row.querySelector('.item-sac').value = presetItem.sacCode || opt?.dataset?.sac || '';
    row.querySelector('.item-rate').value = presetItem.rate;
    row.querySelector('.item-amount').value = presetItem.amount;
    calcTotal();
  }
};

// ✅ FIXED: On Item Change - Use className selector
window.onItemChange = function(sel, idx) {
  // ✅ Use class name instead of [style] selector
  const row = sel.closest('.invoice-item-row');
  if (!row) {
    console.error('Row not found for index', idx);
    return;
  }
  
  const opt = sel.options[sel.selectedIndex];
  
  // ✅ Safely get data attributes with fallbacks
  const sac = opt.dataset.sac || '';
  const rate = opt.dataset.rate || '0';
  
  // ✅ Populate fields
  const sacInput = row.querySelector('.item-sac');
  const rateInput = row.querySelector('.item-rate');
  
  if (sacInput) sacInput.value = sac;
  if (rateInput) rateInput.value = rate;
  
  // Recalculate amount
  calcItem(idx);
};

window.calcItem = function(idx) {
  const rows = document.querySelectorAll('#invoiceItems > div');
  const row = rows[idx];
  if(!row) return;
  const amt = (parseFloat(row.querySelector('.item-rate').value)||0) * (parseFloat(row.querySelector('.item-qty').value)||0);
  row.querySelector('.item-amount') || (row.insertAdjacentHTML('beforeend', `<input type="hidden" class="item-amount" value="${amt.toFixed(2)}"/>`));
  row.querySelector('.item-amount').value = amt.toFixed(2);
  calcTotal();
};

// ✅ Calculate Totals (Handles GST vs Non-GST)
window.calcTotal = function() {
  let sub=0, rawCgst=0, rawSgst=0, rawIgst=0;
  const isNonGst = document.getElementById('isNonGst')?.checked === true;
  const isIgst = document.getElementById('isIgst')?.checked === true;
  
  document.querySelectorAll('#invoiceItems > div').forEach(row => {
    const amt = parseFloat(row.querySelector('.item-amount')?.value) || 0;
    const select = row.querySelector('.item-particular');
    const opt = select.options[select.selectedIndex];
    const gstRate = parseFloat(opt.dataset.gst) || 0;
    
    sub += amt;
    
    if (isNonGst) {
      // No tax
    } else if (isIgst) {
      // IGST = full rate
      rawIgst += amt * gstRate / 100;
    } else {
      // CGST + SGST = half rate each
      rawCgst += amt * (gstRate/2) / 100;
      rawSgst += amt * (gstRate/2) / 100;
    }
  });
  
  // Round taxes to nearest rupee (Section 170)
  const cgst = Math.round(rawCgst);
  const sgst = Math.round(rawSgst);
  const igst = Math.round(rawIgst);
  
  // Update UI labels
  const label1 = document.getElementById('taxLabel1');
  const label2 = document.getElementById('taxLabel2');
  
  if (isNonGst) {
    label1.textContent = 'Tax:';
    label2.style.display = 'none';
    document.getElementById('calcCgst').textContent = '₹0.00';
    document.getElementById('calcSgst').textContent = '₹0.00';
  } else if (isIgst) {
    label1.textContent = 'IGST:';
    label2.style.display = 'none';
    document.getElementById('calcCgst').textContent = '₹' + igst.toFixed(2);
    document.getElementById('calcSgst').textContent = '₹0.00';
  } else {
    label1.textContent = 'CGST:';
    label2.style.display = 'block';
    label2.textContent = 'SGST:';
    document.getElementById('calcCgst').textContent = '₹' + cgst.toFixed(2);
    document.getElementById('calcSgst').textContent = '₹' + sgst.toFixed(2);
  }

  document.getElementById('calcSubtotal').textContent = '₹'+sub.toFixed(2);
  document.getElementById('calcGrandTotal').textContent = '₹'+(sub + (isIgst ? igst : cgst + sgst)).toFixed(2);
};


// ✅ Save Invoice (With GST/Non-GST & Preview Logic) - MODIFIED FOR PROFILE ID
window.saveInvoice = async function(e) {
  e.preventDefault();
  const cSel = document.getElementById('invCustomer');
  const cOpt = cSel.options[cSel.selectedIndex];
  if (!cSel.value) { alert('Please select a customer'); return; }
  
  const editId = document.getElementById('editDocId').value;
  const includeSignature = document.getElementById('includeSignature')?.checked !== false;
  const isNonGst = document.getElementById('isNonGst')?.checked === true;
  const isIgst = document.getElementById('isIgst')?.checked === true;
  
  // ✅ Get profile ID for this invoice
  const profileId = getActiveProfileId();
  const companyId = window.InvoiceApp.companyId;
  
  let invNum = '';
  const items = [];
  
  document.querySelectorAll('#invoiceItems > div').forEach(row => {
    const ps = row.querySelector('.item-particular');
    const opt = ps.options[ps.selectedIndex];
    if (!ps.value) return;
    const gstRate = isNonGst ? 0 : (parseFloat(opt.dataset.gst)||0);
    const amt = parseFloat(row.querySelector('.item-amount').value)||0;
    items.push({
      particular:ps.value, itemName:opt.text, sacCode:row.querySelector('.item-sac').value, 
      rate:parseFloat(row.querySelector('.item-rate').value)||0, 
      quantity:parseFloat(row.querySelector('.item-qty').value)||0, 
      amount:amt, gstRate:gstRate, 
      cgstAmount: isIgst ? 0 : (amt*(gstRate/2)/100), 
      sgstAmount: isIgst ? 0 : (amt*(gstRate/2)/100),
      igstAmount: isIgst ? (amt*gstRate/100) : 0
    });
  });
  
  if (items.length === 0) { alert('Please add at least one item'); return; }
  
  const sub = parseFloat(document.getElementById('calcSubtotal').textContent.replace('₹',''));
  const cgst = parseFloat(document.getElementById('calcCgst').textContent.replace('₹',''));
  const sgst = parseFloat(document.getElementById('calcSgst').textContent.replace('₹',''));
  const igst = isIgst ? cgst : 0; // Reuse calcCgst field for IGST display
  
  try {
    if (editId) {
      // ✅ Edit: Update existing invoice doc
      await window.InvoiceApp.clientDb.collection('invoices').doc(editId).set({
        invoiceDate: new Date(document.getElementById('invDate').value),
        customerId: cSel.value, customerName: cOpt.text,
        customerGstn: cOpt.dataset.gstn||'', customerPan: cOpt.dataset.pan||'', customerAddress: cOpt.dataset.address||'',
        poNumber: document.getElementById('invPONumber').value,
        poDate: document.getElementById('invPODate').value ? new Date(document.getElementById('invPODate').value) : null,
        items, subtotal:sub, totalCgst:cgst, totalSgst:sgst, totalIgst:igst, grandTotal:sub+cgst+sgst+igst,
        remarks: document.getElementById('invRemarks').value,
        signatureIncluded: includeSignature,
        isNonGst: isNonGst,
        isIgst: isIgst,
        profileId: profileId,  // ✅ Ensure profileId is set
        companyId: companyId,  // ✅ Preserve login companyId
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      const doc = await window.InvoiceApp.clientDb.collection('invoices').doc(editId).get();
      invNum = doc.data().invoiceNumber;
    } else {
      // ✅ Create: Generate deterministic doc ID based on profile + invoice number
      const profile = await window.InvoiceApp.clientDb.collection('companyProfile').doc(profileId).get();
      const profileData = profile.data() || {};
      const prefix = profileData.invoicePrefix || companyId.slice(0,3).toUpperCase();
      const financialYear = profileData.financialYear || getCurrentFinancialYear();
      const startNumber = profileData.invoiceStartNumber || 1;
      const seqRef = window.InvoiceApp.clientDb.collection('sequences').doc(prefix);
      const seqDoc = await seqRef.get();
      
      let nextNum;
      if (seqDoc.exists) {
        const seqData = seqDoc.data();
        if (seqData.financialYear !== financialYear) { nextNum = startNumber; } else { nextNum = seqData.currentNumber; }
      } else { nextNum = startNumber; }
      
      const formattedNum = String(nextNum).padStart(3, '0');
      let invoiceNumber = `${prefix}/${financialYear}/${formattedNum}`;
      if (invoiceNumber.length > 16) { invoiceNumber = `${prefix}-${formattedNum}`; if (invoiceNumber.length > 16) { invoiceNumber = `${prefix}${nextNum}`; } }
      invNum = invoiceNumber;
      
      // ✅ Generate deterministic Firestore doc ID: {companyId}_{profileId}_{invoiceNumber}
      const safeInvNum = invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_');
      const docId = `${companyId}_${profileId}_${safeInvNum}`;
      
      await window.InvoiceApp.clientDb.collection('invoices').doc(docId).set({
        profileId: profileId,           // ✅ Profile ID for filtering (COMP001-COMP005)
        companyId: companyId,           // ✅ Original login ID preserved
        invoiceNumber: invNum,
        invoiceDate: new Date(document.getElementById('invDate').value),
        customerId: cSel.value, customerName: cOpt.text,
        customerGstn: cOpt.dataset.gstn||'', customerPan: cOpt.dataset.pan||'', customerAddress: cOpt.dataset.address||'',
        poNumber: document.getElementById('invPONumber').value,
        poDate: document.getElementById('invPODate').value ? new Date(document.getElementById('invPODate').value) : null,
        items, subtotal:sub, totalCgst:cgst, totalSgst:sgst, totalIgst:igst, grandTotal:sub+cgst+sgst+igst,
        remarks: document.getElementById('invRemarks').value, status: 'draft',
        signatureIncluded: includeSignature,
        isNonGst: isNonGst,
        isIgst: isIgst,
        seriesId: prefix, financialYear: financialYear,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await seqRef.set({ seriesId: prefix, prefix: prefix, financialYear: financialYear, currentNumber: nextNum + 1, maxLength: 16, branchName: profileData.branchName || 'Default', supplyType: profileData.supplyType || 'domestic', isActive: true, lastResetDate: seqDoc.exists && seqDoc.data().financialYear !== financialYear ? firebase.firestore.FieldValue.serverTimestamp() : (seqDoc.exists ? seqDoc.data().lastResetDate : null), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    
    const docSnap = await window.InvoiceApp.clientDb.collection('invoices').where('invoiceNumber','==',invNum).where('profileId','==',profileId).get();
    if (!docSnap.empty) {
      const docId = docSnap.docs[0].id;
      const pdfBlobUrl = await generateInvoicePDFBlob(docId, includeSignature);
      document.getElementById('invoiceFormContainer').style.display = 'none';
      document.getElementById('invoicePreviewContainer').style.display = 'block';
      document.getElementById('pdfPreviewFrame').src = pdfBlobUrl;
      document.getElementById('btnDownloadPreview').onclick = () => { const a = document.createElement('a'); a.href = pdfBlobUrl; a.download = `${invNum}.pdf`; a.click(); };
    }
    window.loadInvoices();
  } catch (err) { console.error('Save error:', err); alert('❌ Error saving invoice: ' + err.message); }
};

// ✅ Generate PDF Blob for Preview
async function generateInvoicePDFBlob(id, includeSignature = true) {
  const docSnap = await window.InvoiceApp.clientDb.collection('invoices').doc(id).get();
  if(!docSnap.exists) return null;
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  return await renderInvoicePDF(docSnap.data(), id, includeSignature, 'bloburl');
}

// ✅ Public Download Function
window.downloadInvoicePDF = async function(id) {
  const docSnap = await window.InvoiceApp.clientDb.collection('invoices').doc(id).get();
  if(!docSnap.exists) return;
  
  const inv = docSnap.data();
  const includeSig = inv.signatureIncluded !== false; 
  
  await renderInvoicePDF(inv, id, includeSig, 'save');
};

// ==========================================
// CORE PDF RENDERER - FULL VERSION PRESERVED
// ==========================================
async function renderInvoicePDF(inv, id, includeSignature, outputMode) {
  // ✅ Use profileId to fetch correct company profile
  const profileId = inv.profileId || window.InvoiceApp.companyId;
  const compSnap = await window.InvoiceApp.clientDb.collection('companyProfile').doc(profileId).get();
  const comp = compSnap.exists ? compSnap.data() : {};
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  // 1. HEADER
  let y = 15;
  if (comp.logoUrl) {
    try {
      const logoData = comp.logoUrl.startsWith('') ? comp.logoUrl : `image/jpeg;base64,${comp.logoUrl}`;
      doc.addImage(logoData, 'JPEG', margin, y, 60, 30);
    } catch(e) { console.log('Logo error:', e); }
  }
  doc.setFontSize(22); doc.setFont(undefined, 'bold'); doc.setTextColor(40, 80, 140);
  doc.text('TAX INVOICE', pageWidth - margin, y + 10, { align: 'right' });
  y += 35;
  
  // 2. COMPANY DETAILS
  doc.setTextColor(40, 80, 140); doc.setFontSize(16); doc.setFont(undefined, 'bold');
  doc.text(comp.companyName || 'Company Name', pageWidth - margin, y, { align: 'right' });
  y += 7;
  doc.setTextColor(60, 60, 60); doc.setFontSize(8); doc.setFont(undefined, 'normal');
  
  if (comp.address) {
    const lines = comp.address.includes('\n') ? comp.address.split('\n') : doc.splitTextToSize(comp.address, 80);
    lines.forEach(line => { if (line.trim()) { doc.text(line.trim(), pageWidth - margin, y, { align: 'right' }); y += 4; } });
  }
  
  let contactLine = '';
  if (comp.phone) contactLine += 'Phone: ' + comp.phone;
  if (comp.email) contactLine += (contactLine ? ' | ' : '') + 'Email: ' + comp.email;
  if (contactLine) { doc.text(contactLine, pageWidth - margin, y, { align: 'right' }); y += 4; }
  if (comp.gstn) { doc.setTextColor(40, 80, 140); doc.setFont(undefined, 'bold'); doc.text('GSTIN: ' + comp.gstn, pageWidth - margin, y, { align: 'right' }); y += 4; }
  if (comp.pan) { doc.setTextColor(60, 60, 60); doc.setFont(undefined, 'normal'); doc.text('PAN: ' + comp.pan, pageWidth - margin, y, { align: 'right' }); y += 7; }
  
  doc.setDrawColor(40, 80, 140); doc.setLineWidth(0.3); doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  
  // 3. META - ✅ LEFT ALIGNED
  doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont(undefined, 'bold');
  const invDate = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate().toLocaleDateString('en-IN') : new Date(inv.invoiceDate).toLocaleDateString('en-IN');
  const leftColX = margin;
  const rightColX = pageWidth - margin - 60;
  
  doc.text('Bill No:', leftColX, y); doc.setFont(undefined, 'normal'); doc.text(inv.invoiceNumber || '-', leftColX + 18, y);
  doc.setFont(undefined, 'bold'); doc.text('PO No:', rightColX, y); doc.setFont(undefined, 'normal'); doc.text(inv.poNumber || '-', rightColX + 18, y);
  y += 6;
  doc.setFont(undefined, 'bold'); doc.text('Date:', leftColX, y); doc.setFont(undefined, 'normal'); doc.text(invDate, leftColX + 15, y);
  doc.setFont(undefined, 'bold'); doc.text('PO Date:', rightColX, y); doc.setFont(undefined, 'normal');
  const poDate = inv.poDate?.toDate ? inv.poDate.toDate().toLocaleDateString('en-IN') : new Date(inv.poDate).toLocaleDateString('en-IN');
  doc.text(poDate, rightColX + 25, y);
  y += 10;
  
  // 4. BILL TO
  doc.setFillColor(40, 80, 140); doc.rect(margin, y, 50, 6, 'F'); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold'); doc.setFontSize(9);
  doc.text('BILL TO', margin + 2, y + 4); y += 9;
  doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'bold'); doc.setFontSize(10); doc.text(inv.customerName || '-', margin, y);
  doc.setFont(undefined, 'normal'); doc.setFontSize(8); y += 5;
  if (inv.customerAddress) {
    const cLines = inv.customerAddress.includes('\n') ? inv.customerAddress.split('\n') : doc.splitTextToSize(inv.customerAddress, 80);
    cLines.forEach(line => { if (line.trim()) { doc.text(line.trim(), margin, y); y += 4; } });
  }
  if (inv.customerGstn) { doc.setTextColor(40, 80, 140); doc.setFont(undefined, 'bold'); doc.text('GSTIN: ' + inv.customerGstn, margin, y); doc.setTextColor(0, 0, 0); y += 4; }
  if (inv.customerPan) { doc.text('PAN: ' + inv.customerPan, margin, y); y += 4; }
  
  // 5. ITEMS TABLE - ✅ FIXED ALIGNMENTS
  y = Math.max(y + 8, 85);
  
  // ✅ Adjusted column positions
  const colSlNo = margin + 8;          // Sl.No. position
  const colParticulars = margin + 25;  // Particulars (left aligned)
  const colSAC = margin + 95;          // SAC (right aligned)
  const colRate = margin + 120;        // Rate (right aligned)
  const colQty = margin + 145;         // Qty (right aligned)
  const colAmount = margin + 170;      // Amount (right aligned)
  
  // ✅ Standard header height (8mm)
  doc.setFillColor(40, 80, 140);
  doc.rect(margin, y, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
 
  doc.text('Sl.No.', colSlNo, y + 3.5, { align: 'center' });
  
  // ✅ Other headers - Particulars left aligned, others right aligned
  doc.text('Particulars', colParticulars, y + 3.5, { align: 'left' });
  doc.text('SAC', colSAC, y + 3.5, { align: 'right' });
  doc.text('Rate', colRate, y + 3.5, { align: 'right' });
  doc.text('Qty', colQty, y + 3.5, { align: 'right' });
  doc.text('Amount', colAmount, y + 3.5, { align: 'right' });
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  
  inv.items.forEach((item, i) => {
    if (y > 250) { 
      doc.addPage(); 
      y = 20; 
      doc.setFillColor(40, 80, 140);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('Sl.No.', colSlNo, y + 4.5, { align: 'center' });
      doc.text('Particulars', colParticulars, y + 4.5, { align: 'left' });
      doc.text('SAC', colSAC, y + 4.5, { align: 'right' });
      doc.text('Rate', colRate, y + 4.5, { align: 'right' });
      doc.text('Qty', colQty, y + 4.5, { align: 'right' });
      doc.text('Amount', colAmount, y + 4.5, { align: 'right' });
      y += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 3, contentWidth, 6, 'F');
    }
    
    doc.setFont(undefined, 'bold');
    doc.text(String(i+1), colSlNo, y, { align: 'center' });
    doc.setFont(undefined, 'normal');
    
    const itemName = item.itemName || '-';
    if (itemName.length > 35) { 
      let b = itemName.lastIndexOf(' ', 35); 
      if (b === -1) b = 35; 
      doc.text(itemName.substring(0, b), colParticulars, y, { align: 'left' }); 
      if (itemName.substring(b+1)) { 
        doc.text(itemName.substring(b+1), colParticulars, y + 3.5, { align: 'left' }); 
        y += 3.5; 
      } 
    } else { 
      doc.text(itemName, colParticulars, y, { align: 'left' }); 
    }
    doc.text(item.sacCode || '-', colSAC, y, { align: 'right' });
    doc.text((item.rate || 0).toFixed(2), colRate, y, { align: 'right' });
    doc.text(String(item.quantity || 1), colQty, y, { align: 'right' });
    doc.text((item.amount || 0).toFixed(2), colAmount, y, { align: 'right' });
    y += 6;
  });
  
  // 6. TOTALS - ✅ ALIGNED WITH AMOUNT COLUMN
  y += 4; 
  doc.setFont(undefined, 'bold'); 
  doc.setFontSize(9);
  
  // ✅ Align labels and amounts properly
  doc.text('Subtotal:', colAmount - 40, y, { align: 'right' }); 
  doc.text('Rs. ' + (inv.subtotal || 0).toFixed(2), colAmount, y, { align: 'right' }); 
  y += 5;
  
  doc.setFont(undefined, 'normal');
  
  if (inv.isNonGst) {
    doc.text('Tax:', colAmount - 40, y, { align: 'right' }); 
    doc.text('Rs. 0.00', colAmount, y, { align: 'right' }); 
    y += 5;
  } else if (inv.isIgst) {
    doc.text('IGST:', colAmount - 40, y, { align: 'right' }); 
    const igstAmount = inv.totalIgst || inv.items.reduce((sum, item) => sum + (item.igstAmount || 0), 0);
    doc.text('Rs. ' + igstAmount.toFixed(2), colAmount, y, { align: 'right' }); 
    y += 5;
  } else {
    doc.text('CGST @ 9%:', colAmount - 40, y, { align: 'right' }); 
    doc.text('Rs. ' + (inv.totalCgst || 0).toFixed(2), colAmount, y, { align: 'right' }); 
    y += 5;
    doc.text('SGST @ 9%:', colAmount - 40, y, { align: 'right' }); 
    doc.text('Rs. ' + (inv.totalSgst || 0).toFixed(2), colAmount, y, { align: 'right' }); 
    y += 5;
  }
  
  if (inv.roundOff) { 
    doc.text('Round Off:', colAmount - 40, y, { align: 'right' }); 
    doc.text('Rs. ' + (inv.roundOff || 0).toFixed(2), colAmount, y, { align: 'right' }); 
    y += 5; 
  }
  
  // ✅ TOTAL box - extended to align with SAC column
  doc.setFillColor(40, 80, 140); 
  doc.rect(colSAC - 10, y - 3, colAmount - (colSAC - 5) + 14, 6, 'F'); // Extended box
  doc.setTextColor(255, 255, 255); 
  doc.setFont(undefined, 'bold'); 
  doc.text('TOTAL', colSAC, y + 1, { align: 'left' }); 
  doc.text('Rs. ' + (inv.grandTotal || 0).toFixed(2), colAmount, y + 1, { align: 'right' });
  
  // 7. AMOUNT IN WORDS
  y += 12; 
  doc.setTextColor(60, 60, 60); 
  doc.setFont(undefined, 'bold'); 
  doc.setFontSize(9);
  doc.text('Amount in words: ' + numberToWords(inv.grandTotal) + ' only', margin, y);
  
  // 8. BANK & ACCOUNT NAME
  y += 10; 
  doc.setDrawColor(150, 150, 150); 
  doc.setLineWidth(0.2); 
  doc.line(margin, y, pageWidth - margin, y); 
  y += 6;
  doc.setFont(undefined, 'normal'); 
  doc.setFontSize(8); 
  doc.setTextColor(60, 60, 60);
  
  if (comp.accountName) { 
    doc.text('Account Name: ' + comp.accountName, margin, y); 
    y += 4; 
  }
  if (comp.bankDetails) { 
    const bankName = (comp.bankDetails.bankName || '').toUpperCase();
    doc.text('Bank: ' + bankName, margin, y); 
    y += 4; 
    doc.text('A/C: ' + (comp.bankDetails.accountNumber || ''), margin, y); 
    y += 4; 
    doc.text('IFSC: ' + (comp.bankDetails.ifscCode || ''), margin, y); 
  }
  
  // NOTE / REMARKS
  const noteY = y + 16;
  if (inv.remarks) {
    doc.setFont(undefined, 'italic'); 
    doc.setFontSize(8);
    const noteText = 'Note: ' + inv.remarks;
    const lines = doc.splitTextToSize(noteText, 90);
    lines.slice(0, 3).forEach((line, idx) => { 
      doc.text(line, margin, noteY + (idx * 4)); 
    });
  }
  
  // SIGNATURE
  const sigStartY = y - 8;
  const sigX = pageWidth - margin;
  doc.setFont(undefined, 'normal'); 
  doc.setFontSize(8);
  doc.text('For ' + (comp.companyName || 'Company'), sigX, sigStartY, { align: 'right' });
  if (includeSignature && comp.signatureUrl) {
    try {
      const sigData = comp.signatureUrl.startsWith('') ? comp.signatureUrl : `image/png;base64,${comp.signatureUrl}`;
      doc.addImage(sigData, 'PNG', sigX - 50, sigStartY + 2, 50, 20);
      doc.text('Authorised Signatory', sigX, sigStartY + 24, { align: 'right' });
    } catch(e) { 
      console.log('Signature error:', e); 
      doc.text('Authorised Signatory', sigX, sigStartY + 15, { align: 'right' }); 
    }
  } else {
    doc.text('Authorised Signatory', sigX, sigStartY + 15, { align: 'right' });
  }
  
  doc.setFontSize(7); 
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for your business!', pageWidth / 2, 290, { align: 'center' });
  
  if (outputMode === 'save') { 
    const fileName = (inv.invoiceNumber || 'invoice') + '.pdf';
    doc.save(fileName);
    return null; 
  } else { 
    return doc.output('bloburl'); 
  }
}

// Number to Words Helper
function numberToWords(num) {
  if (!num) return 'Zero';
  const n = Math.round(num);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  function convertLessThanOneThousand(n) {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanOneThousand(n % 100) : '');
  }
  
  if (n === 0) return 'Zero';
  
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;
  
  let result = '';
  if (crore > 0) result += convertLessThanOneThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanOneThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanOneThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanOneThousand(remainder);
  
  return result.trim();
}

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'none';
    setTimeout(() => modal.remove(), 200);
  }
};

// Global ESC handler
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
  }
});

// ✅ Public View Function (Eye Icon)
window.showInvoicePreview = async function(id) {
  const docSnap = await window.InvoiceApp.clientDb.collection('invoices').doc(id).get();
  if(!docSnap.exists) return;
  
  const inv = docSnap.data();
  const includeSig = inv.signatureIncluded !== false;
  
  const modal = document.createElement('div');
  modal.id = 'viewModal';
  modal.className = 'modal';
  
  try {
    const blobUrl = await renderInvoicePDF(inv, id, includeSig, 'bloburl');
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width:1000px; width:95%; padding:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <h2>${inv.invoiceNumber} Preview</h2>
          <button class="btn-close" onclick="closeModal('viewModal')">&times;</button>
        </div>
        <iframe src="${blobUrl}" style="width:100%;height:75vh;border:none;"></iframe>
        <div style="text-align:center;margin-top:15px;">
          <button class="btn btn-teal" onclick="downloadInvoicePDF('${id}'); closeModal('viewModal');">📥 Download</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
  } catch (e) {
    console.error('Preview error:', e);
    alert('Error generating preview: ' + e.message);
  }
};