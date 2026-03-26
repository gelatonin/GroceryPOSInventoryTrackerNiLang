const API_BASE = '/api';

let salesChart = null;

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

function getLowStockItems(items) {
  return items.filter(item => {
    const qty = Number(item.quantity);
    const minStock = Number(item.minStock);
    if (Number.isNaN(qty) || Number.isNaN(minStock)) return false;
    return qty <= minStock;
  });
}

function renderLowStockList(lowStockItems) {
  const list = document.getElementById('lowStockList');
  if (!list) return;

  if (lowStockItems.length === 0) {
    list.innerHTML = `<p class="empty-state">All good. No low stock items.</p>`;
    return;
  }

  list.innerHTML = lowStockItems.map(item => `
    <div class="alert-item">
      <div class="alert-info">
        <p class="alert-name">${item.name || '-'}</p>
        <p class="alert-sku">SKU: ${item.sku || '-'}</p>
      </div>
      <div class="alert-quantity">
        <p class="alert-qty-text">${Number(item.quantity) <= 0 ? 0 : item.quantity} / ${item.minStock}</p>
        <p class="alert-qty-label">${Number(item.quantity) <= 0 ? 'Out of stock' : 'Min stock level'}</p>
      </div>
    </div>
  `).join('');
}

async function updateLowStockAvatar() {
  const avatar = document.getElementById('lowStockAvatar');
  const badge = document.getElementById('lowStockBadge');
  if (!avatar || !badge) return;

  const items = await api('/items');
  const lowStockItems = getLowStockItems(items);
  const count = lowStockItems.length;

  badge.textContent = String(count);

  if (count > 0) {
    avatar.classList.add('low-stock-avatar--alert');
    badge.style.display = 'flex';
    avatar.title = `Low stock items: ${count}`;
  } else {
    avatar.classList.remove('low-stock-avatar--alert');
    badge.style.display = 'none';
    avatar.title = 'No low stock items';
  }

  // If the modal is open, refresh list content.
  const modal = document.getElementById('lowStockModal');
  if (modal && !modal.classList.contains('hidden')) {
    renderLowStockList(lowStockItems);
  }
}

async function openLowStockModal() {
  const modal = document.getElementById('lowStockModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const items = await api('/items');
  const lowStockItems = getLowStockItems(items);
  renderLowStockList(lowStockItems);
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
