const API_BASE = '/api';

let items = [];
let categories = [];
let currentEditItemId = null;
let currentEditCategoryId = null;

async function api(path, options = {}) {
  const fetchOptions = { ...options };
  const hasFormDataBody = fetchOptions.body instanceof FormData;
  if (!hasFormDataBody) {
    fetchOptions.headers = { 'Content-Type': 'application/json', ...(fetchOptions.headers || {}) };
  }
  const response = await fetch(`${API_BASE}${path}`, fetchOptions);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Session expired');
  }
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

// ============================================
// 3. VIEW NAVIGATION & ROUTING
// ============================================

// Navigation
function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view-content').forEach(view => {
    view.classList.add('hidden');
  });

  // Remove active class from all nav items
  document.querySelectorAll('.nav-link').forEach(item => {
    item.classList.remove('active-nav');
  });

  // Show selected view
  document.getElementById(`${viewName}-view`).classList.remove('hidden');

  // Add active class to selected nav item
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active-nav');

  // Refresh view content
  if (viewName === 'dashboard') {
    renderDashboard();
  } else if (viewName === 'inventory') {
    renderInventory();
  } else if (viewName === 'categories') {
    renderCategories();
  }
}

// ============================================
// 4. DASHBOARD - STATISTICS & OVERVIEW
// ============================================

// Dashboard Functions
function renderDashboard() {
  const items = getItems();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockItems = items.filter(item => item.quantity <= item.minStock);
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  // Render stats
  const statsGrid = document.getElementById('stats-grid');
  statsGrid.innerHTML = `
                ${renderStatCard('Total Stock Quantity', totalItems.toLocaleString(), '#3b82f6', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01 20.73 6.96 M12 22.08 12 12')}
                ${renderStatCard('Unique Products', items.length, '#10b981', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01 20.73 6.96 M12 22.08 12 12')}
                ${renderStatCard('Low Stock Items', lowStockItems.length, '#ef4444', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01')}
                ${renderStatCard('Total Inventory Value', `₱${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '#8b5cf6', 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6')}
            `;

  // Render low stock items
  const lowStockList = document.getElementById('low-stock-list');
  if (lowStockItems.length === 0) {
    lowStockList.innerHTML = '<p class="empty-state">No low stock items</p>';
  } else {
    lowStockList.innerHTML = lowStockItems.slice(0, 10).map(item => `
                    <div class="alert-item">
                        <div class="alert-info">
                            <p class="alert-name">${item.name}</p>
                            <p class="alert-sku">SKU: ${item.sku}</p>
                        </div>
                        <div class="alert-quantity">
                            <p class="alert-qty-text">
                                ${item.quantity} / ${item.minStock} ${item.unit}
                            </p>
                            <p class="alert-qty-label">Min stock level</p>
                        </div>
                    </div>
                `).join('');
  }
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

// ============================================
// 5. INVENTORY MANAGEMENT
// ============================================

function renderInventory() {
  const categoryFilter = document.getElementById('category-filter');
  const selectedFilter = categoryFilter.value || 'all';
  categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
    categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
  categoryFilter.value = selectedFilter;

  const itemCategory = document.getElementById('item-category');
  itemCategory.innerHTML = categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');

  filterInventory();
}

function filterInventory() {
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  const categoryFilter = document.getElementById('category-filter').value;

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery) ||
      item.sku.toLowerCase().includes(searchQuery);

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const tableBody = document.getElementById('inventory-table-body');

  if (filteredItems.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No items found</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredItems.map(item => {
    const category = categories.find(c => c.name === item.category);
    const isLowStock = Number(item.quantity) <= Number(item.minStock);

    return `
                    <tr>
                        <td>
                            <div class="item-name">${item.name}</div>
                            <div class="item-description">${item.description}</div>
                        </td>
                        <td class="qty-text">${item.sku}</td>
                        <td>
                            <span class="category-badge" 
                                  style="background-color: ${category?.color}20; color: ${category?.color}">
                                ${item.category}
                            </span>
                        </td>
                        <td>
                            <div class="qty-wrapper">
                                <span class="qty-text">${item.quantity}</span>
                                ${isLowStock ? '<svg class="warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01"></path></svg>' : ''}
                            </div>
                            <div class="qty-min">Min: ${item.minStock}</div>
                        </td>
                        <td class="qty-text">₱${item.price.toFixed(2)}</td>
                        <td class="text-right">
                            <div class="table-actions">
                                <button onclick="editItem('${item.id}')" class="icon-btn edit">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                </button>
                                <button onclick="deleteItem('${item.id}')" class="icon-btn delete">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
  }).join('');
}

function openItemModal() {
  currentEditItemId = null;
  document.getElementById('item-modal-title').textContent = 'Add New Item';
  document.getElementById('item-submit-text').textContent = 'Add Item';
  document.getElementById('item-form').reset();
  document.getElementById('item-modal').classList.remove('hidden');
}

function editItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  currentEditItemId = id;
  document.getElementById('item-modal-title').textContent = 'Edit Item';
  document.getElementById('item-submit-text').textContent = 'Update Item';

  document.getElementById('item-name').value = item.name;
  document.getElementById('item-sku').value = item.sku;
  document.getElementById('item-category').value = item.category;
  document.getElementById('item-quantity').value = item.quantity;
  document.getElementById('item-minstock').value = item.minStock;
  document.getElementById('item-price').value = item.price;
  document.getElementById('item-image').value = item.image || '';
  document.getElementById('item-image-file').value = '';
  document.getElementById('item-description').value = item.description;

  document.getElementById('item-modal').classList.remove('hidden');
}

function closeItemModal() {
  currentEditItemId = null;
  document.getElementById('item-modal').classList.add('hidden');
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  await api(`/items/${id}`, { method: 'DELETE' });
  await refreshData();
}

// ============================================
// 6. CATEGORY MANAGEMENT
// ============================================

function renderCategories() {
  const grid = document.getElementById('categories-grid');

  if (categories.length === 0) {
    grid.innerHTML = `
                    <div style="grid-column: 1 / -1;" class="text-center" style="padding: 48px 24px;">
                        <svg style="width: 48px; height: 48px; color: #9ca3af; margin: 0 auto 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <p style="color: #6b7280; margin-bottom: 16px;">No categories yet</p>
                        <button onclick="toggleCategoryForm()" class="btn btn-primary">Create Your First Category</button>
                    </div>
                `;
    return;
  }

  grid.innerHTML = categories.map(category => {
    const itemCount = items.filter(item => item.category === category.name).length;

    return `
                    <div class="category-card">
                        <div class="category-header">
                            <div class="category-icon-wrapper" style="background-color: ${category.color}20">
                                <svg class="category-icon" style="color: ${category.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </div>
                            <div class="category-actions">
                                <button onclick="editCategory('${category.id}')" class="icon-btn edit">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                </button>
                                <button onclick="deleteCategory('${category.id}')" class="icon-btn delete">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <h3 class="category-name">${category.name}</h3>
                        <p class="category-description">${category.description}</p>
                        <div class="category-footer">
                            <span class="category-footer-label">Items</span>
                            <span class="category-count" style="color: ${category.color}">${itemCount}</span>
                        </div>
                    </div>
                `;
  }).join('');
}

function toggleCategoryForm() {
  const form = document.getElementById('category-form');
  const isHidden = form.classList.contains('hidden');

  if (isHidden) {
    form.classList.remove('hidden');
    document.getElementById('add-category-btn').classList.add('hidden');
  } else {
    cancelCategoryForm();
  }
}

function cancelCategoryForm() {
  currentEditCategoryId = null;
  document.getElementById('category-form').classList.add('hidden');
  document.getElementById('add-category-btn').classList.remove('hidden');
  document.getElementById('category-form-element').reset();
  document.getElementById('category-form-title').textContent = 'Add New Category';
  document.getElementById('category-submit-text').textContent = 'Add Category';
}

function editCategory(id) {
  const category = categories.find(c => c.id === id);
  if (!category) return;

  currentEditCategoryId = id;
  document.getElementById('category-form-title').textContent = 'Edit Category';
  document.getElementById('category-submit-text').textContent = 'Update Category';
  document.getElementById('category-name').value = category.name;
  document.getElementById('category-description').value = category.description;
  document.getElementById('category-color').value = category.color;

  document.getElementById('category-form').classList.remove('hidden');
  document.getElementById('add-category-btn').classList.add('hidden');
}

async function deleteCategory(id) {
  const category = categories.find(c => c.id === id);
  if (!category) return;

  const itemsInCategory = items.filter(item => item.category === category.name);

  if (itemsInCategory.length > 0) {
    alert(`Cannot delete category. ${itemsInCategory.length} items are using this category.`);
    return;
  }

  if (!confirm('Are you sure you want to delete this category?')) return;

  await api(`/categories/${id}`, { method: 'DELETE' });
  await refreshData();
}

// ============================================
// 7. FORM HANDLERS & EVENT LISTENERS
// ============================================

// Item Form Handler
document.getElementById('item-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const body = new FormData();
  body.append('name', document.getElementById('item-name').value);
  body.append('sku', document.getElementById('item-sku').value);
  body.append('category', document.getElementById('item-category').value);
  body.append('quantity', String(Number(document.getElementById('item-quantity').value)));
  body.append('minStock', String(Number(document.getElementById('item-minstock').value)));
  body.append('price', String(Number(document.getElementById('item-price').value)));
  body.append('description', document.getElementById('item-description').value);
  body.append('image', document.getElementById('item-image').value.trim());

  const imageFileInput = document.getElementById('item-image-file');
  if (imageFileInput.files && imageFileInput.files[0]) {
    body.append('imageFile', imageFileInput.files[0]);
  }

  if (currentEditItemId) {
    await api(`/items/${currentEditItemId}`, {
      method: 'PUT',
      body
    });
  } else {
    await api('/items', {
      method: 'POST',
      body
    });
  }

  closeItemModal();
  await refreshData();
});

// Category Form Handler
document.getElementById('category-form-element').addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('category-name').value,
    description: document.getElementById('category-description').value,
    color: document.getElementById('category-color').value,
  };

  if (currentEditCategoryId) {
    await api(`/categories/${currentEditCategoryId}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });
  } else {
    await api('/categories', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  }

  cancelCategoryForm();
  await refreshData();
});

async function refreshData() {
  [items, categories] = await Promise.all([api('/items'), api('/categories')]);
  renderInventory();
  renderCategories();
}

// ============================================
// 8. PAGE INITIALIZATION
// ============================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
  refreshData()
    .then(() => showView('inventory'))
    .catch((error) => {
      console.error(error);
      alert(error.message || 'Failed to load inventory data.');
    });
});