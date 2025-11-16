import { readdir, readFile } from "fs/promises";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await readFile(new URL("./serviceAccount.json", import.meta.url), "utf8")
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const BACKUP_DIR = "./backups";

// Ricorsivamente carica i file JSON e salva i documenti
async function restoreCollection(currentPath, parentRef = db) {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);

    if (entry.isFile() && entry.name.endsWith(".json")) {
      const colName = path.basename(entry.name, ".json");
      const jsonData = JSON.parse(await readFile(fullPath, "utf8"));
      const colRef = parentRef.collection(colName);

      for (const [docId, data] of Object.entries(jsonData)) {
        await colRef.doc(docId).set(data);
        console.log(`⬆️  Importato documento ${docId} in /${colRef.id}`);
      }

    } else if (entry.isDirectory()) {
      const parentDocId = path.basename(currentPath);
      const newParent = parentRef.doc?.(parentDocId) ?? parentRef.collection(parentDocId);
      await restoreCollection(fullPath, newParent);
    }
  }
}

// ▶️ Avvio restore
restoreCollection(BACKUP_DIR).then(() => {
  console.log("✅ Ripristino completato!");
}).catch(console.error);