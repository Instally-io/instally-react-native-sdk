package io.instally.reactnative;

import androidx.annotation.NonNull;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.util.concurrent.atomic.AtomicBoolean;

public class InstallyInstallReferrerModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    InstallyInstallReferrerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "InstallyInstallReferrer";
    }

    @ReactMethod
    public void getInstallReferrer(Promise promise) {
        InstallReferrerClient client = InstallReferrerClient.newBuilder(reactContext).build();
        AtomicBoolean settled = new AtomicBoolean(false);

        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                if (!settled.compareAndSet(false, true)) {
                    client.endConnection();
                    return;
                }

                WritableMap result = Arguments.createMap();
                result.putInt("responseCode", responseCode);

                if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                    try {
                        String referrer = client.getInstallReferrer().getInstallReferrer();
                        result.putString("installReferrer", referrer);
                        promise.resolve(result);
                    } catch (Exception error) {
                        promise.reject("INSTALLY_REFERRER_READ_FAILED", error);
                    } finally {
                        client.endConnection();
                    }
                    return;
                }

                client.endConnection();
                result.putNull("installReferrer");
                promise.resolve(result);
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                if (!settled.compareAndSet(false, true)) {
                    return;
                }

                WritableMap result = Arguments.createMap();
                result.putNull("installReferrer");
                result.putString("error", "Install referrer service disconnected");
                promise.resolve(result);
            }
        });
    }
}
