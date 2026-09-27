(() => {
  "use strict";

  const codec = globalThis.StorageScannerCodec;

  function errorText(error) {
    return error?.message || String(error);
  }

  function scanKeyValue(storage) {
    const entries = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      entries.push({ key, value: storage.getItem(key), originalKey: key, isNew: false, deleted: false });
    }
    return entries;
  }

  function scanWebStorage(getStorage) {
    try {
      const storage = getStorage();
      return { entries: scanKeyValue(storage), error: null };
    } catch (error) {
      return { entries: [], error: errorText(error) };
    }
  }

  function saveWebStorage(storage, entries) {
    for (const entry of entries) {
      if (!entry.isNew && !entry._dirty) continue;
      if (entry.deleted) {
        if (!entry.isNew) storage.removeItem(entry.originalKey);
        continue;
      }
      storage.setItem(entry.key, entry.value);
      if (!entry.isNew && entry.originalKey !== entry.key) storage.removeItem(entry.originalKey);
    }
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    });
  }

  function openDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        request.transaction.abort();
        reject(new Error("Database changed while it was being scanned."));
      };
      request.onblocked = () => reject(new Error("Database is blocked by another tab."));
    });
  }

  async function readStore(database, storeName) {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const valuesPromise = requestResult(store.getAll());
    const keysPromise = requestResult(store.getAllKeys());
    const indexes = [...store.indexNames].map((name) => {
      const index = store.index(name);
      return { name: index.name, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry };
    });
    const [values, keys] = await Promise.all([valuesPromise, keysPromise, transactionDone(transaction)]).then(([values, keys]) => [values, keys]);
    const records = [];
    for (let i = 0; i < values.length; i += 1) {
      const key = await codec.encode(keys[i]);
      records.push({ key, originalKey: key, value: await codec.encode(values[i]), isNew: false, deleted: false });
    }
    return {
      name: store.name,
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
      indexes,
      records,
      error: null
    };
  }

  async function scanIndexedDB() {
    if (typeof indexedDB.databases !== "function") {
      return { databases: [], error: "This Firefox version does not support listing IndexedDB databases." };
    }
    try {
      const descriptions = await indexedDB.databases();
      const databases = [];
      for (const description of descriptions) {
        if (!description.name) continue;
        let database;
        try {
          database = await openDatabase(description.name);
          const stores = [];
          for (const storeName of database.objectStoreNames) {
            try {
              stores.push(await readStore(database, storeName));
            } catch (error) {
              stores.push({ name: storeName, records: [], error: errorText(error) });
            }
          }
          databases.push({ name: database.name, version: database.version, stores, error: null });
        } catch (error) {
          databases.push({ name: description.name, version: description.version, stores: [], error: errorText(error) });
        } finally {
          database?.close();
        }
      }
      return { databases, error: null };
    } catch (error) {
      return { databases: [], error: errorText(error) };
    }
  }

  function addRequestError(request) {
    request.onerror = () => {
      try { request.transaction.abort(); } catch (_) { /* already inactive */ }
    };
  }

  async function saveIndexedStore(databaseName, storeName, records, inlineKey, autoIncrement) {
    const database = await openDatabase(databaseName);
    let transaction;
    try {
      transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      for (const record of records) {
        if (!record.isNew && !record._dirty) continue;
        const originalKey = record.isNew ? undefined : codec.decode(record.originalKey);
        if (record.deleted) {
          if (!record.isNew) addRequestError(store.delete(originalKey));
          continue;
        }
        const value = codec.decode(record.value);
        if (inlineKey !== null) {
          if (!record.isNew) addRequestError(store.delete(originalKey));
          addRequestError(store.put(value));
          continue;
        }
        const hasKey = record.key !== null && record.key !== undefined && record.key !== "";
        const key = hasKey ? codec.decode(record.key) : undefined;
        if (!record.isNew && JSON.stringify(record.originalKey) !== JSON.stringify(record.key)) {
          addRequestError(store.delete(originalKey));
        }
        const request = hasKey ? store.put(value, key) : autoIncrement ? store.add(value) : null;
        if (!request) {
          transaction.abort();
          throw new Error("A key is required for this object store.");
        }
        addRequestError(request);
      }
      await transactionDone(transaction);
    } catch (error) {
      try {
        if (transaction?.readyState !== "done") transaction?.abort();
      } catch (_) { /* already completed or aborted */ }
      throw error;
    } finally {
      database.close();
    }
  }

  function headersToArray(headers) {
    return [...headers.entries()];
  }

  function isTextContent(contentType) {
    return /^(text\/)|json|javascript|xml|svg|x-www-form-urlencoded/i.test(contentType || "");
  }

  async function readCachedResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: headersToArray(response.headers),
      type: response.type,
      body: "",
      bodyEncoding: isTextContent(contentType) ? "text" : "base64",
      bodyReadable: true
    };
    try {
      if (result.bodyEncoding === "text") result.body = await response.clone().text();
      else result.body = codec.bytesToBase64(new Uint8Array(await response.clone().arrayBuffer()));
    } catch (error) {
      result.bodyReadable = false;
      result.bodyError = errorText(error);
    }
    return result;
  }

  async function scanCacheStorage() {
    try {
      const names = await caches.keys();
      const cacheList = [];
      for (const name of names) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        const entries = [];
        for (const request of requests) {
          const response = await cache.match(request);
          if (!response) continue;
          entries.push({
            request: { url: request.url, method: request.method, headers: headersToArray(request.headers) },
            originalUrl: request.url,
            response: await readCachedResponse(response),
            isNew: false,
            deleted: false
          });
        }
        cacheList.push({ name, entries });
      }
      return { caches: cacheList, error: null };
    } catch (error) {
      return { caches: [], error: errorText(error) };
    }
  }

  async function saveCache(cacheName, entries) {
    const cache = await caches.open(cacheName);
    for (const entry of entries) {
      if (!entry.isNew && !entry._dirty) continue;
      if (entry.deleted) {
        if (!entry.isNew) await cache.delete(entry.originalUrl);
        continue;
      }
      if (!entry.response.bodyReadable) continue;
      const request = new Request(entry.request.url, { method: "GET", headers: entry.request.headers });
      const status = Number(entry.response.status);
      const noBody = status === 204 || status === 205 || status === 304;
      const body = noBody ? null : entry.response.bodyEncoding === "base64"
        ? codec.base64ToBytes(entry.response.body)
        : entry.response.body;
      const response = new Response(body, {
        status,
        statusText: entry.response.statusText,
        headers: entry.response.headers
      });
      await cache.put(request, response);
      if (!entry.isNew && entry.originalUrl !== entry.request.url) await cache.delete(entry.originalUrl);
    }
  }

  async function scanAll() {
    const [cookies, indexed, cache] = await Promise.all([
      browser.runtime.sendMessage({ type: "storage-scanner:get-cookies", url: location.href })
        .then((entries) => ({ entries, error: null }))
        .catch((error) => ({ entries: [], error: errorText(error) })),
      scanIndexedDB(),
      scanCacheStorage()
    ]);
    return {
      scannedAt: new Date().toISOString(),
      page: { url: location.href, origin: location.origin, title: document.title },
      localStorage: scanWebStorage(() => localStorage),
      sessionStorage: scanWebStorage(() => sessionStorage),
      cookies,
      indexedDB: indexed,
      cacheStorage: cache
    };
  }

  globalThis.StorageScannerAdapters = {
    scanAll,
    saveWebStorage,
    saveIndexedStore,
    saveCache,
    errorText
  };
})();
