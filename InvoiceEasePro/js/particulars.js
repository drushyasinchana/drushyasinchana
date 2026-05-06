/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - PARTICULARS MANAGEMENT
══════════════════════════════════════════════════════ */

window.loadParticulars = async function() {
  console.log('📦 Loading particulars...');
  const c = document.getElementById('particularsContainer');
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading particulars...</div>';
  
  try {
    const snap = await window.InvoiceApp.clientDb.collection('invoiceParticulars')
      .where('companyId','==',window.InvoiceApp.companyId).get();
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="margin:0;">Particulars & Items (${snap.size})</h2>
      <button class="btn btn-teal" onclick="showParticularModal()">+ Add Item</button>
    </div>
    <div class="table-container"><table><thead><tr>
      <th>Item Name</th><th>SAC Code</th><th>Rate (₹)</th><th>Unit</th><th>GST %</th><th style="text-align:center;">Actions</th>
    </tr></thead><tbody>`;
    
    snap.forEach(doc => {
      const d = doc.data();
      h += `<tr>
        <td style="font-weight:600;">${d.itemName}</td>
        <td class="mono">${d.sacCode||'-'}</td>
        <td>${(d.rate||0).toFixed(2)}</td>
        <td>${d.unit||'-'}</td>
        <td>${d.gstRate||0}%</td>
        <td style="text-align:center;">
          <button class="btn-icon" onclick="showParticularModal('${doc.id}')" title="Edit">✏️</button>
          <button class="btn-icon" onclick="deleteParticular('${doc.id}')" title="Delete" style="color:var(--red);">🗑</button>
        </td>
      </tr>`;
    });
    
    h += '</tbody></table></div>';
    c.innerHTML = h;
  } catch (e) {
    console.error('Load particulars error:', e);
    c.innerHTML = '<div style="color:var(--red);text-align:center;padding:40px;">Error loading particulars</div>';
  }
};

// ... (Keep showParticularModal, saveParticular, deleteParticular same as before) ...

window.showParticularModal = async function(id) {
  const modal = document.createElement('div');
  modal.id = 'particularModal';
  modal.className = 'modal';
  
  let data = {};
  if(id) {
    const doc = await window.InvoiceApp.clientDb.collection('invoiceParticulars').doc(id).get();
    data = doc.data();
  }
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2 style="margin:0;">${id?'Edit':'Add'} Item</h2>
        <button class="btn-close" onclick="closeModal('particularModal')">×</button>
      </div>
      <form onsubmit="saveParticular(event,'${id||''}')">
        <div class="fg"><label>Item Name *</label><input id="pName" required value="${data.itemName||''}"/></div>
        <div class="fg"><label>SAC Code</label><input id="pSac" value="${data.sacCode||''}"/></div>
        <div class="form-grid">
          <div class="fg"><label>Rate (₹) *</label><input id="pRate" type="number" step="0.01" required value="${data.rate||''}"/></div>
          <div class="fg"><label>Unit</label><input id="pUnit" value="${data.unit||''}"/></div>
        </div>
        <div class="fg"><label>GST Rate (%)</label><select id="pGst">
          <option value="0" ${data.gstRate==0?'selected':''}>0%</option>
          <option value="5" ${data.gstRate==5?'selected':''}>5%</option>
          <option value="12" ${data.gstRate==12?'selected':''}>12%</option>
          <option value="18" ${data.gstRate==18?'selected':''}>18%</option>
          <option value="28" ${data.gstRate==28?'selected':''}>28%</option>
        </select></div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('particularModal')">Cancel</button>
          <button type="submit" class="btn btn-teal">Save Item</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.style.display = 'flex';
};

window.saveParticular = async function(e, id) {
  e.preventDefault();
  const data = {
    companyId: window.InvoiceApp.companyId,
    itemName: document.getElementById('pName').value,
    sacCode: document.getElementById('pSac').value,
    rate: parseFloat(document.getElementById('pRate').value)||0,
    unit: document.getElementById('pUnit').value,
    gstRate: parseInt(document.getElementById('pGst').value)||0,
    isActive: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  if(id) await window.InvoiceApp.clientDb.collection('invoiceParticulars').doc(id).set(data, {merge:true});
  else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await window.InvoiceApp.clientDb.collection('invoiceParticulars').add(data);
  }
  
  closeModal('particularModal');
  window.loadParticulars();
  alert('✅ Item saved!');
};

window.deleteParticular = async function(id) {
  if(!confirm('Delete this item?')) return;
  await window.InvoiceApp.clientDb.collection('invoiceParticulars').doc(id).delete();
  window.loadParticulars();
};


// Add ESC key handler
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Close any open modal
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
  }
});