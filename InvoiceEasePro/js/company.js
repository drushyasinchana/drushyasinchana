/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - COMPANY PROFILE
Fixes: Layout adjustments, Start Number saving
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
HELPER: Compress image
══════════════════════════════════════════════════════ */
function compressImage(file, maxSize = 300, quality = 0.8, outputFormat = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        if (outputFormat === 'image/jpeg') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(img, 0, 0, width, height);
        const tryCompress = (q) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            if (blob.size > 100 * 1024 && q > 0.3) { tryCompress(q - 0.1); }
            else { resolve(blob); }
          }, outputFormat, q);
        };
        tryCompress(quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

window.loadCompanyProfile = async function() {
  console.log('🏢 Loading company profile...');
  const c = document.getElementById('companyContainer');
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading profile...</div>';
  
  try {
    // ✅ Check user's plan from Master DB
    const userDoc = await window.db.collection('users').doc(window.InvoiceApp.adminEmail).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userPlan = userData.plan || 'basic'; // basic, standard, premium
    
    // ✅ Load all company profiles (company1, company2, company3)
    const companies = {};
    const companyDocs = await window.InvoiceApp.clientDb.collection('companyProfile').get();
    
    companyDocs.forEach(doc => {
      const id = doc.id;
      if (id === window.InvoiceApp.companyId || id.startsWith('company')) {
        companies[id] = doc.data();
      }
    });
    
    // Determine which tabs to show based on plan
    const maxCompanies = userPlan === 'premium' ? 3 : (userPlan === 'standard' ? 2 : 1);
    const availableSlots = [];
    for (let i = 1; i <= maxCompanies; i++) {
      const companyId = i === 1 ? window.InvoiceApp.companyId : `company${i}`;
      availableSlots.push({
        id: companyId,
        name: companies[companyId]?.companyName || `Company ${i}`,
        exists: !!companies[companyId]
      });
    }
    
    // Get active company (default to first available)
    const activeCompanyId = companies[window.InvoiceApp.companyId] ? window.InvoiceApp.companyId : availableSlots[0]?.id;
    const activeData = companies[activeCompanyId] || {};
    
    // ✅ FIXED: Ensure 'data:' prefix for image display
    const logoSrc = (activeData.logoUrl && activeData.logoUrl.length > 0) 
        ? (activeData.logoUrl.startsWith('data:') ? activeData.logoUrl : `data:image/jpeg;base64,${activeData.logoUrl}`) 
        : '';
    const sigSrc = (activeData.signatureUrl && activeData.signatureUrl.length > 0) 
        ? (activeData.signatureUrl.startsWith('data:') ? activeData.signatureUrl : `data:image/png;base64,${activeData.signatureUrl}`) 
        : '';
    
    const currentFY = activeData.financialYear || getCurrentFinancialYear();
    const startNum = activeData.invoiceStartNumber || 1;
    const accountName = activeData.accountName || activeData.companyName || '';
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    
    const fyCurrent = month >= 4 ? `${currentYear}-${(currentYear+1).toString().slice(-2)}` : `${currentYear-1}-${currentYear.toString().slice(-2)}`;
    const fyPrevious = month >= 4 ? `${currentYear-1}-${currentYear.toString().slice(-2)}` : `${currentYear-2}-${(currentYear-1).toString().slice(-2)}`;
    const fyNext = month >= 4 ? `${currentYear+1}-${(currentYear+2).toString().slice(-2)}` : `${currentYear}-${(currentYear+1).toString().slice(-2)}`;
    
    // Build tabs HTML
    let tabsHTML = '<div style="margin-bottom:20px;">';
    tabsHTML += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">';
    
    availableSlots.forEach((slot, idx) => {
      const isActive = slot.id === activeCompanyId;
      const isLocked = !slot.exists && idx >= maxCompanies;
      const tabClass = isActive ? 'active' : '';
      const lockIcon = isLocked ? '🔒' : (slot.exists ? '✓' : '+');
      
      tabsHTML += `
        <button type="button" onclick="switchCompanyTab('${slot.id}')" 
          style="padding:10px 20px;border:2px solid ${isActive ? 'var(--teal)' : 'var(--border)'};
          background:${isActive ? 'var(--teal)' : '#fff'};color:${isActive ? '#fff' : 'var(--ink)'};
          border-radius:8px;cursor:${isLocked ? 'not-allowed' : 'pointer'};
          font-weight:600;font-size:0.9rem;opacity:${isLocked ? 0.5 : 1};"
          ${isLocked ? 'disabled' : ''}>
          ${lockIcon} ${slot.name}
        </button>
      `;
    });
    
    tabsHTML += '</div></div>';
    
    c.innerHTML = `
      <div class="card" style="max-height:calc(100vh - 100px); overflow-y:auto; padding:16px;">
        ${tabsHTML}
        
        <!-- Logo & Signature -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; background:var(--bg); padding:16px; border-radius:8px; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <div id="logoPreview" style="width:70px;height:70px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;flex-shrink:0;">
              ${logoSrc ? `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;">` : '<span style="color:var(--muted);font-size:.7rem;">No Logo</span>'}
            </div>
            <div style="flex:1; min-width:0;">
              <input type="file" id="logoUpload" accept="image/*" style="display:none;">
              <button type="button" class="btn btn-outline" style="font-size:0.8rem;padding:6px 12px;" onclick="document.getElementById('logoUpload').click()">📁 Choose Logo</button>
              <button type="button" id="btnSaveLogo" class="btn btn-teal" style="display:none;margin-left:8px;font-size:0.8rem;padding:6px 12px;" onclick="saveLogo('${activeCompanyId}')">Save</button>
              ${activeData.logoUrl ? `<button type="button" class="btn btn-outline" style="margin-left:8px;font-size:0.8rem;padding:6px 12px;color:var(--red);" onclick="removeLogo('${activeCompanyId}')">Remove</button>` : ''}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:16px;">
            <div id="signaturePreview" style="width:120px;height:60px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;flex-shrink:0;">
              ${sigSrc ? `<img src="${sigSrc}" style="width:100%;height:100%;object-fit:contain;">` : '<span style="color:var(--muted);font-size:.7rem;">No Signature</span>'}
            </div>
            <div style="flex:1; min-width:0;">
              <input type="file" id="signatureUpload" accept="image/*" style="display:none;">
              <button type="button" class="btn btn-outline" style="font-size:0.8rem;padding:6px 12px;" onclick="document.getElementById('signatureUpload').click()">✍️ Choose Signature</button>
              <button type="button" id="btnSaveSignature" class="btn btn-teal" style="display:none;margin-left:8px;font-size:0.8rem;padding:6px 12px;" onclick="saveSignature('${activeCompanyId}')">Save</button>
              ${activeData.signatureUrl ? `<button type="button" class="btn btn-outline" style="margin-left:8px;font-size:0.8rem;padding:6px 12px;color:var(--red);" onclick="removeSignature('${activeCompanyId}')">Remove</button>` : ''}
            </div>
          </div>
        </div>
        
        <form onsubmit="saveCompanyProfile(event, '${activeCompanyId}')">
          <!-- Row 1: Company Name, GSTN, PAN, Prefix -->
          <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Company Name *</label><input id="cpName" required value="${activeData.companyName||''}" style="padding:8px;font-size:0.9rem;"/></div>
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">GSTN</label><input id="cpGstn" value="${activeData.gstn||''}" style="padding:8px;font-size:0.9rem;"/></div>
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">PAN</label><input id="cpPan" value="${activeData.pan||''}" style="padding:8px;font-size:0.9rem;"/></div>
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Invoice Prefix</label><input id="cpPrefix" value="${activeData.invoicePrefix||'KAR'}" style="padding:8px;font-size:0.9rem;"/></div>
          </div>
          
          <!-- Row 2: Financial Settings -->
          <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px; background:var(--teal-s);padding:12px;border-radius:8px; margin-bottom:12px;">
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Financial Year</label><select id="cpFinancialYear" style="padding:8px;font-size:0.9rem;width:100%;border:1.5px solid var(--border);border-radius:6px;"><option value="${fyPrevious}" ${currentFY===fyPrevious?'selected':''}>${fyPrevious}</option><option value="${fyCurrent}" ${currentFY===fyCurrent?'selected':''}>${fyCurrent} (Current)</option><option value="${fyNext}" ${currentFY===fyNext?'selected':''}>${fyNext}</option></select></div>
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Start Number</label><input type="number" id="cpStartNumber" min="1" value="${startNum}" style="padding:8px;font-size:0.9rem;"/></div>
          </div>
          
          <!-- Row 3: Email & Phone (Fixed width) -->
          <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Email</label><input id="cpEmail" type="email" value="${activeData.email||''}" style="padding:8px;font-size:0.9rem;"/></div>
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Phone</label><input id="cpPhone" value="${activeData.phone||''}" style="padding:8px;font-size:0.9rem;"/></div>
          </div>
          
          <!-- Row 4: Address & City/State/PIN -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:12px;">
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Address (3 Lines)</label>
              <textarea id="cpAddress" rows="3" style="resize:vertical; padding:8px;font-size:0.9rem;width:100%;">${activeData.address||''}</textarea>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">City</label><input id="cpCity" value="${activeData.city||''}" style="padding:8px;font-size:0.9rem;"/></div>
              <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">State</label><input id="cpState" value="${activeData.state||''}" style="padding:8px;font-size:0.9rem;"/></div>
              <div class="fg" style="margin-bottom:0; grid-column: span 2;"><label style="font-size:0.8rem;">PIN Code</label><input id="cpPin" value="${activeData.pincode||''}" style="padding:8px;font-size:0.9rem;"/></div>
            </div>
          </div>
          
          <!-- Row 5: Account Name -->
          <div class="fg" style="margin-bottom:12px;">
            <label style="font-size:0.8rem;">Account Name</label>
            <input id="cpAccountName" value="${accountName}" style="padding:8px;font-size:0.9rem;width:100%;"/>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:2px;">Auto-filled with Company Name. Change if different.</div>
          </div>
          
          <!-- Row 6: Bank Details -->
          <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px;">
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Bank Name</label><input id="cpBank" value="${activeData.bankDetails?.bankName||''}" style="padding:8px;font-size:0.9rem;"/></div>
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">Account Number</label><input id="cpAcc" value="${activeData.bankDetails?.accountNumber||''}" style="padding:8px;font-size:0.9rem;"/></div>
            <div class="fg" style="margin-bottom:0;"><label style="font-size:0.8rem;">IFSC Code</label><input id="cpIfsc" value="${activeData.bankDetails?.ifscCode||''}" style="padding:8px;font-size:0.9rem;"/></div>
          </div>
          
          <div style="display:flex;justify-content:flex-end;"><button type="submit" class="btn btn-teal" style="padding:10px 24px;font-size:0.95rem;">💾 Save Profile</button></div>
        </form>
      </div>`;
    
    setTimeout(() => {
      document.getElementById('logoUpload')?.addEventListener('change', (e) => previewLogo(e.target, activeCompanyId));
      document.getElementById('signatureUpload')?.addEventListener('change', (e) => previewSignature(e.target, activeCompanyId));
    }, 100);
    
  } catch(e) {
    console.error('Load profile error:', e);
    c.innerHTML = '<div style="color:var(--red);text-align:center;padding:40px;">Error loading profile</div>';
  }
};

// ✅ Switch between company tabs
window.switchCompanyTab = async function(companyId) {
  sessionStorage.setItem('activeCompanyId', companyId);
  await loadCompanyProfile();
};

// ✅ Show Add Company Modal (Premium only)
window.showAddCompanyModal = async function() {
  const companyName = prompt('Enter new company name:');
  if (!companyName) return;
  
  try {
    const companyDocs = await window.InvoiceApp.clientDb.collection('companyProfile').get();
    let nextNum = 1;
    companyDocs.forEach(doc => {
      if (doc.id.startsWith('company')) {
        const num = parseInt(doc.id.replace('company', ''));
        if (num >= nextNum) nextNum = num + 1;
      }
    });
    
    const newCompanyId = `company${nextNum}`;
    
    await window.InvoiceApp.clientDb.collection('companyProfile').doc(newCompanyId).set({
      companyId: newCompanyId,
      companyName: companyName,
      gstn: '',
      pan: '',
      invoicePrefix: companyName.slice(0, 3).toUpperCase(),
      financialYear: getCurrentFinancialYear(),
      invoiceStartNumber: 1,
      accountName: companyName,
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      bankDetails: { bankName: '', accountNumber: '', ifscCode: '' },
      logoUrl: '',
      signatureUrl: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert(`✅ ${companyName} created successfully!`);
    await loadCompanyProfile();
  } catch (e) {
    console.error('Add company error:', e);
    alert('❌ Error creating company: ' + e.message);
  }
};

// ✅ Updated saveCompanyProfile
window.saveCompanyProfile = async function(e, companyId) {
  e.preventDefault();
  const financialYear = document.getElementById('cpFinancialYear').value.trim();
  const startNumber = parseInt(document.getElementById('cpStartNumber').value) || 1;
  
  if (financialYear && !/^\d{4}-\d{2}$/.test(financialYear)) { alert('Financial Year must be YYYY-YY'); return; }
  
  await window.InvoiceApp.clientDb.collection('companyProfile').doc(companyId).set({
    companyId: companyId,
    companyName: document.getElementById('cpName').value,
    gstn: document.getElementById('cpGstn').value,
    pan: document.getElementById('cpPan').value,
    invoicePrefix: document.getElementById('cpPrefix').value,
    financialYear: financialYear || getCurrentFinancialYear(),
    invoiceStartNumber: startNumber,
    accountName: document.getElementById('cpAccountName').value,
    email: document.getElementById('cpEmail').value,
    phone: document.getElementById('cpPhone').value,
    address: document.getElementById('cpAddress').value,
    city: document.getElementById('cpCity').value,
    state: document.getElementById('cpState').value,
    pincode: document.getElementById('cpPin').value,
    bankDetails: { 
      bankName: document.getElementById('cpBank').value, 
      accountNumber: document.getElementById('cpAcc').value, 
      ifscCode: document.getElementById('cpIfsc').value 
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  
  const prefix = document.getElementById('cpPrefix').value || 'KAR';
  await window.InvoiceApp.clientDb.collection('sequences').doc(prefix).set({
    seriesId: prefix, prefix: prefix, financialYear: financialYear || getCurrentFinancialYear(),
    currentNumber: startNumber, maxLength: 16, branchName: "Default", supplyType: "domestic",
    isActive: true, lastResetDate: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  alert('✅ Company profile saved!');
};

// Logo and Signature functions
window.previewLogo = async function(input, companyId) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const preview = document.getElementById('logoPreview');
    preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;">`;
    document.getElementById('btnSaveLogo').style.display = 'inline-flex';
    window.tempLogoFile = file;
    window.tempLogoCompanyId = companyId;
  };
  reader.readAsDataURL(file);
};

window.saveLogo = async function(companyId) {
  if (!window.tempLogoFile) return;
  
  try {
    const compressedBlob = await compressImage(window.tempLogoFile, 300, 0.8, 'image/jpeg');
    const base64String = await blobToBase64(compressedBlob);
    const cleanBase64 = base64String.replace(/^image\/jpeg;base64,/, '');
    
    await window.InvoiceApp.clientDb.collection('companyProfile').doc(companyId)
      .set({ logoUrl: cleanBase64, logoType: 'image/jpeg', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    
    alert('✅ Logo saved!');
    document.getElementById('btnSaveLogo').style.display = 'none';
    await loadCompanyProfile();
  } catch (e) {
    console.error('Logo save error:', e);
    alert('❌ Error saving logo: ' + e.message);
  }
};

window.removeLogo = async function(companyId) {
  if (!confirm('Remove logo?')) return;
  await window.InvoiceApp.clientDb.collection('companyProfile').doc(companyId)
    .set({ logoUrl: '', logoType: '' }, { merge: true });
  await loadCompanyProfile();
};

window.previewSignature = async function(input, companyId) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const preview = document.getElementById('signaturePreview');
    preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;">`;
    document.getElementById('btnSaveSignature').style.display = 'inline-flex';
    window.tempSignatureFile = file;
    window.tempSignatureCompanyId = companyId;
  };
  reader.readAsDataURL(file);
};

window.saveSignature = async function(companyId) {
  if (!window.tempSignatureFile) return;
  
  try {
    const compressedBlob = await compressImage(window.tempSignatureFile, 400, 0.85, 'image/png');
    const base64String = await blobToBase64(compressedBlob);
    const cleanBase64 = base64String.replace(/^data:image\/png;base64,/, '');
    
    await window.InvoiceApp.clientDb.collection('companyProfile').doc(companyId)
      .set({ signatureUrl: cleanBase64, signatureType: 'image/png', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    
    alert('✅ Signature saved!');
    document.getElementById('btnSaveSignature').style.display = 'none';
    await loadCompanyProfile();
  } catch (e) {
    console.error('Signature save error:', e);
    alert('❌ Error saving signature: ' + e.message);
  }
};

window.removeSignature = async function(companyId) {
  if (!confirm('Remove signature?')) return;
  await window.InvoiceApp.clientDb.collection('companyProfile').doc(companyId)
    .set({ signatureUrl: '', signatureType: '' }, { merge: true });
  await loadCompanyProfile();
};

// Helper functions
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

function compressImage(file, maxSize = 300, quality = 0.8, outputFormat = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        if (outputFormat === 'image/jpeg') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(img, 0, 0, width, height);
        const tryCompress = (q) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            if (blob.size > 100 * 1024 && q > 0.3) { tryCompress(q - 0.1); }
            else { resolve(blob); }
          }, outputFormat, q);
        };
        tryCompress(quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ══════════════════════════════════════════════════════
LOGO UPLOAD FUNCTIONS
══════════════════════════════════════════════════════ */
let logoFile = null;

window.previewLogo = function(input) {
  const file = input instanceof File ? input : input.files?.[0];
  const preview = document.getElementById('logoPreview');
  const err = document.getElementById('logoErr');
  const btnSave = document.getElementById('btnSaveLogo');
  
  if (!file) { 
    if(preview) preview.innerHTML = '<span style="color:var(--muted);font-size:.7rem;">No Logo</span>'; 
    if(btnSave) btnSave.style.display = 'none'; 
    return; 
  }
  
  if (!file.type.startsWith('image/')) {
    if(err) { err.textContent = '❌ Please select an image file'; err.style.display = 'block'; }
    if(preview) preview.innerHTML = '<span style="color:var(--muted);font-size:.7rem;">No Logo</span>'; 
    if(btnSave) btnSave.style.display = 'none'; 
    return;
  }
  
  logoFile = file;
  if(err) err.style.display = 'none';
  
  const reader = new FileReader();
  reader.onload = (ev) => { 
    if(preview) preview.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:contain;">`;
    if(btnSave) btnSave.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
};

window.saveLogo = async function() {
  if (!logoFile) return;
  const btn = document.getElementById('btnSaveLogo');
  const err = document.getElementById('logoErr');
  
  btn.disabled = true; btn.textContent = 'Compressing...';
  
  try {
    const compressedBlob = await compressImage(logoFile, 300, 0.8, 'image/jpeg');
    const base64String = await blobToBase64(compressedBlob);
    const cleanBase64 = base64String.replace(/^data:image\/jpeg;base64,/, '');
    
    await window.InvoiceApp.clientDb.collection('companyProfile')
      .doc(window.InvoiceApp.companyId)
      .set({ logoUrl: cleanBase64, logoType: 'image/jpeg', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    
    alert('✅ Logo saved!');
    btn.textContent = '💾 Save Logo'; btn.style.display = 'none';
    logoFile = null;
    window.loadCompanyProfile();
  } catch (error) {
    console.error('Logo upload failed:', error);
    if(err) { err.textContent = error.message; err.style.display = 'block'; }
    btn.disabled = false; btn.textContent = '💾 Save Logo';
  }
};

window.removeLogo = async function() {
  if (!confirm('Remove logo?')) return;
  await window.InvoiceApp.clientDb.collection('companyProfile').doc(window.InvoiceApp.companyId).set({ logoUrl: '', logoType: '' }, { merge: true });
  window.loadCompanyProfile();
};

/* ══════════════════════════════════════════════════════
SIGNATURE UPLOAD FUNCTIONS
══════════════════════════════════════════════════════ */
let signatureFile = null;

window.previewSignature = function(input) {
  const file = input instanceof File ? input : input.files?.[0];
  const preview = document.getElementById('signaturePreview');
  const err = document.getElementById('signatureErr');
  const btnSave = document.getElementById('btnSaveSignature');
  
  if (!file) { 
    if(preview) preview.innerHTML = '<span style="color:var(--muted);font-size:.7rem;">No Signature</span>'; 
    if(btnSave) btnSave.style.display = 'none'; 
    return; 
  }
  
  if (!file.type.startsWith('image/')) {
    if(err) { err.textContent = '❌ Please select an image file'; err.style.display = 'block'; }
    if(preview) preview.innerHTML = '<span style="color:var(--muted);font-size:.7rem;">No Signature</span>'; 
    if(btnSave) btnSave.style.display = 'none'; 
    return;
  }
  
  signatureFile = file;
  if(err) err.style.display = 'none';
  
  const reader = new FileReader();
  reader.onload = (ev) => { 
    if(preview) preview.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:contain;">`;
    if(btnSave) btnSave.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
};

window.saveSignature = async function() {
  if (!signatureFile) return;
  const btn = document.getElementById('btnSaveSignature');
  const err = document.getElementById('signatureErr');
  
  btn.disabled = true; btn.textContent = 'Compressing...';
  
  try {
    const compressedBlob = await compressImage(signatureFile, 400, 0.85, 'image/png');
    const base64String = await blobToBase64(compressedBlob);
    const cleanBase64 = base64String.replace(/^data:image\/png;base64,/, '');
    
    await window.InvoiceApp.clientDb.collection('companyProfile')
      .doc(window.InvoiceApp.companyId)
      .set({ signatureUrl: cleanBase64, signatureType: 'image/png', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    
    alert('✅ Signature saved!');
    btn.textContent = '💾 Save Signature'; btn.style.display = 'none';
    signatureFile = null;
    window.loadCompanyProfile();
  } catch (error) {
    console.error('Signature upload failed:', error);
    if(err) { err.textContent = error.message; err.style.display = 'block'; }
    btn.disabled = false; btn.textContent = '💾 Save Signature';
  }
};

window.removeSignature = async function() {
  if (!confirm('Remove signature?')) return;
  await window.InvoiceApp.clientDb.collection('companyProfile').doc(window.InvoiceApp.companyId).set({ signatureUrl: '', signatureType: '' }, { merge: true });
  window.loadCompanyProfile();
};