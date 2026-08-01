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
      // Extra persistence: also remember login state flag
      localStorage.setItem('mtcg_logged_in', '1');
    } else {
      localStorage.removeItem('mtcg_current_user');
      localStorage.removeItem('mtcg_logged_in');
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

  function checkAuthGate() {
    const user = getCurrentUser();
    const body = document.body;
    if (!user) {
      body.classList.add('auth-locked');
      openAuthModal('signin');
      const backBtn = document.getElementById('auth-modal-back-btn');
      const closeBtn = document.getElementById('auth-modal-close');
      if (backBtn) backBtn.style.display = 'none';
      if (closeBtn) closeBtn.style.display = 'none';
    } else {
      body.classList.remove('auth-locked');
      const backBtn = document.getElementById('auth-modal-back-btn');
      const closeBtn = document.getElementById('auth-modal-close');
      if (backBtn) backBtn.style.display = 'flex';
      if (closeBtn) closeBtn.style.display = 'block';
    }
  }

  function signOut() {
    setCurrentUser(null);
    updateAllAuthUI();
    checkAuthGate();
  }

  /* ── UI rendering ── */
  function getInitials(user) {
    const name = user ? (user.displayName || user.email) : 'C';
    return name.slice(0, 1).toUpperCase();
  }

  function updateAllAuthUI() {
    const user = getCurrentUser();
    updateModalTabsVisibility();

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

  function updateModalTabsVisibility() {
    const user = getCurrentUser();
    const signinTabBtn = document.querySelector('.auth-tab-btn[data-tab="signin"]');
    const signupTabBtn = document.querySelector('.auth-tab-btn[data-tab="signup"]');
    const profileTabBtn = document.querySelector('.auth-tab-btn[data-tab="profile"]');
    const bankingTabBtn = document.querySelector('.auth-tab-btn[data-tab="banking"]');
    const settingsTabBtn = document.querySelector('.auth-tab-btn[data-tab="settings"]');
    const colorsTabBtn = document.querySelector('.auth-tab-btn[data-tab="colors"]');

    if (user) {
      if (signinTabBtn) signinTabBtn.style.display = 'none';
      if (signupTabBtn) signupTabBtn.style.display = 'none';
      if (profileTabBtn) profileTabBtn.style.display = 'inline-flex';
      if (bankingTabBtn) bankingTabBtn.style.display = 'inline-flex';
      if (settingsTabBtn) settingsTabBtn.style.display = 'inline-flex';
      if (colorsTabBtn) colorsTabBtn.style.display = 'inline-flex';
    } else {
      if (signinTabBtn) signinTabBtn.style.display = 'inline-flex';
      if (signupTabBtn) signupTabBtn.style.display = 'inline-flex';
      if (profileTabBtn) profileTabBtn.style.display = 'none';
      if (bankingTabBtn) bankingTabBtn.style.display = 'none';
      if (settingsTabBtn) settingsTabBtn.style.display = 'none';
      if (colorsTabBtn) colorsTabBtn.style.display = 'none';
    }
  }

  /* ── Modal ── */
  function openAuthModal(tab = 'signin') {
    const user = getCurrentUser();
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
    }
    modal.classList.add('active');

    if (user && (tab === 'signin' || tab === 'signup')) {
      tab = 'profile';
    } else if (!user && (tab === 'profile' || tab === 'banking' || tab === 'settings' || tab === 'colors')) {
      tab = 'signin';
    }

    updateModalTabsVisibility();
    switchTab(tab);
    populateProfileFields();
    checkAuthGate();
  }

  function closeAuthModal() {
    const user = getCurrentUser();
    if (!user) {
      // Must be signed in to dismiss auth modal
      return;
    }
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

  function apply3DBackgroundColor(hexColor) {
    if (!hexColor) return;
    localStorage.setItem('mtcg_3d_bg_color', hexColor);
    if (typeof window.update3DBackgroundColor === 'function') {
      window.update3DBackgroundColor(hexColor);
    }
  }

  function populateProfileFields() {
    const user = getCurrentUser();
    const banking = getBankingInfo();
    const saved3DColor = localStorage.getItem('mtcg_3d_bg_color') || '#141416';

    // Profile Name & Email
    const nameInput = document.getElementById('profile-display-name');
    const emailInput = document.getElementById('profile-display-email');
    if (nameInput) nameInput.value = (user && user.displayName) ? user.displayName : localStorage.getItem('mtcg_saved_name') || '';
    if (emailInput) emailInput.value = (user && user.email) ? user.email : localStorage.getItem('mtcg_saved_email') || '';

    // Banking fields
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

    // Earnings stats
    const listings = JSON.parse(localStorage.getItem('mtcg_community_listings') || '[]');
    const myListings = user ? listings.filter(l => l.sellerEmail === user.email) : [];
    const grossSales = myListings.reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0);
    const platformCut = grossSales * 0.10;
    const netPayout = grossSales * 0.90;
    const grossEl = document.getElementById('profile-gross-sales');
    const cutEl = document.getElementById('profile-platform-cut');
    const netEl = document.getElementById('profile-net-payout');
    const countEl = document.getElementById('profile-listing-count');
    if (grossEl) grossEl.textContent = '$' + grossSales.toFixed(2);
    if (cutEl) cutEl.textContent = '-$' + platformCut.toFixed(2);
    if (netEl) netEl.textContent = '$' + netPayout.toFixed(2);
    if (countEl) countEl.textContent = myListings.length;

    // 3D Color Picker input
    const colorPicker = document.getElementById('profile-3d-color-picker');
    if (colorPicker) colorPicker.value = saved3DColor.startsWith('#') ? saved3DColor : '#141416';

    apply3DBackgroundColor(saved3DColor);
  }

  function switchTab(tab) {
    const signinPanel = document.getElementById('auth-signin-panel');
    const signupPanel = document.getElementById('auth-signup-panel');
    const profilePanel = document.getElementById('auth-profile-panel');
    const bankingPanel = document.getElementById('auth-banking-panel');
    const settingsPanel = document.getElementById('auth-settings-panel');
    const colorsPanel = document.getElementById('auth-colors-panel');
    const tabs = document.querySelectorAll('.auth-tab-btn');
    clearErrors();
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    if (signinPanel) signinPanel.style.display = tab === 'signin' ? 'flex' : 'none';
    if (signupPanel) signupPanel.style.display = tab === 'signup' ? 'flex' : 'none';
    if (profilePanel) profilePanel.style.display = tab === 'profile' ? 'flex' : 'none';
    if (bankingPanel) bankingPanel.style.display = tab === 'banking' ? 'flex' : 'none';
    if (settingsPanel) settingsPanel.style.display = tab === 'settings' ? 'flex' : 'none';
    if (colorsPanel) colorsPanel.style.display = tab === 'colors' ? 'flex' : 'none';
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal-overlay';
    modal.innerHTML = `
      <div class="auth-modal-box profile-modal-box" role="dialog" aria-modal="true" aria-label="Account & Profile Settings">
        
        <!-- Modal Top Bar with Back Button -->
        <div class="auth-modal-top-bar" style="display:flex; justify-content:space-between; align-items:center; width:100%; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px; margin-bottom:8px;">
          <button class="auth-modal-back-btn" id="auth-modal-back-btn" type="button" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:6px 14px; border-radius:8px; font-weight:700; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
            ← Back to Store
          </button>

          <div class="auth-modal-logo" style="display:flex; align-items:center; gap:8px;">
            <img src="images/logo.png" alt="MillionTCG" style="height:32px;width:auto;">
            <div class="auth-modal-brand" style="font-weight:900; font-size:0.95rem; letter-spacing:1px;">MILLION TCG HUB</div>
          </div>

          <button class="auth-modal-close" id="auth-modal-close" aria-label="Close" style="background:none; border:none; color:#aaa; font-size:1.2rem; cursor:pointer; padding:4px 8px;">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="auth-tabs" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
          <button class="auth-tab-btn" data-tab="signin">Sign In</button>
          <button class="auth-tab-btn" data-tab="signup">Create Account</button>
          <button class="auth-tab-btn active" data-tab="profile">Profile & Earnings 👤</button>
          <button class="auth-tab-btn" data-tab="banking">Banking Payouts 🏦</button>
          <button class="auth-tab-btn" data-tab="settings">Settings & Layout ⚙️</button>
          <button class="auth-tab-btn" data-tab="colors">3D Background Color 🎨</button>
        </div>

        <!-- Sign In Panel -->
        <div id="auth-signin-panel" class="auth-panel" style="display:none; flex-direction:column; gap:12px;">
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
        <div id="auth-signup-panel" class="auth-panel" style="display:none; flex-direction:column; gap:12px;">
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

        <!-- Profile & Earnings Panel -->
        <div id="auth-profile-panel" class="auth-panel" style="display:flex; flex-direction:column; gap:12px;">
          <p class="auth-panel-sub">Manage your account profile details & seller earnings.</p>

          <!-- User Account Info -->
          <div class="profile-section-title">👤 Account Details</div>
          <div class="banking-info-card">
            <div class="auth-field">
              <label>Display Name</label>
              <input type="text" id="profile-display-name" placeholder="Your collector name">
            </div>
            <div class="auth-field" style="margin-top:10px;">
              <label>Email Address</label>
              <input type="email" id="profile-display-email" placeholder="you@example.com" readonly style="opacity:0.7; cursor:not-allowed;">
            </div>
            <div style="display:flex; gap:10px; margin-top:16px; width:100%;">
              <button type="button" id="save-profile-btn" style="flex:2; background:#ffffff; color:#000000; font-weight:900; border:none; border-radius:8px; padding:12px 16px; font-size:0.88rem; cursor:pointer;">
                SAVE PROFILE NAME 💾
              </button>
              <button type="button" id="profile-signout-btn" style="flex:1; background:rgba(255,255,255,0.1); color:#ffffff; font-weight:700; border:1px solid rgba(255,255,255,0.2); border-radius:8px; padding:12px 16px; font-size:0.88rem; cursor:pointer;">
                SIGN OUT 🚪
              </button>
            </div>
          </div>

          <!-- Seller Earnings & Payouts -->
          <div class="profile-section-title">💰 Seller Earnings & Payout Summary</div>
          <div class="banking-info-card">
            <div class="payout-stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:12px; margin-bottom:12px;">
              <div class="payout-stat" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; text-align:center;">
                <span style="display:block; font-size:0.7rem; font-weight:700; color:#a0a0a0; letter-spacing:1px; margin-bottom:6px;">TOTAL GROSS</span>
                <span style="font-size:1.3rem; font-weight:900; color:#fff;" id="profile-gross-sales">$0.00</span>
              </div>
              <div class="payout-stat" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; text-align:center;">
                <span style="display:block; font-size:0.7rem; font-weight:700; color:#a0a0a0; letter-spacing:1px; margin-bottom:6px;">PLATFORM CUT (10%)</span>
                <span style="font-size:1.3rem; font-weight:900; color:#ff4757;" id="profile-platform-cut">-$0.00</span>
              </div>
              <div class="payout-stat" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; text-align:center;">
                <span style="display:block; font-size:0.7rem; font-weight:700; color:#a0a0a0; letter-spacing:1px; margin-bottom:6px;">YOUR NET (90%)</span>
                <span style="font-size:1.3rem; font-weight:900; color:#4ade80;" id="profile-net-payout">$0.00</span>
              </div>
              <div class="payout-stat" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; text-align:center;">
                <span style="display:block; font-size:0.7rem; font-weight:700; color:#a0a0a0; letter-spacing:1px; margin-bottom:6px;">ACTIVE LISTINGS</span>
                <span style="font-size:1.3rem; font-weight:900; color:#fff;" id="profile-listing-count">0</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Banking Panel -->
        <div id="auth-banking-panel" class="auth-panel" style="display:none; flex-direction:column; gap:12px;">
          <p class="auth-panel-sub">Manage your direct deposit banking & automated payout details.</p>
          <div class="profile-section-title">🏦 Banking & Payout Settings</div>
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
        </div>

        <!-- Settings & Layout Panel -->
        <div id="auth-settings-panel" class="auth-panel" style="display:none; flex-direction:column; gap:12px;">
          <p class="auth-panel-sub">Configure user options, card grid views, & store layout preferences.</p>
          <div class="profile-section-title">⚙️ User Settings & Layout Preferences</div>
          
          <div class="banking-info-card">
            <div class="auth-field">
              <label>Default Store View Layout</label>
              <select id="setting-layout-mode" style="background:#1a1a1a; border:1px solid #333; color:#fff; padding:10px; border-radius:8px; width:100%;">
                <option value="grid">Standard 4-Column Card Grid</option>
                <option value="compact">Compact Dense Grid (Mobile Optimized)</option>
                <option value="large">Featured Showcase Large Cards</option>
              </select>
            </div>

            <div class="auth-field" style="margin-top:12px;">
              <label>3D Hero Stage Animation</label>
              <select id="setting-3d-motion" style="background:#1a1a1a; border:1px solid #333; color:#fff; padding:10px; border-radius:8px; width:100%;">
                <option value="enabled">Active 3D Interactive Bench & Motion</option>
                <option value="reduced">Reduced Motion (Static Lighting)</option>
              </select>
            </div>

            <div class="auth-field" style="margin-top:12px;">
              <label>Persistent Sign In Session</label>
              <select id="setting-auto-session" style="background:#1a1a1a; border:1px solid #333; color:#fff; padding:10px; border-radius:8px; width:100%;">
                <option value="1">Remember My Account Always (Enabled)</option>
                <option value="0">Ask Each Session</option>
              </select>
            </div>

            <button type="button" class="auth-submit-btn" id="save-settings-btn" style="margin-top:14px;">
              SAVE LAYOUT PREFERENCES ⚙️
            </button>
          </div>
        </div>

        <!-- 3D Background Color Panel -->
        <div id="auth-colors-panel" class="auth-panel" style="display:none; flex-direction:column; gap:12px;">
          <p class="auth-panel-sub">Customize the color tint of the 3D background stage to make it fit your aesthetic!</p>
          <div class="profile-section-title">🎨 3D Stage Background Color</div>
          
          <div class="banking-info-card">
            <p style="font-size:0.8rem; color:#a0a0a0; margin-bottom:12px;">Select a preset background color swatch or pick a custom hex color. This tints ONLY the 3D background scene so the rest of the store stays sleek & fits perfectly:</p>
            
            <div class="theme-swatches-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap:10px; margin-bottom:16px;">
              <button type="button" class="theme-swatch-btn" data-3dcolor="#141416">
                <div class="swatch-color-dot" style="background:#141416; border:1px solid #555;"></div>
                <span>Studio Dark</span>
              </button>
              <button type="button" class="theme-swatch-btn" data-3dcolor="#ff4757">
                <div class="swatch-color-dot" style="background:#ff4757;"></div>
                <span>Crimson</span>
              </button>
              <button type="button" class="theme-swatch-btn" data-3dcolor="#a855f7">
                <div class="swatch-color-dot" style="background:#a855f7;"></div>
                <span>Violet</span>
              </button>
              <button type="button" class="theme-swatch-btn" data-3dcolor="#00d2d3">
                <div class="swatch-color-dot" style="background:#00d2d3;"></div>
                <span>Cyan</span>
              </button>
              <button type="button" class="theme-swatch-btn" data-3dcolor="#ffd700">
                <div class="swatch-color-dot" style="background:#ffd700;"></div>
                <span>Gold</span>
              </button>
              <button type="button" class="theme-swatch-btn" data-3dcolor="#2ecc71">
                <div class="swatch-color-dot" style="background:#2ecc71;"></div>
                <span>Emerald</span>
              </button>
              <button type="button" class="theme-swatch-btn" data-3dcolor="#2563eb">
                <div class="swatch-color-dot" style="background:#2563eb;"></div>
                <span>Sapphire</span>
              </button>
              <button type="button" class="theme-swatch-btn" data-3dcolor="#ff007f">
                <div class="swatch-color-dot" style="background:#ff007f;"></div>
                <span>Rose</span>
              </button>
            </div>

            <div class="custom-color-picker-wrapper" style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:10px 14px; margin-bottom:14px;">
              <span style="font-size:0.8rem; font-weight:700;">Custom 3D Background Hex Color</span>
              <input type="color" id="profile-3d-color-picker" class="custom-color-input" value="#141416" style="width:38px; height:38px; border:none; border-radius:50%; cursor:pointer; background:none;">
            </div>

            <div style="display:flex; gap:10px;">
              <button type="button" class="auth-submit-btn" id="reset-3d-color-btn" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; flex:1;">
                RESET TO DEFAULT DARK ↺
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    // Back button & Close button handlers
    modal.querySelector('#auth-modal-back-btn')?.addEventListener('click', closeAuthModal);
    modal.querySelector('#auth-modal-close')?.addEventListener('click', closeAuthModal);
    modal.addEventListener('click', e => {
      if (e.target === modal) closeAuthModal();
    });

    // Sign out button in profile
    modal.querySelector('#profile-signout-btn')?.addEventListener('click', signOut);

    // Tab switching
    modal.querySelectorAll('.auth-tab-btn, .auth-switch-link').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        switchTab(el.dataset.tab);
      });
    });

    // 3D Color Swatches
    modal.querySelectorAll('.theme-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset['3dcolor'] || btn.dataset.color;
        apply3DBackgroundColor(color);
        const picker = document.getElementById('profile-3d-color-picker');
        if (picker && color && color.startsWith('#')) picker.value = color;
      });
    });

    // Custom 3D Color Picker
    const customColorInput = modal.querySelector('#profile-3d-color-picker');
    if (customColorInput) {
      customColorInput.addEventListener('input', (e) => {
        apply3DBackgroundColor(e.target.value);
      });
    }

    // Reset 3D Color
    modal.querySelector('#reset-3d-color-btn')?.addEventListener('click', () => {
      apply3DBackgroundColor('#141416');
      const picker = document.getElementById('profile-3d-color-picker');
      if (picker) picker.value = '#141416';
    });

    // Save Profile Name
    modal.querySelector('#save-profile-btn')?.addEventListener('click', () => {
      const user = getCurrentUser();
      const newName = document.getElementById('profile-display-name')?.value.trim();
      if (!newName) { alert('Please enter a display name.'); return; }
      if (user) {
        user.displayName = newName;
        setCurrentUser(user);
        const users = getUsers();
        if (users[user.email]) { users[user.email].displayName = newName; saveUsers(users); }
        updateAllAuthUI();
        alert('✅ Profile name saved!');
      } else {
        localStorage.setItem('mtcg_saved_name', newName);
        alert('✅ Name saved locally!');
      }
    });

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

    // Save Settings & Layout Preferences
    modal.querySelector('#save-settings-btn')?.addEventListener('click', () => {
      const layoutMode = document.getElementById('setting-layout-mode')?.value;
      const motion3D = document.getElementById('setting-3d-motion')?.value;
      const autoSession = document.getElementById('setting-auto-session')?.value;

      localStorage.setItem('mtcg_layout_mode', layoutMode || 'grid');
      localStorage.setItem('mtcg_3d_motion', motion3D || 'enabled');
      localStorage.setItem('mtcg_auto_session', autoSession || '1');

      alert('⚙️ Store Layout & Settings preferences saved!');
    });

    // Sign In submit
    modal.querySelector('#signin-submit-btn')?.addEventListener('click', () => {
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      const errEl = document.getElementById('auth-signin-error');
      if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
      const result = signIn(email, password);
      if (!result.ok) { errEl.textContent = result.error; return; }
      updateAllAuthUI();
      checkAuthGate();
      const modalEl = document.getElementById('auth-modal');
      if (modalEl) modalEl.classList.remove('active');
      clearErrors();
    });

    // Sign Up submit
    modal.querySelector('#signup-submit-btn')?.addEventListener('click', () => {
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const errEl = document.getElementById('auth-signup-error');
      if (!email || !password) { errEl.textContent = 'Email and password are required.'; return; }
      if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
      const result = signUp(email, password, name);
      if (!result.ok) { errEl.textContent = result.error; return; }
      updateAllAuthUI();
      checkAuthGate();
      const modalEl = document.getElementById('auth-modal');
      if (modalEl) modalEl.classList.remove('active');
      clearErrors();
    });

    // Enter key submits
    modal.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const signinVisible = document.getElementById('auth-signin-panel')?.style.display !== 'none';
      if (signinVisible) modal.querySelector('#signin-submit-btn')?.click();
      else modal.querySelector('#signup-submit-btn')?.click();
    });

    return modal;
  }

  /* ── Desktop auth button click ── */
  function handleDesktopAuthClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const user = getCurrentUser();
    if (user) {
      openAuthModal('profile');
    } else {
      openAuthModal('signin');
    }
  }

  /* ── Init ── */
  function init() {
    const desktopBtn = document.getElementById('auth-desktop-btn');
    if (desktopBtn) {
      desktopBtn.removeEventListener('click', handleDesktopAuthClick);
      desktopBtn.addEventListener('click', handleDesktopAuthClick);
    }

    const saved3DColor = localStorage.getItem('mtcg_3d_bg_color') || '#141416';
    apply3DBackgroundColor(saved3DColor);

    updateAllAuthUI();
    checkAuthGate();
    autoFillFormInputs();
    setupInputAutoSaveListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use
  window.MillionAuth = { signIn, signUp, signOut, getCurrentUser, openAuthModal, autoFillFormInputs, apply3DBackgroundColor, getBankingInfo, saveBankingInfo };
})();
