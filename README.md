# Instally React Native SDK

Track clicks, installs, and revenue from every link you share. See which links actually drive installs and revenue for your React Native app. Pure JavaScript/TypeScript — no native modules required.

**[Website](https://instally.io)** | **[Documentation](https://docs.instally.io)** | **[Blog](https://instally.io/blog)** | **[Sign Up Free](https://app.instally.io/signup)**

## Installation

```bash
npm install instally-react-native @react-native-async-storage/async-storage
```

AsyncStorage is a peer dependency used for persisting attribution state across app launches.

## Quick Start

```tsx
import { instally } from 'instally-react-native';

// 1. Configure once on app startup
instally.configure({ appId: 'APP_ID_HERE', apiKey: 'API_KEY_HERE' });

// 2. Track install (safe to call every launch -- only runs once)
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

### `instally.isAttributed`

`boolean` -- whether this install was attributed to a tracking link.

### `instally.attributionId`

`string | null` -- the attribution ID, or null if not attributed.

## How It Works

The SDK collects non-identifying device signals (screen size, timezone, language, OS version) and sends them to the Instally API for probabilistic fingerprint matching against recent link clicks. No IDFA, no ATT prompt, no native modules.

## Requirements

- React Native 0.72+
- iOS 15+ / Android 5.0+

## Resources

- [Getting started guide](https://docs.instally.io/quick-start)
- [Instally website](https://instally.io)
- [Instally blog](https://instally.io/blog)

## License

MIT
