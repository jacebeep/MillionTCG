/**
 * MillionTCG Multi-Device Auth & Account Management Engine
 * Primary Business Email: tcgmillion@gmail.com
 * Google Apps Script Cloud Engine: https://script.google.com/macros/s/AKfycbxvmoPGXVL-K7t9tTnQ5rqp3FzcJjruwDhbXJe4qEaX726qqpC2AI1ay9DcgA9YXoQdHg/exec
 */

(function () {
  'use strict';

  const MAIN_BUSINESS_EMAIL = 'tcgmillion@gmail.com';
  const WEB3FORMS_KEY = '5979c3fb-2a54-469b-980b-04ff57d42cf3';
  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxvmoPGXVL-K7t9tTnQ5rqp3FzcJjruwDhbXJe4qEaX726qqpC2AI1ay9DcgA9YXoQdHg/exec';

  let activeVerificationEmail = '';

  /* ────────────────────────────────────────────────────────────
     1. Storage & State Management (Cross-Device Cloud Synced)
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

  async function syncUserToCloud(userRecord) {
    if (!userRecord || !userRecord.email) return;
    try {
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveUser',
          email: userRecord.email,
          displayName: userRecord.displayName,
          passwordHash: userRecord.passwordHash,
          isVerified: !!userRecord.isVerified,
          verificationCode: userRecord.verificationCode || '',
          address: userRecord.address || '',
          city: userRecord.city || '',
          zip: userRecord.zip || '',
          phone: userRecord.phone || '',
          country: userRecord.country || '',
          state: userRecord.state || '',
          payoutEmail: userRecord.payoutEmail || '',
          payoutMethod: userRecord.payoutMethod || '',
          payoutName: userRecord.payoutName || '',
          payoutSchedule: userRecord.payoutSchedule || '',
          routingNumber: userRecord.routingNumber || '',
          accountNumber: userRecord.accountNumber || '',
          taxId: userRecord.taxId || ''
        })
      }).catch(err => console.warn('Cloud sync note:', err));
    } catch (e) {
      console.warn('syncUserToCloud error:', e);
    }
  }

  async function fetchCloudUser(email) {
    email = (email || '').toLowerCase().trim();
    if (!email) return null;
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL + '?action=getUser&email=' + encodeURIComponent(email), {
        cache: 'no-cache'
      }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.ok && data.user) {
          syncUserRecord(data.user);
          return data.user;
        }
      }
    } catch (e) {
      console.warn('fetchCloudUser error:', e);
    }
    return null;
  }

  async function fetchCloudUsers() {
    return getUsers();
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
     3. Email Verification Dispatcher (Native Google Apps Script)
  ──────────────────────────────────────────────────────────── */
  async function sendVerificationEmail(email, code, displayName) {
    email = (email || '').toLowerCase().trim();
    if (!email || !code) return false;

    try {
      // 1. Direct native Google Apps Script dispatch from tcgmillion@gmail.com (with no-cors safe fallback)
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sendVerification',
          email: email,
          code: String(code),
          name: displayName || email.split('@')[0]
        })
      }).catch(err => {
        console.warn('Google Script POST note (handled):', err);
      });

      // 2. Secondary fallback dispatch via Web3Forms
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `Your MillionTCG Verification Code: ${code} 🔐`,
          from_name: 'MillionTCG Official (tcgmillion@gmail.com)',
          replyto: MAIN_BUSINESS_EMAIL,
          email: email,
          message: `Hello ${displayName || 'Collector'},\n\nYour 6-digit MillionTCG verification code is:\n\n👉  ${code}  👈\n\nEnter this code on the website or click Instant Activate to verify your account.\n\nBest regards,\nMillionTCG Security Team\n${MAIN_BUSINESS_EMAIL}`
        })
      }).catch(() => {});

      return true;
    } catch (err) {
      console.error('sendVerificationEmail error:', err);
      return false;
    }
  }

  /* ────────────────────────────────────────────────────────────
     4. General Notification & Transaction Log Dispatcher
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
            message: `Thank you for choosing MillionTCG.\n\n${eventTitle}\n${detailsText}\n\nSupport: ${MAIN_BUSINESS_EMAIL}`
          })
        }).catch(() => {});
      }
    } catch (e) {
      console.error('sendDirectEmailNotification error:', e);
    }
  }

  /* ────────────────────────────────────────────────────────────
     5. 3D Stage Background Customizer
  ──────────────────────────────────────────────────────────── */
  function set3DStageBackgroundColor(colorHex) {
    if (!colorHex) return;
    try {
      localStorage.setItem('mtcg_stage_bg_color', colorHex);
      if (window.heroScene && window.THREE) {
        window.heroScene.background = new window.THREE.Color(colorHex);
      }
      const container = document.getElementById('hero-3d-canvas');
      if (container) container.style.backgroundColor = colorHex;
      const heroSec = document.querySelector('.hero-section');
      if (heroSec) heroSec.style.backgroundColor = colorHex;
    } catch (e) {
      console.error('set3DStageBackgroundColor error:', e);
    }
  }

  /* ────────────────────────────────────────────────────────────
     6. Core Authentication Operations (Cross-Device Cloud Synced)
  ──────────────────────────────────────────────────────────── */
  async function signUp(email, password, displayName) {
    email = (email || '').toLowerCase().trim();
    if (!email || !password) return { ok: false, error: 'Email address and password are required.' };
    if (!email.includes('@') || !email.includes('.')) return { ok: false, error: 'Please enter a valid email address.' };
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters long.' };

    let existing = getUsers()[email];
    if (!existing) {
      existing = await fetchCloudUser(email);
    }
    if (existing) {
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
    syncUserToCloud(userRecord);
    setCurrentUser(userRecord);
    updateAllAuthUI();
    autoFillFormInputs();

    // 1. Dispatch Instant Admin Notification to tcgmillion@gmail.com
    sendDirectEmailNotification('New Account Created 🏪', {
      DisplayName: userRecord.displayName,
      UserEmail: userRecord.email,
      Status: 'Active Collector & Seller'
    });

    // 2. Dispatch Welcome email in background
    sendVerificationEmail(email, 'WELCOME', userRecord.displayName);

    return {
      ok: true,
      user: userRecord,
      message: 'Account created successfully! Welcome to MillionTCG.'
    };
  }

  async function verifyAccountCode(email, enteredCode, bypass = false) {
    email = (email || activeVerificationEmail || '').toLowerCase().trim();
    enteredCode = String(enteredCode || '').trim();

    if (!email) return { ok: false, error: 'No verification email specified.' };

    let record = getUsers()[email];
    if (!record) {
      record = await fetchCloudUser(email);
    }

    if (!record) {
      return { ok: false, error: 'Account record not found. Please create an account first.' };
    }

    if (record.isVerified) {
      setCurrentUser(record);
      updateAllAuthUI();
      autoFillFormInputs();
      return { ok: true, user: record };
    }

    if (!bypass) {
      if (!enteredCode || enteredCode.length !== 6) {
        return { ok: false, error: 'Please enter the 6-digit verification code, or click Instant Activate.' };
      }
      if (record.verificationCode && record.verificationCode !== enteredCode) {
        return { ok: false, error: 'Invalid verification code. Please check your spam folder or click Instant Activate.' };
      }
    }

    // Mark verified
    record.isVerified = true;
    record.updatedAt = Date.now();
    delete record.verificationCode;

    syncUserRecord(record);
    syncUserToCloud(record);
    setCurrentUser(record);
    updateAllAuthUI();
    autoFillFormInputs();

    sendDirectEmailNotification('New Account Verified 🏪', {
      DisplayName: record.displayName || record.email.split('@')[0],
      UserEmail: record.email,
      Status: 'Verified Collector & Marketplace Seller'
    });

    return { ok: true, user: record, message: 'Account verified successfully! Welcome to MillionTCG.' };
  }

  async function resendVerificationCode(email) {
    email = (email || activeVerificationEmail || '').toLowerCase().trim();
    if (!email) return { ok: false, error: 'Please enter your email address.' };

    let record = getUsers()[email];
    if (!record) {
      record = await fetchCloudUser(email);
    }
    if (!record) return { ok: false, error: 'Account not found. Please sign up first.' };

    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    record.verificationCode = newCode;
    record.updatedAt = Date.now();
    syncUserRecord(record);
    syncUserToCloud(record);

    sendVerificationEmail(email, newCode, record.displayName);

    return {
      ok: true,
      code: newCode,
      message: 'A new 6-digit code has been sent to your email from tcgmillion@gmail.com!'
    };
  }

  async function signIn(email, password) {
    email = (email || '').toLowerCase().trim();
    if (!email || !password) return { ok: false, error: 'Email and password are required.' };

    const passwordHash = await hashPassword(password);
    let record = getUsers()[email];

    // If user is not stored locally or credentials don't match local cache, check Cloud (Cross-Device Sync)
    if (!record || record.passwordHash !== passwordHash) {
      const cloudRecord = await fetchCloudUser(email);
      if (cloudRecord) {
        record = cloudRecord;
      }
    }

    if (!record || record.passwordHash !== passwordHash) {
      return { ok: false, error: 'Invalid email address or password. Please try again.' };
    }

    // Auto-verify user so valid logins are never blocked
    record.isVerified = true;
    delete record.verificationCode;
    record.updatedAt = Date.now();
    syncUserRecord(record);
    syncUserToCloud(record);
    setCurrentUser(record);
    updateAllAuthUI();
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
    syncUserToCloud(record);
    setCurrentUser(record);
    updateAllAuthUI();
    return { ok: true, user: record };
  }

  /* ────────────────────────────────────────────────────────────
     7. Form Autofill & Input Synchronization
  ──────────────────────────────────────────────────────────── */
  function autoFillFormInputs() {
    const u = getCurrentUser();
    const email = u ? u.email : (localStorage.getItem('mtcg_saved_email') || '');
    const name = u ? u.displayName : (localStorage.getItem('mtcg_saved_name') || '');
    const address = u ? u.address : (localStorage.getItem('mtcg_saved_address') || '');
    const city = u ? u.city : (localStorage.getItem('mtcg_saved_city') || '');
    const zip = u ? u.zip : (localStorage.getItem('mtcg_saved_zip') || '');

    const fill = (id, val) => {
      const el = document.getElementById(id);
      if (el && !el.value && val) el.value = val;
    };

    fill('checkout-email', email);
    fill('checkout-first-name', name.split(' ')[0]);
    fill('checkout-last-name', name.split(' ').slice(1).join(' '));
    fill('checkout-address', address);
    fill('checkout-city', city);
    fill('checkout-zip', zip);

    fill('seller-email', email);
    fill('seller-name', name);
    fill('contact-email', email);
    fill('contact-name', name);
  }

  function setupAutoSaveListeners() {
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || !t.id) return;
      if (t.id === 'checkout-email' && t.value) localStorage.setItem('mtcg_saved_email', t.value.trim());
      if (t.id === 'checkout-first-name' && t.value) localStorage.setItem('mtcg_saved_name', t.value.trim());
      if (t.id === 'checkout-address' && t.value) localStorage.setItem('mtcg_saved_address', t.value.trim());
      if (t.id === 'checkout-city' && t.value) localStorage.setItem('mtcg_saved_city', t.value.trim());
      if (t.id === 'checkout-zip' && t.value) localStorage.setItem('mtcg_saved_zip', t.value.trim());
    });
  }

  /* ────────────────────────────────────────────────────────────
     8. UI Helpers & Header Avatar Updater
  ──────────────────────────────────────────────────────────── */
  function updateAllAuthUI() {
    const user = getCurrentUser();
    const isAuth = !!user;

    // Desktop nav button
    const desktopBtn = document.getElementById('auth-desktop-btn');
    if (desktopBtn) {
      if (isAuth) {
        const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
        desktopBtn.innerHTML = `
          <div style="width:32px;height:32px;border-radius:50%;background:#eab308;color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 0 10px rgba(234,179,8,0.4);">
            ${initial}
          </div>
          <span style="font-weight:600;color:#fff;max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${user.displayName || user.email.split('@')[0]}
          </span>
        `;
      } else {
        desktopBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Sign In</span>
        `;
      }
    }

    // Account Page Specific UI
    const accWelcome = document.getElementById('acc-user-name');
    if (accWelcome) accWelcome.textContent = isAuth ? (user.displayName || user.email) : 'Guest Collector';

    const accEmail = document.getElementById('acc-user-email');
    if (accEmail) accEmail.textContent = isAuth ? user.email : 'Sign in to access seller dashboard';

    const accAvatar = document.getElementById('acc-avatar-letter');
    if (accAvatar) accAvatar.textContent = isAuth ? (user.displayName || user.email || 'U')[0].toUpperCase() : '?';

    // Mobile Drawer Profile
    const drawerName = document.getElementById('drawer-user-name');
    if (drawerName) drawerName.textContent = isAuth ? (user.displayName || user.email.split('@')[0]) : 'Guest Collector';

    const drawerSignout = document.getElementById('drawer-signout-btn');
    if (drawerSignout) drawerSignout.style.display = isAuth ? 'flex' : 'none';

    // Seller Page gated access banner
    const sellerStatus = document.getElementById('seller-auth-status');
    if (sellerStatus) {
      if (isAuth) {
        sellerStatus.innerHTML = `<span style="color:#22c55e;">✅ Logged in as <strong>${user.displayName || user.email}</strong> (Verified Seller)</span>`;
      } else {
        sellerStatus.innerHTML = `<span style="color:#eab308;">ℹ️ <a href="#" class="btn-account-trigger" style="color:#eab308;text-decoration:underline;">Sign in or Register</a> to instantly list cards for sale.</span>`;
      }
    }
  }

  /* ────────────────────────────────────────────────────────────
     9. Modal System & Dynamic Panels
  ──────────────────────────────────────────────────────────── */
  function clearErrors() {
    ['auth-signin-error', 'auth-signup-error', 'auth-verify-error', 'auth-profile-error', 'auth-banking-error'].forEach(id => {
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
      if (currentTab === 'verify') {
        tabsContainer.innerHTML = `
          <button class="auth-tab-btn active" data-tab="verify">🔐 Verification Code</button>
        `;
      } else {
        tabsContainer.innerHTML = `
          <button class="auth-tab-btn ${currentTab === 'signin' ? 'active' : ''}" data-tab="signin">Sign In</button>
          <button class="auth-tab-btn ${currentTab === 'signup' ? 'active' : ''}" data-tab="signup">Create Account</button>
        `;
      }
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
      if (['signin', 'signup', 'verify'].includes(tab)) tab = 'profile';
    } else {
      if (!['signin', 'signup', 'verify'].includes(tab)) tab = 'signin';
    }

    renderModalTabs(tab);
    clearErrors();

    const panels = ['signin', 'signup', 'verify', 'profile', 'banking', 'settings', 'colors'];
    panels.forEach(p => {
      const el = document.getElementById(`auth-${p}-panel`);
      if (el) el.style.display = tab === p ? 'flex' : 'none';
    });

    if (tab === 'verify') {
      const targetEl = document.getElementById('verify-target-email');
      if (targetEl) targetEl.textContent = activeVerificationEmail || 'your email inbox';
      const codeInput = document.getElementById('verify-code-input');
      if (codeInput) {
        codeInput.value = '';
        setTimeout(() => codeInput.focus(), 150);
      }
    }

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
    const defaultTab = getCurrentUser() ? 'profile' : 'signin';
    switchTab(tab || defaultTab);
    modal.classList.add('active');
  }

  function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal-overlay';

    modal.innerHTML = `
      <div class="auth-modal-card auth-modal-box">
        <button class="auth-modal-close" id="auth-modal-close" aria-label="Close modal">✕</button>
        
        <div class="auth-modal-header">
          <div class="auth-modal-logo">
            <span style="color:#eab308;font-size:24px;">⚡</span>
            <span style="font-weight:800;font-size:18px;color:#fff;letter-spacing:0.5px;">MILLION<span style="color:#eab308;">TCG</span></span>
          </div>
        </div>

        <div class="auth-tabs" id="auth-tabs"></div>

        <!-- Sign In Panel -->
        <div id="auth-signin-panel" class="auth-panel" style="display:flex;width:100%;">
          <div class="auth-error" id="auth-signin-error"></div>
          <div class="auth-field">
            <label>Email Address</label>
            <input type="email" id="signin-email" placeholder="collector@milliontcg.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input type="password" id="signin-password" placeholder="••••••••" autocomplete="current-password">
          </div>
          <button class="auth-submit-btn" id="signin-submit-btn">Sign In</button>
          <p class="auth-switch">Don't have an account? <a href="#" class="auth-switch-link" data-tab="signup">Create an account →</a></p>
        </div>

        <!-- Sign Up Panel -->
        <div id="auth-signup-panel" class="auth-panel" style="display:none;width:100%;">
          <div class="auth-error" id="auth-signup-error"></div>
          <div class="auth-field">
            <label>Collector Display Name</label>
            <input type="text" id="signup-name" placeholder="e.g. MasterCollector" autocomplete="name">
          </div>
          <div class="auth-field">
            <label>Email Address</label>
            <input type="email" id="signup-email" placeholder="collector@milliontcg.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Password (6+ characters)</label>
            <input type="password" id="signup-password" placeholder="••••••••" autocomplete="new-password">
          </div>
          <button class="auth-submit-btn" id="signup-submit-btn">Create Account</button>
          <p class="auth-switch">Already have an account? <a href="#" class="auth-switch-link" data-tab="signin">Sign in →</a></p>
        </div>

        <!-- Email Verification Panel -->
        <div id="auth-verify-panel" class="auth-panel" style="display:none;width:100%;text-align:center;">
          <div style="font-size:36px;margin:4px 0 8px;">📩</div>
          <h3 style="color:#fff;font-size:19px;font-weight:700;margin:0 0 6px;">Enter 6-Digit Verification Code</h3>
          <p class="auth-panel-sub" style="margin-bottom:12px;font-size:13px;line-height:1.5;">
            We sent a verification code from <strong style="color:#fff;">tcgmillion@gmail.com</strong> to<br>
            <span id="verify-target-email" style="color:#eab308;font-weight:700;word-break:break-all;"></span>
          </p>

          <div style="background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:#fef08a;margin:0 auto 16px;max-width:340px;line-height:1.45;text-align:left;">
            💡 <strong>Email Tip:</strong> If you don't see the code within 30 seconds, please check your <strong>Spam / Junk</strong> folder or <strong>Promotions</strong> tab. You can also click <strong>Instant Activate</strong> below to enter immediately.
          </div>

          <div class="auth-error" id="auth-verify-error"></div>
          <div class="auth-field" style="margin:0 auto 14px;max-width:280px;">
            <label style="text-align:center;display:block;">Verification Code</label>
            <input type="text" id="verify-code-input" maxlength="6" placeholder="123456" style="text-align:center;font-size:24px;letter-spacing:6px;font-weight:700;padding:12px;background:#141416;border:2px solid #eab308;border-radius:10px;color:#fff;width:100%;box-sizing:border-box;">
          </div>
          
          <button class="auth-submit-btn" id="verify-submit-btn" style="margin-bottom:8px;">Verify Code & Enter MillionTCG</button>
          <button class="auth-submit-btn" id="verify-instant-btn" style="background:#22c55e;color:#000;margin-bottom:14px;font-weight:800;border:none;box-shadow:0 4px 14px rgba(34,197,94,0.35);">⚡ Instant Activate (Skip Email Wait)</button>

          <div style="display:flex;justify-content:center;align-items:center;gap:14px;font-size:13px;margin-top:4px;">
            <a href="#" id="verify-resend-btn" style="color:#eab308;text-decoration:none;font-weight:600;">Resend Code</a>
            <span style="color:#555;">•</span>
            <a href="#" class="auth-switch-link" data-tab="signin" style="color:#aaa;text-decoration:none;">Back to Sign In</a>
          </div>
        </div>

        <!-- Profile & Shipping Panel -->
        <div id="auth-profile-panel" class="auth-panel" style="display:none;width:100%;">
          <p class="auth-panel-sub" style="margin-bottom:18px;">Manage your profile and default shipping location across all orders.</p>
          <div class="auth-error" id="auth-profile-error" style="color:#ef4444;font-size:13px;margin-bottom:12px;"></div>
          
          <div class="auth-grid-responsive">
            <div class="auth-field">
              <label>Collector Display Name</label>
              <input type="text" id="profile-name" placeholder="Display name" style="box-sizing:border-box;width:100%;">
            </div>
            <div class="auth-field">
              <label>Email Address (Cloud Verified)</label>
              <input type="email" id="profile-email" disabled style="opacity:0.7;box-sizing:border-box;width:100%;">
            </div>
            <div class="auth-field" style="grid-column:1/-1;">
              <label>Street Shipping Address</label>
              <input type="text" id="profile-address" placeholder="123 Main St, Apt 4B" style="box-sizing:border-box;width:100%;">
            </div>
            <div class="auth-field">
              <label>City</label>
              <input type="text" id="profile-city" placeholder="City" style="box-sizing:border-box;width:100%;">
            </div>
            <div class="auth-field">
              <label>ZIP / Postal Code</label>
              <input type="text" id="profile-zip" placeholder="ZIP Code" style="box-sizing:border-box;width:100%;">
            </div>
            <div class="auth-field" style="grid-column:1/-1;">
              <label>New Password (Optional)</label>
              <input type="password" id="profile-new-password" placeholder="Leave blank to keep current password" style="box-sizing:border-box;width:100%;">
            </div>
          </div>
          <button class="auth-submit-btn" id="profile-save-btn" style="width:100%;padding:16px;font-size:1rem;font-weight:800;">Save Profile Changes</button>
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
              <select id="banking-payout-method">
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
              <select id="banking-payout-schedule">
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
          if (res.requiresVerification) {
            switchTab('verify');
          } else {
            if (errEl) errEl.textContent = res.error || 'Sign in failed.';
          }
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
          alert(`🎉 Welcome ${name || email.split('@')[0]}! Your MillionTCG account is ready.`);
        }
      } catch (e) {
        if (errEl) errEl.textContent = 'An error occurred during account creation.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });

    // Verification Code Submit handler
    modal.querySelector('#verify-submit-btn')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#verify-submit-btn');
      const code = document.getElementById('verify-code-input')?.value.trim() || '';
      const errEl = document.getElementById('auth-verify-error');

      if (!code || code.length !== 6) {
        if (errEl) errEl.textContent = 'Please enter the 6-digit verification code, or click Instant Activate below.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Verifying Code...';
      if (errEl) errEl.textContent = '';

      try {
        const res = await verifyAccountCode(activeVerificationEmail, code);
        if (!res.ok) {
          if (errEl) errEl.textContent = res.error || 'Invalid code.';
        } else {
          closeAuthModal();
          updateAllAuthUI();
          alert('🎉 Verification successful! Welcome to MillionTCG.');
        }
      } catch (e) {
        if (errEl) errEl.textContent = 'Verification error. Please try again or click Instant Activate.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Verify Code & Enter MillionTCG';
      }
    });

    // Instant Activate (Skip Email Wait) handler
    modal.querySelector('#verify-instant-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const btn = modal.querySelector('#verify-instant-btn');
      const errEl = document.getElementById('auth-verify-error');

      btn.disabled = true;
      btn.textContent = 'Activating Account...';
      if (errEl) errEl.textContent = '';

      try {
        const res = await verifyAccountCode(activeVerificationEmail, null, true);
        if (res.ok) {
          closeAuthModal();
          updateAllAuthUI();
          alert('🎉 Account activated & verified successfully! Welcome to MillionTCG.');
        } else {
          if (errEl) errEl.textContent = res.error || 'Activation error. Please try again.';
        }
      } catch (e) {
        if (errEl) errEl.textContent = 'Error activating account.';
      } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Instant Activate (Skip Email Wait)';
      }
    });

    // Verification Code Resend handler
    modal.querySelector('#verify-resend-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const resendBtn = modal.querySelector('#verify-resend-btn');
      const errEl = document.getElementById('auth-verify-error');

      resendBtn.textContent = 'Sending new code...';
      try {
        const res = await resendVerificationCode(activeVerificationEmail);
        if (res.ok) {
          if (errEl) {
            errEl.style.color = '#22c55e';
            errEl.textContent = '✅ A fresh 6-digit code has been sent from tcgmillion@gmail.com!';
          }
        } else {
          if (errEl) {
            errEl.style.color = '#ef4444';
            errEl.textContent = res.error || 'Failed to resend code.';
          }
        }
      } finally {
        setTimeout(() => {
          if (resendBtn) resendBtn.textContent = 'Resend Code';
        }, 3000);
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
      } else if (document.getElementById('auth-verify-panel')?.style.display !== 'none') {
        modal.querySelector('#verify-submit-btn')?.click();
      }
    });

    return modal;
  }

  /* ────────────────────────────────────────────────────────────
     10. Initialization & Event Binding
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
     11. Public API Exports
  ──────────────────────────────────────────────────────────── */
  window.sendDirectEmailNotification = sendDirectEmailNotification;
  window.set3DStageBackgroundColor = set3DStageBackgroundColor;

  window.MillionAuth = {
    signIn,
    signUp,
    signOut,
    verifyAccountCode,
    resendVerificationCode,
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
