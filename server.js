// PUPPETER
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const express = require("express");
const fs = require("fs");
const cors = require("cors");
const scrapeChapterImages = require("./api/scrapeChapter");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Fungsi Scraping Data
app.get("/api/scrape", async (req, res) => {
  console.log("🔄 Scraping dimulai melalui API...");
  try {
    await scrapeKomik();
    res.json({ message: "Scraping berhasil!" });
  } catch (error) {
    res.status(500).json({ error: "Gagal melakukan scraping!" });
  }
});

// Endpoint untuk mengambil daftar komik
app.get("/api/komik", (req, res) => {
  const dataFile = path.join(__dirname, "public/komik.json");

  if (!fs.existsSync(dataFile)) {
    return res.status(404).json({ error: "Data komik belum tersedia!" });
  }

  try {
    const data = fs.readFileSync(dataFile, "utf-8");
    const komikList = JSON.parse(data);
    res.json(komikList);
  } catch (error) {
    res.status(500).json({ error: "Gagal membaca data komik!" });
  }
});

// Endpoint untuk mengambil detail komik
app.get("/api/komik/detail", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL komik diperlukan!" });
  console.log(`🔍 Scraping detail komik: ${url}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: await chromium.executablePath(),
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });

    const page = await browser.newPage();

    // Set timeout lebih lama untuk navigasi
    page.setDefaultNavigationTimeout(90000);

    // Tambahkan error handler untuk page
    page.on("error", (err) => {
      console.error("Page error:", err);
    });

    // Tunggu sampai navigasi selesai
    await page.goto(url, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 90000,
    });

    // Tambahkan delay kecil setelah navigasi
    await page.waitForTimeout(2000);

    console.log("✅ Halaman berhasil dimuat");

    // Tunggu selector dengan retry
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await page.waitForSelector(".komik_info-body", {
          timeout: 15000,
        });
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) throw error;
        await page.waitForTimeout(2000);
      }
    }

    const detail = await page.evaluate(() => {
      const safeQuerySelector = (
        selector,
        property = "innerText",
        defaultValue = "Unknown"
      ) => {
        const element = document.querySelector(selector);
        if (!element) return defaultValue;
        return property === "innerText"
          ? element.innerText.trim()
          : element[property];
      };

      return {
        title: safeQuerySelector(".komik_info-content-body-title"),
        synopsis: safeQuerySelector(
          ".komik_info-description-sinopsis p",
          "innerText",
          "Tidak ada sinopsis"
        ),
        genres: Array.from(
          document.querySelectorAll(".komik_info-content-genre .genre-item") ||
            []
        ).map((el) => el.innerText.trim()),
        author: safeQuerySelector(".komik_info-content-meta span:nth-child(2)")
          ?.replace("Author:", "")
          ?.trim(),
        status: safeQuerySelector(".komik_info-content-meta span:nth-child(3)")
          ?.replace("Status:", "")
          ?.trim(),
        type: safeQuerySelector(".komik_info-content-info-type a"),
        totalChapter: safeQuerySelector(
          ".komik_info-content-meta span:nth-child(5)"
        )
          ?.replace("Total Chapter:", "")
          ?.trim(),
        lastUpdated: safeQuerySelector("time", "datetime"),
        chapters: Array.from(
          document.querySelectorAll(".komik_info-chapters-item") || []
        )
          .map((item) => ({
            chapter: safeQuerySelector(
              ".chapter-link-item",
              "innerText",
              null,
              item
            ),
            url: item.querySelector(".chapter-link-item")?.href || "",
            timeAgo: safeQuerySelector(
              ".chapter-link-time",
              "innerText",
              null,
              item
            ),
          }))
          .filter((chapter) => chapter.chapter && chapter.url),
      };
    });

    console.log("✅ Detail berhasil diambil:", detail);
    res.json(detail);
  } catch (error) {
    console.error("❌ Gagal mengambil detail:", error.message);
    res.status(500).json({
      error: "Gagal mengambil detail komik!",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
    }
  }
});

app.get("/api/chapter", async (req, res) => {
  const { url } = req.query; // Dapatkan URL dari query param

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required!" });
  }

  console.log(`🔄 Fetching chapter images for: ${url}`);
  const chapterData = await scrapeChapterImages(url);
  res.json(chapterData);
});

// Menjalankan server di port 3000 (untuk lokal)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  });
}

// Konfigurasi agar Vercel bisa mengenali Express
module.exports = app;
