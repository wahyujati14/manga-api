const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const dataFile = "public/new_update_komik.json";
const BASE_URL = "https://komikcast02.com/daftar-komik/";
const MAX_PAGES = 3; // Batasi jumlah halaman untuk menghindari infinite loop

const scrapeNewUpdate = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  let allKomik = [];
  let pageNumber = 1;

  while (pageNumber <= MAX_PAGES) {
    const url = pageNumber === 1 ? BASE_URL : `${BASE_URL}page/${pageNumber}/`;
    console.log(`🔍 Scraping halaman: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      // Tunggu elemen utama ada sebelum lanjut
      await page.waitForSelector(".list-update_item", { timeout: 10000 });

      // Scroll ke bawah untuk memastikan semua elemen dimuat
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Tunggu beberapa detik sebelum mengambil data
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Scrape data
      const newKomik = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".list-update_item")).map(
          (komik) => ({
            title: komik.querySelector(".title")?.innerText.trim() || "Unknown",
            link: komik.querySelector("a")?.href || "No Link",
            img:
              komik.querySelector(".list-update_item-image img")?.src ||
              "No Image",
            chapter:
              komik.querySelector(".chapter")?.innerText.trim() || "No Chapter",
            rating:
              komik.querySelector(".numscore")?.innerText.trim() || "No Rating",
            type: komik.querySelector(".type")?.innerText.trim() || "Unknown",
            lastUpdate: new Date().toISOString(),
          })
        );
      });

      console.log(
        `✅ Ditemukan ${newKomik.length} komik di halaman ${pageNumber}`
      );

      if (newKomik.length === 0) {
        console.log(`❌ Tidak ada data di halaman ${pageNumber}, berhenti.`);
        break;
      }

      allKomik = [...allKomik, ...newKomik];
    } catch (error) {
      console.error(`❌ Gagal scraping halaman ${pageNumber}:`, error.message);
      break;
    }

    pageNumber++;
  }

  await browser.close();

  // Simpan hasil scraping ke file JSON
  fs.writeFileSync(dataFile, JSON.stringify(allKomik, null, 2));
  console.log("✅ Data baru berhasil disimpan di:", dataFile);
};

scrapeNewUpdate();