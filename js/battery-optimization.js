const BatteryOptimization = window.Capacitor?.Plugins?.BatteryOptimization;
const isNativeApp = window.Capacitor?.isNativePlatform?.() === true;
const PROMPTED_KEY = "leafmash_battery_opt_prompted";

export async function requestBatteryOptimizationExemption() {
  if (!isNativeApp || !BatteryOptimization) return;
  await BatteryOptimization.requestExemption().catch(() => {});
}

export async function requestAutostartSettings() {
  if (!isNativeApp || !BatteryOptimization) return;
  const { available } = await BatteryOptimization.hasAutostartSettings().catch(() => ({ available: false }));
  if (!available) return;
  await BatteryOptimization.openAutostartSettings().catch(() => {});
}

export async function initBatteryOptimizationPrompt() {
  if (!isNativeApp || !BatteryOptimization) return;
  if (localStorage.getItem(PROMPTED_KEY) === "1") return;

  const { ignoring } = await BatteryOptimization.isIgnoringBatteryOptimizations().catch(() => ({ ignoring: true }));
  localStorage.setItem(PROMPTED_KEY, "1");
  if (!ignoring) {
    await requestBatteryOptimizationExemption();
  }

  await requestAutostartSettings();
}
