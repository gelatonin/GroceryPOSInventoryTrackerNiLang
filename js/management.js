const API_BASE = '/api';

let salesChart = null;
const RESTOCK_SEEN_KEY = 'restockBotSeenSuggestionKeys';

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

function formatPHP(value) {
  const num = Number(value) || 0;
  return `₱${num.toFixed(2)}`;
}

function getDateKeyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLastNDaysKeys(n) {
  const now = new Date();
  const keys = [];
  const labels = [];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(getDateKeyLocal(d));
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }

  return { keys, labels };
}

function renderStatCard(title, value, color, path) {
  return `
    <div class="stat-card">
      <div class="stat-card-content">
        <div class="stat-info">
          <p class="stat-label">${title}</p>
          <p class="stat-value">${value}</p>
        </div>
        <div class="stat-icon-wrapper" style="background-color: ${color}20">
          <svg class="stat-icon" style="color: ${color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"></path>
          </svg>
        </div>
      </div>
    </div>
  `;
}

function renderSalesStats(salesEvents) {
  const container = document.getElementById('sales-stats-grid');
  if (!container) return;

  const totalRevenue = salesEvents.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
  const ordersCount = salesEvents.length;
  const avgOrder = ordersCount ? totalRevenue / ordersCount : 0;

  const last7Revenue = (() => {
    const { keys } = getLastNDaysKeys(7);
    const set = new Set(keys);
    return salesEvents.reduce((sum, e) => {
      if (!e.orderTime) return sum;
      const d = new Date(e.orderTime);
      const key = getDateKeyLocal(d);
      if (!set.has(key)) return sum;
      return sum + (Number(e.total) || 0);
    }, 0);
  })();

  container.innerHTML = `
    ${renderStatCard('Total Revenue', formatPHP(totalRevenue), '#22c55e', 'M12 2v20m10-10H2')}
    ${renderStatCard('Total Orders', ordersCount.toLocaleString(), '#3b82f6', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z')}
    ${renderStatCard('Avg Order Value', formatPHP(avgOrder), '#8b5cf6', 'M12 6V4m0 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4m0-10a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4m0 0v2')}
  `;
}

function renderSalesTable(salesEvents) {
  const body = document.getElementById('sales-table-body');
  if (!body) return;

  const sorted = [...salesEvents].sort((a, b) => {
    const ta = new Date(a.orderTime || a.createdAt || 0).getTime();
    const tb = new Date(b.orderTime || b.createdAt || 0).getTime();
    return tb - ta;
  });

  if (sorted.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty-state">No sales yet</td></tr>`;
    return;
  }

  body.innerHTML = sorted.slice(0, 10).map(e => {
    const d = e.orderTime ? new Date(e.orderTime) : null;
    const dateStr = d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
    const itemsCount = Number(e.totalItems) || (Array.isArray(e.items) ? e.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0);

    return `
      <tr>
        <td>${e.orderNumber || '-'}</td>
        <td>${dateStr}</td>
        <td>${itemsCount.toLocaleString()}</td>
        <td class="text-right">${formatPHP(e.total)}</td>
      </tr>
    `;
  }).join('');
}

function renderSalesChart(salesEvents) {
  const canvas = document.getElementById('salesChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const { keys, labels } = getLastNDaysKeys(7);
  const indexByKey = {};
  keys.forEach((k, i) => { indexByKey[k] = i; });

  const revenueByDay = Array(keys.length).fill(0);

  for (const e of salesEvents) {
    if (!e.orderTime) continue;
    const d = new Date(e.orderTime);
    if (Number.isNaN(d.getTime())) continue;
    const key = getDateKeyLocal(d);
    if (indexByKey[key] === undefined) continue;
    revenueByDay[indexByKey[key]] += Number(e.total) || 0;
  }

  if (salesChart) {
    salesChart.destroy();
    salesChart = null;
  }

  const ctx = canvas.getContext('2d');
  salesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: revenueByDay,
          backgroundColor: 'rgba(34, 197, 94, 0.35)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
          borderRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (val) {
              try {
                return formatPHP(val);
              } catch {
                return val;
              }
            },
          },
        },
      },
    },
  });
}

function buildDemandMap(salesEvents, days = 7) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const demandByKey = new Map();

  for (const order of salesEvents) {
    const orderTime = new Date(order.orderTime || order.createdAt || 0).getTime();
    if (Number.isNaN(orderTime) || orderTime < cutoff) continue;
    if (!Array.isArray(order.items)) continue;

    for (const line of order.items) {
      const key = String(line.itemId || line.name || '').trim().toLowerCase();
      if (!key) continue;
      const qty = Number(line.quantity) || 0;
      demandByKey.set(key, (demandByKey.get(key) || 0) + qty);
    }
  }

  return demandByKey;
}

function getRestockRecommendations(items, salesEvents) {
  const demandMap = buildDemandMap(salesEvents, 7);

  return items
    .map((item) => {
      const quantity = Number(item.quantity);
      const minStock = Number(item.minStock);
      if (Number.isNaN(quantity) || Number.isNaN(minStock)) return null;

      const keyById = String(item.id || '').trim().toLowerCase();
      const keyByName = String(item.name || '').trim().toLowerCase();
      const demand7d = (demandMap.get(keyById) || 0) + (keyById !== keyByName ? (demandMap.get(keyByName) || 0) : 0);

      const lowStock = quantity <= minStock;
      const highDemand = demand7d >= minStock;
      const suggestedQty = Math.max(0, Math.ceil(Math.max((minStock * 2) - quantity, demand7d - quantity + minStock)));

      if (!lowStock && !highDemand) return null;
      if (suggestedQty <= 0) return null;

      let reason = '';
      if (lowStock && highDemand) reason = 'stock is low and demand is high';
      else if (lowStock) reason = 'stock is low';
      else reason = 'demand is high';

      return {
        ...item,
        demand7d,
        suggestedQty,
        reason,
        botMessage: `Order ${suggestedQty} ${item.name} because ${reason}.`
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.suggestedQty - a.suggestedQty)
    .map((item) => ({
      ...item,
      suggestionKey: `${String(item.id || item.sku || item.name || '').toLowerCase()}|${item.suggestedQty}|${item.reason}`
    }));
}

function getSeenSuggestionKeys() {
  try {
    const raw = localStorage.getItem(RESTOCK_SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((v) => String(v)));
  } catch {
    return new Set();
  }
}

function setSeenSuggestionKeys(seenSet) {
  try {
    localStorage.setItem(RESTOCK_SEEN_KEY, JSON.stringify(Array.from(seenSet)));
  } catch {
    // Ignore storage errors so recommendations still work.
  }
}

function getUnreadRecommendations(recommendations) {
  const seen = getSeenSuggestionKeys();
  return recommendations.filter((item) => !seen.has(item.suggestionKey));
}

function markRecommendationsAsRead(recommendations) {
  const seen = getSeenSuggestionKeys();
  recommendations.forEach((item) => {
    if (item && item.suggestionKey) seen.add(item.suggestionKey);
  });
  setSeenSuggestionKeys(seen);
}

function renderLowStockList(recommendations) {
  const list = document.getElementById('lowStockList');
  if (!list) return;

  if (recommendations.length === 0) {
    list.innerHTML = `<p class="empty-state">No restock suggestions right now.</p>`;
    return;
  }

  list.innerHTML = recommendations.map(item => `
    <div class="alert-item">
      <div class="alert-info">
        <p class="alert-name">${item.name || '-'}</p>
        <p class="alert-sku">${item.botMessage}</p>
      </div>
      <div class="alert-quantity">
        <p class="alert-qty-text">Order ${item.suggestedQty}</p>
        <p class="alert-qty-label">Stock: ${Number(item.quantity) <= 0 ? 0 : item.quantity} | 7d demand: ${item.demand7d}</p>
      </div>
    </div>
  `).join('');
}

async function updateLowStockAvatar() {
  const avatar = document.getElementById('lowStockAvatar');
  const badge = document.getElementById('lowStockBadge');
  if (!avatar || !badge) return;

  const [items, salesEvents] = await Promise.all([api('/items'), api('/orders')]);
  const recommendations = getRestockRecommendations(items, salesEvents);
  const unread = getUnreadRecommendations(recommendations);
  const count = unread.length;

  badge.textContent = String(count);

  if (count > 0) {
    avatar.classList.add('low-stock-avatar--alert');
    badge.style.display = 'flex';
    avatar.title = `Restock bot suggestions: ${count}`;
  } else {
    avatar.classList.remove('low-stock-avatar--alert');
    badge.style.display = 'none';
    avatar.title = 'No restock suggestions';
  }

  // If the modal is open, refresh list content.
  const modal = document.getElementById('lowStockModal');
  if (modal && !modal.classList.contains('hidden')) {
    renderLowStockList(recommendations);
  }
}

async function openLowStockModal() {
  const modal = document.getElementById('lowStockModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const [items, salesEvents] = await Promise.all([api('/items'), api('/orders')]);
  const recommendations = getRestockRecommendations(items, salesEvents);
  markRecommendationsAsRead(recommendations);
  updateLowStockAvatar().catch((error) => console.error(error));
  renderLowStockList(recommendations);
}

function closeLowStockModal() {
  const modal = document.getElementById('lowStockModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

async function renderSales() {
  const salesEvents = await api('/orders');
  renderSalesStats(salesEvents);
  renderSalesTable(salesEvents);
  renderSalesChart(salesEvents);
}

document.addEventListener('DOMContentLoaded', () => {
  renderSales().catch((error) => console.error(error));
  updateLowStockAvatar().catch((error) => console.error(error));

  // Close modal interactions
  const avatar = document.getElementById('lowStockAvatar');
  if (avatar) avatar.addEventListener('click', openLowStockModal);

  const closeBtn = document.getElementById('lowStockModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeLowStockModal);

  const modal = document.getElementById('lowStockModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      // Close only if clicking the backdrop.
      if (e.target === modal) closeLowStockModal();
    });
  }

  // Fallback refresh in case storage events don't fire.
  setInterval(() => {
    renderSales().catch((error) => console.error(error));
    updateLowStockAvatar().catch((error) => console.error(error));
  }, 5000);
});
