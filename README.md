# Instally React Native SDK

Track clicks, installs, and revenue from every link you share. See which links actually drive installs and revenue for your React Native app.

![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-black)
![React Native](https://img.shields.io/badge/react--native-0.72%2B-blue)
![License](https://img.shields.io/badge/license-MIT-black)

**[Website](https://instally.io)** | **[Documentation](https://docs.instally.io)** | **[Dashboard](https://app.instally.io)**

## Features

- TypeScript SDK with no custom native Instally module
- Per-link install and revenue tracking
- No IDFA, ATT prompt, or GAID
- Webhook integrations with RevenueCat, Superwall, Adapty, Qonversion, and Stripe
- TypeScript types included

## Installation

```bash
npm install github:Instally-io/instally-react-native-sdk @react-native-async-storage/async-storage
```

AsyncStorage is a peer dependency used for persisting attribution state across app launches. In bare React Native apps, run `cd ios && pod install` after installing.

## Quick Start

```tsx
import { instally } from 'instally-react-native';

instally.configure({ appId: 'APP_ID_HERE', apiKey: 'API_KEY_HERE' });

const result = await instally.trackInstall();
console.log('Attributed:', result.matched);
```

Your `appId` and `apiKey` are available in your [Instally dashboard](https://app.instally.io).

## Track Purchases

Call after every successful in-app purchase:

```tsx
await instally.trackPurchase({
  productId: 'premium_monthly',
  revenue: 9.99,
  currency: 'USD',
  transactionId: 'txn_123',
});
```

## Link a User ID

If you use RevenueCat or another subscription platform, link the user ID so server-side webhooks can attribute purchases automatically:

```tsx
await instally.setUserId(Purchases.appUserID);
```

## Check Attribution

Synchronous getters are available after `trackInstall()` completes:

```tsx
instally.isAttributed;  // boolean
instally.attributionId; // string | null
```

## Testing Attribution

Development builds are supported. For the cleanest test, click the tracking link
once on the same physical device you open the app on, then launch the app within
a few minutes.

Avoid repeated clicks before opening the app. Multiple recent unmatched clicks
from the same device or network can be treated as ambiguous and return
`matched=false`.

`trackInstall()` is cached per app install, including `matched=false` results.
When retrying on the same dev build, uninstall/reinstall the app or clear the SDK
cache in development:

```tsx
if (__DEV__) {
  await instally.resetForTesting();
}
```

## API Reference

### `instally.configure(opts)`

| Parameter | Type     | Required | Description                     |
|-----------|----------|----------|---------------------------------|
| appId     | string   | Yes      | Your app ID from the dashboard  |
| apiKey    | string   | Yes      | Your API key from the dashboard |

### `instally.trackInstall()`

Returns `Promise<AttributionResult>`:

```ts
interface AttributionResult {
  matched: boolean;
  attributionId: string | null;
  confidence: number;
  method: string;
  clickId: string | null;
}
```

### `instally.trackPurchase(opts)`

| Parameter     | Type   | Required | Default | Description           |
|---------------|--------|----------|---------|-----------------------|
| productId     | string | Yes      |         | Product identifier    |
| revenue       | number | Yes      |         | Purchase amount       |
| currency      | string | No       | "USD"   | ISO 4217 currency     |
| transactionId | string | No       |         | Platform transaction  |

### `instally.setUserId(userId: string)`

Links an external user ID to the attribution.

### `instally.resetForTesting()`

Clears cached install attribution state from AsyncStorage. Use this in
development test flows only.

### `instally.isAttributed`

`boolean` -- whether this install was attributed to a tracking link.

### `instally.attributionId`

`string | null` -- the attribution ID, or null if not attributed.

## FAQ

### Do I need to show an ATT prompt on iOS?

No. The SDK does not request the IDFA, so iOS does not require the ATT prompt.

### Does it work with Expo?

Yes. The SDK has no custom native Instally module. The only peer dependency is `@react-native-async-storage/async-storage`, which works with Expo Go and bare React Native projects.

### Does it work with RevenueCat or Stripe?

Yes. Call `instally.setUserId(...)` with your subscription-platform user ID,
then configure the Instally webhook. Revenue events are matched back to the link
that drove the install.

### What's the bundle impact?

Small — pure JS/TS, with AsyncStorage as the only peer dependency. No additional permissions added to the host app.

### Where can I see my data?

Real-time dashboard at [app.instally.io](https://app.instally.io) — clicks, installs, revenue, per-link breakdown.

## Requirements

- React Native 0.72+
- iOS 15+ / Android 5.0+

## Learn More

- [Instally vs AppsFlyer vs Branch](https://instally.io/blog/instally-vs-appsflyer-vs-branch)
- [Track App Installs From YouTube, TikTok, and Instagram](https://instally.io/blog/track-app-installs-youtube-tiktok-instagram)

## Resources

- [Instally Website](https://instally.io)
- [Dashboard](https://app.instally.io)
- [Documentation](https://docs.instally.io)
- [Pricing](https://instally.io/pricing)
- [Blog](https://instally.io/blog)

### Other SDKs

- [iOS SDK](https://github.com/Instally-io/instally-ios-sdk)
- [Android SDK](https://github.com/Instally-io/instally-android-sdk)
- [Flutter SDK](https://github.com/Instally-io/instally-flutter-sdk)

## License

MIT
