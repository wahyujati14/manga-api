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

  const updatedKomikList = komikList.map((komik) => {
    const newKomik = newUpdates.find(
      (newData) => newData.title === komik.title
    );

    if (newKomik) {
      // Update data lama dengan data baru
      return {
        ...komik,
        chapter: newKomik.chapter,
        lastUpdate: "Today",
        updateText: "Today",
      };
    }

    return komik;
  });

  // Tambahkan komik baru yang tidak ada di komik.json
  newUpdates.forEach((newKomik) => {
    if (!komikList.some((komik) => komik.title === newKomik.title)) {
      updatedKomikList.push({
        title: newKomik.title,
        link: "", // Bisa diperbarui nanti
        img: "", // Bisa diperbarui nanti
        chapter: newKomik.chapter,
        rating: newKomik.rating,
        type: newKomik.type,
        lastUpdate: "Today",
        updateText: "Today",
      });
    }
  });

  // Simpan hasil update ke komik.json
  fs.writeFileSync(komikFile, JSON.stringify(updatedKomikList, null, 2));
  console.log("✅ Data komik berhasil diperbarui!");
};

matchAndUpdateKomik();
