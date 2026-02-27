// popup.js - handles the extension popup UI

const POLL_INTERVAL = 3000;

async function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

async function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

async function removeStorage(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
}

function showView(name) {
  document.getElementById('view-unpaired').style.display = name === 'unpaired' ? 'block' : 'none';
  document.getElementById('view-paired').style.display = name === 'paired' ? 'block' : 'none';
}

async function detectServerUrl() {
  // Try to get from storage first
  const { serverUrl } = await getStorage(['serverUrl']);
  if (serverUrl) return serverUrl;
  return null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

async function pairExtension(code, serverUrl) {
  const url = `${serverUrl}/api/extension/pair`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'Invalid code');
  }
  const data = await res.json();
  return data.data;
}

async function fetchPendingSession(serverUrl, userId) {
  try {
    const res = await fetchWithTimeout(
      `${serverUrl}/api/extension/posting-session/latest?userId=${encodeURIComponent(userId)}`,
      {},
      4000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
  } catch {
    return null;
  }
}

function renderVehicleCard(session) {
  const v = typeof session.vehicleData === 'string'
    ? JSON.parse(session.vehicleData)
    : session.vehicleData;
  const price = v.price ? `$${Number(v.price).toLocaleString()}` : '';
  const mileage = v.mileage ? `${Number(v.mileage).toLocaleString()} mi` : '';
  return `
    <div class="vehicle-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div class="vehicle-title">${v.year || ''} ${v.make || ''} ${v.model || ''} ${v.trim || ''}</div>
          <div class="vehicle-meta">${mileage}${mileage && v.color ? ' &middot; ' : ''}${v.color || ''}</div>
          <div class="vehicle-price">${price}</div>
        </div>
        <span class="tag tag-yellow">Ready to Post</span>
      </div>
    </div>
  `;
}

async function init() {
  const { paired, userId, serverUrl, pairingId, pendingSession, unreadMessageCount = 0 } = await getStorage([
    'paired', 'userId', 'serverUrl', 'pairingId', 'pendingSession', 'unreadMessageCount'
  ]);

  // Restore server URL input
  if (serverUrl) {
    document.getElementById('server-url-input').value = serverUrl;
  }

  if (paired && userId && serverUrl) {
    showView('paired');

    // Show unread messages banner if there are any
    if (unreadMessageCount > 0) {
      const banner = document.getElementById('unread-banner');
      const badge = document.getElementById('unread-badge');
      const label = document.getElementById('unread-label');
      const link = document.getElementById('open-inbox-btn');

      badge.textContent = unreadMessageCount > 9 ? '9+' : String(unreadMessageCount);
      label.textContent = unreadMessageCount === 1
        ? '1 new message from a buyer'
        : `${unreadMessageCount} new messages from buyers`;

      // Link to the app dashboard (derive from serverUrl → frontend URL, or use BASE_URL)
      // Best effort: open the app root — user navigates to Conversations/CRM tab
      const appUrl = serverUrl.replace(':3000', ':8000').replace('preview-', '').replace(/\/api$/, '');
      link.href = appUrl;
      banner.style.display = 'block';

      // Clear unread count when popup is opened
      await setStorage({ unreadMessageCount: 0 });
      chrome.runtime.sendMessage({ type: 'CLEAR_UNREAD' });
    }

    // Poll for pending session
    const session = await fetchPendingSession(serverUrl, userId);
    if (session && session.id) {
      await setStorage({ pendingSession: session });
      document.getElementById('pending-vehicle').style.display = 'block';
      document.getElementById('pending-vehicle').innerHTML = renderVehicleCard(session);
      document.getElementById('post-now-btn').style.display = 'block';
      document.getElementById('status-text').textContent = 'Vehicle ready to post!';
      document.getElementById('status-bar-ready').querySelector('.status-dot').className = 'status-dot dot-yellow';
    } else {
      document.getElementById('pending-vehicle').style.display = 'none';
      document.getElementById('post-now-btn').style.display = 'none';
      document.getElementById('status-text').textContent = 'Ready \u2014 waiting for posts';
    }
  } else {
    showView('unpaired');
  }
}

// Save server URL
document.getElementById('save-server-btn').addEventListener('click', async () => {
  const url = document.getElementById('server-url-input').value.trim().replace(/\/$/, '');
  if (url) {
    await setStorage({ serverUrl: url });
    document.getElementById('save-server-btn').textContent = 'Saved!';
    setTimeout(() => { document.getElementById('save-server-btn').textContent = 'Save'; }, 1500);
  }
});

// Pair button
document.getElementById('pair-btn').addEventListener('click', async () => {
  const code = document.getElementById('pairing-code-input').value.trim();
  const errEl = document.getElementById('error-msg');
  errEl.style.display = 'none';

  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    errEl.textContent = 'Please enter a valid 6-digit code';
    errEl.style.display = 'block';
    return;
  }

  let serverUrl = document.getElementById('server-url-input').value.trim().replace(/\/$/, '');
  if (!serverUrl) {
    errEl.textContent = 'Please enter your server URL first';
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('pair-btn').textContent = 'Pairing...';
  document.getElementById('pair-btn').disabled = true;

  try {
    const result = await pairExtension(code, serverUrl);
    await setStorage({
      paired: true,
      userId: result.userId,
      pairingId: result.pairingId,
      serverUrl,
    });
    showView('paired');
    document.getElementById('status-text').textContent = 'Ready \u2014 waiting for posts';
  } catch (e) {
    errEl.textContent = e.message || 'Pairing failed';
    errEl.style.display = 'block';
    document.getElementById('pair-btn').textContent = 'Pair Extension';
    document.getElementById('pair-btn').disabled = false;
  }
});

// Post now button
document.getElementById('post-now-btn').addEventListener('click', async () => {
  const { pendingSession, serverUrl } = await getStorage(['pendingSession', 'serverUrl']);
  if (!pendingSession) return;

  // Store session in storage so content script can read it
  await setStorage({ activeSession: pendingSession, serverUrl });

  // Open Facebook Marketplace create vehicle page
  chrome.tabs.create({
    url: 'https://www.facebook.com/marketplace/create/vehicle',
    active: true,
  });

  window.close();
});

// Unpair
document.getElementById('unpair-btn').addEventListener('click', async () => {
  await removeStorage(['paired', 'userId', 'pairingId', 'pendingSession', 'activeSession']);
  showView('unpaired');
});

// Init
init();
