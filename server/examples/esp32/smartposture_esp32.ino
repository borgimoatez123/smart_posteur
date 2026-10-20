/*
 * SmartPosture - ESP32 + MPU6050 HTTP client example
 * ---------------------------------------------------
 *
 * What this sketch does:
 *   1. Connects to the local Wi-Fi network.
 *   2. Reads the MPU6050 accelerometer/gyroscope.
 *   3. Classifies the posture LOCALLY and vibrates when it is incorrect.
 *   4. POSTs each sample to the backend and sends a heartbeat every 15 seconds.
 *   5. Keeps detecting posture and vibrating even if Wi-Fi or the backend is down.
 *
 * Only the backend changes are required to match your deployment:
 *   - WIFI_SSID / WIFI_PASSWORD
 *   - SERVER_HOST / SERVER_PORT (use the computer's LAN IPv4 address)
 *   - DEVICE_ID
 *
 * Arduino IDE:
 *   Board   : "ESP32 Dev Module"
 *   Library : built-in Wire (the MPU6050 is driven with raw I2C, no extra library)
 *
 * IMPORTANT: the backend never controls the motor. The decision to vibrate is made
 * here, so the wearable keeps working when the phone or the server is unavailable.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <math.h>
#include <time.h>

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
static const char *WIFI_SSID = "YOUR_WIFI_SSID";
static const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// LAN IPv4 address of the computer running the backend (NOT the ESP32's own IP
// and NOT "localhost"). Example: "http://192.168.1.24".
static const char *SERVER_HOST = "http://192.168.1.24";
static const uint16_t SERVER_PORT = 3000;

static const char *DEVICE_ID = "smartposture-esp32-01";

// Sampling / reporting cadence.
static const uint32_t SAMPLE_INTERVAL_MS = 500;    // 2 Hz reporting
static const uint32_t HEARTBEAT_INTERVAL_MS = 15000; // 15 s heartbeat
static const float SAMPLING_HZ = 2.0f;             // reported to the backend

// Posture thresholds (degrees). Tune for your mounting position.
static const float SLOUCH_ANGLE_DEG = 15.0f;
static const float LEAN_ANGLE_DEG = 12.0f;
static const float HEAD_FORWARD_ANGLE_DEG = 20.0f;

// Motor behaviour.
static const uint32_t VIBRATION_PULSE_MS = 400;
static const uint32_t VIBRATION_COOLDOWN_MS = 3000; // avoid continuous buzzing

// ---------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------
static const uint8_t PIN_SDA = 21;
static const uint8_t PIN_SCL = 22;
static const uint8_t PIN_VIBRATION = 25;

// MPU6050 I2C address and registers.
static const uint8_t MPU6050_ADDR = 0x68;
static const uint8_t REG_PWR_MGMT_1 = 0x6B;
static const uint8_t REG_ACCEL_XOUT_H = 0x3B;
static const uint8_t REG_WHO_AM_I = 0x75;

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------
static uint32_t lastSampleAt = 0;
static uint32_t lastHeartbeatAt = 0;
static uint32_t lastVibrationAt = 0;

static bool mpuAvailable = false;
static float lastBatteryVoltage = 0.0f;

enum PostureLabel {
  GOOD_POSTURE,
  SLOUCHING,
  LEAN_LEFT,
  LEAN_RIGHT,
  HEAD_FORWARD,
  UNKNOWN_LABEL
};

// ---------------------------------------------------------------------------
// MPU6050 low-level helpers
// ---------------------------------------------------------------------------
static void mpuWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

static bool mpuInit() {
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.beginTransmission(MPU6050_ADDR);
  if (Wire.endTransmission() != 0) {
    return false;
  }
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(REG_WHO_AM_I);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, (uint8_t)1);
  if (!Wire.available()) {
    return false;
  }
  const uint8_t whoAmI = Wire.read();
  if (whoAmI != 0x68) {
    return false;
  }
  mpuWrite(REG_PWR_MGMT_1, 0x00); // wake up
  delay(50);
  return true;
}

struct ImuReading {
  bool valid;
  float ax, ay, az; // g
  float gx, gy, gz; // deg/s
};

static ImuReading readImu() {
  ImuReading reading = {false, 0, 0, 0, 0, 0, 0};
  if (!mpuAvailable) {
    return reading;
  }

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(REG_ACCEL_XOUT_H);
  if (Wire.endTransmission(false) != 0) {
    return reading;
  }
  if (Wire.requestFrom(MPU6050_ADDR, (uint8_t)14) != 14) {
    return reading;
  }

  const int16_t rawAx = (Wire.read() << 8) | Wire.read();
  const int16_t rawAy = (Wire.read() << 8) | Wire.read();
  const int16_t rawAz = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read(); // temperature, unused
  const int16_t rawGx = (Wire.read() << 8) | Wire.read();
  const int16_t rawGy = (Wire.read() << 8) | Wire.read();
  const int16_t rawGz = (Wire.read() << 8) | Wire.read();

  // Default full-scale ranges: +/-2g and +/-250 deg/s.
  reading.ax = rawAx / 16384.0f;
  reading.ay = rawAy / 16384.0f;
  reading.az = rawAz / 16384.0f;
  reading.gx = rawGx / 131.0f;
  reading.gy = rawGy / 131.0f;
  reading.gz = rawGz / 131.0f;
  reading.valid = true;
  return reading;
}

// ---------------------------------------------------------------------------
// Posture classification (runs entirely on the device)
// ---------------------------------------------------------------------------
struct PostureResult {
  PostureLabel label;
  float angle;
  float confidence;
};

static PostureResult classifyPosture(const ImuReading &reading) {
  PostureResult result = {UNKNOWN_LABEL, 0.0f, 0.0f};
  if (!reading.valid) {
    return result;
  }

  // Tilt angles from the gravity vector.
  const float pitch = atan2f(-reading.ax, sqrtf(reading.ay * reading.ay + reading.az * reading.az)) * 180.0f / PI;
  const float roll = atan2f(reading.ay, reading.az) * 180.0f / PI;

  result.angle = fabsf(pitch);

  if (fabsf(roll) >= LEAN_ANGLE_DEG) {
    result.label = (roll > 0) ? LEAN_LEFT : LEAN_RIGHT;
  } else if (pitch >= HEAD_FORWARD_ANGLE_DEG) {
    result.label = HEAD_FORWARD;
  } else if (pitch >= SLOUCH_ANGLE_DEG) {
    result.label = SLOUCHING;
  } else {
    result.label = GOOD_POSTURE;
  }

  // Confidence grows with the distance from the decision boundary.
  const float margin = fabsf(pitch - SLOUCH_ANGLE_DEG) / SLOUCH_ANGLE_DEG;
  result.confidence = constrain(0.5f + margin * 0.5f, 0.5f, 0.99f);
  return result;
}

static bool isIncorrect(PostureLabel label) {
  return label != GOOD_POSTURE && label != UNKNOWN_LABEL;
}

static const char *labelToString(PostureLabel label) {
  switch (label) {
    case GOOD_POSTURE: return "GOOD_POSTURE";
    case SLOUCHING: return "SLOUCHING";
    case LEAN_LEFT: return "LEAN_LEFT";
    case LEAN_RIGHT: return "LEAN_RIGHT";
    case HEAD_FORWARD: return "HEAD_FORWARD";
    default: return "UNKNOWN";
  }
}

// ---------------------------------------------------------------------------
// Vibration (local, never driven by the backend)
// ---------------------------------------------------------------------------
static void pulseVibrationMotor() {
  digitalWrite(PIN_VIBRATION, HIGH);
  delay(VIBRATION_PULSE_MS);
  digitalWrite(PIN_VIBRATION, LOW);
  lastVibrationAt = millis();
}

// ---------------------------------------------------------------------------
// Battery (optional). Adjust the divider ratio for your hardware, and simply
// stop reporting `battery` if you do not measure it.
// ---------------------------------------------------------------------------
static int readBatteryPercent() {
  const float pinVoltage = (analogRead(34) / 4095.0f) * 3.3f;
  const float batteryVoltage = pinVoltage * 2.0f; // 1:1 voltage divider
  lastBatteryVoltage = batteryVoltage;
  if (batteryVoltage >= 4.2f) return 100;
  if (batteryVoltage <= 3.3f) return 0;
  return (int)(((batteryVoltage - 3.3f) / 0.9f) * 100.0f);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
static String isoNow() {
  // A real UTC timestamp is what makes a retry idempotent: the backend derives its
  // de-duplication key from `deviceId + timestamp + label + alert`.
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 100)) {
    char buffer[32];
    strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S.000Z", &timeinfo);
    return String(buffer);
  }
  // No clock yet (Wi-Fi down / NTP unreachable): send no timestamp at all and let
  // the backend stamp the sample with its own clock.
  return String();
}

static bool ensureTimeSynced() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 100)) {
    return true;
  }
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  return getLocalTime(&timeinfo, 5000);
}

static void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

static int postJson(const String &path, const String &payload) {
  if (WiFi.status() != WL_CONNECTED) {
    return -1; // offline: caller buffers and retries later
  }

  HTTPClient http;
  const String url = String(SERVER_HOST) + ":" + String(SERVER_PORT) + path;
  if (!http.begin(url)) {
    return -1;
  }

  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");
  const int status = http.POST((uint8_t *)payload.c_str(), payload.length());
  http.end();
  return status;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------
static String buildTelemetryPayload(const ImuReading &imu, const PostureResult &posture, int battery) {
  const String timestamp = isoNow();
  const String timestampField = timestamp.length() > 0 ? ("\"timestamp\":\"" + timestamp + "\",") : "";

  String sensors = "null";
  if (imu.valid) {
    char sensorsBuffer[160];
    snprintf(sensorsBuffer, sizeof(sensorsBuffer),
             "{\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"gx\":%.2f,\"gy\":%.2f,\"gz\":%.2f}",
             imu.ax, imu.ay, imu.az, imu.gx, imu.gy, imu.gz);
    sensors = sensorsBuffer;
  }

  char buffer[512];
  snprintf(buffer, sizeof(buffer),
           "{\"deviceId\":\"%s\",%s\"sensors\":%s,"
           "\"posture\":{\"label\":\"%s\",\"angle\":%.1f,\"confidence\":%.2f},"
           "\"alert\":%s,\"battery\":%d,\"samplingHz\":%.1f}",
           DEVICE_ID, timestampField.c_str(), sensors.c_str(),
           labelToString(posture.label), posture.angle, posture.confidence,
           isIncorrect(posture.label) ? "true" : "false", battery, SAMPLING_HZ);

  return String(buffer);
}

static String buildHeartbeatPayload(int battery) {
  const String timestamp = isoNow();
  char buffer[192];
  if (timestamp.length() > 0) {
    snprintf(buffer, sizeof(buffer), "{\"battery\":%d,\"timestamp\":\"%s\"}", battery, timestamp.c_str());
  } else {
    snprintf(buffer, sizeof(buffer), "{\"battery\":%d}", battery);
  }
  return String(buffer);
}

// ---------------------------------------------------------------------------
// Small retry buffer: samples are retried with the SAME timestamp/payload, which
// is what lets the backend de-duplicate them (HTTP 200 instead of a new record).
// ---------------------------------------------------------------------------
static const uint8_t MAX_PENDING = 8;
static String pendingPayloads[MAX_PENDING];
static uint8_t pendingCount = 0;

static void queueForRetry(const String &payload) {
  if (pendingCount < MAX_PENDING) {
    pendingPayloads[pendingCount++] = payload;
  }
  // If the buffer is full the newest sample is dropped; the wearable keeps
  // working regardless - the backend is never required for detection.
}

static void flushRetries() {
  if (WiFi.status() != WL_CONNECTED || pendingCount == 0) {
    return;
  }
  for (uint8_t i = 0; i < pendingCount;) {
    const int status = postJson("/api/v1/telemetry", pendingPayloads[i]);
    if (status >= 200 && status < 300) {
      for (uint8_t j = i; j + 1 < pendingCount; ++j) {
        pendingPayloads[j] = pendingPayloads[j + 1];
      }
      pendingCount--;
    } else if (status < 0) {
      return; // still offline
    } else {
      ++i; // server rejected it (4xx/5xx): keep it for a later attempt
    }
  }
}

// ---------------------------------------------------------------------------
// Arduino entry points
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_VIBRATION, OUTPUT);
  digitalWrite(PIN_VIBRATION, LOW);

  mpuAvailable = mpuInit();
  if (!mpuAvailable) {
    Serial.println("[smartposture] MPU6050 not detected - posture will be UNKNOWN");
  }

  ensureWifi();
  Serial.print("[smartposture] connecting to Wi-Fi");
  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[smartposture] connected, local IP: ");
    Serial.println(WiFi.localIP());
    if (ensureTimeSynced()) {
      Serial.println("[smartposture] clock synced - telemetry will carry a real timestamp");
    } else {
      Serial.println("[smartposture] clock not synced - the backend will stamp samples");
    }
  } else {
    Serial.println("[smartposture] offline - detection and vibration continue");
  }
}

void loop() {
  const uint32_t now = millis();

  // Keep detection and vibration alive independently of the network.
  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = now;

    const ImuReading imu = readImu();
    const PostureResult posture = classifyPosture(imu);
    const int battery = readBatteryPercent();

    // --- Local, time-critical reaction: vibrate on incorrect posture. ---
    if (isIncorrect(posture.label) && now - lastVibrationAt >= VIBRATION_COOLDOWN_MS) {
      pulseVibrationMotor();
    }

    // --- Report to the backend (best effort). ---
    const String payload = buildTelemetryPayload(imu, posture, battery);
    const int status = postJson("/api/v1/telemetry", payload);
    if (status < 200 || status >= 300) {
      queueForRetry(payload);
    } else if (status == 200) {
      Serial.println("[smartposture] duplicate ignored by server");
    }
  }

  // Heartbeat every 15 seconds keeps the device "online" server-side.
  if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatAt = now;
    postJson(String("/api/v1/devices/") + DEVICE_ID + "/heartbeat", buildHeartbeatPayload(readBatteryPercent()));
  }

  flushRetries();
  ensureWifi();
  delay(10);
}
