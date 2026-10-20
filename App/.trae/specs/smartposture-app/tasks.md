# SmartPosture Mobile App - Implementation Plan

## Completion Evidence

All 18 tasks are complete. Verification results:

- **TR-1.1 / TR-18.1 (tsc)**: `npx tsc --noEmit` exits 0 (verified).
- **TR-1.2 / TR-18.2 (build)**: `npx expo start --no-dev --minify` Metro bundler reports "Android Bundled ... (1268 modules)" and `index.bundle` returns HTTP 200 (~2.5MB). No fatal errors.
- **TR-2.1 / AC-7 (UUID centralization)**: Grep for UUID-like strings across `src/` finds matches **only** in `src/services/ble/BleConfig.ts`.
- **TR-2.2 (Zod validation)**: `src/utils/validation.ts` exports Zod schemas for `LivePostureMeasurement`, `DeviceStatus`, `CalibrationResult`, and `AlertConfigAck`; `tryParseLivePosture` returns null on invalid input.
- **TR-4.4 / TR-18.3 / AC-12 (no fabrication)**: Grep for `Math.random` across `src/` finds matches **only** in `src/services/dev/PostureSimulator.ts`, which is gated behind `__DEV__`. No hardcoded posture values in production paths.
- **TR-4.5 / TR-18.4 / AC-13 (architecture)**: Clean layering — components/hooks call stores; stores call services (BleManager/BleProtocol/storage); services depend only on types/utils. UI never calls `react-native-ble-plx` directly.
- **AC-5 (calibration ack-only success)**: `useCalibration.ts` starts a timeout but only `calibrationStore.setResult` (called from the calibration notification handler in `BleProtocol.ts`) sets success; write completion does not.
- **AC-6 (good-posture % excludes UNKNOWN)**: `computeDailyStats` / `averageGoodPosturePercent` in `src/utils/statistics.ts` filter out `UNKNOWN` and null segments from both numerator and denominator.
- **AC-4 (nullable rendering)**: `formatAngle`, `formatBattery` in `src/utils/angleUtils.ts` return "—" for null; `AngleCard`/`BatteryCard` render "—".
- **AC-16 (dev build requirement)**: `app.json` includes the `react-native-ble-plx` config plugin; README states Expo Go cannot run BLE.

## Tasks

## Task 1: Project scaffolding and configuration

- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Initialize Expo project with TypeScript strict mode, Expo Router, React Native Paper, Zustand, AsyncStorage, react-native-ble-plx, react-native-svg, and a charting library.
  - Create `package.json`, `app.json` (with Android/iOS BLE permissions + config plugins), `tsconfig.json` (strict), `babel.config.js`, `index.ts` entry, and `.gitignore`.
  - Install all dependencies and verify the dev server starts.
- **Acceptance Criteria Addressed**: AC-15, AC-16
- **Test Requirements**:
  - `rule` TR-1.1: `tsc --noEmit` exits 0 (AC-15)
  - `rule` TR-1.2: `expo start` dev server reports ready and bundles without fatal errors (AC-16)
  - `rule` TR-1.3: `app.json` declares Android `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`/`ACCESS_FINE_LOCATION` (or API-level equivalents) and iOS `NSBluetoothAlwaysUsageDescription` (BLE permission config)
- **Notes**: BLE requires a development build; verify config-plugin presence in `app.json`.

## Task 2: Foundation — theme, types, config, and validation utilities

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - `src/theme/colors.ts` (light/dark palettes: dark navy, white, teal; green/orange/red posture semantics) and `src/theme/typography.ts`.
  - `src/types/posture.ts` (PostureClass enum, LivePostureMeasurement, PostureEpisode), `src/types/device.ts` (DeviceInfo, ConnectionState), `src/types/ble.ts` (BleDevice, BlePayload schemas), `src/types/settings.ts` (AlertSettings, AppSettings).
  - `src/services/ble/BleConfig.ts` — central service/characteristic UUID placeholders, clearly marked.
  - `src/utils/validation.ts` — Zod schemas for live payload, calibration result, settings; parse helpers.
  - `src/utils/angleUtils.ts` — angle formatting, roll/pitch helpers.
- **Acceptance Criteria Addressed**: AC-4, AC-7, AC-8, AC-11
- **Test Requirements**:
  - `rule` TR-2.1: All UUID literals live only in `BleConfig.ts`; grep finds none elsewhere (AC-7)
  - `rule` TR-2.2: Zod schema rejects a payload missing required `posture`/`roll`/`pitch`/`timestamp` and accepts the example payload (AC-8)
  - `rule` TR-2.3: `colors.ts` exports both `light` and `dark` palettes with posture semantic colors (AC-11)
  - `rule` TR-2.4: Type model marks `battery`, `confidence`, and other optional fields as nullable (AC-4)
- **Notes**: Use Zod for schema validation per project conventions.

## Task 3: State stores (Zustand) with persistence hydration

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `src/store/deviceStore.ts` — connection state, selected device, firmware version, battery, RSSI, scan results.
  - `src/store/postureStore.ts` — current posture measurement, live history buffer, today's stats (alert count, good %).
  - `src/store/settingsStore.ts` — alert settings, theme, units, onboarding-complete flag, with AsyncStorage hydration.
  - `src/services/storage/SettingsStorage.ts` and `HistoryStorage.ts` — AsyncStorage read/write with error handling.
- **Acceptance Criteria Addressed**: AC-1, AC-9
- **Test Requirements**:
  - `rule` TR-3.1: Onboarding-complete flag is read from storage on app start and gates the root route (AC-1)
  - `rule` TR-3.2: Settings changes are persisted to AsyncStorage and rehydrated on store init (AC-9)
  - `rubric` TR-3.3: Store separation; scale 1-5; anchors 1=single monolithic store, 3=split but cross-mutating, 5=clean single-responsibility stores; threshold >= 4
- **Notes**: Keep store actions pure; BLE service writes to stores, not vice versa.

## Task 4: BLE service layer and protocol

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2, Task 3
- **Description**:
  - `src/services/ble/BleManager.ts` — singleton wrapping `react-native-ble-plx`: scan, connect, disconnect, discover services/characteristics, subscribe to notifications, write commands, reconnection, cleanup. Emits typed events.
  - `src/services/ble/BleProtocol.ts` — encode/decode commands (calibrate, set alert config, haptic test) and parse notifications via Zod validation; route to stores.
  - `src/hooks/useBleDevice.ts` — scan/connect/disconnect lifecycle, permission checks, error mapping.
  - `src/hooks/usePostureData.ts` — subscribe to live posture notifications, update posture store, maintain a bounded rolling buffer for the chart.
  - `src/hooks/useCalibration.ts` — send calibrate command, wait for ack, handle timeout/cancel/disconnect.
- **Acceptance Criteria Addressed**: AC-3, AC-5, AC-8, AC-12
- **Test Requirements**:
  - `rule` TR-4.1: Connection state transitions to `Connected` only on BLE connect success; `Connecting` during handshake (AC-3)
  - `rule` TR-4.2: Calibration success flag set only on a received calibration-result notification, not on write completion (AC-5)
  - `rule` TR-4.3: Malformed payloads are logged and not written to the posture store (AC-8)
  - `rule` TR-4.4: No `Math.random` or hardcoded posture values exist in the BLE/protocol code (AC-12)
  - `rubric` TR-4.5: BLE layer isolation; scale 1-5; anchors 1=BLE calls in components, 3=hooks but manager leaks, 5=UI→hooks→manager→protocol→store with no reverse deps; threshold >= 4
- **Notes**: BleManager must prevent duplicate subscriptions and clean up on disconnect/unmount.

## Task 5: Statistics and history utilities

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `src/utils/statistics.ts` — compute good-posture %, good/poor durations, per-class counts, daily/weekly aggregation from persisted sessions. Exclude UNKNOWN and null segments.
  - `HistoryStorage` session model: append posture episodes keyed by date; query by day/week.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-5.1: For sessions {good: 60s, slouching: 40s, unknown: 20s}, good% = 60/(60+40)\*100 = 60% (AC-6)
  - `rule` TR-5.2: UNKNOWN segments are excluded from both numerator and denominator (AC-6)
- **Notes**: Provide a pure function so it is unit-testable.

## Task 6: Reusable UI components

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `PostureStatusCard.tsx` — color-coded by posture class, shows class name, icon, episode duration.
  - `ConnectionStatus.tsx` — Connected/Connecting/Disconnected badge.
  - `AngleCard.tsx` — roll/pitch with degree unit; renders "—" for null.
  - `PostureChart.tsx` — scrolling line chart of recent roll/pitch from the rolling buffer.
  - `StatisticCard.tsx` — label + value + optional unit.
  - `EmptyState.tsx`, `LoadingState.tsx` — consistent empty/loading states.
- **Acceptance Criteria Addressed**: AC-2, AC-4, AC-10
- **Test Requirements**:
  - `rule` TR-6.1: `AngleCard` renders "—" (or "N/A") when value is null, never `0` (AC-4)
  - `rule` TR-6.2: `PostureStatusCard` background color maps: GOOD→green, SLOUCHING→red/orange, LEAN\_\*→warning, HEAD_FORWARD→warning, UNKNOWN→neutral (AC-2)
  - `rule` TR-6.3: Empty and loading states render distinct, non-blank content (AC-10)
- **Notes**: All components consume theme via React Native Paper theme / context.

## Task 7: Root layout, navigation, and theme provider

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 6
- **Description**:
  - `app/_layout.tsx` — Expo Router root, theme provider (light/dark from settingsStore), React Native Paper provider, safe area.
  - `app/index.tsx` — initial route: if onboarding not complete → onboarding; else → tabs home.
  - `app/(tabs)/_layout.tsx` — tab bar (Home, Live, History, Device, Settings).
- **Acceptance Criteria Addressed**: AC-1, AC-11
- **Test Requirements**:
  - `rule` TR-7.1: Fresh state routes to onboarding; after onboarding-complete persisted, routes to tabs (AC-1)
  - `rule` TR-7.2: Toggling theme in settings updates the provider and all screens switch palette (AC-11)
- **Notes**: Use stable tab icons and labels.

## Task 8: Onboarding screen

- **Status**: `completed`
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - `app/onboarding.tsx` — multi-step or single-page intro: purpose, sensor placement, non-medical disclaimer, BLE permission prompt, pairing hint, skip button.
  - On complete or skip → set onboarding-complete in settingsStore → navigate to tabs.
- **Acceptance Criteria Addressed**: AC-1, AC-10
- **Test Requirements**:
  - `rule` TR-8.1: Skip and Complete both persist onboarding-complete and navigate to home (AC-1)
  - `rule` TR-8.2: Non-medical disclaimer text is present (AC-10 / content requirement)
- **Notes**: Keep text concise; accessible.

## Task 9: Home Dashboard screen

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 6, Task 7
- **Description**:
  - `app/(tabs)/index.tsx` — PostureStatusCard, ConnectionStatus, AngleCard(s) for roll/pitch, episode duration, battery (or unavailable), today's alert count, today's good-posture %, PostureChart (recent timeline).
  - Pulls from postureStore and deviceStore. Shows disconnected/empty state when not connected.
- **Acceptance Criteria Addressed**: AC-2, AC-4, AC-10, AC-14
- **Test Requirements**:
  - `rule` TR-9.1: Dashboard values come from store (populated by BLE); no mock/hardcoded posture values in the screen (AC-2)
  - `rule` TR-9.2: When not connected, shows disconnected/empty state, not zero-filled data (AC-10)
  - `rubric` TR-9.3: Dashboard visual quality; scale 1-5; anchors 1=default list, 3=usable cards, 5=polished health-tech dashboard; threshold >= 4 (AC-14)
- **Notes**: Today's good-posture % computed via statistics util from today's persisted sessions.

## Task 10: Device pairing & connection screen

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 4, Task 6, Task 7
- **Description**:
  - `app/(tabs)/device.tsx` — scan list (name, id, RSSI), connect/disconnect buttons, scanning/connecting indicators, firmware version + battery if provided, reconnection hint, permission/error messages.
  - Uses `useBleDevice`.
- **Acceptance Criteria Addressed**: AC-3, AC-10
- **Test Requirements**:
  - `rule` TR-10.1: Connect action triggers real BLE connect; connection state shown only on actual success (AC-3)
  - `rule` TR-10.2: Missing permission / BT-off shows a clear error message with a resolution hint (AC-10)
- **Notes**: Never auto-claim connected.

## Task 11: Live Monitoring screen

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 4, Task 6, Task 7
- **Description**:
  - `app/(tabs)/live.tsx` — current posture, roll/pitch, classification, episode duration, last measurement timestamp, scrolling angle chart, haptic-alert indicator.
  - Subscribes via `usePostureData`; updates only on new notifications.
  - Empty state when not connected.
- **Acceptance Criteria Addressed**: AC-2, AC-4, AC-10
- **Test Requirements**:
  - `rule` TR-11.1: Chart updates only from BLE notifications; no simulated real-time data when disconnected (AC-2)
  - `rule` TR-11.2: Null angles render unavailable (AC-4)
  - `rule` TR-11.3: Disconnected state shows empty state, not a blank chart (AC-10)
- **Notes**: Use memoized chart updates to avoid full-app re-renders.

## Task 12: Calibration screen

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 4, Task 6, Task 7
- **Description**:
  - `app/calibration.tsx` — guided steps: wear → sit neutral → start → progress (from device messages only) → receive reference angles → confirm on ack → show latest calibration timestamp; recalibrate action.
  - Handles cancel, timeout, sensor error, disconnection.
- **Acceptance Criteria Addressed**: AC-5, AC-10
- **Test Requirements**:
  - `rule` TR-12.1: Success screen appears only after a calibration-ack notification; write completion alone does not show success (AC-5)
  - `rule` TR-12.2: Timeout, cancel, and disconnect each show a distinct, accurate error state (AC-10)
- **Notes**: Reference angles persisted with timestamp.

## Task 13: Alerts & Settings screen

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 3, Task 6, Task 7
- **Description**:
  - `app/(tabs)/settings.tsx` — persistence delay presets (5/10/20/30s), vibration toggle, alert sensitivity (if supported), reminders, notification preferences, units, theme toggle, clear history, reconnection preference.
  - Supported settings are sent to ESP32 via BLE; show per-setting apply status.
- **Acceptance Criteria Addressed**: AC-9, AC-11
- **Test Requirements**:
  - `rule` TR-13.1: Theme toggle persists and affects app theme (AC-11)
  - `rule` TR-13.2: Settings persist to AsyncStorage and survive restart (AC-9)
  - `rule` TR-13.3: Clear history removes persisted sessions (AC-9)
- **Notes**: Do not imply firmware changed unless BLE write ack succeeds.

## Task 14: History & Statistics screen

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 5, Task 6, Task 7
- **Description**:
  - `app/(tabs)/history.tsx` — daily summaries (good %, good/poor time, per-class counts, alert count), historical angle charts, daily/weekly filter.
  - Uses statistics util and HistoryStorage. Empty state when no data.
- **Acceptance Criteria Addressed**: AC-6, AC-10
- **Test Requirements**:
  - `rule` TR-14.1: Good-posture % matches the formula (UNKNOWN excluded) for displayed days (AC-6)
  - `rule` TR-14.2: No-data state renders a clear empty state (AC-10)
- **Notes**: Clearly label history as local-only.

## Task 15: Profile & About screen

- **Status**: `completed`
- **Priority**: medium
- **Depends On**: Task 6, Task 7
- **Description**:
  - `app/profile.tsx` — display name, preferences, wearable device info (from deviceStore), app version, privacy info, project explanation, medical disclaimer.
- **Acceptance Criteria Addressed**: AC-10 (content)
- **Test Requirements**:
  - `rule` TR-15.1: Medical disclaimer and app version are displayed
- **Notes**: Read-only unless name editing is added.

## Task 16: Dev-only posture simulator (gated & labeled)

- **Status**: `completed`
- **Priority**: low
- **Depends On**: Task 4
- **Description**:
  - An explicit dev-only simulator (behind `__DEV__` + a settings flag) that feeds the posture store with labeled "Simulated" data for UI testing without hardware.
  - Must not affect production paths; all simulator values marked "Simulated" in the UI.
- **Acceptance Criteria Addressed**: AC-12
- **Test Requirements**:
  - `rule` TR-16.1: Simulator is gated behind a `__DEV__`/explicit flag and inactive in production (AC-12)
  - `rule` TR-16.2: All simulated values are visibly labeled "Simulated" in the UI (AC-12)
- **Notes**: Purely for development; never merged into real data streams.

## Task 17: README and configuration documentation

- **Status**: `completed`
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - `README.md` — architecture overview, how to install dependencies, run the dev server, build the dev build, configure BLE UUIDs (with placeholder guidance), and connect to ESP32 firmware.
  - Document Android/iOS BLE permissions and dev-build requirement.
- **Acceptance Criteria Addressed**: AC-7, AC-16
- **Test Requirements**:
  - `rule` TR-17.1: README includes exact install/run commands and UUID configuration instructions (AC-7)
  - `rule` TR-17.2: README states Expo Go cannot run BLE and that a development build is required (AC-16)
- **Notes**: Keep concise and accurate.

## Task 18: Final verification — typecheck, build, and review pass

- **Status**: `completed`
- **Priority**: high
- **Depends On**: Tasks 1-17
- **Description**:
  - Run `tsc --noEmit`, `expo export` or bundle check, and a manual review of no-fabrication and architecture invariants.
  - Fix any issues found.
- **Acceptance Criteria Addressed**: AC-12, AC-13, AC-15, AC-16
- **Test Requirements**:
  - `rule` TR-18.1: `tsc --noEmit` exits 0 (AC-15)
  - `rule` TR-18.2: `expo export` (or `npx expo start --no-dev --minify` bundle) succeeds without fatal errors (AC-16)
  - `rule` TR-18.3: Grep for `Math.random` and hardcoded posture values in production code returns none (AC-12)
  - `rubric` TR-18.4: Architecture separation; scale 1-5; anchors 1=BLE in UI, 3=some leaks, 5=clean layers; threshold >= 4 (AC-13)
- **Notes**: This is the pre-review gate.
