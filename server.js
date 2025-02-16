// PUPPETER
const puppeteer = require("puppeteer-extra"); // Gunakan puppeteer-extra
const StealthPlugin = require("puppeteer-extra-plugin-stealth"); // Stealth plugin
const chromium = require("@sparticuz/chromium");
const express = require("express");
const cors = require("cors");

puppeteer.use(StealthPlugin()); // Aktifkan stealth mode

const fs = require("fs");
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
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      defaultViewport: { width: 1366, height: 768 },
    });

    const page = await browser.newPage();

    // Set User-Agent agar tidak terdeteksi sebagai bot
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Perbesar timeout untuk mencegah error navigasi
    await page.setDefaultNavigationTimeout(120000);
    await page.setDefaultTimeout(60000);

    // Buka halaman dengan metode yang lebih cepat
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });

    // Tunggu elemen utama muncul
    await page.waitForSelector(".komik_info", { timeout: 30000 });

    const detail = await page.evaluate(() => {
      const getText = (selector, parent = document) =>
        parent.querySelector(selector)?.innerText?.trim() || "";

      const getMetaInfo = (label) => {
        const elements = document.querySelectorAll(".komik_info-content-info");
        for (const el of elements) {
          if (el.textContent.includes(label)) {
            return el.textContent.split(":")[1]?.trim() || "";
          }
        }
        return "";
      };

      const genres = Array.from(
        document.querySelectorAll(".komik_info-content-genre .genre-item")
      )
        .map((el) => el.textContent.trim())
        .filter(Boolean);

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
