/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - PARTICULARS MANAGEMENT (Professional)
- Doc ID: {companyId}_{profileId}_{uniqueId}
- Auto-capitalize SAC code
- Filter by dropdown profileId (NO index required)
- Professional modal UI with company context display
- Item Name: 124 chars max, 2-line textarea
══════════════════════════════════════════════════════ */

// ✅ Helper: Get active profile ID from dropdown or session
function getActiveProfileId() {
  return window.selectedProfileId || window.currentCompanyId || sessionStorage.getItem('activeProfileId') || 'COMP001';
}

// ✅ Helper: Generate short unique ID (6 digits)
function generateUniqueId() {
  return Date.now().toString().slice(-6);
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
      <h2 style="margin:0;">Particulars & Items <span style="font-size:0.6em;color:var(--muted);font-weight:normal;">(${particulars.length})</span></h2>
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
  
  // ✅ Get company name for header display
  const profileId = getActiveProfileId();
  const companyName = await getProfileCompanyName(profileId);
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:520px; width:95%; padding:28px; border-radius:14px; box-shadow:0 10px 40px rgba(0,0,0,0.15);">
      <!-- Professional Header with Company Context -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border);">
        <div>
          <h2 style="margin:0;font-size:1.3rem;font-weight:700;color:var(--ink);">${id?'Edit':'Add'} Item</h2>
          <div style="font-size:0.85rem;color:var(--muted);margin-top:4px;">
            Adding to: <strong style="color:var(--teal-d);">${companyName}</strong>
          </div>
        </div>
        <button class="btn-close" onclick="closeModal('particularModal')" style="font-size:1.8rem;line-height:1;background:none;border:none;cursor:pointer;color:var(--muted);transition:color .2s;" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'">&times;</button>
      </div>
      
      <form onsubmit="saveParticular(event,'${id||''}')" style="display:flex;flex-direction:column;gap:18px;">
        <!-- Item Name: 124 chars max, 2-line textarea -->
        <div class="fg">
          <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);margin-bottom:6px;display:block;">Item Name <span style="color:var(--red);">*</span></label>
          <textarea id="pName" required maxlength="124" rows="2" 
            style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;resize:vertical;transition:border-color .2s,box-shadow .2s;outline:none;line-height:1.5;"
            onfocus="this.style.borderColor='var(--teal)';this.style.boxShadow='0 0 0 3px rgba(0,131,143,0.1)'"
            onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'"
            oninput="this.value=this.value.slice(0,124)">${data.itemName||''}</textarea>
          <div style="font-size:0.75rem;color:var(--hint);margin-top:4px;text-align:right;"><span id="charCount">${(data.itemName||'').length}</span>/124 characters</div>
        </div>
        
        <!-- SAC Code with auto-capitalize -->
        <div class="fg">
          <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);margin-bottom:6px;display:block;">SAC Code</label>
          <input id="pSac" value="${data.sacCode||''}" maxlength="10"
            style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;text-transform:uppercase;transition:border-color .2s,box-shadow .2s;outline:none;"
            oninput="this.value=this.value.toUpperCase();this.style.borderColor='var(--teal)';this.style.boxShadow='0 0 0 3px rgba(0,131,143,0.1)'"
            onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'"
            placeholder="e.g., 998314"/>
        </div>
        
        <!-- Rate & Unit Row -->
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:16px;">
          <div class="fg">
            <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);margin-bottom:6px;display:block;">Rate (₹) <span style="color:var(--red);">*</span></label>
            <input id="pRate" type="number" step="0.01" min="0" required value="${data.rate||''}"
              style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;transition:border-color .2s,box-shadow .2s;outline:none;"
              onfocus="this.style.borderColor='var(--teal)';this.style.boxShadow='0 0 0 3px rgba(0,131,143,0.1)'"
              onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'"
              placeholder="0.00"/>
          </div>
          <div class="fg">
            <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);margin-bottom:6px;display:block;">Unit</label>
            <input id="pUnit" value="${data.unit||''}" maxlength="20"
              style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;transition:border-color .2s,box-shadow .2s;outline:none;"
              onfocus="this.style.borderColor='var(--teal)';this.style.boxShadow='0 0 0 3px rgba(0,131,143,0.1)'"
              onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'"
              placeholder="e.g., Nos, Hrs"/>
          </div>
        </div>
        
        <!-- GST Rate -->
        <div class="fg">
          <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);margin-bottom:6px;display:block;">GST Rate (%)</label>
          <select id="pGst" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;background:#fff;cursor:pointer;transition:border-color .2s,box-shadow .2s;outline:none;"
            onfocus="this.style.borderColor='var(--teal)';this.style.boxShadow='0 0 0 3px rgba(0,131,143,0.1)'"
            onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
            <option value="0" ${data.gstRate==0?'selected':''}>0% - Exempt/Nil Rated</option>
            <option value="5" ${data.gstRate==5?'selected':''}>5% - Essential Goods</option>
            <option value="12" ${data.gstRate==12?'selected':''}>12% - Standard Rate</option>
            <option value="18" ${data.gstRate==18?'selected':''}>18% - Standard Rate</option>
            <option value="28" ${data.gstRate==28?'selected':''}>28% - Luxury/Sin Goods</option>
          </select>
        </div>
        
        <!-- Action Buttons -->
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;padding-top:16px;border-top:1px solid var(--border);">
          <button type="button" class="btn btn-outline" onclick="closeModal('particularModal')" 
            style="padding:11px 22px;font-size:0.95rem;font-weight:600;border-radius:8px;transition:all .2s;">Cancel</button>
          <button type="submit" class="btn btn-teal" 
            style="padding:11px 22px;font-size:0.95rem;font-weight:600;border-radius:8px;transition:all .2s;box-shadow:0 2px 8px rgba(0,131,143,0.15);">💾 Save Item</button>
        </div>
      </form>
    </div>`;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  
  // ✅ Initialize character counter
  const nameInput = document.getElementById('pName');
  const charCount = document.getElementById('charCount');
  if (nameInput && charCount) {
    charCount.textContent = nameInput.value.length;
    nameInput.addEventListener('input', () => {
      charCount.textContent = nameInput.value.length;
    });
  }
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