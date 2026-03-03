# App Overview
We are building a premium, long-distance relationship iOS app. The goal is to keep partners connected with spontaneous updates. The architecture should prioritize simplicity, stability, and standard industry practices over complex hyper-scalability. 

# Tech Stack
* **Frontend:** Expo (Managed Workflow using `@bacons/apple-targets` for native widgets).
* **Navigation:** Expo Router.
* **State Management:** Zustand.
* **Authentication:** `expo-apple-authentication` and `@react-native-google-signin/google-signin`.
* **Backend:** Node.js with Express.
* **Backend Auth Verification:** `google-auth-library` and `apple-signin-auth`.
* **Database:** MongoDB (using Mongoose).
* **Storage:** AWS S3 (Standard `@aws-sdk/client-s3`).
* **Push Notifications:** Firebase Cloud Messaging (FCM) / APNs using Silent Pushes to trigger widget updates.
* **Native iOS:** Swift, WidgetKit (iOS Widget), App Intents (Shortcuts/Back Tap).

# UI/UX Theme
* **Vibe:** Cute, cozy, coherent.
* **Colors:** Soft pastel palette (warm blush pinks, soft sky blues, creamy whites).
* **Styling:** Highly rounded corners (border-radius: 20+), soft drop shadows, playful typography, smooth animations.

# Core Architecture & Features

## 1. Authentication & Pairing
* **OAuth Exclusively:** Users authenticate using only "Sign in with Apple" or "Google Sign-In". No passwords are saved or used.
* **Auth Flow:** The Expo frontend handles the native Apple/Google sign-in to get an identity token. It sends this token to the Express backend. The backend verifies the token directly with Google/Apple, finds or creates the user, and issues a standard JWT for the app session.
* **Pairing:** User A generates a 6-digit code, User B enters it to link accounts into a `Couple` document. 

## 2. Partner Dashboard (Main App Screen)
* Displays partner's local time, weather (via OpenWeatherMap), battery %, and location (City).
* Use `expo-background-fetch` and `expo-location` to periodically ping stats to the backend.

## 3. Communication & Pictures
* **Flow:** User takes a photo -> App fetches an S3 pre-signed URL from Express -> App uploads directly to AWS S3 -> App tells Express it's done -> Express saves to MongoDB and sends a Silent Push to partner -> Partner's iOS Widget updates.

## 4. Shared Countdown Calendar
* Shared calendar for the next "Reunion Date" featuring a cute progress bar (two avatars moving closer together).

## 5. Native iOS Integrations
* **WidgetKit:** Displays partner's local time, weather icon, battery %, and the most recent picture. 
* **App Intents:** An iOS Shortcut integration allowing a user to "Back Tap" their iPhone to snap a photo and instantly trigger the upload.

# Database Schemas (Mongoose)
1. **User:** `_id`, `email` (can be hidden/proxied by Apple), `oauthProvider` (enum: 'apple', 'google'), `oauthId` (unique sub/ID from provider), `partnerId` (ref: User), `batteryLevel`, `location` (city/coords), `pushToken`, `lastUpdatedDataAt`. *(Note: password field removed).*
2. **Couple:** `_id`, `user1` (ref: User), `user2` (ref: User), `pairedAt`.
3. **Post:** `_id`, `coupleId` (ref: Couple), `senderId`, `type` (enum: 'image', 'text'), `content` (image URL), `createdAt`. 
4. **Countdown:** `_id`, `coupleId`, `title`, `reunionDate`, `createdAt`.