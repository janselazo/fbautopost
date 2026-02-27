// content.js - Facebook Marketplace Vehicle Listing Auto-Fill
// Critical order: Vehicle Type (Cars & trucks) MUST be selected first.

(async () => {
  const { activeSession, serverUrl } = await chrome.storage.local.get(['activeSession', 'serverUrl']);
  if (!activeSession) {
    console.log('[DealerPost] No active session found');
    return;
  }

  const vehicleData = typeof activeSession.vehicleData === 'string'
    ? JSON.parse(activeSession.vehicleData)
    : activeSession.vehicleData;

  const postText = activeSession.postText || '';
  const sessionId = activeSession.sessionId || activeSession.id;

  console.log('[DealerPost] Session loaded:', vehicleData.year, vehicleData.make, vehicleData.model);

  // ── Utilities ──────────────────────────────────────────────────────────────

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
  }

  function fireEvents(el) {
    ['focus', 'input', 'change'].forEach(evt =>
      el.dispatchEvent(new Event(evt, { bubbles: true })));
  }

  async function typeInto(el, text) {
    el.focus();
    await sleep(80);
    setNativeValue(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      setNativeValue(el, text.slice(0, i + 1));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      await sleep(35);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function waitFor(predicate, timeout = 12000, interval = 200) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const result = predicate();
        if (result) { resolve(result); return; }
        if (Date.now() - start > timeout) { reject(new Error('waitFor timeout')); return; }
        setTimeout(check, interval);
      };
      check();
    });
  }

  // ── DOM Helpers ─────────────────────────────────────────────────────────────

  // Find label, then walk up to nearby input/combobox
  function findInputNearLabel(labelTexts) {
    for (const labelText of labelTexts) {
      const lower = labelText.toLowerCase().trim();
      for (const span of document.querySelectorAll('span, label, div')) {
        if (span.children.length > 0) continue;
        if (span.textContent.trim().toLowerCase() !== lower) continue;
        let ancestor = span.parentElement;
        for (let d = 0; d < 10; d++) {
          if (!ancestor) break;
          const input = ancestor.querySelector('input:not([type="hidden"]):not([type="file"])');
          if (input) return input;
          const textarea = ancestor.querySelector('textarea');
          if (textarea) return textarea;
          const combobox = ancestor.querySelector('[role="combobox"]');
          if (combobox) return combobox;
          ancestor = ancestor.parentElement;
        }
      }
    }
    return null;
  }

  function findField(labelTexts, ariaLabels = [], placeholders = []) {
    // aria-label match
    for (const label of (ariaLabels.length ? ariaLabels : labelTexts)) {
      const lower = label.toLowerCase();
      for (const el of document.querySelectorAll('[aria-label]')) {
        const a = (el.getAttribute('aria-label') || '').toLowerCase();
        if (a === lower || a.includes(lower)) return el;
      }
    }
    // placeholder
    for (const ph of placeholders) {
      const el = document.querySelector(`input[placeholder*="${ph}"], textarea[placeholder*="${ph}"]`);
      if (el) return el;
    }
    return findInputNearLabel(labelTexts);
  }

  // ── Dropdown helpers ────────────────────────────────────────────────────────

  // Facebook renders dropdown options in a DETACHED OVERLAY PORTAL at document.body level.
  // We need to search the entire document for the listbox/menu that appears after clicking.

  async function findOverlayOptions(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // Facebook uses [role="listbox"] or a div with [role="option"] children
      // The overlay is typically a direct child of body or inside a portal container
      const listbox = document.querySelector('[role="listbox"], [role="menu"], [role="dialog"] [role="listbox"]');
      if (listbox) {
        const options = listbox.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]');
        if (options.length > 0) return Array.from(options);
      }

      // Fallback: find any visible [role="option"] elements anywhere in the DOM
      const allOptions = document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]');
      const visibleOptions = Array.from(allOptions).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
      });
      if (visibleOptions.length > 0) return visibleOptions;

      await sleep(150);
    }
    return [];
  }

  // Click an open dropdown option matching value
  async function pickOption(value, fallbacks = []) {
    await sleep(300);
    const candidates = [value, ...fallbacks].filter(Boolean);

    // Wait for and find options in the overlay portal
    const options = await findOverlayOptions(2500);

    if (options.length === 0) {
      console.log('[DealerPost] No dropdown options found in overlay');
      return false;
    }

    console.log(`[DealerPost] Found ${options.length} dropdown options`);

    for (const candidate of candidates) {
      const lower = candidate.toLowerCase().trim();
      for (const opt of options) {
        const t = opt.textContent.trim().toLowerCase();
        // Exact match, starts with, or contains
        if (t === lower || t.startsWith(lower) || t.includes(lower) || lower.includes(t)) {
          console.log(`[DealerPost] Clicking option: "${opt.textContent.trim()}" for value "${candidate}"`);
          opt.scrollIntoView({ block: 'nearest' });
          await sleep(100);
          opt.click();
          await sleep(400);
          return true;
        }
      }
    }

    // Log what options were available for debugging
    console.log('[DealerPost] Available options:', options.map(o => o.textContent.trim()).join(', '));
    return false;
  }

  async function fillDropdown(labelTexts, value, fallbacks = []) {
    if (!value) return false;
    const el = findField(labelTexts);
    if (!el) {
      console.log('[DealerPost] No element for dropdown:', labelTexts[0]);
      return false;
    }

    el.scrollIntoView({ block: 'center' });
    await sleep(200);

    // Click to open the dropdown
    el.click();
    console.log(`[DealerPost] Clicked dropdown trigger for: ${labelTexts[0]}`);
    await sleep(600);

    // If there's an input inside, type to filter
    const inputEl = el.tagName === 'INPUT' ? el : el.querySelector('input');
    if (inputEl && inputEl.offsetParent !== null) {
      console.log('[DealerPost] Typing into dropdown input:', value);
      await typeInto(inputEl, value);
      await sleep(800);
    }

    // Now find and click the option from the overlay portal
    const selected = await pickOption(value, fallbacks);

    if (!selected) {
      // Close the dropdown with Escape
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
      await sleep(200);
    }

    return selected;
  }

  // Check if a field already has a value (to avoid overwriting)
  function fieldHasValue(el) {
    if (!el) return false;
    const val = el.value || el.textContent || '';
    return val.trim().length > 0;
  }

  async function fillInput(labelTexts, value, ariaLabels = [], placeholders = []) {
    if (!value && value !== 0) return false;
    const strVal = String(value);
    const el = findField(labelTexts, ariaLabels, placeholders);
    if (!el) {
      console.log('[DealerPost] No input for:', labelTexts[0]);
      return false;
    }
    if (el.getAttribute('role') === 'combobox') return fillDropdown(labelTexts, strVal);

    el.scrollIntoView({ block: 'center' });
    el.focus();
    el.click();
    await sleep(150);
    await typeInto(el, strVal);
    await sleep(200);

    if (el.value !== strVal && el.tagName !== 'DIV') {
      setNativeValue(el, strVal);
      fireEvents(el);
    }
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(150);
    return true;
  }

  // ── Overlay UI ──────────────────────────────────────────────────────────────

  document.getElementById('dp-overlay')?.remove();
  const style = document.createElement('style');
  style.textContent = `
    #dp-overlay {
      position:fixed; bottom:20px; right:20px; z-index:2147483647;
      background:#0f0f0f; border:1px solid #222; border-radius:12px;
      padding:14px 16px; min-width:280px; max-width:310px;
      box-shadow:0 16px 48px rgba(0,0,0,0.8);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      animation:dpIn 0.25s ease;
    }
    @keyframes dpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    #dp-overlay .dp-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}
    #dp-overlay .dp-badge{background:#d4a017;color:#000;font-size:11px;font-weight:900;padding:2px 6px;border-radius:4px;letter-spacing:.5px}
    #dp-overlay .dp-car{font-size:11px;color:#555;margin-bottom:6px}
    #dp-overlay .dp-msg{font-size:12px;color:#888;line-height:1.45;min-height:28px}
    #dp-overlay .dp-list{margin-top:6px;display:flex;flex-direction:column;gap:2px}
    #dp-overlay .dp-row{font-size:11px;display:flex;align-items:center;gap:5px;color:#444}
    #dp-overlay .dp-row.done{color:#22c55e}
    #dp-overlay .dp-row.active{color:#d4a017}
    #dp-overlay .dp-row.err{color:#ef4444}
    #dp-overlay .dp-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}
    #dp-overlay .dp-actions{margin-top:10px;display:flex;gap:6px}
    #dp-overlay .dp-btn{flex:1;padding:8px;border:none;border-radius:7px;background:#d4a017;color:#000;font-size:11px;font-weight:800;cursor:pointer;transition:background 0.12s}
    #dp-overlay .dp-btn:hover{background:#e8b822}
    #dp-overlay .dp-btn:disabled{background:#333;color:#666;cursor:not-allowed}
    #dp-overlay .dp-btn.ok{background:#22c55e}
    #dp-overlay .dp-x{position:absolute;top:8px;right:10px;background:none;border:none;color:#444;font-size:15px;cursor:pointer;line-height:1}
    #dp-overlay .dp-x:hover{color:#aaa}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'dp-overlay';
  overlay.innerHTML = `
    <button class="dp-x" id="dp-x">✕</button>
    <div class="dp-hd"><span class="dp-badge">DEALERPOST</span></div>
    <div class="dp-car">${vehicleData.year || ''} ${vehicleData.make || ''} ${vehicleData.model || ''} ${vehicleData.trim || ''}</div>
    <div class="dp-msg" id="dp-msg">Waiting to start...</div>
    <div class="dp-list" id="dp-list"></div>
    <div class="dp-actions"><button class="dp-btn" id="dp-start">Auto-Fill Now</button></div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('dp-x').onclick = () => overlay.remove();

  const steps = [];
  function setMsg(text) {
    const el = document.getElementById('dp-msg');
    if (el) el.textContent = text;
    console.log('[DealerPost]', text);
  }
  function mark(label, state) {
    const existing = steps.find(s => s.label === label);
    if (existing) existing.state = state;
    else steps.push({ label, state });
    const list = document.getElementById('dp-list');
    if (list) list.innerHTML = steps.map(s =>
      `<div class="dp-row ${s.state}"><div class="dp-dot"></div>${s.label}</div>`
    ).join('');
  }

  // ── Normalizers ─────────────────────────────────────────────────────────────

  const COLOR_MAP = {
    'jet black':'Black','midnight black':'Black','obsidian black':'Black','tuxedo black':'Black','phantom black':'Black',
    'arctic white':'White','alpine white':'White','pearl white':'White','glacier white':'White','oxford white':'White',
    'summit white':'White','super white':'White',
    'deep blue':'Blue','navy blue':'Blue','reef blue':'Blue','sapphire blue':'Blue','dark blue':'Blue',
    'cobalt blue':'Blue','lightning blue':'Blue','velocity blue':'Blue',
    'tornado red':'Red','soul red':'Red','ruby red':'Red','race red':'Red','rapid red':'Red',
    'san marino red':'Red','passion red':'Red',
    'reflex silver':'Silver','lunar silver':'Silver','brilliant silver':'Silver','ice silver':'Silver',
    'ingot silver':'Silver','sonic silver':'Silver',
    'platinum gray':'Gray','magnetic gray':'Gray','graphite gray':'Gray','dark gray':'Gray',
    'grey':'Gray','light gray':'Gray','granite gray':'Gray',
    'copper':'Copper','bronze':'Bronze','gold':'Gold','tan':'Tan','beige':'Beige',
    'dark cherry':'Red','burgundy':'Red','maroon':'Red',
    'forest green':'Green','dark green':'Green','bright green':'Green','olive green':'Green','green gem':'Green',
    'orange':'Orange','yellow':'Yellow','purple':'Purple','brown':'Brown','pink':'Pink',
  };
  function normalizeColor(raw) {
    if (!raw) return '';
    const lower = raw.toLowerCase().trim();
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];
    for (const [key, val] of Object.entries(COLOR_MAP)) {
      if (lower.includes(key) || key.includes(lower)) return val;
    }
    const words = lower.split(/\s+/);
    const base = ['black','white','silver','gray','grey','blue','red','green','brown','tan','beige','gold','orange','yellow','purple','copper','bronze','pink'];
    for (const word of [...words].reverse()) {
      if (base.includes(word)) return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return raw;
  }
  function normalizeBodyType(raw) {
    if (!raw) return 'SUV';
    const lower = raw.toLowerCase();
    if (lower.includes('sedan')) return 'Sedan';
    if (lower.includes('suv') || lower.includes('crossover')) return 'SUV';
    if (lower.includes('truck') || lower.includes('pickup')) return 'Truck';
    if (lower.includes('coupe')) return 'Coupe';
    if (lower.includes('hatchback') || lower.includes('hatch')) return 'Hatchback';
    if (lower.includes('convert')) return 'Convertible';
    if (lower.includes('van') || lower.includes('minivan')) return 'Minivan';
    if (lower.includes('wagon')) return 'Wagon';
    return 'SUV';
  }
  function normalizeFuel(raw) {
    if (!raw) return 'Gasoline';
    const lower = raw.toLowerCase();
    if (lower.includes('electric') && !lower.includes('hybrid')) return 'Electric';
    if (lower.includes('plug') || lower.includes('phev')) return 'Plug-in hybrid';
    if (lower.includes('hybrid')) return 'Hybrid';
    if (lower.includes('diesel')) return 'Diesel';
    if (lower.includes('flex') || lower.includes('e85')) return 'Flex fuel';
    return 'Gasoline';
  }
  function normalizeTrans(raw) {
    if (!raw) return 'Automatic';
    const lower = raw.toLowerCase();
    if (lower.includes('manual') || lower.includes('stick') || lower.includes('mt')) return 'Manual';
    return 'Automatic';
  }

  // ── STEP 0: Vehicle Type — Cars & trucks ────────────────────────────────────
  // FB's vehicle type picker renders options in a DETACHED PORTAL OVERLAY.
  // The dropdown trigger is on the form, but options appear in a separate div at body level.

  async function selectVehicleType() {
    // Wait for page to be interactive
    await sleep(2000);

    const TARGET = ['cars & trucks', 'cars/trucks', 'car/truck', 'cars and trucks'];

    // Strategy A: Look for existing "Cars & trucks" tile/button that's already visible
    function findCarsAndTrucksTile() {
      const candidates = document.querySelectorAll(
        '[role="radio"], [role="button"], [role="option"], [role="tab"], ' +
        '[tabindex="0"], [data-testid], li, div[class*="x"], span[class*="x"]'
      );
      for (const el of candidates) {
        const t = el.textContent.trim().toLowerCase();
        if (TARGET.some(target => t === target || t.includes('cars') && t.includes('truck'))) {
          if (el.offsetParent !== null && el.children.length < 8) return el;
        }
      }
      return null;
    }

    // Try Strategy A first — direct click on "Cars & trucks" tile
    for (let attempt = 0; attempt < 3; attempt++) {
      const tile = findCarsAndTrucksTile();
      if (tile) {
        console.log('[DealerPost] Found Cars & trucks tile:', tile.tagName);
        tile.scrollIntoView({ block: 'center' });
        await sleep(200);
        tile.click();
        await sleep(800);

        // Check if form fields appeared (success indicator)
        if (document.querySelector('[aria-label*="Year" i], [aria-label*="Make" i]')) {
          console.log('[DealerPost] Vehicle type selected - form fields appeared');
          return true;
        }
        // Try clicking again
        tile.click();
        await sleep(500);
        return true;
      }
      await sleep(400);
    }

    // Strategy B: Find and click a Type/Category dropdown, then select from overlay
    const typeLabels = ['Type', 'Vehicle type', 'Category', 'Item type', 'Listing type'];
    let dropdownTrigger = null;

    // Find by label text
    for (const label of typeLabels) {
      const lower = label.toLowerCase();
      for (const el of document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="true"]')) {
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        if (ariaLabel.includes(lower)) {
          dropdownTrigger = el;
          break;
        }
      }
      if (dropdownTrigger) break;

      // Also check for label near combobox
      const foundNear = findInputNearLabel([label]);
      if (foundNear && (foundNear.getAttribute('role') === 'combobox' || foundNear.getAttribute('aria-haspopup'))) {
        dropdownTrigger = foundNear;
        break;
      }
    }

    // Fallback: first combobox on page
    if (!dropdownTrigger) {
      dropdownTrigger = document.querySelector('[role="combobox"], [aria-haspopup="listbox"]');
    }

    if (dropdownTrigger) {
      console.log('[DealerPost] Opening vehicle type dropdown');
      dropdownTrigger.scrollIntoView({ block: 'center' });
      await sleep(200);
      dropdownTrigger.click();
      await sleep(800);

      // Wait for overlay options to appear in portal
      const options = await findOverlayOptions(3000);
      console.log(`[DealerPost] Vehicle type dropdown has ${options.length} options`);

      if (options.length > 0) {
        // Log all options for debugging
        options.forEach((o, i) => console.log(`  [${i}] "${o.textContent.trim()}"`));

        // Find "Cars & trucks" option
        for (const opt of options) {
          const t = opt.textContent.trim().toLowerCase();
          if (TARGET.some(target => t === target || (t.includes('car') && t.includes('truck')))) {
            console.log('[DealerPost] Clicking vehicle type option:', opt.textContent.trim());
            opt.scrollIntoView({ block: 'nearest' });
            await sleep(100);
            opt.click();
            await sleep(700);
            return true;
          }
        }

        // If "Cars & trucks" not found, look for "Vehicles" as parent category
        for (const opt of options) {
          const t = opt.textContent.trim().toLowerCase();
          if (t === 'vehicles' || t === 'vehicle') {
            console.log('[DealerPost] Clicking Vehicles category first');
            opt.click();
            await sleep(800);
            // Now look for Cars & trucks in sub-menu
            const subOptions = await findOverlayOptions(2000);
            for (const subOpt of subOptions) {
              const st = subOpt.textContent.trim().toLowerCase();
              if (st.includes('car') && st.includes('truck')) {
                subOpt.click();
                await sleep(500);
                return true;
              }
            }
          }
        }
      }

      // Close dropdown if nothing selected
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      await sleep(200);
    }

    // Strategy C: scan entire page for any clickable element with "Cars" text
    const allEls = document.querySelectorAll('div, span, li, button, a');
    for (const el of allEls) {
      if (el.children.length > 5) continue;
      const t = el.textContent.trim().toLowerCase();
      if ((t.includes('cars') && t.includes('truck')) || t === 'cars & trucks') {
        if (el.offsetParent !== null) {
          console.log('[DealerPost] Strategy C found:', el.tagName, `"${t}"`);
          el.scrollIntoView({ block: 'center' });
          el.click();
          await sleep(600);
          return true;
        }
      }
    }

    console.log('[DealerPost] WARNING: Could not select vehicle type');
    return false;
  }

  // ── MAIN FILL SEQUENCE ──────────────────────────────────────────────────────

  async function run() {
    const startBtn = document.getElementById('dp-start');
    if (startBtn) startBtn.disabled = true;
    steps.length = 0;

    setMsg('Starting auto-fill...');
    await sleep(1500);

    // ── Vehicle Type ────────────────────────────────────────────────────────
    mark('Vehicle type', 'active');
    setMsg('Selecting "Cars & trucks"...');
    const typeOk = await selectVehicleType();
    mark('Vehicle type', typeOk ? 'done' : 'err');

    // Wait for the vehicle form fields to render after type selection
    setMsg('Waiting for form fields...');
    try {
      await waitFor(
        () => findField(['Year', 'Vehicle year'], ['Year'], []) ||
              document.querySelector('[aria-label*="Year" i]') ||
              document.querySelector('[aria-label*="Make" i]'),
        10000
      );
    } catch {
      // Continue — fields may already be there
    }
    await sleep(800);

    // ── Year ────────────────────────────────────────────────────────────────
    mark('Year', 'active');
    setMsg('Filling Year...');
    const yearVal = String(vehicleData.year || '');
    let yearOk = false;
    if (yearVal) {
      const yearEl = findField(['Year', 'Vehicle year', 'Model year'], ['Year', 'Vehicle year'], []);
      if (yearEl) {
        yearEl.scrollIntoView({ block: 'center' });
        yearEl.click();
        await sleep(500);
        const inputEl = yearEl.tagName === 'INPUT' ? yearEl : yearEl.querySelector('input');
        if (inputEl) { await typeInto(inputEl, yearVal); await sleep(600); }
        yearOk = await pickOption(yearVal, []);
        if (!yearOk) yearOk = await fillInput(['Year', 'Vehicle year'], yearVal, ['Year'], []);
      }
    }
    mark('Year', yearOk ? 'done' : 'err');
    await sleep(500);

    // ── Make ────────────────────────────────────────────────────────────────
    mark('Make', 'active');
    setMsg('Filling Make...');
    const makeVal = vehicleData.make || '';
    let makeOk = false;
    if (makeVal) {
      makeOk = await fillDropdown(['Make', 'Vehicle make', 'Brand'], makeVal, [makeVal]);
      if (!makeOk) makeOk = await fillInput(['Make', 'Vehicle make'], makeVal, ['Make'], []);
    }
    mark('Make', makeOk ? 'done' : 'err');
    await sleep(500);

    // ── Model ───────────────────────────────────────────────────────────────
    mark('Model', 'active');
    setMsg('Filling Model...');
    const modelVal = vehicleData.model || '';
    let modelOk = false;
    if (modelVal) {
      // Check if model field already has a value
      const modelEl = findField(['Model', 'Vehicle model'], ['Model'], []);
      if (modelEl && fieldHasValue(modelEl)) {
        console.log('[DealerPost] Model already filled, skipping');
        modelOk = true;
      } else {
        modelOk = await fillDropdown(['Model', 'Vehicle model'], modelVal, [modelVal]);
        if (!modelOk) modelOk = await fillInput(['Model', 'Vehicle model'], modelVal, ['Model'], []);
      }
    }
    mark('Model', modelOk ? 'done' : 'err');
    await sleep(500);

    // ── Trim ────────────────────────────────────────────────────────────────
    if (vehicleData.trim) {
      const trimOk = await fillDropdown(['Trim', 'Vehicle trim', 'Trim level'], vehicleData.trim, [vehicleData.trim]);
      if (!trimOk) await fillInput(['Trim', 'Vehicle trim'], vehicleData.trim, ['Trim'], []);
      await sleep(400);
    }

    // ── Mileage ─────────────────────────────────────────────────────────────
    mark('Mileage', 'active');
    setMsg('Filling Mileage...');
    const mileageRaw = vehicleData.mileage || vehicleData.miles || '';
    const mileageVal = String(mileageRaw).replace(/[^0-9]/g, '');
    let mileageOk = false;
    if (mileageVal) {
      mileageOk = await fillInput(
        ['Mileage', 'Miles', 'Odometer', 'Vehicle mileage'],
        mileageVal,
        ['Mileage', 'Miles', 'Odometer reading'],
        ['mileage', 'miles']
      );
    }
    mark('Mileage', mileageOk ? 'done' : 'err');
    await sleep(500);

    // ── Price ───────────────────────────────────────────────────────────────
    mark('Price', 'active');
    setMsg('Filling Price...');
    const priceRaw = vehicleData.price || vehicleData.asking_price || '';
    const priceVal = String(priceRaw).replace(/[^0-9]/g, '');
    let priceOk = false;
    if (priceVal) {
      // Facebook's price field often has specific aria-labels or is near "Price" text
      let priceEl = document.querySelector('input[aria-label*="rice" i]') ||
                    document.querySelector('input[placeholder*="rice" i]') ||
                    findField(['Price', 'Listing price', 'Sale price', 'Vehicle price'], ['Price'], ['price', 'Price']);

      if (priceEl) {
        console.log('[DealerPost] Found price field:', priceEl.tagName, priceEl.getAttribute('aria-label') || priceEl.placeholder || '');
        priceEl.scrollIntoView({ block: 'center' });
        priceEl.focus();
        priceEl.click();
        await sleep(200);

        // Clear existing value
        priceEl.select?.();
        setNativeValue(priceEl, '');
        priceEl.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(100);

        // Type the price
        await typeInto(priceEl, priceVal);
        await sleep(300);

        // Verify it took
        if (priceEl.value === priceVal || priceEl.value.replace(/[^0-9]/g, '') === priceVal) {
          priceOk = true;
        } else {
          // Force set value
          setNativeValue(priceEl, priceVal);
          fireEvents(priceEl);
          priceOk = true;
        }
        priceEl.dispatchEvent(new Event('blur', { bubbles: true }));
      } else {
        console.log('[DealerPost] Could not find price field');
      }
    }
    mark('Price', priceOk ? 'done' : 'err');
    await sleep(500);

    // ── Body Style ──────────────────────────────────────────────────────────
    mark('Body style', 'active');
    setMsg('Filling Body style...');
    const bodyVal = normalizeBodyType(vehicleData.body_type || vehicleData.bodyType || '');
    let bodyOk = false;
    if (bodyVal) {
      bodyOk = await fillDropdown(
        ['Body style', 'Body type', 'Vehicle body'],
        bodyVal,
        ['Sedan', 'SUV', 'Truck', 'Coupe', 'Hatchback', 'Convertible', 'Minivan', 'Wagon']
      );
    }
    mark('Body style', bodyOk ? 'done' : 'err');
    await sleep(500);

    // ── Exterior Color ──────────────────────────────────────────────────────
    mark('Exterior color', 'active');
    setMsg('Filling Exterior color...');
    const extColor = normalizeColor(vehicleData.exterior_color || vehicleData.color || '');
    let extColorOk = false;
    if (extColor) {
      extColorOk = await fillDropdown(
        ['Exterior color', 'Color', 'Vehicle color'],
        extColor,
        ['Black', 'White', 'Silver', 'Gray', 'Blue', 'Red', 'Green', 'Brown', 'Tan', 'Beige', 'Gold', 'Orange', 'Yellow']
      );
    }
    mark('Exterior color', extColorOk ? 'done' : 'err');
    await sleep(500);

    // ── Interior Color ──────────────────────────────────────────────────────
    if (vehicleData.interior_color) {
      mark('Interior color', 'active');
      const intColorOk = await fillDropdown(
        ['Interior color', 'Inside color'],
        normalizeColor(vehicleData.interior_color),
        ['Black', 'Gray', 'Beige', 'Tan', 'Brown', 'White']
      );
      mark('Interior color', intColorOk ? 'done' : 'err');
      await sleep(400);
    }

    // ── Condition ───────────────────────────────────────────────────────────
    mark('Condition', 'active');
    setMsg('Filling Condition...');
    const condOk = await fillDropdown(
      ['Condition', 'Vehicle condition'],
      vehicleData.condition || 'Good',
      ['Excellent', 'Good', 'Fair', 'Poor']
    );
    mark('Condition', condOk ? 'done' : 'err');
    await sleep(400);

    // ── Fuel Type ───────────────────────────────────────────────────────────
    mark('Fuel type', 'active');
    setMsg('Filling Fuel type...');
    const fuelOk = await fillDropdown(
      ['Fuel type', 'Fuel Type', 'Fuel'],
      normalizeFuel(vehicleData.fuel_type || vehicleData.fuelType || ''),
      ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in hybrid', 'Flex fuel']
    );
    mark('Fuel type', fuelOk ? 'done' : 'err');
    await sleep(400);

    // ── Transmission ────────────────────────────────────────────────────────
    mark('Transmission', 'active');
    setMsg('Filling Transmission...');
    const transOk = await fillDropdown(
      ['Transmission', 'Transmission type'],
      normalizeTrans(vehicleData.transmission || ''),
      ['Automatic', 'Manual']
    );
    mark('Transmission', transOk ? 'done' : 'err');
    await sleep(400);

    // ── Description ─────────────────────────────────────────────────────────
    mark('Description', 'active');
    setMsg('Filling Description...');
    const desc = postText ||
      `${vehicleData.year} ${vehicleData.make} ${vehicleData.model} ${vehicleData.trim || ''}\n` +
      `${mileageVal ? Number(mileageVal).toLocaleString() + ' miles' : ''}\n` +
      `${vehicleData.exterior_color ? 'Exterior: ' + vehicleData.exterior_color : ''}\n` +
      `${vehicleData.vin ? 'VIN: ' + vehicleData.vin : ''}`.trim();

    let descOk = false;
    const descEl =
      document.querySelector('textarea[aria-label*="escription" i]') ||
      document.querySelector('textarea[placeholder*="escription" i]') ||
      document.querySelector('div[contenteditable="true"][role="textbox"]') ||
      findInputNearLabel(['Description', 'Write a description', 'Add a description']) ||
      document.querySelector('textarea');

    if (descEl) {
      descEl.scrollIntoView({ block: 'center' });
      descEl.focus();
      descEl.click();
      await sleep(300);
      if (descEl.isContentEditable) {
        descEl.textContent = '';
        await sleep(50);
        document.execCommand('insertText', false, desc);
      } else {
        setNativeValue(descEl, '');
        descEl.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
        setNativeValue(descEl, desc);
        fireEvents(descEl);
      }
      descEl.dispatchEvent(new Event('blur', { bubbles: true }));
      descOk = true;
    }
    mark('Description', descOk ? 'done' : 'err');
    await sleep(400);

    // ── VIN ─────────────────────────────────────────────────────────────────
    if (vehicleData.vin) {
      await fillInput(
        ['VIN', 'Vehicle identification number'],
        vehicleData.vin,
        ['VIN', 'Vehicle identification number'],
        ['vin', 'VIN']
      );
      await sleep(300);
    }

    // ── Location ────────────────────────────────────────────────────────────
    mark('Location', 'active');
    setMsg('Filling Location...');
    const locationCity = vehicleData.city || 'Doral';
    const locationState = vehicleData.state || 'FL';
    let locationOk = false;

    // Find location field - FB uses various labels
    let locationEl = document.querySelector('input[aria-label*="ocation" i]') ||
                     document.querySelector('input[aria-label*="eighborhood" i]') ||
                     document.querySelector('input[aria-label*="ity" i]') ||
                     document.querySelector('input[placeholder*="ocation" i]') ||
                     findField(
                       ['Location', 'City', 'Neighborhood or city', 'City or Zip', 'Zip code'],
                       ['Location', 'City', 'Neighborhood or city'],
                       ['location', 'city', 'zip']
                     );

    if (locationEl) {
      // Skip if already has a value
      if (fieldHasValue(locationEl)) {
        console.log('[DealerPost] Location already filled, skipping');
        locationOk = true;
      } else {
        console.log('[DealerPost] Found location field:', locationEl.tagName, locationEl.getAttribute('aria-label') || '');
        locationEl.scrollIntoView({ block: 'center' });
        locationEl.focus();
        locationEl.click();
        await sleep(300);

        // Clear and type location
        locationEl.select?.();
        setNativeValue(locationEl, '');
        locationEl.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(100);

        // Type city name character by character to trigger autocomplete
        await typeInto(locationEl, locationCity);
        await sleep(1200);

      // Wait for autocomplete suggestions in overlay portal
      const suggestions = await findOverlayOptions(3000);
      const lowerCity = locationCity.toLowerCase();
      const lowerState = locationState.toLowerCase();

      console.log(`[DealerPost] Location has ${suggestions.length} suggestions`);

      if (suggestions.length > 0) {
        // Best match: city + state
        let clicked = false;
        for (const s of suggestions) {
          const t = s.textContent.trim().toLowerCase();
          if (t.includes(lowerCity) && (t.includes(lowerState) || t.includes('florida'))) {
            console.log('[DealerPost] Clicking location:', s.textContent.trim());
            s.scrollIntoView({ block: 'nearest' });
            await sleep(100);
            s.click();
            await sleep(500);
            clicked = true;
            locationOk = true;
            break;
          }
        }

        // Fallback: just city match
        if (!clicked) {
          for (const s of suggestions) {
            const t = s.textContent.trim().toLowerCase();
            if (t.includes(lowerCity)) {
              console.log('[DealerPost] Clicking location (city only):', s.textContent.trim());
              s.scrollIntoView({ block: 'nearest' });
              await sleep(100);
              s.click();
              await sleep(500);
              clicked = true;
              locationOk = true;
              break;
            }
          }
        }

        // Last resort: click first suggestion
        if (!clicked && suggestions.length > 0) {
          console.log('[DealerPost] Clicking first location suggestion');
          suggestions[0].scrollIntoView({ block: 'nearest' });
          await sleep(100);
          suggestions[0].click();
          await sleep(500);
          locationOk = true;
        }
      } else {
        // No suggestions found, try pressing Enter
        console.log('[DealerPost] No location suggestions, pressing Enter');
        locationEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        await sleep(300);
        locationOk = true;
      }

        locationEl.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    } else {
      console.log('[DealerPost] Could not find location field');
    }
    mark('Location', locationOk ? 'done' : 'err');
    await sleep(400);

    // ── Done ────────────────────────────────────────────────────────────────
    const doneCount = steps.filter(s => s.state === 'done').length;
    const totalCount = steps.length;

    if (doneCount === 0) {
      setMsg('Could not find form fields. Try clicking "Retry" after the page fully loads.');
    } else if (doneCount < totalCount) {
      setMsg(`Filled ${doneCount}/${totalCount} fields. Check red items and fill manually, then click Next.`);
    } else {
      setMsg('All fields filled! Review and click Next / Publish.');
    }

    const btn = document.getElementById('dp-start');
    if (btn) {
      btn.disabled = false;
      btn.textContent = doneCount > 0 ? 'Re-Fill' : 'Retry';
      if (doneCount >= totalCount - 1) {
        btn.className = 'dp-btn ok';
        btn.textContent = 'Done — Review & Next';
      }
      btn.onclick = () => run();
    }

    // Mark as completed so auto-start doesn't run again
    window.__dpFillCompleted = true;

    if (doneCount > 0 && sessionId && serverUrl && !window.__dpSessionCompleted) {
      window.__dpSessionCompleted = true;
      try {
        const { userId } = await chrome.storage.local.get(['userId']);
        await fetch(`${serverUrl}/api/extension/posting-session/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId || 'default' }),
        });
        await chrome.storage.local.remove(['activeSession', 'pendingSession']);
      } catch { /* ignore */ }
    }
  }

  document.getElementById('dp-start').addEventListener('click', run);

  // Auto-start after 5 seconds to let FB React hydrate, but only if not already run
  setTimeout(() => {
    if (!window.__dpFillCompleted) {
      run();
    }
  }, 5000);

})();
