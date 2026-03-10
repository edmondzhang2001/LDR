# OAuth setup: Sign in with Apple & Google

Follow these steps so **Sign in with Apple** and **Continue with Google** work end-to-end.

---

## 1. Backend `.env`

In the **backend** folder, copy the example env and edit:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at least:

| Variable | What to set |
|----------|------------------|
| `MONGODB_URI` | Your MongoDB URL (e.g. `mongodb://localhost:27017/duva`) |
| `JWT_SECRET` | Any long random string (e.g. `openssl rand -hex 32`) |
| `APPLE_CLIENT_ID` | Your **iOS app bundle identifier** (e.g. `com.anonymous.frontend` from `frontend/app.json` → `expo.ios.bundleIdentifier`) |
| `GOOGLE_CLIENT_ID` | Your **Google Web OAuth client ID** (from step 3 below; same value as frontend web client ID) |

Restart the backend after changing `.env`:

```bash
npm run dev
```

---

## 2. Sign in with Apple (iOS)

**A. Bundle ID**  
Your backend `APPLE_CLIENT_ID` must exactly match the app’s bundle ID. In `frontend/app.json` you have:

```json
"ios": {
  "bundleIdentifier": "com.anonymous.frontend"
}
```

So in **backend** `.env` use:

```
APPLE_CLIENT_ID=com.anonymous.frontend
```

**B. Enable the capability in Apple / Expo**

- In [Apple Developer](https://developer.apple.com/account/) → Identifiers → your App ID → enable **Sign in with Apple**.
- In Expo: if you use a custom dev client or EAS Build, ensure the Apple capability “Sign in with Apple” is enabled for that app (it often is by default when using `expo-apple-authentication`).

**C. Where to test**

- Sign in with Apple can be unreliable in the **simulator**. Prefer a **real device**.
- If you see “Invalid or expired sign-in token” after tapping Sign in with Apple, the backend is rejecting the token: double‑check `APPLE_CLIENT_ID` matches the bundle ID and that the backend was restarted after changing `.env`.

---

## 3. Google Sign-In

**A. Create OAuth client IDs**

1. Open [Google Cloud Console](https://console.cloud.google.com/) → your project (or create one).
2. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
3. If asked, configure the **OAuth consent screen** (e.g. External, app name, support email).
4. Create **two** OAuth client IDs:
   - **Application type: Web application**  
     - Name e.g. “Duva Web”.  
     - Copy the **Client ID** (ends with `.apps.googleusercontent.com`).  
     - Use this as **both**:
       - Backend: `GOOGLE_CLIENT_ID`
       - Frontend: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - **Application type: iOS**  
     - Name e.g. “Duva iOS”.  
     - Bundle ID: same as your app (e.g. `com.anonymous.frontend`).  
     - Copy the **Client ID**.  
     - Use this as: **Frontend**: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

**B. Backend `.env`**

```
GOOGLE_CLIENT_ID=<paste the Web client ID here>
```

**C. Frontend env (Expo)**

In the **frontend** folder, create a `.env` file (copy from example):

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<same Web client ID as backend>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS client ID from step 3A>
```

Expo only reads `EXPO_PUBLIC_*` at **build/start** time, so after changing `.env` you must **restart the dev server** and **reload the app** (or run `npm run ios` again).

---

## 4. Checklist

- [ ] **Backend** `.env`: `MONGODB_URI`, `JWT_SECRET`, `APPLE_CLIENT_ID`, `GOOGLE_CLIENT_ID` set; backend restarted.
- [ ] **Frontend** `.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` set; Expo restarted and app reloaded.
- [ ] Apple: Bundle ID in `app.json` matches `APPLE_CLIENT_ID`; Sign in with Apple enabled for that App ID; prefer testing on a real device.
- [ ] Google: Web and iOS OAuth clients created; Web client ID used for backend and frontend web; iOS client ID used for frontend iOS.

---

## 5. If something still fails

- **“Sign in with Apple” shows an error**  
  - Check backend logs when you tap the button. If you get a 401/503, the message and `details` (if any) explain what’s wrong.  
  - Confirm `APPLE_CLIENT_ID` = bundle ID and backend was restarted.  
  - Try on a real device.

- **“Continue with Google” does nothing or says not configured**  
  - Confirm `frontend/.env` has both `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.  
  - Restart Expo (`npm run ios` or restart the dev server), then open the app again so the new env is loaded.

- **Backend returns 401 “Invalid or expired sign-in token”**  
  - For Apple: wrong `APPLE_CLIENT_ID` or token from a different bundle ID.  
  - For Google: backend `GOOGLE_CLIENT_ID` must be the **Web** client ID, not the iOS one.
