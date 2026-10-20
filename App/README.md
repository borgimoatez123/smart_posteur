# SmartPosture

A React Native (Expo) + TypeScript mobile companion app for an ESP32-based wearable posture monitor. The app connects to the wearable over BLE, displays live posture data, supports calibration, alert configuration, and stores local history/statistics.

## Features

- **BLE Device Pairing** — Scan for and connect to the SmartPosture wearable.
- **Live Posture Monitoring** — Real-time posture class, roll/pitch angles, battery, and confidence.
- **Rolling Angle Chart** — 120-sample rolling chart of roll and pitch.
- **Calibration** — Initiate device calibration; success is confirmed only by an ESP32 ack notification.
- **Alert Configuration** — Configure haptic alert angle thresholds and test the haptic motor.
- **History & Statistics** — Daily/weekly good-posture percentage (excludes `UNKNOWN` segments).
- **Theming** — Light & dark themes with navy/teal palette and green/orange/red posture semantics.
- **Dev Simulator** — `__DEV__`-gated posture simulator for testing without hardware.

## Architecture

Clean Architecture layering (dependency flow is one-directional):

```
Components (app/, src/components/)
  → Hooks (src/hooks/)
    → Stores (src/store/)
      → Services (src/services/)
        → Types & Utils (src/types/, src/utils/)
```

| Layer | Path | Responsibility |
|-------|------|---------------|
| Types | `src/types/` | Domain types and enums (`posture.ts`, `device.ts`, `ble.ts`, `settings.ts`) |
| Theme | `src/theme/` | Color palettes, typography, `ThemeProvider`, `useAppTheme()` |
| Services | `src/services/ble/` | `BleManager` (react-native-ble-plx wrapper), `BleProtocol` (subscribe/write) |
| Services | `src/services/storage/` | `SettingsStorage`, `HistoryStorage` (AsyncStorage) |
| Services | `src/services/dev/` | `PostureSimulator` (dev-only) |
| Stores | `src/store/` | Zustand stores: `deviceStore`, `postureStore`, `settingsStore`, `calibrationStore` |
| Hooks | `src/hooks/` | `useBleDevice`, `usePostureData`, `useCalibration` |
| Utils | `src/utils/` | `validation.ts` (Zod), `angleUtils.ts`, `statistics.ts`, `blePermissions.ts` |
| Components | `src/components/` | `PostureStatusCard`, `ConnectionStatus`, `AngleCard`, `BatteryCard`, `PostureChart`, `StatisticCard`, `EmptyState`, `LoadingState` |

### Key Design Decisions

- **No posture classification on the app.** The ESP32 classifies posture; the app only displays what the device sends.
- **Nullable fields render as "—".** Battery and confidence are nullable; `null` is never rendered as `0`.
- **BLE is isolated in a service layer.** UI components never call `react-native-ble-plx` directly; they go through `useBleDevice` → `BleManager`/`BleProtocol`.
- **UUIDs are centralized.** All BLE UUIDs live in `src/services/ble/BleConfig.ts` as placeholders.
- **Calibration success is set only by an ESP32 ack.** `useCalibration` does not mark success on write completion.
- **Good-posture % excludes `UNKNOWN`** and missing segments from the denominator.
- **Simulated data is dev-only**, gated behind `__DEV__`, and labeled "Simulated".
- **TypeScript strict mode** with Zod schema validation for all BLE payloads.

## Getting Started

### Prerequisites

- Node.js 18+
- A physical iOS or Android device (BLE is not available on simulators/emulators)
- Expo Go **will not work** — this app uses native BLE modules (`react-native-ble-plx`). You must use a **development build**.

### Install Dependencies

```bash
npm install
```

### Run the Dev Server

```bash
npx expo start
```

Then open the app on your device via the development build (see below).

### Create a Development Build

Because this app requires native BLE modules, you must build a custom dev client:

**Android:**
```bash
npx expo run:android
# or with EAS:
npx eas build --profile development --platform android
```

**iOS:**
```bash
npx expo run:ios
# or with EAS:
npx eas build --profile development --platform ios
```

Install the resulting build on your device, then run `npx expo start` and connect via the dev client.

## Configuration

### BLE UUIDs

All BLE service and characteristic UUIDs are defined as placeholders in [src/services/ble/BleConfig.ts](src/services/ble/BleConfig.ts). Replace them with the UUIDs that match your ESP32 firmware:

```ts
export const BleServiceUuid = 'YOUR-SERVICE-UUID';

export const BleCharacteristicUuids = {
  postureMeasurement: 'YOUR-POSTURE-UUID',
  deviceStatus: 'YOUR-STATUS-UUID',
  calibration: 'YOUR-CALIBRATION-UUID',
  alertConfig: 'YOUR-ALERT-UUID',
  hapticTest: 'YOUR-HAPTIC-UUID',
};
```

### Device Name Prefix

`BleDeviceNamePrefix` (default `'SmartPosture'`) is used to filter scan results. Update it to match your device's advertised name.

### Protocol

`BleProtocolVersion` is sent in command payloads so the device can validate compatibility.

## BLE Protocol Overview

All characteristic values are UTF-8 JSON strings, base64-encoded for transport (as required by `react-native-ble-plx`).

### Notifications (device → app)

| Characteristic | Payload |
|---------------|---------|
| `postureMeasurement` | `{ postureClass, roll, pitch, battery, confidence, timestamp }` |
| `deviceStatus` | `{ batteryLevel, signalStrength, firmwareVersion }` |
| `calibration` | `{ success, referenceRoll, referencePitch }` (ack) |

### Writes (app → device)

| Characteristic | Payload |
|---------------|---------|
| `calibration` | `{ command: 'calibrate', protocolVersion }` |
| `alertConfig` | `{ command: 'setAlerts', rollThreshold, pitchThreshold, protocolVersion }` |
| `hapticTest` | `{ command: 'hapticTest', protocolVersion }` |

## Development

### Dev Simulator

On the **Device** tab, a **Simulate Posture** toggle is available when `__DEV__` is true. This generates synthetic posture data for testing without hardware. Simulated measurements are labeled in the UI and never written to persisted history.

### Type Checking

```bash
npx tsc --noEmit
```

## Project Structure

```
.
├── app/                      # Expo Router routes
│   ├── _layout.tsx
│   ├── index.tsx             # Redirect (onboarding vs tabs)
│   ├── onboarding.tsx
│   ├── calibration.tsx
│   ├── profile.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx         # Home
│       ├── live.tsx
│       ├── history.tsx
│       ├── device.tsx
│       └── settings.tsx
├── src/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   │   ├── ble/
│   │   ├── storage/
│   │   └── dev/
│   ├── store/
│   ├── theme/
│   ├── types/
│   └── utils/
├── app.json
├── babel.config.js
├── package.json
└── tsconfig.json
```

## License

Internal project.
