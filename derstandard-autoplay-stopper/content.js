const DAILYMOTION_PROVIDER_SELECTOR =
	'[data-embed-provider="dailymotion" i]';
const DAILYMOTION_ELEMENT_SELECTOR = [
	DAILYMOTION_PROVIDER_SELECTOR,
	'iframe[src*="dailymotion.com" i]',
	'iframe[data-src*="dailymotion.com" i]',
	'script[src*="dailymotion.com/player/" i]',
].join(",");
const DAILYMOTION_ID_PATTERN = /^[a-z0-9]+$/iu;
const PIANO_ARTICLE_VIDEO_SELECTOR = "#piano-article-video-container";
const MAIN_CONTROLLER_FIGURE_SELECTOR = 'figure[ng-controller="MainController"]';
const userStartedMedia = new WeakSet();

function isDerStandardHostname(hostname) {
	return hostname === "derstandard.at" || hostname === "www.derstandard.at";
}

function isDerStandardDocument() {
	return location.protocol === "https:" && isDerStandardHostname(location.hostname);
}

function isDerStandardStoryUrl(value) {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			isDerStandardHostname(url.hostname) &&
			/^\/story\/\d+(?:\/|$)/u.test(url.pathname)
		);
	} catch {
		return false;
	}
}

function isStoryPage() {
	if (isDerStandardStoryUrl(location.href)) return true;
	return (
		location.hostname === "buy.tinypass.com" &&
		isDerStandardStoryUrl(new URLSearchParams(location.search).get("url"))
	);
}

function isMainControllerVideo(element) {
	return isStoryPage() && Boolean(element.closest(MAIN_CONTROLLER_FIGURE_SELECTOR));
}

function isDailymotionHostname(hostname) {
	return (
		hostname === "dailymotion.com" ||
		hostname.endsWith(".dailymotion.com") ||
		hostname === "dai.ly" ||
		hostname.endsWith(".dai.ly")
	);
}

function normaliseVideoId(value) {
	if (!value) return null;

	const videoId = value.trim();
	return DAILYMOTION_ID_PATTERN.test(videoId) ? videoId : null;
}

function getVideoIdFromUrl(value) {
	if (!value) return null;

	try {
		const url = new URL(value, document.baseURI);
		if (!isDailymotionHostname(url.hostname)) return null;

		const queryVideoId = normaliseVideoId(url.searchParams.get("video"));
		if (queryVideoId) return queryVideoId;

		const pathParts = url.pathname.split("/").filter(Boolean);
		const videoIndex = pathParts.findIndex((part) => part === "video");
		if (videoIndex >= 0) return normaliseVideoId(pathParts[videoIndex + 1]);

		if (url.hostname === "dai.ly" || url.hostname.endsWith(".dai.ly")) {
			return normaliseVideoId(pathParts[0]);
		}
	} catch {
		// Ignore malformed URLs supplied by third-party markup.
	}

	return null;
}

function getVideoIdFromTemplate(value) {
	if (!value) return null;

	// derStandard stores the player snippet HTML-escaped inside a text/html script.
	const namedEntities = {
		amp: "&",
		apos: "'",
		gt: ">",
		lt: "<",
		quot: '"',
	};
	const decodedValue = value.replace(
		/&(amp|apos|gt|lt|quot);|&#(\d+);|&#x([\da-f]+);/giu,
		(match, named, decimal, hexadecimal) => {
			if (named) return namedEntities[named.toLowerCase()];

			const codePoint = Number.parseInt(decimal || hexadecimal, decimal ? 10 : 16);
			return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
		},
	);
	const attributeMatch = decodedValue.match(
		/\bdata-video(?:-id)?\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/iu,
	);
	const attributeVideoId = normaliseVideoId(attributeMatch?.[1] || attributeMatch?.[2]);
	if (attributeVideoId) return attributeVideoId;

	const urlMatch = decodedValue.match(/https:\/\/[^\s"'<>]+/iu);
	return getVideoIdFromUrl(urlMatch?.[0]);
}

function getDailymotionVideoId(element) {
	const candidates = [
		element.getAttribute("data-video"),
		element.getAttribute("data-video-id"),
		element.getAttribute("src"),
		element.getAttribute("data-src"),
		element.getAttribute("href"),
	];

	for (const candidate of candidates) {
		const videoId = normaliseVideoId(candidate) || getVideoIdFromUrl(candidate);
		if (videoId) return videoId;
	}

	for (const descendant of element.querySelectorAll(
		"[data-video], [data-video-id], iframe[src], iframe[data-src], script[src]",
	)) {
		const videoId = getDailymotionVideoId(descendant);
		if (videoId) return videoId;
	}

	for (const template of element.querySelectorAll(
		'script[type="text/html"], template, .js-embed-template',
	)) {
		const videoId = getVideoIdFromTemplate(template.textContent);
		if (videoId) return videoId;
	}

	return getVideoIdFromTemplate(element.textContent);
}

function createDailymotionLink(videoId) {
	const videoUrl = `https://www.dailymotion.com/video/${videoId}`;
	const link = document.createElement("a");
	link.className = "dsav-dailymotion-link";
	link.href = videoUrl;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	link.dataset.derstandardAutoplayStopped = "true";
	link.setAttribute("aria-label", "Dailymotion-Video in einem neuen Tab öffnen");

	const thumbnail = document.createElement("img");
	thumbnail.className = "dsav-dailymotion-thumbnail";
	thumbnail.src = `https://www.dailymotion.com/thumbnail/video/${videoId}`;
	thumbnail.alt = "";
	thumbnail.loading = "lazy";
	thumbnail.decoding = "async";

	const playIcon = document.createElement("span");
	playIcon.className = "dsav-dailymotion-play";
	playIcon.setAttribute("aria-hidden", "true");

	const label = document.createElement("span");
	label.className = "dsav-dailymotion-label";
	label.textContent = "Auf Dailymotion öffnen ↗";

	link.append(thumbnail, playIcon, label);
	return link;
}

function replaceDailymotionEmbed(element) {
	if (
		!element.isConnected ||
		element.matches(".dsav-dailymotion-link") ||
		isMainControllerVideo(element)
	) return;

	const provider = element.closest(DAILYMOTION_PROVIDER_SELECTOR);
	const embed = provider || element;
	const videoId = getDailymotionVideoId(embed);
	if (!videoId) return;

	embed.replaceWith(createDailymotionLink(videoId));
}

function replaceMainControllerVideo() {
	if (!isStoryPage()) return false;

	for (const figure of document.querySelectorAll(MAIN_CONTROLLER_FIGURE_SELECTOR)) {
		const container = figure.querySelector(":scope > #player-container");
		if (!container || !figure.querySelector(":scope > h3")) continue;

		for (const iframe of container.querySelectorAll("iframe[src], iframe[data-src]")) {
			const videoId =
				getVideoIdFromUrl(iframe.getAttribute("src")) ||
				getVideoIdFromUrl(iframe.getAttribute("data-src"));
			if (!videoId) continue;

			container.replaceWith(createDailymotionLink(videoId));
			return true;
		}

		for (const script of container.querySelectorAll(
			'script[src*="dailymotion.com/player/" i][data-video]',
		)) {
			const videoId = normaliseVideoId(script.getAttribute("data-video"));
			if (!videoId) continue;

			container.replaceWith(createDailymotionLink(videoId));
			return true;
		}
	}

	return false;
}

function stopNativeMedia(media) {
	media.removeAttribute("autoplay");
	media.autoplay = false;
	if (!media.paused && !userStartedMedia.has(media)) media.pause();
}

function removePianoArticleVideo(root) {
	const container = root.matches?.(PIANO_ARTICLE_VIDEO_SELECTOR)
		? root
		: root.closest?.(PIANO_ARTICLE_VIDEO_SELECTOR);
	if (container) {
		container.remove();
		return true;
	}

	root.querySelectorAll?.(PIANO_ARTICLE_VIDEO_SELECTOR).forEach((element) =>
		element.remove(),
	);
	return false;
}

function scan(root) {
	if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
	if (removePianoArticleVideo(root)) return;

	const containingProvider = root.closest?.(DAILYMOTION_PROVIDER_SELECTOR);
	if (containingProvider) replaceDailymotionEmbed(containingProvider);

	if (root.matches?.(DAILYMOTION_ELEMENT_SELECTOR)) replaceDailymotionEmbed(root);
	root.querySelectorAll?.(DAILYMOTION_ELEMENT_SELECTOR).forEach(replaceDailymotionEmbed);

	if (root.matches?.("video, audio")) stopNativeMedia(root);
	root.querySelectorAll?.("video, audio").forEach(stopNativeMedia);
}

function rememberUserGesture(event) {
	const media = event.target.closest?.("video, audio");
	if (media) userStartedMedia.add(media);
}

if (isStoryPage() && !replaceMainControllerVideo()) {
	const mainControllerObserver = new MutationObserver(() => {
		if (replaceMainControllerVideo()) mainControllerObserver.disconnect();
	});
	mainControllerObserver.observe(document, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["src", "data-src", "data-video"],
	});
}

if (isDerStandardDocument()) {
	document.addEventListener("pointerdown", rememberUserGesture, true);
	document.addEventListener("keydown", rememberUserGesture, true);
	document.addEventListener(
		"play",
		(event) => {
			if (!userStartedMedia.has(event.target)) event.target.pause();
		},
		true,
	);

	scan(document);

	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === "attributes") {
				scan(mutation.target);
				continue;
			}

			scan(mutation.target);
			mutation.addedNodes.forEach(scan);
		}
	}).observe(document, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: [
			"id",
			"src",
			"data-src",
			"data-video",
			"data-video-id",
			"data-embed-provider",
			"autoplay",
		],
	});
}
