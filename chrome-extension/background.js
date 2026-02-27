// background.js - service worker for the DealerPost Pro extension

// Keep alive for polling
chrome.alarms.create('poll', { periodInMinutes: 0.1 }); // every 6 seconds

// ── Alarm: poll for pending posting sessions ────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'poll') return;

  const { paired, userId, serverUrl } = await chrome.storage.local.get(['paired', 'userId', 'serverUrl']);
  if (!paired || !userId || !serverUrl) return;

  try {
    const res = await fetch(
      `${serverUrl}/api/extension/posting-session/latest?userId=${encodeURIComponent(userId)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    const session = data.data;

    // Read persisted unread count
    const { unreadMessageCount = 0 } = await chrome.storage.local.get(['unreadMessageCount']);

    if (session && session.id) {
      await chrome.storage.local.set({ pendingSession: session });
      // Show badge for pending post only if no unread messages badge is showing
      if (unreadMessageCount === 0) {
        chrome.action.setBadgeText({ text: '1' });
        chrome.action.setBadgeBackgroundColor({ color: '#d4a017' });
      }
    } else {
      await chrome.storage.local.remove(['pendingSession']);
      // Only clear badge if no unread messages
      if (unreadMessageCount === 0) {
        chrome.action.setBadgeText({ text: '' });
      }
    }
  } catch (e) {
    // Ignore network errors
  }
});

// ── Message handler from content/inbox scripts ──────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_BUYER_MESSAGE') {
    (async () => {
      // Persist unread count so it survives service worker restarts
      const { unreadMessageCount = 0 } = await chrome.storage.local.get(['unreadMessageCount']);
      const newCount = unreadMessageCount + 1;
      await chrome.storage.local.set({ unreadMessageCount: newCount });

      // Show red badge with count
      const countText = newCount > 9 ? '9+' : String(newCount);
      chrome.action.setBadgeText({ text: countText });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

      console.log('[DealerPost BG] New message from:', message.buyerName,
        '| Conversation:', message.conversationId, '| Unread:', newCount);

      sendResponse({ received: true });
    })();
    return true;
  }

  if (message.type === 'CLEAR_UNREAD') {
    (async () => {
      await chrome.storage.local.set({ unreadMessageCount: 0 });
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ cleared: true });
    })();
    return true;
  }

  return true;
});

// ── Clear badge when popup is opened ────────────────────────────────────────
chrome.action.onClicked.addListener(async () => {
  await chrome.storage.local.set({ unreadMessageCount: 0 });
  chrome.action.setBadgeText({ text: '' });
});

// ── When a FB Marketplace create/vehicle tab finishes loading, inject content script ──
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url?.includes('facebook.com/marketplace/create/vehicle')
  ) {
    const { activeSession } = await chrome.storage.local.get(['activeSession']);
    if (!activeSession) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    } catch (e) {
      console.log('[DealerPost] Could not inject content script:', e);
    }
  }
});
