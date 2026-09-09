const PULL_THRESHOLD = 70;
const MAX_DRAG = 150;
const DAMPING = 0.5;
const CIRCUMFERENCE = 94.2;
const SNAP_TRANSITION = "transform .32s cubic-bezier(.22,1,.36,1), opacity .22s ease";

export function initPullToRefresh({ indicatorId, isActive, onRefresh, onArm }) {
  const indicator = document.getElementById(indicatorId);
  if (!indicator) return;
  const arc = indicator.querySelector(".ptr-ring-arc");

  let startY = 0;
  let pulling = false;
  let refreshing = false;
  let armed = false;

  function dampedPull(diff) {
    return diff < MAX_DRAG ? diff * DAMPING : MAX_DRAG * DAMPING + (diff - MAX_DRAG) * 0.08;
  }

  function paint(pull) {
    const progress = Math.min(pull / PULL_THRESHOLD, 1);
    indicator.style.transform = `translate(-50%, ${pull}px) scale(${0.5 + progress * 0.5})`;
    indicator.style.opacity = String(Math.min(progress * 1.4, 1));
    arc.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress));
  }

  function reset(animated) {
    pulling = false;
    armed = false;
    indicator.classList.remove("armed", "refreshing");
    indicator.style.transition = animated ? SNAP_TRANSITION : "none";
    indicator.style.transform = "translate(-50%, 0px) scale(.5)";
    indicator.style.opacity = "0";
    arc.style.strokeDashoffset = String(CIRCUMFERENCE);
  }

  document.addEventListener("touchstart", (e) => {
    if (refreshing || !isActive()) return;
    if ((window.scrollY || document.scrollingElement.scrollTop) > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
    armed = false;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!pulling || refreshing) return;
    const diff = e.touches[0].clientY - startY;
    if (diff <= 0) { reset(false); return; }
    indicator.style.transition = "none";
    const pull = dampedPull(diff);
    const wasArmed = armed;
    armed = pull >= PULL_THRESHOLD;
    if (armed && !wasArmed) {
      indicator.classList.add("armed");
      if (onArm) onArm();
    } else if (!armed && wasArmed) {
      indicator.classList.remove("armed");
    }
    paint(pull);
  }, { passive: true });

  document.addEventListener("touchend", async () => {
    if (!pulling || refreshing) return;
    pulling = false;
    if (!armed) {
      reset(true);
      return;
    }
    refreshing = true;
    indicator.classList.add("refreshing");
    indicator.style.transition = SNAP_TRANSITION;
    indicator.style.transform = "translate(-50%, 54px) scale(1)";
    indicator.style.opacity = "1";
    try {
      await onRefresh();
    } finally {
      refreshing = false;
      reset(true);
    }
  }, { passive: true });
}
