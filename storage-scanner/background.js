function cookieUrl(cookie, fallbackUrl) {
  const fallback = new URL(fallbackUrl);
  const scheme = cookie.secure ? "https:" : fallback.protocol === "https:" ? "https:" : "http:";
  const host = (cookie.domain || fallback.hostname).replace(/^\./, "");
  const path = cookie.path?.startsWith("/") ? cookie.path : "/";
  return `${scheme}//${host}${path}`;
}

function cookieIdentity(cookie) {
  return {
    url: cookieUrl(cookie, cookie.sourceUrl),
    name: cookie.name,
    storeId: cookie.storeId,
    ...(cookie.firstPartyDomain ? { firstPartyDomain: cookie.firstPartyDomain } : {}),
    ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey } : {})
  };
}

async function getCookies(url) {
  const cookies = await browser.cookies.getAll({ url, partitionKey: {} });
  return cookies.map((cookie) => ({ ...cookie, sourceUrl: url }));
}

async function saveCookies({ url, changes }) {
  for (const change of changes) {
    const original = change.original;
    if (change.deleted) {
      if (original) await browser.cookies.remove(cookieIdentity({ ...original, sourceUrl: url }));
      continue;
    }

    const next = change.value;
    const details = {
      url: cookieUrl(next, url),
      name: next.name,
      value: next.value,
      path: next.path || "/",
      secure: Boolean(next.secure),
      httpOnly: Boolean(next.httpOnly),
      sameSite: next.sameSite || "unspecified",
      ...(next.hostOnly ? {} : { domain: next.domain }),
      ...(next.session || !next.expirationDate ? {} : { expirationDate: Number(next.expirationDate) }),
      ...(next.storeId ? { storeId: next.storeId } : {}),
      ...(next.firstPartyDomain ? { firstPartyDomain: next.firstPartyDomain } : {}),
      ...(next.partitionKey ? { partitionKey: next.partitionKey } : {})
    };
    await browser.cookies.set(details);
    if (original && (original.name !== next.name || original.path !== next.path || original.domain !== next.domain)) {
      await browser.cookies.remove(cookieIdentity({ ...original, sourceUrl: url }));
    }
  }
  return getCookies(url);
}

async function downloadJson(filename, json) {
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await browser.downloads.download({ url: objectUrl, filename, saveAs: true });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

browser.runtime.onMessage.addListener((message) => {
  switch (message?.type) {
    case "storage-scanner:get-cookies":
      return getCookies(message.url);
    case "storage-scanner:save-cookies":
      return saveCookies(message);
    case "storage-scanner:download":
      return downloadJson(message.filename, message.json);
    default:
      return undefined;
  }
});
