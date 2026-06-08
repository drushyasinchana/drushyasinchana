// js/utils.js - Shared helper functions

function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  try {
    if (typeof inTime === 'string' && typeof outTime === 'string') {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      const diff = (outH * 60 + outM) - (inH * 60 + inM);
      if (diff <= 0) return '—';
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h ${m}m`;
    }
    const inDate = inTime.toDate ? inTime.toDate() : new Date(inTime);
    const outDate = outTime.toDate ? outDate.toDate() : new Date(outTime);
    const diffMs = outDate - inDate;
    if (diffMs <= 0) return '—';
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  } catch(e) { return '—'; }
}

function parseAttendanceDate(dateVal) {
  if (!dateVal) return null;
  try {
    if (dateVal?.toDate) return dateVal.toDate();
    if (typeof dateVal === 'string' && dateVal.includes('-')) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 2 && parts[1].length === 2) {
          return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        if (parts[0].length === 4) return new Date(dateVal);
      }
    }
    if (dateVal instanceof Date && !isNaN(dateVal)) return dateVal;
    return null;
  } catch (e) { console.error('❌ Date parse error:', e); return null; }
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}