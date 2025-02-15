// Ganti dengan
const puppeteer = require("puppeteer");

// Sisanya tetap
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const scrapeChapterImages = require("./scrapeChapter");
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
  const dataFile = path.join(__dirname, "../public/komik.json");

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
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    console.log("✅ Halaman berhasil dimuat");

    // Mengubah selector untuk menunggu elemen yang pasti ada
    await page.waitForSelector(".komik_info-body", {
      timeout: 10000,
    });

    const detail = await page.evaluate(() => ({
      title:
        document
          .querySelector(".komik_info-content-body-title")
          ?.innerText?.trim() || "Unknown",
      synopsis:
        document
          .querySelector(".komik_info-description-sinopsis p")
          ?.innerText?.trim() || "Tidak ada sinopsis",
      genres: Array.from(
        document.querySelectorAll(".komik_info-content-genre .genre-item")
      ).map((el) => el.innerText.trim()),
      author:
        document
          .querySelector(".komik_info-content-meta span:nth-child(2)")
          ?.innerText?.replace("Author:", "")
          ?.trim() || "Unknown",
      status:
        document
          .querySelector(".komik_info-content-meta span:nth-child(3)")
          ?.innerText?.replace("Status:", "")
          ?.trim() || "Unknown",
      type:
        document
          .querySelector(".komik_info-content-info-type a")
          ?.innerText?.trim() || "Unknown",
      totalChapter:
        document
          .querySelector(".komik_info-content-meta span:nth-child(5)")
          ?.innerText?.replace("Total Chapter:", "")
          ?.trim() || "Unknown",
      lastUpdated:
        document.querySelector("time")?.getAttribute("datetime") || "Unknown",
      chapters: Array.from(
        document.querySelectorAll(".komik_info-chapters-item")
      ).map((item) => ({
        chapter: item.querySelector(".chapter-link-item")?.innerText?.trim(),
        url: item.querySelector(".chapter-link-item")?.href,
        timeAgo: item.querySelector(".chapter-link-time")?.innerText?.trim(),
      })),
    }));

    console.log("✅ Detail berhasil diambil:", detail);
    res.json(detail);
  } catch (error) {
    console.error("❌ Gagal mengambil detail:", error.message);
    res.status(500).json({ error: "Gagal mengambil detail komik!" });
  } finally {
    if (browser) {
      await browser.close();
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
