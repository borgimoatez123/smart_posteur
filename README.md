# SmartPosture

**A wearable posture-monitoring prototype combining embedded posture detection, haptic feedback, telemetry storage, and a mobile dashboard.**

SmartPosture is a student project developed as part of the **Wearable Technologies** module. It explores how a wearable device can help users become more aware of their posture during everyday activities.

> **Project status:** Academic prototype. Features and performance should be considered validated only where supported by recorded tests. SmartPosture is not a medical device and does not diagnose, prevent, or treat medical conditions.

## Overview

The system is organized around three main parts:

1. **Wearable prototype** — an ESP32 reads measurements from an MPU6050 inertial sensor, classifies supported posture states using the embedded program, and controls a vibration motor when the programmed alert conditions are met.
2. **Backend and data storage** — a Node.js, TypeScript, and Express API receives telemetry and stores it in MongoDB.
3. **Mobile application** — a React Native app displays available posture data, monitoring information, history, statistics, and recommendations.

When configured, the backend can use Gemini to produce personalized recommendations from available telemetry. A fallback path is intended to provide basic coaching when the AI service is unavailable. AI recommendations do not replace the embedded posture classification.

## System architecture

```text
                 WEARABLE DEVICE
        ┌────────────────────────────┐
        │          MPU6050           │
        │     Inertial measurements  │
        └─────────────┬──────────────┘
                      │ I²C
        ┌─────────────▼──────────────┐
        │            ESP32           │
        │  Embedded posture logic    │
        │  Wi-Fi telemetry           │
        └───────┬─────────────┬──────┘
                │             │
                │             ▼
                │       Vibration motor
                │       Haptic feedback
                ▼
             Wi-Fi
                │
        ┌───────▼────────────────────┐
        │ Backend: Node.js / Express │
        │ TypeScript API             │
        └────────────┬───────────────┘
                     │
              ┌──────▼───────┐
              │   MongoDB    │
              └──────┬───────┘
                     │ REST API
        ┌────────────▼───────────────┐
        │ React Native mobile app    │
        │ Dashboard, history,        │
        │ statistics, recommendations│
        └────────────────────────────┘
```

The ESP32 performs embedded decisions and local vibration control according to its firmware. Remote monitoring depends on Wi-Fi and backend availability. The prototype uses the ESP32's integrated Wi-Fi radio. A textile antenna, if studied separately, should not be considered connected to the ESP32 unless that integration has actually been implemented and tested.

## Main features

### Embedded device
- Read inertial measurements from the MPU6050.
- Classify the posture states implemented in the firmware, such as `GOOD_POSTURE`, `SLOUCHING`, `LEAN_LEFT`, `LEAN_RIGHT`, and `UNKNOWN_POSTURE` where supported.
- Trigger local vibration according to the programmed posture and persistence conditions.
- Send telemetry to the backend over Wi-Fi when connectivity is available.

### Backend
- Receive telemetry from the wearable device.
- Store and retrieve measurements using MongoDB.
- Expose API endpoints for device status, dashboard data, history, sessions, events, and AI recommendations, according to the implemented backend version.
- Generate live or historical recommendations where those features are implemented and configured.

### Mobile application
- Display available device and posture information.
- Present dashboard metrics and historical records.
- Show sessions and events when supported by the connected API.
- Display AI recommendations returned by the backend.
- Handle loading, empty, stale-data, and network-error states according to the implemented screens.

## Technology stack

| Layer | Technologies |
|---|---|
| Microcontroller | ESP32 |
| Inertial sensor | MPU6050 |
| Local feedback | Vibration motor |
| Connectivity | Wi-Fi |
| Backend runtime | Node.js |
| Backend language | TypeScript |
| API framework | Express |
| Database | MongoDB |
| Mobile application | React Native |
| AI recommendations | Gemini through the backend, when configured |

## Repository structure

The exact directory layout depends on the current repository. A typical organization is:

```text
SmartPosture/
├── firmware/       # ESP32 firmware
├── backend/        # Node.js, TypeScript, Express API
├── mobile/         # React Native application
├── docs/           # Diagrams, screenshots, test protocols
└── README.md
```

Update this tree to match the actual folders in the repository. Do not create empty folders only to match this example.

## Getting started

This repository may contain separate firmware, backend, and mobile projects. Follow the setup instructions in each subproject if available.

### 1. Hardware preparation

You will need the components actually used in the prototype, including:
- ESP32 development board (exact model: **to be specified**).
- MPU6050 inertial sensor.
- Vibration motor and any required driver circuit.
- Appropriate power source and connecting wires.

Check the actual wiring diagram and firmware before powering the circuit. Do not connect a motor directly to an ESP32 GPIO unless the circuit design and motor specifications explicitly support it; use the intended driver circuit where required.

### 2. Backend configuration

Install the Node.js version required by the backend project, then install its dependencies using the package manager and lockfile present in the backend directory.

Create a local environment configuration based on the project's environment example, if provided. Typical settings may include:

```env
PORT=3000
MONGODB_URI=<your_mongodb_connection_string>
GEMINI_API_KEY=<your_gemini_api_key>
```

These variable names are examples only. Check the backend source and its `.env.example` for the exact names expected by the current version.

Never commit `.env`, database credentials, API keys, or other secrets to GitHub.

Start the backend using the script defined in its `package.json`. Verify its health endpoint if available:

```http
GET /health
```

### 3. Mobile application configuration

Configure the app's API base URL to point to the machine running the backend.

- **Physical phone and backend computer on the same Wi-Fi:** use the computer's LAN IP address.
- **Android emulator:** use the emulator's host-loopback address where applicable.
- **iOS simulator:** use the host address appropriate to the simulator setup.

Do not assume `localhost` on a physical phone points to the development computer. Ensure the phone and backend computer can reach each other and that the backend listens on an accessible interface.

The exact environment variable or configuration file depends on the mobile project. Check the current source before changing it.

### 4. ESP32 firmware

Open the firmware project in the toolchain used by the repository. Configure Wi-Fi credentials and the backend address using the project's supported configuration method. Confirm that the firmware's device identifier and telemetry payload match the backend API contract.

Do not commit personal Wi-Fi passwords or private credentials.

## API

The backend API uses the `/api/v1` prefix in the documented project design. Depending on the current implementation, endpoints may cover telemetry submission, device status, dashboard metrics, historical measurements, sessions, events, live AI recommendations, and historical AI recommendations.

For exact paths, request bodies, response schemas, and error handling, refer to the backend route definitions or API documentation included in this repository. Do not rely on this summary as a substitute for the implemented API contract.

## Demonstration

A useful project demonstration can show:

1. Powering on the wearable prototype.
2. Sensor readings or serial output.
3. A supported posture state.
4. An incorrect posture maintained until the configured alert condition is met.
5. The vibration motor responding.
6. Telemetry reaching the backend.
7. The React Native application displaying the corresponding real data.

Use real recordings and measurements. If a feature is not yet implemented or validated, label it as work in progress.

## Testing and validation

Evaluate the project using repeatable tests, including:
- Sensor readings under known postures.
- Classification consistency for each supported state.
- Time between detection and vibration.
- Behavior when posture returns to `GOOD_POSTURE`.
- Telemetry delivery and backend storage.
- Mobile display consistency with API responses.
- Behavior during Wi-Fi or backend disconnection.
- AI fallback behavior, if enabled.
- Power consumption and battery-life estimation, if measured.

Record the test procedure, number of trials, observed results, and limitations. Do not claim accuracy, latency, battery life, or reliability values without supporting measurements.

## Limitations

- Classification may depend on sensor placement, orientation, and firmware thresholds.
- Performance claims require a documented test protocol and sufficient repeated trials.
- Remote history and dashboards depend on successful data transmission and backend availability.
- Battery life must be measured or estimated from documented current-consumption data.
- AI-generated advice depends on available telemetry and AI service configuration.
- A textile antenna studied separately is not part of the ESP32's active RF path unless physical integration has been completed and verified.

## Team

**Project team:** 6 members.

- **Team members:** [Add names and responsibilities]
- **Instructor:** [Add instructor name]
- **Module:** Wearable Technologies
- **Academic year:** [Add academic year]
- **Institution:** [Add institution]

## Acknowledgements

We would like to thank our Wearable Technologies instructor for teaching, guidance, and support throughout this project. We also thank all team members for their collaboration and contributions to SmartPosture.

## Disclaimer

SmartPosture is an academic prototype intended for posture awareness and educational experimentation. It is not a medical device and is not intended to diagnose, treat, cure, or prevent any medical condition.

## License

No license has been specified yet. Add a `LICENSE` file and update this section if the project is intended to be reused or distributed publicly.
