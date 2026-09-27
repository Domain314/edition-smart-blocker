const BYPASS_PARAMETER = "dsav_user_started";

function isDerStandardUrl(value) {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			(url.hostname === "derstandard.at" || url.hostname === "www.derstandard.at")
		);
	} catch {
		return false;
	}
}

function isDailymotionUrl(value) {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			(url.hostname === "dailymotion.com" || url.hostname.endsWith(".dailymotion.com"))
		);
	} catch {
		return false;
	}
}

function redirectAutoplayFrame(details) {
	if (!isDailymotionUrl(details.url)) return {};

	const requestedUrl = new URL(details.url);
	if (requestedUrl.searchParams.get(BYPASS_PARAMETER) === "1") return {};

	if (![details.documentUrl, details.originUrl].some(isDerStandardUrl)) return {};

	const blockedPage = new URL(browser.runtime.getURL("blocked.html"));
	blockedPage.searchParams.set("url", details.url);
	return { redirectUrl: blockedPage.href };
}

browser.webRequest.onBeforeRequest.addListener(
	redirectAutoplayFrame,
	{
		urls: ["https://dailymotion.com/*", "https://*.dailymotion.com/*"],
		types: ["sub_frame"],
	},
	["blocking"],
);
