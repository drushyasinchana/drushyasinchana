// js/superadmin.js
document.addEventListener('DOMContentLoaded', async () => {
  const user = sessionStorage.getItem('attendEaseUser');
  if (user) {
    const parsed = JSON.parse(user);
    if (parsed.role === 'SUPER_ADMIN' || parsed.email === 'superadmin@attendease.com') {
      document.getElementById('saLoginSection').style.display = 'none';
      document.getElementById('saDashboardSection').style.display = 'block';
      initDashboard();
    }
  }

  document.getElementById('saLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saLoginBtn');
    const msg = document.getElementById('saLoginMsg');
    btn.disabled = true; btn.textContent = 'Signing in...';
    msg.innerHTML = '';
    try {
      await auth.signInWithEmailAndPassword(document.getElementById('saEmail').value, document.getElementById('saPassword').value);
      const adminSnap = await db.collection('admins').where('email','==',document.getElementById('saEmail').value).get();
      let isSuper = false;
      adminSnap.forEach(d => { if(d.data().role==='SUPER_ADMIN' || d.data().role==='SUPERADMIN') isSuper=true; });
      if(!isSuper) throw new Error('Super Admin role required.');
      sessionStorage.setItem('attendEaseUser', JSON.stringify({ email: document.getElementById('saEmail').value, companyId: 'MASTER', role: 'SUPER_ADMIN' }));
      document.getElementById('saLoginSection').style.display = 'none';
      document.getElementById('saDashboardSection').style.display = 'block';
      initDashboard();
    } catch(err) {
      msg.innerHTML = `<span class="text-danger">${err.message}</span>`;
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });

  document.getElementById('saveCompanyBtn')?.addEventListener('click', saveCompany);
  document.getElementById('saveAdminBtn')?.addEventListener('click', saveAdmin);
});

async function initDashboard() {
  loadTable('companies','companyTableBody', renderCompany);
  loadTable('admins','adminTableBody', renderAdmin);
  await populateCompanyDropdown();
}

const renderCompany = (id, c) => `<tr>
  <td>${c.companyId||''}</td><td>${c.companyName||''}</td><td>${c.adminEmail||''}</td>
  <td>${c.plan||''}</td><td><span class="badge ${c.Status?.toUpperCase()==='ACTIVE'?'bg-success':'bg-danger'}">${c.Status||''}</span></td>
  <td>${c.city||''}</td>
</tr>`;

const renderAdmin = (id, a) => `<tr>
  <td>${a.empCode||''}</td><td>${a.fullName||''}</td><td>${a.email||''}</td>
  <td>${a.companyId||''}</td><td>${a.role||''}</td>
  <td><button class="btn btn-sm btn-outline-danger" onclick="deleteDoc('admins','${id}')">Del</button></td>
</tr>`;

async function populateCompanyDropdown() {
  try {
    const snap = await db.collection('companies').get();
    const options = snap.docs.map(d => `<option value="${d.data().companyId}">${d.data().companyName} (${d.data().companyId})</option>`).join('');
    const el = document.getElementById('adminCompId');
    if(el) el.innerHTML = '<option>— Select Company —</option>' + options;
  } catch(e) {}
}

async function saveCompany() {
  const data = {
    companyId: document.getElementById('compId').value,
    companyName: document.getElementById('compName').value,
    adminEmail: document.getElementById('compEmail').value,
    contactPhone: document.getElementById('compPhone').value,
    plan: document.getElementById('compPlan').value,
    maxEmp: parseInt(document.getElementById('compMaxEmp').value) || 0,
    startDate: document.getElementById('compStart').value ? new Date(document.getElementById('compStart').value) : null,
    endDate: document.getElementById('compEnd').value ? new Date(document.getElementById('compEnd').value) : null,
    city: document.getElementById('compCity').value,
    Status: document.getElementById('compStatus').value
  };
  await saveDoc('companies', data);
  loadTable('companies','companyTableBody', renderCompany);
  populateCompanyDropdown();
  bootstrap.Modal.getInstance(document.getElementById('companyModal')).hide();
}

async function saveAdmin() {
  const data = {
    fullName: document.getElementById('adminName').value,
    empCode: document.getElementById('adminCode').value,
    email: document.getElementById('adminEmail').value,
    companyId: document.getElementById('adminCompId').value,
    role: document.getElementById('adminRole').value
  };
  await saveDoc('admins', data);
  loadTable('admins','adminTableBody', renderAdmin);
  bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
}