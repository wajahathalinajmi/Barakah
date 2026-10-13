# Barakah for Android

Barakah for Android is a small native Android app shell around the Barakah web app. It opens the same live tracker in a secure WebView, so users sign in with their existing Supabase email and password and continue using the same account data. The Android app does not create a second account system or copy tracker records to a separate database.

## Current Android additions

- Native app icon and Android app entry point
- Loading and offline retry states
- Safe opening of links outside the Barakah site in the device browser
- Native Android share sheet for the generated milestone poster images
- Native poster files are shared through a temporary, read-only `content://` URI

The Rewards area is part of the shared tracker. It calculates streaks from the account's existing daily habit logs: a day counts when at least one intention is marked complete. It awards badges at 3, 7, 14, 30, 60, and 100 consecutive days. Posters include Barakah branding; a name is optional and off by default. No database migration is needed.

## Open and run

1. Install Android Studio and the Android 16 (API 36) SDK.
2. Open this `android` folder as a project in Android Studio and allow Gradle sync. The project includes the Gradle 9.1 wrapper and downloads the AndroidX dependencies on first sync.
3. Run the `app` configuration on an Android device or emulator. The device needs internet access to sign in and sync.
4. For a release APK or Play Store bundle, use **Build > Generate Signed App Bundle or APK** and create a signing key that you keep private.

Project settings: Java 17, Android Gradle Plugin 9.0.0, Gradle 9.1, compile/target SDK 36, minimum SDK 24. AndroidX WebKit uses an origin-restricted message bridge for poster sharing. If AndroidX WebKit does not support that bridge on a device, use the website in Chrome to share or download posters.

## Data and privacy

- Authentication and habit records stay with the existing Supabase project and row-level security policies.
- The Android app requires internet access; offline check-ins are not queued for later sync.
- Shared posters contain only the selected milestone, day count, and Barakah branding by default. The user's name can be opted into from the Rewards screen.
- The Android project contains only the Supabase **publishable** key through the shared website. A service-role key must never be added to the app.
