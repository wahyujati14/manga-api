const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs").promises;

puppeteer.use(StealthPlugin());

const scrapeChapterImages = async (url) => {
  console.log(`🚀 Scraping chapter images from ${url}`);
  let browser = null;

  try {
    // Launch browser with more aggressive options
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--ignore-certificate-errors",
        '--proxy-server="direct://"',
        "--proxy-bypass-list=*",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();

    // Bypass common anti-bot measures
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Connection: "keep-alive",
      "Cache-Control": "max-age=0",
      "Upgrade-Insecure-Requests": "1",
    });

    // Set additional page configurations
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(120000); // Increase to 120 seconds
    await page.setDefaultTimeout(120000);

    // Intercept requests to block unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (
        req.resourceType() === "image" ||
        req.resourceType() === "stylesheet" ||
        req.resourceType() === "font" ||
        req.resourceType() === "media"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate with retry mechanism
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 120000,
        });
        break;
      } catch (error) {
        console.log(`Attempt ${retryCount + 1} failed: ${error.message}`);
        retryCount++;
        if (retryCount === maxRetries) throw error;
        await page.waitForTimeout(5000); // Wait 5 seconds before retry
      }
    }

    // Wait for content with multiple selector options
    const selectors = [
      "#chapter_body img",
      ".chapter-content img",
      ".chapter img",
    ];
    let images = [];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 30000 });

        // Extract image URLs
        images = await page.evaluate((sel) => {
          return Array.from(document.querySelectorAll(sel))
            .map(
              (img) =>
                img.src ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-lazy-src")
            )
            .filter((src) => src);
        }, selector);

        if (images.length > 0) break;
      } catch (error) {
        console.log(`Selector ${selector} failed: ${error.message}`);
        continue;
      }
    }

    if (images.length === 0) {
      throw new Error("No images found with any of the known selectors");
    }

    // Log success
    console.log(`✅ Successfully found ${images.length} images`);

    await browser.close();
    return { url, images };
  } catch (error) {
    console.error("Error during scraping:", error.message);

    if (browser) {
      await browser.close();
    }

    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
};

module.exports = scrapeChapterImages;
