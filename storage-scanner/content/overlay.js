(() => {
  "use strict";

  if (globalThis.__storageScannerLoaded) return;
  globalThis.__storageScannerLoaded = true;

  const adapters = globalThis.StorageScannerAdapters;
  const codec = globalThis.StorageScannerCodec;
  const TAB_LABELS = {
    localStorage: "Local storage",
    sessionStorage: "Session storage",
    cookies: "Cookies",
    indexedDB: "IndexedDB",
    cacheStorage: "Cache storage"
  };

  let host = null;
  let shadow = null;
  let state = null;
  let activeTab = "localStorage";
  let selectedDatabase = 0;
  let selectedStore = 0;
  let selectedCache = 0;
  const dirtyTabs = new Set();

  const css = `
    :host { all: initial; color-scheme: dark; }
    *, *::before, *::after { box-sizing: border-box; }
    .ss-shell { position: fixed; z-index: 2147483647; top: 18px; right: 18px; width: min(980px, calc(100vw - 36px)); height: min(760px, calc(100vh - 36px)); display: grid; grid-template-rows: auto auto 1fr auto; overflow: hidden; border: 1px solid #37415a; border-radius: 14px; color: #edf1f9; background: #101522; box-shadow: 0 22px 70px #000b; font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, textarea, select { font: inherit; }
    button { cursor: pointer; }
    .ss-header { display: flex; align-items: center; gap: 11px; padding: 13px 16px; border-bottom: 1px solid #2a3245; background: #151c2c; }
    .ss-logo { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #7c5cff, #20c4a7); color: white; font-size: 19px; font-weight: 800; }
    .ss-title { min-width: 0; flex: 1; }
    .ss-title strong, .ss-title span { display: block; }
    .ss-title strong { font-size: 15px; }
    .ss-title span { overflow: hidden; color: #9ca8bf; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .ss-icon-btn { width: 32px; height: 32px; border: 0; border-radius: 8px; color: #cbd3e3; background: transparent; font-size: 20px; }
    .ss-icon-btn:hover { background: #273047; color: #fff; }
    .ss-tabs { display: flex; overflow-x: auto; padding: 0 10px; border-bottom: 1px solid #2a3245; background: #121827; scrollbar-width: thin; }
    .ss-tab { flex: 0 0 auto; border: 0; border-bottom: 2px solid transparent; padding: 11px 12px 9px; color: #9da9bf; background: transparent; }
    .ss-tab:hover { color: #fff; }
    .ss-tab[aria-selected="true"] { border-color: #7c5cff; color: #fff; }
    .ss-count { display: inline-block; min-width: 19px; margin-left: 5px; padding: 0 5px; border-radius: 10px; background: #293249; color: #bfc8da; font-size: 11px; text-align: center; }
    .ss-dot { display: inline-block; width: 6px; height: 6px; margin-left: 5px; border-radius: 50%; background: #f5b942; vertical-align: 1px; }
    .ss-content { min-height: 0; overflow: auto; padding: 15px; background: #0e1320; }
    .ss-toolbar, .ss-subtoolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .ss-subtoolbar { flex-wrap: wrap; }
    .ss-spacer { flex: 1; }
    .ss-button { border: 1px solid #46516c; border-radius: 8px; padding: 7px 10px; color: #eaf0fa; background: #202a40; }
    .ss-button:hover { border-color: #7c5cff; background: #29344e; }
    .ss-button.primary { border-color: #7357ed; background: #6849e8; }
    .ss-button.primary:hover { background: #7658f3; }
    .ss-button.danger { color: #ffb4ad; }
    .ss-button:disabled { cursor: default; opacity: .45; }
    .ss-select { max-width: 260px; border: 1px solid #3d4862; border-radius: 7px; padding: 7px 28px 7px 9px; color: #edf1f9; background: #161d2d; }
    .ss-table-wrap { overflow: auto; border: 1px solid #2c354b; border-radius: 9px; }
    .ss-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .ss-table th { position: sticky; top: 0; z-index: 1; padding: 8px; color: #9ba7bd; background: #181f30; font-size: 11px; font-weight: 650; text-align: left; text-transform: uppercase; letter-spacing: .04em; }
    .ss-table td { padding: 7px 8px; border-top: 1px solid #283147; vertical-align: top; }
    .ss-table tr.deleted { opacity: .45; }
    .ss-field { width: 100%; border: 1px solid #354059; border-radius: 6px; padding: 7px 8px; color: #eff3fa; background: #0d121e; outline: none; }
    .ss-field:focus { border-color: #8168ef; box-shadow: 0 0 0 2px #795cff26; }
    textarea.ss-field { min-height: 78px; resize: vertical; font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .ss-mini { width: 78px; }
    .ss-check { accent-color: #7c5cff; }
    .ss-card { margin-bottom: 10px; border: 1px solid #2c354b; border-radius: 9px; background: #131a29; }
    .ss-card.deleted { opacity: .48; }
    .ss-card-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #2c354b; }
    .ss-card-head code { flex: 1; overflow: hidden; color: #9de0d1; text-overflow: ellipsis; white-space: nowrap; }
    .ss-card-body { display: grid; grid-template-columns: minmax(150px, .7fr) minmax(240px, 1.3fr); gap: 10px; padding: 10px; }
    .ss-form-row label { display: block; margin-bottom: 4px; color: #9ca8bd; font-size: 11px; font-weight: 650; text-transform: uppercase; }
    .ss-wide { grid-column: 1 / -1; }
    .ss-meta { color: #98a4ba; font-size: 12px; }
    .ss-error, .ss-empty { padding: 24px; border: 1px dashed #39445d; border-radius: 9px; color: #aeb8ca; text-align: center; }
    .ss-error { border-color: #70433f; color: #ffb4aa; background: #2a191b; }
    .ss-footer { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid #2a3245; background: #151c2c; }
    .ss-status { flex: 1; overflow: hidden; color: #9ea9bd; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .ss-status.error { color: #ffafa7; }
    .ss-modal-backdrop { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; padding: 20px; background: #050811bd; }
    .ss-modal { width: min(440px, 100%); border: 1px solid #3d4862; border-radius: 12px; padding: 18px; background: #171e2e; box-shadow: 0 20px 60px #000a; }
    .ss-modal h2 { margin: 0 0 5px; font-size: 17px; }
    .ss-modal p { margin: 0 0 14px; color: #aab4c6; }
    .ss-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0 18px; }
    .ss-option { display: flex; gap: 8px; align-items: center; padding: 9px; border: 1px solid #303a50; border-radius: 7px; }
    .ss-loading { display: grid; place-items: center; height: 100%; color: #aeb7c8; }
    .ss-spinner { width: 26px; height: 26px; margin-bottom: 10px; border: 3px solid #313b52; border-top-color: #7c5cff; border-radius: 50%; animation: ss-spin .75s linear infinite; }
    @keyframes ss-spin { to { transform: rotate(360deg); } }
    @media (max-width: 620px) { .ss-shell { inset: 0; width: 100vw; height: 100vh; border: 0; border-radius: 0; } .ss-card-body { grid-template-columns: 1fr; } .ss-wide { grid-column: auto; } }
  `;

  function el(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (name === "class") node.className = value;
      else if (name === "text") node.textContent = value;
      else if (name.startsWith("on") && typeof value === "function") node.addEventListener(name.slice(2), value);
      else if (value !== undefined && value !== null) node.setAttribute(name, String(value));
    }
    for (const child of Array.isArray(children) ? children : [children]) if (child) node.append(child);
    return node;
  }

  function button(label, onClick, classes = "") {
    return el("button", { type: "button", class: `ss-button ${classes}`.trim(), text: label, onclick: onClick });
  }

  function field(value, onInput, options = {}) {
    const node = el(options.multiline ? "textarea" : "input", {
      class: `${options.type === "checkbox" ? "ss-check" : "ss-field"} ${options.class || ""}`.trim(),
      type: options.type || "text",
      placeholder: options.placeholder,
      disabled: options.disabled ? "" : null
    });
    if (options.type === "checkbox") node.checked = Boolean(value);
    else node.value = value ?? "";
    node.addEventListener(options.type === "checkbox" ? "change" : "input", () => onInput(options.type === "checkbox" ? node.checked : node.value, node));
    return node;
  }

  function select(value, options, onChange) {
    const node = el("select", { class: "ss-select" });
    for (const option of options) node.append(el("option", { value: option.value, text: option.label }));
    node.value = String(value);
    node.addEventListener("change", () => onChange(node.value));
    return node;
  }

  function setStatus(message, isError = false) {
    const node = shadow?.querySelector(".ss-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", isError);
  }

  function setBusy(busy, label = "Scanning website storage…") {
    const content = shadow?.querySelector(".ss-content");
    if (!content || !busy) return;
    content.replaceChildren(el("div", { class: "ss-loading" }, [el("div", {}, [el("div", { class: "ss-spinner" }), el("div", { text: label })])]));
  }

  function countFor(tab) {
    if (!state) return 0;
    if (tab === "localStorage" || tab === "sessionStorage" || tab === "cookies") return state[tab].entries.filter((item) => !item.deleted).length;
    if (tab === "indexedDB") return state.indexedDB.databases.reduce((sum, db) => sum + db.stores.reduce((inner, store) => inner + store.records.filter((item) => !item.deleted).length, 0), 0);
    return state.cacheStorage.caches.reduce((sum, cache) => sum + cache.entries.filter((item) => !item.deleted).length, 0);
  }

  function markDirty(tab = activeTab) {
    dirtyTabs.add(tab);
    renderTabs();
    const save = shadow.querySelector("[data-save]");
    if (save) save.disabled = false;
    setStatus(`Unsaved changes in ${TAB_LABELS[tab]}.`);
  }

  function renderTabs() {
    const container = shadow.querySelector(".ss-tabs");
    if (!container) return;
    container.replaceChildren();
    for (const [key, label] of Object.entries(TAB_LABELS)) {
      const tab = el("button", { class: "ss-tab", type: "button", role: "tab", "aria-selected": key === activeTab, onclick: () => { activeTab = key; render(); } });
      tab.append(document.createTextNode(label), el("span", { class: "ss-count", text: countFor(key) }));
      if (dirtyTabs.has(key)) tab.append(el("span", { class: "ss-dot", title: "Unsaved changes" }));
      container.append(tab);
    }
  }

  function emptyOrError(data, emptyMessage) {
    if (data.error) return el("div", { class: "ss-error", text: data.error });
    return el("div", { class: "ss-empty", text: emptyMessage });
  }

  function renderWebStorage(tab) {
    const data = state[tab];
    const wrapper = el("div");
    wrapper.append(el("div", { class: "ss-toolbar" }, [
      button("+ Add item", () => {
        data.entries.unshift({ key: "", value: "", originalKey: "", isNew: true, deleted: false, _dirty: true });
        markDirty(tab); renderContent();
      }),
      el("span", { class: "ss-meta", text: "Keys and values are stored as strings." })
    ]));
    if (data.error) { wrapper.append(emptyOrError(data)); return wrapper; }
    if (!data.entries.length) { wrapper.append(el("div", { class: "ss-empty", text: "No items found. Add one to get started." })); return wrapper; }
    const tbody = el("tbody");
    data.entries.forEach((entry) => {
      const row = el("tr", { class: entry.deleted ? "deleted" : "" });
      row.append(
        el("td", {}, field(entry.key, (value) => { entry.key = value; entry._dirty = true; markDirty(tab); }, { disabled: entry.deleted })),
        el("td", {}, field(entry.value, (value) => { entry.value = value; entry._dirty = true; markDirty(tab); }, { multiline: true, disabled: entry.deleted })),
        el("td", {}, button(entry.deleted ? "Restore" : "Delete", () => { entry.deleted = !entry.deleted; entry._dirty = true; markDirty(tab); renderContent(); }, "danger"))
      );
      tbody.append(row);
    });
    const table = el("table", { class: "ss-table" }, [
      el("thead", {}, el("tr", {}, [el("th", { text: "Key", style: "width:32%" }), el("th", { text: "Value" }), el("th", { text: "", style: "width:82px" })])),
      tbody
    ]);
    wrapper.append(el("div", { class: "ss-table-wrap" }, table));
    return wrapper;
  }

  function normalizeNewCookie() {
    return {
      name: "", value: "", domain: location.hostname, hostOnly: true, path: "/", secure: location.protocol === "https:",
      httpOnly: false, session: true, sameSite: "unspecified", storeId: null, sourceUrl: location.href
    };
  }

  function renderCookies() {
    const data = state.cookies;
    const wrapper = el("div");
    wrapper.append(el("div", { class: "ss-toolbar" }, [
      button("+ Add cookie", () => { data.entries.unshift({ value: normalizeNewCookie(), original: null, isNew: true, deleted: false, _dirty: true }); markDirty(); renderContent(); }),
      el("span", { class: "ss-meta", text: "HttpOnly cookies are visible because this add-on uses Firefox's cookies permission." })
    ]));
    if (data.error) { wrapper.append(emptyOrError(data)); return wrapper; }
    if (!data.entries.length) { wrapper.append(el("div", { class: "ss-empty", text: "No cookies match this page." })); return wrapper; }
    for (const entry of data.entries) {
      const cookie = entry.value;
      const markCookieDirty = () => { entry._dirty = true; markDirty(); };
      const card = el("section", { class: `ss-card ${entry.deleted ? "deleted" : ""}`.trim() });
      card.append(el("div", { class: "ss-card-head" }, [
        el("code", { text: cookie.name || "(new cookie)" }),
        button(entry.deleted ? "Restore" : "Delete", () => { entry.deleted = !entry.deleted; markCookieDirty(); renderContent(); }, "danger")
      ]));
      const grid = el("div", { class: "ss-card-body" });
      const add = (label, control, wide = false) => grid.append(el("div", { class: `ss-form-row ${wide ? "ss-wide" : ""}` }, [el("label", { text: label }), control]));
      add("Name", field(cookie.name, (v) => { cookie.name = v; markCookieDirty(); }, { disabled: entry.deleted }));
      add("Value", field(cookie.value, (v) => { cookie.value = v; markCookieDirty(); }, { multiline: true, disabled: entry.deleted }), true);
      add("Domain", field(cookie.domain, (v) => { cookie.domain = v; markCookieDirty(); }, { disabled: entry.deleted }));
      add("Path", field(cookie.path, (v) => { cookie.path = v; markCookieDirty(); }, { disabled: entry.deleted }));
      add("SameSite", select(cookie.sameSite || "unspecified", ["unspecified", "no_restriction", "lax", "strict"].map((v) => ({ value: v, label: v })), (v) => { cookie.sameSite = v; markCookieDirty(); }));
      add("Expiry (Unix seconds; blank = session)", field(cookie.session ? "" : cookie.expirationDate, (v) => { cookie.expirationDate = v ? Number(v) : undefined; cookie.session = !v; markCookieDirty(); }, { type: "number", disabled: entry.deleted }));
      const flags = el("div", { class: "ss-wide ss-meta" });
      for (const [key, label] of [["hostOnly", "Host-only"], ["secure", "Secure"], ["httpOnly", "HttpOnly"]]) {
        const checkbox = field(cookie[key], (v) => { cookie[key] = v; markCookieDirty(); }, { type: "checkbox", disabled: entry.deleted });
        flags.append(el("label", { class: "ss-option" }, [checkbox, document.createTextNode(label)]));
      }
      grid.append(flags); card.append(grid); wrapper.append(card);
    }
    return wrapper;
  }

  function parseJsonField(text, node, assign, onValid = () => markDirty()) {
    try {
      assign(JSON.parse(text));
      node.setCustomValidity("");
      onValid();
    } catch (error) {
      node.setCustomValidity(`Invalid JSON: ${error.message}`);
    }
  }

  function renderIndexedDB() {
    const data = state.indexedDB;
    const wrapper = el("div");
    if (data.error) return emptyOrError(data);
    if (!data.databases.length) return emptyOrError(data, "No IndexedDB databases found.");
    if (selectedDatabase >= data.databases.length) selectedDatabase = 0;
    const database = data.databases[selectedDatabase];
    if (selectedStore >= database.stores.length) selectedStore = 0;
    const store = database.stores[selectedStore];
    const controls = [
      select(selectedDatabase, data.databases.map((db, index) => ({ value: index, label: `${db.name} (v${db.version})` })), (value) => { selectedDatabase = Number(value); selectedStore = 0; renderContent(); })
    ];
    if (database.stores.length) controls.push(select(selectedStore, database.stores.map((item, index) => ({ value: index, label: item.name })), (value) => { selectedStore = Number(value); renderContent(); }));
    controls.push(el("span", { class: "ss-spacer" }));
    if (store) controls.push(button("+ Add record", () => {
      store.records.unshift({ key: store.autoIncrement && store.keyPath === null ? "" : null, originalKey: null, value: {}, isNew: true, deleted: false, _dirty: true });
      store._dirty = true; markDirty(); renderContent();
    }));
    wrapper.append(el("div", { class: "ss-subtoolbar" }, controls));
    if (database.error) { wrapper.append(el("div", { class: "ss-error", text: database.error })); return wrapper; }
    if (!store) { wrapper.append(el("div", { class: "ss-empty", text: "This database has no object stores." })); return wrapper; }
    if (store.error) { wrapper.append(el("div", { class: "ss-error", text: store.error })); return wrapper; }
    wrapper.append(el("p", { class: "ss-meta", text: `Key path: ${store.keyPath === null ? "out-of-line" : JSON.stringify(store.keyPath)} · Auto increment: ${store.autoIncrement ? "yes" : "no"} · Indexes: ${store.indexes?.length || 0}` }));
    if (!store.records.length) { wrapper.append(el("div", { class: "ss-empty", text: "No records found in this object store." })); return wrapper; }
    store.records.forEach((record) => {
      const card = el("section", { class: `ss-card ${record.deleted ? "deleted" : ""}`.trim() });
      card.append(el("div", { class: "ss-card-head" }, [
        el("code", { text: codec.stringify(record.key, 0) || "(generated key)" }),
        button(record.deleted ? "Restore" : "Delete", () => { record.deleted = !record.deleted; record._dirty = true; store._dirty = true; markDirty(); renderContent(); }, "danger")
      ]));
      const grid = el("div", { class: "ss-card-body" });
      const keyText = record.key === "" ? "" : codec.stringify(record.key);
      const keyField = field(keyText, (value, node) => {
        if (!value && store.autoIncrement) { record.key = ""; node.setCustomValidity(""); record._dirty = true; store._dirty = true; markDirty(); return; }
        parseJsonField(value, node, (parsed) => { record.key = parsed; }, () => { record._dirty = true; store._dirty = true; markDirty(); });
      }, { multiline: true, disabled: record.deleted || store.keyPath !== null, placeholder: store.autoIncrement ? "Leave blank to generate" : "JSON key" });
      const valueField = field(codec.stringify(record.value), (value, node) => parseJsonField(value, node, (parsed) => { record.value = parsed; }, () => { record._dirty = true; store._dirty = true; markDirty(); }), { multiline: true, disabled: record.deleted });
      grid.append(
        el("div", { class: "ss-form-row" }, [el("label", { text: store.keyPath === null ? "Key (typed JSON)" : "Key (derived from value)" }), keyField]),
        el("div", { class: "ss-form-row" }, [el("label", { text: "Value (typed JSON)" }), valueField])
      );
      card.append(grid); wrapper.append(card);
    });
    return wrapper;
  }

  function renderCacheStorage() {
    const data = state.cacheStorage;
    const wrapper = el("div");
    if (data.error) return emptyOrError(data);
    if (!data.caches.length) return emptyOrError(data, "No Cache Storage caches found.");
    if (selectedCache >= data.caches.length) selectedCache = 0;
    const cache = data.caches[selectedCache];
    const markCacheDirty = (entry) => { entry._dirty = true; cache._dirty = true; markDirty(); };
    wrapper.append(el("div", { class: "ss-subtoolbar" }, [
      select(selectedCache, data.caches.map((item, index) => ({ value: index, label: item.name })), (value) => { selectedCache = Number(value); renderContent(); }),
      el("span", { class: "ss-spacer" }),
      button("+ Add response", () => {
        const entry = { request: { url: location.origin + "/", method: "GET", headers: [] }, originalUrl: null, response: { status: 200, statusText: "OK", headers: [["content-type", "text/plain"]], type: "basic", body: "", bodyEncoding: "text", bodyReadable: true }, isNew: true, deleted: false, _dirty: true };
        cache.entries.unshift(entry);
        markCacheDirty(entry); renderContent();
      })
    ]));
    if (!cache.entries.length) { wrapper.append(el("div", { class: "ss-empty", text: "This cache has no responses." })); return wrapper; }
    cache.entries.forEach((entry) => {
      const dirty = () => markCacheDirty(entry);
      const card = el("section", { class: `ss-card ${entry.deleted ? "deleted" : ""}`.trim() });
      card.append(el("div", { class: "ss-card-head" }, [el("code", { text: entry.request.url }), button(entry.deleted ? "Restore" : "Delete", () => { entry.deleted = !entry.deleted; dirty(); renderContent(); }, "danger")]));
      const grid = el("div", { class: "ss-card-body" });
      const add = (label, control, wide = false) => grid.append(el("div", { class: `ss-form-row ${wide ? "ss-wide" : ""}` }, [el("label", { text: label }), control]));
      add("Request URL", field(entry.request.url, (v) => { entry.request.url = v; dirty(); }, { disabled: entry.deleted }), true);
      const requestHeadersField = field(codec.stringify(entry.request.headers), (value, node) => parseJsonField(value, node, (parsed) => { entry.request.headers = parsed; }, dirty), { multiline: true, disabled: entry.deleted });
      add("Request headers ([name, value] pairs)", requestHeadersField, true);
      add("Status", field(entry.response.status, (v) => { entry.response.status = Number(v); dirty(); }, { type: "number", class: "ss-mini", disabled: entry.deleted }));
      add("Status text", field(entry.response.statusText, (v) => { entry.response.statusText = v; dirty(); }, { disabled: entry.deleted }));
      const headersField = field(codec.stringify(entry.response.headers), (value, node) => parseJsonField(value, node, (parsed) => { entry.response.headers = parsed; }, dirty), { multiline: true, disabled: entry.deleted || !entry.response.bodyReadable });
      add("Response headers ([name, value] pairs)", headersField, true);
      add("Body encoding", select(entry.response.bodyEncoding, [{ value: "text", label: "Text" }, { value: "base64", label: "Base64 (binary)" }], (v) => { entry.response.bodyEncoding = v; dirty(); }));
      add("Response body", field(entry.response.body, (v) => { entry.response.body = v; dirty(); }, { multiline: true, disabled: entry.deleted || !entry.response.bodyReadable }), true);
      if (!entry.response.bodyReadable) grid.append(el("div", { class: "ss-error ss-wide", text: entry.response.bodyError || "This response body cannot be read or edited." }));
      card.append(grid); wrapper.append(card);
    });
    return wrapper;
  }

  function renderContent() {
    const content = shadow.querySelector(".ss-content");
    if (!content || !state) return;
    const renderers = { localStorage: () => renderWebStorage("localStorage"), sessionStorage: () => renderWebStorage("sessionStorage"), cookies: renderCookies, indexedDB: renderIndexedDB, cacheStorage: renderCacheStorage };
    content.replaceChildren(renderers[activeTab]());
    const save = shadow.querySelector("[data-save]");
    if (save) save.disabled = !dirtyTabs.has(activeTab);
  }

  function prepareScannedState(scanned) {
    scanned.cookies.entries = scanned.cookies.entries.map((cookie) => ({ value: structuredClone(cookie), original: structuredClone(cookie), isNew: false, deleted: false }));
    return scanned;
  }

  async function scan() {
    setBusy(true);
    setStatus("Scanning…");
    try {
      state = prepareScannedState(await adapters.scanAll());
      dirtyTabs.clear();
      selectedDatabase = selectedStore = selectedCache = 0;
      render();
      setStatus(`Scan complete · ${new Date(state.scannedAt).toLocaleTimeString()}`);
    } catch (error) {
      setStatus(`Scan failed: ${adapters.errorText(error)}`, true);
      shadow.querySelector(".ss-content").replaceChildren(el("div", { class: "ss-error", text: adapters.errorText(error) }));
    }
  }

  async function saveCurrent() {
    if (!state || !dirtyTabs.has(activeTab)) return;
    if (shadow.querySelector(":invalid")) {
      shadow.querySelector(":invalid").reportValidity();
      setStatus("Fix the invalid JSON before saving.", true);
      return;
    }
    setStatus(`Saving ${TAB_LABELS[activeTab]}…`);
    try {
      if (activeTab === "localStorage") adapters.saveWebStorage(localStorage, state.localStorage.entries);
      else if (activeTab === "sessionStorage") adapters.saveWebStorage(sessionStorage, state.sessionStorage.entries);
      else if (activeTab === "cookies") {
        const changes = state.cookies.entries.filter((entry) => entry.isNew || entry._dirty);
        await browser.runtime.sendMessage({ type: "storage-scanner:save-cookies", url: location.href, changes });
      } else if (activeTab === "indexedDB") {
        for (const database of state.indexedDB.databases) {
          for (const store of database.stores) {
            if (store._dirty) await adapters.saveIndexedStore(database.name, store.name, store.records, store.keyPath, store.autoIncrement);
          }
        }
      } else if (activeTab === "cacheStorage") {
        for (const cache of state.cacheStorage.caches) {
          if (cache._dirty) await adapters.saveCache(cache.name, cache.entries);
        }
      }
      const savedTab = activeTab;
      await scan();
      activeTab = savedTab;
      render();
      setStatus(`${TAB_LABELS[savedTab]} saved.`);
    } catch (error) {
      setStatus(`Save failed: ${adapters.errorText(error)}`, true);
    }
  }

  function exportValue(tab) {
    if (tab === "localStorage" || tab === "sessionStorage") return state[tab].entries.filter((item) => !item.deleted).map(({ key, value }) => ({ key, value }));
    if (tab === "cookies") return state.cookies.entries.filter((item) => !item.deleted).map((item) => item.value);
    if (tab === "indexedDB") return state.indexedDB.databases.map((db) => ({ name: db.name, version: db.version, error: db.error, stores: db.stores.map((store) => ({ name: store.name, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes: store.indexes, error: store.error, records: store.records.filter((item) => !item.deleted).map(({ key, value }) => ({ key, value })) })) }));
    return state.cacheStorage.caches.map((cache) => ({ name: cache.name, entries: cache.entries.filter((item) => !item.deleted).map(({ request, response }) => ({ request, response })) }));
  }

  function openExportModal() {
    const backdrop = el("div", { class: "ss-modal-backdrop" });
    const modal = el("div", { class: "ss-modal", role: "dialog", "aria-modal": "true", "aria-label": "Export storage" });
    modal.append(el("h2", { text: "Export storage" }), el("p", { text: "Choose the storage areas to include. The JSON export reflects edits currently shown, including unsaved edits." }));
    const options = el("div", { class: "ss-options" });
    const checkboxes = new Map();
    for (const [key, label] of Object.entries(TAB_LABELS)) {
      const checkbox = el("input", { type: "checkbox", class: "ss-check" });
      checkbox.checked = true; checkboxes.set(key, checkbox);
      options.append(el("label", { class: "ss-option" }, [checkbox, document.createTextNode(label)]));
    }
    const cancel = button("Cancel", () => backdrop.remove());
    const download = button("Download JSON", async () => {
      const selected = [...checkboxes].filter(([, checkbox]) => checkbox.checked).map(([key]) => key);
      if (!selected.length) { setStatus("Select at least one storage area.", true); return; }
      const exported = {
        format: "storage-scanner-export",
        version: 1,
        exportedAt: new Date().toISOString(),
        page: state.page,
        storage: Object.fromEntries(selected.map((key) => [key, exportValue(key)]))
      };
      const hostname = location.hostname.replace(/[^a-z0-9.-]/gi, "-") || "website";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      download.disabled = true;
      try {
        await browser.runtime.sendMessage({ type: "storage-scanner:download", filename: `storage-scanner-${hostname}-${stamp}.json`, json: JSON.stringify(exported, null, 2) });
        backdrop.remove(); setStatus("Export download started.");
      } catch (error) {
        download.disabled = false; setStatus(`Export failed: ${adapters.errorText(error)}`, true);
      }
    }, "primary");
    modal.append(options, el("div", { class: "ss-toolbar", style: "margin:0;justify-content:flex-end" }, [cancel, download]));
    backdrop.append(modal); shadow.querySelector(".ss-shell").append(backdrop); cancel.focus();
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.remove(); });
  }

  function render() {
    if (!shadow) return;
    renderTabs();
    renderContent();
  }

  function createOverlay() {
    host = document.createElement("div");
    host.id = "storage-scanner-extension-root";
    shadow = host.attachShadow({ mode: "closed" });
    shadow.append(el("style", { text: css }));
    const shell = el("section", { class: "ss-shell", role: "dialog", "aria-label": "Storage Scanner" });
    shell.append(
      el("header", { class: "ss-header" }, [
        el("div", { class: "ss-logo", text: "S" }),
        el("div", { class: "ss-title" }, [el("strong", { text: "Storage Scanner" }), el("span", { text: location.href })]),
        el("button", { type: "button", class: "ss-icon-btn", title: "Close", "aria-label": "Close", text: "×", onclick: closeOverlay })
      ]),
      el("nav", { class: "ss-tabs", role: "tablist" }),
      el("main", { class: "ss-content" }),
      el("footer", { class: "ss-footer" }, [
        el("span", { class: "ss-status", role: "status", "aria-live": "polite" }),
        button("Rescan", () => {
          if (dirtyTabs.size && !confirm("Discard unsaved edits and scan again?")) return;
          scan();
        }),
        button("Export…", openExportModal),
        (() => { const save = button("Save changes", saveCurrent, "primary"); save.dataset.save = ""; save.disabled = true; return save; })()
      ])
    );
    shadow.append(shell);
    (document.documentElement || document.body).append(host);
    document.addEventListener("keydown", onKeydown, true);
    setBusy(true);
    scan();
  }

  function onKeydown(event) {
    if (event.key === "Escape" && host) {
      const modal = shadow.querySelector(".ss-modal-backdrop");
      if (modal) modal.remove(); else closeOverlay();
    }
  }

  function closeOverlay() {
    document.removeEventListener("keydown", onKeydown, true);
    host?.remove(); host = null; shadow = null; state = null; dirtyTabs.clear();
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "storage-scanner:toggle") return undefined;
    if (host) closeOverlay(); else createOverlay();
    return Promise.resolve({ open: Boolean(host) });
  });
})();
