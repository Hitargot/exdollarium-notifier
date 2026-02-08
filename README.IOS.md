iOS Development Guide — exdollarium-notifier

This guide shows how to develop and test the exdollarium mobile app on iOS (local macOS/Xcode or using Expo EAS Build). It assumes the project is an Expo-managed app with TypeScript/React Native.

Prerequisites
- macOS with Xcode 13+ (for local simulator or device builds)
- Node 18+ (match project's Node version)
- Yarn or npm
- Apple Developer account (paid) for device testing and TestFlight
- Expo CLI (optional) and EAS CLI if using EAS: npm i -g expo-cli eas-cli
- An Apple machine is required for direct simulator/device builds; otherwise use EAS Build from any platform.

1) Quick local development (recommended on mac)
- Open a terminal on mac
- Install dependencies:

```bash
cd path/to/exdollarium-notifier
npm install
# or yarn
```

- Start Metro (dev server):

```bash
npm start
# or expo start
```

- Open iOS simulator (Xcode -> Open Developer Tool -> Simulator) and press 'i' in the Metro terminal or use "Run on iOS simulator" from the Expo devtools.

2) If you need a local iOS build (native) for testing native modules (FCM/APNs)
- Configure bundle id in `app.json` or `app.config.ts` (look for `expo.ios.bundleIdentifier`).
- Ensure `GoogleService-Info.plist` (for Firebase iOS) is placed at `ios/GoogleService-Info.plist` or included via EAS config/plugin if using Expo prebuild.
- To run a native build (prebuild then Xcode):

```bash
# Prebuild native project (Expo) if using bare workflow
expo prebuild
# Open Xcode workspace
open ios/YourApp.xcworkspace
# Build & run from Xcode
```

3) EAS Build (recommended if you don't have mac)
- Login and configure eas:

```bash
eas login
eas whoami
```

- Configure your project:

```bash
eas build:configure
```

- Create an iOS dev build (development client):

```bash
eas build --platform ios --profile development
```

- Create an iOS production/TestFlight build:

```bash
eas build --platform ios --profile production
```

- Download the .ipa and install via TestFlight (recommended) or use `eas client` & `expo-dev-client` for local dev.

4) Push Notifications: APNs + Firebase (iOS specifics)
- iOS requires APNs credentials (Auth Key or p12) and Firebase setup.
- In Firebase console, add your iOS app bundle id and upload the `GoogleService-Info.plist`.
- In Apple Developer, create an APNs Auth Key and download the `.p8` file.
- For server FCM sends, either:
  - Use `firebase-admin` with a service account JSON (already used in backend) and ensure APNs is configured in Firebase; or
  - Configure APNs credentials in your server push library.
- For EAS: add credentials via `eas credentials` and link to your Apple account.

5) App-level code considerations
- `App.tsx` in this repo uses both Expo Notifications and @react-native-firebase/messaging. On iOS, ensure:
  - Firebase is initialized with `GoogleService-Info.plist`.
  - Request user permission for notifications (already present in code).
  - For foreground notifications, the code schedules an Expo local notification; background handling may require native code (APNs) or EAS dev client.

6) Troubleshooting
- "Cannot find Pressable" or TypeScript errors: run `npm run tsc` or `npm run lint` and fix imports.
- If FCM token not returned on iOS: ensure `GoogleService-Info.plist` is present and APNs configured in Firebase, and device has notification permissions.
- If EAS builds fail, run `eas build -p ios --non-interactive --profile development --local` for verbose logs.

7) Useful commands
- Start dev server: `npm start` or `expo start`
- Run TypeScript checks: `npm run tsc` (if configured)
- EAS login: `eas login`
- EAS build: `eas build --platform ios --profile development`

If you want, I can:
- Add an `ios/` prebuild & xcode workspace setup (but requires mac to run), or
- Walk you through creating an EAS dev build and configuring Apple/Firebase creds step-by-step.

Which path do you prefer? (Local mac development with Xcode, or EAS Build + TestFlight?)
