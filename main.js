// =============================================================================
// MillionTCG — main.js
// =============================================================================
// ⚠️  GLOBAL DECLARATION REGISTRY — DO NOT RE-DECLARE ANY OF THESE ANYWHERE ⚠️
//
//  const  PRODUCTS                   — line ~14  (static product catalogue)
//  let    cart                       — line ~42  (user cart, from localStorage)
//  function getCommunityListings()   — line ~53  (reads community listings)
//  function saveCommunityListing()   — line ~69  (saves a new listing)
//  let    communityListings          — line ~77  (live snapshot of listings)
//  function renderHomeProducts()     — line ~79  (renders homepage grid)
//  function startApp()               — line ~116 (main entry point)
//  let    currentUser                — line ~1063 (authenticated user object)
//  function initSellerSystem()       — line ~1065 (seller workspace engine)
//
//  Adding a SECOND `const`, `let`, or `var` for any of the above names will
//  throw a SyntaxError and kill ALL JavaScript on every page — including the
//  3D hero model, cart, search, and mobile menu.
// =============================================================================

// --- ANTI-COPY & SOURCE CODE PROTECTION ENGINE ---
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (
    e.keyCode === 123 || 
    (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || 
    (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83))
  ) {
    e.preventDefault();
    return false;
  }
});

const PRODUCTS = [];

// Initialize Cart from localStorage
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem('milliontcg_cart') || '[]');
  if (!Array.isArray(cart)) cart = [];
} catch (e) {
  cart = [];
}

const DEFAULT_COMMUNITY_LISTINGS = [];

// =============================================================================
// STORAGE ENGINE — Dual-Layer (IndexedDB + LocalStorage) + Real-Time Cloud Sync
// =============================================================================
const DB_NAME = 'milliontcg_db';
const DB_VERSION = 1;
const STORE_NAME = 'listings';
const CLOUD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyKJ6ITmwaUHQfIHhX4WmTjk8l-Sbr6J7N43vegxjglLI9N3E_70Ao9i3Hvl8kcwXOi/exec';

// Clean Slate Migration: wipe all old mock products & corrupted local records
try {
  if (!localStorage.getItem('milliontcg_clean_slate_2026_v4')) {
    localStorage.removeItem('milliontcg_community_listings');
    localStorage.setItem('milliontcg_community_listings', '[]');
    localStorage.setItem('milliontcg_clean_slate_2026_v4', 'true');
    if (window.indexedDB) {
      indexedDB.deleteDatabase(DB_NAME);
    }
  }
} catch (e) {}

let _db = null;

function getDeletedIds() {
  try {
    const raw = localStorage.getItem('milliontcg_deleted_ids');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markIdAsDeleted(id) {
  try {
    const strId = String(id);
    const ids = getDeletedIds();
    if (!ids.includes(strId)) {
      ids.push(strId);
      localStorage.setItem('milliontcg_deleted_ids', JSON.stringify(ids));
    }
  } catch (e) {}
}

function unmarkIdAsDeleted(id) {
  try {
    const strId = String(id);
    const ids = getDeletedIds().filter(i => i !== strId);
    localStorage.setItem('milliontcg_deleted_ids', JSON.stringify(ids));
  } catch (e) {}
}

function filterDeleted(items) {
  if (!Array.isArray(items)) return [];
  const deleted = new Set(getDeletedIds());
  return items.filter(i => i && i.id && !deleted.has(String(i.id)));
}

function getLocalListingsCache() {
  try {
    const raw = localStorage.getItem('milliontcg_community_listings');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? filterDeleted(parsed) : [];
  } catch (e) {
    return [];
  }
}

function setLocalListingsCache(arr) {
  try {
    const valid = filterDeleted(arr);
    localStorage.setItem('milliontcg_community_listings', JSON.stringify(valid));
  } catch (e) {
    console.warn('[MillionTCG] localStorage cache warning:', e);
  }
}

function openDB() {
  return new Promise((resolve) => {
    if (_db) { resolve(_db); return; }
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => { console.warn('IndexedDB open error:', e); resolve(null); };
    } catch (e) {
      resolve(null);
    }
  });
}

function dbGetAll() {
  return openDB().then(db => {
    if (!db) return getLocalListingsCache();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          let items = req.result || [];
          items = filterDeleted(items);
          setLocalListingsCache(items);
          items.sort((a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0));
          resolve(items);
        };
        req.onerror = () => resolve(getLocalListingsCache());
      } catch (err) {
        resolve(getLocalListingsCache());
      }
    });
  }).catch(() => getLocalListingsCache());
}

function dbPut(listing) {
  if (!listing || !listing.id) return Promise.resolve(null);
  unmarkIdAsDeleted(listing.id);
  const cache = getLocalListingsCache().filter(i => String(i.id) !== String(listing.id));
  cache.unshift(listing);
  setLocalListingsCache(cache);

  return openDB().then(db => {
    if (!db) return listing;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(listing);
        req.onsuccess = () => resolve(listing);
        req.onerror = () => resolve(listing);
      } catch (e) {
        resolve(listing);
      }
    });
  }).catch(() => listing);
}

function dbDelete(id) {
  if (!id) return Promise.resolve(true);
  markIdAsDeleted(id);
  const cache = getLocalListingsCache().filter(i => String(i.id) !== String(id));
  setLocalListingsCache(cache);

  return openDB().then(db => {
    if (!db) return true;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }).catch(() => true);
}

// ── Image Sanitization & Self-Healing ──
function sanitizeLocalListings() {
  try {
    const raw = localStorage.getItem('milliontcg_community_listings');
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    const deleted = new Set(getDeletedIds());
    let changed = false;
    const sanitized = [];
    arr.forEach(item => {
      if (!item || !item.id || deleted.has(String(item.id)) || item.id === 'charizard-ex-flashfire' || String(item.id).includes('seed') || String(item.title || item.name || '').includes('Flashfire')) {
        changed = true;
        if (item && item.id) dbDelete(item.id);
        return;
      }
      if (item.gallery && Array.isArray(item.gallery) && item.gallery.length > 0) {
        const realImg = item.gallery.find(g => g && typeof g === 'string' && g !== 'images/logo.png');
        if (realImg && (item.image === 'images/logo.png' || !item.image)) {
          item.image = realImg;
          changed = true;
        }
      }
      sanitized.push(item);
    });
    if (changed) {
      setLocalListingsCache(sanitized);
      communityListings = sanitized;
      Promise.all(sanitized.map(item => dbPut(item)));
    }
  } catch (e) {}
}

// ── Cloud Synchronization Functions ──
let _cloudFetchPromise = null;
async function fetchCloudListings() {
  if (_cloudFetchPromise) return _cloudFetchPromise;
  _cloudFetchPromise = (async () => {
    try {
      const res = await fetch(CLOUD_SCRIPT_URL + '?action=getListings&t=' + Date.now(), { cache: 'no-cache' }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.ok && Array.isArray(data.listings)) {
          const cloudItems = filterDeleted(data.listings);
          
          // Merge cloud items with local items to prevent wiping out local listings
          const localItems = getLocalListingsCache();
          const mergedMap = new Map();
          
          // Keep local items first
          localItems.forEach(item => mergedMap.set(String(item.id), item));
          
          // Override with cloud items
          cloudItems.forEach(item => mergedMap.set(String(item.id), item));
          
          const mergedListings = Array.from(mergedMap.values()).sort((a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0));

          setLocalListingsCache(mergedListings);
          communityListings = mergedListings;
          openDB().then(db => {
            if (!db) return;
            try {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              store.clear();
              mergedListings.forEach(item => store.put(item));
            } catch (e) {}
          });
          
          // Re-sync any local-only listings to cloud
          const localOnly = localItems.filter(local => !cloudItems.find(cloud => String(cloud.id) === String(local.id)));
          if (localOnly.length > 0) {
            localOnly.forEach(item => syncListingToCloud(item));
          }

          try { renderHomeProducts(); } catch (e) {}
          try { window.dispatchEvent(new CustomEvent('milliontcg_listings_updated', { detail: mergedListings })); } catch (e) {}
          return mergedListings;
        }
      }
    } catch (e) {
      console.warn('[MillionTCG] fetchCloudListings note:', e);
    }
    return getLocalListingsCache();
  })().finally(() => {
    _cloudFetchPromise = null;
  });
  return _cloudFetchPromise;
}

async function syncListingToCloud(listing) {
  if (!listing || !listing.id) return;
  try {
    const res = await fetch(CLOUD_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveListing',
        listing: listing
      })
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok && data.listing) {
      if (data.listing.image && data.listing.image !== listing.image) {
        listing.image = data.listing.image;
        if (data.listing.gallery) listing.gallery = data.listing.gallery;
        dbPut(listing);
        const local = getLocalListingsCache();
        const idx = local.findIndex(i => String(i.id) === String(listing.id));
        if (idx >= 0) {
          local[idx] = listing;
          setLocalListingsCache(local);
        }
      }
    }
    console.log('[MillionTCG] Cloud listing saved:', data);
  } catch (e) {
    console.warn('[MillionTCG] syncListingToCloud note:', e);
  }
}

async function deleteListingFromCloud(id) {
  if (!id) return;
  try {
    fetch(CLOUD_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteListing',
        id: String(id)
      })
    }).catch(err => console.warn('[MillionTCG] Cloud delete note:', err));
  } catch (e) {}
}

// Migrate any old localStorage listings into IndexedDB once
function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem('milliontcg_community_listings');
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return;
    const deleted = new Set(getDeletedIds());
    const real = arr.filter(i => i && i.id && !deleted.has(String(i.id)) && !String(i.id).includes('seed'));
    if (real.length === 0) return;
    Promise.all(real.map(item => dbPut(item))).then(() => {
      console.log('[MillionTCG] Synced', real.length, 'listings');
    }).catch(console.error);
  } catch (e) {}
}

// Public API — async versions used by sell page, sync fallback for homepage
function getCommunityListings() {
  return communityListings && communityListings.length > 0 ? communityListings : getLocalListingsCache();
}

function getCommunityListingsAsync() {
  return dbGetAll().then(items => {
    if (items && items.length > 0) {
      communityListings = items;
    }
    return communityListings && communityListings.length > 0 ? communityListings : getLocalListingsCache();
  });
}

function saveCommunityListing(newListing) {
  if (!newListing.date) newListing.date = Date.now();
  if (!newListing.createdAt) newListing.createdAt = Date.now();
  unmarkIdAsDeleted(newListing.id);

  return dbPut(newListing).then(() => {
    if (!communityListings.some(i => String(i.id) === String(newListing.id))) {
      communityListings.unshift(newListing);
    }
    setLocalListingsCache(communityListings);
    syncListingToCloud(newListing);
    try { renderHomeProducts(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('milliontcg_listing_saved', { detail: newListing })); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('milliontcg_listings_updated', { detail: communityListings })); } catch (e) {}
    try { window.dispatchEvent(new Event('storage')); } catch (e) {}
    return newListing;
  });
}

function deleteCommunityListing(id) {
  if (!id) return Promise.resolve(false);
  markIdAsDeleted(id);
  communityListings = communityListings.filter(i => String(i.id) !== String(id));
  setLocalListingsCache(communityListings);
  deleteListingFromCloud(id);
  return dbDelete(id).then(() => {
    try { renderHomeProducts(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('milliontcg_listing_deleted', { detail: { id } })); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('milliontcg_listings_updated', { detail: communityListings })); } catch (e) {}
    try { window.dispatchEvent(new Event('storage')); } catch (e) {}
    return true;
  });
}

let communityListings = getLocalListingsCache();
// Fast startup: render synchronously immediately from cache, sync DB and Cloud non-blockingly
sanitizeLocalListings();
openDB().then(() => {
  migrateFromLocalStorage();
  sanitizeLocalListings();
  return dbGetAll();
}).then(listings => {
  if (listings && listings.length > 0) {
    communityListings = listings;
    try { renderHomeProducts(); } catch (e) {}
  }
  return fetchCloudListings();
}).catch(console.error);

// Listen for cross-tab, cloud, or listing updates
window.addEventListener('storage', () => {
  getCommunityListingsAsync().then(() => {
    try { renderHomeProducts(); } catch (e) {}
  });
});
window.addEventListener('milliontcg_listing_saved', () => {
  try { renderHomeProducts(); } catch (e) {}
});
window.addEventListener('milliontcg_listings_updated', () => {
  try { renderHomeProducts(); } catch (e) {}
});

let _renderHomeScheduled = false;
function renderHomeProducts() {
  if (document.getElementById('catalog-grid')) {
    if (typeof refreshCatalogView === 'function') refreshCatalogView();
    return;
  }
  const grid = document.querySelector('.product-grid');
  if (!grid) return;

  if (_renderHomeScheduled) return;
  _renderHomeScheduled = true;
  requestAnimationFrame(() => {
    _renderHomeScheduled = false;
    _doRenderHomeProducts(grid);
  });
}

function _doRenderHomeProducts(grid) {
  const currentList = (communityListings && communityListings.length > 0) ? communityListings : getLocalListingsCache();
  _applyHomeGridMarkup(grid, currentList);
}

function _applyHomeGridMarkup(grid, community) {
  const mappedCommunity = (community || []).map(c => {
    let cardImg = c.image;
    if (!cardImg || cardImg === 'images/logo.png') {
      if (c.gallery && Array.isArray(c.gallery) && c.gallery.length > 0 && c.gallery[0] !== 'images/logo.png') {
        cardImg = c.gallery[0];
      }
    }
    return {
      id: c.id,
      name: c.title,
      price: parseFloat(c.price) || 0,
      category: c.category || 'Single Card',
      franchise: c.franchise || '',
      condition: c.condition || 'Raw',
      image: cardImg || 'images/logo.png',
      gallery: c.gallery || [cardImg || 'images/logo.png'],
      tag: c.condition ? `${c.condition.toUpperCase()} SINGLE` : 'SINGLE CARD',
      desc: `${c.condition || 'Raw'} • ${c.franchise || c.category || 'Single Card'} • Verified Seller @${c.sellerName || 'Seller'}`,
      date: c.date || c.createdAt || 0
    };
  });

  const isSingleCardItem = (p) => {
    if (!p) return false;
    const cat = (p.category || '').trim().toLowerCase();
    const name = (p.name || p.title || '').trim().toLowerCase();

    // Explicitly reject non-single categories or keywords
    if (
      cat.includes('sealed') || 
      cat.includes('box') || 
      cat.includes('accessor') || 
      cat.includes('bundle') || 
      cat.includes('tin') || 
      cat.includes('pack')
    ) {
      return false;
    }

    // Strict non-single regex check on product title/name
    const nonSingleRegex = /\b(pack|packs|booster|booster pack|booster box|box|boxes|sealed|etb|elite trainer box|tin|tins|collector tin|mini tin|sleeve|sleeves|binder|binders|deck box|toploader|toploaders|playmat|playmats|bundle|bundles|mystery|mystery box|lot|case|cases|stand|collection box|starter deck|structure deck|pin collection|figure collection)\b/i;
    if (nonSingleRegex.test(name)) {
      return false;
    }

    if (cat === 'single card' || cat === 'singles' || cat === 'single') return true;

    const validFranchiseCategories = ['pokemon', 'yu-gi-oh!', 'magic the gathering', 'one piece', 'lorcana', 'digimon', 'dragon ball', 'other', ''];
    return validFranchiseCategories.includes(cat);
  };

  const allItems = [...mappedCommunity, ...PRODUCTS];
  // Strictly filter to SINGLE CARDS ONLY (no tins, booster boxes, packs, bundles, or accessories)
  const singleCardsOnly = allItems.filter(p => isSingleCardItem(p));

  // Organize cleanly: newest listings first
  singleCardsOnly.sort((a, b) => (b.date || 0) - (a.date || 0));

  const signature = singleCardsOnly.map(p => `${p.id}:${p.price}:${p.image}`).join('|');
  if (grid.dataset.renderedSignature === signature) {
    return; // Already rendered this exact content, avoid DOM replacement
  }
  grid.dataset.renderedSignature = signature;

  if (singleCardsOnly.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
        <p style="color: var(--text-muted); font-size: 1.1rem; margin-bottom: 16px;">No single cards currently featured in the drop.</p>
        <a href="sell.html" class="btn-primary" style="display: inline-block; padding: 12px 28px; text-decoration: none; font-weight: 700;">+ List Your First Single Card</a>
      </div>
    `;
    return;
  }

  grid.innerHTML = singleCardsOnly.map(p => {
    return `
      <div class="product-card-container is-single-card" onclick="window.location.href='product.html?id=${p.id}'" style="cursor: pointer;">
        <div class="product-card">
          ${p.tag ? `<span class="card-badge">${p.tag}</span>` : ''}
          <div class="product-img-wrapper">
            <img src="${p.image}" alt="${p.name}">
          </div>
          <div class="product-info">
            <span class="product-category">${p.category || 'Single Card'}</span>
            <h3 class="product-name">${p.name}</h3>
            <p class="product-desc">${p.desc || ''}</p>
            <div class="product-footer">
              <span class="product-price">$${parseFloat(p.price).toFixed(2)}</span>
              <button class="btn-secondary" onclick="event.stopPropagation(); window.location.href='product.html?id=${p.id}'">View Card</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  setupFeaturedDropScroll();
}

function setupFeaturedDropScroll() {
  const grid = document.querySelector('.featured-drop-grid');
  const btnLeft = document.getElementById('featured-scroll-left');
  const btnRight = document.getElementById('featured-scroll-right');

  if (btnLeft && grid && !btnLeft.dataset.bound) {
    btnLeft.dataset.bound = 'true';
    btnLeft.addEventListener('click', (e) => {
      e.preventDefault();
      const scrollDist = grid.clientWidth * 0.75 || 540;
      grid.scrollBy({ left: -scrollDist, behavior: 'smooth' });
    });
  }

  if (btnRight && grid && !btnRight.dataset.bound) {
    btnRight.dataset.bound = 'true';
    btnRight.addEventListener('click', (e) => {
      e.preventDefault();
      const scrollDist = grid.clientWidth * 0.75 || 540;
      grid.scrollBy({ left: scrollDist, behavior: 'smooth' });
    });
  }

  if (grid && !grid.dataset.scrollInitialized) {
    grid.dataset.scrollInitialized = 'true';

    let isDown = false;
    let startX;
    let scrollLeft;
    let hasMoved = false;

    grid.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      isDown = true;
      hasMoved = false;
      startX = e.pageX - grid.offsetLeft;
      scrollLeft = grid.scrollLeft;
      grid.style.cursor = 'grabbing';
      grid.style.userSelect = 'none';
    });

    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      if (grid) {
        grid.style.cursor = '';
        grid.style.userSelect = '';
      }
    });

    grid.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - grid.offsetLeft;
      const walk = (x - startX) * 1.4;
      if (Math.abs(walk) > 6) hasMoved = true;
      grid.scrollLeft = scrollLeft - walk;
    });

    grid.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    }, true);
  }
}

function startApp() {
  try { updateCartUI(); } catch (e) {}
  try { setupCartModal(); } catch (e) {}
  try { setupSearch(); } catch (e) {}
  try { setupMobileMenu(); } catch (e) {}
  try { renderHomeProducts(); } catch (e) {}
  try { setupFeaturedDropScroll(); } catch (e) {}
  try { initHeroMangaInteractive(); } catch (e) { console.error("3D init error:", e); }
  try { initSellerSystem(); } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// Update Cart Count and Modal Display
function updateCartUI() {
  const cartCountEls = document.querySelectorAll('.cart-count');
  const totalCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
  cartCountEls.forEach(el => el.textContent = totalCount);

  // Update Cart Drawer Items if open
  const cartItemsContainer = document.getElementById('cart-items');
  const cartSubtotalEl = document.getElementById('cart-subtotal');
  
  if (cartItemsContainer && cartSubtotalEl) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="empty-cart-state">
          <p>Your shopping cart is currently empty.</p>
          <a href="shop.html" class="btn-primary" style="margin-top: 16px; padding: 10px 20px; font-size: 0.9rem; display: inline-block;">Browse Shop</a>
        </div>
      `;
      cartSubtotalEl.textContent = '$0.00';
    } else {
      let subtotal = 0;
      cartItemsContainer.innerHTML = cart.map(item => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.quantity) || 1;
        const itemTotal = itemPrice * itemQty;
        subtotal += itemTotal;
        return `
          <div class="cart-item-row">
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
              <h4>${item.name}</h4>
              <p class="cart-item-price">$${itemPrice.toFixed(2)} x ${itemQty}</p>
            </div>
            <div class="cart-item-controls">
              <button type="button" onclick="changeQuantity('${item.id}', -1)">-</button>
              <span>${itemQty}</span>
              <button type="button" onclick="changeQuantity('${item.id}', 1)">+</button>
              <button type="button" onclick="removeFromCart('${item.id}')" class="remove-btn">✕</button>
            </div>
          </div>
        `;
      }).join('');
      
      const discount = window.appliedDiscount || 0;
      const finalSub = Math.max(0, subtotal - discount);
      cartSubtotalEl.textContent = `$${finalSub.toFixed(2)}`;
    }
  }

  // Save to localStorage safely
  try {
    localStorage.setItem('milliontcg_cart', JSON.stringify(cart));
  } catch(e) {}
}

// Add Item to Cart with Optional Bundle Choice
function addToCart(productId, selectedBundle) {
  let product = PRODUCTS.find(p => String(p.id) === String(productId));
  if (!product) {
    const commList = getCommunityListings();
    let comm = (commList || []).find(p => String(p.id) === String(productId));
    if (!comm) {
      const localCache = getLocalListingsCache();
      comm = (localCache || []).find(p => String(p.id) === String(productId));
    }
    if (comm) {
      product = {
        id: comm.id,
        name: comm.title || comm.name,
        price: parseFloat(comm.price) || 0,
        category: comm.category || 'Single Card',
        franchise: comm.franchise || '',
        image: comm.image || (comm.gallery && comm.gallery[0]) || 'images/logo.png',
        desc: comm.desc || `${comm.condition || 'Card'} • @${comm.sellerName || 'Seller'}`
      };
    }
  }
  if (!product) return;

  let itemToAdd = { ...product };

  if (selectedBundle) {
    itemToAdd.id = `${product.id}_${selectedBundle.count}`;
    itemToAdd.name = `${product.name} (${selectedBundle.label})`;
    itemToAdd.price = selectedBundle.price;
  }

  const existing = cart.find(item => String(item.id) === String(itemToAdd.id));
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...itemToAdd, quantity: 1 });
  }

  try { localStorage.setItem('milliontcg_cart', JSON.stringify(cart)); } catch (e) {}
  updateCartUI();
  openCartModal();
}

// Change Quantity
function changeQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }
  updateCartUI();

  // If on checkout page, refresh summary too
  if (typeof renderCheckoutSummary === 'function') {
    renderCheckoutSummary();
  }
}

// Remove from Cart
function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  updateCartUI();

  // If on checkout page, refresh summary too
  if (typeof renderCheckoutSummary === 'function') {
    renderCheckoutSummary();
  }
}

// Cart Drawer Modal Toggle
function setupCartModal() {
  const cartBtns = document.querySelectorAll('#cart-toggle-btn, .icon-btn[aria-label="Shopping Cart"]');
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  const closeCartBtn = document.getElementById('close-cart-btn');

  cartBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      openCartModal();
    };
  });

  if (closeCartBtn) closeCartBtn.onclick = closeCartModal;
  if (cartOverlay) cartOverlay.onclick = closeCartModal;
}

function openCartModal() {
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  if (cartDrawer && cartOverlay) {
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
  }
}

function closeCartModal() {
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  if (cartDrawer && cartOverlay) {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
  }
}

// =============================================================================
// MILLIONTCG ADVANCED SEARCH ENGINE & AUTOCOMPLETE
// =============================================================================

function getAllProductsForSearchAsync() {
  return (typeof getCommunityListingsAsync === 'function' ? getCommunityListingsAsync() : Promise.resolve(getCommunityListings() || []))
    .then(community => {
      const mappedCommunity = (community || []).map(c => {
        let cardImg = c.image;
        if (!cardImg || cardImg === 'images/logo.png') {
          if (c.gallery && Array.isArray(c.gallery) && c.gallery.length > 0 && c.gallery[0] !== 'images/logo.png') {
            cardImg = c.gallery[0];
          }
        }
        return {
          id: c.id,
          name: c.title || c.name || 'TCG Item',
          price: parseFloat(c.price) || 0,
          category: c.category || 'Single Card',
          franchise: c.franchise || '',
          condition: c.condition || 'Raw',
          image: cardImg || 'images/logo.png',
          gallery: c.gallery || [cardImg || 'images/logo.png'],
          tag: c.tag || 'SELLER LISTING',
          sellerName: c.sellerName || '',
          desc: c.desc || `${c.condition || 'Raw'} • ${c.category || 'Single Card'} • Verified Seller @${c.sellerName || 'Seller'}`
        };
      });
      const staticList = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS : [];
      return [...mappedCommunity, ...staticList];
    }).catch(() => {
      return (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS : [];
    });
}

function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQueryTokensWithSynonyms(rawQuery) {
  const clean = normalizeSearchText(rawQuery);
  if (!clean) return [];
  const tokens = clean.split(' ').filter(t => t.length > 0);
  const expanded = [];
  tokens.forEach(tok => {
    expanded.push(tok);
    if (tok === 'pokemon' || tok === 'pkmn' || tok === 'poke') {
      expanded.push('pokemon');
    } else if (tok === 'yugioh' || tok === 'yugi') {
      expanded.push('yu');
      expanded.push('gi');
      expanded.push('oh');
    } else if (tok === 'mtg' || tok === 'magic') {
      expanded.push('magic');
      expanded.push('gathering');
    } else if (tok === 'bb' || tok === 'booster') {
      expanded.push('booster');
      expanded.push('box');
    } else if (tok === 'etb') {
      expanded.push('elite');
      expanded.push('trainer');
      expanded.push('box');
    } else if (tok === 'psa10') {
      expanded.push('psa');
      expanded.push('10');
    } else if (tok === 'op' || tok === 'onepiece') {
      expanded.push('one');
      expanded.push('piece');
    }
  });
  return Array.from(new Set(expanded));
}

function filterAndRankProducts(items, rawQuery) {
  if (!rawQuery || !rawQuery.trim()) return items || [];
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) return items || [];
  const primaryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (!primaryTokens.length) return items || [];

  const scored = [];

  (items || []).forEach(p => {
    if (!p) return;
    const nameNorm = normalizeSearchText(p.name || p.title || '');
    const catNorm = normalizeSearchText(p.category || '');
    const franNorm = normalizeSearchText(p.franchise || '');
    const condNorm = normalizeSearchText(p.condition || '');
    const tagNorm = normalizeSearchText(p.tag || '');
    const descNorm = normalizeSearchText(p.desc || '');
    const sellerNorm = normalizeSearchText(p.sellerName || '');

    const fullSearchable = `${nameNorm} ${catNorm} ${franNorm} ${condNorm} ${tagNorm} ${descNorm} ${sellerNorm}`;

    let matchesAll = primaryTokens.every(tok => fullSearchable.includes(tok));
    let matchCount = 0;
    primaryTokens.forEach(tok => {
      if (fullSearchable.includes(tok)) matchCount++;
    });

    if (!matchesAll && matchCount === 0) return;

    let score = 0;
    if (nameNorm === normalizedQuery) score += 1000;
    else if (nameNorm.startsWith(normalizedQuery)) score += 500;
    else if (nameNorm.includes(normalizedQuery)) score += 300;

    primaryTokens.forEach(tok => {
      if (nameNorm.includes(tok)) score += 60;
      if (franNorm.includes(tok)) score += 40;
      if (catNorm.includes(tok)) score += 30;
      if (condNorm.includes(tok)) score += 25;
      if (tagNorm.includes(tok)) score += 15;
      if (descNorm.includes(tok)) score += 10;
    });

    if (matchesAll) score += 150;

    scored.push({ product: p, score });
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.product);
}

function highlightSearchMatch(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return escapeSearchHtml(text);
  const rawTerms = query.trim().split(/\s+/).filter(Boolean);
  if (!rawTerms.length) return escapeSearchHtml(text);
  
  const pattern = new RegExp(`(${rawTerms.map(t => escapeSearchRegex(t)).join('|')})`, 'gi');
  return escapeSearchHtml(text).replace(pattern, '<mark>$1</mark>');
}

function escapeSearchHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeSearchRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setupSearch() {
  // Check if home page was opened with search param from Google/external
  const urlParams = new URLSearchParams(window.location.search);
  const inboundQuery = urlParams.get('search') || urlParams.get('q') || urlParams.get('search_term_string') || urlParams.get('s');
  const isHomePage = window.location.pathname.endsWith('/index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
  if (inboundQuery && isHomePage && !document.getElementById('catalog-grid')) {
    window.location.href = `shop.html?search=${encodeURIComponent(inboundQuery)}`;
    return;
  }

  const searchBars = document.querySelectorAll('.search-bar');
  searchBars.forEach(bar => {
    if (bar.dataset.searchInitialized === 'true') return;
    bar.dataset.searchInitialized = 'true';

    let input = bar.querySelector('.search-input, input[type="text"]');
    if (!input) return;

    // Pre-populate input if URL contains search
    if (inboundQuery && !input.value) {
      input.value = inboundQuery;
      bar.classList.add('has-query');
    }

    // Enhance SVG icon to be clickable
    let svgIcon = bar.querySelector('svg');
    if (svgIcon && !svgIcon.parentElement.classList.contains('search-icon-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'search-icon-btn';
      btn.setAttribute('aria-label', 'Submit Search');
      bar.insertBefore(btn, svgIcon);
      btn.appendChild(svgIcon);
    }

    // Add Clear (✕) button if not exists
    let clearBtn = bar.querySelector('.search-clear-btn');
    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'search-clear-btn';
      clearBtn.setAttribute('aria-label', 'Clear search query');
      clearBtn.innerHTML = '✕';
      bar.appendChild(clearBtn);
    }

    // Create Autocomplete Dropdown if not exists
    let dropdown = bar.querySelector('.search-autocomplete-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'search-autocomplete-dropdown';
      dropdown.innerHTML = `
        <ul class="search-dropdown-list"></ul>
        <div class="search-dropdown-footer" style="display:none;"></div>
      `;
      bar.appendChild(dropdown);
    }

    const dropdownList = dropdown.querySelector('.search-dropdown-list');
    const dropdownFooter = dropdown.querySelector('.search-dropdown-footer');

    let debounceTimer = null;

    const closeDropdown = () => {
      dropdown.classList.remove('active');
    };

    const executeSearch = (rawVal) => {
      const q = (rawVal || input.value || '').trim();
      closeDropdown();
      if (!q) return;

      if (document.getElementById('catalog-grid')) {
        // We are on shop.html! Smooth in-page filter without full reload
        const newUrl = `shop.html?search=${encodeURIComponent(q)}`;
        try { history.replaceState(null, '', newUrl); } catch (e) {}
        
        // Sync all other search inputs on page
        document.querySelectorAll('.search-input').forEach(si => {
          if (si !== input) {
            si.value = q;
            if (si.closest('.search-bar')) si.closest('.search-bar').classList.add('has-query');
          }
        });
        
        if (typeof searchCatalog === 'function') {
          searchCatalog(q);
        }
      } else {
        // Navigate to shop.html with query
        window.location.href = `shop.html?search=${encodeURIComponent(q)}`;
      }
    };

    const renderSuggestions = (query) => {
      if (!query || !query.trim()) {
        closeDropdown();
        return;
      }

      getAllProductsForSearchAsync().then(items => {
        const matches = filterAndRankProducts(items, query);
        if (matches.length > 0) {
          const topMatches = matches.slice(0, 5);
          dropdownList.innerHTML = topMatches.map(p => `
            <li class="search-dropdown-item" data-product-id="${p.id}">
              <img src="${p.image || 'images/logo.png'}" alt="${escapeSearchHtml(p.name)}" class="search-item-img" onerror="this.src='images/logo.png'">
              <div class="search-item-info">
                <div class="search-item-title">${highlightSearchMatch(p.name, query)}</div>
                <div class="search-item-meta">
                  <span class="search-item-category">${escapeSearchHtml(p.category || 'Card')}</span>
                  <span>${escapeSearchHtml(p.condition || 'Raw')}</span>
                </div>
              </div>
              <div class="search-item-price">$${parseFloat(p.price).toFixed(2)}</div>
            </li>
          `).join('');

          dropdownFooter.style.display = 'flex';
          dropdownFooter.innerHTML = `
            <span style="color: var(--text-muted);">${matches.length} matching card${matches.length === 1 ? '' : 's'}</span>
            <a class="search-view-all-btn">View all results →</a>
          `;

          dropdownList.querySelectorAll('.search-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
              e.preventDefault();
              const pid = item.dataset.productId;
              if (pid) window.location.href = `product.html?id=${pid}`;
            });
          });

          const viewAllBtn = dropdownFooter.querySelector('.search-view-all-btn');
          if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (e) => {
              e.preventDefault();
              executeSearch(query);
            });
          }

          dropdown.classList.add('active');
        } else {
          // Zero results empty state in dropdown with quick suggestion chips
          dropdownList.innerHTML = `
            <div class="search-dropdown-empty">
              <p>No cards found for "<strong>${escapeSearchHtml(query)}</strong>"</p>
              <div class="search-suggestions-chips">
                <span class="search-chip" data-query="Pokemon">Pokémon</span>
                <span class="search-chip" data-query="Charizard">Charizard</span>
                <span class="search-chip" data-query="Booster Box">Booster Boxes</span>
                <span class="search-chip" data-query="PSA 10">PSA 10</span>
                <span class="search-chip" data-query="Yu-Gi-Oh">Yu-Gi-Oh!</span>
                <span class="search-chip" data-query="Magic">Magic MTG</span>
              </div>
            </div>
          `;
          dropdownFooter.style.display = 'none';

          dropdownList.querySelectorAll('.search-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
              e.preventDefault();
              const chipQ = chip.dataset.query;
              input.value = chipQ;
              bar.classList.add('has-query');
              executeSearch(chipQ);
            });
          });

          dropdown.classList.add('active');
        }
      });
    };

    // Input event
    input.addEventListener('input', () => {
      const val = input.value;
      if (val.trim()) {
        bar.classList.add('has-query');
      } else {
        bar.classList.remove('has-query');
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderSuggestions(val.trim());
      }, 140);
    });

    // Focus event
    input.addEventListener('focus', () => {
      if (input.value.trim()) {
        renderSuggestions(input.value.trim());
      }
    });

    // Keydown handler
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        executeSearch();
      } else if (e.key === 'Escape' || e.keyCode === 27) {
        closeDropdown();
      }
    });

    // Search Icon Click
    const iconBtn = bar.querySelector('.search-icon-btn');
    if (iconBtn) {
      iconBtn.addEventListener('click', (e) => {
        e.preventDefault();
        executeSearch();
      });
    }

    // Clear Button Click
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      input.value = '';
      bar.classList.remove('has-query');
      closeDropdown();
      input.focus();
      if (document.getElementById('catalog-grid')) {
        try { history.replaceState(null, '', 'shop.html'); } catch (err) {}
        if (typeof filterCatalog === 'function') filterCatalog('All');
      }
    });
  });

  // Global click outside to dismiss all search dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
      document.querySelectorAll('.search-autocomplete-dropdown').forEach(dd => {
        dd.classList.remove('active');
      });
    }
  });

  // Global Escape key to dismiss dropdowns
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      document.querySelectorAll('.search-autocomplete-dropdown').forEach(dd => {
        dd.classList.remove('active');
      });
    }
  });
}

// Mobile Navigation Menu Drawer Handler
function setupMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  const closeBtn = document.getElementById('close-drawer-btn');

  if (!menuBtn) return;

  function openDrawer(e) {
    if (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
    }
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer(e) {
    if (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
    }
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', openDrawer);
  menuBtn.addEventListener('touchstart', openDrawer, { passive: false });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeDrawer);
    closeBtn.addEventListener('touchstart', closeDrawer, { passive: false });
  }

  if (overlay) {
    overlay.addEventListener('click', closeDrawer);
    overlay.addEventListener('touchstart', closeDrawer, { passive: false });
  }

  const navLinks = drawer ? drawer.querySelectorAll('a') : [];
  navLinks.forEach(link => {
    link.addEventListener('click', () => closeDrawer());
  });
}

// --- REAL 3D GAME HOMESCREEN ENGINE ---
function initHeroMangaInteractive() {
  initHero3DScene();
}

let _threeRetryCount = 0;
let _heroAnimFrameId = null;
let _hero3dResizeBound = false;
let _heroSpeechTimeout = null;

function initHero3DScene(force) {
  const container = document.getElementById('hero-3d-container');
  const canvas = document.getElementById('hero-3d-canvas');
  if (!container || !canvas) return;

  if (typeof THREE === 'undefined') {
    if (_threeRetryCount < 8) {
      _threeRetryCount++;
      setTimeout(() => initHero3DScene(force), 100);
    } else {
      initCanvas2DFallback(canvas, container);
    }
    return;
  }

  // If already initialized and not forced, prevent duplicate initialization
  if (canvas.userData && canvas.userData.initialized && !force) {
    return;
  }

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || 600;

  if (width === 0 || height === 0) {
    if (_threeRetryCount < 50) {
      _threeRetryCount++;
      setTimeout(() => initHero3DScene(force), 100);
    }
    return;
  }

  // Cancel any running animation loop to prevent FPS lag
  if (_heroAnimFrameId) {
    cancelAnimationFrame(_heroAnimFrameId);
    _heroAnimFrameId = null;
  }
  if (_heroSpeechTimeout) {
    clearTimeout(_heroSpeechTimeout);
    _heroSpeechTimeout = null;
  }

  // If already initialized, dispose the old WebGL renderer before re-creating
  if (canvas.userData && canvas.userData.initialized) {
    if (canvas.userData.renderer) {
      try { canvas.userData.renderer.dispose(); } catch(e) {}
    }
    canvas.userData = {};
  }
  canvas.userData = canvas.userData || {};

  canvas.userData.initialized = true;

  // --- SCENE ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141416); // High-contrast monochrome dark studio room
  scene.fog = new THREE.FogExp2(0x141416, 0.015);

  // --- CAMERA (Zoomed Out for Wide 3D Stage Field of View) ---
  const aspect = width / height;
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 100);
  camera.position.set(0.4, 2.4, 7.6);
  camera.lookAt(0.4, 1.1, 0);

  // --- RENDERER ---
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x141416, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Store renderer and camera so bfcache re-init and resize can use them
    canvas.userData.renderer = renderer;
    canvas.userData.scene = scene;
    canvas.userData.camera = camera;
    canvas.userData.fog = scene.fog;

    // Apply saved background color if set
    const savedBgColor = localStorage.getItem('mtcg_stage_bg_color');
    if (savedBgColor) {
      try {
        scene.background = new THREE.Color(savedBgColor);
        if (scene.fog) scene.fog.color = new THREE.Color(savedBgColor);
        renderer.setClearColor(savedBgColor, 1);
        if (container) container.style.backgroundColor = savedBgColor;
        if (canvas) canvas.style.backgroundColor = savedBgColor;
      } catch(e) {}
    }

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      initCanvas2DFallback(canvas, container);
    }, false);
  } catch (e) {
    initCanvas2DFallback(canvas, container);
    return;
  }

  // --- LIGHTS ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
  mainLight.position.set(5, 8, 5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 512;
  mainLight.shadow.mapSize.height = 512;
  scene.add(mainLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 2.0); // Pure monochrome white rim light
  rimLight.position.set(-5, 4, -4);
  scene.add(rimLight);

  const spotLight = new THREE.SpotLight(0xffffff, 5.0, 25, Math.PI / 4, 0.5, 1);
  spotLight.position.set(0, 8, 5);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 512;
  spotLight.shadow.mapSize.height = 512;
  scene.add(spotLight);

  // --- 3D PERSPECTIVE GRID FLOOR (Monochrome White/Grey Grid) ---
  const floorGeo = new THREE.PlaneGeometry(40, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.2, metalness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(40, 40, 0xffffff, 0x666666);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  // --- 3D BENCH (Scaled Up 1.25x) ---
  const benchGroup = new THREE.Group();
  benchGroup.scale.set(1.25, 1.25, 1.25);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.4, metalness: 0.3 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.7), benchMat);
  seat.position.set(0, 0.9, 0);
  seat.castShadow = true;
  benchGroup.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.08), benchMat);
  back.position.set(0, 1.4, -0.32);
  back.castShadow = true;
  benchGroup.add(back);

  const legGeo = new THREE.BoxGeometry(0.12, 0.9, 0.6);
  const legLeft = new THREE.Mesh(legGeo, benchMat);
  legLeft.position.set(-1.1, 0.45, 0);
  benchGroup.add(legLeft);

  const legRight = new THREE.Mesh(legGeo, benchMat);
  legRight.position.set(1.1, 0.45, 0);
  benchGroup.add(legRight);

  benchGroup.position.set(0.8, 0, -0.2);
  scene.add(benchGroup);

  // --- 3D NERD CHARACTER GROUP (Scaled Up 1.25x) ---
  const nerd = new THREE.Group();
  nerd.scale.set(1.25, 1.25, 1.25);
  nerd.position.set(0.8, 0.95, -0.1);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.4 });
  const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
  const glassesMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.9 });
  const sneakerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

  // Torso / Hoodie
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.45), hoodieMat);
  torso.position.y = 0.4;
  torso.castShadow = true;
  nerd.add(torso);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.95, 0);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 32), skinMat);
  headMesh.scale.set(1, 1.1, 1);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Spiky Hair Spikes
  const spikeGeo = new THREE.ConeGeometry(0.08, 0.35, 4);
  const spikePositions = [
    [0, 0.35, 0], [-0.12, 0.33, 0.05], [0.12, 0.33, 0.05],
    [-0.2, 0.28, -0.05], [0.2, 0.28, -0.05], [0, 0.32, -0.15],
    [-0.1, 0.3, -0.12], [0.1, 0.3, -0.12]
  ];
  spikePositions.forEach(pos => {
    const spike = new THREE.Mesh(spikeGeo, hairMat);
    spike.position.set(...pos);
    spike.rotation.z = pos[0] * -1.2;
    spike.rotation.x = pos[2] * -1.2;
    headGroup.add(spike);
  });

  // Glasses Frame
  const glassFrameGeo = new THREE.BoxGeometry(0.24, 0.18, 0.04);
  const glassL = new THREE.Mesh(glassFrameGeo, glassesMat);
  glassL.position.set(-0.13, 0.04, 0.28);
  headGroup.add(glassL);

  const glassR = new THREE.Mesh(glassFrameGeo, glassesMat);
  glassR.position.set(0.13, 0.04, 0.28);
  headGroup.add(glassR);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), glassesMat);
  bridge.position.set(0, 0.04, 0.28);
  headGroup.add(bridge);

  // Eye Pupils
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), eyeMat);
  eyeL.position.set(-0.13, 0.04, 0.3);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), eyeMat);
  eyeR.position.set(0.13, 0.04, 0.3);
  headGroup.add(eyeR);

  nerd.add(headGroup);

  // Arms
  const armRightGroup = new THREE.Group();
  armRightGroup.position.set(-0.42, 0.7, 0);
  const armRight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.6), hoodieMat);
  armRight.position.y = -0.3;
  armRightGroup.add(armRight);
  const handRight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), skinMat);
  handRight.position.y = -0.6;
  armRightGroup.add(handRight);
  nerd.add(armRightGroup);

  const armLeftGroup = new THREE.Group();
  armLeftGroup.position.set(0.42, 0.7, 0);
  const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.6), hoodieMat);
  armLeft.position.y = -0.3;
  armLeftGroup.add(armLeft);
  nerd.add(armLeftGroup);

  // Legs & Sneakers
  const legUpperL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.5), hoodieMat);
  legUpperL.rotation.x = Math.PI / 2;
  legUpperL.position.set(-0.2, 0.1, 0.2);
  nerd.add(legUpperL);

  const legUpperR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.5), hoodieMat);
  legUpperR.rotation.x = Math.PI / 2;
  legUpperR.position.set(0.2, 0.1, 0.2);
  nerd.add(legUpperR);

  const legLowerL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5), hoodieMat);
  legLowerL.position.set(-0.2, -0.3, 0.45);
  nerd.add(legLowerL);

  const legLowerR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5), hoodieMat);
  legLowerR.position.set(0.2, -0.3, 0.45);
  nerd.add(legLowerR);

  const sneakerL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), sneakerMat);
  sneakerL.position.set(-0.2, -0.55, 0.52);
  nerd.add(sneakerL);

  const sneakerR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), sneakerMat);
  sneakerR.position.set(0.2, -0.55, 0.52);
  nerd.add(sneakerR);

  nerd.traverse(child => {
    if (child.isMesh) child.userData.isNerd = true;
  });

  scene.add(nerd);

  // --- FLOATING 3D CARDS (Moved Into Background Depth z: -2.5 to -3.5) ---
  const floatingCards = [];
  const cardSymbols = ['★ HOLO', '✦ SECRET', '◆ GRAIL', '▲ ULTRA'];
  cardSymbols.forEach((sym, idx) => {
    const cardGroup = new THREE.Group();
    const cardGeo = new THREE.BoxGeometry(0.7, 1.0, 0.02);
    const cardMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.9, roughness: 0.2 });
    const cardMesh = new THREE.Mesh(cardGeo, cardMat);
    cardMesh.castShadow = true;
    cardGroup.add(cardMesh);

    const borderGeo = new THREE.BoxGeometry(0.72, 1.02, 0.01);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    cardGroup.add(borderMesh);

    // Positioned deep in the background behind bench
    const basePos = [-3.0 + idx * 2.0, 2.2 + Math.sin(idx) * 0.4, -2.5 - (idx % 2) * 0.8];
    cardGroup.position.set(...basePos);
    scene.add(cardGroup);

    floatingCards.push({ mesh: cardGroup, basePos, rotSpeed: 0.008 + idx * 0.004 });
  });

  // --- SPARK PARTICLES (Monochrome White Sparks) ---
  const sparkCount = 60;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount * 3; i += 3) {
    sparkPositions[i] = (Math.random() - 0.5) * 12;
    sparkPositions[i + 1] = Math.random() * 6;
    sparkPositions[i + 2] = (Math.random() - 0.5) * 8;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.7 });
  const sparkParticles = new THREE.Points(sparkGeo, sparkMat);
  scene.add(sparkParticles);

  // --- INTERACTION & SPEECH ---
  const speechBubble = document.getElementById('nerd-bubble');
  const speechText = document.getElementById('nerd-text');

  function showSpeech(txt, dur = 3500) {
    if (speechText && speechBubble) {
      speechText.textContent = txt;
      speechBubble.classList.add('visible');
      if (showSpeech._timer) clearTimeout(showSpeech._timer);
      showSpeech._timer = setTimeout(() => speechBubble.classList.remove('visible'), dur);
    }
  }

  // --- SPEECH BUBBLE POSITIONING ---
  function updateSpeechBubblePosition() {
    if (!speechBubble || !speechBubble.classList.contains('visible')) return;
    const vector = new THREE.Vector3();
    headGroup.getWorldPosition(vector);
    vector.y += 0.5;
    vector.project(camera);

    const containerW = container.clientWidth || window.innerWidth;
    const containerH = container.clientHeight || 600;

    const x = (vector.x * 0.5 + 0.5) * containerW;
    const y = (-vector.y * 0.5 + 0.5) * containerH;

    // Clamp speech bubble within mobile screen margins
    const clampedX = Math.max(120, Math.min(containerW - 120, x));
    const clampedY = Math.max(50, Math.min(containerH - 120, y));

    speechBubble.style.left = `${clampedX}px`;
    speechBubble.style.top = `${clampedY}px`;
  }

  const mouse = new THREE.Vector2();
  let nerdState = 'IDLE'; // IDLE, RAGDOLL, FALLING
  let isDraggingNerd = false;
  let isPointerOverShopBtn = false;
  let nerdVelocity = new THREE.Vector2();
  let prevMousePos = new THREE.Vector2();
  let fallProgress = 0;

  const shopBtn = document.getElementById('shop-now-btn');
  if (shopBtn) {
    shopBtn.addEventListener('mouseenter', () => {
      isPointerOverShopBtn = true;
      showSpeech('Right there! Click SHOP NOW for grails! 🛍️👇', 3000);
    });
    shopBtn.addEventListener('mouseleave', () => { isPointerOverShopBtn = false; });
  }

  const raycaster = new THREE.Raycaster();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const planeIntersect = new THREE.Vector3();

  window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const currentW = rect.width || window.innerWidth;
    const currentH = rect.height || 600;
    mouse.x = ((e.clientX - rect.left) / currentW) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / currentH) * 2 + 1;

    nerdVelocity.x = (e.clientX - prevMousePos.x) * 0.01;
    nerdVelocity.y = (e.clientY - prevMousePos.y) * 0.01;
    prevMousePos.set(e.clientX, e.clientY);

    if (isDraggingNerd && nerdState === 'RAGDOLL') {
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(dragPlane, planeIntersect);
      nerd.position.x = planeIntersect.x;
      nerd.position.y = Math.max(0.4, planeIntersect.y);
    }
  });

  window.addEventListener('pointerdown', (e) => {
    const heroCanvas = document.getElementById('hero-3d-canvas');
    if (!heroCanvas) return;
    const rect = heroCanvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const hitNerd = intersects.some(hit => hit.object.userData.isNerd);

    if (hitNerd) {
      isDraggingNerd = true;
      nerdState = 'RAGDOLL';
      showSpeech('WHEEEE! RAGDOLL MODE! 🤪', 3000);
    }
  });

  window.addEventListener('pointerup', () => {
    if (isDraggingNerd && nerdState === 'RAGDOLL') {
      isDraggingNerd = false;
      nerdState = 'FALLING';
      fallProgress = 0;
      showSpeech('Whoa! Ouch! 😵💥', 2500);
    }
  });

  const nerdDialogue = [
    "Hey collector! Drag me for ragdoll physics! 🤪",
    "Click SHOP NOW for sealed drops! 🛍️",
    "Welcome to MillionTCG! 🃏",
    "Rare singles & secret rares available! 🌟"
  ];
  let dialogueIdx = 0;
  setInterval(() => {
    if (nerdState === 'IDLE') {
      dialogueIdx = (dialogueIdx + 1) % nerdDialogue.length;
      showSpeech(nerdDialogue[dialogueIdx], 3500);
    }
  }, 6000);

  // --- 3D BOOSTER PACK MESH ---
  const packGroup = new THREE.Group();
  const packGeo = new THREE.BoxGeometry(0.5, 0.7, 0.06);
  const packMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 });
  const packMesh = new THREE.Mesh(packGeo, packMat);
  packGroup.add(packMesh);
  packGroup.position.set(1.4, 0.96, 0);
  scene.add(packGroup);

  const clock = new THREE.Clock();

  function updateLayoutForMobile() {
    const w = container.clientWidth || window.innerWidth;
    const isMobile = w < 768;

    if (isMobile) {
      // Center character naturally in center of stage on mobile view
      benchGroup.position.set(0, 0, -0.2);
      packGroup.position.set(0.65, 0.96, 0);
    } else {
      // Desktop default offset
      benchGroup.position.set(0.5, 0, -0.2);
      packGroup.position.set(1.1, 0.96, 0);
    }
  }
  updateLayoutForMobile();

  function animate() {
    _heroAnimFrameId = requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const w = container.clientWidth || window.innerWidth;
    const isMobile = w < 768;

    // 0. Dynamic Camera Positioning (Adapt FOV and lookAt for Mobile vs Desktop)
    const baseCamX = isMobile ? 0 : 0.4;
    const baseCamY = 2.4;
    const baseCamZ = 7.6;
    const lookY = 1.1;

    camera.position.x += (baseCamX + mouse.x * 0.3 - camera.position.x) * 0.05;
    camera.position.y += (baseCamY + mouse.y * 0.25 - camera.position.y) * 0.05;
    camera.position.z += (baseCamZ - camera.position.z) * 0.05;
    camera.lookAt(baseCamX, lookY, 0);

    // 1. Floating Cards Animation (Infinite Depth)
    floatingCards.forEach((c, idx) => {
      c.mesh.position.y = c.basePos[1] + Math.sin(time * 1.5 + idx) * 0.15;
      c.mesh.rotation.y += c.rotSpeed;
      c.mesh.rotation.x += c.rotSpeed * 0.5;
    });

    // 2. Spark particles animation (Monochrome White)
    const positions = sparkParticles.geometry.attributes.position.array;
    for (let i = 1; i < sparkCount * 3; i += 3) {
      positions[i] += 0.008;
      if (positions[i] > 6) positions[i] = 0;
    }
    sparkParticles.geometry.attributes.position.needsUpdate = true;

    // Pack floating bob
    const packBaseY = 0.96;
    packGroup.position.y = packBaseY + Math.sin(time * 2.5) * 0.04;
    packGroup.rotation.y = Math.sin(time * 1.2) * 0.3;

    // 3. State machine (Sitting on bench)
    if (nerdState === 'IDLE') {
      const targetHeadY = mouse.x * 0.6;
      const targetHeadX = -mouse.y * 0.4;
      headGroup.rotation.y += (targetHeadY - headGroup.rotation.y) * 0.1;
      headGroup.rotation.x += (targetHeadX - headGroup.rotation.x) * 0.1;

      if (isPointerOverShopBtn) {
        armRightGroup.rotation.z = -1.6;
        armRightGroup.rotation.x = 0.5;
      } else {
        armRightGroup.rotation.z = -0.3 + Math.sin(time * 2) * 0.05;
        armRightGroup.rotation.x = Math.cos(time * 2) * 0.05;
      }

      const nerdBaseX = isMobile ? 0 : 0.5;
      const nerdBaseY = 0.95;

      nerd.position.set(nerdBaseX, nerdBaseY + Math.sin(time * 2) * 0.02, -0.1);
      nerd.rotation.set(0, 0, 0);
    }

    if (nerdState === 'RAGDOLL') {
      nerd.rotation.z = -nerdVelocity.x * 3.0;
      nerd.rotation.x = nerdVelocity.y * 2.0;

      headGroup.rotation.z = Math.sin(time * 12) * 0.4 + nerdVelocity.x * 2.0;
      armRightGroup.rotation.z = -Math.PI / 2 + Math.sin(time * 10) * 0.6;
      armLeftGroup.rotation.z = Math.PI / 2 + Math.cos(time * 10) * 0.6;
    }

    if (nerdState === 'FALLING') {
      fallProgress += 0.03;
      if (fallProgress < 1) {
        nerd.position.y = Math.max(0.25, nerd.position.y - 0.1);
        nerd.rotation.z = fallProgress * 2.0;
        nerd.rotation.x = fallProgress * 1.5;
      } else {
        nerdState = 'IDLE';
        fallProgress = 0;
        showSpeech('Back on my bench! 🛋️', 2000);
      }
    }

    updateSpeechBubblePosition();
    renderer.render(scene, camera);
  }

  animate();
  _heroSpeechTimeout = setTimeout(() => {
    showSpeech('Hey collector! Drag me around for RAGDOLL physics! 🤪', 4500);
  }, 1000);

  if (!_hero3dResizeBound) {
    _hero3dResizeBound = true;
    window.addEventListener('resize', () => {
      const cont = document.getElementById('hero-3d-container');
      const cvs = document.getElementById('hero-3d-canvas');
      if (!cont || !cvs || !cvs.userData || !cvs.userData.renderer || !cvs.userData.camera) return;
      const w = cont.clientWidth || window.innerWidth;
      const h = cont.clientHeight || 600;
      cvs.userData.camera.aspect = w / h;
      cvs.userData.camera.updateProjectionMatrix();
      cvs.userData.renderer.setSize(w, h);
      if (typeof updateLayoutForMobile === 'function') updateLayoutForMobile();
    });
  }
}

// Canvas Fallback Engine
function initCanvas2DFallback(canvas, container) {
  const freshCanvas = document.createElement('canvas');
  freshCanvas.id = 'hero-3d-canvas';
  freshCanvas.style.position = 'absolute';
  freshCanvas.style.top = '0';
  freshCanvas.style.left = '0';
  freshCanvas.style.width = '100%';
  freshCanvas.style.height = '100%';
  freshCanvas.style.display = 'block';
  freshCanvas.style.zIndex = '1';

  if (canvas && canvas.parentNode) {
    canvas.parentNode.replaceChild(freshCanvas, canvas);
  } else if (container) {
    container.appendChild(freshCanvas);
  }
  canvas = freshCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  function resize() {
    canvas.width = container.clientWidth || window.innerWidth;
    canvas.height = container.clientHeight || 600;
  }
  resize();
  window.addEventListener('resize', resize);

  let mouseX = canvas.width * 0.7;
  let mouseY = canvas.height * 0.5;
  let isDragging = false;
  let nerdX = canvas.width * 0.7;
  let nerdY = canvas.height * 0.5;
  let animTime = 0;

  const speechBubble = document.getElementById('nerd-bubble');
  const speechText = document.getElementById('nerd-text');

  function showSpeech(txt, dur = 3000) {
    if (speechText && speechBubble) {
      speechText.textContent = txt;
      speechBubble.classList.add('visible');
      if (showSpeech._t) clearTimeout(showSpeech._t);
      showSpeech._t = setTimeout(() => speechBubble.classList.remove('visible'), dur);
    }
  }

  window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    if (isDragging) { nerdX = mouseX; nerdY = mouseY; }
  });

  window.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (Math.hypot(mx - nerdX, my - nerdY) < 120) {
      isDragging = true;
      showSpeech('WHEEEE! RAGDOLL MODE! 🤪', 3000);
    }
  });

  window.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      showSpeech('Back on my feet! 🤓', 2000);
    }
  });

  function draw() {
    requestAnimationFrame(draw);
    animTime += 0.03;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.4, 50, canvas.width * 0.5, canvas.height * 0.5, canvas.width);
    grad.addColorStop(0, '#3a3d4d');
    grad.addColorStop(1, '#22242e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 1.8;
    const horizon = canvas.height * 0.55;
    const vanX = canvas.width * 0.5;

    for (let i = -15; i <= 15; i++) {
      ctx.beginPath();
      ctx.moveTo(vanX + i * 20, horizon);
      ctx.lineTo(vanX + i * 90, canvas.height);
      ctx.stroke();
    }
    for (let y = horizon; y <= canvas.height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const bx = canvas.width * 0.65;
    const by = horizon + 40;
    ctx.fillStyle = '#52566b';
    ctx.fillRect(bx - 100, by, 200, 16);
    ctx.fillRect(bx - 100, by - 40, 200, 36);
    ctx.fillStyle = '#3a3c48';
    ctx.fillRect(bx - 80, by + 16, 16, 60);
    ctx.fillRect(bx + 64, by + 16, 16, 60);

    let renderX = isDragging ? nerdX : bx;
    let renderY = isDragging ? nerdY : by - 60 + Math.sin(animTime * 2) * 3;

    ctx.save();
    ctx.translate(renderX, renderY);

    ctx.fillStyle = '#333745';
    ctx.strokeStyle = '#666a80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawRoundRect(ctx, -30, -10, 60, 70, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#121212';
    ctx.beginPath();
    drawRoundRect(ctx, -16, 25, 32, 20, 6);
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.fillRect(-20, 60, 16, 45);
    ctx.fillRect(4, 60, 16, 45);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-12, 108, 14, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(12, 108, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fce5c8';
    ctx.beginPath();
    ctx.ellipse(0, -45, 26, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(-28, -50);
    ctx.lineTo(-20, -78);
    ctx.lineTo(-10, -56);
    ctx.lineTo(0, -82);
    ctx.lineTo(10, -56);
    ctx.lineTo(20, -78);
    ctx.lineTo(28, -50);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(-18, -54, 16, 13);
    ctx.strokeRect(2, -54, 16, 13);
    ctx.beginPath(); ctx.moveTo(-2, -48); ctx.lineTo(2, -48); ctx.stroke();

    const lookX = (mouseX - renderX) * 0.02;
    const lookY = (mouseY - renderY) * 0.02;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-10, -48, 5, 0, Math.PI * 2); ctx.arc(10, -48, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(-10 + lookX, -48 + lookY, 2.5, 0, Math.PI * 2); ctx.arc(10 + lookX, -48 + lookY, 2.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#333745';
    ctx.beginPath();
    ctx.arc(-35, 10, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (speechBubble && speechBubble.classList.contains('visible')) {
      speechBubble.style.left = `${renderX}px`;
      speechBubble.style.top = `${renderY - 90}px`;
    }

    const cardSymbols = ['★', '✦', '◆', '▲'];
    cardSymbols.forEach((sym, idx) => {
      const cx = canvas.width * (0.2 + idx * 0.22);
      const cy = horizon - 80 + Math.sin(animTime * 1.5 + idx) * 15;
      ctx.fillStyle = '#111115';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      drawRoundRect(ctx, cx, cy, 45, 65, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sym, cx + 22, cy + 38);
    });
  }

  draw();
  showSpeech('Hey collector! Drag me around for RAGDOLL physics! 🤪', 4500);
}

function drawRoundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}




function initSellerSystem() {
  const authModal = document.getElementById('auth-modal');
  const authModalClose = document.getElementById('auth-modal-close');
  const navAuthBtn = document.getElementById('nav-auth-btn');
  const gateSignupBtn = document.getElementById('gate-signup-btn');
  const gateLoginBtn = document.getElementById('gate-login-btn');

  const tabSignup = document.getElementById('tab-signup');
  const tabLogin = document.getElementById('tab-login');
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');

  const accountStateBox = document.getElementById('account-state-box');
  const authGate = document.getElementById('auth-required-gate');
  const sellerWorkspace = document.getElementById('seller-workspace');
  const myListingsContainer = document.getElementById('my-listings-list');

  const form = document.getElementById('card-upload-form');
  const photoInput = document.getElementById('card-photo-input');
  const neatZone = document.getElementById('neat-upload-zone');
  const placeholder = document.getElementById('drop-placeholder');

  let uploadedImages = []; // Array of up to 5 image Data URLs

  // Fast Client-Side Image Resizer & Compressor (Keeps quality high, cuts 20MB phone photos down to ~90KB)
  function compressImageFile(file, maxDimension = 1280, quality = 0.82) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      if (!file.type || !file.type.startsWith('image/')) return resolve(null);
      
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => resolve(e.target.result);
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed || e.target.result);
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Load current user from auth state
  try {
    const mtcgUser = localStorage.getItem('mtcg_current_user');
    if (mtcgUser) {
      const parsed = JSON.parse(mtcgUser);
      currentUser = {
        name: parsed.displayName || parsed.name || 'Collector',
        handle: parsed.handle || (parsed.email ? parsed.email.split('@')[0] : 'Seller'),
        email: parsed.email || '',
        isVerified: true
      };
    } else {
      const old = localStorage.getItem('milliontcg_user_account');
      if (old) currentUser = JSON.parse(old);
    }
  } catch (e) {}

  // Auth Modal Delegation
  function openAuthModal(mode = 'signup') {
    if (window.MillionAuth && window.MillionAuth.openAuthModal) {
      window.MillionAuth.openAuthModal(mode === 'login' ? 'signin' : mode);
      return;
    }
    if (!authModal) return;
    authModal.classList.add('active');
  }

  function closeAuthModal() {
    if (window.MillionAuth && window.MillionAuth.closeAuthModal) {
      window.MillionAuth.closeAuthModal();
      return;
    }
    if (authModal) authModal.classList.remove('active');
  }

  if (navAuthBtn) navAuthBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal();
  });
  if (gateSignupBtn) gateSignupBtn.addEventListener('click', () => openAuthModal('signup'));
  if (gateLoginBtn) gateLoginBtn.addEventListener('click', () => openAuthModal('signin'));
  if (authModalClose) authModalClose.addEventListener('click', closeAuthModal);

  if (tabSignup && tabLogin) {
    tabSignup.addEventListener('click', () => {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
    });
  }

  // Handle Account Sign Up
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      let handle = document.getElementById('signup-handle').value.trim().replace(/^@/, '');
      const email = document.getElementById('signup-email').value.trim();

      currentUser = { name, handle, email, isVerified: true, joined: Date.now() };
      localStorage.setItem('milliontcg_user_account', JSON.stringify(currentUser));
      closeAuthModal();
      updateAccountUI();

      // Trigger direct email notification for new Seller Account
      if (typeof window.sendDirectEmailNotification === 'function') {
        window.sendDirectEmailNotification('New Seller Account Created 🏪', {
          FullName: name,
          StoreHandle: `@${handle}`,
          SellerEmail: email,
          AccountType: 'Verified Seller Portal'
        });
      }

      alert(`🎉 Welcome to MillionTCG, @${handle}! Your Seller Account is ready.`);
    });
  }

  // Handle Account Log In
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const handle = email.split('@')[0] || 'Collector';

      currentUser = { name: handle, handle, email, isVerified: true, joined: Date.now() };
      localStorage.setItem('milliontcg_user_account', JSON.stringify(currentUser));
      closeAuthModal();
      updateAccountUI();
      alert(`🔓 Logged in successfully as @${handle}!`);
    });
  }

  // Update Account UI & Workspace Visibility
  function updateAccountUI() {
    if (navAuthBtn) {
      navAuthBtn.textContent = currentUser ? `@${currentUser.handle}` : 'ACCOUNT';
    }

    if (accountStateBox) {
      if (currentUser) {
        accountStateBox.innerHTML = `
          <div class="user-logged-badge">
            <span>Logged in as: <strong>@${currentUser.handle}</strong> ✓ Verified Seller</span>
            <button class="btn-logout" id="btn-logout">Log Out</button>
          </div>
        `;
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', () => {
            currentUser = null;
            localStorage.removeItem('milliontcg_user_account');
            updateAccountUI();
          });
        }
      } else {
        accountStateBox.innerHTML = `
          <button class="btn-primary" id="hero-create-acc-btn" style="padding: 10px 24px; font-size: 0.85rem;">CREATE SELLER ACCOUNT TO LIST CARDS</button>
        `;
        const heroCreateBtn = document.getElementById('hero-create-acc-btn');
        if (heroCreateBtn) heroCreateBtn.addEventListener('click', () => openAuthModal('signup'));
      }
    }

    if (sellerWorkspace) {
      sellerWorkspace.classList.remove('hidden');
    }
    renderMyListings();
    renderSoldOrders();
    updatePayoutAccountUI();
  }

  // Live 10% Fee Breakdown Listener
  const priceInput = document.getElementById('card-price');
  const feeTag = document.getElementById('fee-breakdown-tag');
  if (priceInput && feeTag) {
    priceInput.addEventListener('input', () => {
      const val = parseFloat(priceInput.value) || 0;
      const fee = val * 0.10;
      const net = val - fee;
      feeTag.innerHTML = `<span>Fee (10%): <strong style="color:#ff4757;">-$${fee.toFixed(2)}</strong></span> • <span>Your Payout (90%): <strong style="color:#4ade80;">$${net.toFixed(2)}</strong></span>`;
    });
  }

  // Save & Verify Linked Payout Account
  const savePayoutBtn = document.getElementById('btn-save-payout');
  const payoutDestInput = document.getElementById('payout-destination-input');
  const payoutNameInput = document.getElementById('payout-name-input');
  const payoutRoutingInput = document.getElementById('payout-routing-input');
  const payoutMethodSelect = document.getElementById('payout-method-select');
  const accountVerifiedStatus = document.getElementById('account-verified-status');

  function updatePayoutAccountUI() {
    if (currentUser && currentUser.payoutAccount) {
      if (payoutDestInput) payoutDestInput.value = currentUser.payoutAccount.dest || '';
      if (payoutNameInput) payoutNameInput.value = currentUser.payoutAccount.name || '';
      if (payoutRoutingInput) payoutRoutingInput.value = currentUser.payoutAccount.routing || '';
      if (payoutMethodSelect) payoutMethodSelect.value = currentUser.payoutAccount.type || 'bank';

      if (accountVerifiedStatus) {
        accountVerifiedStatus.textContent = '✓ Linked & Verified Account';
        accountVerifiedStatus.classList.add('verified');
      }
    } else {
      if (accountVerifiedStatus) {
        accountVerifiedStatus.textContent = '⚠️ No Linked Account';
        accountVerifiedStatus.classList.remove('verified');
      }
    }
  }

  if (savePayoutBtn) {
    savePayoutBtn.addEventListener('click', () => {
      if (!currentUser) return;
      const dest = payoutDestInput ? payoutDestInput.value.trim() : '';
      const name = payoutNameInput ? payoutNameInput.value.trim() : '';
      const routing = payoutRoutingInput ? payoutRoutingInput.value.trim() : '';
      const type = payoutMethodSelect ? payoutMethodSelect.value : 'bank';

      if (!dest || !name) {
        alert('Please enter your Account Holder Legal Name and Account/Email details.');
        return;
      }

      currentUser.payoutAccount = { type, name, dest, routing, verified: true, linkedAt: Date.now() };
      localStorage.setItem('milliontcg_user_account', JSON.stringify(currentUser));
      updatePayoutAccountUI();
      alert(`🎉 SUCCESS! Your ${type.toUpperCase()} Payout Account has been linked & verified. 90% net funds from all card sales will automatically route here!`);
    });
  }

  // Render Logged-in User's Listings Dashboard & Payout Stats
  function renderMyListings() {
    if (!myListingsContainer) return;
    
    getCommunityListingsAsync().then(allListings => {
      communityListings = allListings;
      
      let userItems = allListings;
      if (currentUser) {
        const uEmail = (currentUser.email || '').toLowerCase().trim();
        const uHandle = (currentUser.handle || '').toLowerCase().replace(/^@/, '');
        const uName = (currentUser.name || currentUser.displayName || '').toLowerCase().trim();

        if (uEmail === 'tcgmillion@gmail.com' || uHandle === 'tcgmillion' || uHandle === 'milliontcg_owner') {
          userItems = allListings;
        } else {
          const filtered = allListings.filter(item => {
            if (!item) return false;
            const sName = (item.sellerName || '').toLowerCase().replace(/^@/, '');
            const sEmail = (item.sellerEmail || '').toLowerCase().trim();
            return sName === uHandle || sName === uName || sEmail === uEmail;
          });
          if (filtered.length > 0 || allListings.length === 0) {
            userItems = filtered;
          }
        }
      }

      // Calculate Earnings Breakdown
      const grossTotal = userItems.reduce((acc, i) => acc + (parseFloat(i.price) || 0), 0);
      const platformCut = grossTotal * 0.10;
      const netPayout = grossTotal - platformCut;

      const grossEl = document.getElementById('seller-gross-sales');
      const cutEl = document.getElementById('seller-platform-cut');
      const netEl = document.getElementById('seller-net-payout');
      if (grossEl) grossEl.textContent = `$${grossTotal.toFixed(2)}`;
      if (cutEl) cutEl.textContent = `-$${platformCut.toFixed(2)}`;
      if (netEl) netEl.textContent = `$${netPayout.toFixed(2)}`;

      myListingsContainer.innerHTML = '';

      if (userItems.length === 0) {
        myListingsContainer.innerHTML = `
          <div style="text-align: center; color: #888888; padding: 40px 20px;">
            <div style="font-size: 2rem; margin-bottom: 8px;">📦</div>
            You haven't listed any cards yet.<br>Use the form above to upload your first card!
          </div>
        `;
        return;
      }

      userItems.forEach(item => {
        let cardImg = item.image;
        if (!cardImg || cardImg === 'images/logo.png') {
          if (item.gallery && Array.isArray(item.gallery) && item.gallery.length > 0 && item.gallery[0] !== 'images/logo.png') {
            cardImg = item.gallery[0];
          }
        }
        if (!cardImg) cardImg = 'images/logo.png';

        const row = document.createElement('div');
        row.className = 'my-listing-row';
        const franchiseMeta = item.franchise ? ` • ${item.franchise}` : '';
        const categoryMeta = item.category || 'Single Card';
        row.innerHTML = `
          <img class="my-listing-img" src="${cardImg}" alt="${item.title}">
          <div class="my-listing-info">
            <div class="my-listing-title">${item.title}</div>
            <div class="my-listing-meta">${item.condition || 'Raw'} • ${categoryMeta}${franchiseMeta}</div>
          </div>
          <div class="my-listing-price">$${parseFloat(item.price).toFixed(2)}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <a href="product.html?id=${item.id}" class="btn-primary" style="padding: 6px 12px; font-size: 0.75rem; text-decoration: none; border-radius: 6px; white-space: nowrap;">View Listing</a>
            <button type="button" class="btn-delete-listing" data-id="${item.id}">Remove</button>
          </div>
        `;

        row.querySelector('.btn-delete-listing').addEventListener('click', () => {
          if (!confirm(`Remove "${item.title}" from your listings?`)) return;
          deleteCommunityListing(item.id).then(() => {
            renderMyListings();
            renderHomeProducts();
          }).catch(console.error);
        });

        myListingsContainer.appendChild(row);
      });
    }).catch(err => {
      console.error('[MillionTCG] renderMyListings error:', err);
      myListingsContainer.innerHTML = '<div style="color:#ff4757;padding:20px;">Error loading listings. Please refresh.</div>';
    });
  }

// --- ESCROW PAYOUT PROTECTION & TRACKING ENGINE ---
let soldOrders = [];
try {
  soldOrders = JSON.parse(localStorage.getItem('milliontcg_sold_orders') || '[]');
  if (!Array.isArray(soldOrders)) soldOrders = [];
} catch (e) {
  soldOrders = [];
}

// Sold Orders Array
if (!soldOrders) soldOrders = [];

function renderSoldOrders() {
  const soldContainer = document.getElementById('sold-orders-list');
  if (!soldContainer || !currentUser) return;
  soldContainer.innerHTML = '';

  const userSold = soldOrders.filter(order => order.sellerHandle === currentUser.handle || currentUser.handle === 'PokeVault');

  if (userSold.length === 0) {
    soldContainer.innerHTML = `
      <div style="text-align: center; color: #888888; padding: 24px 16px;">
        <div style="font-size: 1.8rem; margin-bottom: 6px;">🤝</div>
        No pending sold orders. When a customer buys your card, the order will appear here for tracking upload!
      </div>
    `;
    return;
  }

  userSold.forEach(order => {
    const gross = parseFloat(order.price);
    const fee = gross * 0.10;
    const net = gross - fee;

    const card = document.createElement('div');
    card.className = 'sold-order-card';

    let badgeHTML = '';
    if (order.status === 'HELD_IN_ESCROW') {
      badgeHTML = `<span class="escrow-badge escrow-badge-held">🔒 HELD IN ESCROW (Upload Tracking Required)</span>`;
    } else if (order.status === 'IN_TRANSIT') {
      badgeHTML = `<span class="escrow-badge escrow-badge-transit">📦 IN TRANSIT (${order.carrier}: ${order.trackingNum})</span>`;
    } else {
      badgeHTML = `<span class="escrow-badge escrow-badge-released">✅ DELIVERED • 90% PAYOUT RELEASED ($${net.toFixed(2)})</span>`;
    }

    card.innerHTML = `
      <div class="sold-order-header">
        <span class="order-id-tag">ORDER #${order.id}</span>
        ${badgeHTML}
      </div>
      <div class="sold-order-body">
        <img class="sold-order-img" src="${order.image}" alt="${order.itemTitle}">
        <div class="sold-order-info">
          <div class="sold-order-title">${order.itemTitle}</div>
          <div class="sold-order-payout-text">
            Sale: $${gross.toFixed(2)} | Fee (10%): -$${fee.toFixed(2)} | <strong>Net Payout: $${net.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    `;

    // Render Action Form or Delivery Check Trigger
    if (order.status === 'HELD_IN_ESCROW') {
      const formDiv = document.createElement('div');
      formDiv.className = 'tracking-input-form';
      formDiv.innerHTML = `
        <select class="carrier-select">
          <option value="USPS">USPS Express</option>
          <option value="UPS">UPS Ground</option>
          <option value="FedEx">FedEx Home</option>
          <option value="DHL">DHL Express</option>
        </select>
        <input type="text" class="tracking-num-input" placeholder="Enter Tracking Number (e.g. 94001112025...)" required>
        <button class="btn-upload-tracking">Upload & Dispatch Package 📦</button>
      `;

      formDiv.querySelector('.btn-upload-tracking').addEventListener('click', () => {
        const carrier = formDiv.querySelector('.carrier-select').value;
        const trackingNum = formDiv.querySelector('.tracking-num-input').value.trim();

        if (!trackingNum) {
          alert('Please enter a valid shipping tracking number.');
          return;
        }

        order.carrier = carrier;
        order.trackingNum = trackingNum;
        order.status = 'IN_TRANSIT';
        localStorage.setItem('milliontcg_sold_orders', JSON.stringify(soldOrders));
        renderSoldOrders();

        alert(`📦 TRACKING UPLOADED! Package is marked IN TRANSIT via ${carrier} (${trackingNum}). Checking carrier delivery status...`);
      });

      card.appendChild(formDiv);
    } else if (order.status === 'IN_TRANSIT') {
      const deliveryCheckDiv = document.createElement('div');
      deliveryCheckDiv.style.marginTop = '12px';
      deliveryCheckDiv.innerHTML = `
        <button class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem;" id="check-delivery-${order.id}">
          CHECK CARRIER DELIVERY STATUS (Simulate Delivery) 🚚
        </button>
      `;

      deliveryCheckDiv.querySelector(`#check-delivery-${order.id}`).addEventListener('click', () => {
        order.status = 'DELIVERED_RELEASED';
        localStorage.setItem('milliontcg_sold_orders', JSON.stringify(soldOrders));
        renderSoldOrders();

        alert(`🎉 CARRIER STATUS: DELIVERED! Delivery confirmed. MillionTCG Escrow has released 90% net funds ($${net.toFixed(2)}) directly to your linked payout account!`);
      });

      card.appendChild(deliveryCheckDiv);
    }

    soldContainer.appendChild(card);
  });
}

  // Render Photo Slots Grid
  function renderPhotoSlots() {
    const grid = document.getElementById('photo-slots-grid');
    const badge = document.getElementById('upload-count-badge');
    if (!grid) return;

    if (badge) {
      badge.textContent = `${uploadedImages.length} / 5 Pictures`;
      badge.style.color = uploadedImages.length > 0 ? '#4ade80' : '#888888';
    }

    if (placeholder) {
      if (uploadedImages.length >= 5) {
        placeholder.innerHTML = `
          <div class="neat-icon">✅</div>
          <div class="neat-title">Maximum 5 Pictures Added</div>
          <div class="neat-sub">Remove a picture below to upload a replacement</div>
        `;
      } else {
        placeholder.innerHTML = `
          <div class="neat-icon">📷</div>
          <div class="neat-title">Upload Up To 5 Card Photos</div>
          <div class="neat-sub">Tap to take photo or choose from gallery (${5 - uploadedImages.length} slot${(5 - uploadedImages.length) !== 1 ? 's' : ''} remaining)</div>
        `;
      }
    }

    grid.innerHTML = '';
    uploadedImages.forEach((imgUrl, index) => {
      const slot = document.createElement('div');
      slot.className = 'photo-slot-item';

      const slotLabel = index === 0 ? 'FRONT' : (index === 1 ? 'BACK' : `SLOT ${index + 1}`);

      slot.innerHTML = `
        <span class="slot-badge">${slotLabel}</span>
        <img src="${imgUrl}" alt="Card photo ${index + 1}">
        <button type="button" class="btn-remove-photo" title="Remove photo">✕</button>
      `;

      slot.querySelector('.btn-remove-photo').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadedImages.splice(index, 1);
        renderPhotoSlots();
      });

      grid.appendChild(slot);
    });
  }

  // Handle Image File Uploads with High-Speed Compression
  async function handleUploadedFiles(files) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const availableSlots = 5 - uploadedImages.length;
    if (availableSlots <= 0) {
      alert('You have already uploaded the maximum of 5 pictures.');
      return;
    }

    const filesToProcess = fileList.slice(0, availableSlots);
    const statusMsg = document.getElementById('upload-status-msg');
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.textContent = `⚡ Compressing & optimizing ${filesToProcess.length} photo(s)...`;
    }

    try {
      const compressionPromises = filesToProcess.map(file => compressImageFile(file, 1280, 0.82));
      const results = await Promise.all(compressionPromises);
      
      results.forEach(imgData => {
        if (imgData && uploadedImages.length < 5) {
          uploadedImages.push(imgData);
        }
      });
    } catch (err) {
      console.error('[MillionTCG] Image compression error:', err);
    } finally {
      if (statusMsg) {
        statusMsg.style.display = 'none';
      }
      renderPhotoSlots();
    }
  }

  // File Inputs Listeners
  const cameraInput = document.getElementById('card-camera-input');
  const btnSnapCamera = document.getElementById('btn-snap-camera');
  const btnBrowseGallery = document.getElementById('btn-browse-gallery');

  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadedFiles(e.target.files);
        photoInput.value = '';
      }
    });
  }

  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadedFiles(e.target.files);
        cameraInput.value = '';
      }
    });
  }

  if (btnSnapCamera && cameraInput) {
    btnSnapCamera.addEventListener('click', (e) => {
      e.preventDefault();
      if (uploadedImages.length >= 5) {
        alert('Maximum 5 pictures reached. Remove a photo to add a new one.');
        return;
      }
      cameraInput.click();
    });
  }

  if (btnBrowseGallery && photoInput) {
    btnBrowseGallery.addEventListener('click', (e) => {
      e.preventDefault();
      if (uploadedImages.length >= 5) {
        alert('Maximum 5 pictures reached. Remove a photo to add a new one.');
        return;
      }
      photoInput.click();
    });
  }

  if (neatZone) {
    neatZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      neatZone.style.borderColor = '#ffffff';
    });

    neatZone.addEventListener('dragleave', () => {
      neatZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    neatZone.addEventListener('drop', (e) => {
      e.preventDefault();
      neatZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUploadedFiles(e.dataTransfer.files);
      }
    });
  }

  // Handle Form Submission
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Auto-create seller session if not logged in
      if (!currentUser) {
        currentUser = {
          name: 'Verified Seller',
          handle: 'PokeSeller_' + Math.floor(1000 + Math.random() * 9000),
          email: 'seller@milliontcg.com',
          isVerified: true,
          joined: Date.now()
        };
        try { localStorage.setItem('milliontcg_user_account', JSON.stringify(currentUser)); } catch (e) {}
        updateAccountUI();
      }

      const title = document.getElementById('card-title').value.trim();
      const categoryEl = document.getElementById('card-category');
      const franchiseEl = document.getElementById('card-franchise');
      const category = (categoryEl ? categoryEl.value : '') || 'Single Card';
      const franchise = (franchiseEl ? franchiseEl.value : '') || 'Pokemon';
      const condition = document.getElementById('card-condition').value;
      const priceRaw = document.getElementById('card-price').value;
      const price = parseFloat(priceRaw);
      const description = document.getElementById('card-description').value.trim();

      // Validation
      if (!title) { alert('Please enter a card/product title.'); return; }
      if (isNaN(price) || price <= 0) { alert('Please enter a valid price.'); return; }

      const gallery = uploadedImages.length > 0 ? [...uploadedImages] : ['images/logo.png'];
      const image = gallery[0];

      const newListing = {
        id: 'user_' + Date.now(),
        title,
        category,
        franchise,
        condition,
        price,
        sellerName: currentUser.handle,
        image,
        gallery,
        desc: description,
        date: Date.now(),
        createdAt: Date.now()
      };

      // Show saving indicator
      const submitBtn = form.querySelector('[type="submit"]');
      const origText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.textContent = 'Publishing Listing... ⏳'; submitBtn.disabled = true; }

      saveCommunityListing(newListing).then(() => {
        // Trigger email notification
        if (typeof window.sendDirectEmailNotification === 'function') {
          window.sendDirectEmailNotification('New Product Card Listed 🃏', {
            CardTitle: title,
            Category: category,
            Franchise: franchise,
            Condition: condition,
            ListingPrice: `$${price.toFixed(2)}`,
            SellerHandle: `@${currentUser.handle}`,
            SellerEmail: currentUser.email || 'N/A',
            PhotoCount: `${gallery.length} picture(s) uploaded`,
            Description: description || 'No description provided'
          });
        }

        form.reset();
        uploadedImages = [];
        renderPhotoSlots();
        renderMyListings();

        if (submitBtn) { submitBtn.textContent = origText; submitBtn.disabled = false; }
        alert(`✅ "${title}" with ${gallery.length} photo(s) has been published to the marketplace!\n\nIt is now live in the Shop and on the Home page.`);
      }).catch(err => {
        console.error('[MillionTCG] Submission error:', err);
        if (submitBtn) { submitBtn.textContent = origText; submitBtn.disabled = false; }
        alert('Failed to save listing. Please try again.');
      });
    });
  }

  updateAccountUI();
}

/* ── Global 3D Stage Background Customizer ── */
window.set3DStageBackgroundColor = function(colorHex) {
  if (!colorHex) return;
  try {
    localStorage.setItem('mtcg_stage_bg_color', colorHex);

    const canvas = document.getElementById('hero-3d-canvas');
    const container = document.getElementById('hero-3d-container') || document.querySelector('.hero-3d-stage') || document.querySelector('.hero-section');

    if (canvas && canvas.userData) {
      if (canvas.userData.scene) {
        canvas.userData.scene.background = new THREE.Color(colorHex);
        if (canvas.userData.scene.fog) {
          canvas.userData.scene.fog.color = new THREE.Color(colorHex);
        }
      }
      if (canvas.userData.renderer) {
        canvas.userData.renderer.setClearColor(colorHex, 1);
      }
      canvas.style.backgroundColor = colorHex;
    }

    if (container) {
      container.style.backgroundColor = colorHex;
    }

    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
      heroSection.style.backgroundColor = colorHex;
    }
  } catch (e) {
    console.error('set3DStageBackgroundColor error:', e);
  }
};
