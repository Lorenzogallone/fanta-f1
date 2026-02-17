/**
 * @file setAdminClaim.js
 * @description One-time script to set Firebase Auth custom claim 'admin: true'
 *
 * Usage:
 *   node scripts/setAdminClaim.js <email>
 *   node scripts/setAdminClaim.js lorenzo.gallone@gmail.com
 *
 * Prerequisites:
 *   1. npm install firebase-admin (devDependency)
 *   2. Download service account key from Firebase Console:
 *      Firebase Console > Project Settings > Service Accounts > Generate New Private Key
 *   3. Save it as scripts/serviceAccountKey.json
 *   4. Make sure serviceAccountKey.json is in .gitignore
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account key
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (err) {
  console.error("Error: Could not load serviceAccountKey.json");
  console.error("Detail:", err.message);
  console.error("Download it from Firebase Console > Project Settings > Service Accounts");
  console.error(`Expected path: ${serviceAccountPath}`);
  process.exit(1);
}

async function setAdmin(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`Admin claim set for ${email} (uid: ${user.uid})`);
    console.log("The user will need to log out and log back in (or wait up to 1 hour) for the claim to take effect.");
  } catch (err) {
    console.error(`Error setting admin claim for ${email}:`, err.message);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/setAdminClaim.js <email>");
  console.error("Example: node scripts/setAdminClaim.js lorenzo.gallone@gmail.com");
  process.exit(1);
}

setAdmin(email).then(() => process.exit(0));
