// ==================== LOGIN PAGE FUNCTIONS ====================
window.initializeLoginForm = function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const usernameError = document.getElementById('usernameError');
  const passwordError = document.getElementById('passwordError');
  const serverErrors = document.getElementById('serverErrors');

  function clearErrors() {
    if (usernameError) usernameError.textContent = '';
    if (passwordError) passwordError.textContent = '';
    if (serverErrors) {
      serverErrors.textContent = '';
      serverErrors.style.display = 'none';
    }
  }

  function validateClient() {
    clearErrors();
    let valid = true;

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username) {
      if (usernameError) usernameError.textContent = 'Username is required.';
      valid = false;
    } else if (username.length < 3) {
      if (usernameError) usernameError.textContent = 'Username must be at least 3 characters.';
      valid = false;
    }

    if (!password) {
      if (passwordError) passwordError.textContent = 'Password is required.';
      valid = false;
    } else if (password.length < 8) {
      if (passwordError) passwordError.textContent = 'Password must be at least 8 characters.';
      valid = false;
    }

    return valid;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateClient()) return;

    try {
      const next = new URLSearchParams(window.location.search).get('next') || '';
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          username: usernameInput ? usernameInput.value.trim() : '',
          password: passwordInput ? passwordInput.value : '',
          next
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.errors && Array.isArray(data.errors)) {
          const mainMsg = data.errors[0]?.msg || 'Login failed.';
          if (serverErrors) {
            serverErrors.textContent = mainMsg;
            serverErrors.style.display = 'block';
          }
        } else {
          if (serverErrors) {
            serverErrors.textContent = data.message || 'Login failed.';
            serverErrors.style.display = 'block';
          }
        }
        return;
      }

      // On success, redirect to dashboard immediately
      if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        window.location.href = '/dashboard.html';
      }
    } catch (err) {
      console.error('Login error:', err);
      if (serverErrors) {
        serverErrors.textContent = 'Unable to reach server. Please try again.';
        serverErrors.style.display = 'block';
      }
    }
  });
};

// Initialize based on page
document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM loaded, initializing...');

  // Check if we're on the kiosk page
  if (document.getElementById('kioskGrid')) {
    console.log('Initializing kiosk page');
    updateCartDisplay();
    updateAddButton();
  }

  // Check if we're on the login page
  if (document.getElementById('loginForm')) {
    console.log('Initializing login page');
    initializeLoginForm();
  }
});

// Also check if QRCode library loaded correctly
window.addEventListener('load', function () {
  if (typeof QRCode !== 'undefined') {
    console.log('QRCode library loaded successfully');
  } else {
    console.error('QRCode library not loaded! Check internet connection or script source.');
  }
});



