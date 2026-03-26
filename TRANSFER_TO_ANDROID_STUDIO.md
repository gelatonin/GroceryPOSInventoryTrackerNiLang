# Android Studio Transfer Guide (Management App)

This folder is already prepared to import as an Android Studio project:

- `android-management-wrapper/`

## Copy these files/folders

Transfer the whole `android-management-wrapper` folder, but **exclude**:

- `.gradle/`
- `.idea/`
- `local.properties`
- `build/` (if it appears later)
- `app/build/` (if it appears later)

## Required project files (must exist)

- `settings.gradle`
- `build.gradle`
- `gradle.properties`
- `app/build.gradle`
- `app/proguard-rules.pro`
- `app/src/main/AndroidManifest.xml`
- `app/src/main/java/com/grocery/management/MainActivity.kt`
- `app/src/main/res/layout/activity_main.xml`
- `app/src/main/res/values/strings.xml`
- `app/src/main/res/values/themes.xml`
- `app/src/main/res/xml/network_security_config.xml`

## Import steps in Android Studio

1. Open Android Studio.
2. Click **Open**.
3. Select the `android-management-wrapper` folder.
4. Wait for Gradle sync.
5. Run app on emulator/device.

## Important URL setup (Management page)

In `MainActivity.kt`, set the server URL:

- Emulator talking to local PC server: `http://10.0.2.2:3000/management.html`
- Physical phone on same Wi-Fi: `http://<YOUR_PC_LOCAL_IP>:3000/management.html`

Example:

`http://192.168.1.50:3000/management.html`

## Backend reminder

This Android app is a WebView wrapper. Your Node server (`server.js`) and MongoDB must still be running and reachable from the phone/emulator.
