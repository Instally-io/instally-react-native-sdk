// Instally React Native SDK
// Track clicks, installs, and revenue from every link.
// https://instally.io

import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Types ---

export interface AttributionResult {
  matched: boolean;
  attributionId: string | null;
  confidence: number;
  method: string;
  clickId: string | null;
}

export interface ConfigureOptions {
  appId: string;
  apiKey: string;
  apiBase?: string;
}

export interface TrackPurchaseOptions {
  productId: string;
  revenue: number;
  currency?: string;
  transactionId?: string;
}

// --- Storage keys ---

const STORAGE_KEYS = {
  TRACKED: 'instally_install_tracked',
  MATCHED: 'instally_matched',
  ATTRIBUTION_ID: 'instally_attribution_id',
} as const;

// --- SDK ---

class Instally {
  private _appId: string | null = null;
  private _apiKey: string | null = null;
  private _apiBase = 'https://us-central1-instally-5f6fd.cloudfunctions.net/api';
  private _configured = false;
  private _isAttributed = false;
  private _attributionId: string | null = null;
  private _loaded = false;

  private static readonly SDK_VERSION = '1.0.0';

  /**
   * Configure Instally with your app credentials.
   * Call this once on app startup.
   *
   * ```ts
   * import { instally } from 'instally-react-native';
   *
   * instally.configure({ appId: 'app_xxx', apiKey: 'key_xxx' });
   * ```
   */
  configure(opts: ConfigureOptions): void {
    this._appId = opts.appId;
    this._apiKey = opts.apiKey;
    if (opts.apiBase) this._apiBase = opts.apiBase;
    this._configured = true;

    // Load cached state in background
    this.loadCachedState();
  }

  /**
   * Track install attribution. Safe to call on every launch — only runs once per install.
   *
   * ```ts
   * const result = await instally.trackInstall();
   * console.log('Matched:', result.matched);
   * ```
   */
  async trackInstall(): Promise<AttributionResult> {
    if (!this._configured) {
      console.warn('[Instally] Error: call instally.configure() before trackInstall()');
      return { matched: false, attributionId: null, confidence: 0, method: 'error', clickId: null };
    }

    // Check if already tracked
    const tracked = await AsyncStorage.getItem(STORAGE_KEYS.TRACKED);
    if (tracked === 'true') {
      const cached: AttributionResult = {
        matched: (await AsyncStorage.getItem(STORAGE_KEYS.MATCHED)) === 'true',
        attributionId: await AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION_ID),
        confidence: 0,
        method: 'cached',
        clickId: null,
      };
      this._isAttributed = cached.matched;
      this._attributionId = cached.attributionId;
      return cached;
    }

    const { width, height } = Dimensions.get('screen');

    const payload: Record<string, unknown> = {
      app_id: this._appId,
      platform: Platform.OS,
      device_model: this.getDeviceModel(),
      os_version: Platform.Version?.toString() ?? 'unknown',
      screen_width: Math.round(width),
      screen_height: Math.round(height),
      timezone: this.getTimezone(),
      language: this.getLanguage(),
      sdk_version: Instally.SDK_VERSION,
    };

    try {
      const json = await this.post('/v1/attribution', payload);
      const result: AttributionResult = {
        matched: json.matched ?? false,
        attributionId: json.attribution_id ?? null,
        confidence: json.confidence ?? 0,
        method: json.method ?? 'unknown',
        clickId: json.click_id ?? null,
      };

      // Persist
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKED, 'true');
      await AsyncStorage.setItem(STORAGE_KEYS.MATCHED, result.matched ? 'true' : 'false');
      if (result.attributionId) {
        await AsyncStorage.setItem(STORAGE_KEYS.ATTRIBUTION_ID, result.attributionId);
      }

      // Update in-memory state
      this._isAttributed = result.matched;
      this._attributionId = result.attributionId;

      console.log(
        `[Instally] Install attribution: matched=${result.matched}, confidence=${result.confidence}, method=${result.method}`
      );

      return result;
    } catch (error) {
      console.warn('[Instally] Attribution error:', error);
      // Don't mark as tracked so it retries next launch
      return { matched: false, attributionId: null, confidence: 0, method: 'error', clickId: null };
    }
  }

  /**
   * Track an in-app purchase attributed to the install.
   *
   * ```ts
   * await instally.trackPurchase({
   *   productId: 'premium_monthly',
   *   revenue: 9.99,
   *   currency: 'USD',
   *   transactionId: 'txn_123',
   * });
   * ```
   */
  async trackPurchase(opts: TrackPurchaseOptions): Promise<void> {
    if (!this._configured) {
      console.warn('[Instally] Error: call instally.configure() before trackPurchase()');
      return;
    }

    const attributionId = this._attributionId ?? (await AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION_ID));
    if (!attributionId) {
      console.warn('[Instally] No attribution ID found. Install may not have been attributed.');
      return;
    }

    const payload: Record<string, unknown> = {
      app_id: this._appId,
      attribution_id: attributionId,
      product_id: opts.productId,
      revenue: opts.revenue,
      currency: opts.currency ?? 'USD',
      timestamp: new Date().toISOString(),
      sdk_version: Instally.SDK_VERSION,
    };
    if (opts.transactionId) {
      payload.transaction_id = opts.transactionId;
    }

    try {
      await this.post('/v1/purchases', payload);
      console.log(`[Instally] Purchase tracked: ${opts.productId} ${opts.revenue} ${opts.currency ?? 'USD'}`);
    } catch (error) {
      console.warn('[Instally] Purchase tracking error:', error);
    }
  }

  /**
   * Link an external user ID (e.g. RevenueCat appUserID) to this install's attribution.
   * This allows server-side integrations (webhooks) to attribute purchases automatically.
   *
   * ```ts
   * await instally.setUserId(Purchases.appUserID);
   * ```
   */
  async setUserId(userId: string): Promise<void> {
    if (!this._configured) {
      console.warn('[Instally] Error: call instally.configure() before setUserId()');
      return;
    }

    const attributionId = this._attributionId ?? (await AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION_ID));
    if (!attributionId) {
      console.warn('[Instally] No attribution ID found. Call trackInstall() before setUserId().');
      return;
    }

    try {
      await this.post('/v1/user-id', {
        app_id: this._appId,
        attribution_id: attributionId,
        user_id: userId,
        sdk_version: Instally.SDK_VERSION,
      });
      console.log(`[Instally] User ID linked: ${userId}`);
    } catch (error) {
      console.warn('[Instally] setUserId error:', error);
    }
  }

  /**
   * Whether this install was attributed to a tracking link.
   * Returns the cached in-memory value. Call trackInstall() first to populate.
   */
  get isAttributed(): boolean {
    return this._isAttributed;
  }

  /**
   * The attribution ID for this install, or null if not attributed.
   * Returns the cached in-memory value. Call trackInstall() first to populate.
   */
  get attributionId(): string | null {
    return this._attributionId;
  }

  // --- Private helpers ---

  private async loadCachedState(): Promise<void> {
    if (this._loaded) return;
    try {
      const [matched, attrId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.MATCHED),
        AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION_ID),
      ]);
      this._isAttributed = matched === 'true';
      this._attributionId = attrId;
      this._loaded = true;
    } catch {
      // Ignore — values will be populated after trackInstall()
    }
  }

  private getDeviceModel(): string {
    if (Platform.OS === 'ios') {
      // On iOS, Platform.constants provides the model
      return (Platform as any).constants?.systemName
        ? `${(Platform as any).constants.systemName}`
        : 'iPhone';
    }
    if (Platform.OS === 'android') {
      const constants = (Platform as any).constants;
      if (constants?.Model) return constants.Model;
      if (constants?.Brand) return constants.Brand;
    }
    return 'unknown';
  }

  private getTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'unknown';
    }
  }

  private getLanguage(): string {
    try {
      if (Platform.OS === 'ios') {
        const settings = (Platform as any).constants?.localeIdentifier;
        if (settings) return settings;
      }
      // Fallback to Intl
      return Intl.DateTimeFormat().resolvedOptions().locale ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async post(endpoint: string, payload: Record<string, unknown>): Promise<any> {
    const response = await fetch(`${this._apiBase}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this._apiKey ?? '',
        'X-App-ID': this._appId ?? '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

/** Singleton Instally instance. */
export const instally = new Instally();
export default instally;
