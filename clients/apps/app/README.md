# Polar App

iOS and Android app built with Expo and React Native.

## Run the App locally

Start the JavaScript bundle server:

```bash
pnpm start
```

## EAS

EAS (Expo Application Services) is used to compile and sign Android/iOS apps with custom native code in the cloud.

### Install the EAS CLI

```bash
npm install eas-cli -g
```

### Build profiles

Defined in `eas.json`:

| Profile       | Purpose                           | Channel       |
| ------------- | --------------------------------- | ------------- |
| `development` | Dev client with debug tools       | `development` |
| `simulator`   | iOS simulator build (extends dev) | `simulator`   |
| `preview`     | Internal testing (prod-like)      | `preview`     |
| `production`  | App Store / Play Store release    | `production`  |

### Creating a native build

```bash
# Simulator
eas build --platform ios --profile simulator

# Production (both platforms)
eas build --platform all --profile production
```

### Submitting a build to the App Store

```bash
# iOS
eas build --platform ios --profile production --auto-submit

# Android
eas build --platform android --profile production --auto-submit
```

## Over-the-Air (OTA) Updates

OTA updates let you push JavaScript/asset changes directly to users without going through app store review. They are powered by `expo-updates` and EAS Update.

### How it works

1. You run `eas update --channel <channel>`
2. Expo uploads the new JS bundle and assets to its CDN
3. When users open the app, it checks for updates in the background
4. The update is applied on the next app launch

### Testing an OTA update

After publishing an update, you need to **force close and reopen the app twice** to see the changes:

1. First open — the app detects and downloads the update in the background
2. Force close the app (swipe it away, don't just background it)
3. Second open — the downloaded update is applied

This is how `expo-updates` works by default: it downloads updates in the background and applies them on the next cold start.

### Publishing an OTA update

Publish through `pnpm ota`, **not** raw `eas update`. It runs a preflight guard
(`tooling/ota-preflight/`) that refuses to publish if the update can't safely
reach devices then forwards to `eas update` for you:

```bash
# Make sure you are on the main branch first
git checkout main

# Test on preview first if it's a larger change
pnpm ota --channel preview --message "Description of changes"

# Then push to production
pnpm ota --channel production --message "Description of changes"
```

The guard verifies, per platform, against the latest finished build on the channel:

1. **A build with the current runtime exists** otherwise the update would reach
   0 devices (the classic "I published but nothing changed" trap).
2. **The native layer matches that build** comparing fingerprints while ignoring
   pnpm's virtual-store path churn, so only _real_ native changes block you.

If it blocks, you need a new native build (see below) — not an OTA. Use
`--check-only` to run the checks without publishing.

### When to OTA vs native build

**OTA update** (instant, no app store review):

- JS/TS code changes (components, hooks, business logic)
- Style and layout changes
- Asset changes (images, fonts bundled in JS)
- Bug fixes in the JS layer
- API client updates

**Native build** (requires `eas build` + app store submission):

- Adding, removing, or upgrading a native module
- Changing `app.config.js` values that affect the native layer (permissions, entitlements, scheme, bundle identifier, etc.)
- Bumping the Expo SDK version
- Changing native splash screen config
- Adding new Expo plugins

**Rule of thumb:** if it changes native code, you need a build. If it's purely JS, use OTA.

### Preview builds

A preview build is a production-like build distributed internally to your team — no app store submission needed. It's used to test OTA updates before pushing them to real users.

**Creating a preview build:**

```bash
eas build --profile preview --platform ios
```

**Installing on a device:**

Internal distribution uses ad-hoc provisioning, so test devices need to be registered first:

```bash
eas device:create   # Register a new test device
eas build --profile preview --platform ios   # Rebuild with the device included
```

Once the build finishes, EAS gives you a URL. Open it on your phone to install directly (no TestFlight needed). For Android, you just download and install the APK.

You don't need to rebuild the preview build for every change — only when native code changes. Day-to-day, you push OTA updates to it via `pnpm ota --channel preview`.

### Recommended workflow

1. Make your JS changes
2. Push to preview: `pnpm ota --channel preview --message "Description"`
3. Open the preview build on your device and verify
4. Ship to users: `pnpm ota --channel production --message "Description"`

When making native changes (or if `pnpm ota` blocks you):

1. Bump `version` in `app.config.js`
2. Run `eas build --profile production`
3. Submit to app stores
4. Also rebuild preview: `eas build --profile preview` (so it picks up the new native code)
5. Subsequent OTA updates will target the new version
