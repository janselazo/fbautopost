// inbox.js - runs on facebook.com/marketplace/* and messenger.com pages
// Detects buyer messages in real time and forwards them to DealerPost Pro backend
// Also polls for pending replies from the app and sends them back on Facebook

(async () => {
  const { paired, userId, serverUrl } = await chrome.storage.local.get(['paired', 'userId', 'serverUrl']);
  if (!paired || !userId || !serverUrl) return;

  console.log('[DealerPost Inbox] Active — watching for buyer messages');

  // Key: FB thread URL → conversationId in our backend
  const threadConversationMap = {};
  const processedMessageFingerprints = new Set();
  let currentConversationId = null;
  let replyPollInterval = null;

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Thread URL (stable dedup key) ───────────────────────────────────────────

  function getThreadUrl() {
    // Normalise the URL to a stable key for this FB conversation thread.
    // Remove query params and trailing slashes so the same thread always maps
    // to the same key even if FB appends ?ref=xxx etc.
    return window.location.href.split('?')[0].replace(/\/$/, '');
  }

  // ── Context extraction ──────────────────────────────────────────────────────

  function getListingContext() {
    // FB Marketplace conversation header shows the listing card
    const listingLinks = document.querySelectorAll('a[href*="/marketplace/item/"]');
    for (const link of listingLinks) {
      const title =
        link.querySelector('span')?.innerText?.trim() ||
        link.innerText?.trim() ||
        null;

      // Look for price near the listing link
      const container = link.closest('[data-pagelet], [data-virtualizer-key], [role="complementary"]') || link.parentElement;
      const priceEl =
        container?.querySelector('[aria-label*="$"]') ||
        document.querySelector('[aria-label*="$"]');
      const price = priceEl?.getAttribute('aria-label') || priceEl?.innerText?.trim() || null;

      if (title) {
        return {
          title,
          price,
          url: link.href,
          thumbnail: link.querySelector('img')?.src || null,
        };
      }
    }

    // Messenger: look for a "From [Listing Title]" header
    const subjectEls = document.querySelectorAll('[data-testid="messaging_thread_subheader"] span, [aria-label*="Marketplace"]');
    for (const el of subjectEls) {
      const text = el.innerText?.trim();
      if (text && text.length > 3) return { title: text, price: null, url: window.location.href, thumbnail: null };
    }

    return null;
  }

  function getBuyerName() {
    // FB Marketplace conversation page
    const selectors = [
      '[role="main"] h1',
      '[role="main"] h2',
      '[aria-label*="conversation"] h1',
      '[aria-label*="conversation"] h2',
      // Messenger header
      'a[role="link"] > span[dir="auto"]',
      // Thread participant name
      '[data-testid="messaging_thread_label"] span',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const name = el?.innerText?.trim();
      if (name && name.length > 1 && name.length < 80) return name;
    }

    // Fallback: profile link text near top
    const profileLinks = document.querySelectorAll(
      'a[href*="/profile.php"], a[href*="facebook.com/"][role="link"]'
    );
    for (const link of profileLinks) {
      const name = link.innerText?.trim();
      if (name && name.length > 1 && name.length < 60 && !/facebook|marketplace/i.test(name)) {
        return name;
      }
    }

    return 'Unknown Buyer';
  }

  function getFbProfileUrl() {
    // Try to get the buyer's FB profile URL for deduplication
    const profileLinks = document.querySelectorAll(
      'a[href*="/profile.php"], a[href*="facebook.com/"][role="link"]'
    );
    for (const link of profileLinks) {
      const href = link.href;
      if (href && /profile\.php|facebook\.com\/[a-zA-Z0-9._]+$/.test(href)) return href;
    }
    return window.location.href;
  }

  // ── Message extraction ──────────────────────────────────────────────────────

  function messageFingerprint(text, direction) {
    // Use first 80 chars + direction as stable dedup key
    return `${direction}:${text.substring(0, 80).replace(/\s+/g, ' ').trim()}`;
  }

  // Determine if a message bubble is "incoming" (from the buyer, not us)
  function isIncomingMessage(el) {
    // FB outgoing messages have class / aria indicating "you sent"
    if (
      el.getAttribute('aria-label')?.toLowerCase().includes('you sent') ||
      el.querySelector('[aria-label*="you sent" i]')
    ) return false;

    // Structural heuristic: outgoing messages are right-aligned
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement?.getBoundingClientRect();
    if (!parentRect || parentRect.width === 0) return true;

    const centerX = rect.left + rect.width / 2;
    const parentCenterX = parentRect.left + parentRect.width / 2;
    // If bubble center is to the right of parent center → outgoing
    return centerX < parentCenterX;
  }

  function extractText(el) {
    // FB message text is in nested [dir="auto"] spans
    const seen = new Set();
    const texts = [];

    // Try multiple levels of nesting
    const dirEls = el.querySelectorAll('[dir="auto"], [dir="ltr"]');
    for (const t of dirEls) {
      if (t.children.length > 0) continue; // leaf only
      const text = t.innerText?.trim();
      if (text && text.length > 0 && !seen.has(text)) {
        seen.add(text);
        texts.push(text);
      }
    }

    if (texts.length > 0) return texts.join(' ');

    // Fallback: aria-label (FB sometimes puts message text here)
    const ariaText = el.getAttribute('aria-label');
    if (ariaText && ariaText.length > 2) return ariaText.trim();

    return el.innerText?.trim() || '';
  }

  // ── Backend API ─────────────────────────────────────────────────────────────

  async function ensureConversation(buyerName, listingContext, threadUrl) {
    // Check local cache first — avoids redundant API calls for the same thread
    if (threadConversationMap[threadUrl]) {
      return threadConversationMap[threadUrl];
    }

    const res = await fetch(`${serverUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerName,
        vehicle: listingContext?.title || 'Unknown Vehicle',
        vehiclePrice: listingContext?.price || null,
        listingUrl: threadUrl, // thread URL is the stable dedup key
        userId,
        fbProfileUrl: getFbProfileUrl(),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const convId = data.data?.id || null;
    if (convId) {
      threadConversationMap[threadUrl] = convId;
    }
    return convId;
  }

  async function saveMessage(conversationId, direction, messageText) {
    await fetch(`${serverUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction,
        body: messageText,
        source: 'fb_marketplace',
        userId,
      }),
    });
  }

  async function forwardMessage({ buyerName, messageText, listingContext, direction, threadUrl }) {
    if (!messageText || messageText.length < 2) return;

    const fp = messageFingerprint(messageText, direction);
    if (processedMessageFingerprints.has(fp)) return;
    processedMessageFingerprints.add(fp);

    console.log('[DealerPost Inbox]', direction, ':', messageText.substring(0, 60));

    try {
      const conversationId = await ensureConversation(buyerName, listingContext, threadUrl);
      if (!conversationId) return;

      currentConversationId = conversationId;
      await saveMessage(conversationId, direction, messageText);

      if (direction === 'incoming') {
        // Notify background script → badge
        chrome.runtime.sendMessage({
          type: 'NEW_BUYER_MESSAGE',
          buyerName,
          messageText,
          conversationId,
        });
      }
    } catch (e) {
      console.warn('[DealerPost Inbox] Failed to forward message:', e);
    }
  }

  // ── Scan page for all visible messages ─────────────────────────────────────

  function scanMessages() {
    const buyerName = getBuyerName();
    const listingContext = getListingContext();
    const threadUrl = getThreadUrl();

    // Try multiple selector strategies for different FB UI versions
    const strategySelectors = [
      // Strategy 1: Modern FB Marketplace conversation with data-scope
      '[data-scope="messages_table"] [role="row"]',
      // Strategy 2: Generic message rows with aria labels
      '[role="row"][aria-label]',
      // Strategy 3: Message list items
      '[role="listitem"] [dir="auto"]',
      // Strategy 4: Messenger thread view
      '[data-testid="message-container"]',
      // Strategy 5: Any div with FB message class patterns
      'div[class*="x1c4vz4f"][class*="x2lah0s"]',
    ];

    for (const selector of strategySelectors) {
      const rows = document.querySelectorAll(selector);
      if (rows.length === 0) continue;

      let found = 0;
      for (const row of rows) {
        const text = extractText(row);
        if (!text || text.length < 2) continue;
        found++;

        const direction = isIncomingMessage(row) ? 'incoming' : 'outgoing';
        forwardMessage({ buyerName, messageText: text, listingContext, direction, threadUrl });
      }

      if (found > 0) break; // Use first selector that finds message content
    }
  }

  // ── Reply routing: send pending reply from app back to Facebook ─────────────

  async function fetchPendingReply() {
    if (!currentConversationId) return null;
    try {
      const res = await fetch(
        `${serverUrl}/api/conversations/${currentConversationId}/pending-reply?userId=${encodeURIComponent(userId)}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.data?.reply || null;
    } catch {
      return null;
    }
  }

  async function clearPendingReply() {
    if (!currentConversationId) return;
    try {
      await fetch(
        `${serverUrl}/api/conversations/${currentConversationId}/pending-reply`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      );
    } catch {}
  }

  // Find the FB message input box on the current page
  function findMessageInput() {
    const selectors = [
      // Marketplace message input
      '[aria-label*="message" i][contenteditable="true"]',
      '[aria-label*="Message" i][contenteditable="true"]',
      '[aria-placeholder*="message" i]',
      '[aria-placeholder*="Message" i]',
      // Messenger compose box
      '[role="textbox"][aria-label]',
      '[data-testid="messenger-compose-box"] [contenteditable="true"]',
      // Generic fallback
      'div[contenteditable="true"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  async function sendReplyOnFacebook(replyText) {
    const input = findMessageInput();
    if (!input) {
      console.warn('[DealerPost Inbox] Could not find message input to send reply');
      return false;
    }

    console.log('[DealerPost Inbox] Sending reply from app:', replyText.substring(0, 40));

    input.focus();
    await sleep(100);

    // Clear existing text
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(50);

    // Type the reply using execCommand (works with React-controlled divs)
    document.execCommand('insertText', false, replyText);
    await sleep(300);

    // Hit Enter to send
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    }));
    await sleep(200);

    // Also try clicking the send button
    const sendBtns = document.querySelectorAll(
      '[aria-label*="send" i][type="submit"], [aria-label*="send" i][role="button"], [data-testid="send-message-button"]'
    );
    for (const btn of sendBtns) {
      btn.click();
      break;
    }

    return true;
  }

  // Poll for replies from the app every 4 seconds
  async function pollForReplies() {
    const reply = await fetchPendingReply();
    if (!reply) return;

    console.log('[DealerPost Inbox] Reply from app:', reply.substring(0, 40));

    // Mark as cleared first to avoid double-sends
    await clearPendingReply();

    // Add fingerprint so we don't re-import our own outgoing message
    const fp = messageFingerprint(reply, 'outgoing');
    processedMessageFingerprints.add(fp);

    const sent = await sendReplyOnFacebook(reply);
    if (!sent) {
      console.warn('[DealerPost Inbox] Failed to send reply on Facebook');
    }
  }

  // ── Startup ─────────────────────────────────────────────────────────────────

  // Wait for page to settle
  await sleep(2500);
  scanMessages();

  // Start reply polling
  replyPollInterval = setInterval(pollForReplies, 4000);

  // Watch for new messages via MutationObserver
  let scanDebounce = null;
  const observer = new MutationObserver(() => {
    clearTimeout(scanDebounce);
    scanDebounce = setTimeout(scanMessages, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Re-scan when URL changes (FB is a SPA) — restore thread context from cache
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const newThreadUrl = getThreadUrl();
      console.log('[DealerPost Inbox] URL changed, switching thread context...');
      // Restore cached convId for this thread if we've seen it before
      currentConversationId = threadConversationMap[newThreadUrl] || null;
      processedMessageFingerprints.clear();
      setTimeout(scanMessages, 2000);
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });

  console.log('[DealerPost Inbox] Initialized — polling for messages and replies');
})();
