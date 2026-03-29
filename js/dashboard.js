const API_BASE = '/api';
const PAYMENT_LABELS = {
  cash: 'Cash',
};

let products = [];
let categories = ['All'];
let cart = [];
let selectedCategory = 'All';
let paymentMethod = 'cash';
let orderNumber = 'ORD-0001';
let orderTime = new Date();
let customerBillAmount = 0;
let changeAmount = 0;

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function loadCatalog() {
  const [catalogItems, allCategories] = await Promise.all([
    api('/pos/catalog'),
    api('/categories')
  ]);
  products = catalogItems;
  categories = ['All', ...allCategories.map((c) => c.name)];
}

async function fetchNextOrderNumber() {
  const data = await api('/orders/next-number');
  orderNumber = data.orderNumber;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getCartQty(productId) {
  const item = cart.find(c => c.product.id === productId);
  return item ? item.quantity : 0;
}

function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const tax = 0; // Tax removed for simplicity
  const total = subtotal;
  return { subtotal, tax, total };
}

function getTotalItems() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  container.innerHTML = categories.map(cat => `
    <button class="category-tab ${cat === selectedCategory ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  container.querySelectorAll('.category-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.category;
      renderCategoryTabs();
      renderProductGrid();
    });
  });
}

function renderProductGrid() {
  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category === selectedCategory);

  document.getElementById('productCount').textContent = `${filteredProducts.length} items`;

  const container = document.getElementById('productGrid');
  container.innerHTML = filteredProducts.map(product => {
    const qty = getCartQty(String(product.id));
    const inCart = qty > 0;
    const outOfStock = Number(product.quantity) <= 0;
    return `
      <button class="product-tile ${inCart ? 'in-cart' : ''} ${outOfStock ? 'out-of-stock' : ''}" data-id="${product.id}" ${outOfStock ? 'disabled' : ''}>
        ${inCart ? `<div class="badge">${qty}</div>` : ''}
        <div class="image-wrapper">
          <img src="${product.image}" alt="${product.name}" />
          <div class="gradient"></div>
        </div>
        <div class="tile-info">
          <p class="name">${product.name}</p>
          <p class="desc">${product.description}</p>
          <div class="bottom">
            <span class="price">₱${product.price.toFixed(2)}</span>
            ${outOfStock
              ? `<span class="out-of-stock-label">Out of stock</span>`
              : `<div class="add-btn">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>`
            }
          </div>
        </div>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.product-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = String(btn.dataset.id);
      addToCart(productId);

      // Flash effect
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 350);
    });
  });
}

function renderCart() {
  const container = document.getElementById('cartItems');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="icon-wrapper">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <div class="text">
          <p>Cart is empty</p>
          <p>Tap a product to add it</p>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.product.image}" alt="${item.product.name}" />
        <div class="info">
          <p class="name">${item.product.name}</p>
          <p class="price">₱${(item.product.price * item.quantity).toFixed(2)}</p>
          <p class="unit-price">₱${item.product.price.toFixed(2)} each</p>
        </div>
        <div class="controls">
          <button class="btn-minus" data-id="${item.product.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <input
            class="qty-input"
            data-id="${item.product.id}"
            type="number"
            inputmode="numeric"
            min="0"
            step="1"
            value="${item.quantity}"
            aria-label="Quantity for ${item.product.name}"
          />
          <button class="btn-plus" data-id="${item.product.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="btn-trash" data-id="${item.product.id}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-minus').forEach(btn => {
      btn.addEventListener('click', () => updateQuantity(String(btn.dataset.id), -1));
    });
    container.querySelectorAll('.btn-plus').forEach(btn => {
      btn.addEventListener('click', () => updateQuantity(String(btn.dataset.id), 1));
    });
    container.querySelectorAll('.qty-input').forEach(inputEl => {
      const productId = String(inputEl.dataset.id);
      const commit = () => {
        const raw = String(inputEl.value).trim();
        if (raw === '') {
          const item = cart.find(c => String(c.product.id) === productId);
          inputEl.value = item ? String(item.quantity) : '0';
          return; // avoid removing item while user is typing
        }
        const next = Number(raw);
        if (!Number.isFinite(next)) {
          const item = cart.find(c => String(c.product.id) === productId);
          inputEl.value = item ? String(item.quantity) : '0';
          return;
        }
        setQuantity(productId, next);
      };

      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          inputEl.blur();
        }
      });
      inputEl.addEventListener('blur', () => commit());
    });
    container.querySelectorAll('.btn-trash').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(String(btn.dataset.id)));
    });
  }

  updateCartUI();
}

function updateCartUI() {
  const totalItems = getTotalItems();
  const { subtotal, tax, total } = calculateTotals();

  const badge = document.getElementById('cartBadge');
  if (totalItems > 0) {
    badge.style.display = 'block';
    badge.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
  } else {
    badge.style.display = 'none';
  }

  const totalsSection = document.getElementById('totalsSection');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (cart.length > 0) {
    totalsSection.style.display = 'block';
    document.getElementById('subtotalValue').textContent = `₱${subtotal.toFixed(2)}`;
    document.getElementById('taxValue').textContent = `₱${tax.toFixed(2)}`;
    document.getElementById('totalValue').textContent = `₱${total.toFixed(2)}`;

    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = `
      Proceed to Checkout
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    `;
  } else {
    totalsSection.style.display = 'none';
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Add items to order';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CART ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function addToCart(productId) {
  const product = products.find(p => String(p.id) === String(productId));
  if (!product) return;

  const availableQty = Number(product.quantity);
  if (!Number.isFinite(availableQty) || availableQty <= 0) {
    alert('That item is out of stock.');
    return;
  }

  const existing = cart.find(item => String(item.product.id) === String(productId));
  const nextQty = existing ? existing.quantity + 1 : 1;
  if (nextQty > availableQty) {
    alert(`Only ${availableQty} available for ${product.name}.`);
    return;
  }

  if (existing) existing.quantity = nextQty;
  else cart.push({ product, quantity: 1 });

  renderCart();
  renderProductGrid();
}

function updateQuantity(productId, delta) {
  const item = cart.find(c => String(c.product.id) === String(productId));
  if (!item) return;
  setQuantity(productId, item.quantity + delta);
}

function setQuantity(productId, newQty) {
  const item = cart.find(c => String(c.product.id) === String(productId));
  if (!item) return;

  const availableQty = Number(item.product.quantity);
  if (!Number.isFinite(availableQty) || availableQty <= 0) {
    alert('That item is out of stock.');
    removeFromCart(productId);
    return;
  }

  const nextQty = Math.floor(Number(newQty));
  if (!Number.isFinite(nextQty)) return;

  if (nextQty <= 0) {
    removeFromCart(productId);
    return;
  }

  if (nextQty > availableQty) {
    alert(`Only ${availableQty} available for ${item.product.name}.`);
    item.quantity = availableQty;
  } else {
    item.quantity = nextQty;
  }

  if (item.quantity <= 0) removeFromCart(productId);
  else {
    renderCart();
    renderProductGrid();
  }
}

function removeFromCart(productId) {
  cart = cart.filter(item => String(item.product.id) !== String(productId));
  renderCart();
  renderProductGrid();
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRMATION VIEW
// ═══════════════════════════════════════════════════════════════════════════

function showConfirmation() {
  const totalItems = getTotalItems();
  const { subtotal, tax, total } = calculateTotals();

  document.getElementById('confirmationSummary').textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''} · Review before confirming`;

  const container = document.getElementById('confirmationItems');
  container.innerHTML = cart.map(item => `
    <div class="confirmation-item">
      <img src="${item.product.image}" alt="${item.product.name}" />
      <div class="info">
        <p class="name">${item.product.name}</p>
        <p class="unit">₱${item.product.price.toFixed(2)} each</p>
      </div>
      <div class="right">
        <div class="qty-badge">× ${item.quantity}</div>
        <div class="total">₱${(item.product.price * item.quantity).toFixed(2)}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('confirmSubtotal').textContent = `₱${subtotal.toFixed(2)}`;
  document.getElementById('confirmTax').textContent = `₱${tax.toFixed(2)}`;
  document.getElementById('confirmTotal').textContent = `₱${total.toFixed(2)}`;
  document.getElementById('confirmAmountDue').textContent = `₱${total.toFixed(2)}`;

  // Customer bill + change (cash payment)
  customerBillAmount = 0;
  changeAmount = 0;
  const customerBillInput = document.getElementById('customerBillInput');
  const changeValueEl = document.getElementById('changeValue');

  if (customerBillInput && changeValueEl) {
    customerBillInput.value = '';
    changeValueEl.textContent = '₱0.00';
    changeValueEl.classList.remove('insufficient');

    const updateChange = () => {
      const raw = customerBillInput.value;
      const bill = Number(raw);

      if (!Number.isFinite(bill) || bill < 0) {
        customerBillAmount = 0;
        changeAmount = 0;
        changeValueEl.textContent = '₱0.00';
        changeValueEl.classList.remove('insufficient');
        return;
      }

      customerBillAmount = bill;
      changeAmount = bill - total;

      if (changeAmount >= 0) {
        changeValueEl.textContent = `₱${changeAmount.toFixed(2)}`;
        changeValueEl.classList.remove('insufficient');
      } else {
        // Show the short amount in red
        changeValueEl.textContent = `₱${Math.abs(changeAmount).toFixed(2)}`;
        changeValueEl.classList.add('insufficient');
      }
    };

    customerBillInput.oninput = updateChange;
    customerBillInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('confirmOrderBtn').click();
      }
    };

    // Optional: focus so the user can type right away
    customerBillInput.focus();
  }

  document.getElementById('confirmItemsBadge').innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
    ${totalItems} item${totalItems !== 1 ? 's' : ''}
  `;

  document.getElementById('posView').classList.add('hidden');
  document.getElementById('confirmationView').classList.remove('hidden');
  document.getElementById('receiptView').classList.add('hidden');
}

function goBackToPOS() {
  document.getElementById('posView').classList.remove('hidden');
  document.getElementById('confirmationView').classList.add('hidden');
  document.getElementById('receiptView').classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════════════════
// RECEIPT VIEW
// ═══════════════════════════════════════════════════════════════════════════

async function showReceipt() {
  orderTime = new Date();
  const { subtotal, tax, total } = calculateTotals();
  const totalItems = getTotalItems();
  const customerBill = Number.isFinite(customerBillAmount) && customerBillAmount > 0
    ? customerBillAmount
    : total;
  const change = Number.isFinite(changeAmount)
    ? Math.max(0, changeAmount)
    : Math.max(0, customerBill - total);

  try {
    const savedOrder = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: cart.map((item) => ({
          itemId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          image: item.product.image || ''
        })),
        totalItems,
        subtotal,
        tax,
        total,
        paymentMethod,
        orderTime: orderTime.toISOString()
      })
    });
    orderNumber = savedOrder.orderNumber;
  } catch (error) {
    alert(error.message || 'Failed to save order.');
    return;
  }

  document.getElementById('receiptOrderNumber').textContent = orderNumber;

  // Recap
  const recapContainer = document.getElementById('receiptRecap');
  recapContainer.innerHTML = cart.map(item => `
    <div class="recap-item">
      <span class="name"><span class="qty">×${item.quantity}</span> ${item.product.name}</span>
      <span class="price">₱${(item.product.price * item.quantity).toFixed(2)}</span>
    </div>
  `).join('') + `
    <div class="recap-total">
      <span class="label">Total Paid</span>
      <span class="value">₱${total.toFixed(2)}</span>
    </div>
  `;

  // Receipt Paper
  const dateStr = orderTime.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = orderTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  const receiptPaper = document.getElementById('receiptPaper');
  receiptPaper.innerHTML = `
    <div class="header-band">
      <p class="title">Grocery Ni Lang</p>
      <p class="subtitle">Your favorite grocery store</p>
    </div>
    
    <div class="store-info">
      <div class="line">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Cabanatuan City</span>
      </div>
      <div class="line">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <span>0922tutunogtunog</span>
      </div>
      <div class="line">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Open Daily: 8:00 AM – 10:00 PM</span>
      </div>
    </div>

    <div class="section">
      <div class="meta-row">
        <span class="label">Order #</span>
        <span class="value bold">${orderNumber}</span>
      </div>
      <div class="meta-row">
        <span class="label">Date</span>
        <span class="value">${dateStr}</span>
      </div>
      <div class="meta-row">
        <span class="label">Time</span>
        <span class="value">${timeStr}</span>
      </div>
      <div class="meta-row">
        <span class="label">Payment</span>
        <span class="value bold">${PAYMENT_LABELS[paymentMethod]}</span>
      </div>
      <div class="meta-row">
        <span class="label">Customer Bill</span>
        <span class="value bold">₱${customerBill.toFixed(2)}</span>
      </div>
      <div class="meta-row">
        <span class="label">Change</span>
        <span class="value bold">₱${change.toFixed(2)}</span>
      </div>
    </div>

    <div class="section">
      <p class="section-title">── Order Items ──</p>
      ${cart.map(item => `
        <div class="item">
          <div class="item-row">
            <span class="name">${item.product.name}</span>
            <span class="price">₱${(item.product.price * item.quantity).toFixed(2)}</span>
          </div>
          <p class="item-details">${item.quantity} × ₱${item.product.price.toFixed(2)}</p>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <div class="meta-row">
        <span class="label">Subtotal</span>
        <span class="value">₱${subtotal.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span class="label">TOTAL</span>
        <span class="value">₱${total.toFixed(2)}</span>
      </div>
    </div>

    <div class="qr-section">
      <p class="section-title">── Digital Receipt ──</p>
      <div class="qr-wrapper">
        <canvas id="qrCanvas"></canvas>
      </div>
      <p class="qr-note">Scan to view your digital receipt</p>
      <div class="thank-you">
        <p>Thank you so much for your purchase!</p>
        <p>We hope to see you again soon</p>
      </div>
    </div>
  `;

  // Generate QR code (fail-safe so receipt still works live)
  try {
    if (window.QRCode && typeof QRCode.toCanvas === 'function') {
      const qrValue = `GROCERY NI LANG|ORDER:${orderNumber}|TOTAL:${total.toFixed(2)}|DATE:${orderTime.toISOString()}|ITEMS:${totalItems}`;
      QRCode.toCanvas(document.getElementById('qrCanvas'), qrValue, {
        width: 148,
        margin: 0,
        color: {
          dark: '#111827',
          light: '#FFFFFF'
        }
      });
    }
  } catch (e) {
    console.error('QR code generation failed:', e);
  }

  document.getElementById('posView').classList.add('hidden');
  document.getElementById('confirmationView').classList.add('hidden');
  document.getElementById('receiptView').classList.remove('hidden');
}

async function syncCartWithLatestCatalog() {
  // Refresh products so the POS reflects current stock and removes any out-of-stock items from the cart.
  await loadCatalog();

  const nextCart = [];
  for (const cartItem of cart) {
    const latestProduct = products.find(p => String(p.id) === String(cartItem.product.id));
    if (!latestProduct) continue; // out of stock or removed from catalog

    const latestQty = Number(latestProduct.quantity);
    if (!Number.isFinite(latestQty) || latestQty <= 0) continue;

    cartItem.product = latestProduct;
    cartItem.quantity = Math.min(cartItem.quantity, latestQty);
    if (cartItem.quantity > 0) nextCart.push(cartItem);
  }

  cart = nextCart;
}

async function startNewOrder() {
  cart = [];
  paymentMethod = 'cash';
  orderTime = new Date();
  selectedCategory = 'All';

  await loadCatalog();

  renderCart();
  renderProductGrid();
  renderCategoryTabs();

  // Reset payment method (cash only)
  document.querySelectorAll('.payment-method').forEach(btn => {
    if (btn.dataset.method === 'cash') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  fetchNextOrderNumber().finally(goBackToPOS);
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

document.getElementById('checkoutBtn').addEventListener('click', async () => {
  if (cart.length <= 0) return;

  try {
    await syncCartWithLatestCatalog();
    if (cart.length > 0) showConfirmation();
  } catch (error) {
    console.error(error);
    // Fallback: backend validation will still prevent out-of-stock orders.
    showConfirmation();
  }
});

document.getElementById('backBtn').addEventListener('click', goBackToPOS);

document.querySelectorAll('.payment-method').forEach(btn => {
  btn.addEventListener('click', () => {
    // Cash only: keep cash selected and paymentMethod fixed
    paymentMethod = 'cash';
  });
});

document.getElementById('confirmOrderBtn').addEventListener('click', async () => {
  if (cart.length <= 0) return;

  const { total } = calculateTotals();
  const customerBillInput = document.getElementById('customerBillInput');
  const bill = Number(customerBillInput?.value);

  if (!Number.isFinite(bill) || bill < 0) {
    alert('Please enter the customer bill amount.');
    customerBillInput?.focus();
    return;
  }

  if (bill < total) {
    alert(`Customer bill must be at least ₱${total.toFixed(2)}.`);
    customerBillInput?.focus();
    return;
  }

  customerBillAmount = bill;
  changeAmount = bill - total;

  // Keep the UI in sync even if the user didn't trigger oninput.
  const changeValueEl = document.getElementById('changeValue');
  if (changeValueEl) {
    changeValueEl.textContent = `₱${changeAmount.toFixed(2)}`;
    changeValueEl.classList.remove('insufficient');
  }

  await showReceipt();
});
document.getElementById('newOrderBtn').addEventListener('click', () => startNewOrder().catch(console.error));

// Update time every second
function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('currentTime').textContent = timeStr;
}
setInterval(updateTime, 1000);
updateTime();

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([loadCatalog(), fetchNextOrderNumber()]);
    renderCategoryTabs();
    renderProductGrid();
    renderCart();
  } catch (error) {
    console.error(error);
    alert(error.message || 'Failed to load POS data.');
  }
});