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
      args: [...chromium.args, "--no-sandbox"],
      defaultViewport: { width: 1366, height: 768 },
    });

    const page = await browser.newPage();

    // Increase timeouts
    await page.setDefaultNavigationTimeout(120000);
    await page.setDefaultTimeout(60000);

    // Wait until network is idle
    await page.goto(url, {
      waitUntil: ["domcontentloaded", "networkidle0"],
      timeout: 120000,
    });

    // Wait for the main container
    await page.waitForSelector(".komik_info", { timeout: 30000 });

    const detail = await page.evaluate(() => {
      // Helper function untuk extract text dengan safety checks
      const getText = (selector, parent = document) => {
        const element = parent.querySelector(selector);
        return element ? element.innerText.trim() : "";
      };

      // Helper untuk extract specific info dari meta content
      const getMetaInfo = (label) => {
        const elements = document.querySelectorAll(".komik_info-content-info");
        for (const el of elements) {
          if (el.textContent.includes(label)) {
            return el.textContent.split(":")[1]?.trim() || "";
          }
        }
        return "";
      };

      // Get genres dengan safety check
      const genres = Array.from(
        document.querySelectorAll(".komik_info-content-genre .genre-item")
      )
        .map((el) => el.textContent.trim())
        .filter(Boolean);

      // Get chapters dengan safety check
      const chapters = Array.from(
        document.querySelectorAll(".komik_info-chapters-item")
      )
        .map((item) => ({
          chapter: getText(".chapter-link-item", item),
          url: item.querySelector(".chapter-link-item")?.href || "",
          timeAgo: getText(".chapter-link-time", item),
        }))
        .filter((chapter) => chapter.chapter && chapter.url);

      return {
        title: getText(".komik_info-content-body-title"),
        nativeTitle: getText(".komik_info-content-native"),
        synopsis: getText(".komik_info-description-sinopsis p"),
        genres,
        author: getMetaInfo("Author"),
        status: getMetaInfo("Status"),
        type: getText(".komik_info-content-info-type a"),
        totalChapter: getMetaInfo("Total Chapter"),
        lastUpdated:
          document.querySelector("time")?.getAttribute("datetime") || "",
        releaseYear: getMetaInfo("Released"),
        thumbnail:
          document.querySelector(".komik_info-cover-image img")?.src || "",
        chapters,
      };
    });

    console.log("✅ Detail berhasil diambil");
    res.json(detail);
  } catch (error) {
    console.error("❌ Gagal mengambil detail:", error);
    res.status(500).json({
      error: "Gagal mengambil detail komik!",
      message: error.message,
    });
  } finally {
    if (browser) {
      await browser.close().catch(console.error);
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
