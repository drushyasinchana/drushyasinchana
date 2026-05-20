/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - CUSTOMER MANAGEMENT (Fixed)
- Doc ID: {companyId}_{profileId}_{uniqueId}
- Auto-capitalize GSTN/PAN
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

window.loadCustomers = async function() {
  console.log('👥 Loading customers...');
  const c = document.getElementById('customersContainer');
  if (!c) return;
  
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading customers...</div>';
  
  try {
    const profileId = getActiveProfileId();
    
    // ✅ Filter by profileId ONLY (no orderBy = no index needed)
    const snap = await window.InvoiceApp.clientDb.collection('customers')
      .where('profileId', '==', profileId)
      .get();
    
    // ✅ Sort in JavaScript instead of Firestore
    const customers = [];
    snap.forEach(doc => customers.push({ id: doc.id, ...doc.data() }));
    customers.sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bDate - aDate;
    });
    
    // ✅ Filter active customers in JS
    const activeCustomers = customers.filter(c => c.isActive !== false);
    const totalCount = activeCustomers.length;
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="margin:0;">Customers <span style="font-size:0.6em;color:var(--muted);font-weight:normal;">(${totalCount} Total)</span></h2>
      <button class="btn btn-teal" onclick="showCustomerModal()">+ Add Customer</button>
    </div>
    <div class="table-container"><table><thead><tr>
      <th>Name</th><th>GSTN</th><th>City</th><th style="text-align:center;">Status</th><th style="text-align:center;">Actions</th>
    </tr></thead><tbody>`;
    
    if (activeCustomers.length === 0) {
      h += '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted);">No customers found. Add one to start.</td></tr>';
    } else {
      activeCustomers.forEach(cust => {
        h += `<tr>
          <td style="font-weight:600;">${cust.customerName||'-'}</td>
          <td class="mono">${cust.gstn||'-'}</td>
          <td>${cust.city||'-'}</td>
          <td style="text-align:center;"><span class="badge badge-green">Active</span></td>
          <td style="text-align:center;">
            <button class="btn-icon" onclick="showCustomerModal('${cust.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteCustomer('${cust.id}')" title="Delete" style="color:var(--red);">🗑</button>
          </td>
        </tr>`;
      });
    }
    
    h += '</tbody></table></div>';
    c.innerHTML = h;
    
  } catch (e) {
    console.error('Load customers error:', e);
    c.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px;">Error: ${e.message}<br><button class="btn btn-teal" style="margin-top:12px;" onclick="window.loadCustomers()">Retry</button></div>`;
  }
};

window.showCustomerModal = async function(id) {
  const modal = document.createElement('div');
  modal.id = 'customerModal';
  modal.className = 'modal';
  
  let data = {};
  if (id) {
    const doc = await window.InvoiceApp.clientDb.collection('customers').doc(id).get();
    if (doc.exists) data = doc.data() || {};
  }
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:600px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2 style="margin:0;">${id?'Edit':'Add'} Customer</h2>
        <button class="btn-close" onclick="closeModal('customerModal')">&times;</button>
      </div>
      <form onsubmit="saveCustomer(event,'${id||''}')">
        <div class="form-grid">
          <div class="fg"><label>Customer Name *</label><input id="custName" required value="${data.customerName||''}"/></div>
          <div class="fg"><label>GSTN</label><input id="custGstn" value="${data.gstn||''}" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"/></div>
          <div class="fg"><label>PAN</label><input id="custPan" value="${data.pan||''}" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"/></div>
          <div class="fg"><label>City</label><input id="custCity" value="${data.city||''}"/></div>
        </div>
        <div class="fg"><label>Address</label><textarea id="custAddress" rows="2">${data.address||''}</textarea></div>
        <div class="form-grid">
          <div class="fg"><label>Contact Person</label><input id="custContact" value="${data.contactPerson||''}"/></div>
          <div class="fg"><label>Phone</label><input id="custPhone" value="${data.phone||''}" maxlength="10"/></div>
          <div class="fg"><label>Email</label><input id="custEmail" type="email" value="${data.email||''}"/></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('customerModal')">Cancel</button>
          <button type="submit" class="btn btn-teal">💾 Save Customer</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.style.display = 'flex';
};

window.saveCustomer = async function(e, id) {
  e.preventDefault();
  
  const profileId = getActiveProfileId();
  const companyId = window.InvoiceApp.companyId;
  
  const customerName = document.getElementById('custName').value.trim();
  const gstn = document.getElementById('custGstn').value.trim().toUpperCase();
  const pan = document.getElementById('custPan').value.trim().toUpperCase();
  const city = document.getElementById('custCity').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const contactPerson = document.getElementById('custContact').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const email = document.getElementById('custEmail').value.trim().toLowerCase();
  
  if (!customerName) { alert('Customer Name is required'); return; }
  
  // ✅ Simple doc ID: {companyId}_{profileId}_{uniqueId}
  const uniqueId = generateUniqueId();
  const docId = `${companyId}_${profileId}_${uniqueId}`;
  
  const data = {
    companyId: companyId,
    profileId: profileId,
    customerId: uniqueId,
    customerName: customerName,
    gstn: gstn,
    pan: pan,
    city: city,
    address: address,
    contactPerson: contactPerson,
    phone: phone,
    email: email,
    isActive: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  if (!id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  
  try {
    if (id) {
      await window.InvoiceApp.clientDb.collection('customers').doc(id).set(data, { merge: true });
    } else {
      await window.InvoiceApp.clientDb.collection('customers').doc(docId).set(data);
    }
    closeModal('customerModal');
    window.loadCustomers();
    alert('✅ Customer saved!');
  } catch (err) {
    console.error('Save error:', err);
    alert('❌ Error: ' + err.message);
  }
};

window.deleteCustomer = async function(id) {
  if (!confirm('Delete this customer?')) return;
  try {
    await window.InvoiceApp.clientDb.collection('customers').doc(id).delete();
    window.loadCustomers();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
};

// ESC key handler
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.remove());
});