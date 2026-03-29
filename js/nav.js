async function logoutAndGoToLogin() {
  try {
    await fetch('/logout', { method: 'POST' });
  } catch {
    // ignore
  } finally {
    window.location.href = '/login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('[data-action="menu-toggle"]');
  const menuList = document.querySelector('[data-menu-list]');
  let currentRole = null;

  function closeMenu() {
    if (!menuList || !menuToggle) return;
    menuList.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!menuList || !menuToggle) return;
    menuList.hidden = false;
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  if (menuToggle && menuList) {
    menuToggle.addEventListener('click', () => {
      if (menuList.hidden) openMenu();
      else closeMenu();
    });

    document.addEventListener('click', (event) => {
      const menuContainer = document.querySelector('.app-menu');
      if (!menuContainer) return;
      if (!menuContainer.contains(event.target)) closeMenu();
    });
  }

  const currentPath = window.location.pathname;
  const bodyClassList = document.body?.classList;

  // Show only the allowed menu items per current page.
  // We prefer body classes because they are stable across different path formats.
  const isReportsPageByBody = !!bodyClassList?.contains('management-page-solo');
  const isInventoryPageByBody = !!bodyClassList?.contains('inventory-page') && !isReportsPageByBody;
  const isDashboardPageByBody = !isInventoryPageByBody && !isReportsPageByBody;

  // Fallback to pathname match (in case body classes change later).
  const isDashboardPageByPath = currentPath.endsWith('/dashboard.html') || currentPath === '/dashboard.html';
  const isInventoryPageByPath = currentPath.endsWith('/inventory.html') || currentPath === '/inventory.html';
  const isReportsPageByPath = currentPath.endsWith('/management.html') || currentPath === '/management.html';

  const isDashboardPage = isDashboardPageByBody || (!isInventoryPageByBody && !isReportsPageByBody && isDashboardPageByPath);
  const isInventoryPage = isInventoryPageByBody || (!isInventoryPageByBody && isInventoryPageByPath);
  const isReportsPage = isReportsPageByBody || (!isReportsPageByBody && isReportsPageByPath);

  const dashboardLink = document.querySelector('a.app-menu-item[href="/dashboard.html"]');
  const inventoryLink = document.querySelector('a.app-menu-item[href="/inventory.html"]');
  const reportsLink = document.querySelector('a.app-menu-item[href="/management.html"]');

  const showDashboard = isDashboardPage || (!isInventoryPage && !isReportsPage);
  const showInventory = isInventoryPage;
  const showReports = isReportsPage;

  if (dashboardLink) dashboardLink.hidden = !showDashboard;
  if (inventoryLink) inventoryLink.hidden = !showInventory;
  if (reportsLink) reportsLink.hidden = !showReports;

  document.querySelectorAll('.app-menu-item[href]').forEach((link) => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('app-menu-item-active');
    }
  });

  document.querySelectorAll('.app-menu-item[href]').forEach((link) => {
    link.addEventListener('click', async (e) => {
      const href = link.getAttribute('href');
      if (!href) return;

      // If user clicks a page they don't have access to,
      // log out and send them to login with a "next" hint.
      const allowed = currentRole ? allowedPageByRole[currentRole] : null;
      if (allowed && href !== allowed) {
        e.preventDefault();
        closeMenu();
        try {
          await fetch('/logout', { method: 'POST' });
        } catch {
          // ignore
        }
        window.location.href = `/login.html?next=${encodeURIComponent(href)}`;
        return;
      }
    });
  });

  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
      logoutAndGoToLogin();
    });
  });
});

