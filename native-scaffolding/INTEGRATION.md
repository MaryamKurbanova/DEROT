# UNROT — Native intercept scaffolding

The JS app owns the **60-second wall UI**, **access pass** timing, and **activity** flows.  
System-level **launch detection** must be implemented in native code and bridge into JS via the stub `UnrotIntercept` module (`src/lib/interceptBridge.ts`).

## Behavior contract

1. Emit an event **only when** a monitored distraction app transitions to the foreground (cold start or resume), matching the user rule: *no wall while the user remains inside the same distraction session*.
2. **Per-app passes**: each distraction has its own hour-long window after a ritual. Before opening the wall, resolve the app id (`tiktok`, `instagram`, … — see `distractionApps.ts`) and only present the UI if `shouldShowFocusWallForApp(appId)` is true (AsyncStorage). From JS, call **`requestInterceptWall(appId)`** from `src/lib/wallBridge.ts` whenever the user tries to enter a monitored app; Home registers the handler that opens the modal when needed.
3. After the user completes **0:00**, JS calls `grantAccessPassForApp(appId)`. Native should then **dismiss the overlay** and bring the user **back into the app they attempted to open** (the same package/bundle you intercepted).
4. Overlay the wall using **your** host activity (Android) or **Shield / Managed Settings** (iOS) — a plain RN `Modal` is only suitable inside UNROT itself; production blocking uses the platform APIs below.

## iOS — FamilyControls / Screen Time

- **Capabilities**: add `Family Controls` and sign with a **development team** provisioning profile that supports this entitlement.
- **Frameworks**: `FamilyControls`, `ManagedSettings`, `DeviceActivity` (exact combination depends on whether you use shields, schedules, or picker UI).
- **Picker**: `FamilyActivityPicker` lets the user choose which apps count as “distractions” (you can still seed with bundle IDs from `src/lib/distractionApps.ts`).
- **Authorization**: request `AuthorizationCenter.shared.requestAuthorization(for: .individual)` before reading schedules / shields.
- **Implementation sketch**: a **Device Activity Monitor** extension detects schedule boundaries; when a shielded app is opened, iOS applies the shield UI. Replace default shield copy with a deep link into UNROT’s focus wall if policy allows, or show minimal shield text pointing back to UNROT.

> Apple treats Screen Time APIs strictly. Test on real devices; Expo Go cannot ship these entitlements — use **EAS Build** + **custom native code**.

## Android — Accessibility Service + (optional) SYSTEM_ALERT_WINDOW

1. **Accessibility service**  
   - Declare a service in `AndroidManifest.xml` with `android:accessibilityFeedbackType`, `canRetrieveWindowContent`, and `android:accessibilityEventTypes` including `typeWindowStateChanged`.  
   - In `onAccessibilityEvent`, read `event.packageName` and compare to `androidPackage` values in `distractionApps.ts`.  
   - **Debounce**: fire “launch” only when the package changes **to** a target from a non-target (or from home), not on every window content event while inside TikTok.

2. **Overlay (optional)**  
   - Request `SYSTEM_ALERT_WINDOW` / “display over other apps”.  
   - Show a **transparent full-screen** host activity or `TYPE_APPLICATION_OVERLAY` window that draws the React Native surface (or native countdown matching UNROT spec).

3. **Alternatives**  
   - Device-owner / MDM APIs are overkill for consumers.  
   - **UsageStatsManager** can approximate “app opened” but needs special permission UX and polling; Accessibility is the usual bridge for friction apps.

### Manifest hints (merge into `android/app/src/main/AndroidManifest.xml` after `expo prebuild`)

```xml
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" tools:ignore="ProtectedPermissions" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

<service
  android:name=".UnrotAccessibilityService"
  android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
  android:exported="false">
  <intent-filter>
    <action android:name="android.accessibilityservice.AccessibilityService" />
  </intent-filter>
  <meta-data
    android:name="android.accessibilityservice"
    android:resource="@xml/unrot_accessibility_config" />
</service>
```

`res/xml/unrot_accessibility_config.xml` should set `canRetrieveWindowContent="true"` and appropriate `accessibilityEventTypes`.

## Native module stub

Implement `NativeModules.UnrotIntercept` with:

- `requestAuthorization()` → `Promise<boolean>`
- Optional `getMonitoredIds()` → JSON string array of packages/bundles.
- Events: `onDistractionLaunch` with `{ distractionId, nativeId }` aligned with `AppLaunchPayload` in `interceptBridge.ts`.

Wire `subscribeDistractionLaunches` to a `NativeEventEmitter` once the module exists.
