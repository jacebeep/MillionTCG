/**
 * MillionTCG Auth System
 * localStorage-based email/password accounts
 */

(function () {
  'use strict';

  /* ── Direct Admin Email Notification Helper ── */
  /* ── Direct Admin & Customer Email Notification Helper ── */
  window.sendDirectEmailNotification = function (eventTitle, detailsData) {
    try {
      const adminEmail = localStorage.getItem('milliontcg_admin_email') || 'Jacep0230@gmail.com';
      const userContactEmail = detailsData.UserEmail || detailsData.CustomerEmail || detailsData.Email || detailsData.ContactEmail;
      
      const payload = {
        _subject: `⚡ MillionTCG Alert: ${eventTitle}`,
        _template: 'table',
        _captcha: 'false',
        _replyto: userContactEmail || adminEmail,
        EventType: eventTitle,
        Timestamp: new Date().toLocaleString(),
        ...detailsData
      };

      // 1. Send alert to Admin (Jacep0230@gmail.com)
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      }).then(res => res.json())
        .then(data => console.log('Direct admin email notification sent:', data))
        .catch(err => console.log('Admin notification background push error:', err));

      // 2. Send confirmation copy to Customer Email if provided
      if (userContactEmail && userContactEmail.toLowerCase() !== adminEmail.toLowerCase() && userContactEmail.includes('@')) {
        fetch(`https://formsubmit.co/ajax/${encodeURIComponent(userContactEmail.trim())}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            _subject: `MillionTCG Confirmation: ${eventTitle}`,
            _template: 'table',
            _captcha: 'false',
            Notice: `Thank you for contacting MillionTCG! Details of your ${eventTitle} are listed below:`,
            Timestamp: new Date().toLocaleString(),
            ...detailsData
          })
        }).then(res => res.json())
          .then(data => console.log('Customer confirmation email sent:', data))
          .catch(err => console.log('Customer confirmation push error:', err));
      }
    } catch (e) {
      console.error('Email notification error:', e);
    }
  };

  /* ── Auto-Save & Persistent Login Info ── */
  function autoFillFormInputs() {
    try {
      const user = getCurrentUser();
      const savedEmail = (user && user.email) ? user.email : localStorage.getItem('mtcg_saved_email') || '';
      const savedName = (user && user.displayName) ? user.displayName : localStorage.getItem('mtcg_saved_name') || '';
      const savedFirstName = localStorage.getItem('mtcg_saved_first_name') || (savedName ? savedName.split(' ')[0] : '');
      const savedLastName = localStorage.getItem('mtcg_saved_last_name') || (savedName ? savedName.split(' ').slice(1).join(' ') : '');
      const savedAddress = localStorage.getItem('mtcg_saved_address') || '';
      const savedCity = localStorage.getItem('mtcg_saved_city') || '';
      const savedZip = localStorage.getItem('mtcg_saved_zip') || '';

      const emailInputs = ['checkout-email', 'signin-email', 'signup-email', 'contact-email', 'seller-payout-email', 'seller-email'];
      emailInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el && savedEmail && !el.value) el.value = savedEmail;
      });

      const nameInputs = ['signin-name', 'signup-name', 'cardholder-name', 'seller-payout-name', 'contact-name'];
      nameInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el && savedName && !el.value) el.value = savedName;
      });

      const firstNameEl = document.getElementById('checkout-first-name');
      if (firstNameEl && savedFirstName && !firstNameEl.value) firstNameEl.value = savedFirstName;

      const lastNameEl = document.getElementById('checkout-last-name');
      if (lastNameEl && savedLastName && !lastNameEl.value) lastNameEl.value = savedLastName;

      const addrEl = document.getElementById('checkout-address');
      if (addrEl && savedAddress && !addrEl.value) addrEl.value = savedAddress;

      const cityEl = document.getElementById('checkout-city');
      if (cityEl && savedCity && !cityEl.value) cityEl.value = savedCity;

      const zipEl = document.getElementById('checkout-zip');
      if (zipEl && savedZip && !zipEl.value) zipEl.value = savedZip;
    } catch (e) {
      console.error('Autofill error:', e);
    }
  }

  function setupInputAutoSaveListeners() {
    document.addEventListener('change', (e) => {
      const target = e.target;
      if (!target || !target.id) return;
      if (target.id === 'checkout-email' || target.id === 'signin-email') {
        if (target.value) localStorage.setItem('mtcg_saved_email', target.value.trim());
      } else if (target.id === 'checkout-first-name') {
        if (target.value) localStorage.setItem('mtcg_saved_first_name', target.value.trim());
      } else if (target.id === 'checkout-last-name') {
        if (target.value) localStorage.setItem('mtcg_saved_last_name', target.value.trim());
      } else if (target.id === 'checkout-address') {
        if (target.value) localStorage.setItem('mtcg_saved_address', target.value.trim());
      } else if (target.id === 'checkout-city') {
        if (target.value) localStorage.setItem('mtcg_saved_city', target.value.trim());
      } else if (target.id === 'checkout-zip') {
        if (target.value) localStorage.setItem('mtcg_saved_zip', target.value.trim());
      }
    });
  }

  /* ── Helpers ── */
  function hashPassword(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  function getUsers() {
    return JSON.parse(localStorage.getItem('mtcg_users') || '{}');
  }

  function saveUsers(users) {
    localStorage.setItem('mtcg_users', JSON.stringify(users));
  }

  function getCurrentUser() {
    const u = localStorage.getItem('mtcg_current_user');
    return u ? JSON.parse(u) : null;
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem('mtcg_current_user', JSON.stringify(user));
      localStorage.setItem('mtcg_saved_email', user.email);
      if (user.displayName) localStorage.setItem('mtcg_saved_name', user.displayName);
    } else {
      localStorage.removeItem('mtcg_current_user');
    }
  }

  /* ── Auth actions ── */
  function signUp(email, password, displayName) {
    email = email.toLowerCase().trim();
    const users = getUsers();
    if (users[email]) return { ok: false, error: 'An account with that email already exists.' };
    const user = { email, displayName: displayName || email.split('@')[0], createdAt: Date.now() };
    users[email] = { ...user, passwordHash: hashPassword(password) };
    saveUsers(users);
    setCurrentUser(user);

    // Direct Email Alert to Admin & Customer Confirmation
    if (typeof window.sendDirectEmailNotification === 'function') {
      window.sendDirectEmailNotification('New User Account Registered 👤', {
        DisplayName: user.displayName,
        UserEmail: user.email,
        RegistrationTime: new Date().toLocaleString()
      });
    }

    autoFillFormInputs();
    return { ok: true, user };
  }

  function signIn(email, password) {
    email = email.toLowerCase().trim();
    const users = getUsers();
    const record = users[email];
    if (!record) return { ok: false, error: 'No account found with that email.' };
    if (record.passwordHash !== hashPassword(password)) return { ok: false, error: 'Incorrect password.' };
    const user = { email: record.email, displayName: record.displayName, createdAt: record.createdAt };
    setCurrentUser(user);

    // Send sign-in notification copy
    if (typeof window.sendDirectEmailNotification === 'function') {
      window.sendDirectEmailNotification('User Account Sign In 🔐', {
        DisplayName: user.displayName,
        UserEmail: user.email,
        LoginTime: new Date().toLocaleString()
      });
    }

    autoFillFormInputs();
    return { ok: true, user };
  }

  function signOut() {
    setCurrentUser(null);
    updateAllAuthUI();
  }

  /* ── UI rendering ── */
  function getInitials(user) {
    const name = user.displayName || user.email;
    return name.slice(0, 1).toUpperCase();
  }

  function updateAllAuthUI() {
    const user = getCurrentUser();

    /* ─ Desktop header profile btn ─ */
    const desktopBtn = document.getElementById('auth-desktop-btn');
    if (desktopBtn) {
      if (user) {
        desktopBtn.innerHTML = `<span class="auth-avatar">${getInitials(user)}</span>`;
        desktopBtn.title = user.displayName;
      } else {
        desktopBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        desktopBtn.title = 'Sign In';
      }
    }

    /* ─ Mobile drawer profile section ─ */
    const drawerProfile = document.getElementById('auth-drawer-profile');
    if (drawerProfile) {
      if (user) {
        drawerProfile.innerHTML = `
          <div class="drawer-user-info">
            <div class="drawer-user-avatar">${getInitials(user)}</div>
            <div class="drawer-user-details">
              <div class="drawer-user-name">${user.displayName}</div>
              <div class="drawer-user-email">${user.email}</div>
            </div>
          </div>
          <button class="drawer-signout-btn" id="drawer-signout-btn">Sign Out</button>
        `;
        document.getElementById('drawer-signout-btn')?.addEventListener('click', signOut);
      } else {
        drawerProfile.innerHTML = `
          <button class="drawer-signin-btn" id="drawer-signin-trigger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Sign In / Create Account
          </button>
        `;
        document.getElementById('drawer-signin-trigger')?.addEventListener('click', () => {
          // close drawer if open
          document.getElementById('mobile-nav-drawer')?.classList.remove('open');
          document.getElementById('mobile-nav-overlay')?.classList.remove('active');
          openAuthModal('signin');
        });
      }
    }
  }

  /* ── Modal ── */
  function openAuthModal(tab = 'signin') {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
    switchTab(tab);
  }

  function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
    clearErrors();
  }

  function clearErrors() {
    ['auth-signin-error', 'auth-signup-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  function switchTab(tab) {
    const signinPanel = document.getElementById('auth-signin-panel');
    const signupPanel = document.getElementById('auth-signup-panel');
    const tabs = document.querySelectorAll('.auth-tab-btn');
    clearErrors();
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (signinPanel) signinPanel.style.display = tab === 'signin' ? 'flex' : 'none';
    if (signupPanel) signupPanel.style.display = tab === 'signup' ? 'flex' : 'none';
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal-overlay';
    modal.innerHTML = `
      <div class="auth-modal-box" role="dialog" aria-modal="true" aria-label="Sign In">
        <button class="auth-modal-close" id="auth-modal-close" aria-label="Close">✕</button>

        <div class="auth-modal-logo">
          <img src="images/logo.png" alt="MillionTCG" style="height:54px;width:auto;">
          <div class="auth-modal-brand">MILLION TCG</div>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab-btn active" data-tab="signin">Sign In</button>
          <button class="auth-tab-btn" data-tab="signup">Create Account</button>
        </div>

        <!-- Sign In Panel -->
        <div id="auth-signin-panel" class="auth-panel" style="display:flex;">
          <p class="auth-panel-sub">Welcome back, collector.</p>
          <div class="auth-error" id="auth-signin-error"></div>
          <div class="auth-field">
            <label>Email</label>
            <input type="email" id="signin-email" placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input type="password" id="signin-password" placeholder="••••••••" autocomplete="current-password">
          </div>
          <button class="auth-submit-btn" id="signin-submit-btn">Sign In</button>
          <p class="auth-switch">Don't have an account? <a href="#" class="auth-switch-link" data-tab="signup">Create one →</a></p>
        </div>

        <!-- Sign Up Panel -->
        <div id="auth-signup-panel" class="auth-panel" style="display:none;">
          <p class="auth-panel-sub">Join the MillionTCG community.</p>
          <div class="auth-error" id="auth-signup-error"></div>
          <div class="auth-field">
            <label>Display Name</label>
            <input type="text" id="signup-name" placeholder="Your collector name" autocomplete="name">
          </div>
          <div class="auth-field">
            <label>Email</label>
            <input type="email" id="signup-email" placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input type="password" id="signup-password" placeholder="Min. 6 characters" autocomplete="new-password">
          </div>
          <button class="auth-submit-btn" id="signup-submit-btn">Create Account</button>
          <p class="auth-switch">Already have an account? <a href="#" class="auth-switch-link" data-tab="signin">Sign in →</a></p>
        </div>
      </div>
    `;

    // Tab switching
    modal.querySelectorAll('.auth-tab-btn, .auth-switch-link').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        switchTab(el.dataset.tab);
      });
    });

    // Close
    modal.querySelector('#auth-modal-close').addEventListener('click', closeAuthModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeAuthModal(); });

    // Sign In submit
    modal.querySelector('#signin-submit-btn').addEventListener('click', () => {
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      const errEl = document.getElementById('auth-signin-error');
      if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
      const result = signIn(email, password);
      if (!result.ok) { errEl.textContent = result.error; return; }
      closeAuthModal();
      updateAllAuthUI();
    });

    // Sign Up submit
    modal.querySelector('#signup-submit-btn').addEventListener('click', () => {
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const errEl = document.getElementById('auth-signup-error');
      if (!email || !password) { errEl.textContent = 'Email and password are required.'; return; }
      if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
      const result = signUp(email, password, name);
      if (!result.ok) { errEl.textContent = result.error; return; }
      closeAuthModal();
      updateAllAuthUI();
    });

    // Enter key submits
    modal.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const signinVisible = document.getElementById('auth-signin-panel').style.display !== 'none';
      if (signinVisible) modal.querySelector('#signin-submit-btn').click();
      else modal.querySelector('#signup-submit-btn').click();
    });

    return modal;
  }

  /* ── Desktop auth button click ── */
  function handleDesktopAuthClick() {
    const user = getCurrentUser();
    if (user) {
      // Toggle a small dropdown
      let dd = document.getElementById('auth-desktop-dropdown');
      if (!dd) {
        dd = document.createElement('div');
        dd.id = 'auth-desktop-dropdown';
        dd.className = 'auth-desktop-dropdown';
        dd.innerHTML = `
          <div class="auth-dd-user">
            <div class="auth-dd-avatar">${getInitials(user)}</div>
            <div>
              <div class="auth-dd-name">${user.displayName}</div>
              <div class="auth-dd-email">${user.email}</div>
            </div>
          </div>
          <hr class="auth-dd-divider">
          <button class="auth-dd-signout" id="auth-dd-signout">Sign Out</button>
        `;
        document.getElementById('auth-desktop-btn').parentElement.style.position = 'relative';
        document.getElementById('auth-desktop-btn').parentElement.appendChild(dd);
        document.getElementById('auth-dd-signout').addEventListener('click', () => {
          signOut();
          dd.remove();
        });
        // Close on outside click
        setTimeout(() => {
          document.addEventListener('click', function onOutside(e) {
            if (!dd.contains(e.target) && e.target !== document.getElementById('auth-desktop-btn')) {
              dd.remove();
              document.removeEventListener('click', onOutside);
            }
          });
        }, 0);
      } else {
        dd.remove();
      }
    } else {
      openAuthModal('signin');
    }
  }

  /* ── Init ── */
  function init() {
    // Desktop button
    const desktopBtn = document.getElementById('auth-desktop-btn');
    if (desktopBtn) desktopBtn.addEventListener('click', handleDesktopAuthClick);

    // Mobile drawer open-modal trigger (set up on drawer open)
    updateAllAuthUI();
    autoFillFormInputs();
    setupInputAutoSaveListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use if needed
  window.MillionAuth = { signIn, signUp, signOut, getCurrentUser, openAuthModal, autoFillFormInputs };
})();
