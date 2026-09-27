const scanButton = document.querySelector("#scan");
const status = document.querySelector("#status");

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  status.textContent = "";
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:|^file:/.test(tab.url || "")) {
      throw new Error("Open a normal website first. Firefox does not allow add-ons on protected browser pages.");
    }
    await browser.tabs.sendMessage(tab.id, { type: "storage-scanner:toggle" });
    window.close();
  } catch (error) {
    status.textContent = error.message || "Storage Scanner cannot run on this page.";
    scanButton.disabled = false;
  }
});
