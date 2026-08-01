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

const PRODUCTS = [
  { 
    id: 17, 
    name: "Pokemon 30th Anniversary Collection – Original Partners Special Art Foil Card Set Vol.2", 
    price: 250.00, 
    category: "Sealed Product", 
    image: "images/pokemon-30th-vol2-boxes.jpg", 
    tag: "PRE-ORDER", 
    desc: "Original Factory Sealed Boxes & Case. Official release June 19, 2026. Features Chikorita, Cyndaquil, Totodile & 9 special art foil promo cards.",
    gallery: [
      "images/pokemon-30th-vol2-boxes.jpg",
      "images/pokemon-30th-vol2-cases.jpg",
      "images/pokemon-30th-vol2-singlebox.png",
      "images/pokemon-30th-vol2-cards.jpg",
      "images/pokemon-30th-vol2-pack.jpg"
    ],
    bundleOptions: [
      { count: 2, label: "2 Boxes Bundle", price: 250.00 },
      { count: 4, label: "4 Boxes Bundle", price: 400.00 },
      { count: 8, label: "8 Boxes (Sealed Case)", price: 600.00 }
    ],
    dispatchTime: "2 Days after order date",
    shippingMethods: "DDP for Euro Countries (10-15 working days) | DAP for Other Countries (3-9 working days)",
    condition: "Original Sealed Boxes & Case",
    bulkNegotiable: true
  },
  {
    id: 101,
    name: "Charizard VMAX Shiny Vault #SV107 (PSA 10 Gem Mint)",
    price: 189.99,
    category: "Single Card",
    image: "images/pokemon-30th-vol2-cards.jpg",
    tag: "PSA 10 GEM MINT",
    desc: "Authentic PSA 10 Gem Mint graded Charizard card with holographic foil finish and certified PSA slab cert #8821941.",
    gallery: [
      "images/pokemon-30th-vol2-cards.jpg",
      "images/pokemon-30th-vol2-singlebox.png",
      "images/pokemon-30th-vol2-boxes.jpg",
      "images/pokemon-30th-vol2-pack.jpg",
      "images/pokemon-30th-vol2-cases.jpg"
    ],
    condition: "PSA 10 Gem Mint Graded",
    dispatchTime: "1 Day Dispatch"
  }
];

// Initialize Cart from localStorage
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem('milliontcg_cart') || '[]');
  if (!Array.isArray(cart)) cart = [];
} catch (e) {
  cart = [];
}

function startApp() {
  try { updateCartUI(); } catch (e) {}
  try { setupCartModal(); } catch (e) {}
  try { setupSearch(); } catch (e) {}
  try { setupMobileMenu(); } catch (e) {}
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
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  let itemToAdd = { ...product };

  if (selectedBundle) {
    itemToAdd.id = `${product.id}_${selectedBundle.count}`;
    itemToAdd.name = `${product.name} (${selectedBundle.label})`;
    itemToAdd.price = selectedBundle.price;
  }

  const existing = cart.find(item => item.id === itemToAdd.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...itemToAdd, quantity: 1 });
  }

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

// Search Functionality Redirect to Shop
function setupSearch() {
  const searchInputs = document.querySelectorAll('.search-input');
  searchInputs.forEach(input => {
    input.onkeypress = (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        window.location.href = `shop.html?search=${encodeURIComponent(input.value.trim())}`;
      }
    };
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
function initHero3DScene() {
  const container = document.getElementById('hero-3d-container');
  const canvas = document.getElementById('hero-3d-canvas');
  if (!container || !canvas) return;

  if (typeof THREE === 'undefined') {
    if (_threeRetryCount < 8) {
      _threeRetryCount++;
      setTimeout(initHero3DScene, 100);
    } else {
      initCanvas2DFallback(canvas, container);
    }
    return;
  }

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || 600;

  if (width === 0 || height === 0) {
    if (_threeRetryCount < 50) {
      _threeRetryCount++;
      setTimeout(initHero3DScene, 100);
    }
    return;
  }

  if (canvas.userData && canvas.userData.initialized) return;
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
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x141416, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  scene.add(mainLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 2.0); // Pure monochrome white rim light
  rimLight.position.set(-5, 4, -4);
  scene.add(rimLight);

  const spotLight = new THREE.SpotLight(0xffffff, 5.0, 25, Math.PI / 4, 0.5, 1);
  spotLight.position.set(0, 8, 5);
  spotLight.castShadow = true;
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
    const rect = canvas.getBoundingClientRect();
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
      benchGroup.position.set(0.8, 0, -0.2);
      packGroup.position.set(1.4, 0.96, 0);
    }
  }
  updateLayoutForMobile();

  function animate() {
    requestAnimationFrame(animate);
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

      const nerdBaseX = isMobile ? 0 : 0.8;
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
  setTimeout(() => {
    showSpeech('Hey collector! Drag me around for RAGDOLL physics! 🤪', 4500);
  }, 1000);

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    updateLayoutForMobile();
  });
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

// --- PEER-TO-PEER SELLER & AUTHENTICATION SYSTEM ---
let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem('milliontcg_user_account') || 'null');
} catch (e) {
  currentUser = null;
}

const DEFAULT_COMMUNITY_LISTINGS = [
  {
    id: 'user_seed_1',
    title: 'Pokémon TCG: Scarlet & Violet 151 Booster Pack (Factory Sealed)',
    category: 'Sealed Product',
    condition: 'Factory Sealed Pack',
    price: 14.99,
    sellerName: 'PokeMaster99',
    image: 'images/pokemon-30th-vol2-pack.jpg',
    gallery: [
      'images/pokemon-30th-vol2-pack.jpg',
      'images/pokemon-30th-vol2-boxes.jpg',
      'images/pokemon-30th-vol2-singlebox.png',
      'images/pokemon-30th-vol2-cards.jpg',
      'images/pokemon-30th-vol2-cases.jpg'
    ],
    desc: 'Unweighted factory sealed Pokemon 151 booster pack containing 10 authentic cards + code card. Direct from booster box case.',
    date: Date.now() - 3600000
  },
  {
    id: 'user_seed_2',
    title: 'Charizard GX Shiny Vault #SV107 (PSA 10 Gem Mint)',
    category: 'Pokemon',
    condition: 'PSA 10 (Gem Mint)',
    price: 189.99,
    sellerName: 'GemMintCollector',
    image: 'images/pokemon-30th-vol2-cards.jpg',
    gallery: [
      'images/pokemon-30th-vol2-cards.jpg',
      'images/pokemon-30th-vol2-singlebox.png',
      'images/pokemon-30th-vol2-boxes.jpg',
      'images/pokemon-30th-vol2-pack.jpg',
      'images/pokemon-30th-vol2-cases.jpg'
    ],
    desc: 'Certified PSA 10 Gem Mint holographic Shiny Vault Charizard. Pristine surface, perfect centering, zero whitening.',
    date: Date.now() - 7200000
  },
  {
    id: 'user_seed_3',
    title: 'Pikachu Special Art Foil 30th Anniversary Promo',
    category: 'Single Card',
    condition: 'Near Mint (Raw)',
    price: 49.99,
    sellerName: 'TokyoTCGVault',
    image: 'images/pokemon-30th-vol2-singlebox.png',
    gallery: [
      'images/pokemon-30th-vol2-singlebox.png',
      'images/pokemon-30th-vol2-cards.jpg',
      'images/pokemon-30th-vol2-boxes.jpg',
      'images/pokemon-30th-vol2-pack.jpg'
    ],
    desc: 'Freshly pulled Pikachu Special Art Promo card from partner collection. Sleeved immediately after opening.',
    date: Date.now() - 10800000
  }
];

function getCommunityListings() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('milliontcg_community_listings') || '[]');
    if (!Array.isArray(list) || list.length === 0) {
      list = DEFAULT_COMMUNITY_LISTINGS;
      localStorage.setItem('milliontcg_community_listings', JSON.stringify(list));
    }
  } catch (e) {
    list = DEFAULT_COMMUNITY_LISTINGS;
  }
  return list;
}

function saveCommunityListing(newListing) {
  const current = getCommunityListings();
  current.unshift(newListing);
  localStorage.setItem('milliontcg_community_listings', JSON.stringify(current));
  window.dispatchEvent(new Event('storage'));
}

let communityListings = getCommunityListings();

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

  // Auth Modal Toggles
  function openAuthModal(mode = 'signup') {
    if (!authModal) return;
    authModal.classList.add('open');
    if (mode === 'signup') {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    } else {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
    }
  }

  function closeAuthModal() {
    if (authModal) authModal.classList.remove('open');
  }

  if (navAuthBtn) navAuthBtn.addEventListener('click', () => openAuthModal(currentUser ? 'signup' : 'signup'));
  if (gateSignupBtn) gateSignupBtn.addEventListener('click', () => openAuthModal('signup'));
  if (gateLoginBtn) gateLoginBtn.addEventListener('click', () => openAuthModal('login'));
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
        document.getElementById('btn-logout').addEventListener('click', () => {
          currentUser = null;
          localStorage.removeItem('milliontcg_user_account');
          updateAccountUI();
        });
      } else {
        accountStateBox.innerHTML = `
          <button class="btn-primary" id="hero-create-acc-btn" style="padding: 10px 24px; font-size: 0.85rem;">CREATE SELLER ACCOUNT TO LIST CARDS</button>
        `;
        document.getElementById('hero-create-acc-btn').addEventListener('click', () => openAuthModal('signup'));
      }
    }

    if (sellerWorkspace) {
      sellerWorkspace.classList.remove('hidden');
      renderMyListings();
      renderSoldOrders();
      updatePayoutAccountUI();
    }
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
    myListingsContainer.innerHTML = '';

    if (!currentUser) return;
    const userItems = communityListings.filter(item => item.sellerName === currentUser.handle);

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

    if (userItems.length === 0) {
      myListingsContainer.innerHTML = `
        <div style="text-align: center; color: #888888; padding: 40px 20px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">📦</div>
          You haven't listed any cards yet.<br>Use the form on the left to upload your first card!
        </div>
      `;
      return;
    }

    userItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'my-listing-row';
      row.innerHTML = `
        <img class="my-listing-img" src="${item.image}" alt="${item.title}">
        <div class="my-listing-info">
          <div class="my-listing-title">${item.title}</div>
          <div class="my-listing-meta">${item.condition} • ${item.category}</div>
        </div>
        <div class="my-listing-price">$${parseFloat(item.price).toFixed(2)}</div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <a href="product.html?id=${item.id}" class="btn-primary" style="padding: 6px 12px; font-size: 0.75rem; text-decoration: none; border-radius: 6px; white-space: nowrap;">View 3D & Zoom 👁️</a>
          <button class="btn-delete-listing" data-id="${item.id}">Remove</button>
        </div>
      `;

      row.querySelector('.btn-delete-listing').addEventListener('click', () => {
        communityListings = communityListings.filter(i => i.id !== item.id);
        localStorage.setItem('milliontcg_community_listings', JSON.stringify(communityListings));
        renderMyListings();
      });

      myListingsContainer.appendChild(row);
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

// Seed Initial Sample Sold Order for Testing Escrow
if (soldOrders.length === 0) {
  soldOrders = [
    {
      id: 'MTCG-88219',
      itemTitle: 'Charizard VMAX Shiny Vault #SV107 (PSA 10)',
      price: 189.99,
      sellerHandle: 'PokeVault',
      image: 'images/pokemon-30th-vol2-singlebox.png',
      status: 'HELD_IN_ESCROW', // HELD_IN_ESCROW, IN_TRANSIT, DELIVERED_RELEASED
      carrier: '',
      trackingNum: '',
      date: Date.now() - 86400000
    }
  ];
  localStorage.setItem('milliontcg_sold_orders', JSON.stringify(soldOrders));
}

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
          <div class="neat-sub">Click or Drag & Drop photos here (${5 - uploadedImages.length} slot${(5 - uploadedImages.length) !== 1 ? 's' : ''} remaining)</div>
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
        e.stopPropagation();
        uploadedImages.splice(index, 1);
        renderPhotoSlots();
      });

      grid.appendChild(slot);
    });
  }

  function handleUploadedFiles(files) {
    const fileList = Array.from(files);
    const availableSlots = 5 - uploadedImages.length;
    if (availableSlots <= 0) {
      alert('You have already uploaded the maximum of 5 pictures.');
      return;
    }

    const filesToRead = fileList.slice(0, availableSlots);
    let loadedCount = 0;

    filesToRead.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedImages.push(event.target.result);
        loadedCount++;
        if (loadedCount === filesToRead.length) {
          renderPhotoSlots();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadedFiles(e.target.files);
        photoInput.value = '';
      }
    });
  }

  if (neatZone) {
    neatZone.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-photo')) return;
      if (uploadedImages.length < 5 && photoInput) {
        photoInput.click();
      }
    });

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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUploadedFiles(e.dataTransfer.files);
      }
    });
  }

  // Handle Submission
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentUser) {
        currentUser = {
          name: 'Verified Seller',
          handle: 'PokeSeller_' + Math.floor(1000 + Math.random() * 9000),
          email: 'seller@milliontcg.com',
          isVerified: true,
          joined: Date.now()
        };
        localStorage.setItem('milliontcg_user_account', JSON.stringify(currentUser));
        updateAccountUI();
      }

      const title = document.getElementById('card-title').value.trim();
      const category = document.getElementById('card-category').value;
      const condition = document.getElementById('card-condition').value;
      const price = parseFloat(document.getElementById('card-price').value);
      const description = document.getElementById('card-description').value.trim();

      const gallery = uploadedImages.length > 0 ? [...uploadedImages] : ['images/logo.png'];
      const image = gallery[0];

      const newListing = {
        id: 'user_' + Date.now(),
        title,
        category,
        condition,
        price,
        sellerName: currentUser.handle,
        image,
        gallery,
        desc: description,
        date: Date.now()
      };

      saveCommunityListing(newListing);
      communityListings = getCommunityListings();

      // Trigger direct email notification for new Card / Product Listed
      if (typeof window.sendDirectEmailNotification === 'function') {
        window.sendDirectEmailNotification('New Product Card Listed 🃏', {
          CardTitle: title,
          Category: category,
          Condition: condition,
          ListingPrice: `$${price.toFixed(2)}`,
          SellerHandle: `@${currentUser.handle}`,
          SellerEmail: currentUser.email || 'N/A',
          PhotoCount: `${gallery.length} pictures uploaded`,
          Description: description || 'No description provided'
        });
      }

      form.reset();
      uploadedImages = [];
      renderPhotoSlots();

      renderMyListings();
      alert(`🎉 SUCCESS! "${title}" with ${gallery.length} picture(s) has been published to your active seller listings!`);
    });
  }

  updateAccountUI();
}
