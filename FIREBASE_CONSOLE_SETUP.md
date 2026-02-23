# 🔔 Firebase Console Setup — Push Notifications

Everything below must be done **manually** in the [Firebase Console](https://console.firebase.google.com/project/fanta-f1-bfb7b) before push notifications will work.

---

## 1. Upgrade to Blaze Plan (Required for Cloud Functions)

Cloud Functions **cannot** run on the free Spark plan.

1. Go to **Firebase Console** → your project (`fanta-f1-bfb7b`)
2. Click the ⚙️ gear icon (bottom left) → **Usage and billing**
3. Click **Modify plan** → Select **Blaze (pay-as-you-go)**
4. Add a payment method (credit/debit card)

> **💰 Cost:** For this use case (2 scheduled functions, ~40 invocations/day), you'll stay well within the free tier. Expected monthly cost: **$0.00**.

---

## 2. Enable Cloud Messaging & Generate VAPID Key

1. Go to **Firebase Console** → **Project Settings** (gear icon)
2. Click the **Cloud Messaging** tab
3. Scroll down to **Web Push certificates**
4. Click **Generate key pair**
5. Copy the generated **public key** (it looks like a long base64 string)
6. Paste it into your `.env` file:

```env
VITE_FIREBASE_VAPID_KEY=your-generated-public-key-here
```

---

## 3. Secure Service Worker Setup (`firebase-messaging-sw.js`)

Firebase Cloud Messaging requires a Service Worker file (`public/firebase-messaging-sw.js`) to handle notifications in the background.

**⚠️ CRITICAL SECURITY WARNING:**
Never hardcode your Firebase API keys directly into `public/firebase-messaging-sw.js`. Service workers are publicly accessible and cannot use Vite's `import.meta.env` without a dedicated build step, which means your keys would be exposed in plaintext to anyone inspecting the source code.

**How we handle this securely:**

1. The file `public/firebase-messaging-sw.js` has been explicitly added to `.gitignore` to prevent accidental commits of sensitive data.
2. We initialize the service worker with an empty `firebaseConfig` object.
3. In a future implementation, the main React thread (which _can_ securely read `.env` variables during the build process) will pass the configuration to the service worker via `postMessage` or URL parameters during the Service Worker Registration phase, OR the service worker will fetch a minimal, restricted config from a secure backend route.

_Do not commit any API keys to this file._

---

## 4. Deploy Cloud Functions

After completing steps 1 and 2, install the Cloud Functions dependencies and deploy:

```bash
# Install Cloud Functions dependencies
cd functions && npm install && cd ..

# Deploy everything (hosting + functions + firestore rules)
npm run build && firebase deploy
```

Or deploy only the functions:

```bash
firebase deploy --only functions
```

You should see two functions deployed in the Firebase Console → **Functions** tab:

- `sendQualiReminder1h` (runs every 10 minutes)
- `sendQualiReminder5min` (runs every 1 minute)

---

## 5. Deploy Firestore Rules

The updated rules include the new `notificationsSent` collection. Deploy them:

```bash
firebase deploy --only firestore:rules
```

---

## 6. Verify Everything Works

### Quick Checklist:

- [ ] Firebase project is on **Blaze plan**
- [ ] VAPID key is generated and added to `.env`
- [ ] Cloud Functions are deployed and visible in Firebase Console → Functions
- [ ] Firestore rules are deployed
- [ ] App is built and deployed (`npm run build && firebase deploy --only hosting`)

### Test Notifications:

1. Open your deployed app on a phone
2. Install it as a PWA (Add to Home Screen)
3. Open the app from the Home Screen
4. Tap the user menu (top right) → toggle **Notifications** ON
5. Accept the browser permission prompt
6. Verify the FCM token appears in Firestore → `users/{yourUserId}` → `fcmTokens` field

### End-to-End Test:

To test an actual notification without waiting for a qualifying session:

1. Open Firestore in Firebase Console
2. Find a race document, temporarily change `qualiUTC` to ~5 minutes from now
3. Wait for the `sendQualiReminder5min` function to trigger
4. You should receive a push notification on your device!
5. **Remember to change the date back** after testing

---

## 7. iOS Users — Important Notes

Push notifications on iOS have these requirements:

- **iOS 16.4+** is mandatory
- The app **must** be installed to the Home Screen (PWA mode)
- The user **must** open the app from the Home Screen icon
- The user **must** explicitly enable notifications via the toggle

If an iOS user doesn't see the notification toggle, they're likely opening the app in Safari (not as installed PWA). The `InstallPwaBanner` component already prompts them to install.

---

## Architecture Summary

```
User enables notifications (PWA)
    → Browser requests permission
    → FCM returns a device token
    → Token saved to Firestore /users/{uid}.fcmTokens

Cloud Function runs on schedule (every 1-10 min)
    → Reads /races for upcoming qualifying sessions
    → Checks /notificationsSent for deduplication
    → Sends FCM multicast to all tokens
    → Marks notification as sent
    → Cleans up expired/invalid tokens

Device receives push
    → firebase-messaging-sw.js shows native notification
    → User taps → app opens to /lineup page
```
