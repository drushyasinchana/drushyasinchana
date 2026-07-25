/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - INVOICE MANAGEMENT (Editable Particulars + Field Limits)
Features: Save, Edit, Delete, Preview, Signature Toggle, Bill No. Preview, SAC/Rate Auto-fill
Profile-Aware: Filter by dropdown profileId (NO index required)
PDF Themes: 6 professional color schemes selectable per invoice
Particulars: Editable field with autocomplete from saved items
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

// ✅ Helper: Get company name for active profile (for modal header)
async function getProfileCompanyName(profileId) {
  try {
    const doc = await window.InvoiceApp.clientDb.collection('companyProfile').doc(profileId).get();
    if (doc.exists) {
      const data = doc.data();
      return data.companyName || `Company ${profileId.slice(-1)}`;
    }
  } catch (e) {
    console.warn('Could not fetch company name:', e);
  }
  return `Company ${profileId.slice(-1)}`;
}

// ✅ PDF Color Themes - Professional palettes
const PDF_THEMES = {
  teal: {
    name: 'Teal Professional',
    primary: [40, 80, 140],
    secondary: [0, 131, 143],
    accent: [224, 247, 250],
    text: [13, 31, 34],
    border: [216, 232, 234]
  },
  blue: {
    name: 'Corporate Blue',
    primary: [25, 118, 210],
    secondary: [13, 71, 161],
    accent: [227, 242, 253],
    text: [13, 31, 34],
    border: [197, 221, 248]
  },
  orange: {
    name: 'Warm Orange',
    primary: [230, 81, 0],
    secondary: [191, 54, 12],
    accent: [255, 243, 224],
    text: [13, 31, 34],
    border: [255, 224, 178]
  },
  green: {
    name: 'Forest Green',
    primary: [46, 125, 50],
    secondary: [27, 94, 32],
    accent: [232, 245, 233],
    text: [13, 31, 34],
    border: [200, 230, 201]
  },
  lightbrown: {
    name: 'Earth Brown',
    primary: [141, 110, 99],
    secondary: [93, 64, 55],
    accent: [247, 239, 233],
    text: [13, 31, 34],
    border: [215, 204, 200]
  },
  darkbrown: {
    name: 'Executive Brown',
    primary: [62, 39, 35],
    secondary: [93, 64, 55],
    accent: [239, 235, 233],
    text: [255, 255, 255],
    border: [188, 170, 164]
  }
};

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
    
    if (invoiceNumber.length > 16) {
      invoiceNumber = `${prefix}-${formattedNum}`;
      if (invoiceNumber.length > 16) {
        invoiceNumber = `${prefix}${nextNum}`;
      }
    }
    
    return invoiceNumber;
  } catch (e) {
    console.error('Preview number error:', e);
    return 'KAR-001';
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
    
    const snap = await db.collection('invoices').where('profileId', '==', profileId).get();
    
    console.log('📄 Invoices loaded:', snap.size);
    
    if (snap.empty) {
      c.innerHTML = `<div style="text-align:center;padding:60px;"><div style="font-size:3rem;">📄</div><h3 style="color:var(--muted);">No Invoices Yet</h3><button class="btn btn-teal" style="margin-top:16px;" onclick="showInvoiceModal()">+ Create Invoice</button></div>`;
      return;
    }
    
    const invoices = [];
    snap.forEach(doc => {
      invoices.push({ id: doc.id, ...doc.data() });
    });
    invoices.sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bDate - aDate;
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

window.editInvoice = async function(id) {
  const doc = await window.InvoiceApp.clientDb.collection('invoices').doc(id).get();
  if (!doc.exists) return alert('Invoice not found');
  
  const inv = doc.data();
  showInvoiceModal(id, inv);
};

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




window.showInvoiceModal = async function(editId = null, editData = null) {
  const oldModal = document.getElementById('invoiceModal');
  if (oldModal) oldModal.remove();
  
  const profileId = getActiveProfileId();
  const companyName = await getProfileCompanyName(profileId);
  
  const custSnap = await window.InvoiceApp.clientDb.collection('customers')
    .where('profileId','==',profileId)
    .where('isActive','==',true).get();
    
  const partSnap = await window.InvoiceApp.clientDb.collection('invoiceParticulars')
    .where('profileId','==',profileId)
    .where('isActive','==',true).get();
    
  const today = new Date().toISOString().split('T')[0];
  
  const isNonGstDefault = editData && editData.isNonGst === true;
  const isIgstDefault = editData && editData.isIgst === true;
  const selectedTheme = editData?.pdfTheme || 'teal';
  
  const themeOptions = Object.entries(PDF_THEMES).map(([key, theme]) => 
    `<option value="${key}" ${key === selectedTheme ? 'selected' : ''}>${theme.name}</option>`
  ).join('');
  
  const modal = document.createElement('div');
  modal.id = 'invoiceModal';
  modal.className = 'modal';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:1100px; width:95%; padding:32px; max-height:90vh; overflow-y:auto;">
      <div id="invoiceFormContainer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border);">
          <div>
            <h2 style="margin:0;font-size:1.4rem;font-weight:700;color:var(--ink);">${editId ? 'Edit' : 'Create'} Invoice</h2>
            <div style="font-size:0.9rem;color:var(--muted);margin-top:4px;">
              For: <strong style="color:var(--teal-d);">${companyName}</strong>
            </div>
          </div>
          <button class="btn-close" onclick="closeModal('invoiceModal')" style="font-size:2rem;line-height:1;background:none;border:none;cursor:pointer;color:var(--muted);transition:color .2s;" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'">&times;</button>
        </div>
        
        <form id="invoiceForm" onsubmit="saveInvoice(event)">
          <input type="hidden" id="editDocId" value="${editId || ''}">
          
          <div class="form-grid" style="grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:18px;">
            <div class="fg">
              <label>Bill No. (Preview)</label>
              <input type="text" id="invBillNoPreview" readonly value="Loading..." style="padding:12px;font-size:1rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;"/>
              <div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">This number will be assigned on save</div>
            </div>
            
            <div class="fg"><label>Customer *</label><select id="invCustomer" required style="padding:12px;font-size:1rem;">
              <option value="">Select Customer</option>
              ${custSnap.docs.map(d=>{
                const c=d.data();
                const selected = editData && editData.customerId === d.id ? 'selected' : '';
                return `<option value="${d.id}" data-gstn="${c.gstn||''}" data-pan="${c.pan||''}" data-address="${c.address||''}" ${selected}>${c.customerName}</option>`;
              }).join('')}
            </select></div>
            
            <div class="fg"><label>Invoice Date *</label><input type="date" id="invDate" required value="${editData ? (editData.invoiceDate?.toDate ? editData.invoiceDate.toDate().toISOString().split('T')[0] : new Date(editData.invoiceDate).toISOString().split('T')[0]) : today}" style="padding:12px;font-size:1rem;"/></div>
            
            <div class="fg"><label>PO/Ref Number</label><input type="text" id="invPONumber" value="${editData ? editData.poNumber || '' : ''}" style="padding:12px;font-size:1rem;"/></div>
            
            <div class="fg"><label>PO/Ref Date</label><input type="date" id="invPODate" value="${editData ? (editData.poDate?.toDate ? editData.poDate.toDate().toISOString().split('T')[0] : editData.poDate ? new Date(editData.poDate).toISOString().split('T')[0] : '') : today}" style="padding:12px;font-size:1rem;"/></div>
          </div>
          
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
          
          <div style="margin:16px 0; padding:15px; border:1px solid var(--border); border-radius:8px; background:var(--teal-s);">
            <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);margin-bottom:8px;display:block;">🎨 PDF Color Theme</label>
            <select id="pdfTheme" style="padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;background:#fff;cursor:pointer;width:100%;max-width:300px;">
              ${themeOptions}
            </select>
            <div style="font-size:0.75rem;color:var(--hint);margin-top:4px;">Select a professional color scheme for your invoice PDF</div>
          </div>
          
          <div style="background:var(--bg);padding:20px;border-radius:10px;margin:20px 0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;">Items</h3>
              <button type="button" class="btn btn-outline" onclick="addInvoiceItem()" style="padding:10px 16px;font-size:0.95rem;">+ Add Item</button>
            </div>
            <div id="invoiceItems"></div>
          </div>
          
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:20px;">
<!-- Note Section with Small Dropdown & Textarea -->
<div class="fg" style="margin-bottom:16px;">
  <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);">Note / Remarks (Optional) </label>
  <div style="display:flex; gap:12px; align-items:flex-start;">
    <!-- Small Dropdown (Fixed Width) -->
    <select id="noteTemplateSelect" onchange="fillNoteFromTemplate(this)" 
      style="width:160px; padding:10px; font-size:0.9rem; border:1.5px solid var(--border); border-radius:8px; background:#fff; flex-shrink:0;">
      <option value="">-- Select Note --</option>
    </select>
    <!-- Flexible Textarea (By the Side) -->
    <textarea id="invRemarks" rows="3" 
      style="padding:10px; font-size:0.95rem; width:100%; border:1.5px solid var(--border); border-radius:8px; resize:vertical;" 
      placeholder="Type note here or select from list...">${editData ? editData.remarks || '' : ''}</textarea>
  </div>
</div>
            <div style="background:var(--teal-s);padding:20px;border-radius:10px;display:flex;flex-direction:column;justify-content:space-between;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Subtotal:</span><strong id="calcSubtotal" style="font-size:1.1rem;">₹${editData ? editData.subtotal.toFixed(2) : '0.00'}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span id="taxLabel1">CGST:</span><strong id="calcCgst" style="font-size:1.1rem;">₹${editData ? editData.totalCgst.toFixed(2) : '0.00'}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span id="taxLabel2">SGST:</span><strong id="calcSgst" style="font-size:1.1rem;">₹${editData ? editData.totalSgst.toFixed(2) : '0.00'}</strong></div>
              <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:2px solid var(--teal);margin-top:8px;">
                <span style="font-size:1.2rem;font-weight:700;">Grand Total:</span><strong id="calcGrandTotal" style="font-size:1.3rem;color:var(--teal-d);">₹${editData ? editData.grandTotal.toFixed(2) : '0.00'}</strong>
              </div>
            </div>
          </div>
          
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
  // Load notes into dropdown
loadNotesDropdown();
  getPreviewInvoiceNumber().then(num => {
    const previewInput = document.getElementById('invBillNoPreview');
    if (previewInput) previewInput.value = num;
  });
  
  if (editData && editData.items) {
    editData.items.forEach(item => addInvoiceItem(item));
  } else {
    addInvoiceItem();
  }
  
  document.getElementById('isNonGst')?.addEventListener('change', calcTotal);
  document.getElementById('isIgst')?.addEventListener('change', calcTotal);
  
  if (isNonGstDefault) {
    document.getElementById('taxLabel1').textContent = 'Tax:';
    document.getElementById('taxLabel2').style.display = 'none';
  } else if (isIgstDefault) {
    document.getElementById('taxLabel1').textContent = 'IGST:';
    document.getElementById('taxLabel2').style.display = 'none';
  }
};

// ✅ Add Item Row - EDITABLE PARTICULARS + FIELD LIMITS + WIDER PARTICULARS COLUMN
window.addInvoiceItem = async function(presetItem = null) {
  const c = document.getElementById('invoiceItems');
  if(!c) return;
  const idx = c.children.length;
  const profileId = getActiveProfileId();
  const snap = await window.InvoiceApp.clientDb.collection('invoiceParticulars').where('profileId','==',profileId).where('isActive','==',true).get();
  
  const row = document.createElement('div');
  row.className = 'invoice-item-row';
  // ✅ Increased particulars width: 3.5fr instead of 2.5fr
  row.style.cssText = 'display:grid;grid-template-columns:3.5fr 0.8fr 1fr 0.7fr 1fr auto;gap:12px;margin-bottom:14px;align-items:end;padding-bottom:14px;border-bottom:1px dashed var(--border);';
  
  // ✅ Build datalist options for autocomplete
  const datalistOptions = snap.docs.map(d => {
    const p = d.data();
    return `<option value="${p.itemName}" data-id="${d.id}" data-rate="${p.rate||0}" data-gst="${p.gstRate||0}" data-sac="${p.sacCode||''}">`;
  }).join('');
  
  row.innerHTML = `
    <div>
      <label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Particulars *</label>
      <!-- ✅ Editable input with autocomplete from saved particulars -->
      <input class="item-particular" list="particularsList${idx}" 
        onchange="onItemChange(this,${idx})" 
        oninput="calcItem(${idx})"
        style="padding:10px;font-size:0.95rem;width:100%;border:1.5px solid var(--border);border-radius:6px;"
        placeholder="Type or select item..."
        maxlength="124"
        value="${presetItem ? presetItem.itemName || presetItem.particular : ''}"/>
      <datalist id="particularsList${idx}">${datalistOptions}</datalist>
    </div>
    <!-- ✅ SAC: 10 chars max, auto-capitalize -->
    <div>
      <label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">SAC</label>
      <input class="item-sac" 
        style="padding:10px;background:var(--bg);font-size:0.95rem;width:100%;border:1.5px solid var(--border);border-radius:6px;text-transform:uppercase;"
        maxlength="10"
        oninput="this.value=this.value.toUpperCase()"
        value="${presetItem ? presetItem.sacCode || '' : ''}"/>
    </div>
    <!-- ✅ Rate: 10 digits max (including decimals) -->
    <div>
      <label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Rate (₹)</label>
      <input type="number" class="item-rate" step="0.01" min="0" 
        onchange="calcItem(${idx})" 
        style="padding:10px;font-size:0.95rem;width:100%;border:1.5px solid var(--border);border-radius:6px;"
        maxlength="10"
        oninput="if(this.value.length>10)this.value=this.value.slice(0,10)"
        value="${presetItem ? presetItem.rate || '' : ''}"/>
    </div>
    <!-- ✅ Qty: 3 digits max -->
    <div>
      <label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Qty</label>
      <input type="number" class="item-qty" min="1" 
        onchange="calcItem(${idx})" 
        style="padding:10px;font-size:0.95rem;width:100%;border:1.5px solid var(--border);border-radius:6px;"
        maxlength="3"
        oninput="if(this.value.length>3)this.value=this.value.slice(0,3)"
        value="${presetItem ? presetItem.quantity || 1 : 1}"/>
    </div>
    <!-- ✅ Amount: 11 digits max, readonly (calculated) -->
    <div>
      <label style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;display:block;">Amount</label>
      <input type="text" class="item-amount" readonly 
        style="padding:10px;background:var(--bg);font-size:0.95rem;width:100%;border:1.5px solid var(--border);border-radius:6px;"
        maxlength="11"
        value="${presetItem ? (presetItem.amount || 0).toFixed(2) : '0.00'}"/>
    </div>
    <button type="button" onclick="this.parentElement.remove();calcTotal()" style="padding:10px;background:var(--red);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1.2rem;height:42px;margin-bottom:2px;">×</button>
  `;
  c.appendChild(row);
  
  if (presetItem) {
    calcItem(idx);
  }
};

// ✅ FIXED: Robust selection handler for Particulars dropdown
window.onItemChange = function(input, idx) {
  // 1. Identify the specific row being edited
  const row = input.closest('.invoice-item-row');
  if (!row) return;

  // 2. Identify the datalist source
  const listId = input.getAttribute('list');
  const datalist = document.getElementById(listId);
  if (!datalist) return;

  // 3. Find the matching option (Case-insensitive, trimmed)
  const selectedValue = input.value.trim().toLowerCase();
  const options = datalist.querySelectorAll('option');

  for (let opt of options) {
    if (opt.value.trim().toLowerCase() === selectedValue) {
      // ✅ Auto-fill SAC (Convert to uppercase)
      const sacInput = row.querySelector('.item-sac');
      if (sacInput && opt.dataset.sac) {
        sacInput.value = opt.dataset.sac.toUpperCase();
      }

      // ✅ Auto-fill Rate
      const rateInput = row.querySelector('.item-rate');
      if (rateInput && opt.dataset.rate) {
        rateInput.value = opt.dataset.rate;
      }

      // Found a match, stop searching
      break;
    }
  }

  // 4. Recalculate Amount based on new Rate
  if (typeof window.calcItem === 'function') {
    window.calcItem(idx);
  }
};


window.calcItem = function(idx) {
  const rows = document.querySelectorAll('#invoiceItems > div');
  const row = rows[idx];
  if(!row) return;
  
  const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
  const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  const amt = rate * qty;
  
  const amtInput = row.querySelector('.item-amount');
  if (amtInput) {
    // ✅ Format amount with 2 decimals, limit to 11 chars
    let formatted = amt.toFixed(2);
    if (formatted.length > 11) formatted = formatted.slice(0, 11);
    amtInput.value = formatted;
  }
  
  calcTotal();
};

window.calcTotal = function() {
  let sub=0, rawCgst=0, rawSgst=0, rawIgst=0;
  const isNonGst = document.getElementById('isNonGst')?.checked === true;
  const isIgst = document.getElementById('isIgst')?.checked === true;
  
  document.querySelectorAll('#invoiceItems > div').forEach(row => {
    const amt = parseFloat(row.querySelector('.item-amount')?.value) || 0;
    const particularInput = row.querySelector('.item-particular');
    
    // ✅ Get GST rate from datalist if available, else default to 0
    let gstRate = 0;
    if (particularInput && particularInput.list) {
      const datalist = document.getElementById(particularInput.list);
      if (datalist) {
        const options = datalist.querySelectorAll('option');
        options.forEach(opt => {
          if (opt.value.toLowerCase() === particularInput.value.toLowerCase()) {
            gstRate = parseFloat(opt.dataset.gst) || 0;
          }
        });
      }
    }
    
    sub += amt;
    
    if (isNonGst) {
      // No tax
    } else if (isIgst) {
      rawIgst += amt * gstRate / 100;
    } else {
      rawCgst += amt * (gstRate/2) / 100;
      rawSgst += amt * (gstRate/2) / 100;
    }
  });
  
  const cgst = Math.round(rawCgst);
  const sgst = Math.round(rawSgst);
  const igst = Math.round(rawIgst);
  
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

window.saveInvoice = async function(e) {
  e.preventDefault();
  const cSel = document.getElementById('invCustomer');
  const cOpt = cSel.options[cSel.selectedIndex];
  if (!cSel.value) { alert('Please select a customer'); return; }
  
  const editId = document.getElementById('editDocId').value;
  const includeSignature = document.getElementById('includeSignature')?.checked !== false;
  const isNonGst = document.getElementById('isNonGst')?.checked === true;
  const isIgst = document.getElementById('isIgst')?.checked === true;
  const pdfTheme = document.getElementById('pdfTheme')?.value || 'teal';
  
  const profileId = getActiveProfileId();
  const companyId = window.InvoiceApp.companyId;
  
  let invNum = '';
  const items = [];
  
  document.querySelectorAll('#invoiceItems > div').forEach(row => {
    const particularInput = row.querySelector('.item-particular');
    if (!particularInput?.value) return;
    
    const itemName = particularInput.value.trim();
    const sacCode = row.querySelector('.item-sac')?.value?.trim().toUpperCase() || '';
    const rate = parseFloat(row.querySelector('.item-rate')?.value) || 0;
    const quantity = parseFloat(row.querySelector('.item-qty')?.value) || 1;
    const amount = parseFloat(row.querySelector('.item-amount')?.value) || 0;
    
    // ✅ Get GST rate from datalist if available
    let gstRate = 0;
    if (particularInput.list) {
      const datalist = document.getElementById(particularInput.list);
      if (datalist) {
        const options = datalist.querySelectorAll('option');
        options.forEach(opt => {
          if (opt.value.toLowerCase() === itemName.toLowerCase()) {
            gstRate = parseFloat(opt.dataset.gst) || 0;
          }
        });
      }
    }
    
    if (isNonGst) gstRate = 0;
    
    items.push({
      particular: itemName, // ✅ Save editable particular name
      itemName: itemName,
      sacCode: sacCode,
      rate: rate,
      quantity: quantity,
      amount: amount,
      gstRate: gstRate,
      cgstAmount: isIgst ? 0 : (amount*(gstRate/2)/100),
      sgstAmount: isIgst ? 0 : (amount*(gstRate/2)/100),
      igstAmount: isIgst ? (amount*gstRate/100) : 0
    });
  });
  
  if (items.length === 0) { alert('Please add at least one item'); return; }
  
  const sub = parseFloat(document.getElementById('calcSubtotal').textContent.replace('₹',''));
  const cgst = parseFloat(document.getElementById('calcCgst').textContent.replace('₹',''));
  const sgst = parseFloat(document.getElementById('calcSgst').textContent.replace('₹',''));
  const igst = isIgst ? cgst : 0;
  
  try {
    if (editId) {
      await window.InvoiceApp.clientDb.collection('invoices').doc(editId).set({
        invoiceDate: new Date(document.getElementById('invDate').value),
        customerId: cSel.value, customerName: cOpt.text,
        customerGstn: cOpt.dataset.gstn||'', customerPan: cOpt.dataset.pan||'', customerAddress: cOpt.dataset.address||'',
        poNumber: document.getElementById('invPONumber').value,
        poDate: document.getElementById('invPODate').value ? new Date(document.getElementById('invPODate').value) : null,
        items, subtotal:sub, totalCgst:cgst, totalSgst:sgst, totalIgst:igst, grandTotal:sub+cgst+sgst+igst,
        remarks: document.getElementById('invRemarks').value, // ✅ Still use 'remarks' field for backward compatibility
        signatureIncluded: includeSignature,
        isNonGst: isNonGst,
        isIgst: isIgst,
        pdfTheme: pdfTheme,
        profileId: profileId,
        companyId: companyId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      const doc = await window.InvoiceApp.clientDb.collection('invoices').doc(editId).get();
      invNum = doc.data().invoiceNumber;
    } else {
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
      
      const safeInvNum = invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_');
      const docId = `${companyId}_${profileId}_${safeInvNum}`;
      
      await window.InvoiceApp.clientDb.collection('invoices').doc(docId).set({
        profileId: profileId,
        companyId: companyId,
        invoiceNumber: invNum,
        invoiceDate: new Date(document.getElementById('invDate').value),
        customerId: cSel.value, customerName: cOpt.text,
        customerGstn: cOpt.dataset.gstn||'', customerPan: cOpt.dataset.pan||'', customerAddress: cOpt.dataset.address||'',
        poNumber: document.getElementById('invPONumber').value,
        poDate: document.getElementById('invPODate').value ? new Date(document.getElementById('invPODate').value) : null,
        items, subtotal:sub, totalCgst:cgst, totalSgst:sgst, totalIgst:igst, grandTotal:sub+cgst+sgst+igst,
        remarks: document.getElementById('invRemarks').value,
        status: 'draft',
        signatureIncluded: includeSignature,
        isNonGst: isNonGst,
        isIgst: isIgst,
        pdfTheme: pdfTheme,
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

async function generateInvoicePDFBlob(id, includeSignature = true) {
  const docSnap = await window.InvoiceApp.clientDb.collection('invoices').doc(id).get();
  if(!docSnap.exists) return null;
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  return await renderInvoicePDF(docSnap.data(), id, includeSignature, 'bloburl');
}

window.downloadInvoicePDF = async function(id) {
  const docSnap = await window.InvoiceApp.clientDb.collection('invoices').doc(id).get();
  if(!docSnap.exists) return;
  
  const inv = docSnap.data();
  const includeSig = inv.signatureIncluded !== false; 
  
  await renderInvoicePDF(inv, id, includeSig, 'save');
};

// ==========================================
// CORE PDF RENDERER - WITH "PO/Ref No:" LABEL
// ==========================================
async function renderInvoicePDF(inv, id, includeSignature, outputMode) {
  const profileId = inv.profileId || window.InvoiceApp.companyId;
  const compSnap = await window.InvoiceApp.clientDb.collection('companyProfile').doc(profileId).get();
  const comp = compSnap.exists ? compSnap.data() : {};
  
  const theme = PDF_THEMES[inv.pdfTheme] || PDF_THEMES.teal;
  const [primaryR, primaryG, primaryB] = theme.primary;
  const [secondaryR, secondaryG, secondaryB] = theme.secondary;
  const [accentR, accentG, accentB] = theme.accent;
  const [textR, textG, textB] = theme.text;
  const [borderR, borderG, borderB] = theme.border;
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = 15;
  if (comp.logoUrl) {
    try {
      const logoData = comp.logoUrl.startsWith('') ? comp.logoUrl : `image/jpeg;base64,${comp.logoUrl}`;
      doc.addImage(logoData, 'JPEG', margin, y, 60, 30);
    } catch(e) { console.log('Logo error:', e); }
  }
  doc.setFontSize(22); doc.setFont(undefined, 'bold'); 
  doc.setTextColor(primaryR, primaryG, primaryB);
  doc.text('TAX INVOICE', pageWidth - margin, y + 10, { align: 'right' });
  y += 35;
  
  doc.setTextColor(primaryR, primaryG, primaryB); doc.setFontSize(16); doc.setFont(undefined, 'bold');
  doc.text(comp.companyName || 'Company Name', pageWidth - margin, y, { align: 'right' });
  y += 7;
  doc.setTextColor(textR, textG, textB); doc.setFontSize(8); doc.setFont(undefined, 'normal');
  
  if (comp.address) {
    const lines = comp.address.includes('\n') ? comp.address.split('\n') : doc.splitTextToSize(comp.address, 80);
    lines.forEach(line => { if (line.trim()) { doc.text(line.trim(), pageWidth - margin, y, { align: 'right' }); y += 4; } });
  }
  
  let contactLine = '';
  if (comp.phone) contactLine += 'Phone: ' + comp.phone;
  if (comp.email) contactLine += (contactLine ? ' | ' : '') + 'Email: ' + comp.email;
  if (contactLine) { doc.text(contactLine, pageWidth - margin, y, { align: 'right' }); y += 4; }
  if (comp.gstn) { doc.setTextColor(primaryR, primaryG, primaryB); doc.setFont(undefined, 'bold'); doc.text('GSTIN: ' + comp.gstn, pageWidth - margin, y, { align: 'right' }); y += 4; }
  if (comp.pan) { doc.setTextColor(textR, textG, textB); doc.setFont(undefined, 'normal'); doc.text('PAN: ' + comp.pan, pageWidth - margin, y, { align: 'right' }); y += 7; }
  
  doc.setDrawColor(primaryR, primaryG, primaryB); doc.setLineWidth(0.3); doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  
  doc.setTextColor(textR, textG, textB); doc.setFontSize(9); doc.setFont(undefined, 'bold');
  const invDate = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate().toLocaleDateString('en-IN') : new Date(inv.invoiceDate).toLocaleDateString('en-IN');
  const leftColX = margin;
  const rightColX = pageWidth - margin - 60;
  
  doc.text('Bill No:', leftColX, y); doc.setFont(undefined, 'normal'); doc.text(inv.invoiceNumber || '-', leftColX + 18, y);
  // ✅ Changed "PO No:" to "PO/Ref No:"
  doc.setFont(undefined, 'bold'); doc.text('PO/Ref No:', rightColX, y); doc.setFont(undefined, 'normal'); doc.text(inv.poNumber || '-', rightColX + 18, y);
  y += 6;
  doc.setFont(undefined, 'bold'); doc.text('Date:', leftColX, y); doc.setFont(undefined, 'normal'); doc.text(invDate, leftColX + 15, y);
  doc.setFont(undefined, 'bold'); doc.text('PO/Ref Date:', rightColX, y); doc.setFont(undefined, 'normal');
  const poDate = inv.poDate?.toDate ? inv.poDate.toDate().toLocaleDateString('en-IN') : new Date(inv.poDate).toLocaleDateString('en-IN');
  doc.text(poDate, rightColX + 25, y);
  y += 10;
  
  doc.setFillColor(primaryR, primaryG, primaryB); doc.rect(margin, y, 50, 6, 'F'); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold'); doc.setFontSize(9);
  doc.text('BILL TO', margin + 2, y + 4); y += 9;
  doc.setTextColor(textR, textG, textB); doc.setFont(undefined, 'bold'); doc.setFontSize(10); doc.text(inv.customerName || '-', margin, y);
  doc.setFont(undefined, 'normal'); doc.setFontSize(8); y += 5;
  if (inv.customerAddress) {
    const cLines = inv.customerAddress.includes('\n') ? inv.customerAddress.split('\n') : doc.splitTextToSize(inv.customerAddress, 80);
    cLines.forEach(line => { if (line.trim()) { doc.text(line.trim(), margin, y); y += 4; } });
  }
  if (inv.customerGstn) { doc.setTextColor(primaryR, primaryG, primaryB); doc.setFont(undefined, 'bold'); doc.text('GSTIN: ' + inv.customerGstn, margin, y); doc.setTextColor(textR, textG, textB); y += 4; }
  if (inv.customerPan) { doc.text('PAN: ' + inv.customerPan, margin, y); y += 4; }
  
  y = Math.max(y + 8, 85);
  
  const colSlNo = margin + 8;
  const colParticulars = margin + 20;
  const colSAC = margin + 115;
  const colRate = margin + 140;
  const colQty = margin + 150;
  const colAmount = margin + 170;
  
  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(margin, y, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
 
  doc.text('Sl.No.', colSlNo, y + 3.5, { align: 'center' });
  doc.text('Particulars', colParticulars, y + 3.5, { align: 'left' });
  doc.text('SAC', colSAC, y + 3.5, { align: 'left' });
  doc.text('Rate', colRate, y + 3.5, { align: 'right' });
  doc.text('Qty', colQty, y + 3.5, { align: 'center' });
  doc.text('Amount', colAmount, y + 3.5, { align: 'right' });
  
  y += 8;
  doc.setTextColor(textR, textG, textB);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  
  inv.items.forEach((item, i) => {
    if (y > 250) { 
      doc.addPage(); 
      y = 20; 
      doc.setFillColor(primaryR, primaryG, primaryB);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('Sl.No.', colSlNo, y + 4.5, { align: 'center' });
      doc.text('Particulars', colParticulars, y + 4.5, { align: 'left' });
      doc.text('SAC', colSAC, y + 4.5, { align: 'left' });
      doc.text('Rate', colRate, y + 4.5, { align: 'right' });
      doc.text('Qty', colQty, y + 4.5, { align: 'center' });
      doc.text('Amount', colAmount, y + 4.5, { align: 'right' });
      y += 8;
      doc.setTextColor(textR, textG, textB);
      doc.setFont(undefined, 'normal');
    }
    
    if (i % 2 === 0) {
      doc.setFillColor(accentR, accentG, accentB);
      doc.rect(margin, y - 3, contentWidth, 6, 'F');
    }
    
    doc.setFont(undefined, 'bold');
    doc.text(String(i+1), colSlNo, y, { align: 'center' });
    doc.setFont(undefined, 'normal');
    
    const itemName = item.itemName || item.particular || '-';
    if (itemName.length > 70) { 
      let b = itemName.lastIndexOf(' ', 70); 
      if (b === -1) b = 70; 
      doc.text(itemName.substring(0, b), colParticulars, y, { align: 'left' }); 
      if (itemName.substring(b+1)) { 
        doc.text(itemName.substring(b+1), colParticulars, y + 3.5, { align: 'left' }); 
        y += 3.5; 
      } 
    } else { 
      doc.text(itemName, colParticulars, y, { align: 'left' }); 
    }
    doc.text(item.sacCode || '-', colSAC, y, { align: 'left' });
    doc.text((item.rate || 0).toFixed(2), colRate, y, { align: 'right' });
    doc.text(String(item.quantity || 1), colQty, y, { align: 'center' });
    doc.text((item.amount || 0).toFixed(2), colAmount, y, { align: 'right' });
    y += 6;
  });
  
  y += 4; 
  doc.setFont(undefined, 'bold'); 
  doc.setFontSize(9);
  
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
  
  doc.setFillColor(primaryR, primaryG, primaryB); 
  doc.rect(colSAC - 10, y - 3, colAmount - (colSAC - 5) + 14, 6, 'F');
  doc.setTextColor(255, 255, 255); 
  doc.setFont(undefined, 'bold'); 
  doc.text('TOTAL', colSAC, y + 1, { align: 'left' }); 
  doc.text('Rs. ' + (inv.grandTotal || 0).toFixed(2), colAmount, y + 1, { align: 'right' });
  
  y += 12; 
  doc.setTextColor(textR, textG, textB); 
  doc.setFont(undefined, 'bold'); 
  doc.setFontSize(9);
  doc.text('Amount in words: ' + numberToWords(inv.grandTotal) + ' only', margin, y);
  
  y += 10; 
  doc.setDrawColor(borderR, borderG, borderB); 
  doc.setLineWidth(0.2); 
  doc.line(margin, y, pageWidth - margin, y); 
  y += 6;
  doc.setFont(undefined, 'normal'); 
  doc.setFontSize(8); 
  doc.setTextColor(textR, textG, textB);
  
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
  
  const noteY = y + 16;
  // ✅ Use 'remarks' field but label as "Note:" in PDF
  if (inv.remarks?.trim()) {
    doc.setFont(undefined, 'italic'); 
    doc.setFontSize(8);
    doc.setTextColor(textR, textG, textB);
    
    const notePrefix = 'Note: ';
    const noteText = inv.remarks.trim();
    
    const maxWidth = contentWidth * 0.60;
    const prefixWidth = doc.getTextWidth(notePrefix);
    const indentX = margin + prefixWidth;
    
    const availableWidth = maxWidth - prefixWidth - 5;
    const remarkLines = doc.splitTextToSize(noteText, availableWidth);
    
    const maxLines = 5;
    
    remarkLines.slice(0, maxLines).forEach((line, idx) => {
      if (idx === 0) {
        doc.text(notePrefix + line, margin, noteY + (idx * 4));
      } else {
        doc.text(line, indentX, noteY + (idx * 4));
      }
    });
  }
  
  const sigStartY = y - 8;
  const sigX = pageWidth - margin;
  doc.setFont(undefined, 'normal'); 
  doc.setFontSize(8);
  doc.setTextColor(textR, textG, textB);
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

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
  }
});

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




// ✅ Load Notes into Dropdown
async function loadNotesDropdown() {
  console.log("🔍 Loading notes...");
  const select = document.getElementById("noteTemplateSelect");
  if (!select) {
    console.error("❌ Dropdown not found!");
    return;
  }
  
  const profileId = window.selectedProfileId || sessionStorage.getItem('activeProfileId') || 'COMP001';
  
  try {
    const snap = await window.InvoiceApp.clientDb.collection('invoiceNotes')
      .where('profileId', '==', profileId)
      .get();
    
    console.log("✅ Found notes:", snap.size);
    
    let html = '<option value="">-- Select Note --</option>';
    snap.forEach(doc => {
      const data = doc.data();
      const name = data.noteName || "Untitled";
      const desc = (data.description || "").replace(/"/g, '&quot;');
      html += `<option value="${desc}" data-desc="${desc}">${name}</option>`;
    });
    
    select.innerHTML = html;
  } catch (e) {
    console.error("❌ Error:", e);
  }
}

// ✅ Fill textarea when note selected - FIXED to clear on empty
window.fillNoteFromTemplate = function(select) {
  const textarea = document.getElementById('invRemarks');
  if (!textarea) return;
  
  const selectedOption = select.options[select.selectedIndex];
  
  // ✅ Always update - even if empty
  if (selectedOption && selectedOption.dataset.desc !== undefined) {
    textarea.value = selectedOption.dataset.desc; // This will be "" for empty notes
  } else {
    textarea.value = '';
  }
  
  console.log('📝 Note selected:', selectedOption ? selectedOption.text : 'None');
  console.log(' Description:', textarea.value ? textarea.value.substring(0, 50) + '...' : '(empty)');
}