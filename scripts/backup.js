import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await (await import("fs/promises")).readFile(new URL("./serviceAccount.json", import.meta.url), "utf8")
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const OUTPUT_DIR = "backups";

// 📁 Crea directory se non esiste
async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

// 🔄 Backup ricorsivo di una collection
async function backupCollection(collRef, outputPath) {
  const snapshot = await collRef.get();
  const allDocs = {};

  for (const doc of snapshot.docs) {
    const docData = doc.data();
    const docId = doc.id;
    allDocs[docId] = docData;

    // 📂 backup sotto-raccolte del documento
    const subcollections = await doc.ref.listCollections();
    if (subcollections.length > 0) {
      const docPath = path.join(outputPath, docId);
      await ensureDir(docPath);

      for (const sub of subcollections) {
        await backupCollection(sub, docPath); // ricorsivo
      }
    }
  }

  // Salva il contenuto della collection in JSON
  const filePath = path.join(outputPath, `${collRef.id}.json`);
  await writeFile(filePath, JSON.stringify(allDocs, null, 2));
  console.log(`✔️ Salvato: ${filePath}`);
}

// ▶️ Inizia il backup
async function backupFirestore() {
  await ensureDir(OUTPUT_DIR);

  const collections = await db.listCollections();
  for (const col of collections) {
    await backupCollection(col, OUTPUT_DIR);
  }

  console.log("🎉 Backup completo (incluso subcollections)!");
}

backupFirestore().catch(console.error);