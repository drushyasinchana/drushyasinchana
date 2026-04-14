// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const msg = document.getElementById('loginMsg');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const companyId = document.getElementById('loginCompanyId').value.trim();

    btn.disabled = true; btn.innerHTML = 'Signing in...';
    msg.innerHTML = '';

    try {
      await auth.signInWithEmailAndPassword(email, password);
      sessionStorage.setItem('attendEaseUser', JSON.stringify({ email, companyId }));
      window.location.href = 'manage.html';
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-danger py-2 small mt-2">${err.message}</div>`;
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });
});