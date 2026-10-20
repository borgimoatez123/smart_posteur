# SmartPosture Mobile App - Product Requirements Document

## Overview

- **Summary**: Build **SmartPosture**, a production-quality React Native (Expo) + TypeScript mobile companion app for an ESP32-based wearable posture monitor. The app connects to the wearable over BLE, displays live posture data received from the device, supports calibration, configuration, and local history/statistics.
- **Purpose**: Help users improve sitting posture by providing real-time feedback, haptic alerts, and historical trends — driven entirely by data from the ESP32 wearable.
- **Target Users**: End users wearing the SmartPosture device and developers integrating with the ESP32 firmware.

## Goals

- Provide a premium, modern health-tech wearable companion experience (not a generic dashboard).
- Display **actual** posture data (class, roll, pitch, duration, battery, alerts) streamed from the ESP32 over BLE.
- Implement a guided calibration workflow that delegates calibration to the ESP32 and confirms only on device acknowledgment.
- Persist posture sessions and settings locally and compute good-posture statistics correctly.
- Deliver a clean, well-separated architecture (UI / state / BLE service / persistence / types) that survives real-world BLE edge cases.
- Provide clear empty/error/disconnected states and never fabricate sensor measurements.

## Non-Goals

- Posture classification or inference on the mobile side (exclusively the ESP32's responsibility).
- Cloud/backend synchronization (history is local-only unless explicitly added later).
- Medical diagnosis or treatment claims.
- Reimplementing the ESP32 firmware or defining final BLE UUIDs (UUIDs are placeholders until firmware is finalized).

## Background & Context

- Hardware: ESP32/ESP32-S3 + MPU6050 (accel/gyro) on upper back + vibration motor + BLE. Optional battery, status LED, physical button.
- The ESP32 performs sensor processing and posture classification locally; the app is a display/configuration/control client.
- Posture classes: `GOOD_POSTURE`, `SLOUCHING`, `LEAN_LEFT`, `LEAN_RIGHT`, `HEAD_FORWARD`, `UNKNOWN`.
- Proposed live payload (example, not final firmware): `{ version, posture, roll, pitch, confidence, bad_duration, battery, alert, timestamp }`. Optional fields are nullable and treated as unavailable when absent.
- BLE requires an Expo development build (not Expo Go) for `react-native-ble-plx`.

## Functional Requirements

### FR-1 Onboarding

- Introduce SmartPosture, sensor wearing/positioning, and the non-medical disclaimer.
- Guide BLE permission grant and device pairing.
- Allow skipping onboarding (skip persisted so it is not shown again).

### FR-2 Home Dashboard

- Show connection status (Connected / Connecting / Disconnected).
- Show current posture class with color-coded status card (green=good, orange/red=slouching, warning for lean/head-forward, neutral for unknown).
- Show relative Roll & Pitch in degrees, current poor-posture episode duration, battery (if available), today's alert count, today's good-posture percentage.
- Show a live posture timeline / recent measurement chart.
- Distinguish unavailable measurements from zero (nullable rendering).

### FR-3 Device Pairing & Connection

- Scan for nearby SmartPosture devices, show name/id/RSSI.
- Connect / disconnect with indicators; reconnection on unexpected drop.
- Show firmware version and battery if the device provides them.
- Clear permission and connection error messages. Never claim connected unless BLE connect succeeds.

### FR-4 Live Monitoring

- Show current posture, roll/pitch, classification, episode duration, last measurement timestamp, scrolling angle chart, haptic-alert indicator.
- Update from BLE notifications without re-rendering the whole app.
- Empty state when no device is connected (no simulated data).

### FR-5 Calibration

- Guided steps: wear sensor → sit neutral → start calibration → send command to ESP32 → show progress only from device messages → receive & save reference angles → confirm only on device ack.
- Handle cancel, timeout, sensor errors, disconnection.
- Support recalibration and display latest calibration timestamp.
- App must not claim it calibrated the sensor by itself.

### FR-6 Alerts & Settings

- Configure: poor-posture persistence delay (presets 5/10/20/30s), vibration on/off, alert sensitivity (if firmware supports), daily/session reminders, notification preferences, measurement units, dark/light theme, clear local history, reconnection preferences.
- Send supported config changes to ESP32 over BLE and show apply status. Do not imply app-side changes automatically alter firmware.

### FR-7 History & Statistics

- Daily summaries: good-posture %, good/poor time, counts per posture class, haptic alert count, historical angle charts.
- Daily and weekly filters.
- Good-posture % = good-posture duration / total classified posture duration × 100; exclude UNKNOWN and missing data.
- Persist locally; clearly state history is local-only.

### FR-8 Profile & About

- Display name, basic preferences, wearable device info, app version, privacy info, project explanation, medical disclaimer.

### FR-9 BLE Service Layer

- Dedicated service (not in UI components) for scan, connect/disconnect, characteristic discovery, notification subscription, parse+validate, command write, reconnection, cleanup.
- Central config file for service/characteristic UUIDs (clearly marked placeholders).
- Characteristics for: live measurements, device status/battery, calibration commands/results, alert config, haptic test (if supported).
- Versioned JSON payload with schema validation; handle malformed messages safely.
- Prevent duplicate subscriptions; clean up listeners on unmount.

### FR-10 Data Model

- Typed models for: posture enum, live measurement, device connection state, calibration status & reference angles, alert settings, historical sessions, daily/weekly stats.
- Nullable values for firmware-unsupported fields.

### FR-11 Persistence

- AsyncStorage for settings and history.
- Handle storage failures gracefully.
- Local-only history with clear indication.

### FR-12 Reliability & Edge Cases

- Handle: BT disabled, missing permissions, device not found, failed connection, unexpected disconnect, missing/invalid measurements, unsupported characteristics, calibration timeout, app background/foreground, empty history, storage failures, devices without battery/confidence.
- No random sensor data in production; any simulator must be explicit dev-only and labeled.

## Non-Functional Requirements

- **NFR-1 TypeScript strict mode** enforced across the project.
- **NFR-2 Clean separation**: presentation, state, BLE, persistence, types/utilities in distinct layers.
- **NFR-3 UI consistency**: rounded cards, subtle shadows, readable typography, accessible touch targets, responsive layouts; dark navy/white/teal palette with green/orange/red posture semantics; light & dark themes.
- **NFR-4 Performance**: live updates from BLE do not re-render the whole app; selective subscription.
- **NFR-5 No fabricated data**: UI only renders values received from the device or persisted locally.
- **NFR-6 Error/empty/loading/disconnected states** are explicit and distinct.

## Constraints

- **Technical**: Expo managed/dev build with `react-native-ble-plx`; TypeScript strict; Expo Router; React Native Paper; Zustand; AsyncStorage; a charting lib (e.g., react-native-svg-based).
- **Business**: App is a posture-awareness tool, not a medical device; disclaimer present.
- **Dependencies**: BLE requires a development build; Android/iOS Bluetooth permissions must be configured.

## Assumptions

- BLE UUIDs are placeholders in a central config until firmware finalizes them.
- The ESP32 emits a versioned JSON payload as proposed; schema is validated on receive.
- Optional fields (confidence, battery) are nullable when not provided.
- History is computed only from locally persisted records.
- A dev-only simulator may exist but is gated behind an explicit flag and labels all data as simulated.

## Acceptance Criteria

### AC-1: Onboarding flow is skippable and persisted

- **Type**: `rule`
- **Given**: A fresh install
- **When**: The user opens the app and completes or skips onboarding
- **Then**: Onboarding does not reappear on subsequent launches
- **Pass Condition**: Skip/completion flag persisted in AsyncStorage and checked on app start
- **Evidence**: Code path in `app/index.tsx` or root layout reads the persisted flag and routes accordingly

### AC-2: Home dashboard renders posture data from device only

- **Type**: `rule`
- **Given**: A connected device streaming posture data
- **When**: A posture payload is received
- **Then**: The dashboard updates posture class, roll, pitch, duration, and alert count from the payload; no random/fallback values are generated
- **Pass Condition**: Dashboard source values come from the posture store populated by BLE notifications; no `Math.random` or hardcoded mock values in production paths
- **Evidence**: Inspection of `PostureStatusCard`, store, and BLE parse pipeline

### AC-3: Connection state reflects real BLE status

- **Type**: `rule`
- **Given**: BLE hardware available
- **When**: The user scans and connects to a device
- **Then**: Connection state is `Connecting` during the handshake and `Connected` only after a successful BLE connection; `Disconnected` on drop or failure
- **Pass Condition**: Connection status is derived from actual `react-native-ble-plx` connection state, not assumed
- **Evidence**: `BleManager` connection flow and `deviceStore` state transitions

### AC-4: Nullable fields render as unavailable, not zero

- **Type**: `rule`
- **Given**: A payload with `battery: null` and `confidence: null`
- **When**: The dashboard renders
- **Then**: Battery and confidence show an "unavailable"/"—" indicator, not `0`
- **Pass Condition**: Nullable fields render a non-zero placeholder when null
- **Evidence**: Rendering components check `=== null` / `== null` and show placeholder text

### AC-5: Calibration confirms only on device acknowledgment

- **Type**: `rule`
- **Given**: A calibration flow started
- **When**: The app sends a calibrate command
- **Then**: Success is shown only after the ESP32 returns a calibration-ack message; timeout/error states are handled
- **Pass Condition**: Calibration success state is set exclusively by a received calibration-result characteristic notification, not by the write completing
- **Evidence**: `useCalibration` and BLE protocol handler

### AC-6: Good-posture percentage excludes UNKNOWN and missing data

- **Type**: `rule`
- **Given**: A history with GOOD, SLOUCHING, and UNKNOWN segments
- **When**: Statistics are computed
- **Then**: good% = good_duration / (good_duration + poor_duration) × 100, with UNKNOWN excluded from the denominator
- **Pass Condition**: Statistic util matches the formula; UNKNOWN segments omitted from classified duration
- **Evidence**: `statistics.ts` unit logic and a computed example

### AC-7: BLE UUIDs are centrally configurable placeholders

- **Type**: `rule`
- **Given**: The BLE config file
- **When**: A developer reads it
- **Then**: All service/characteristic UUIDs live in one config file and are clearly marked as placeholders to be replaced with firmware values
- **Pass Condition**: UUIDs imported from a single `BleConfig`; no magic UUID literals scattered elsewhere
- **Evidence**: `BleConfig.ts` contents and grep for UUID literals outside it

### AC-8: Incoming BLE payloads are schema-validated

- **Type**: `rule`
- **Given**: A malformed or unknown-shape BLE payload
- **When**: The BLE service parses it
- **Then**: The payload is rejected (logged) and not written to the store; well-formed payloads are accepted
- **Pass Condition**: A validation function (e.g., Zod or equivalent) runs on every parsed payload before store update
- **Evidence**: `validation.ts` / protocol parser and error handling

### AC-9: Settings persistence survives app restart

- **Type**: `rule`
- **Given**: User changes vibration toggle and persistence delay
- **When**: The app is restarted
- **Then**: The settings retain their values
- **Pass Condition**: Settings are persisted to AsyncStorage on change and rehydrated on launch
- **Evidence**: `settingsStore` + `SettingsStorage` read/write paths

### AC-10: UI states are distinct (loading/empty/error/disconnected)

- **Type**: `rule`
- **Given**: No device connected and no history
- **When**: Viewing the relevant screen
- **Then**: Each screen shows an explicit empty/disconnected state rather than blank or zero-filled UI
- **Pass Condition**: EmptyState and disconnected components render for their respective conditions
- **Evidence**: Presence and usage of `EmptyState`, loading, and error components

### AC-11: Light and dark themes are supported

- **Type**: `rule`
- **Given**: Theme toggle in settings
- **When**: The user switches theme
- **Then**: The app's colors switch between light and dark palettes consistently
- **Pass Condition**: A theme provider with two palettes drives UI colors; toggle persists preference
- **Evidence**: `theme/colors.ts` and theme provider/context

### AC-12: No random sensor data in production code paths

- **Type**: `rule`
- **Given**: The production build
- **When**: The app runs
- **Then**: No posture/angle/battery values are generated randomly or hardcoded as real device data
- **Pass Condition**: Any simulated data is behind an explicit `__DEV__`/simulator flag and labeled "Simulated" in the UI
- **Evidence**: Grep for `Math.random` in non-test code and simulator flag usage

### AC-13: Architecture separation is maintained

- **Type**: `rubric`
- **Dimension**: Layer separation and dependency direction
- **Scale**: 1-5
- **Anchors**: 1 = BLE logic inside components, no separation; 3 = some separation but UI still calls BLE directly; 5 = clear layers (components → hooks/store → services → types/utils) with no leaks
- **Pass Threshold**: >= 4
- **Evidence**: Directory structure and import direction inspection

### AC-14: UI quality as a wearable companion app

- **Type**: `rubric`
- **Dimension**: Visual polish and health-tech aesthetic
- **Scale**: 1-5
- **Anchors**: 1 = bare default components; 3 = functional but generic; 5 = polished cards, color semantics, typography, accessible, looks like a real wearable app
- **Pass Threshold**: >= 4
- **Evidence**: Screenshot / visual inspection of dashboard, live, and settings screens

### AC-15: Code compiles under TypeScript strict with no type errors

- **Type**: `rule`
- **Given**: The project source
- **When**: `tsc --noEmit` runs
- **Then**: No type errors are reported
- **Pass Condition**: `tsc --noEmit` exits 0
- **Evidence**: Command output

### AC-16: App builds and starts (Expo dev build metadata valid)

- **Type**: `rule`
- **Given**: `package.json`, `app.json`, and `tsconfig.json`
- **When**: Dependencies installed and `expo start` runs
- **Then**: The app compiles and the dev server starts without crashing
- **Pass Condition**: `expo start` reports the dev server is ready and bundles without fatal errors
- **Evidence**: Dev server startup log (note: BLE needs a development build on a physical device, verified at build config level)

## Open Questions

- [ ] Final BLE service/characteristic UUIDs from the ESP32 firmware (use placeholders until then).
- [ ] Exact calibration command/response payload shape from firmware (use a proposed schema; validate on receive).
- [ ] Whether confidence field is ever provided by firmware (kept nullable).
- [ ] Whether haptic test command and alert sensitivity are supported by firmware (feature-gated).
