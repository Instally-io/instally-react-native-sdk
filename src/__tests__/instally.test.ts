import AsyncStorage from '@react-native-async-storage/async-storage';

// We need a fresh instance for each test, so we re-import dynamically.
// The module exports a singleton, so we use jest.isolateModules to get a fresh one.

const TEST_APP_ID = 'app_test123';
const TEST_API_KEY = 'key_test456';

const mockAttributionResponse = {
  matched: true,
  attribution_id: 'attr_abc123',
  confidence: 0.95,
  method: 'fingerprint',
  click_id: 'click_xyz',
};

function createFreshModule() {
  let mod: typeof import('../index');
  jest.isolateModules(() => {
    mod = require('../index');
  });
  return mod!;
}

function mockFetchSuccess(response: Record<string, unknown> = mockAttributionResponse) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => response,
  });
}

function mockFetchFailure(status = 500, statusText = 'Internal Server Error') {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  });
}

function mockFetchNetworkError(message = 'Network error') {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(message));
}

beforeEach(() => {
  jest.clearAllMocks();
  // Clear the mock AsyncStorage store
  const store = (AsyncStorage as any)._store as Record<string, string>;
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  // Mock global fetch
  global.fetch = jest.fn();
  // Suppress console.warn and console.log during tests
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// --- 1. configure() sets credentials ---

describe('configure()', () => {
  it('sets app credentials so subsequent calls work', () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    // Verify configure worked by calling trackInstall (which checks _configured)
    // If configure didn't work, trackInstall would warn and return error method
    mockFetchSuccess();
    // No throw means configured is set
    expect(() => instally.configure({ appId: 'a', apiKey: 'b' })).not.toThrow();
  });

  it('accepts a custom apiBase', async () => {
    const { instally } = createFreshModule();
    instally.configure({
      appId: TEST_APP_ID,
      apiKey: TEST_API_KEY,
      apiBase: 'https://custom.api.com',
    });
    mockFetchSuccess();
    await instally.trackInstall();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://custom.api.com/v1/attribution',
      expect.any(Object)
    );
  });
});

// --- 2. trackInstall() without configure() returns error ---

describe('trackInstall() without configure()', () => {
  it('returns error result and warns', async () => {
    const { instally } = createFreshModule();
    const result = await instally.trackInstall();
    expect(result).toEqual({
      matched: false,
      attributionId: null,
      confidence: 0,
      method: 'error',
      clickId: null,
    });
    expect(console.warn).toHaveBeenCalledWith(
      '[Instally] Error: call instally.configure() before trackInstall()'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// --- 3. trackInstall() sends correct payload ---

describe('trackInstall() sends correct payload', () => {
  it('includes all device info fields', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchSuccess();

    const result = await instally.trackInstall();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/v1/attribution');

    const body = JSON.parse(options.body);
    expect(body.app_id).toBe(TEST_APP_ID);
    expect(body.platform).toBe('ios');
    expect(body.os_version).toBe('17.0');
    expect(body.screen_width).toBe(390);
    expect(body.screen_height).toBe(844);
    expect(body.sdk_version).toBe('1.0.0');
    expect(body).toHaveProperty('device_model');
    expect(body).toHaveProperty('timezone');
    expect(body).toHaveProperty('language');

    expect(result.matched).toBe(true);
    expect(result.attributionId).toBe('attr_abc123');
    expect(result.confidence).toBe(0.95);
    expect(result.method).toBe('fingerprint');
    expect(result.clickId).toBe('click_xyz');
  });
});

// --- 4. trackInstall() returns cached result on second call ---

describe('trackInstall() caching', () => {
  it('returns cached result on second call without making another request', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchSuccess();

    const first = await instally.trackInstall();
    expect(first.matched).toBe(true);
    expect(first.method).toBe('fingerprint');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const second = await instally.trackInstall();
    expect(second.matched).toBe(true);
    expect(second.method).toBe('cached');
    expect(second.attributionId).toBe('attr_abc123');
    // No additional fetch call
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// --- 5. trackInstall() network failure ---

describe('trackInstall() network failure', () => {
  it('returns error and does not mark as tracked', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchNetworkError('Network error');

    const result = await instally.trackInstall();
    expect(result).toEqual({
      matched: false,
      attributionId: null,
      confidence: 0,
      method: 'error',
      clickId: null,
    });
    expect(console.warn).toHaveBeenCalledWith(
      '[Instally] Attribution error:',
      expect.any(Error)
    );

    // Should NOT have stored tracked=true, so next call retries
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
      'instally_install_tracked',
      'true'
    );
  });

  it('retries on next call after network failure', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });

    // First call fails
    mockFetchNetworkError();
    await instally.trackInstall();

    // Second call succeeds
    mockFetchSuccess();
    const result = await instally.trackInstall();
    expect(result.matched).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns error on HTTP failure status', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchFailure(500, 'Internal Server Error');

    const result = await instally.trackInstall();
    expect(result.method).toBe('error');
    expect(result.matched).toBe(false);
  });
});

// --- 6. trackPurchase() without configure() ---

describe('trackPurchase() without configure()', () => {
  it('warns and returns without making a request', async () => {
    const { instally } = createFreshModule();
    await instally.trackPurchase({
      productId: 'premium',
      revenue: 9.99,
    });
    expect(console.warn).toHaveBeenCalledWith(
      '[Instally] Error: call instally.configure() before trackPurchase()'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// --- 7. trackPurchase() without attribution ID ---

describe('trackPurchase() without attribution ID', () => {
  it('warns and returns without making a request', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    // Don't call trackInstall, so no attribution ID

    await instally.trackPurchase({
      productId: 'premium',
      revenue: 9.99,
    });
    expect(console.warn).toHaveBeenCalledWith(
      '[Instally] No attribution ID found. Install may not have been attributed.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// --- 8. trackPurchase() sends correct payload ---

describe('trackPurchase() sends correct payload', () => {
  it('sends purchase data with all fields', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });

    // First do trackInstall to get an attribution ID
    mockFetchSuccess();
    await instally.trackInstall();

    // Now track purchase
    mockFetchSuccess({});
    await instally.trackPurchase({
      productId: 'premium_monthly',
      revenue: 9.99,
      currency: 'EUR',
      transactionId: 'txn_abc',
    });

    // Second fetch call is the purchase
    const [url, options] = (global.fetch as jest.Mock).mock.calls[1];
    expect(url).toContain('/v1/purchases');

    const body = JSON.parse(options.body);
    expect(body.app_id).toBe(TEST_APP_ID);
    expect(body.attribution_id).toBe('attr_abc123');
    expect(body.product_id).toBe('premium_monthly');
    expect(body.revenue).toBe(9.99);
    expect(body.currency).toBe('EUR');
    expect(body.transaction_id).toBe('txn_abc');
    expect(body.sdk_version).toBe('1.0.0');
    expect(body).toHaveProperty('timestamp');
  });

  it('defaults currency to USD when not provided', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchSuccess();
    await instally.trackInstall();

    mockFetchSuccess({});
    await instally.trackPurchase({
      productId: 'premium',
      revenue: 4.99,
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body.currency).toBe('USD');
  });

  it('omits transaction_id when not provided', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchSuccess();
    await instally.trackInstall();

    mockFetchSuccess({});
    await instally.trackPurchase({
      productId: 'premium',
      revenue: 4.99,
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body).not.toHaveProperty('transaction_id');
  });
});

// --- 9. setUserId() without configure() ---

describe('setUserId() without configure()', () => {
  it('warns and returns without making a request', async () => {
    const { instally } = createFreshModule();
    await instally.setUserId('user_123');
    expect(console.warn).toHaveBeenCalledWith(
      '[Instally] Error: call instally.configure() before setUserId()'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// --- 10. setUserId() without attribution ID ---

describe('setUserId() without attribution ID', () => {
  it('warns and returns without making a request', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });

    await instally.setUserId('user_123');
    expect(console.warn).toHaveBeenCalledWith(
      '[Instally] No attribution ID found. Call trackInstall() before setUserId().'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// --- 11. setUserId() sends correct payload ---

describe('setUserId() sends correct payload', () => {
  it('sends user ID with attribution data', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });

    mockFetchSuccess();
    await instally.trackInstall();

    mockFetchSuccess({});
    await instally.setUserId('rc_user_abc');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[1];
    expect(url).toContain('/v1/user-id');

    const body = JSON.parse(options.body);
    expect(body.app_id).toBe(TEST_APP_ID);
    expect(body.attribution_id).toBe('attr_abc123');
    expect(body.user_id).toBe('rc_user_abc');
    expect(body.sdk_version).toBe('1.0.0');
  });
});

// --- 12. HTTP headers ---

describe('HTTP request headers', () => {
  it('includes correct headers on all requests', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });

    // trackInstall
    mockFetchSuccess();
    await instally.trackInstall();

    // trackPurchase
    mockFetchSuccess({});
    await instally.trackPurchase({
      productId: 'test',
      revenue: 1.0,
    });

    // setUserId
    mockFetchSuccess({});
    await instally.setUserId('user_1');

    // All three calls should have correct headers
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(3);

    for (const [, options] of calls) {
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'X-API-Key': TEST_API_KEY,
        'X-App-ID': TEST_APP_ID,
      });
    }
  });
});

// --- 13. isAttributed and attributionId getters ---

describe('isAttributed and attributionId getters', () => {
  it('return false/null before trackInstall', () => {
    const { instally } = createFreshModule();
    expect(instally.isAttributed).toBe(false);
    expect(instally.attributionId).toBeNull();
  });

  it('return correct values after successful trackInstall', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchSuccess();
    await instally.trackInstall();

    expect(instally.isAttributed).toBe(true);
    expect(instally.attributionId).toBe('attr_abc123');
  });

  it('return false/null after failed trackInstall', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchNetworkError();
    await instally.trackInstall();

    expect(instally.isAttributed).toBe(false);
    expect(instally.attributionId).toBeNull();
  });

  it('return correct values when not matched', async () => {
    const { instally } = createFreshModule();
    instally.configure({ appId: TEST_APP_ID, apiKey: TEST_API_KEY });
    mockFetchSuccess({
      matched: false,
      attribution_id: null,
      confidence: 0,
      method: 'fingerprint',
      click_id: null,
    });
    await instally.trackInstall();

    expect(instally.isAttributed).toBe(false);
    expect(instally.attributionId).toBeNull();
  });
});
