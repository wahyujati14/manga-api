const puppeteer = require("puppeteer");
const fs = require("fs");

const dataFile = "public/komik.json";
const lastPageFile = "public/last_page.json";

// Fungsi untuk membaca halaman terakhir yang diproses
const readLastPage = () => {
  if (fs.existsSync(lastPageFile)) {
    try {
      const data = fs.readFileSync(lastPageFile, "utf-8").trim(); // Hapus spasi ekstra
      return data ? JSON.parse(data) : { lastPage: 1 }; // Jika kosong, reset ke 1
    } catch (error) {
      console.error("❌ Error membaca last_page.json, reset ke 1...");
      return { lastPage: 1 };
    }
  } else {
    console.log("📄 Membuat last_page.json dengan halaman 1...");
    saveLastPage(1);
    return { lastPage: 1 };
  }
};

// Fungsi untuk menyimpan halaman terakhir yang diproses
const saveLastPage = (pageNumber) => {
  try {
    fs.writeFileSync(
      lastPageFile,
      JSON.stringify({ lastPage: pageNumber }, null, 2)
    );
    console.log(`✅ Halaman terakhir disimpan: ${pageNumber}`);
  } catch (error) {
    console.error("❌ Gagal menyimpan last_page.json:", error.message);
  }
};

// Fungsi untuk membaca data sebelumnya agar tidak duplikasi
const readPreviousData = () => {
  if (fs.existsSync(dataFile)) {
    try {
      const data = fs.readFileSync(dataFile, "utf-8").trim(); // Hapus spasi ekstra
      return data ? JSON.parse(data) : []; // Cegah JSON.parse error
    } catch (error) {
      console.error("❌ Error membaca public/komik.json, reset ke []...");
      return [];
    }
  }
  return [];
};

const scrapeKomik = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let allKomik = [];
  let { lastPage } = readLastPage(); // Baca halaman terakhir yang berhasil
  const totalPages = 5; // Scraping 5 halaman dari lastPage

  console.log(`📌 Mulai scraping dari halaman ${lastPage}...`);

  for (let i = lastPage; i < lastPage + totalPages; i++) {
    const url =
      i === 1
        ? "https://komikcast02.com/daftar-komik/"
        : `https://komikcast02.com/daftar-komik/page/${i}/`;

    console.log(`🔄 Scraping halaman ${i}: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForSelector(".list-update_items", { timeout: 5000 });

      const komikList = await page.evaluate(() => {
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
          })
        );
      });

      allKomik = allKomik.concat(komikList);
      saveLastPage(i); // Simpan halaman terakhir setelah sukses scraping
    } catch (error) {
      console.error(`⚠️ Gagal scraping halaman ${i}:`, error.message);
      break; // Jika error, hentikan loop agar tidak mengulang ke halaman awal
    }
  }

  await browser.close();

  // Baca data sebelumnya untuk menghindari duplikasi
  const previousData = readPreviousData();
  const newKomik = allKomik.filter(
    (komik) => !previousData.some((old) => old.link === komik.link)
  );

  if (newKomik.length > 0) {
    console.log(`✅ ${newKomik.length} komik baru ditemukan!`);
    fs.writeFileSync(
      dataFile,
      JSON.stringify([...previousData, ...newKomik], null, 2) // Tambah di akhir agar urut
    );
    console.log("📂 Data diperbarui di public/komik.json");
  } else {
    console.log("🔄 Tidak ada komik baru.");
  }
};

// Jalankan scraping pertama kali
scrapeKomik();

let scrapeCount = 0; // Hitungan eksekusi scraping
const maxScrape = 3; // Maksimal scraping sebelum jeda
const scrapeInterval = 60 * 1000; // 1 menit
const pauseDuration = 3 * 60 * 60 * 1000; // 3 jam (dalam milidetik)

const startScrapingCycle = () => {
  const interval = setInterval(() => {
    if (scrapeCount < maxScrape) {
      scrapeKomik();
      scrapeCount++;
      console.log(`🔄 Scraping ke-${scrapeCount}`);
    } else {
      clearInterval(interval); // Hentikan interval
      console.log(`⏸️ Scraping berhenti sementara selama 3 jam...`);

      // Tunggu 3 jam, lalu reset counter dan mulai lagi
      setTimeout(() => {
        scrapeCount = 0;
        console.log("▶️ Memulai scraping kembali...");
        startScrapingCycle();
      }, pauseDuration);
    }
  }, scrapeInterval);
};

// Mulai siklus scraping
startScrapingCycle();
