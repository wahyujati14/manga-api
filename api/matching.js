const fs = require("fs");
const path = require("path");

const newUpdateFile = "public/new_update_komik.json";
const komikFile = "public/komik.json";

const matchAndUpdateKomik = () => {
  if (!fs.existsSync(newUpdateFile) || !fs.existsSync(komikFile)) {
    console.error("⚠️ Salah satu file tidak ditemukan!");
    return;
  }

  // Baca data
  const newUpdates = JSON.parse(fs.readFileSync(newUpdateFile, "utf-8"));
  const komikList = JSON.parse(fs.readFileSync(komikFile, "utf-8"));

  // Buat Map dari komikList untuk pencarian yang lebih cepat
  const komikListMap = new Map(
    komikList.map((komik) => [komik.title.toLowerCase().trim(), komik])
  );

  // Update komik yang sudah ada
  const updatedKomikList = komikList.map((komik) => {
    const newKomik = newUpdates.find(
      (newData) =>
        newData.title.toLowerCase().trim() === komik.title.toLowerCase().trim()
    );

    if (newKomik) {
      // Update data lama dengan data baru
      return {
        ...komik,
        link: newKomik.link || komik.link, // Ambil link dari newUpdates, jika tidak ada gunakan yang lama
        img: newKomik.img || komik.img, // Ambil img dari newUpdates, jika tidak ada gunakan yang lama
        chapter: newKomik.chapter,
        lastUpdate: "Today",
        updateText: "Today",
      };
    }

    return komik;
  });

  // Tambahkan komik baru yang tidak ada di komik.json
  const addedTitles = new Set(); // Untuk melacak komik yang sudah ditambahkan
  newUpdates.forEach((newKomik) => {
    const normalizedTitle = newKomik.title.toLowerCase().trim();

    if (
      !komikListMap.has(normalizedTitle) &&
      !addedTitles.has(normalizedTitle)
    ) {
      updatedKomikList.push({
        title: newKomik.title,
        link: newKomik.link || "", // Ambil link dari newUpdates
        img: newKomik.img || "", // Ambil img dari newUpdates
        chapter: newKomik.chapter,
        rating: newKomik.rating,
        type: newKomik.type,
        lastUpdate: "Today",
        updateText: "Today",
      });
      addedTitles.add(normalizedTitle); // Tandai komik ini sudah ditambahkan
    }
  });

  // Simpan hasil update ke komik.json
  fs.writeFileSync(komikFile, JSON.stringify(updatedKomikList, null, 2));
  console.log("✅ Data komik berhasil diperbarui!");
};

matchAndUpdateKomik();
