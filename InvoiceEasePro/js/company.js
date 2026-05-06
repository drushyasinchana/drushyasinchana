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

/* ══════════════════════════════════════════════════════
LOAD COMPANY PROFILE
Fixes: Address width (shortened), 3 lines, City/State/PIN side-by-side
══════════════════════════════════════════════════════ */
window.loadCompanyProfile = async function() {
  console.log('🏢 Loading company profile...');
  const c = document.getElementById('companyContainer');
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading profile...</div>';
  
  try {
    const doc = await window.InvoiceApp.clientDb.collection('companyProfile')
      .doc(window.InvoiceApp.companyId).get();
    const data = doc.exists ? doc.data() : {};
    
    // ✅ FIXED: Ensure 'data:' prefix for image display
    const logoSrc = (data.logoUrl && data.logoUrl.length > 0) 
        ? (data.logoUrl.startsWith('data:') ? data.logoUrl : `data:image/jpeg;base64,${data.logoUrl}`) 
        : '';
    const sigSrc = (data.signatureUrl && data.signatureUrl.length > 0) 
        ? (data.signatureUrl.startsWith('data:') ? data.signatureUrl : `data:image/png;base64,${data.signatureUrl}`) 
        : '';
    
    const currentFY = data.financialYear || getCurrentFinancialYear();
    const startNum = data.invoiceStartNumber || 1;
    
    // Generate FY dropdown options
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    
    const fyCurrent = month >= 4 
      ? `${currentYear}-${(currentYear+1).toString().slice(-2)}`
      : `${currentYear-1}-${currentYear.toString().slice(-2)}`;
    
    const fyPrevious = month >= 4 
      ? `${currentYear-1}-${currentYear.toString().slice(-2)}`
      : `${currentYear-2}-${(currentYear-1).toString().slice(-2)}`;
    
    const fyNext = month >= 4 
      ? `${currentYear+1}-${(currentYear+2).toString().slice(-2)}`
      : `${currentYear}-${(currentYear+1).toString().slice(-2)}`;
    
    c.innerHTML = `
      <div class="card" style="max-height:calc(100vh - 100px); overflow-y:auto; padding:16px;">
        <h3 style="margin-bottom:16px;">⚙️ Company Profile & Settings</h3>
        
        <!-- Logo & Signature Side-by-Side -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; background:var(--bg); padding:16px; border-radius:8px; margin-bottom:16px;">
          
          <!-- Logo Box -->
          <div style="display:flex; align-items:center; gap:16px;">
            <div id="logoPreview" style="width:70px;height:70px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;flex-shrink:0;">
              ${logoSrc ? `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;">` : '<span style="color:var(--muted);font-size:.7rem;">No Logo</span>'}
            </div>
            <div style="flex:1; min-width:0;">
              <input type="file" id="logoUpload" accept="image/*" style="display:none;">
              <button type="button" class="btn btn-outline" style="font-size:0.8rem;padding:6px 12px;" onclick="document.getElementById('logoUpload').click()">📁 Choose Logo</button>
              <button type="button" id="btnSaveLogo" class="btn btn-teal" style="display:none;margin-left:8px;font-size:0.8rem;padding:6px 12px;" onclick="saveLogo()">Save</button>
              ${data.logoUrl ? `<button type="button" class="btn btn-outline" style="margin-left:8px;font-size:0.8rem;padding:6px 12px;color:var(--red);" onclick="removeLogo()">Remove</button>` : ''}
            </div>
          </div>
          
          <!-- Signature Box -->
          <div style="display:flex; align-items:center; gap:16px;">
            <div id="signaturePreview" style="width:120px;height:60px;border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;flex-shrink:0;">
              ${sigSrc ? `<img src="${sigSrc}" style="width:100%;height:100%;object-fit:contain;">` : '<span style="color:var(--muted);font-size:.7rem;">No Signature</span>'}
            </div>
            <div style="flex:1; min-width:0;">
              <input type="file" id="signatureUpload" accept="image/*" style="display:none;">
              <button type="button" class="btn btn-outline" style="font-size:0.8rem;padding:6px 12px;" onclick="document.getElementById('signatureUpload').click()">✍️ Choose Signature</button>
              <button type="button" id="btnSaveSignature" class="btn btn-teal" style="display:none;margin-left:8px;font-size:0.8rem;padding:6px 12px;" onclick="saveSignature()">Save</button>
              ${data.signatureUrl ? `<button type="button" class="btn btn-outline" style="margin-left:8px;font-size:0.8rem;padding:6px 12px;color:var(--red);" onclick="removeSignature()">Remove</button>` : ''}
            </div>
          </div>
        </div>
        
        <form onsubmit="saveCompanyProfile(event)">
          <!-- Row 1: Company Name, GSTN, PAN, Prefix -->
          <div class="form-grid" style="grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:12px;">
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Company Name *</label>
              <input id="cpName" required value="${data.companyName||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">GSTN</label>
              <input id="cpGstn" value="${data.gstn||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">PAN</label>
              <input id="cpPan" value="${data.pan||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Invoice Prefix</label>
              <input id="cpPrefix" value="${data.invoicePrefix||'KAR'}" style="padding:8px;font-size:0.9rem;"/>
            </div>
          </div>
          
          <!-- Row 2: FY Dropdown & Start Number -->
          <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px; background:var(--teal-s);padding:12px;border-radius:8px; margin-bottom:16px;">
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Financial Year</label>
              <select id="cpFinancialYear" style="padding:8px;font-size:0.9rem;width:100%;border:1.5px solid var(--border);border-radius:6px;">
                <option value="${fyPrevious}" ${currentFY === fyPrevious ? 'selected' : ''}>${fyPrevious}</option>
                <option value="${fyCurrent}" ${currentFY === fyCurrent ? 'selected' : ''}>${fyCurrent} (Current)</option>
                <option value="${fyNext}" ${currentFY === fyNext ? 'selected' : ''}>${fyNext}</option>
              </select>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Start Number</label>
              <input type="number" id="cpStartNumber" min="1" value="${startNum}" style="padding:8px;font-size:0.9rem;"/>
            </div>
          </div>
          
          <!-- Row 3: Email & Phone -->
          <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Email</label>
              <input id="cpEmail" type="email" value="${data.email||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Phone</label>
              <input id="cpPhone" value="${data.phone||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
          </div>
          
          <!-- ✅ Row 4: Address (Left, Shortened) + City/State/PIN (Right) -->
          <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:16px; margin-bottom:16px;">
            <!-- Address Block (Shorter Width, 3 Lines) -->
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Address (3 Lines)</label>
              <textarea id="cpAddress" rows="3" style="resize:vertical; padding:8px;font-size:0.9rem;">${data.address||''}</textarea>
            </div>
            
            <!-- City, State, PIN Stacked -->
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div class="fg" style="margin-bottom:0;">
                <label style="font-size:0.8rem;">City</label>
                <input id="cpCity" value="${data.city||''}" style="padding:8px;font-size:0.9rem;"/>
              </div>
              <div class="fg" style="margin-bottom:0;">
                <label style="font-size:0.8rem;">State</label>
                <input id="cpState" value="${data.state||''}" style="padding:8px;font-size:0.9rem;"/>
              </div>
              <div class="fg" style="margin-bottom:0;">
                <label style="font-size:0.8rem;">PIN Code</label>
                <input id="cpPin" value="${data.pincode||''}" style="padding:8px;font-size:0.9rem;"/>
              </div>
            </div>
          </div>
          
          <!-- Row 5: Bank Details -->
          <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px;">
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Bank Name</label>
              <input id="cpBank" value="${data.bankDetails?.bankName||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">Account Number</label>
              <input id="cpAcc" value="${data.bankDetails?.accountNumber||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:0.8rem;">IFSC Code</label>
              <input id="cpIfsc" value="${data.bankDetails?.ifscCode||''}" style="padding:8px;font-size:0.9rem;"/>
            </div>
          </div>
          
          <!-- Save Button -->
          <div style="display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-teal" style="padding:10px 24px;font-size:0.95rem;">💾 Save Profile</button>
          </div>
        </form>
      </div>`;
    
    // Attach event listeners AFTER DOM is rendered
    setTimeout(() => {
      document.getElementById('logoUpload')?.addEventListener('change', (e) => previewLogo(e.target));
      document.getElementById('signatureUpload')?.addEventListener('change', (e) => previewSignature(e.target));
    }, 100);
    
  } catch(e) {
    console.error('Load profile error:', e);
    c.innerHTML = '<div style="color:var(--red);text-align:center;padding:40px;">Error loading profile</div>';
  }
};

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

/* ══════════════════════════════════════════════════════
SAVE COMPANY PROFILE
Fixes: Ensures Start Number is saved to Firestore
══════════════════════════════════════════════════════ */
window.saveCompanyProfile = async function(e) {
  e.preventDefault();
  
  const financialYear = document.getElementById('cpFinancialYear').value.trim();
  const startNumInput = document.getElementById('cpStartNumber').value;
  const startNumber = parseInt(startNumInput) || 1; // ✅ Safely parse integer
  
  // Validate FY format
  if (financialYear && !/^\d{4}-\d{2}$/.test(financialYear)) {
    alert('Financial Year must be in format YYYY-YY (e.g., 2026-27)');
    return;
  }
  
  // ✅ 1. Save to Company Profile Document
  await window.InvoiceApp.clientDb.collection('companyProfile')
    .doc(window.InvoiceApp.companyId).set({
      companyId: window.InvoiceApp.companyId,
      companyName: document.getElementById('cpName').value,
      gstn: document.getElementById('cpGstn').value,
      pan: document.getElementById('cpPan').value,
      invoicePrefix: document.getElementById('cpPrefix').value,
      financialYear: financialYear || getCurrentFinancialYear(),
      invoiceStartNumber: startNumber, // ✅ Explicitly saving Start Number
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
  
  // ✅ 2. Update the Sequence Document (Crucial for next invoice)
  const prefix = document.getElementById('cpPrefix').value || 'KAR';
  const seqRef = window.InvoiceApp.clientDb.collection('sequences').doc(prefix);
  
  await seqRef.set({
    seriesId: prefix,
    prefix: prefix,
    financialYear: financialYear || getCurrentFinancialYear(),
    currentNumber: startNumber, // ✅ Reset sequence to the new start number
    maxLength: 16,
    branchName: "Default",
    supplyType: "domestic",
    isActive: true,
    lastResetDate: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  alert('✅ Company profile and invoice numbering saved!');
};

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