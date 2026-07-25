/* ═════════════════════════════════════════════════════
INVOICEEASE PRO - NOTES MANAGEMENT
Fixes: Trim whitespace, No indentation, Left aligned
══════════════════════════════════════════════════════ */

// ✅ Helper: Get active profile ID
function getActiveProfileId() {
  return window.selectedProfileId || window.currentCompanyId || sessionStorage.getItem('activeProfileId') || 'COMP001';
}

// ✅ Load Notes - Properly trims whitespace and displays clean text
window.loadNotes = async function() {
  console.log('📝 Loading notes...');
  const c = document.getElementById('notesContainer');
  if (!c) return;
  
  c.innerHTML = '<div style="text-align:center;padding:40px;">Loading notes...</div>';
  
  try {
    const profileId = getActiveProfileId();
    
    const snap = await window.InvoiceApp.clientDb.collection('invoiceNotes')
      .where('profileId', '==', profileId)
      .get();
    
    const notes = [];
    snap.forEach(doc => notes.push({ id: doc.id, ...doc.data() }));
    notes.sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bDate - aDate;
    });
    
    let h = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="margin:0;">Notes <span style="font-size:0.6em;color:var(--muted);font-weight:normal;">(${notes.length})</span></h2>
        <button class="btn btn-teal" onclick="showNoteModal()">+ Add Note</button>
      </div>
      
      <div class="table-container" style="max-height: calc(100vh - 250px); overflow-y: auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead style="position:sticky; top:0; z-index:10; background:var(--bg);">
            <tr>
              <th style="padding:14px; text-align:left; font-weight:600; color:var(--teal-d); border-bottom:2px solid var(--border);">Note Name</th>
              <th style="padding:14px; text-align:left; font-weight:600; color:var(--teal-d); border-bottom:2px solid var(--border);">Description</th>
              <th style="padding:14px; text-align:center; width:100px; border-bottom:2px solid var(--border);">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    if (notes.length === 0) {
      h += '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--muted);">No notes saved yet.</td></tr>';
    } else {
      notes.forEach(n => {
        // ✅ FIXED: Trim all whitespace and normalize line breaks
        const desc = (n.description || '')
          .trim()  // Remove leading/trailing whitespace
          .replace(/^\s+|\s+$/g, '')  // Remove all leading/trailing spaces/tabs
          .replace(/\n\s+/g, '\n');  // Remove indentation after line breaks
        
        h += `
          <tr>
            <td style="padding:14px; border-bottom:1px solid var(--border); font-weight:600; vertical-align:top;">
              ${n.noteName || '-'}
            </td>
            <!-- ✅ FIXED: white-space: normal to prevent preserving tabs/spaces -->
            <td style="padding:14px; border-bottom:1px solid var(--border); color:var(--ink2); vertical-align:top; white-space: normal; word-break: break-word; text-align: left;">
              ${desc || '<span style="color:var(--hint);">No description</span>'}
            </td>
            <td style="padding:14px; border-bottom:1px solid var(--border); text-align:center;">
              <button class="btn-icon" onclick="showNoteModal('${n.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteNote('${n.id}')" title="Delete" style="color:var(--red);">🗑️</button>
            </td>
          </tr>
        `;
      });
    }
    
    h += '</tbody></table></div>';
    c.innerHTML = h;
    
  } catch (e) {
    console.error('Load notes error:', e);
    c.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px;">Error: ${e.message}</div>`;
  }
};

// ✅ Show Modal (Add/Edit) - Auto-trim on save
window.showNoteModal = async function(id) {
  const modal = document.createElement('div');
  modal.id = 'noteModal';
  modal.className = 'modal';
  
  let data = {};
  if (id) {
    const doc = await window.InvoiceApp.clientDb.collection('invoiceNotes').doc(id).get();
    if (doc.exists) data = doc.data() || {};
  }
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width:550px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;">${id ? 'Edit' : 'Add'} Note</h2>
        <button class="btn-close" onclick="closeModal('noteModal')">&times;</button>
      </div>
      <form onsubmit="saveNote(event, '${id || ''}')">
        <div class="fg" style="margin-bottom:16px;">
          <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);">Note Name *</label>
          <input id="noteName" required value="${data.noteName || ''}" maxlength="100" style="padding:12px;width:100%;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;"/>
        </div>
        <div class="fg" style="margin-bottom:20px;">
          <label style="font-size:0.9rem;font-weight:600;color:var(--ink2);">Description</label>
          <textarea id="noteDesc" rows="6" style="padding:12px;width:100%;border:1.5px solid var(--border);border-radius:8px;font-size:0.95rem;resize:vertical;">${data.description || ''}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('noteModal')">Cancel</button>
          <button type="submit" class="btn btn-teal">💾 Save Note</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
};

// ✅ Save Note - Auto-trim whitespace before saving
window.saveNote = async function(e, id) {
  e.preventDefault();
  
  const profileId = getActiveProfileId();
  const companyId = window.InvoiceApp.companyId;
  
  const noteName = document.getElementById('noteName').value.trim();
  // ✅ FIXED: Trim description and normalize whitespace
  const description = document.getElementById('noteDesc').value
    .trim()
    .replace(/^\s+|\s+$/g, '')  // Remove leading/trailing spaces
    .replace(/\n\s+/g, '\n');   // Remove indentation after newlines
  
  if (!noteName) { alert('Note Name is required'); return; }
  
  const docId = id || `${companyId}_${profileId}_${Date.now().toString().slice(-6)}`;
  
  const data = {
    companyId,
    profileId,
    noteName,
    description,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (!id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  
  try {
    await window.InvoiceApp.clientDb.collection('invoiceNotes').doc(docId).set(data, { merge: true });
    closeModal('noteModal');
    window.loadNotes();
    alert('✅ Note saved!');
  } catch (err) {
    console.error('Save error:', err);
    alert('❌ Error: ' + err.message);
  }
};

// ✅ Delete Note
window.deleteNote = async function(id) {
  if (!confirm('Delete this note?')) return;
  try {
    await window.InvoiceApp.clientDb.collection('invoiceNotes').doc(id).delete();
    window.loadNotes();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.remove());
});