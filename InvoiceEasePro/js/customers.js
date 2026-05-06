/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - CUSTOMER MANAGEMENT
Feature: Shows total count of customers
══════════════════════════════════════════════════════ */

window.loadCustomers = async function() {
  console.log('👥 Loading customers...');
  const c = document.getElementById('customersContainer');
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading customers...</div>';
  
  try {
    // Fetch all customers for this company
    const snap = await window.InvoiceApp.clientDb.collection('customers')
      .where('companyId', '==', window.InvoiceApp.companyId)
      .get();
    
    // ✅ snap.size gives the total count
    const totalCount = snap.size;
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="margin:0;">Customers <span style="font-size:0.6em;color:var(--muted);font-weight:normal;">(${totalCount} Total)</span></h2>
      <button class="btn btn-teal" onclick="showCustomerModal()">+ Add Customer</button>
    </div>
    <div class="table-container"><table><thead><tr>
      <th>Name</th><th>GSTN</th><th>City</th>
      <th style="text-align:center;">Status</th>
      <th style="text-align:center;">Actions</th>
    </tr></thead><tbody>`;
    
    if (snap.empty) {
      h += '<tr><td colspan="5" style="text-align:center;padding:20px;">No customers found. Add one to start.</td></tr>';
    } else {
      snap.forEach(doc => {
        const d = doc.data();
        const sc = d.isActive !== false ? 'badge-green' : 'badge-gray'; // Default to active
        const statusText = d.isActive !== false ? 'Active' : 'Inactive';
        
        h += `<tr>
          <td style="font-weight:600;">${d.customerName || '-'}</td>
          <td class="mono">${d.gstn || '-'}</td>
          <td>${d.city || '-'}</td>
          <td style="text-align:center;"><span class="badge ${sc}">${statusText}</span></td>
          <td style="text-align:center;">
            <button class="btn-icon" onclick="showCustomerModal('${doc.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteCustomer('${doc.id}')" title="Delete" style="color:var(--red);">🗑</button>
          </td>
        </tr>`;
      });
    }
    
    h += '</tbody></table></div>';
    c.innerHTML = h;
    
  } catch (e) {
    console.error('Load customers error:', e);
    c.innerHTML = '<div style="color:var(--red);text-align:center;padding:40px;">Error loading customers</div>';
  }
};

// ... (Keep showCustomerModal, saveCustomer, deleteCustomer functions exactly as they were before) ...
window.showCustomerModal = async function(id) {
  const modal = document.createElement('div');
  modal.id = 'customerModal';
  modal.className = 'modal';
  
  let data = {};
  if(id) {
    const doc = await window.InvoiceApp.clientDb.collection('customers').doc(id).get();
    data = doc.data();
  }
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:600px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2 style="margin:0;">${id?'Edit':'Add'} Customer</h2>
        <button class="btn-close" onclick="closeModal('customerModal')">×</button>
      </div>
      <form onsubmit="saveCustomer(event,'${id||''}')">
        <div class="form-grid">
          <div class="fg"><label>Customer Name *</label><input id="custName" required value="${data.customerName||''}"/></div>
          <div class="fg"><label>GSTN</label><input id="custGstn" value="${data.gstn||''}"/></div>
          <div class="fg"><label>PAN</label><input id="custPan" value="${data.pan||''}"/></div>
          <div class="fg"><label>City</label><input id="custCity" value="${data.city||''}"/></div>
        </div>
        <div class="fg"><label>Address</label><textarea id="custAddress" rows="2">${data.address||''}</textarea></div>
        <div class="form-grid">
          <div class="fg"><label>Contact Person</label><input id="custContact" value="${data.contactPerson||''}"/></div>
          <div class="fg"><label>Phone</label><input id="custPhone" value="${data.phone||''}"/></div>
          <div class="fg"><label>Email</label><input id="custEmail" value="${data.email||''}"/></div>
          <div class="fg"><label>Status</label><select id="custStatus">
            <option value="true" ${data.isActive!==false?'selected':''}>Active</option>
            <option value="false" ${data.isActive===false?'selected':''}>Inactive</option>
          </select></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('customerModal')">Cancel</button>
          <button type="submit" class="btn btn-teal">Save Customer</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.style.display = 'flex';
};

window.saveCustomer = async function(e, id) {
  e.preventDefault();
  const data = {
    companyId: window.InvoiceApp.companyId,
    customerName: document.getElementById('custName').value,
    gstn: document.getElementById('custGstn').value,
    pan: document.getElementById('custPan').value,
    city: document.getElementById('custCity').value,
    address: document.getElementById('custAddress').value,
    contactPerson: document.getElementById('custContact').value,
    phone: document.getElementById('custPhone').value,
    email: document.getElementById('custEmail').value,
    isActive: document.getElementById('custStatus').value === 'true',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  if(id) await window.InvoiceApp.clientDb.collection('customers').doc(id).set(data, {merge:true});
  else {
    data.customerId = 'CUST'+Date.now().toString().slice(-6);
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await window.InvoiceApp.clientDb.collection('customers').doc(data.customerId).set(data);
  }
  
  closeModal('customerModal');
  window.loadCustomers();
  alert('✅ Customer saved!');
};

window.deleteCustomer = async function(id) {
  if(!confirm('Delete this customer?')) return;
  await window.InvoiceApp.clientDb.collection('customers').doc(id).delete();
  window.loadCustomers();
};

// Add ESC key handler
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Close any open modal
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
  }
});