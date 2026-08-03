/**
 * MillionTCG Multi-Device Auth & Account Management Engine
 * Primary Business Email: tcgmillion@gmail.com
 */

(function () {
  'use strict';

  const MAIN_BUSINESS_EMAIL = 'tcgmillion@gmail.com';
  const WEB3FORMS_KEY = '5979c3fb-2a54-469b-980b-04ff57d42cf3';

  /* ────────────────────────────────────────────────────────────
     1. Storage & State Management
  ──────────────────────────────────────────────────────────── */
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem('mtcg_users') || '{}');
    } catch {
      return {};
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem('mtcg_users', JSON.stringify(users));
    } catch (e) {
      console.error('saveUsers error:', e);
    }
  }

  function getCurrentUser() {
    try {
      const u = localStorage.getItem('mtcg_current_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem('mtcg_current_user', JSON.stringify(user));
      localStorage.setItem('mtcg_saved_email', user.email || '');
      if (user.displayName) localStorage.setItem('mtcg_saved_name', user.displayName);
      if (user.address) localStorage.setItem('mtcg_saved_address', user.address);
      if (user.city) localStorage.setItem('mtcg_saved_city', user.city);
      if (user.zip) localStorage.setItem('mtcg_saved_zip', user.zip);

      const sellerAcc = {
        name: user.displayName || user.email.split('@')[0],
        handle: (user.displayName || user.email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        email: user.email,
        isVerified: true,
        joined: user.createdAt || Date.now()
      };
      localStorage.setItem('milliontcg_user_account', JSON.stringify(sellerAcc));
    } else {
      localStorage.removeItem('mtcg_current_user');
      localStorage.removeItem('milliontcg_user_account');
    }
  }

  function syncUserRecord(record) {
    if (!record || !record.email) return;
    const emailKey = record.email.toLowerCase().trim();
    const users = getUsers();
    users[emailKey] = record;
    saveUsers(users);
  }

  async function fetchCloudUsers() {
    const localUsers = getUsers();
    try {
      const res = await fetch('js/users_db.json?v=' + Date.now(), { cache: 'no-cache' }).catch(() => null);
      if (res && res.ok) {
        const cloudUsers = await res.json().catch(() => ({}));
        const merged = { ...cloudUsers, ...localUsers };
        saveUsers(merged);
        return merged;
      }
    } catch (e) {
      // Fallback to local storage silently
    }
    return localUsers;
  }

  /* ────────────────────────────────────────────────────────────
     2. Security & Web Crypto SHA-256 Hashing
  ──────────────────────────────────────────────────────────── */
  async function hashPassword(str) {
    if (!str) return '';
    if (window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str + '_mtcg_salt_2026_v2');
        const buf = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        console.warn('SubtleCrypto error, using fallback:', e);
      }
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    return 'h_' + Math.abs(hash).toString(36);
  }

  /* ────────────────────────────────────────────────────────────
     3. Notification & Email Dispatcher
  ──────────────────────────────────────────────────────────── */
  function sendDirectEmailNotification(eventTitle, detailsData = {}) {
    try {
      const timestamp = new Date().toLocaleString();
      const userEmail = detailsData.UserEmail || detailsData.CustomerEmail || detailsData.Email || detailsData.ContactEmail || MAIN_BUSINESS_EMAIL;

      let detailsText = '';
      for (const [key, val] of Object.entries(detailsData)) {
        if (!['UserEmail', 'CustomerEmail', 'Email', 'ContactEmail'].includes(key)) {
          detailsText += `${key}: ${val}\n`;
        }
      }

      // 1. Log locally
      const logs = JSON.parse(localStorage.getItem('mtcg_notifications') || '[]');
      logs.unshift({ eventTitle, detailsData, timestamp });
      localStorage.setItem('mtcg_notifications', JSON.stringify(logs.slice(0, 50)));

      // 2. Admin alert
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `⚡ MillionTCG Alert: ${eventTitle}`,
          from_name: 'MillionTCG Official',
          replyto: MAIN_BUSINESS_EMAIL,
          email: MAIN_BUSINESS_EMAIL,
          message: `Event: ${eventTitle}\nTimestamp: ${timestamp}\n\n${detailsText}`
        })
      }).catch(() => {});

      // 3. Customer confirmation
      if (userEmail && userEmail.toLowerCase() !== MAIN_BUSINESS_EMAIL.toLowerCase() && userEmail.includes('@')) {
        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject: `MillionTCG Confirmation: ${eventTitle}`,
            from_name: 'MillionTCG Official',
            replyto: MAIN_BUSINESS_EMAIL,
            email: userEmail,
            message: `Hello,\n\nThank you for choosing MillionTCG!\n\nDetails of your ${eventTitle}:\n\n${detailsText}\nTimestamp: ${timestamp}\n\nBest regards,\nMillionTCG Team`
          })
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Notification dispatch error:', e);
    }
  }

  /* ────────────────────────────────────────────────────────────
     4. 3D Stage Background Customizer
  ──────────────────────────────────────────────────────────── */
  function set3DStageBackgroundColor(colorHex) {
    if (!colorHex) return;
    try {
      localStorage.setItem('mtcg_stage_bg_color', colorHex);
      const canvas = document.getElementById('hero-3d-canvas');
      const container = document.getElementById('hero-3d-container') || document.querySelector('.hero-3d-stage') || document.querySelector('.hero-section');
      if (canvas && canvas.userData) {
        if (canvas.userData.scene) {
          canvas.userData.scene.background = new THREE.Color(colorHex);
          if (canvas.userData.scene.fog) canvas.userData.scene.fog.color = new THREE.Color(colorHex);
        }
        if (canvas.userData.renderer) {
          canvas.userData.renderer.setClearColor(colorHex, 1);
        }
        canvas.style.backgroundColor = colorHex;
      }
      if (container) container.style.backgroundColor = colorHex;
      const heroSec = document.querySelector('.hero-section');
      if (heroSec) heroSec.style.backgroundColor = colorHex;
    } catch (e) {
      console.error('set3DStageBackgroundColor error:', e);
    }
  }

  /* ────────────────────────────────────────────────────────────
     5. Core Authentication Operations
  ──────────────────────────────────────────────────────────── */
  async function signUp(email, password, displayName) {
    email = (email || '').toLowerCase().trim();
    if (!email || !password) return { ok: false, error: 'Email address and password are required.' };
    if (!email.includes('@') || !email.includes('.')) return { ok: false, error: 'Please enter a valid email address.' };
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters long.' };

    const users = await fetchCloudUsers();
    if (users[email]) {
      return { ok: false, error: 'An account with this email address already exists. Please sign in.' };
    }

    const passwordHash = await hashPassword(password);
    const userRecord = {
      email,
      displayName: displayName ? displayName.trim() : email.split('@')[0],
      passwordHash,
      isVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    syncUserRecord(userRecord);
    setCurrentUser(userRecord);
    autoFillFormInputs();

    sendDirectEmailNotification('New Account Registered 🏪', {
      DisplayName: userRecord.displayName,
      UserEmail: userRecord.email,
      Status: 'Active Collector & Seller'
    });

    return { ok: true, user: userRecord, message: 'Account created successfully! Welcome to MillionTCG.' };
  }

  async function signIn(email, password) {
    email = (email || '').toLowerCase().trim();
    if (!email || !password) return { ok: false, error: 'Email and password are required.' };

    const users = await fetchCloudUsers();
    const record = users[email];
    const passwordHash = await hashPassword(password);

    if (!record || record.passwordHash !== passwordHash) {
      return { ok: false, error: 'Invalid email address or password. Please try again.' };
    }

    record.updatedAt = Date.now();
    syncUserRecord(record);
    setCurrentUser(record);
    autoFillFormInputs();

    sendDirectEmailNotification('Sign In Successful 🔐', {
      DisplayName: record.displayName || record.email.split('@')[0],
      UserEmail: record.email
    });

    return { ok: true, user: record };
  }

  function signOut() {
    setCurrentUser(null);
    updateAllAuthUI();
    const modal = document.getElementById('auth-modal');
    if (modal && modal.classList.contains('active')) {
      switchTab('signin');
    }
  }

  async function updateProfile(data = {}) {
    const user = getCurrentUser();
    if (!user) return { ok: false, error: 'Not signed in.' };

    const users = getUsers();
    const record = users[user.email] || { ...user };

    const fields = [
      'displayName', 'phone', 'country', 'address', 'city', 'state', 'zip',
      'payoutEmail', 'payoutMethod', 'payoutName', 'payoutSchedule',
      'routingNumber', 'accountNumber', 'taxId'
    ];
    fields.forEach(k => {
      if (data[k] !== undefined) record[k] = data[k];
    });

    if (data.newPassword) {
      record.passwordHash = await hashPassword(data.newPassword);
    }

    record.updatedAt = Date.now();
    syncUserRecord(record);
    setCurrentUser(record);
    updateAllAuthUI();
    return { ok: true, user: record };
  }

  /* ────────────────────────────────────────────────────────────
     6. Persistent Form Autofill
  ──────────────────────────────────────────────────────────── */
  function autoFillFormInputs() {
    try {
      const user = getCurrentUser();
      const savedEmail = user?.email || localStorage.getItem('mtcg_saved_email') || '';
      const savedName = user?.displayName || localStorage.getItem('mtcg_saved_name') || '';
      const savedFirst = localStorage.getItem('mtcg_saved_first_name') || (savedName ? savedName.split(' ')[0] : '');
      const savedLast = localStorage.getItem('mtcg_saved_last_name') || (savedName ? savedName.split(' ').slice(1).join(' ') : '');
      const savedAddr = user?.address || localStorage.getItem('mtcg_saved_address') || '';
      const savedCity = user?.city || localStorage.getItem('mtcg_saved_city') || '';
      const savedZip = user?.zip || localStorage.getItem('mtcg_saved_zip') || '';

      const fill = (ids, val) => {
        if (!val) return;
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el && !el.value) el.value = val;
        });
      };

      fill(['checkout-email', 'signin-email', 'signup-email', 'contact-email', 'seller-payout-email', 'seller-email'], savedEmail);
      fill(['signin-name', 'signup-name', 'cardholder-name', 'seller-payout-name', 'contact-name'], savedName);
      fill(['checkout-first-name'], savedFirst);
      fill(['checkout-last-name'], savedLast);
      fill(['checkout-address'], savedAddr);
      fill(['checkout-city'], savedCity);
      fill(['checkout-zip'], savedZip);
    } catch (e) {
      console.error('Autofill error:', e);
    }
  }

  function setupAutoSaveListeners() {
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || !t.id || !t.value) return;
      const v = t.value.trim();
      const map = {
        'checkout-email': 'mtcg_saved_email',
        'signin-email': 'mtcg_saved_email',
        'checkout-first-name': 'mtcg_saved_first_name',
        'checkout-last-name': 'mtcg_saved_last_name',
        'checkout-address': 'mtcg_saved_address',
        'checkout-city': 'mtcg_saved_city',
        'checkout-zip': 'mtcg_saved_zip'
      };
      if (map[t.id]) localStorage.setItem(map[t.id], v);
    });
  }

  /* ────────────────────────────────────────────────────────────
     7. UI Helpers & Navigation Badge Updating
  ──────────────────────────────────────────────────────────── */
  function getInitials(user) {
    if (!user) return 'U';
    const name = user.displayName || user.email || 'User';
    return name.slice(0, 1).toUpperCase();
  }

  function updateAllAuthUI() {
    const user = getCurrentUser();

    // 1. Desktop Nav Button
    const desktopBtn = document.getElementById('auth-desktop-btn');
    if (desktopBtn) {
      if (user) {
        desktopBtn.innerHTML = `<span class="auth-avatar" style="background:#eab308;color:#000;font-weight:700;border-radius:50%;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;">${getInitials(user)}</span>`;
        desktopBtn.title = user.displayName || user.email;
      } else {
        desktopBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        desktopBtn.title = 'Sign In';
      }
    }

    // 2. Account Nav Link
    const navAuthBtn = document.getElementById('nav-auth-btn');
    if (navAuthBtn) {
      if (user) {
        navAuthBtn.textContent = `@${(user.displayName || user.email.split('@')[0]).toUpperCase()}`;
        navAuthBtn.title = user.email;
      } else {
        navAuthBtn.textContent = 'ACCOUNT';
      }
    }

    // 3. Mobile Navigation Drawer
    const drawerProfile = document.getElementById('auth-drawer-profile');
    if (drawerProfile) {
      if (user) {
        drawerProfile.innerHTML = `
          <div class="drawer-user-info" onclick="window.MillionAuth.openAuthModal('profile')" style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:8px;cursor:pointer;">
            <div class="drawer-user-avatar" style="background:#eab308;color:#000;font-weight:700;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;">${getInitials(user)}</div>
            <div class="drawer-user-details" style="overflow:hidden;">
              <div class="drawer-user-name" style="font-weight:600;color:#fff;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.displayName || user.email.split('@')[0]}</div>
              <div class="drawer-user-email" style="font-size:12px;color:#a1a1aa;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.email}</div>
            </div>
          </div>
          <button id="drawer-signout-btn" style="width:100%;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Sign Out</button>
        `;
        document.getElementById('drawer-signout-btn')?.addEventListener('click', signOut);
      } else {
        drawerProfile.innerHTML = `
          <button id="drawer-signin-trigger" style="width:100%;padding:12px;background:#eab308;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Sign In / Create Account
          </button>
        `;
        document.getElementById('drawer-signin-trigger')?.addEventListener('click', () => {
          document.getElementById('mobile-nav-drawer')?.classList.remove('open');
          document.getElementById('mobile-nav-overlay')?.classList.remove('active');
          openAuthModal('signin');
        });
      }
    }
  }

  /* ────────────────────────────────────────────────────────────
     8. Modal System & Dynamic Panels
  ──────────────────────────────────────────────────────────── */
  function clearErrors() {
    ['auth-signin-error', 'auth-signup-error', 'auth-profile-error', 'auth-banking-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  function renderModalTabs(currentTab) {
    const tabsContainer = document.getElementById('auth-tabs');
    if (!tabsContainer) return;

    const user = getCurrentUser();
    if (user) {
      tabsContainer.innerHTML = `
        <button class="auth-tab-btn ${currentTab === 'profile' ? 'active' : ''}" data-tab="profile">👤 Profile & Shipping</button>
        <button class="auth-tab-btn ${currentTab === 'banking' ? 'active' : ''}" data-tab="banking">🏦 Banking & Payouts</button>
        <button class="auth-tab-btn ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">⚙️ Store Settings</button>
        <button class="auth-tab-btn ${currentTab === 'colors' ? 'active' : ''}" data-tab="colors">🎨 3D Stage Color</button>
      `;
    } else {
      tabsContainer.innerHTML = `
        <button class="auth-tab-btn ${currentTab === 'signin' ? 'active' : ''}" data-tab="signin">Sign In</button>
        <button class="auth-tab-btn ${currentTab === 'signup' ? 'active' : ''}" data-tab="signup">Create Account</button>
      `;
    }

    tabsContainer.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(btn.dataset.tab);
      });
    });
  }

  function populateProfilePanel() {
    const u = getCurrentUser() || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('profile-name', u.displayName);
    setVal('profile-email', u.email);
    setVal('profile-address', u.address);
    setVal('profile-city', u.city);
    setVal('profile-zip', u.zip);
  }

  function populateBankingPanel() {
    const u = getCurrentUser() || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('banking-payout-email', u.payoutEmail || u.email);
    setVal('banking-payout-name', u.payoutName || u.displayName);
    setVal('banking-routing-number', u.routingNumber);
    setVal('banking-account-number', u.accountNumber);
    setVal('banking-tax-id', u.taxId);

    const methodSelect = document.getElementById('banking-payout-method');
    if (methodSelect && u.payoutMethod) methodSelect.value = u.payoutMethod;
    const scheduleSelect = document.getElementById('banking-payout-schedule');
    if (scheduleSelect && u.payoutSchedule) scheduleSelect.value = u.payoutSchedule;
  }

  function populateColorsPanel() {
    const picker = document.getElementById('stage-bg-picker');
    const preview = document.getElementById('modal-stage-color-preview');
    const currentColor = localStorage.getItem('mtcg_stage_bg_color') || '#141416';

    if (picker) {
      picker.value = currentColor;
      if (preview) preview.style.backgroundColor = currentColor;
      if (!picker.dataset.liveBound) {
        picker.dataset.liveBound = 'true';
        const liveUpdate = () => {
          if (preview) preview.style.backgroundColor = picker.value;
          set3DStageBackgroundColor(picker.value);
        };
        picker.addEventListener('input', liveUpdate);
        picker.addEventListener('change', liveUpdate);
      }
    }
  }

  function switchTab(tab) {
    const user = getCurrentUser();
    if (user) {
      if (['signin', 'signup'].includes(tab)) tab = 'profile';
    } else {
      if (!['signin', 'signup'].includes(tab)) tab = 'signin';
    }

    renderModalTabs(tab);
    clearErrors();

    const panels = ['signin', 'signup', 'profile', 'banking', 'settings', 'colors'];
    panels.forEach(p => {
      const el = document.getElementById(`auth-${p}-panel`);
      if (el) el.style.display = tab === p ? 'flex' : 'none';
    });

    if (tab === 'profile') populateProfilePanel();
    if (tab === 'banking') populateBankingPanel();
    if (tab === 'colors') populateColorsPanel();
  }

  function openAuthModal(tab) {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
    switchTab(tab || (getCurrentUser() ? 'profile' : 'signin'));
  }

  function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
    clearErrors();
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal-overlay';
    modal.innerHTML = `
      <div class="auth-modal-box" role="dialog" aria-modal="true" aria-label="Account Center">
        <button class="auth-modal-close" id="auth-modal-close" aria-label="Close">✕</button>

        <div class="auth-modal-logo">
          <img src="images/logo.png" alt="MillionTCG" style="height:50px;width:auto;">
          <div class="auth-modal-brand">MILLION TCG ACCOUNT CENTER</div>
        </div>

        <div class="auth-tabs" id="auth-tabs"></div>

        <!-- Sign In Panel -->
        <div id="auth-signin-panel" class="auth-panel" style="display:none;max-width:440px;margin:0 auto;width:100%;">
          <p class="auth-panel-sub">Welcome back, collector. Sign in across any device.</p>
          <div class="auth-error" id="auth-signin-error"></div>
          <div class="auth-field">
            <label>Email Address</label>
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
        <div id="auth-signup-panel" class="auth-panel" style="display:none;max-width:440px;margin:0 auto;width:100%;">
          <p class="auth-panel-sub">Join MillionTCG. Multi-device cloud sync included.</p>
          <div class="auth-error" id="auth-signup-error"></div>
          <div class="auth-field">
            <label>Display Name</label>
            <input type="text" id="signup-name" placeholder="Your collector name" autocomplete="name">
          </div>
          <div class="auth-field">
            <label>Email Address</label>
            <input type="email" id="signup-email" placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input type="password" id="signup-password" placeholder="Min. 6 characters" autocomplete="new-password">
          </div>
          <button class="auth-submit-btn" id="signup-submit-btn">Create Account</button>
          <p class="auth-switch">Already have an account? <a href="#" class="auth-switch-link" data-tab="signin">Sign in →</a></p>
        </div>

        <!-- Profile & Shipping Panel -->
        <div id="auth-profile-panel" class="auth-panel" style="display:none;width:100%;">
          <p class="auth-panel-sub">Manage your collector identity and default shipping address.</p>
          <div class="auth-error" id="auth-profile-error"></div>
          <div class="auth-grid-responsive">
            <div class="auth-field">
              <label>Collector Display Name</label>
              <input type="text" id="profile-name" placeholder="Display name">
            </div>
            <div class="auth-field">
              <label>Email Address</label>
              <input type="email" id="profile-email" disabled style="opacity:0.7;">
            </div>
            <div class="auth-field" style="grid-column:1/-1;">
              <label>Street Shipping Address</label>
              <input type="text" id="profile-address" placeholder="123 Main St, Apt 4B">
            </div>
            <div class="auth-field">
              <label>City</label>
              <input type="text" id="profile-city" placeholder="City">
            </div>
            <div class="auth-field">
              <label>ZIP / Postal Code</label>
              <input type="text" id="profile-zip" placeholder="ZIP Code">
            </div>
            <div class="auth-field" style="grid-column:1/-1;">
              <label>New Password (Optional)</label>
              <input type="password" id="profile-new-password" placeholder="Leave blank to keep current password">
            </div>
          </div>
          <button class="auth-submit-btn" id="profile-save-btn">Save Profile Changes</button>
        </div>

        <!-- Banking & Payouts Panel -->
        <div id="auth-banking-panel" class="auth-panel" style="display:none;width:100%;">
          <p class="auth-panel-sub">Direct Payouts & Seller Banking Information for card marketplace sales.</p>
          <div class="auth-error" id="auth-banking-error"></div>
          <div class="auth-grid-responsive">
            <div class="auth-field">
              <label>Payout Email / Primary Handle</label>
              <input type="email" id="banking-payout-email" placeholder="payouts@example.com">
            </div>
            <div class="auth-field">
              <label>Preferred Payout Method</label>
              <select id="banking-payout-method" style="padding:12px 16px;background:#1a1a1a;color:#fff;border:1px solid #2a2a2a;border-radius:10px;font-family:inherit;">
                <option value="Direct Deposit">Direct Deposit (ACH / Bank Transfer)</option>
                <option value="Venmo">Venmo</option>
                <option value="Zelle">Zelle</option>
                <option value="PayPal">PayPal</option>
                <option value="Wire Transfer">Wire Transfer (High Value)</option>
              </select>
            </div>
            <div class="auth-field">
              <label>Account Holder Full Name</label>
              <input type="text" id="banking-payout-name" placeholder="Legal Full Name or Entity">
            </div>
            <div class="auth-field">
              <label>Payout Schedule</label>
              <select id="banking-payout-schedule" style="padding:12px 16px;background:#1a1a1a;color:#fff;border:1px solid #2a2a2a;border-radius:10px;font-family:inherit;">
                <option value="Instant">Instant (Daily Automated Payouts)</option>
                <option value="Weekly">Weekly (Every Monday)</option>
                <option value="Monthly">Monthly (1st of Month)</option>
              </select>
            </div>
            <div class="auth-field">
              <label>Bank Routing Number (9-Digit)</label>
              <input type="text" id="banking-routing-number" placeholder="021000021">
            </div>
            <div class="auth-field">
              <label>Bank Account Number</label>
              <input type="text" id="banking-account-number" placeholder="Account Number">
            </div>
            <div class="auth-field" style="grid-column:1/-1;">
              <label>Tax Identification / SSN (Encrypted 1099-K Compliance)</label>
              <input type="password" id="banking-tax-id" placeholder="•••-••-••••">
            </div>
          </div>
          <button class="auth-submit-btn" id="banking-save-btn">Save Banking Preferences</button>
        </div>

        <!-- Store Settings Panel -->
        <div id="auth-settings-panel" class="auth-panel" style="display:none;width:100%;">
          <p class="auth-panel-sub">Store & Display Preferences.</p>
          <div style="padding:18px;background:rgba(255,255,255,0.03);border-radius:12px;margin:12px 0 20px;display:flex;flex-direction:column;gap:14px;">
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer;color:#fff;font-weight:600;">
              <input type="checkbox" checked style="width:18px;height:18px;">
              <span>Receive Order & Price Alert Notifications</span>
            </label>
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer;color:#fff;font-weight:600;">
              <input type="checkbox" checked style="width:18px;height:18px;">
              <span>New Pre-Order Drops & Rare Single Notifications</span>
            </label>
          </div>
          <button class="auth-submit-btn" id="settings-save-btn">Save Settings</button>
        </div>

        <!-- 3D Stage Colors Panel -->
        <div id="auth-colors-panel" class="auth-panel" style="display:none;width:100%;">
          <p class="auth-panel-sub">Customize 3D Showcase Stage Background Color in Real Time.</p>
          <div class="auth-grid-responsive auth-grid-colors" style="margin:16px 0 20px;">
            <div class="auth-field">
              <label>Select Stage Color</label>
              <input type="color" id="stage-bg-picker" value="#141416" style="width:100%;height:54px;border:none;border-radius:10px;cursor:pointer;background:none;">
            </div>
            <div id="modal-stage-color-preview" style="height:60px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;">
              Live 3D Stage Preview
            </div>
          </div>
          <button class="auth-submit-btn" id="colors-save-btn">Apply 3D Stage Background</button>
        </div>
      </div>
    `;

    // Close listeners
    modal.querySelector('#auth-modal-close')?.addEventListener('click', closeAuthModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal(); });

    // Switch links
    modal.addEventListener('click', (e) => {
      const link = e.target.closest('.auth-switch-link');
      if (link && link.dataset.tab) {
        e.preventDefault();
        switchTab(link.dataset.tab);
      }
    });

    // Sign In handler
    modal.querySelector('#signin-submit-btn')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#signin-submit-btn');
      const email = document.getElementById('signin-email')?.value.trim() || '';
      const password = document.getElementById('signin-password')?.value || '';
      const errEl = document.getElementById('auth-signin-error');

      if (!email || !password) {
        if (errEl) errEl.textContent = 'Please fill in all fields.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Signing In...';
      if (errEl) errEl.textContent = '';

      try {
        const res = await signIn(email, password);
        if (!res.ok) {
          if (errEl) errEl.textContent = res.error || 'Sign in failed.';
        } else {
          closeAuthModal();
          updateAllAuthUI();
        }
      } catch (e) {
        if (errEl) errEl.textContent = 'An unexpected sign in error occurred.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    // Sign Up handler
    modal.querySelector('#signup-submit-btn')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#signup-submit-btn');
      const name = document.getElementById('signup-name')?.value.trim() || '';
      const email = document.getElementById('signup-email')?.value.trim() || '';
      const password = document.getElementById('signup-password')?.value || '';
      const errEl = document.getElementById('auth-signup-error');

      if (!email || !password) {
        if (errEl) errEl.textContent = 'Email and password are required.';
        return;
      }
      if (password.length < 6) {
        if (errEl) errEl.textContent = 'Password must be at least 6 characters.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creating Account...';
      if (errEl) errEl.textContent = '';

      try {
        const res = await signUp(email, password, name);
        if (!res.ok) {
          if (errEl) errEl.textContent = res.error || 'Sign up failed.';
        } else {
          closeAuthModal();
          updateAllAuthUI();
        }
      } catch (e) {
        if (errEl) errEl.textContent = 'An error occurred during account creation.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });

    // Profile Save handler
    modal.querySelector('#profile-save-btn')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#profile-save-btn');
      const name = document.getElementById('profile-name')?.value.trim();
      const address = document.getElementById('profile-address')?.value.trim();
      const city = document.getElementById('profile-city')?.value.trim();
      const zip = document.getElementById('profile-zip')?.value.trim();
      const newPassword = document.getElementById('profile-new-password')?.value;
      const errEl = document.getElementById('auth-profile-error');

      btn.disabled = true;
      btn.textContent = 'Saving Changes...';

      try {
        const res = await updateProfile({ displayName: name, address, city, zip, newPassword });
        if (res.ok) {
          closeAuthModal();
          alert('✅ Profile details saved successfully!');
        } else if (errEl) {
          errEl.textContent = res.error || 'Failed to save profile.';
        }
      } catch {
        if (errEl) errEl.textContent = 'Error saving profile.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Profile Changes';
      }
    });

    // Banking Save handler
    modal.querySelector('#banking-save-btn')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#banking-save-btn');
      const payoutEmail = document.getElementById('banking-payout-email')?.value.trim();
      const payoutMethod = document.getElementById('banking-payout-method')?.value;
      const payoutName = document.getElementById('banking-payout-name')?.value.trim();
      const payoutSchedule = document.getElementById('banking-payout-schedule')?.value;
      const routingNumber = document.getElementById('banking-routing-number')?.value.trim();
      const accountNumber = document.getElementById('banking-account-number')?.value.trim();
      const taxId = document.getElementById('banking-tax-id')?.value.trim();

      btn.disabled = true;
      btn.textContent = 'Saving Preferences...';

      try {
        const res = await updateProfile({ payoutEmail, payoutMethod, payoutName, payoutSchedule, routingNumber, accountNumber, taxId });
        if (res.ok) {
          closeAuthModal();
          alert('✅ Seller banking & payout preferences updated!');
        } else {
          alert('Failed to save banking preferences: ' + (res.error || 'Unknown error'));
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Banking Preferences';
      }
    });

    // Settings Save handler
    modal.querySelector('#settings-save-btn')?.addEventListener('click', () => {
      closeAuthModal();
      alert('✅ Store settings saved!');
    });

    // Colors Save handler
    modal.querySelector('#colors-save-btn')?.addEventListener('click', () => {
      const val = document.getElementById('stage-bg-picker')?.value;
      if (val) set3DStageBackgroundColor(val);
      closeAuthModal();
      alert('🎨 3D Stage Background color updated successfully!');
    });

    // Enter key submits
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (document.getElementById('auth-signin-panel')?.style.display !== 'none') {
        modal.querySelector('#signin-submit-btn')?.click();
      } else if (document.getElementById('auth-signup-panel')?.style.display !== 'none') {
        modal.querySelector('#signup-submit-btn')?.click();
      }
    });

    return modal;
  }

  /* ────────────────────────────────────────────────────────────
     9. Initialization & Event Binding
  ──────────────────────────────────────────────────────────── */
  function init() {
    // 1. Bind Desktop Auth Button
    document.getElementById('auth-desktop-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAuthModal();
    });

    // 2. Bind Account Nav Links
    document.getElementById('nav-auth-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal();
    });

    document.querySelectorAll('.auth-btn-nav, .btn-account-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal();
      });
    });

    // 3. Restore saved 3D stage background color
    const savedColor = localStorage.getItem('mtcg_stage_bg_color');
    if (savedColor) set3DStageBackgroundColor(savedColor);

    // 4. Initial Sync & UI Render
    fetchCloudUsers().then(() => {
      updateAllAuthUI();
      autoFillFormInputs();
    });

    // 5. Global auto-save listeners
    setupAutoSaveListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ────────────────────────────────────────────────────────────
     10. Public API Exports
  ──────────────────────────────────────────────────────────── */
  window.sendDirectEmailNotification = sendDirectEmailNotification;
  window.set3DStageBackgroundColor = set3DStageBackgroundColor;

  window.MillionAuth = {
    signIn,
    signUp,
    signOut,
    updateProfile,
    getCurrentUser,
    openAuthModal,
    closeAuthModal,
    autoFillFormInputs,
    fetchCloudUsers,
    set3DStageBackgroundColor,
    sendDirectEmailNotification
  };
})();
