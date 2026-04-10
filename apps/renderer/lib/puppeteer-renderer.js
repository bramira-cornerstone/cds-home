import puppeteer from "puppeteer";

const SNAPSHOT_TIMEOUT = 30000; // 30 seconds
const BASE_URL = process.env.SNAPSHOT_BASE_URL || "http://localhost:5173";

export async function renderSnapshot(tokenId) {
  let browser = null;
  let page = null;
  const startTime = Date.now();

  try {
    console.log(`[Renderer] Starting snapshot render for token ${tokenId}`);

    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== "false",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--enable-webgl",
        "--enable-features=WebGL2",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    });

    page = await browser.newPage();

    // Set viewport to a reasonable size for 3D rendering
    await page.setViewport({ width: 1024, height: 1024 });

    const snapshotUrl = `${BASE_URL}/snapshot/relic/${tokenId}?snapshot=true`;
    console.log(`[Renderer] Navigating to ${snapshotUrl}`);

    await page.goto(snapshotUrl, {
      waitUntil: "networkidle0",
      timeout: SNAPSHOT_TIMEOUT,
    });

    console.log(`[Renderer] Waiting for SNAPSHOT_READY signal`);

    // Wait for the scene to signal it's ready for capture
    await page.waitForFunction(() => window.SNAPSHOT_READY === true, {
      timeout: SNAPSHOT_TIMEOUT,
    });

    console.log(`[Renderer] Scene ready, capturing screenshot`);

    // Take screenshot as WebP
    const screenshotBuffer = await page.screenshot({
      type: "webp",
      quality: 92,
      fullPage: false,
    });

    const renderTime = Date.now() - startTime;
    console.log(
      `[Renderer] Screenshot captured successfully (${renderTime}ms, ${screenshotBuffer.length} bytes)`,
    );

    return {
      buffer: screenshotBuffer,
      mimeType: "image/webp",
      renderTime,
    };
  } catch (error) {
    const renderTime = Date.now() - startTime;
    console.error(
      `[Renderer] Failed to render snapshot for token ${tokenId} (${renderTime}ms):`,
      error,
    );
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.error("[Renderer] Error closing page:", e);
      }
    }

    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error("[Renderer] Error closing browser:", e);
      }
    }
  }
}
