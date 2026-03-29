/**
 * keyboard.js — Full keyboard navigation for the POS kiosk
 *
 * Zones (POS View):
 *   [G] Product Grid  — Arrow keys to move, Enter/Space to add to cart
 *   [C] Cart Items    — Arrow keys to move, +/- to adjust qty, Delete to remove
 *   [S] Category tabs — Arrow keys to switch
 *
 * Global shortcuts (always active):
 *   /       → Focus search / jump to grid
 *   Escape  → Back / dismiss
 *   F2      → Toggle shortcut legend
 *   Tab     → Cycle zones: Grid → Cart → Checkout btn → (wrap)
 *   Shift+Tab → Reverse cycle
 *
 * POS View shortcuts:
 *   C   → Checkout (if cart has items)
 *   ←/→ → Prev / next category tab
 *
 * Confirmation View:
 *   Enter   → Confirm order (if bill is filled)
 *   Escape  → Back to POS
 *
 * Receipt View:
 *   N       → New order
 *   P       → Print receipt
 *   Escape  → New order
 */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    zone: 'grid',          // 'grid' | 'cart' | 'tabs'
    gridIndex: 0,
    cartIndex: 0,
    tabIndex: 0,
    legendVisible: false,
    enabled: true,
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function currentView() {
    if (!document.getElementById('posView').classList.contains('hidden'))        return 'pos';
    if (!document.getElementById('confirmationView').classList.contains('hidden')) return 'confirm';
    if (!document.getElementById('receiptView').classList.contains('hidden'))    return 'receipt';
    return 'pos';
  }

  function getGridTiles() {
    return [...document.querySelectorAll('#productGrid .product-tile:not([disabled])')];
  }
  function getCartItems() {
    return [...document.querySelectorAll('#cartItems .cart-item')];
  }
  function getCategoryTabs() {
    return [...document.querySelectorAll('#categoryTabs .category-tab')];
  }

  // ─── Focus rings ─────────────────────────────────────────────────────────────
  function clearAllFocus() {
    document.querySelectorAll('.kb-focused').forEach(el => el.classList.remove('kb-focused'));
  }

  function focusGridTile(index) {
    const tiles = getGridTiles();
    if (!tiles.length) return;
    state.gridIndex = Math.max(0, Math.min(index, tiles.length - 1));
    clearAllFocus();
    const tile = tiles[state.gridIndex];
    tile.classList.add('kb-focused');
    tile.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    announceToSR(`Product: ${tile.querySelector('.name')?.textContent?.trim()}, ${tile.querySelector('.price')?.textContent?.trim()}`);
  }

  function focusCartItem(index) {
    const items = getCartItems();
    if (!items.length) return;
    state.cartIndex = Math.max(0, Math.min(index, items.length - 1));
    clearAllFocus();
    const item = items[state.cartIndex];
    item.classList.add('kb-focused');
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    announceToSR(`Cart item: ${item.querySelector('.name')?.textContent?.trim()}`);
  }

  function focusCategoryTab(index) {
    const tabs = getCategoryTabs();
    if (!tabs.length) return;
    state.tabIndex = Math.max(0, Math.min(index, tabs.length - 1));
    clearAllFocus();
    tabs[state.tabIndex].classList.add('kb-focused');
    tabs[state.tabIndex].scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
  }

  // ─── Screen-reader announcer ──────────────────────────────────────────────────
  let srEl;
  function initSR() {
    srEl = document.createElement('div');
    srEl.setAttribute('aria-live', 'polite');
    srEl.setAttribute('aria-atomic', 'true');
    srEl.className = 'kb-sr-only';
    document.body.appendChild(srEl);
  }
  function announceToSR(msg) {
    if (!srEl) return;
    srEl.textContent = '';
    requestAnimationFrame(() => { srEl.textContent = msg; });
  }

  // ─── Zone switching ───────────────────────────────────────────────────────────
  function setZone(zone) {
    state.zone = zone;
    clearAllFocus();
    updateZoneIndicator();

    if (zone === 'grid') {
      focusGridTile(state.gridIndex);
    } else if (zone === 'cart') {
      const items = getCartItems();
      if (items.length) focusCartItem(state.cartIndex);
      else {
        // No items — bounce back to grid
        setZone('grid');
      }
    } else if (zone === 'tabs') {
      const tabs = getCategoryTabs();
      const active = tabs.findIndex(t => t.classList.contains('active'));
      focusCategoryTab(active >= 0 ? active : 0);
    }
  }

  function cycleZone(direction) {
    const zones = ['grid', 'cart', 'tabs'];
    const idx = zones.indexOf(state.zone);
    const next = (idx + direction + zones.length) % zones.length;
    setZone(zones[next]);
  }

  // ─── Zone indicator pill ─────────────────────────────────────────────────────
  let zoneEl;
  function initZoneIndicator() {
    zoneEl = document.createElement('div');
    zoneEl.className = 'kb-zone-indicator';
    document.body.appendChild(zoneEl);
  }
  function updateZoneIndicator() {
    if (!zoneEl) return;
    const labels = { grid: 'Grid', cart: 'Cart', tabs: 'Categories' };
    zoneEl.textContent = labels[state.zone] || '';
    zoneEl.classList.add('kb-zone-flash');
    setTimeout(() => zoneEl.classList.remove('kb-zone-flash'), 600);
  }

  // ─── Grid navigation ─────────────────────────────────────────────────────────
  function gridColumns() {
    const grid = document.getElementById('productGrid');
    if (!grid) return 1;
    const style = window.getComputedStyle(grid);
    const cols = style.gridTemplateColumns.split(' ').length;
    return Math.max(1, cols);
  }

  function handleGridKey(e) {
    const tiles = getGridTiles();
    if (!tiles.length) return;
    const cols = gridColumns();
    let idx = state.gridIndex;

    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); idx = Math.min(idx + 1, tiles.length - 1); break;
      case 'ArrowLeft':  e.preventDefault(); idx = Math.max(idx - 1, 0); break;
      case 'ArrowDown':  e.preventDefault(); idx = Math.min(idx + cols, tiles.length - 1); break;
      case 'ArrowUp':    e.preventDefault(); idx = Math.max(idx - cols, 0); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        tiles[state.gridIndex]?.click();
        // pulse feedback
        tiles[state.gridIndex]?.classList.add('kb-activate-flash');
        setTimeout(() => tiles[state.gridIndex]?.classList.remove('kb-activate-flash'), 300);
        return;
      case 'Home': e.preventDefault(); idx = 0; break;
      case 'End':  e.preventDefault(); idx = tiles.length - 1; break;
      default: return;
    }
    focusGridTile(idx);
  }

  // ─── Cart navigation ──────────────────────────────────────────────────────────
  function handleCartKey(e) {
    const items = getCartItems();
    if (!items.length) return;
    let idx = state.cartIndex;
    const item = items[idx];

    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusCartItem(Math.min(idx + 1, items.length - 1)); return;
      case 'ArrowUp':   e.preventDefault(); focusCartItem(Math.max(idx - 1, 0)); return;
      case '+':
      case '=':
        e.preventDefault();
        item?.querySelector('.btn-plus')?.click();
        flashCartItem(item);
        return;
      case '-':
        e.preventDefault();
        item?.querySelector('.btn-minus')?.click();
        flashCartItem(item);
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        item?.querySelector('.btn-trash')?.click();
        // after removal, clamp index
        setTimeout(() => {
          const newItems = getCartItems();
          if (newItems.length) focusCartItem(Math.min(idx, newItems.length - 1));
          else setZone('grid');
        }, 50);
        return;
      case 'e':
      case 'E': {
        // focus qty input for editing
        e.preventDefault();
        const input = item?.querySelector('.qty-input');
        if (input) { input.focus(); input.select(); }
        return;
      }
      default: return;
    }
  }

  function flashCartItem(item) {
    if (!item) return;
    item.classList.add('kb-cart-flash');
    setTimeout(() => item.classList.remove('kb-cart-flash'), 250);
  }

  // ─── Category tab navigation ──────────────────────────────────────────────────
  function handleTabsKey(e) {
    const tabs = getCategoryTabs();
    if (!tabs.length) return;

    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); focusCategoryTab(Math.min(state.tabIndex + 1, tabs.length - 1)); return;
      case 'ArrowLeft':  e.preventDefault(); focusCategoryTab(Math.max(state.tabIndex - 1, 0)); return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        tabs[state.tabIndex]?.click();
        // After tab click, refresh grid focus
        setTimeout(() => {
          state.gridIndex = 0;
          setZone('grid');
        }, 50);
        return;
      case 'Home': e.preventDefault(); focusCategoryTab(0); return;
      case 'End':  e.preventDefault(); focusCategoryTab(tabs.length - 1); return;
      default: return;
    }
  }

  // ─── Main keydown handler ─────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (!state.enabled) return;

    // Skip when user is typing in a real input
    const tag = document.activeElement?.tagName;
    const inInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');

    const view = currentView();

    // ── Global shortcuts (work even in inputs for Escape / F2) ──────────────────
    if (e.key === 'F2') {
      e.preventDefault();
      toggleLegend();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.legendVisible) { toggleLegend(); return; }
      if (view === 'confirm') { document.getElementById('backBtn')?.click(); return; }
      if (view === 'receipt') { document.getElementById('newOrderBtn')?.click(); return; }
      // In POS: if in cart/tabs zone, jump back to grid
      if (view === 'pos' && state.zone !== 'grid') { setZone('grid'); return; }
      // If an input is focused, blur it
      if (inInput) { document.activeElement.blur(); return; }
      return;
    }

    // Skip further handling if in input (let normal typing work)
    if (inInput) return;

    // ── View-specific ────────────────────────────────────────────────────────────
    if (view === 'pos') {
      // Category shortcuts: ← → at top level (not inside grid/cart)
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        const tabs = getCategoryTabs();
        const active = tabs.findIndex(t => t.classList.contains('active'));
        if (active > 0) tabs[active - 1].click();
        return;
      }
      if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        const tabs = getCategoryTabs();
        const active = tabs.findIndex(t => t.classList.contains('active'));
        if (active < tabs.length - 1) tabs[active + 1].click();
        return;
      }

      // Tab cycles zones
      if (e.key === 'Tab') {
        e.preventDefault();
        cycleZone(e.shiftKey ? -1 : 1);
        return;
      }

      // Checkout shortcut
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
        const btn = document.getElementById('checkoutBtn');
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); return; }
      }

      // Zone-specific arrow/action keys
      if (state.zone === 'grid') handleGridKey(e);
      else if (state.zone === 'cart') handleCartKey(e);
      else if (state.zone === 'tabs') handleTabsKey(e);

    } else if (view === 'confirm') {
      if (e.key === 'Enter') {
        const btn = document.getElementById('confirmOrderBtn');
        if (btn) { e.preventDefault(); btn.click(); }
      }

    } else if (view === 'receipt') {
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        document.getElementById('newOrderBtn')?.click();
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        document.getElementById('printReceiptBtn')?.click();
      }
    }
  }

  // ─── Legend ───────────────────────────────────────────────────────────────────
  let legendEl;
  const LEGEND_HTML = `
    <div class="kb-legend-inner">
      <div class="kb-legend-header">
        <span class="kb-legend-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
          Keyboard Navigation
        </span>
        <button class="kb-legend-close" id="kbLegendClose">✕</button>
      </div>
      <div class="kb-legend-body">
        <div class="kb-legend-section">
          <p class="kb-legend-section-title">Product Grid</p>
          <div class="kb-legend-rows">
            <div class="kb-legend-row"><span class="kb-keys"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></span><span>Navigate products</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>Enter</kbd> <kbd>Space</kbd></span><span>Add to cart</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>Home</kbd> <kbd>End</kbd></span><span>First / last product</span></div>
          </div>
        </div>
        <div class="kb-legend-section">
          <p class="kb-legend-section-title">Categories</p>
          <div class="kb-legend-rows">
            <div class="kb-legend-row"><span class="kb-keys"><kbd>←</kbd><kbd>→</kbd></span><span>Switch category</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>Enter</kbd></span><span>Select category</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>Alt</kbd>+<kbd>←</kbd><kbd>→</kbd></span><span>Quick-switch anywhere</span></div>
          </div>
        </div>
        <div class="kb-legend-section">
          <p class="kb-legend-section-title">Cart</p>
          <div class="kb-legend-rows">
            <div class="kb-legend-row"><span class="kb-keys"><kbd>↑</kbd><kbd>↓</kbd></span><span>Navigate items</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>+</kbd> <kbd>-</kbd></span><span>Increase / decrease qty</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>E</kbd></span><span>Edit quantity directly</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>Del</kbd></span><span>Remove item</span></div>
          </div>
        </div>
        <div class="kb-legend-section">
          <p class="kb-legend-section-title">Global</p>
          <div class="kb-legend-rows">
            <div class="kb-legend-row"><span class="kb-keys"><kbd>Tab</kbd></span><span>Cycle zones</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>C</kbd></span><span>Checkout</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>Esc</kbd></span><span>Back / dismiss</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>N</kbd></span><span>New order (receipt)</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>P</kbd></span><span>Print receipt</span></div>
            <div class="kb-legend-row"><span class="kb-keys"><kbd>F2</kbd></span><span>Toggle this panel</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  function initLegend() {
    legendEl = document.createElement('div');
    legendEl.className = 'kb-legend';
    legendEl.setAttribute('role', 'dialog');
    legendEl.setAttribute('aria-label', 'Keyboard shortcuts');
    legendEl.innerHTML = LEGEND_HTML;
    document.body.appendChild(legendEl);
    document.getElementById('kbLegendClose').addEventListener('click', () => toggleLegend());
  }

  function toggleLegend() {
    state.legendVisible = !state.legendVisible;
    legendEl.classList.toggle('kb-legend-visible', state.legendVisible);
    document.querySelector('.kb-help-btn')?.setAttribute('aria-expanded', String(state.legendVisible));
    if (state.legendVisible) {
      document.getElementById('kbLegendClose')?.focus();
    }
  }

  // ─── Help button ──────────────────────────────────────────────────────────────
  function initHelpButton() {
    const btn = document.createElement('button');
    btn.className = 'kb-help-btn';
    btn.setAttribute('aria-label', 'Keyboard shortcuts (F2)');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('title', 'Keyboard shortcuts — F2');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
      </svg>
      <span>Shortcuts</span>
      <kbd>F2</kbd>
    `;
    btn.addEventListener('click', toggleLegend);
    document.body.appendChild(btn);
  }

  // ─── Inject styles ────────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ── Utility ─────────────────────────────────────────────────────────── */
      .kb-sr-only {
        position: absolute;
        width: 1px; height: 1px;
        padding: 0; margin: -1px;
        overflow: hidden;
        clip: rect(0,0,0,0);
        white-space: nowrap;
        border: 0;
      }

      /* ── Focus ring on product tiles ─────────────────────────────────────── */
      .product-tile.kb-focused {
        outline: 3px solid #006BB6 !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 6px rgba(0,107,182,0.18), 0 4px 16px rgba(0,107,182,0.18) !important;
        border-color: #006BB6 !important;
        z-index: 2;
        position: relative;
      }
      .product-tile.kb-activate-flash {
        background: #DBEAFE !important;
        transition: background 0.2s;
      }

      /* ── Focus ring on cart items ─────────────────────────────────────────── */
      .cart-item.kb-focused {
        outline: 3px solid #006BB6 !important;
        outline-offset: 2px;
        background: #EFF6FF !important;
        border-color: #BFDBFE !important;
        box-shadow: 0 0 0 4px rgba(0,107,182,0.13) !important;
      }
      .cart-item.kb-cart-flash {
        background: #DBEAFE !important;
        transition: background 0.15s;
      }

      /* ── Focus ring on category tabs ─────────────────────────────────────── */
      .category-tab.kb-focused {
        outline: 3px solid #006BB6 !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(0,107,182,0.18) !important;
      }

      /* ── Zone indicator pill ─────────────────────────────────────────────── */
      .kb-zone-indicator {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        background: #1E293B;
        color: #E2E8F0;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 999px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        z-index: 9999;
        letter-spacing: 0.03em;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      }
      .kb-zone-indicator.kb-zone-flash {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        transition: opacity 0s;
      }

      /* ── Help button ─────────────────────────────────────────────────────── */
      .kb-help-btn {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 11px;
        background: rgba(255,255,255,0.15);
        color: #ffffff;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        z-index: 9000;
        box-shadow: none;
        transition: background 0.15s;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .kb-help-btn:hover {
        background: rgba(255,255,255,0.25);
        color: #ffffff;
        box-shadow: none;
      }
      .kb-help-btn:focus-visible {
        outline: 2px solid rgba(255,255,255,0.8);
        outline-offset: 2px;
      }
      .kb-help-btn kbd {
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.35);
        border-radius: 3px;
        padding: 0 5px;
        font-family: inherit;
        font-size: 10px;
        font-weight: 700;
        color: #ffffff;
      }

      /* ── Legend panel ────────────────────────────────────────────────────── */
      .kb-legend {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(6px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      .kb-legend.kb-legend-visible {
        opacity: 1;
        pointer-events: all;
      }
      .kb-legend-inner {
        background: #0F172A;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        width: 560px;
        max-width: 95vw;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 32px 80px rgba(0,0,0,0.5);
        transform: translateY(12px) scale(0.97);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .kb-legend.kb-legend-visible .kb-legend-inner {
        transform: translateY(0) scale(1);
      }
      .kb-legend-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .kb-legend-title {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #F1F5F9;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }
      .kb-legend-title svg { color: #60A5FA; }
      .kb-legend-close {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        color: #94A3B8;
        border-radius: 8px;
        width: 30px; height: 30px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s, color 0.15s;
      }
      .kb-legend-close:hover { background: rgba(255,255,255,0.14); color: #F1F5F9; }
      .kb-legend-close:focus-visible { outline: 3px solid #006BB6; outline-offset: 2px; }

      .kb-legend-body {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        padding: 8px 0 16px;
      }
      .kb-legend-section {
        padding: 16px 24px 8px;
        border-right: 1px solid rgba(255,255,255,0.05);
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .kb-legend-section:nth-child(even) { border-right: none; }
      .kb-legend-section:nth-last-child(-n+2) { border-bottom: none; }

      .kb-legend-section-title {
        color: #60A5FA;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 10px;
      }
      .kb-legend-rows { display: flex; flex-direction: column; gap: 7px; }
      .kb-legend-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12.5px;
        color: #94A3B8;
      }
      .kb-legend-row span:last-child { flex: 1; }
      .kb-keys {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
        min-width: 90px;
        flex-wrap: wrap;
      }
      .kb-legend kbd {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.18);
        border-bottom: 2px solid rgba(255,255,255,0.22);
        border-radius: 5px;
        padding: 2px 7px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 700;
        color: #E2E8F0;
        display: inline-block;
        min-width: 24px;
        text-align: center;
      }

      /* Scrollbar for legend */
      .kb-legend-inner::-webkit-scrollbar { width: 6px; }
      .kb-legend-inner::-webkit-scrollbar-track { background: transparent; }
      .kb-legend-inner::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    `;
    document.head.appendChild(style);
  }

  // ─── Re-sync grid index after catalog reloads / category changes ──────────────
  function observeGridChanges() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    const observer = new MutationObserver(() => {
      // Grid re-renders on every addToCart / category switch — always re-apply focus
      // so the blue ring is never lost after pressing Enter on a tile.
      const tiles = getGridTiles();
      if (state.zone === 'grid' && tiles.length) {
        state.gridIndex = Math.min(state.gridIndex, tiles.length - 1);
        focusGridTile(state.gridIndex);
      }
    });
    observer.observe(grid, { childList: true });
  }

  function observeCartChanges() {
    const cartEl = document.getElementById('cartItems');
    if (!cartEl) return;
    const observer = new MutationObserver(() => {
      const items = getCartItems();
      if (state.zone === 'cart') {
        if (!items.length) { setZone('grid'); return; }
        state.cartIndex = Math.min(state.cartIndex, items.length - 1);
        const hasFocus = cartEl.querySelector('.kb-focused');
        if (hasFocus) focusCartItem(state.cartIndex);
      }
    });
    observer.observe(cartEl, { childList: true, subtree: true });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    initSR();
    initZoneIndicator();
    initLegend();
    initHelpButton();

    document.addEventListener('keydown', onKeyDown);

    // Wait for DOM to be ready + catalog to load, then focus first tile
    const waitForGrid = setInterval(() => {
      const tiles = getGridTiles();
      if (tiles.length) {
        clearInterval(waitForGrid);
        observeGridChanges();
        observeCartChanges();
        // Small delay so the app finishes rendering
        setTimeout(() => focusGridTile(0), 300);
      }
    }, 200);

    // Reset zone + index whenever view changes
    const posView = document.getElementById('posView');
    const viewObserver = new MutationObserver(() => {
      const view = currentView();
      if (view === 'pos') {
        state.zone = 'grid';
        setTimeout(() => focusGridTile(0), 100);
      }
    });
    viewObserver.observe(posView, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();