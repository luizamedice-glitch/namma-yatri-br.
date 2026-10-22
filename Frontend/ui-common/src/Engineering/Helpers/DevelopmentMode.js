// SPDX-License-Identifier: AGPL-3.0-or-later
// Only the brTest debug asset defines the flag. Preferences and URL parameters cannot enable it.
export const isEnabled = function () {
  if (typeof window === "undefined" || window.__YATRI_BR_DEVELOPMENT__ !== true) return false;
  try {
    const device = JSON.parse(window.JBridge.getDeviceInfo());
    return typeof device.package_name === "string" && device.package_name.endsWith(".debug");
  } catch (_) {
    return false;
  }
};
