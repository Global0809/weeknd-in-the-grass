import gsap from "gsap";

const INTERACTIVE =
  'a[href],button,input,select,textarea,[role="button"],[role="link"],[role="scrollbar"]';

/**
 * The reference's small cream dot and gently trailing ring.
 * CSS owns their 6/36px normal sizes and 4/52px .is-hover sizes.
 * No native cursor is hidden until an eligible pointer actually moves.
 */
export function createReferenceCursor({ getCardHover = () => false } = {}) {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const html = document.documentElement;
  const removers = [];
  let root = null,
    dot = null,
    ring = null,
    observer = null;
  let dotX = null,
    dotY = null,
    opacity = null;
  let ringX = null,
    ringY = null,
    ringScaleX = null,
    ringScaleY = null;
  let disposed = false,
    enabled = false,
    shown = false,
    pressed = false;
  let lastTarget = null;

  function listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  }

  function listenMedia(query, callback) {
    if (query.addEventListener) {
      query.addEventListener("change", callback);
      removers.push(() => query.removeEventListener("change", callback));
    } else {
      query.addListener(callback);
      removers.push(() => query.removeListener(callback));
    }
  }

  function syncParent() {
    if (!root || !enabled) return;
    const dialogs = Array.from(document.querySelectorAll("dialog[open]"));
    let modalDialogs;
    try {
      modalDialogs = dialogs.filter((dialog) => dialog.matches(":modal"));
    } catch {
      modalDialogs = dialogs;
    }
    const candidates = modalDialogs.length ? modalDialogs : dialogs;
    const parent = candidates[candidates.length - 1] || document.body;
    if (parent && root.parentNode !== parent) parent.appendChild(root);
  }

  function updateHover(target = lastTarget) {
    if (!root) return;
    const currentTarget = target?.isConnected ? target : null;
    lastTarget = currentTarget;
    const control = currentTarget?.closest?.(INTERACTIVE);
    const controlEnabled =
      control && !control.matches(':disabled,[aria-disabled="true"]');
    const cardHovered =
      currentTarget?.matches?.("#meadow-field canvas") && getCardHover();
    root.classList.toggle("is-hover", Boolean(controlEnabled || cardHovered));
  }

  function hide() {
    shown = false;
    pressed = false;
    html.classList.remove("has-weeknd-cursor");
    if (!root) return;
    opacity(0);
    root.classList.remove("is-visible", "is-hover", "is-down");
    ringX.tween.pause();
    ringY.tween.pause();
    ringScaleX.tween.pause();
    ringScaleY.tween.pause();
    gsap.set(ring, { scaleX: 1, scaleY: 1 });
  }

  function mount() {
    root = document.createElement("div");
    root.className = "weeknd-cursor";
    root.setAttribute("aria-hidden", "true");
    root.style.cssText =
      "position:fixed;inset:0;z-index:100000;pointer-events:none;opacity:0;";
    dot = document.createElement("span");
    dot.className = "weeknd-cursor__dot";
    ring = document.createElement("span");
    ring.className = "weeknd-cursor__ring";
    for (const element of [dot, ring]) {
      element.style.cssText =
        "position:absolute;left:0;top:0;pointer-events:none;";
      root.appendChild(element);
    }
    gsap.set([dot, ring], {
      xPercent: -50,
      yPercent: -50,
      transformOrigin: "50% 50%",
    });
    dotX = gsap.quickSetter(dot, "x", "px");
    dotY = gsap.quickSetter(dot, "y", "px");
    opacity = gsap.quickSetter(root, "opacity");
    ringX = gsap.quickTo(ring, "x", { duration: 0.25, ease: "power3.out" });
    ringY = gsap.quickTo(ring, "y", { duration: 0.25, ease: "power3.out" });
    ringScaleX = gsap.quickTo(ring, "scaleX", {
      duration: 0.12,
      ease: "power3.out",
    });
    ringScaleY = gsap.quickTo(ring, "scaleY", {
      duration: 0.12,
      ease: "power3.out",
    });
    syncParent();
    observer = new MutationObserver(() => {
      syncParent();
      updateHover();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
  }

  function unmount() {
    hide();
    observer?.disconnect();
    observer = null;
    ringX?.tween.kill();
    ringY?.tween.kill();
    ringScaleX?.tween.kill();
    ringScaleY?.tween.kill();
    if (root) gsap.killTweensOf([root, dot, ring]);
    root?.remove();
    root = dot = ring = null;
    dotX = dotY = opacity = ringX = ringY = ringScaleX = ringScaleY = null;
    lastTarget = null;
  }

  function applyMedia() {
    if (disposed) return;
    const next = finePointer.matches && !reducedMotion.matches;
    if (next === enabled) return;
    enabled = next;
    if (enabled) mount();
    else unmount();
  }

  function move(event) {
    if (!enabled || !root) return;
    if (
      event.pointerType &&
      event.pointerType !== "mouse" &&
      event.pointerType !== "pen"
    ) {
      hide();
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
      return;
    lastTarget = event.target;
    dotX(event.clientX);
    dotY(event.clientY);
    if (!shown) {
      // The first move starts at the pointer; subsequent moves introduce lag.
      ringX(event.clientX, event.clientX);
      ringY(event.clientY, event.clientY);
      ringScaleX(pressed ? 0.82 : 1, pressed ? 0.82 : 1);
      ringScaleY(pressed ? 0.82 : 1, pressed ? 0.82 : 1);
      shown = true;
      opacity(1);
      root.classList.add("is-visible");
      html.classList.add("has-weeknd-cursor");
    } else {
      ringX(event.clientX);
      ringY(event.clientY);
    }
    updateHover(event.target);
  }

  function down(event) {
    if (!enabled || !shown || event.pointerType === "touch") return;
    pressed = true;
    root.classList.add("is-down");
    updateHover(event.target);
    ringScaleX(0.82);
    ringScaleY(0.82);
  }

  function up() {
    if (!enabled || !root) return;
    pressed = false;
    root.classList.remove("is-down");
    if (shown) {
      ringScaleX(1);
      ringScaleY(1);
    }
  }

  listen(document, "pointermove", move, { passive: true });
  listen(document, "pointerdown", down, { passive: true });
  listen(document, "pointerup", up, { passive: true });
  listen(document, "pointercancel", hide, { passive: true });
  listen(document, "pointerleave", hide, { passive: true });
  listen(
    document,
    "pointerover",
    (event) => {
      if (enabled && shown) updateHover(event.target);
    },
    { passive: true },
  );
  listen(
    document,
    "wheel",
    (event) => {
      if (enabled && shown) updateHover(event.target);
    },
    { passive: true },
  );
  listen(window, "blur", hide);
  listen(
    window,
    "mouseout",
    (event) => {
      if (!event.relatedTarget) hide();
    },
    { passive: true },
  );
  listen(document, "visibilitychange", () => {
    if (document.hidden) hide();
  });
  listenMedia(finePointer, applyMedia);
  listenMedia(reducedMotion, applyMedia);
  applyMedia();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      enabled = false;
      unmount();
      removers.forEach((remove) => remove());
      removers.length = 0;
    },
  };
}
