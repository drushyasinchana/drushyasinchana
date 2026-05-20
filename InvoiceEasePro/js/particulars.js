/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - PARTICULARS MANAGEMENT (Fixed)
- Doc ID: {companyId}_{profileId}_{uniqueId}
- Auto-capitalize SAC code
- Filter by dropdown profileId (NO index required)
══════════════════════════════════════════════════════ */

// ✅ Helper: Get active profile ID from dropdown or session
function getActiveProfileId() {
  return window.selectedProfileId || window.currentCompanyId || sessionStorage.getItem('activeProfileId') || 'COMP001';
}

// ✅ Helper: Generate short unique ID (6 digits)
function generateUniqueId() {
  return Date.now().toString().slice(-6);
}

window.loadParticulars = async function() {
  console.log('📦 Loading particulars...');
  const c = document.getElementById('particularsContainer');
  if (!c) return;
  
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading particulars...</div>';
  
  try {
    const profileId = getActiveProfileId();
    
    // ✅ Filter by profileId ONLY (no orderBy = no index needed)
    const snap = await window.InvoiceApp.clientDb.collection('invoiceParticulars')
      .where('profileId', '==', profileId)
      .get();
    
    // ✅ Sort in JavaScript instead of Firestore
    const particulars = [];
    snap.forEach(doc => particulars.push({ id: doc.id, ...doc.data() }));
    particulars.sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bDate - aDate;
    });
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="margin:0;">Particulars & Items (${particulars.length})</h2>
      <button class="btn btn-teal" onclick="showParticularModal()">+ Add Item</button>
    </div>
    <div class="table-container"><table><thead><tr>
      <th>Item Name</th><th>SAC Code</th><th>Rate (₹)</th><th>Unit</th><th>GST %</th><th style="text-align:center;">Actions</th>
    </tr></thead><tbody>`;
    
    if (particulars.length === 0) {
      h += '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No items found. Add one to start.</td></tr>';
    } else {
      particulars.forEach(p => {
        h += `<tr>
          <td style="font-weight:600;">${p.itemName||'-'}</td>
          <td class="mono">${p.sacCode||'-'}</td>
          <td>₹${(p.rate||0).toFixed(2)}</td>
          <td>${p.unit||'-'}</td>
          <td>${p.gstRate||0}%</td>
          <td style="text-align:center;">
            <button class="btn-icon" onclick="showParticularModal('${p.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteParticular('${p.id}')" title="Delete" style="color:var(--red);">🗑</button>
          </td>
        </tr>`;
      });
    }
    
    h += '</tbody></table></div>';
    c.innerHTML = h;
    
  } catch (e) {
    console.error('Load particulars error:', e);
    c.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px;">Error: ${e.message}<br><button class="btn btn-teal" style="margin-top:12px;" onclick="window.loadParticulars()">Retry</button></div>`;
  }
};

window.showParticularModal = async function(id) {
  const modal = document.createElement('div');
  modal.id = 'particularModal';
  modal.className = 'modal';
  
  let data = {};
  if (id) {
    const doc = await window.InvoiceApp.clientDb.collection('invoiceParticulars').doc(id).get();
    if (doc.exists) data = doc.data() || {};
  }
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2 style="margin:0;">${id?'Edit':'Add'} Item</h2>
        <button class="btn-close" onclick="closeModal('particularModal')">&times;</button>
      </div>
      <form onsubmit="saveParticular(event,'${id||''}')">
        <div class="fg"><label>Item Name *</label><input id="pName" required value="${data.itemName||''}" style="text-transform:none;"/></div>
        <div class="fg"><label>SAC Code</label><input id="pSac" value="${data.sacCode||''}" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"/></div>
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
          <button type="submit" class="btn btn-teal">💾 Save Item</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.style.display = 'flex';
};

window.saveParticular = async function(e, id) {
  e.preventDefault();
  
  const profileId = getActiveProfileId();
  const companyId = window.InvoiceApp.companyId;
  
  const itemName = document.getElementById('pName').value.trim();
  const sacCode = document.getElementById('pSac').value.trim().toUpperCase();
  const rate = parseFloat(document.getElementById('pRate').value) || 0;
  const unit = document.getElementById('pUnit').value.trim();
  const gstRate = parseInt(document.getElementById('pGst').value) || 0;
  
  if (!itemName) { alert('Item Name is required'); return; }
  
  // ✅ Simple doc ID: {companyId}_{profileId}_{uniqueId}
  const uniqueId = generateUniqueId();
  const docId = `${companyId}_${profileId}_${uniqueId}`;
  
  const data = {
    companyId: companyId,
    profileId: profileId,
    particularId: uniqueId,
    itemName: itemName,
    sacCode: sacCode,
    rate: rate,
    unit: unit,
    gstRate: gstRate,
    isActive: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  if (!id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  
  try {
    if (id) {
      await window.InvoiceApp.clientDb.collection('invoiceParticulars').doc(id).set(data, { merge: true });
    } else {
      await window.InvoiceApp.clientDb.collection('invoiceParticulars').doc(docId).set(data);
    }
    closeModal('particularModal');
    window.loadParticulars();
    alert('✅ Item saved!');
  } catch (err) {
    console.error('Save error:', err);
    alert('❌ Error: ' + err.message);
  }
};

window.deleteParticular = async function(id) {
  if (!confirm('Delete this item?')) return;
  try {
    await window.InvoiceApp.clientDb.collection('invoiceParticulars').doc(id).delete();
    window.loadParticulars();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
};

// ESC key handler
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.remove());
});