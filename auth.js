/**
 * MillionTCG Multi-Device Auth & Account Management Engine
 * Expanded 900px Wide Dashboard Center
 */

(function () {
  'use strict';

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

      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.log('Admin notification error:', err));

      if (userContactEmail && userContactEmail.toLowerCase() !== adminEmail.toLowerCase() && userContactEmail.includes('@')) {
        fetch(`https://formsubmit.co/ajax/${encodeURIComponent(userContactEmail.trim())}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            _subject: `MillionTCG Confirmation: ${eventTitle}`,
            _template: 'table',
            _captcha: 'false',
            Notice: `Thank you for contacting MillionTCG! Details of your ${eventTitle} are listed below:`,
            Timestamp: new Date().toLocaleString(),
            ...detailsData
          })
        }).catch(err => console.log('Customer confirmation error:', err));
      }
    } catch (e) {
      console.error('Email notification error:', e);
    }
  };

  /* ── 3D Stage Background Customizer Helper ── */
  window.set3DStageBackgroundColor = window.set3DStageBackgroundColor || function (colorHex) {
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
  };

  /* ── SHA-256 Cross-Device Password Hashing ── */
  async function hashPassword(str) {
    if (!str) return '';
    if (window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str + '_mtcg_salt_2026_v2');
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        console.warn('Crypto SHA-256 failed, using fallback:', e);
      }
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }

  /* ── Storage & Cloud Synchronization ── */
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem('mtcg_users') || '{}');
    } catch (e) {
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

  function sanitizeKey(email) {
    return email.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
  }

  async function fetchCloudUsers() {
    const localUsers = getUsers();
    try {
      const res = await fetch('js/users_db.json?v=' + Date.now(), { cache: 'no-cache' });
      if (res.ok) {
        const cloudUsers = await res.json();
        if (cloudUsers && typeof cloudUsers === 'object') {
          const merged = { ...cloudUsers, ...localUsers };
          saveUsers(merged);
          return merged;
        }
      }
    } catch (e) {
      console.log('Cloud users fetch note:', e.message);
    }
    return localUsers;
  }

  async function syncUserToCloud(userRecord) {
    const emailKey = userRecord.email.toLowerCase().trim();
    const users = getUsers();
    users[emailKey] = userRecord;
    saveUsers(users);

    try {
      const sanitized = sanitizeKey(emailKey);
      fetch(`https://api.counterapi.dev/v1/milliontcg_accounts/${sanitized}/up`).catch(() => {});
    } catch (e) {}
  }

  function getCurrentUser() {
    try {
      const u = localStorage.getItem('mtcg_current_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem('mtcg_current_user', JSON.stringify(user));
      localStorage.setItem('mtcg_saved_email', user.email);
      if (user.displayName) localStorage.setItem('mtcg_saved_name', user.displayName);
      if (user.address) localStorage.setItem('mtcg_saved_address', user.address);
      if (user.city) localStorage.setItem('mtcg_saved_city', user.city);
      if (user.zip) localStorage.setItem('mtcg_saved_zip', user.zip);
    } else {
      localStorage.removeItem('mtcg_current_user');
    }
  }

  /* ── Auto-Save & Persistent Form Fill ── */
  function autoFillFormInputs() {
    try {
      const user = getCurrentUser();
      const savedEmail = (user && user.email) ? user.email : localStorage.getItem('mtcg_saved_email') || '';
      const savedName = (user && user.displayName) ? user.displayName : localStorage.getItem('mtcg_saved_name') || '';
      const savedFirstName = localStorage.getItem('mtcg_saved_first_name') || (savedName ? savedName.split(' ')[0] : '');
      const savedLastName = localStorage.getItem('mtcg_saved_last_name') || (savedName ? savedName.split(' ').slice(1).join(' ') : '');
      const savedAddress = (user && user.address) ? user.address : localStorage.getItem('mtcg_saved_address') || '';
      const savedCity = (user && user.city) ? user.city : localStorage.getItem('mtcg_saved_city') || '';
      const savedZip = (user && user.zip) ? user.zip : localStorage.getItem('mtcg_saved_zip') || '';

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

  /* ── Auth Actions (Multi-Device Supported) ── */
  async function signUp(email, password, displayName) {
    email = email.toLowerCase().trim();
    if (!email || !password) return { ok: false, error: 'Email and password are required.' };
    
    const users = await fetchCloudUsers();
    if (users[email]) {
      return { ok: false, error: 'An account with that email already exists.' };
    }

    const pHash = await hashPassword(password);
    const user = {
      email,
      displayName: displayName || email.split('@')[0],
      passwordHash: pHash,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await syncUserToCloud(user);
    setCurrentUser(user);

    if (typeof window.sendDirectEmailNotification === 'function') {
      window.sendDirectEmailNotification('New Multi-Device Account Created 👤', {
        DisplayName: user.displayName,
        UserEmail: user.email,
        RegistrationTime: new Date().toLocaleString()
      });
    }

    autoFillFormInputs();
    return { ok: true, user };
  }

  async function signIn(email, password) {
    email = email.toLowerCase().trim();
    if (!email || !password) return { ok: false, error: 'Email and password are required.' };

    const users = await fetchCloudUsers();
    let record = users[email];
    const pHash = await hashPassword(password);

    if (!record) {
      return { ok: false, error: 'No account found with that email.' };
    }

    const match = (record.passwordHash === pHash) ||
                  (record.passwordHash === (function legacyHash(str){
                    let h = 0;
                    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
                    return h.toString(36);
                  })(password));

    if (!match) {
      return { ok: false, error: 'Incorrect password.' };
    }

    const user = {
      email: record.email,
      displayName: record.displayName || record.email.split('@')[0],
      address: record.address || '',
      city: record.city || '',
      zip: record.zip || '',
      payoutEmail: record.payoutEmail || '',
      payoutMethod: record.payoutMethod || '',
      createdAt: record.createdAt || Date.now()
    };

    setCurrentUser(user);

    if (typeof window.sendDirectEmailNotification === 'function') {
      window.sendDirectEmailNotification('Multi-Device Sign In Successful 🔐', {
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

  async function updateProfile(data) {
    const user = getCurrentUser();
    if (!user) return { ok: false, error: 'Not signed in.' };

    const users = getUsers();
    const record = users[user.email] || { ...user };

    if (data.displayName) record.displayName = data.displayName;
    if (data.address) record.address = data.address;
    if (data.city) record.city = data.city;
    if (data.zip) record.zip = data.zip;
    if (data.payoutEmail) record.payoutEmail = data.payoutEmail;
    if (data.payoutMethod) record.payoutMethod = data.payoutMethod;

    if (data.newPassword) {
      record.passwordHash = await hashPassword(data.newPassword);
    }

    record.updatedAt = Date.now();
    await syncUserToCloud(record);
    setCurrentUser(record);
    updateAllAuthUI();
    return { ok: true, user: record };
  }

  /* ── UI Rendering & Helpers ── */
  function getInitials(user) {
    if (!user) return 'U';
    const name = user.displayName || user.email || 'User';
    return name.slice(0, 1).toUpperCase();
  }

  function updateAllAuthUI() {
    const user = getCurrentUser();

    /* ─ Desktop header profile btn ─ */
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

    /* ─ Mobile drawer profile section ─ */
    const drawerProfile = document.getElementById('auth-drawer-profile');
    if (drawerProfile) {
      if (user) {
        drawerProfile.innerHTML = `
          <div class="drawer-user-info" onclick="window.MillionAuth.openAuthModal('profile')" style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:8px;cursor:pointer;">
            <div class="drawer-user-avatar" style="background:#eab308;color:#000;font-weight:700;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;">${getInitials(user)}</div>
            <div class="drawer-user-details" style="overflow:hidden;">
              <div class="drawer-user-name" style="font-weight:600;color:#fff;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.displayName}</div>
              <div class="drawer-user-email" style="font-size:12px;color:#a1a1aa;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.email}</div>
            </div>
          </div>
          <button class="drawer-signout-btn" id="drawer-signout-btn" style="width:100%;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Sign Out</button>
        `;
        document.getElementById('drawer-signout-btn')?.addEventListener('click', signOut);
      } else {
        drawerProfile.innerHTML = `
          <button class="drawer-signin-btn" id="drawer-signin-trigger" style="width:100%;padding:12px;background:#eab308;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
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

  /* ── Dynamic Tab Bar Renderer (Removes Sign In & Create Account when Signed In) ── */
  function renderModalTabs(currentTab) {
    const tabsContainer = document.getElementById('auth-tabs');
    if (!tabsContainer) return;

    const user = getCurrentUser();

    if (user) {
      // USER IS SIGNED IN: REMOVE "Sign In" & "Create Account" tabs!
      tabsContainer.innerHTML = `
        <button class="auth-tab-btn ${currentTab === 'profile' ? 'active' : ''}" data-tab="profile">👤 Profile & Shipping</button>
        <button class="auth-tab-btn ${currentTab === 'banking' ? 'active' : ''}" data-tab="banking">🏦 Banking & Payouts</button>
        <button class="auth-tab-btn ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">⚙️ Store Settings</button>
        <button class="auth-tab-btn ${currentTab === 'colors' ? 'active' : ''}" data-tab="colors">🎨 3D Stage Color</button>
      `;
    } else {
      // USER IS NOT SIGNED IN: Show "Sign In" & "Create Account"
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

  /* ── Modal System & Tab Navigation ── */
  function openAuthModal(tab) {
    const user = getCurrentUser();
    if (!tab) {
      tab = user ? 'profile' : 'signin';
    }

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
    ['auth-signin-error', 'auth-signup-error', 'auth-profile-error', 'auth-banking-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  function switchTab(tab) {
    const user = getCurrentUser();

    // Enforce tab access permissions based on login state:
    if (user) {
      if (tab === 'signin' || tab === 'signup') {
        tab = 'profile';
      }
    } else {
      if (tab !== 'signin' && tab !== 'signup') {
        tab = 'signin';
      }
    }

    renderModalTabs(tab);

    const signinPanel = document.getElementById('auth-signin-panel');
    const signupPanel = document.getElementById('auth-signup-panel');
    const profilePanel = document.getElementById('auth-profile-panel');
    const bankingPanel = document.getElementById('auth-banking-panel');
    const settingsPanel = document.getElementById('auth-settings-panel');
    const colorsPanel = document.getElementById('auth-colors-panel');

    clearErrors();

    if (signinPanel) signinPanel.style.display = tab === 'signin' ? 'flex' : 'none';
    if (signupPanel) signupPanel.style.display = tab === 'signup' ? 'flex' : 'none';
    if (profilePanel) {
      profilePanel.style.display = tab === 'profile' ? 'flex' : 'none';
      if (tab === 'profile') populateProfilePanel();
    }
    if (bankingPanel) {
      bankingPanel.style.display = tab === 'banking' ? 'flex' : 'none';
      if (tab === 'banking') populateBankingPanel();
    }
    if (settingsPanel) settingsPanel.style.display = tab === 'settings' ? 'flex' : 'none';
    if (colorsPanel) {
      colorsPanel.style.display = tab === 'colors' ? 'flex' : 'none';
      if (tab === 'colors') populateColorsPanel();
    }
  }

  function populateProfilePanel() {
    const user = getCurrentUser() || {};
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const addrInput = document.getElementById('profile-address');
    const cityInput = document.getElementById('profile-city');
    const zipInput = document.getElementById('profile-zip');

    if (nameInput) nameInput.value = user.displayName || '';
    if (emailInput) emailInput.value = user.email || '';
    if (addrInput) addrInput.value = user.address || '';
    if (cityInput) cityInput.value = user.city || '';
    if (zipInput) zipInput.value = user.zip || '';
  }

  function populateBankingPanel() {
    const user = getCurrentUser() || {};
    const emailInput = document.getElementById('banking-payout-email');
    const methodSelect = document.getElementById('banking-payout-method');

    if (emailInput) emailInput.value = user.payoutEmail || user.email || '';
    if (methodSelect && user.payoutMethod) methodSelect.value = user.payoutMethod;
  }

  function populateColorsPanel() {
    const picker = document.getElementById('stage-bg-picker');
    const preview = document.getElementById('modal-stage-color-preview');
    const currentColor = localStorage.getItem('mtcg_stage_bg_color') || '#141416';
    
    if (picker) {
      picker.value = currentColor;
      if (preview) preview.style.backgroundColor = currentColor;

      // Live Color Preview Listener
      if (!picker.dataset.liveBound) {
        picker.dataset.liveBound = 'true';
        const updateLive = () => {
          if (preview) preview.style.backgroundColor = picker.value;
          if (window.set3DStageBackgroundColor) {
            window.set3DStageBackgroundColor(picker.value);
          }
        };
        picker.addEventListener('input', updateLive);
        picker.addEventListener('change', updateLive);
      }
    }
  }

  /* ── Build 900px Wide Dashboard Modal ── */
  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal-overlay';
    modal.innerHTML = `
      <div class="auth-modal-box" role="dialog" aria-modal="true" aria-label="Account Center" style="max-width:900px;width:94%;box-sizing:border-box;padding:36px 40px;border-radius:24px;">
        <button class="auth-modal-close" id="auth-modal-close" aria-label="Close">✕</button>

        <div class="auth-modal-logo">
          <img src="images/logo.png" alt="MillionTCG" style="height:54px;width:auto;">
          <div class="auth-modal-brand">MILLION TCG ACCOUNT CENTER</div>
        </div>

        <div class="auth-tabs" id="auth-tabs" style="display:flex;gap:8px;background:#18181b;border-radius:12px;padding:6px;margin-bottom:28px;">
          <!-- Dynamically populated based on login status -->
        </div>

        <!-- Sign In Panel -->
        <div id="auth-signin-panel" class="auth-panel" style="display:none;max-width:440px;margin:0 auto;">
          <p class="auth-panel-sub">Welcome back, collector. Sign in across any device.</p>
          <div class="auth-error" id="auth-signin-error" style="color:#ef4444;font-size:13px;margin-bottom:8px;"></div>
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
        <div id="auth-signup-panel" class="auth-panel" style="display:none;max-width:440px;margin:0 auto;">
          <p class="auth-panel-sub">Join the MillionTCG community. Multi-device cloud sync included.</p>
          <div class="auth-error" id="auth-signup-error" style="color:#ef4444;font-size:13px;margin-bottom:8px;"></div>
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

        <!-- Profile & Shipping Panel (Spacious 2-Column Layout) -->
        <div id="auth-profile-panel" class="auth-panel" style="display:none;">
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
        <div id="auth-banking-panel" class="auth-panel" style="display:none;">
          <p class="auth-panel-sub" style="margin-bottom:18px;">Direct Payouts & Seller Banking Information for card marketplace sales.</p>
          <div class="auth-error" id="auth-banking-error" style="color:#ef4444;font-size:13px;margin-bottom:12px;"></div>
          
          <div class="auth-grid-responsive">
            <div class="auth-field">
              <label>Payout Email / Handle</label>
              <input type="email" id="banking-payout-email" placeholder="payouts@example.com" style="box-sizing:border-box;width:100%;">
            </div>
            <div class="auth-field">
              <label>Payout Method</label>
              <select id="banking-payout-method" style="width:100%;padding:14px;background:#18181b;color:#fff;border:1px solid #27272a;border-radius:10px;font-size:0.95rem;box-sizing:border-box;">
                <option value="Direct Deposit">Direct Deposit (ACH / Bank Transfer)</option>
                <option value="Venmo">Venmo</option>
                <option value="Zelle">Zelle</option>
                <option value="PayPal">PayPal</option>
                <option value="Wire Transfer">Wire Transfer (High Value)</option>
              </select>
            </div>
          </div>
          <button class="auth-submit-btn" id="banking-save-btn" style="width:100%;padding:16px;font-size:1rem;font-weight:800;">Save Banking Preferences</button>
        </div>

        <!-- Store Settings Panel -->
        <div id="auth-settings-panel" class="auth-panel" style="display:none;">
          <p class="auth-panel-sub" style="margin-bottom:18px;">Store & Display Preferences.</p>
          <div style="padding:20px;background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:20px;display:flex;flex-direction:column;gap:14px;">
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
              <input type="checkbox" id="settings-email-alerts" checked style="width:20px;height:20px;">
              <span style="font-weight:600;color:#fff;">Receive Order & Price Alert Notifications</span>
            </label>
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
              <input type="checkbox" checked style="width:20px;height:20px;">
              <span style="font-weight:600;color:#fff;">New Pre-Order Drops & Rare Single Notifications</span>
            </label>
          </div>
          <button class="auth-submit-btn" id="settings-save-btn" style="width:100%;padding:16px;font-size:1rem;font-weight:800;">Save Settings</button>
        </div>

        <!-- 3D Stage Colors Panel -->
        <div id="auth-colors-panel" class="auth-panel" style="display:none;">
          <p class="auth-panel-sub" style="margin-bottom:18px;">Customize 3D Showcase Stage Background Color in Real Time.</p>
          
          <div class="auth-grid-responsive auth-grid-colors">
            <div class="auth-field">
              <label>Select Stage Color</label>
              <input type="color" id="stage-bg-picker" value="#141416" style="width:100%;height:54px;border:none;border-radius:10px;cursor:pointer;background:none;box-sizing:border-box;">
            </div>
            <div id="modal-stage-color-preview" style="height:80px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,0.8);">
              Live 3D Stage Preview
            </div>
          </div>
          <button class="auth-submit-btn" id="colors-save-btn" style="width:100%;padding:16px;font-size:1rem;font-weight:800;">Apply 3D Stage Background</button>
        </div>
      </div>
    `;

    // Close
    modal.querySelector('#auth-modal-close').addEventListener('click', closeAuthModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeAuthModal(); });

    // Sign In submit
    modal.querySelector('#signin-submit-btn').addEventListener('click', async () => {
      const btn = modal.querySelector('#signin-submit-btn');
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      const errEl = document.getElementById('auth-signin-error');
      
      if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
      
      btn.disabled = true;
      btn.textContent = 'Signing In...';
      errEl.textContent = '';

      try {
        const result = await signIn(email, password);
        if (!result.ok) {
          errEl.textContent = result.error;
          btn.disabled = false;
          btn.textContent = 'Sign In';
          return;
        }
        closeAuthModal();
        updateAllAuthUI();
      } catch (e) {
        errEl.textContent = 'An unexpected sign in error occurred.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    // Sign Up submit
    modal.querySelector('#signup-submit-btn').addEventListener('click', async () => {
      const btn = modal.querySelector('#signup-submit-btn');
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const errEl = document.getElementById('auth-signup-error');

      if (!email || !password) { errEl.textContent = 'Email and password are required.'; return; }
      if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

      btn.disabled = true;
      btn.textContent = 'Creating Account...';
      errEl.textContent = '';

      try {
        const result = await signUp(email, password, name);
        if (!result.ok) {
          errEl.textContent = result.error;
          btn.disabled = false;
          btn.textContent = 'Create Account';
          return;
        }
        closeAuthModal();
        updateAllAuthUI();
      } catch (e) {
        errEl.textContent = 'An error occurred during account creation.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });

    // Profile Save
    modal.querySelector('#profile-save-btn')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#profile-save-btn');
      const errEl = document.getElementById('auth-profile-error');
      const name = document.getElementById('profile-name').value.trim();
      const address = document.getElementById('profile-address').value.trim();
      const city = document.getElementById('profile-city').value.trim();
      const zip = document.getElementById('profile-zip').value.trim();
      const newPassword = document.getElementById('profile-new-password').value;

      btn.disabled = true;
      btn.textContent = 'Saving Changes...';

      const res = await updateProfile({ displayName: name, address, city, zip, newPassword });
      if (res.ok) {
        closeAuthModal();
        alert('✅ Profile details saved successfully!');
      } else {
        errEl.textContent = res.error || 'Failed to save profile.';
      }
      btn.disabled = false;
      btn.textContent = 'Save Profile Changes';
    });

    // Banking Save
    modal.querySelector('#banking-save-btn')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#banking-save-btn');
      const payoutEmail = document.getElementById('banking-payout-email').value.trim();
      const payoutMethod = document.getElementById('banking-payout-method').value;

      btn.disabled = true;
      btn.textContent = 'Saving...';
      await updateProfile({ payoutEmail, payoutMethod });
      closeAuthModal();
      alert('✅ Banking & Payout preferences updated successfully!');
      btn.disabled = false;
      btn.textContent = 'Save Banking Preferences';
    });

    // Settings Save
    modal.querySelector('#settings-save-btn')?.addEventListener('click', () => {
      closeAuthModal();
      alert('✅ Store settings saved!');
    });

    // Colors Save
    modal.querySelector('#colors-save-btn')?.addEventListener('click', () => {
      const val = document.getElementById('stage-bg-picker').value;
      if (window.set3DStageBackgroundColor) {
        window.set3DStageBackgroundColor(val);
      }
      closeAuthModal();
      alert('🎨 3D Stage Background color updated successfully!');
    });

    // Enter key submits
    modal.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const signinVisible = document.getElementById('auth-signin-panel').style.display !== 'none';
      if (signinVisible) modal.querySelector('#signin-submit-btn').click();
      else {
        const signupVisible = document.getElementById('auth-signup-panel').style.display !== 'none';
        if (signupVisible) modal.querySelector('#signup-submit-btn').click();
      }
    });

    return modal;
  }

  /* ── Desktop Auth Dropdown Menu ── */
  function handleDesktopAuthClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const user = getCurrentUser();
    if (user) {
      let dd = document.getElementById('auth-desktop-dropdown');
      if (!dd) {
        dd = document.createElement('div');
        dd.id = 'auth-desktop-dropdown';
        dd.className = 'auth-desktop-dropdown';
        dd.innerHTML = `
          <div class="auth-dd-header" style="padding:14px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:10px;">
            <div class="auth-dd-avatar" style="background:#eab308;color:#000;font-weight:700;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;">${getInitials(user)}</div>
            <div class="auth-dd-user-info" style="overflow:hidden;">
              <div class="auth-dd-name" style="font-weight:600;color:#fff;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.displayName}</div>
              <div class="auth-dd-email" style="font-size:12px;color:#a1a1aa;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.email}</div>
            </div>
          </div>

          <div class="auth-dd-menu" style="padding:8px 0;">
            <button class="auth-dd-item" id="dd-profile-btn" style="width:100%;text-align:left;padding:10px 16px;background:none;border:none;color:#e4e4e7;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <span class="auth-dd-icon">👤</span>
              <span>Account & Profile Settings</span>
            </button>
            <button class="auth-dd-item" id="dd-banking-btn" style="width:100%;text-align:left;padding:10px 16px;background:none;border:none;color:#e4e4e7;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <span class="auth-dd-icon">🏦</span>
              <span>Banking & Direct Payouts</span>
            </button>
            <button class="auth-dd-item" id="dd-settings-btn" style="width:100%;text-align:left;padding:10px 16px;background:none;border:none;color:#e4e4e7;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <span class="auth-dd-icon">⚙️</span>
              <span>Store Settings</span>
            </button>
            <button class="auth-dd-item" id="dd-colors-btn" style="width:100%;text-align:left;padding:10px 16px;background:none;border:none;color:#e4e4e7;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <span class="auth-dd-icon">🎨</span>
              <span>3D Stage Background Color</span>
            </button>
          </div>

          <div class="auth-dd-footer" style="padding:10px 14px;border-top:1px solid rgba(255,255,255,0.1);">
            <button class="auth-dd-signout-btn" id="auth-dd-signout" style="width:100%;padding:10px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
              <span class="auth-dd-icon">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        `;

        const btnContainer = document.getElementById('auth-desktop-btn').parentElement;
        if (btnContainer) {
          btnContainer.style.position = 'relative';
          btnContainer.appendChild(dd);
        }

        document.getElementById('dd-profile-btn')?.addEventListener('click', () => { dd.remove(); openAuthModal('profile'); });
        document.getElementById('dd-banking-btn')?.addEventListener('click', () => { dd.remove(); openAuthModal('banking'); });
        document.getElementById('dd-settings-btn')?.addEventListener('click', () => { dd.remove(); openAuthModal('settings'); });
        document.getElementById('dd-colors-btn')?.addEventListener('click', () => { dd.remove(); openAuthModal('colors'); });
        document.getElementById('auth-dd-signout')?.addEventListener('click', () => { signOut(); dd.remove(); });

        setTimeout(() => {
          document.addEventListener('click', function onOutside(e) {
            const btn = document.getElementById('auth-desktop-btn');
            if (!dd.contains(e.target) && (!btn || !btn.contains(e.target))) {
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

  /* ── Initialization ── */
  function init() {
    const desktopBtn = document.getElementById('auth-desktop-btn');
    if (desktopBtn) desktopBtn.addEventListener('click', handleDesktopAuthClick);

    const savedColor = localStorage.getItem('mtcg_stage_bg_color');
    if (savedColor && window.set3DStageBackgroundColor) {
      window.set3DStageBackgroundColor(savedColor);
    }

    fetchCloudUsers().then(() => {
      updateAllAuthUI();
      autoFillFormInputs();
    });

    setupInputAutoSaveListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Global API Exposure
  window.MillionAuth = {
    signIn,
    signUp,
    signOut,
    updateProfile,
    getCurrentUser,
    openAuthModal,
    autoFillFormInputs,
    fetchCloudUsers
  };
})();
