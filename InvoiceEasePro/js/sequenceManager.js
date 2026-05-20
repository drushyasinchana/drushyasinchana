/* ══════════════════════════════════════════════════════
INVOICEEASE PRO - SEQUENCE MANAGER (Profile-Aware)
GST-Compliant Invoice Numbering System
Modified: Sequences are now profile-aware (COMP001-COMP005)
══════════════════════════════════════════════════════ */

// ✅ Helper: Get active profile ID from dropdown or session
function getActiveProfileId() {
  return window.selectedProfileId || window.currentCompanyId || sessionStorage.getItem('activeProfileId') || 'COMP001';
}

window.SequenceManager = {
  // Generate next invoice number with GST rules - PROFILE AWARE
  async getNextInvoiceNumber(seriesId = null) {
    const db = window.InvoiceApp.clientDb;
    const profileId = getActiveProfileId(); // ✅ Use profile context
    const companyId = window.InvoiceApp.companyId;
    
    // Default to company prefix if no series specified
    if (!seriesId) {
      const profile = await db.collection('companyProfile').doc(profileId).get(); // ✅ Fetch by profileId
      seriesId = profile.data()?.invoicePrefix || companyId.slice(0,3).toUpperCase();
    }
    
    const currentFY = this.getCurrentFinancialYear();
    // ✅ Sequence doc ID includes profileId for isolation: {companyId}_{profileId}_{prefix}
    const seqDocId = `${companyId}_${profileId}_${seriesId}`;
    const seqRef = db.collection('sequences').doc(seqDocId);
    
    return db.runTransaction(async (transaction) => {
      const seqDoc = await transaction.get(seqRef);
      
      let seqData;
      if (!seqDoc.exists) {
        // Create new series if doesn't exist
        seqData = {
          seriesId: seriesId,
          profileId: profileId,  // ✅ Store profile context
          companyId: companyId,  // ✅ Store login company for audit
          prefix: seriesId,
          financialYear: currentFY,
          currentNumber: 1,
          maxLength: 16,
          branchName: "Default",
          supplyType: "domestic",
          isActive: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        transaction.set(seqRef, seqData);
      } else {
        seqData = seqDoc.data();
      }
      
      // ✅ Check if financial year changed - reset counter
      if (seqData.financialYear !== currentFY) {
        seqData.currentNumber = 1;
        seqData.financialYear = currentFY;
        seqData.lastResetDate = firebase.firestore.FieldValue.serverTimestamp();
      }
      
      const nextNum = seqData.currentNumber;
      const formattedNum = String(nextNum).padStart(3, '0'); // 001, 002, etc.
      
      // ✅ Build invoice number: PREFIX/FY/NUMBER (e.g., KAR/2026-27/001)
      let invoiceNumber = `${seqData.prefix}/${seqData.financialYear}/${formattedNum}`;
      
      // ✅ Enforce 16-character max (GST rule)
      if (invoiceNumber.length > 16) {
        // Fallback: shorten format to PREFIX-NUM (e.g., KAR-001)
        invoiceNumber = `${seqData.prefix}-${formattedNum}`;
        if (invoiceNumber.length > 16) {
          // Last resort: just prefix + number
          invoiceNumber = `${seqData.prefix}${nextNum}`;
        }
      }
      
      // Update sequence
      transaction.update(seqRef, {
        currentNumber: nextNum + 1,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        invoiceNumber,
        seriesId,
        profileId,
        financialYear: currentFY,
        number: nextNum
      };
    });
  },
  
  // Get current financial year (April-March) - UNCHANGED
  getCurrentFinancialYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    // FY starts April 1
    if (month >= 4) {
      return `${year}-${(year+1).toString().slice(-2)}`;
    } else {
      return `${year-1}-${year.toString().slice(-2)}`;
    }
  },
  
  // Validate invoice number meets GST rules - UNCHANGED
  validateInvoiceNumber(invoiceNumber) {
    const errors = [];
    
    // Rule 1: Max 16 characters
    if (invoiceNumber.length > 16) {
      errors.push('Invoice number exceeds 16 characters');
    }
    
    // Rule 2: Only allowed characters (A-Z, 0-9, -, /)
    if (!/^[A-Za-z0-9\-\/]+$/.test(invoiceNumber)) {
      errors.push('Invoice number contains invalid characters');
    }
    
    // Rule 3: Must contain prefix and number
    if (!/[A-Za-z]+/.test(invoiceNumber) || !/\d+/.test(invoiceNumber)) {
      errors.push('Invoice number must contain both letters and numbers');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  // Cancel invoice (instead of delete) for audit trail - UNCHANGED
  async cancelInvoice(invoiceId, reason = '') {
    const db = window.InvoiceApp.clientDb;
    
    await db.collection('invoices').doc(invoiceId).update({
      status: 'cancelled',
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
      cancellationReason: reason,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Note: We do NOT decrement the sequence - maintains consecutive numbering
    return true;
  },
  
  // Get available series for dropdown - PROFILE AWARE
  async getAvailableSeries() {
    const db = window.InvoiceApp.clientDb;
    const profileId = getActiveProfileId(); // ✅ Filter by profile
    const companyId = window.InvoiceApp.companyId;
    
    const snap = await db.collection('sequences')
      .where('profileId', '==', profileId) // ✅ Filter by profileId
      .where('isActive', '==', true)
      .get();
    
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  },
  
  // Create new series (for new branch/type) - PROFILE AWARE
  async createSeries(seriesId, config) {
    const db = window.InvoiceApp.clientDb;
    const profileId = getActiveProfileId(); // ✅ Use current profile context
    const companyId = window.InvoiceApp.companyId;
    const currentFY = this.getCurrentFinancialYear();
    
    const validation = this.validateInvoiceNumber(`${config.prefix || seriesId}/2026-27/001`);
    if (!validation.isValid) {
      throw new Error(`Invalid series config: ${validation.errors.join(', ')}`);
    }
    
    // ✅ Sequence doc ID includes profileId: {companyId}_{profileId}_{seriesId}
    const seqDocId = `${companyId}_${profileId}_${seriesId}`;
    
    await db.collection('sequences').doc(seqDocId).set({
      seriesId: seriesId,
      profileId: profileId,  // ✅ Store profile context
      companyId: companyId,  // ✅ Store login company for audit
      prefix: config.prefix || seriesId,
      financialYear: currentFY,
      currentNumber: config.startNumber || 1,
      maxLength: 16,
      branchName: config.branchName || '',
      supplyType: config.supplyType || 'domestic',
      isActive: config.isActive !== false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return true;
  }
};