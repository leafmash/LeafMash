const ScreenGuard = window.Capacitor?.Plugins?.ScreenGuard;
const isNativeApp = !!(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());

let guardDepth = 0;

export async function pushScreenGuard() {
  guardDepth += 1;
  if (guardDepth === 1 && isNativeApp && ScreenGuard) {
    await ScreenGuard.enable().catch(() => {});
  }
}

export async function popScreenGuard() {
  guardDepth = Math.max(0, guardDepth - 1);
  if (guardDepth === 0 && isNativeApp && ScreenGuard) {
    await ScreenGuard.disable().catch(() => {});
  }
}
