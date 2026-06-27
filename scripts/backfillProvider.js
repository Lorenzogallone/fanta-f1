/**
 * @file backfillProvider.js
 * @description Backfill the `provider` field for users who registered before
 * provider tracking was introduced. Reads all Firestore users, looks up each
 * one in Firebase Auth to get providerData, then writes the correct provider
 * string ("password" or "google.com") back to Firestore.
 *
 * Usage:
 *   node scripts/backfillProvider.js [--dry-run]
 *
 * Prerequisites:
 *   1. npm install firebase-admin (devDependency)
 *   2. Download service account key from Firebase Console:
 *      Firebase Console > Project Settings > Service Accounts > Generate New Private Key
 *   3. Save it as scripts/serviceAccountKey.json  (already in .gitignore)
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes("--dry-run");

// ── Firebase Admin init ──────────────────────────────────────────────────────

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (err) {
  console.error("Could not load serviceAccountKey.json:", err.message);
  console.error("Download it from Firebase Console > Project Settings > Service Accounts");
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine the canonical provider string from Firebase Auth providerData.
 * Priority: google.com > password > first available > null
 */
function resolveProvider(providerData) {
  if (!providerData || providerData.length === 0) return null;
  const ids = providerData.map((p) => p.providerId);
  if (ids.includes("google.com")) return "google.com";
  if (ids.includes("password")) return "password";
  return ids[0]; // fallback to whatever Firebase reports
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN — no writes will happen\n" : "🔧 LIVE RUN — Firestore will be updated\n");

  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} user documents in Firestore\n`);

  let updated = 0;
  let alreadySet = 0;
  let skipped = 0;

  const KNOWN_PROVIDERS = ["password", "google.com"];

  for (const docSnap of usersSnap.docs) {
    const uid = docSnap.id;
    const data = docSnap.data();
    const currentProvider = data.provider;

    // Skip if already set to a known provider
    if (KNOWN_PROVIDERS.includes(currentProvider)) {
      alreadySet++;
      continue;
    }

    // Fetch Auth record to determine provider
    let authUser;
    try {
      authUser = await auth.getUser(uid);
    } catch (err) {
      console.warn(`  ⚠️  UID ${uid} (${data.email ?? "no email"}) — not found in Firebase Auth: ${err.message}`);
      skipped++;
      continue;
    }

    const provider = resolveProvider(authUser.providerData);
    if (!provider) {
      console.warn(`  ⚠️  UID ${uid} (${data.email ?? "no email"}) — no providerData, skipping`);
      skipped++;
      continue;
    }

    const label = `${data.email ?? uid} → provider: "${provider}"`;
    if (DRY_RUN) {
      console.log(`  [dry-run] would update ${label}`);
    } else {
      await db.collection("users").doc(uid).update({ provider });
      console.log(`  ✅ updated ${label}`);
    }
    updated++;
  }

  console.log("\n── Summary ─────────────────────────────────────────────────");
  console.log(`  Already set  : ${alreadySet}`);
  console.log(`  ${DRY_RUN ? "Would update" : "Updated"}     : ${updated}`);
  console.log(`  Skipped      : ${skipped}`);
  if (DRY_RUN && updated > 0) {
    console.log("\nRun without --dry-run to apply the changes.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
