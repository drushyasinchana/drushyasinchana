// ══════════════════════════════════════════════════════
// SUPPORT
// ══════════════════════════════════════════════════════
async function loadSupport() {
  console.log('🔍 loadSupport() called');
  
  try {
    // Safety check
    if (!S.clientDb) {
      console.warn('⚠️ S.clientDb not ready');
      return;
    }
    
    const companyId = S.prefs?.companyId;
    if (!companyId) {
      console.warn('⚠️ No companyId in S.prefs');
      return;
    }
    
    // ✅ FIX: Fetch from MASTER Firestore, not client
    const masterDb = firebase.firestore();
    const companySnap = await masterDb.collection('companies')
      .doc(companyId)
      .get();
    
    if (!companySnap.exists) {
      console.warn('⚠️ Company doc not found in Master Firestore');
      return;
    }
    
    const companyData = companySnap.data();
    
    // Helper: Safe text update with fallback
    const setText = (id, value, fallback = '—') => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value || fallback;
      } else {
        console.warn(`⚠️ Element #${id} not found`);
      }
    };
    
    // Update UI elements using IDs
    setText('supportPlan', companyData.plan);
    setText('supportValidUntil', companyData.endDate ? fmtDate(companyData.endDate) : null);
    setText('supportCompany', companyData.companyName);
    setText('supportAdmin', companyData.adminEmail);
    
    console.log('✅ Support data loaded:', {
      plan: companyData.plan,
      endDate: companyData.endDate,
      companyName: companyData.companyName,
      adminEmail: companyData.adminEmail
    });
    
  } catch (e) {
    console.error('❌ Error loading support data:', e);
    // Don't toast - support page is non-critical
  }
}