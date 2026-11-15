import * as THREE from "three";
import gsap from "gsap";
import { createGrassField } from "./grass.js";
import { createEraCards } from "./cards.js";
import { createStudioEnvironment } from "./studio.js";
import { createInspectionRenderer } from "./inspection.js";

const CARD_W = 0.78,
  CARD_H = 0.975;
const hash = (value) => {
  const n = Math.sin(value) * 43758.5453123;
  return n - Math.floor(n);
};
const clamp = THREE.MathUtils.clamp;

/** A faithful, standalone version of the user's grass collection scene. */
export function createMeadow({
  container,
  eras,
  reducedMotion = false,
  cardButtons = [],
  onReady,
  onSelect,
  onDetail,
  onHover,
  onProgress,
  onInspectionChange,
  onArtwork,
  onError,
}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    stencil: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The reference's open meadow composer overrides the canvas ACES setting.
  // Direct rendering encodes once inside the authored shader output chunks.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor("#172712", 1);
  renderer.info.autoReset = false;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f2e7d3");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 60);
  camera.position.set(0, 0.15, 3.6);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight("#fff3d9", 2.1));
  const sun = new THREE.DirectionalLight("#fff4dd", 2.4);
  sun.position.set(3, -2, 5);
  scene.add(sun);
  const lamp = new THREE.PointLight("#ffedb8", 1.5, 12);
  lamp.position.set(3, 1.5, 5);
  scene.add(lamp);
  let disposeStudio = createStudioEnvironment(renderer, scene, {
    quality: container.clientWidth < 640 ? "balanced" : "high",
  });
  const root = new THREE.Group(),
    tilted = new THREE.Group();
  let grid = new THREE.Group(),
    ambience = new THREE.Group();
  scene.add(root);
  root.add(tilted);
  tilted.add(grid, ambience);
  tilted.rotation.x = -0.21;
  const raycaster = new THREE.Raycaster(),
    ndc = new THREE.Vector2(9, 9),
    localPointer = new THREE.Vector3(999, 999, 0);
  const plane = new THREE.Plane(),
    planeNormal = new THREE.Vector3(),
    planePoint = new THREE.Vector3(),
    hitPoint = new THREE.Vector3();
  const screenPoint = new THREE.Vector3(),
    screenCorner = new THREE.Vector3(),
    pointerUV = new THREE.Vector2(0.5, 0.5),
    measuredSize = new THREE.Vector2(),
    stagedPoint = new THREE.Vector3();
  let width = 1,
    height = 1,
    viewportW = 1,
    viewportH = 1,
    layout,
    cards,
    grass;
  let inspection = createInspectionRenderer({
    renderer,
    scene,
    camera,
    getCards: () => cards?.cards,
  });
  let detailTarget = null,
    inspectionReady = false;
  const detailPointer = new THREE.Vector2(0.5, 0.5);
  let disposed = false,
    started = false,
    paused = false,
    contextLost = false,
    rebuilding = 0,
    pendingBuild = null;
  let quality = "auto",
    hovered = null,
    selected = null,
    playing = null,
    audioPlaying = false;
  let targetScroll = 0,
    scroll = 0,
    frame = 0,
    elapsed = 0,
    previousTime = 0,
    lastProgress = -1;
  let longpress = 0,
    press = null,
    resizeTimer = 0,
    contextTimer = 0,
    lastInputTime = 0,
    lastCombTime = 0;
  let lastStats = 0,
    statFrames = 0,
    statMs = 0,
    slowFrames = 0,
    autoLite = false;
  const growth = { value: 1 },
    unsubscribers = [],
    animations = new Set();
  const mobile = () => width < 640;
  const tier = () =>
    quality === "auto" ? (autoLite || mobile() ? "balanced" : "high") : quality;
  const dpr = () =>
    Math.min(
      window.devicePixelRatio || 1,
      quality === "high"
        ? 2
        : tier() === "low"
          ? 1
          : tier() === "balanced"
            ? 1.25
            : 1.75,
    );
  const listen = (target, name, fn, options) => {
    target.addEventListener(name, fn, options);
    unsubscribers.push(() => target.removeEventListener(name, fn, options));
  };

  function measure() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    viewportH =
      2 * Math.tan(THREE.MathUtils.degToRad(19)) * camera.position.length();
    viewportW = viewportH * camera.aspect;
    const nextRatio = dpr();
    if (renderer.getPixelRatio() !== nextRatio)
      renderer.setPixelRatio(nextRatio);
    renderer.getSize(measuredSize);
    if (measuredSize.x !== width || measuredSize.y !== height)
      renderer.setSize(width, height, false);
    inspection.resize(width, height, renderer.getPixelRatio());
  }

  function getLayout() {
    const columns = width < 640 ? 1 : width < 1024 ? 2 : 3;
    const rows = Math.ceil(eras.length / columns),
      strideX = 1.17,
      strideY = 1.41375;
    const totalW = CARD_W * columns + 0.39 * (columns - 1);
    const scale = Math.min(
      (0.68 * viewportW) / totalW,
      (0.54 * viewportH) / CARD_H,
      1,
    );
    const baseScale = (0.45 * viewportH) / 1.43;
    let topY = (0.54 * viewportH) / (2 * scale) - CARD_H / 2;
    let maxScroll = (rows - 1) * strideY - topY;
    if (maxScroll < 0) {
      topY -= maxScroll;
      maxScroll = 0;
    }
    const slots = eras.map((era, index) => ({
      x:
        (-(columns - 1) * strideX) / 2 +
        (index % columns) * strideX +
        (hash(12.9898 * index + 1) - 0.5) * 0.2,
      y:
        topY -
        Math.floor(index / columns) * strideY +
        (hash(78.233 * index + 2) - 0.5) * 0.18,
      z: 0.435,
      rx: (hash(93.989 * index + 4) - 0.5) * 0.1,
      ry: (hash(57.585 * index + 5) - 0.5) * 0.1,
      rz: (hash(39.425 * index + 3) - 0.5) * 0.4,
      col: era.color,
    }));
    const extentH = 1.43 / (0.45 * scale),
      extentW = (extentH * viewportW) / viewportH;
    const fieldTop = topY + 0.55 * extentH,
      fieldBottom = topY - (rows - 1) * strideY - 1.15 * extentH;
    return {
      columns,
      rows,
      scale,
      baseScale,
      topY,
      maxScroll,
      slots,
      fieldW: Math.ceil((Math.max(totalW, extentW) + 5) * 2) / 2,
      fieldH: Math.ceil((fieldTop - fieldBottom) * 2) / 2,
      fieldCy: Math.round(((fieldTop + fieldBottom) / 2) * 2) / 2,
    };
  }

  function disposeStage(stage) {
    if (!stage || stage.committed || stage.disposed) return;
    stage.disposed = true;
    stage.grass?.dispose();
    stage.cards?.dispose();
    stage.root.clear();
  }

  function cancelPendingBuild() {
    const stage = pendingBuild;
    pendingBuild = null;
    disposeStage(stage);
  }

  function stageIsCurrent(stage) {
    return !disposed && !contextLost && !stage.disposed &&
      pendingBuild === stage && stage.generation === rebuilding;
  }

  function positionStage(stage) {
    const progress = stage.preserve && layout?.maxScroll
      ? targetScroll / layout.maxScroll : 0;
    const selectedSlot = selected !== null ? stage.layout.slots[selected] : null;
    stage.scroll = selectedSlot
      ? clamp(stage.layout.topY - selectedSlot.y, 0, stage.layout.maxScroll)
      : clamp(progress, 0, 1) * stage.layout.maxScroll;
    stage.grid.position.y = stage.scroll * stage.layout.scale;
    stage.root.updateMatrixWorld(true);
  }

  function warmStageArtwork(stage) {
    positionStage(stage);
    const indices = new Set();
    for (const card of stage.cards.cards) {
      card.motion.getWorldPosition(stagedPoint);
      stagedPoint.project(camera);
      const y = (-stagedPoint.y * 0.5 + 0.5) * height;
      if (y > -height * 0.3 && y < height * 1.3) indices.add(card.index);
    }
    for (const index of [selected, playing, hovered])
      if (Number.isInteger(index) && stage.cards.cards[index]) indices.add(index);
    return [...indices]
      .filter((index) => !stage.cards.cards[index].artworkReady)
      .map((index) => stage.cards.ensureArtwork(index));
  }

  function redrawCurrentWorld() {
    if (!contextLost && grass && cards && layout) {
      renderFrame(elapsed, 1 / 60);
      updateCardButtons();
    }
  }

  async function build({ initial = false, preserve = true } = {}) {
    if (disposed || contextLost) return;
    clearTimeout(resizeTimer);
    const generation = ++rebuilding;
    container.dataset.building = "true";
    cancelPendingBuild();
    if (press) cancelPress();
    measure();
    // Updating a drawing buffer clears it. Repaint the complete old world
    // before preparing replacements, including when only DPR has changed.
    redrawCurrentWorld();
    const nextLayout = getLayout();
    const stage = {
      generation,
      preserve,
      layout: nextLayout,
      root: new THREE.Group(),
      tilted: new THREE.Group(),
      grid: new THREE.Group(),
      ambience: new THREE.Group(),
      grass: null,
      cards: null,
      scroll: 0,
      committed: false,
      disposed: false,
    };
    pendingBuild = stage;
    stage.root.scale.setScalar(nextLayout.baseScale);
    stage.tilted.rotation.x = -0.21;
    stage.grid.scale.setScalar(nextLayout.scale);
    stage.ambience.scale.setScalar(nextLayout.scale);
    stage.root.add(stage.tilted);
    stage.tilted.add(stage.grid, stage.ambience);
    try {
      stage.grass = createGrassField({
        renderer,
        parent: stage.grid,
        ambienceParent: stage.ambience,
        fieldW: nextLayout.fieldW,
        fieldH: nextLayout.fieldH,
        fieldCy: nextLayout.fieldCy,
        slots: nextLayout.slots,
        cardW: CARD_W,
        cardH: CARD_H,
        quality: tier(),
        reducedMotion,
        convertOutput: true,
      });
      stage.cards = createEraCards({
        eras,
        slots: nextLayout.slots,
        reducedMotion,
        quality: tier() === "high" ? "high" : "low",
        textureScale: mobile() || tier() === "low" ? 0.5 : 1,
        initialCount: nextLayout.columns * 2,
        onImageReady: (index, dataURL) => {
          if (!disposed && !contextLost &&
            (pendingBuild === stage || (stage.committed && cards === stage.cards)))
            onArtwork?.(index, dataURL);
        },
      });
      stage.grid.add(stage.cards.group);
      await Promise.all([
        stage.grass.ready,
        stage.cards.ready,
        ...warmStageArtwork(stage),
      ]);
      if (!stageIsCurrent(stage)) return;
      // Selection/scroll may change while images decode. Each pass requests
      // only newly needed artwork, so this settles after at most nine cards.
      let artwork = warmStageArtwork(stage);
      while (artwork.length) {
        await Promise.all(artwork);
        if (!stageIsCurrent(stage)) return;
        artwork = warmStageArtwork(stage);
      }
      if (!stageIsCurrent(stage)) return;
      stage.grass.setReducedMotion(reducedMotion);
      stage.cards.setReducedMotion(reducedMotion);
      stage.cards.setHovered(hovered);
      stage.cards.setPlaying(playing);
      stage.cards.setSelected(selected);
      for (let index = 0; index < stage.cards.cards.length; index++) {
        const previous = cards?.cards[index], next = stage.cards.cards[index];
        if (previous) for (const key of ["hover", "tiltX", "tiltY", "opacity"])
          next[key] = previous[key];
      }
      stage.cards.update(elapsed, 1 / 60, {
        hovered, playing, audioPlaying, pointer: pointerUV,
      });
      stage.grass.update(elapsed, 1 / 60, { grow: growth.value });
      // Prepare programs while the old materials still retain their cache
      // entries. This does not render the detached replacement groups.
      renderer.compile?.(stage.root, camera, scene);
      if (!stageIsCurrent(stage)) return;
      const oldGrass = grass, oldCards = cards,
        oldGrid = grid, oldAmbience = ambience;
      const hadWorld = Boolean(oldGrass && oldCards);
      layout = nextLayout;
      grid = stage.grid;
      ambience = stage.ambience;
      grass = stage.grass;
      cards = stage.cards;
      targetScroll = scroll = stage.scroll;
      root.scale.setScalar(layout.baseScale);
      tilted.add(grid, ambience);
      oldGrid.removeFromParent();
      oldAmbience.removeFromParent();
      stage.committed = true;
      pendingBuild = null;
      stage.root.clear();
      oldGrass?.dispose();
      oldCards?.dispose();
      started = true;
      if (!hadWorld) {
        growth.value = (initial || !hadWorld) && !reducedMotion ? 0.1 : 1;
        if (growth.value < 1) {
          const animation = gsap.to(growth, {
            value: 1,
            duration: 1.6,
            ease: "power3.out",
            onComplete: () => animations.delete(animation),
          });
          animations.add(animation);
        }
      }
      grass.update(elapsed, 1 / 60, { grow: growth.value });
      scene.updateMatrixWorld(true);
      renderFrame(elapsed, 1 / 60);
      updateCardButtons();
      const images = cards.cards.map(
        (card) => card.dataURL || card.canvas?.toDataURL?.("image/jpeg", 0.9) || null,
      );
      container.dataset.ready = "true";
      if (generation === rebuilding) container.dataset.building = "false";
      onReady?.(images);
      if (!frame) frame = requestAnimationFrame(animate);
    } catch (error) {
      if (stageIsCurrent(stage) || (!disposed && !contextLost &&
        stage.committed && cards === stage.cards && generation === rebuilding)) {
        container.dataset.building = "false";
        console.error("Meadow asset preparation failed", error);
        onError?.(error);
      }
    } finally {
      if (!stage.committed) {
        if (pendingBuild === stage) {
          pendingBuild = null;
          if (generation === rebuilding) container.dataset.building = "false";
        }
        disposeStage(stage);
      }
    }
  }

  function runBuild(options) {
    build(options).catch((error) => {
      console.error("The meadow could not be prepared", error);
      if (!disposed) onError?.(error);
    });
  }

  function renderFrame(time, delta) {
    let handled = false;
    if (selected !== null && detailTarget?.isConnected) {
      const bounds = detailTarget.getBoundingClientRect(),
        w = detailTarget.offsetWidth,
        h = detailTarget.offsetHeight;
      const rect = {
        x: bounds.left + bounds.width / 2 - w / 2,
        y: bounds.top + bounds.height / 2 - h / 2,
        width: w,
        height: h,
      };
      handled = inspection.render({
        selected,
        rect,
        pointer: detailPointer,
        time,
        delta,
        reducedMotion,
      });
    }
    if (!handled) renderer.render(scene, camera);
    if (handled !== inspectionReady) {
      inspectionReady = handled;
      onInspectionChange?.(handled);
    }
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    planeNormal.set(0, 0, 1).transformDirection(grid.matrixWorld);
    planePoint.set(0, 0, 0.38);
    grid.localToWorld(planePoint);
    plane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
    if (raycaster.ray.intersectPlane(plane, hitPoint)) {
      localPointer.copy(hitPoint);
      grid.worldToLocal(localPointer);
      grass?.setPointer(localPointer.x, localPointer.y);
    }
    return pickCard();
  }

  function pickCard() {
    if (!cards) return null;
    const hits = raycaster.intersectObjects(
      cards.cards.map((card) => card.mesh || card.group),
      true,
    );
    for (const hit of hits) {
      let object = hit.object;
      while (object && object !== grid) {
        if (Number.isInteger(object.userData.eraIndex)) {
          if (hit.uv) pointerUV.copy(hit.uv);
          return object.userData.eraIndex;
        }
        object = object.parent;
      }
      const index = cards.cards.findIndex(
        (card) =>
          card.mesh === hit.object ||
          card.group === hit.object.parent ||
          card.group === hit.object,
      );
      if (index >= 0) {
        if (hit.uv) pointerUV.copy(hit.uv);
        return index;
      }
    }
    return null;
  }

  function setHovered(index) {
    if (hovered === index) return;
    hovered = index;
    cards?.setHovered?.(index);
    onHover?.(index);
    canvas.style.cursor = index === null ? "default" : "pointer";
  }

  function move(event) {
    if (selected !== null || paused || !started) return;
    const index = updatePointer(event);
    if (press && press.id === event.pointerId) {
      const distance = Math.hypot(
        event.clientX - press.x,
        event.clientY - press.y,
      );
      if (distance > 6) {
        press.moved = true;
        clearTimeout(longpress);
      }
      if (press.button === 0 && press.moved) {
        const delta = press.lastY - event.clientY;
        targetScroll = clamp(
          targetScroll + delta * worldPerPixel(),
          0,
          layout.maxScroll,
        );
        lastInputTime = performance.now();
      } else if (press.button === 2 && press.moved)
        grass?.combTo(localPointer.x, localPointer.y);
      press.lastY = event.clientY;
    }
    if (!press?.touch) setHovered(index);
  }

  const worldPerPixel = () =>
    viewportH / (layout.baseScale * layout.scale * height);
  function down(event) {
    if (
      ![0, 2].includes(event.button) ||
      selected !== null ||
      paused ||
      !started
    )
      return;
    const index = updatePointer(event);
    press = {
      id: event.pointerId,
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      lastY: event.clientY,
      index,
      touch: event.pointerType !== "mouse",
      moved: false,
      held: false,
    };
    canvas.setPointerCapture(event.pointerId);
    if (press.button === 2) grass?.beginComb(localPointer.x, localPointer.y);
    if (press.touch && index !== null)
      longpress = window.setTimeout(() => {
        if (press && !press.moved) {
          press.held = true;
          grass?.endComb();
          onDetail?.(index);
        }
      }, 480);
  }
  function up(event) {
    if (!press || press.id !== event.pointerId) return;
    const ended = press;
    press = null;
    clearTimeout(longpress);
    grass?.endComb();
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (ended.button === 2 && ended.moved) lastCombTime = performance.now();
    if (
      ended.button === 0 &&
      !ended.moved &&
      !ended.held &&
      ended.index !== null &&
      (!ended.touch || performance.now() - lastInputTime > 280)
    )
      onSelect?.(ended.index);
    if (ended.touch) {
      setHovered(null);
      grass?.leavePointer();
    }
  }
  function cancelPress() {
    clearTimeout(longpress);
    const pointerId = press?.id;
    press = null;
    if (pointerId !== undefined) {
      try {
        if (canvas.hasPointerCapture(pointerId))
          canvas.releasePointerCapture(pointerId);
      } catch {
        // A canceled native pointer can already have lost its capture.
      }
    }
    grass?.endComb();
    grass?.leavePointer();
    if (disposed) {
      hovered = null;
      cards?.setHovered?.(null);
    } else setHovered(null);
  }
  function wheel(event) {
    if (selected !== null || paused || !started) return;
    event.preventDefault();
    const delta =
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * height
          : event.deltaY;
    targetScroll = clamp(
      targetScroll + delta * worldPerPixel(),
      0,
      layout.maxScroll,
    );
    lastInputTime = performance.now();
    setHovered(null);
  }
  function contextMenu(event) {
    event.preventDefault();
    if (
      selected !== null ||
      paused ||
      press?.moved ||
      performance.now() - lastCombTime < 350
    )
      return;
    const index = updatePointer(event);
    if (index !== null) onDetail?.(index);
  }
  function keyboard(event) {
    if (
      selected !== null ||
      paused ||
      /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)
    )
      return;
    if (event.target?.closest('button,a,dialog,[role="scrollbar"]')) return;
    const amount =
      event.key === "PageDown"
        ? 0.8
        : event.key === "PageUp"
          ? -0.8
          : event.key === "ArrowDown"
            ? 0.2
            : event.key === "ArrowUp"
              ? -0.2
              : 0;
    if (amount) {
      event.preventDefault();
      scrollBy(amount);
    }
    if (event.key === "Home") {
      event.preventDefault();
      targetScroll = 0;
    }
    if (event.key === "End") {
      event.preventDefault();
      targetScroll = layout.maxScroll;
    }
  }
  function scrollBy(viewports) {
    if (layout)
      targetScroll = clamp(
        targetScroll + viewports * height * worldPerPixel(),
        0,
        layout.maxScroll,
      );
  }

  function updateCardButtons() {
    if (!cards) return;
    for (let index = 0; index < cards.cards.length; index++) {
      const button = cardButtons[index],
        card = cards.cards[index],
        object = card.motion || card.group || card.mesh;
      if (!button || !object) continue;
      object.getWorldPosition(screenPoint);
      screenCorner.copy(screenPoint);
      screenCorner.x += (CARD_W * layout.baseScale * layout.scale) / 2;
      screenPoint.project(camera);
      screenCorner.project(camera);
      const x = (screenPoint.x * 0.5 + 0.5) * width,
        y = (-screenPoint.y * 0.5 + 0.5) * height;
      if (y > -height && y < height * 2) cards.ensureArtwork?.(index);
      const w = Math.abs(screenCorner.x - screenPoint.x) * width;
      const nextWidth = `${w}px`,
        nextHeight = `${(w / CARD_W) * CARD_H}px`,
        nextTransform = `translate3d(${x - w / 2}px,${y - ((w / CARD_W) * CARD_H) / 2}px,0) rotate(${(-layout.slots[index].rz * 180) / Math.PI}deg)`;
      if (button.style.width !== nextWidth) button.style.width = nextWidth;
      if (button.style.height !== nextHeight) button.style.height = nextHeight;
      if (button.style.transform !== nextTransform)
        button.style.transform = nextTransform;
      button.setAttribute(
        "data-on-screen",
        String(y > -100 && y < height + 100),
      );
    }
  }

  function animate(now) {
    frame = 0;
    if (disposed || contextLost || document.hidden) return;
    const rawDt = previousTime ? (now - previousTime) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, 0.05);
    previousTime = now;
    if (!paused && started) {
      elapsed += dt;
      renderer.info.reset();
      const previousScroll = scroll;
      scroll +=
        (targetScroll - scroll) * (reducedMotion ? 1 : 1 - Math.exp(-12 * dt));
      grid.position.y = scroll * layout.scale;
      cards.update?.(elapsed, dt, {
        hovered,
        playing,
        audioPlaying,
        pointer: pointerUV,
        reducedMotion,
      });
      grass.update(elapsed, dt, { grow: growth.value });
      renderFrame(elapsed, dt);
      updateCardButtons();
      const progress = layout.maxScroll ? scroll / layout.maxScroll : 0;
      if (Math.abs(progress - lastProgress) > 0.003) {
        lastProgress = progress;
        onProgress?.(progress);
      }
      if (
        Math.abs(previousScroll - scroll) > 0.002 &&
        !press &&
        hovered !== null
      )
        setHovered(null);
      statFrames++;
      statMs += rawDt * 1000;
      if (rawDt > 0.032) slowFrames++;
      if (now - lastStats > 1600) {
        container.dataset.fps = String(
          Math.round((statFrames * 1000) / Math.max(1, statMs)),
        );
        container.dataset.drawCalls = String(renderer.info.render.calls);
        container.dataset.triangles = String(renderer.info.render.triangles);
        container.dataset.blades = String(grass.stats().bladeInstances);
        container.dataset.quality = tier();
        container.dataset.textures = String(renderer.info.memory.textures);
        container.dataset.geometries = String(renderer.info.memory.geometries);
        container.dataset.programs = String(renderer.info.programs.length);
        // Adapt resolution only after a sustained slow window, preserving scene geometry.
        if (
          quality === "auto" &&
          !autoLite &&
          statFrames > 35 &&
          slowFrames / statFrames > 0.65 &&
          elapsed > 9
        ) {
          autoLite = true;
          renderer.setPixelRatio(dpr());
          renderer.setSize(width, height, false);
          inspection.resize(width, height, renderer.getPixelRatio());
        }
        statFrames = 0;
        statMs = 0;
        slowFrames = 0;
        lastStats = now;
      }
    }
    frame = requestAnimationFrame(animate);
  }

  listen(canvas, "pointermove", move, { passive: true });
  listen(canvas, "pointerdown", down);
  listen(canvas, "pointerup", up);
  listen(canvas, "pointercancel", cancelPress);
  listen(canvas, "lostpointercapture", () => {
    if (press) cancelPress();
  });
  listen(canvas, "pointerleave", () => {
    if (!press) {
      grass?.leavePointer();
      setHovered(null);
    }
  });
  listen(canvas, "wheel", wheel, { passive: false });
  listen(canvas, "contextmenu", contextMenu);
  listen(window, "keydown", keyboard);
  listen(document, "visibilitychange", () => {
    previousTime = 0;
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      cancelPress();
    } else if (!frame && !disposed) frame = requestAnimationFrame(animate);
  });
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    clearTimeout(resizeTimer);
    ++rebuilding;
    cancelPendingBuild();
    container.dataset.building = "false";
    started = false;
    cancelPress();
    cancelAnimationFrame(frame);
    frame = 0;
    container.dataset.context = "lost";
    clearTimeout(contextTimer);
    contextTimer = window.setTimeout(() => {
      if (contextLost && !disposed)
        onError?.(new Error("The graphics context could not recover."));
    }, 2500);
  });
  listen(canvas, "webglcontextrestored", () => {
    clearTimeout(contextTimer);
    contextLost = false;
    previousTime = 0;
    container.dataset.context = "restored";
    try {
      disposeStudio();
      disposeStudio = createStudioEnvironment(renderer, scene, {
        quality: tier(),
      });
      inspection.dispose();
      inspection = createInspectionRenderer({
        renderer,
        scene,
        camera,
        getCards: () => cards?.cards,
      });
      inspection.resize(width, height, renderer.getPixelRatio());
      runBuild({ preserve: true });
    } catch (error) {
      console.error("The meadow could not restore its graphics context", error);
      if (!disposed) onError?.(error);
    }
  });
  const resizeObserver = new ResizeObserver(() => {
    if (container.clientWidth === width && container.clientHeight === height)
      return;
    if (disposed || contextLost) return;
    ++rebuilding;
    cancelPendingBuild();
    container.dataset.building = "true";
    if (press) cancelPress();
    // ResizeObserver runs before paint: repair the projection and redraw the
    // complete current world immediately. Only replacement geometry waits.
    measure();
    redrawCurrentWorld();
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!disposed) runBuild({ preserve: true });
    }, 160);
  });
  resizeObserver.observe(container);
  runBuild({ initial: true });

  return {
    setHovered,
    setPlaying: (index) => {
      playing = index;
      cards?.setPlaying?.(index);
    },
    setAudioState: (value) => {
      audioPlaying = value;
    },
    setSelected: (index) => {
      selected = index;
      cancelPress();
      cards?.setSelected?.(index);
      if (index === null) {
        detailTarget = null;
        inspectionReady = false;
        onInspectionChange?.(false);
      }
    },
    setDetailElement: (element) => {
      detailTarget = element;
      detailPointer.set(0.5, 0.5);
    },
    setDetailPointer: (u, v) => {
      detailPointer.set(u, v);
    },
    setPaused: (value) => {
      paused = value;
      cancelPress();
    },
    setReducedMotion: (value) => {
      reducedMotion = value;
      grass?.setReducedMotion(value);
      cards?.setReducedMotion?.(value);
      if (value) {
        animations.forEach((a) => a.kill());
        animations.clear();
        growth.value = 1;
      }
    },
    setQuality: (value) => {
      quality = value;
      autoLite = false;
      runBuild({ preserve: true });
    },
    scrollBy,
    scrollToProgress: (value) => {
      if (layout) targetScroll = clamp(value, 0, 1) * layout.maxScroll;
    },
    focusCard: (index) => {
      if (!layout) return;
      const slot = layout.slots[index];
      targetScroll = clamp(layout.topY - slot.y, 0, layout.maxScroll);
      setHovered(index);
    },
    dispose: () => {
      disposed = true;
      ++rebuilding;
      cancelPendingBuild();
      container.dataset.building = "false";
      cancelPress();
      cancelAnimationFrame(frame);
      clearTimeout(longpress);
      clearTimeout(resizeTimer);
      clearTimeout(contextTimer);
      resizeObserver.disconnect();
      unsubscribers.forEach((fn) => fn());
      animations.forEach((a) => a.kill());
      animations.clear();
      inspection.dispose();
      grass?.dispose();
      cards?.dispose();
      disposeStudio();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      cardButtons.forEach((button) => {
        if (button) {
          button.style.transform = "";
          button.style.width = "";
          button.style.height = "";
        }
      });
    },
  };
}
