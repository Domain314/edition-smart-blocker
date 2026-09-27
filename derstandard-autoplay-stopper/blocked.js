const BYPASS_PARAMETER = "dsav_user_started";
const button = document.querySelector("#load-video");
const errorMessage = document.querySelector("#invalid-url");

function getSafeVideoUrl() {
	try {
		const value = new URLSearchParams(location.search).get("url");
		const url = new URL(value);
		const isDailymotion =
			url.hostname === "dailymotion.com" || url.hostname.endsWith(".dailymotion.com");
		return url.protocol === "https:" && isDailymotion ? url : null;
	} catch {
		return null;
	}
}

const videoUrl = getSafeVideoUrl();

if (videoUrl) {
	button.hidden = false;
	button.addEventListener("click", () => {
		button.disabled = true;
		button.querySelector("strong").textContent = "Video wird geladen …";
		videoUrl.searchParams.set(BYPASS_PARAMETER, "1");
		location.replace(videoUrl.href);
	});
} else {
	errorMessage.hidden = false;
}
