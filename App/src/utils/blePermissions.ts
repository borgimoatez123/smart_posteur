import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Request Bluetooth and location permissions required for BLE scanning.
 * On Android 12+ (API 31+), BLUETOOTH_SCAN and BLUETOOTH_CONNECT are required.
 * On older Android versions, ACCESS_FINE_LOCATION is required for scanning.
 */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS permissions handled via Info.plist + system prompt
  }

  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    const allGranted = Object.values(granted).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED,
    );
    return allGranted;
  } catch (err) {
    console.warn('[blePermissions] request failed:', err);
    return false;
  }
}

/** Check if the required BLE permissions are granted. */
export async function checkBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const perms = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];
  try {
    const results = await Promise.all(perms.map((p) => PermissionsAndroid.check(p)));
    return results.every(Boolean);
  } catch {
    return false;
  }
}
