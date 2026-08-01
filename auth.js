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
    const name = user ? (user.displayName || user.email) : 'C';
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
        desktopBtn.title = 'Account & Settings';
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
          <div style="display:flex; gap:8px;">
            <button class="drawer-signout-btn" id="drawer-settings-btn" style="flex:1; background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.2);">⚙️ Settings</button>
            <button class="drawer-signout-btn" id="drawer-signout-btn" style="flex:1;">Sign Out</button>
          </div>
        `;
        document.getElementById('drawer-settings-btn')?.addEventListener('click', () => {
          document.getElementById('mobile-nav-drawer')?.classList.remove('open');
          document.getElementById('mobile-nav-overlay')?.classList.remove('active');
          openAuthModal('profile');
        });
        document.getElementById('drawer-signout-btn')?.addEventListener('click', signOut);
      } else {
        drawerProfile.innerHTML = `
          <button class="drawer-signin-btn" id="drawer-signin-trigger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Account / Settings / Colors
          </button>
        `;
        document.getElementById('drawer-signin-trigger')?.addEventListener('click', () => {
          document.getElementById('mobile-nav-drawer')?.classList.remove('open');
          document.getElementById('mobile-nav-overlay')?.classList.remove('active');
          openAuthModal('profile');
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
    populateProfileFields();
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

  function populateProfileFields() {
    const user = getCurrentUser();
    const banking = getBankingInfo();
    const savedColor = localStorage.getItem('mtcg_theme_color') || '#ff4757';

    const nameInput = document.getElementById('profile-display-name');
    const emailInput = document.getElementById('profile-display-email');
    if (nameInput) nameInput.value = (user && user.displayName) ? user.displayName : localStorage.getItem('mtcg_saved_name') || '';
    if (emailInput) emailInput.value = (user && user.email) ? user.email : localStorage.getItem('mtcg_saved_email') || '';

    const bankName = document.getElementById('profile-bank-name');
    const bankMethod = document.getElementById('profile-bank-method');
    const bankDest = document.getElementById('profile-bank-dest');
    const bankRouting = document.getElementById('profile-bank-routing');
    const bankStatus = document.getElementById('profile-banking-status');

    if (bankName) bankName.value = banking.name || '';
    if (bankMethod) bankMethod.value = banking.type || 'bank';
    if (bankDest) bankDest.value = banking.dest || '';
    if (bankRouting) bankRouting.value = banking.routing || '';

    if (bankStatus) {
      if (banking.name && banking.dest) {
        bankStatus.textContent = '✓ Linked Payout Account';
        bankStatus.classList.remove('unlinked');
      } else {
        bankStatus.textContent = '⚠️ Unlinked Account';
        bankStatus.classList.add('unlinked');
      }
    }

    applyThemeColor(savedColor);
  }

  function switchTab(tab) {
    const signinPanel = document.getElementById('auth-signin-panel');
    const signupPanel = document.getElementById('auth-signup-panel');
    const profilePanel = document.getElementById('auth-profile-panel');
    const tabs = document.querySelectorAll('.auth-tab-btn');
    clearErrors();
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (signinPanel) signinPanel.style.display = tab === 'signin' ? 'flex' : 'none';
    if (signupPanel) signupPanel.style.display = tab === 'signup' ? 'flex' : 'none';
    if (profilePanel) profilePanel.style.display = tab === 'profile' ? 'flex' : 'none';
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal-overlay';
    modal.innerHTML = `
      <div class="auth-modal-box profile-modal-box" role="dialog" aria-modal="true" aria-label="Account Settings">
        <button class="auth-modal-close" id="auth-modal-close" aria-label="Close">✕</button>

        <div class="auth-modal-logo">
          <img src="images/logo.png" alt="MillionTCG" style="height:48px;width:auto;">
          <div class="auth-modal-brand">MILLION TCG HUB</div>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab-btn" data-tab="signin">Sign In</button>
          <button class="auth-tab-btn" data-tab="signup">Create Account</button>
          <button class="auth-tab-btn active" data-tab="profile">User Profile & Settings ⚙️</button>
        </div>

        <!-- Sign In Panel -->
        <div id="auth-signin-panel" class="auth-panel" style="display:none;">
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

        <!-- Profile & Settings Panel -->
        <div id="auth-profile-panel" class="auth-panel" style="display:flex; flex-direction:column; gap:12px;">
          <p class="auth-panel-sub">Manage your profile, banking payouts, & theme colors.</p>
          
          <!-- Banking & Payout Settings -->
          <div class="profile-section-title">🏦 Banking Information Settings</div>
          <div class="banking-info-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-size:0.78rem; font-weight:700; color:#aaa;">PAYOUT ACCOUNT STATUS</span>
              <span class="banking-badge-status" id="profile-banking-status">⚠️ Unlinked</span>
            </div>
            <div class="auth-field">
              <label>Account Holder Legal Name</label>
              <input type="text" id="profile-bank-name" placeholder="Full Legal Name (e.g. Alex Mercer)">
            </div>
            <div class="auth-field" style="margin-top:10px;">
              <label>Payout Method</label>
              <select id="profile-bank-method" style="background:#1a1a1a; border:1px solid #333; color:#fff; padding:10px; border-radius:8px; width:100%;">
                <option value="bank">Bank ACH Direct Deposit</option>
                <option value="paypal">PayPal Business</option>
                <option value="venmo">Venmo Account</option>
                <option value="stripe">Stripe Express</option>
                <option value="zelle">Zelle Pay</option>
              </select>
            </div>
            <div class="auth-field" style="margin-top:10px;">
              <label>Email / Account # / Handle</label>
              <input type="text" id="profile-bank-dest" placeholder="e.g. alex@paypal.com or Account #123456">
            </div>
            <div class="auth-field" style="margin-top:10px;">
              <label>Bank Routing # (9 Digits)</label>
              <input type="text" id="profile-bank-routing" placeholder="e.g. 021000021">
            </div>
            <button type="button" class="auth-submit-btn" id="save-banking-btn" style="margin-top:14px;">
              SAVE BANKING INFORMATION 🏦
            </button>
          </div>

          <!-- Color & Theme Customizations -->
          <div class="profile-section-title">🎨 Color & Theme Customization</div>
          <p style="font-size:0.78rem; color:#a0a0a0; margin-bottom:6px;">Choose an accent color theme for the site:</p>
          <div class="theme-swatches-grid">
            <button type="button" class="theme-swatch-btn active" data-color="#ff4757">
              <div class="swatch-color-dot" style="background:#ff4757;"></div>
              <span>Crimson</span>
            </button>
            <button type="button" class="theme-swatch-btn" data-color="#a855f7">
              <div class="swatch-color-dot" style="background:#a855f7;"></div>
              <span>Violet</span>
            </button>
            <button type="button" class="theme-swatch-btn" data-color="#00d2d3">
              <div class="swatch-color-dot" style="background:#00d2d3;"></div>
              <span>Cyan</span>
            </button>
            <button type="button" class="theme-swatch-btn" data-color="#ffd700">
              <div class="swatch-color-dot" style="background:#ffd700;"></div>
              <span>Gold</span>
            </button>
            <button type="button" class="theme-swatch-btn" data-color="#2ecc71">
              <div class="swatch-color-dot" style="background:#2ecc71;"></div>
              <span>Emerald</span>
            </button>
            <button type="button" class="theme-swatch-btn" data-color="#ff007f">
              <div class="swatch-color-dot" style="background:#ff007f;"></div>
              <span>Rose</span>
            </button>
          </div>

          <div class="custom-color-picker-wrapper">
            <span style="font-size:0.8rem; font-weight:700;">Custom Primary Color</span>
            <input type="color" id="profile-custom-color" class="custom-color-input" value="#ff4757">
          </div>
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

    // Theme Swatches
    modal.querySelectorAll('.theme-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        applyThemeColor(color);
      });
    });

    // Custom Color Picker
    const customColorInput = modal.querySelector('#profile-custom-color');
    if (customColorInput) {
      customColorInput.addEventListener('input', (e) => {
        applyThemeColor(e.target.value);
      });
    }

    // Save Banking Info
    modal.querySelector('#save-banking-btn')?.addEventListener('click', () => {
      const name = document.getElementById('profile-bank-name').value.trim();
      const type = document.getElementById('profile-bank-method').value;
      const dest = document.getElementById('profile-bank-dest').value.trim();
      const routing = document.getElementById('profile-bank-routing').value.trim();

      if (!name || !dest) {
        alert('Please enter your Legal Account Holder Name and Account/Email details.');
        return;
      }

      saveBankingInfo({ name, type, dest, routing, verified: true, linkedAt: Date.now() });
      populateProfileFields();
      alert(`🎉 SUCCESS! Banking Information saved to your profile (${type.toUpperCase()}).`);
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
          <button class="auth-dd-signout" id="auth-dd-profile-btn" style="margin-bottom:8px; background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.2);">⚙️ Profile & Settings</button>
          <button class="auth-dd-signout" id="auth-dd-signout">Sign Out</button>
        `;
        document.getElementById('auth-desktop-btn').parentElement.style.position = 'relative';
        document.getElementById('auth-desktop-btn').parentElement.appendChild(dd);
        
        document.getElementById('auth-dd-profile-btn').addEventListener('click', () => {
          dd.remove();
          openAuthModal('profile');
        });
        document.getElementById('auth-dd-signout').addEventListener('click', () => {
          signOut();
          dd.remove();
        });
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
      openAuthModal('profile');
    }
  }

  /* ── Init ── */
  function init() {
    const desktopBtn = document.getElementById('auth-desktop-btn');
    if (desktopBtn) desktopBtn.addEventListener('click', handleDesktopAuthClick);

    loadSavedThemeColor();
    updateAllAuthUI();
    autoFillFormInputs();
    setupInputAutoSaveListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use
  window.MillionAuth = { signIn, signUp, signOut, getCurrentUser, openAuthModal, autoFillFormInputs, applyThemeColor, getBankingInfo, saveBankingInfo };
})();
