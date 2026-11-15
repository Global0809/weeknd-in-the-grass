import * as THREE from "three";

/** Album editions of the authored Karma Tracks portrait cards. */
export const CARD_W = 0.78;
export const CARD_H = 0.975;
export const CARD_DEPTH = 0.015;
const PAINT_W = 1024,
  PAINT_H = 1280;
const STRONG_TITLE_SCRIM = new Set([
  "house-of-balloons",
  "starboy",
  "trilogy",
  "kiss-land",
]);

function seedFor(value) {
  let seed = 2166136261;
  const source = String(value);
  let result = "";
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < source.length; i++) {
      seed ^= source.charCodeAt(i) + round * 31;
      seed = Math.imul(seed, 16777619);
    }
    result += (seed >>> 0).toString(16).padStart(8, "0");
  }
  return result;
}

function canvasAt(scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAINT_W * scale);
  canvas.height = Math.round(PAINT_H * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

function cover(ctx, image, x, y, width, height) {
  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight,
  );
  const sw = width / scale,
    sh = height / scale;
  ctx.drawImage(
    image,
    (image.naturalWidth - sw) / 2,
    (image.naturalHeight - sh) / 2,
    sw,
    sh,
    x,
    y,
    width,
    height,
  );
}

function wrap(ctx, text, width, maxLines = 3) {
  const words = String(text).split(/\s+/).filter(Boolean),
    lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(candidate).width > width && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) {
        const remaining = words.slice(i).join(" ");
        let last = remaining;
        while (ctx.measureText(last + "…").width > width && last.length > 1)
          last = last.slice(0, -1);
        lines.push(last.length < remaining.length ? last + "…" : last);
        return lines;
      }
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function carrier(
  ctx,
  seed,
  {
    x = 56,
    y = 700,
    width = 912,
    height = 353.6,
    layer = "both",
    color = "#ece8dc",
    mono = false,
    outerWidth = 1.8,
    innerWidth = 2,
  } = {},
) {
  const byte = (offset) =>
    parseInt(seed.slice(offset, offset + 2) || "0", 16) / 255;
  // The reference's two quieter carrier families keep the curves open and
  // delicate. Their seed, phase, aspect and emboss/foil math stay unchanged.
  const families = [
    [
      [1, 2],
      [1, 3],
      [2, 3],
    ],
    [
      [3, 4],
      [2, 5],
      [3, 5],
    ],
  ];
  const variants =
    families[parseInt(seed.slice(28, 30) || "0", 16) % families.length];
  const [a, b] =
    variants[parseInt(seed.slice(30, 32) || "0", 16) % variants.length];
  const yaw = byte(32) * Math.PI * 2,
    innerYaw = Math.PI / 7 + (byte(34) - 0.5) * 0.3;
  const cx = x + width / 2,
    cy = y + height / 2;
  const rx = (width / 2) * 0.92 * 0.95,
    ry = (height / 2) * 0.86 * 0.95;
  const draw = (scale, phase, opacity, lineWidth, stroke) => {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 2000; i++) {
      const angle = (i / 2000) * Math.PI * 2,
        px = cx + rx * scale * Math.cos(a * angle + phase),
        py = cy + ry * scale * Math.sin(b * angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  };
  if (layer === "both" || layer === "outer")
    draw(1, yaw, mono ? 1 : 0.34, outerWidth, mono ? color : "#ece8dc");
  if (layer === "both" || layer === "inner")
    draw(0.64, yaw + innerYaw, mono ? 1 : 0.72, innerWidth, color);
}

function drawFrame(ctx, color = "rgba(236,232,220,.22)", width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(28, 28, 968, 1224);
  ctx.lineWidth = width * 0.75;
  ctx.strokeRect(42, 42, 940, 1196);
}

function paintFront(canvas, era, index, image, fonts, hint, seed) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.setTransform(canvas.width / PAINT_W, 0, 0, canvas.height / PAINT_H, 0, 0);
  ctx.fillStyle = era.color || "#42333c";
  ctx.fillRect(0, 0, PAINT_W, PAINT_H);
  if (image) cover(ctx, image, 0, 0, PAINT_W, PAINT_H);
  const shade = ctx.createLinearGradient(0, 0, 0, PAINT_H);
  if (STRONG_TITLE_SCRIM.has(era.id)) {
    // Quiet existing cover lettering and bright paper behind the new title,
    // then release the shade before the central artwork and carrier region.
    shade.addColorStop(0, "rgba(3,4,7,.68)");
    shade.addColorStop(0.12, "rgba(3,4,7,.86)");
    shade.addColorStop(0.32, "rgba(3,4,7,.82)");
    shade.addColorStop(0.43, "rgba(3,4,7,.64)");
    shade.addColorStop(0.56, "rgba(3,4,7,.08)");
    shade.addColorStop(0.7, "rgba(3,4,7,.03)");
    shade.addColorStop(1, "rgba(3,4,7,.3)");
  } else {
    shade.addColorStop(0, "rgba(3,4,7,.31)");
    shade.addColorStop(0.12, "rgba(3,4,7,.43)");
    shade.addColorStop(0.55, "rgba(3,4,7,.05)");
    shade.addColorStop(1, "rgba(3,4,7,.3)");
  }
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, PAINT_W, PAINT_H);
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawFrame(ctx);
  ctx.restore();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(236,232,220,.8)";
  ctx.font = `500 32px ${fonts.mono}`;
  ctx.fillText(`XO.${String(index + 1).padStart(3, "0")}`, 60, 56);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(236,232,220,.72)";
  ctx.fillText("THE WEEKND", 964, 56);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ece8dc";
  ctx.font = `italic 500 110px ${fonts.display}`;
  const titleLines = wrap(ctx, era.title || era.id, 904, 3);
  titleLines.forEach((line, lineIndex) =>
    ctx.fillText(line, 60, 204 + 116 * lineIndex),
  );
  const metaY = 204 + 116 * titleLines.length + 24;
  ctx.fillStyle = "rgba(236,232,220,.82)";
  ctx.font = `500 38px ${fonts.mono}`;
  ctx.fillText(`${era.year || ""}  ·  THE WEEKND`, 60, metaY);
  ctx.font = `500 36px ${fonts.mono}`;
  let tagX = 60;
  for (const tag of (era.tags || []).slice(0, 3)) {
    const text = String(tag).toLowerCase(),
      width = ctx.measureText(text).width + 40;
    if (tagX + width > 964) break;
    ctx.strokeStyle = "rgba(236,232,220,.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, metaY + 62, width, 54);
    ctx.fillStyle = "rgba(236,232,220,.9)";
    ctx.fillText(text, tagX + 20, metaY + 71);
    tagX += width + 12;
  }
  carrier(ctx, seed, {
    layer: "outer",
    color: "rgba(0,0,0,.55)",
    mono: true,
    outerWidth: 5,
  });
  carrier(ctx, seed, { layer: "outer" });
  ctx.fillStyle = "rgba(12,11,8,.6)";
  ctx.fillRect(28, 1113.6, 968, 138.4);
  ctx.strokeStyle = "rgba(236,232,220,.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 1113.6);
  ctx.lineTo(964, 1113.6);
  ctx.stroke();
  ctx.fillStyle = "#ece8dc";
  ctx.font = `600 32px ${fonts.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hint, 512, 1182.8);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function paintBack(era, seed) {
  const { canvas, ctx } = canvasAt(0.5);
  ctx.fillStyle = era.color || "#40313c";
  ctx.fillRect(0, 0, PAINT_W, PAINT_H);
  const gradient = ctx.createLinearGradient(0, 0, 0, PAINT_H);
  gradient.addColorStop(0, "rgba(0,0,0,.18)");
  gradient.addColorStop(0.5, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PAINT_W, PAINT_H);
  ctx.strokeStyle = "rgba(236,232,220,.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, 944, 1200);
  carrier(ctx, seed, {
    x: 96,
    y: 176,
    width: 832,
    height: 928,
    layer: "outer",
    mono: true,
    color: "rgba(255,245,225,.22)",
    outerWidth: 2.6,
  });
  carrier(ctx, seed, {
    x: 96,
    y: 176,
    width: 832,
    height: 928,
    layer: "inner",
    mono: true,
    color: "rgba(255,245,225,.42)",
    innerWidth: 2.6,
  });
  return canvas;
}

function paintMask(kind, seed, fonts, hint) {
  const { canvas, ctx } = canvasAt(0.5);
  ctx.fillStyle =
    kind === "roughness" ? "#ededed" : kind === "bump" ? "#808080" : "#000000";
  ctx.fillRect(0, 0, PAINT_W, PAINT_H);
  if (kind === "wave") {
    carrier(ctx, seed, {
      layer: "inner",
      mono: true,
      color: "#ffffff",
      innerWidth: 7,
    });
  } else if (kind === "bump") {
    carrier(ctx, seed, {
      layer: "outer",
      mono: true,
      color: "#505050",
      outerWidth: 6,
    });
    carrier(ctx, seed, {
      layer: "outer",
      mono: true,
      color: "#1a1a1a",
      outerWidth: 2,
    });
  } else {
    drawFrame(
      ctx,
      kind === "roughness" ? "#4a4a4a" : "#ffffff",
      kind === "roughness" ? 4 : 12,
    );
    if (kind === "holo" || kind === "roughness")
      carrier(ctx, seed, {
        layer: "inner",
        mono: true,
        color: kind === "roughness" ? "#6a6a6a" : "#ffffff",
      });
    ctx.fillStyle = kind === "roughness" ? "#2a2a2a" : "#ffffff";
    ctx.font = `600 32px ${fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(hint, 512, 1182.8);
  }
  return canvas;
}

function bumpToNormal(canvas, strength = 6) {
  const width = canvas.width,
    height = canvas.height,
    source = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d"),
    image = ctx.createImageData(width, height);
  const sample = (x, y) =>
    source[
      (Math.max(0, Math.min(height - 1, y)) * width +
        Math.max(0, Math.min(width - 1, x))) *
        4
    ] / 255;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const tl = sample(x - 1, y - 1),
        top = sample(x, y - 1),
        tr = sample(x + 1, y - 1),
        left = sample(x - 1, y),
        right = sample(x + 1, y),
        bl = sample(x - 1, y + 1),
        bottom = sample(x, y + 1),
        br = sample(x + 1, y + 1);
      const nx = -(tr + 2 * right + br - (tl + 2 * left + bl)) * strength,
        ny = -(bl + 2 * bottom + br - (tl + 2 * top + tr)) * strength;
      const length = Math.hypot(nx, ny, 1),
        p = (y * width + x) * 4;
      image.data[p] = ((0.5 * nx) / length + 0.5) * 255;
      image.data[p + 1] = ((0.5 * ny) / length + 0.5) * 255;
      image.data[p + 2] = (0.5 / length + 0.5) * 255;
      image.data[p + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  return target;
}

function canvasTexture(canvas, { color = false, mipmaps = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.generateMipmaps = mipmaps;
  texture.minFilter = mipmaps
    ? THREE.LinearMipmapLinearFilter
    : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = color ? 8 : 4;
  return texture;
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function makeMaterial(map, maps, featured, quality) {
  const material = new THREE.MeshPhysicalMaterial({
    map,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughness: 1,
    roughnessMap: maps.roughness,
    metalness: 1,
    metalnessMap: maps.metal,
    iridescence: 0.6,
    iridescenceIOR: 1.33,
    iridescenceThicknessRange: [300, 550],
    iridescenceMap: maps.holo,
    anisotropy: 0,
    clearcoat: 1,
    clearcoatMap: maps.metal,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaveMask = { value: maps.wave };
    shader.uniforms.uCardLuma = { value: 0.35 };
    shader.uniforms.uFeatured = { value: +featured };
    shader.uniforms.uMetalMask = { value: maps.metal };
    shader.uniforms.uPearlOn = { value: quality === "low" ? 0 : 1 };
    shader.uniforms.uWaveOn = { value: 1 };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", HOLO_COMMON)
      .replace("#include <opaque_fragment>", HOLO_OUTPUT)
      .replace("#include <map_fragment>", GOLD_ALBEDO)
      .replace("#include <roughnessmap_fragment>", ROUGHNESS_SAMPLE)
      .replace("#include <metalnessmap_fragment>", METALNESS_SAMPLE);
  };
  material.customProgramCacheKey = () =>
    `weeknd-reference-card-${featured ? "gold" : "regular"}-${quality}`;
  return material;
}

/**
 * The card root anchors sit on the meadow. Each nested motion group handles
 * the authored .45-unit hover lift, 6% growth and cursor tilt without moving
 * its baked grass footprint. Pointer values are front-face UVs in [0,1].
 * initialCount limits only artwork requests; every card has painted maps from
 * the start. ensureArtwork(index) starts and returns its deferred imageReady.
 */
export function createEraCards({
  eras = [],
  slots = [],
  reducedMotion = false,
  quality = "high",
  fonts = { display: "Gloock", mono: "Space Mono" },
  textureScale = 1,
  initialCount = eras.length,
  onImageReady,
} = {}) {
  const group = new THREE.Group();
  group.name = "The Weeknd editions";
  const geometry = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_DEPTH),
    cards = [];
  const allMaterials = new Set(),
    allTextures = new Set();
  const artworkStarters = new Map(),
    artworkResolvers = new Set(),
    unavailableArtwork = Promise.resolve(false);
  let hovered = -1,
    playing = -1,
    selected = -1,
    disposed = false;
  const hint = window.matchMedia("(hover:none)").matches
    ? "↗ hold for details"
    : "↗ right-click";
  const fontReady = document.fonts
    ? Promise.allSettled([
        document.fonts.load(`italic 500 110px ${fonts.display}`),
        document.fonts.load(`500 38px ${fonts.mono}`),
      ])
    : Promise.resolve();
  const keep = (texture) => {
    allTextures.add(texture);
    return texture;
  };
  function ensureArtwork(index) {
    const card = Number.isInteger(index) ? cards[index] : null;
    if (!card) return unavailableArtwork;
    if (!disposed && !card.artworkStarted) {
      card.artworkStarted = true;
      const start = artworkStarters.get(index);
      artworkStarters.delete(index);
      start?.();
    }
    return card.imageReady;
  }
  for (let index = 0; index < eras.length; index++) {
    const era = eras[index],
      slot = slots[index] || { x: 0, y: -index * 1.41375, z: 0.435, rz: 0 },
      seed = seedFor(era.id || era.title || index);
    const { canvas } = canvasAt(textureScale);
    paintFront(canvas, era, index, null, fonts, hint, seed);
    const texture = keep(canvasTexture(canvas, { color: true, mipmaps: true }));
    const maps = {
      normal: keep(
        canvasTexture(bumpToNormal(paintMask("bump", seed, fonts, hint))),
      ),
      holo: keep(canvasTexture(paintMask("holo", seed, fonts, hint))),
      metal: keep(canvasTexture(paintMask("metal", seed, fonts, hint))),
      roughness: keep(canvasTexture(paintMask("roughness", seed, fonts, hint))),
      wave: keep(canvasTexture(paintMask("wave", seed, fonts, hint))),
    };
    const backTexture = keep(
      canvasTexture(paintBack(era, seed), { color: true, mipmaps: true }),
    );
    const front = makeMaterial(texture, maps, false, quality),
      back = new THREE.MeshPhysicalMaterial({
        map: backTexture,
        roughness: 0.92,
        metalness: 0,
        envMapIntensity: 0.4,
        clearcoat: 0,
      });
    const edge = new THREE.MeshStandardMaterial({
      color: era.color || "#42333c",
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.4,
    });
    allMaterials.add(front);
    allMaterials.add(back);
    allMaterials.add(edge);
    const anchor = new THREE.Group(),
      motion = new THREE.Group();
    anchor.name = era.title || era.id;
    motion.name = "Hover lift and foil tilt";
    const position = slot.position || [
        slot.x ?? 0,
        slot.y ?? 0,
        slot.z ?? 0.435,
      ],
      rotation = slot.rotation || [slot.rx ?? 0, slot.ry ?? 0, slot.rz ?? 0];
    anchor.position.fromArray(position);
    anchor.rotation.fromArray(rotation);
    anchor.add(motion);
    group.add(anchor);
    const mesh = new THREE.Mesh(geometry, [
      edge,
      edge,
      edge,
      edge,
      front,
      back,
    ]);
    mesh.name = `Edition ${index + 1}: ${era.title}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.eraIndex = index;
    mesh.userData.index = index;
    mesh.userData.era = era;
    motion.add(mesh);
    const card = {
      group: anchor,
      anchor,
      motion,
      mesh,
      canvas,
      texture,
      material: front,
      backMaterial: back,
      maps,
      era,
      index,
      seed,
      dataURL: "",
      hover: 0,
      tiltX: 0,
      tiltY: 0,
      opacity: 1,
      uv: new THREE.Vector2(0.5, 0.5),
      imageLoaded: false,
      artworkStarted: false,
      artworkReady: false,
    };
    cards.push(card);
    let resolveArtwork;
    card.imageReady = new Promise((resolve) => {
      resolveArtwork = resolve;
      artworkResolvers.add(resolve);
    });
    const finishArtwork = (result) => {
      if (disposed) return;
      try {
        card.dataURL = canvas.toDataURL("image/webp", 0.94);
      } catch {
        try {
          card.dataURL = canvas.toDataURL("image/png");
        } catch {
          // The live painted texture remains available if encoding fails.
        }
      }
      card.artworkReady = true;
      artworkResolvers.delete(resolveArtwork);
      resolveArtwork(result);
      try {
        onImageReady?.(index, card.dataURL);
      } catch (error) {
        console.error("The artwork update callback failed", error);
      }
    };
    artworkStarters.set(index, () => {
      Promise.all([fontReady, loadImage(era.artwork || era.image)])
        .then(([, image]) => {
          if (disposed) return;
          paintFront(canvas, era, index, image, fonts, hint, seed);
          texture.needsUpdate = true;
          card.imageLoaded = Boolean(image);
          // Footer foil follows the same final font as painted lettering.
          for (const [key, kind] of [
            ["holo", "holo"],
            ["metal", "metal"],
            ["roughness", "roughness"],
          ]) {
            maps[key].image = paintMask(kind, seed, fonts, hint);
            maps[key].needsUpdate = true;
          }
          finishArtwork(true);
        })
        .catch((error) => {
          if (disposed) return;
          // A decoder/2D painting failure must not strand a deferred ready
          // promise. Existing maps are already complete coloured title cards.
          console.error("An album artwork could not be painted", error);
          try {
            paintFront(canvas, era, index, null, fonts, hint, seed);
          } catch {
            // Preserve whichever complete canvas was prepared up front.
          }
          texture.needsUpdate = true;
          card.imageLoaded = false;
          finishArtwork(false);
        });
    });
  }
  const count = Math.min(
    cards.length,
    Math.max(0, Math.floor(Number(initialCount) || 0)),
  );
  const ready = Promise.all(
    cards.slice(0, count).map((card) => ensureArtwork(card.index)),
  ).then(() => cards);
  const update = (time, delta, state = {}) => {
    if (disposed) return;
    if (state.hovered !== undefined) hovered = state.hovered ?? -1;
    if (state.playing !== undefined) playing = state.playing ?? -1;
    if (hovered >= 0) ensureArtwork(hovered);
    if (playing >= 0) ensureArtwork(playing);
    const dt = Math.min(Math.max(delta || 1 / 60, 0.001), 0.08),
      liftLerp = reducedMotion ? 1 : 1 - Math.pow(1 - 0.12, dt * 60),
      tiltLerp = reducedMotion ? 1 : 1 - Math.pow(1 - 0.15, dt * 60),
      fadeLerp = reducedMotion ? 1 : 1 - Math.pow(1 - 0.18, dt * 60);
    for (const card of cards) {
      const isSelected = selected === card.index,
        isHovered = hovered === card.index,
        isPlaying = playing === card.index;
      const liftTarget = isSelected ? 0 : isHovered || isPlaying ? 1 : 0;
      card.hover += (liftTarget - card.hover) * liftLerp;
      const pointer = isHovered ? state.pointer?.uv || state.pointer : null;
      const u = pointer?.u ?? pointer?.x ?? 0.5,
        v = pointer?.v ?? pointer?.y ?? 0.5;
      const tx = isHovered ? (0.5 - THREE.MathUtils.clamp(v, 0, 1)) * 0.6 : 0,
        ty = isHovered ? (THREE.MathUtils.clamp(u, 0, 1) - 0.5) * 0.6 : 0;
      card.tiltX += (tx - card.tiltX) * tiltLerp;
      card.tiltY += (ty - card.tiltY) * tiltLerp;
      card.motion.position.z = card.hover * 0.45;
      card.motion.rotation.x = card.tiltX;
      card.motion.rotation.y = card.tiltY;
      const pulse =
        !reducedMotion && isPlaying && state.audioPlaying
          ? Math.sin(time * 3.5) * 0.002
          : 0;
      card.motion.scale.setScalar(1 + card.hover * 0.06 + pulse);
      const opacityTarget = selected >= 0 && !isSelected ? 0.72 : 1;
      card.opacity += (opacityTarget - card.opacity) * fadeLerp;
      for (const material of [card.material, card.backMaterial]) {
        const transparent = card.opacity < 0.999;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.opacity = card.opacity;
      }
      card.mesh.visible = !isSelected;
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    artworkStarters.clear();
    for (const resolve of artworkResolvers) resolve(false);
    artworkResolvers.clear();
    group.removeFromParent();
    group.clear();
    geometry.dispose();
    for (const material of allMaterials) material.dispose();
    for (const texture of allTextures) texture.dispose();
  };
  return {
    group,
    cards,
    ready,
    ensureArtwork,
    update,
    setHovered: (index) => {
      hovered = index ?? -1;
      if (hovered >= 0) ensureArtwork(hovered);
    },
    setPlaying: (index) => {
      playing = index ?? -1;
      if (playing >= 0) ensureArtwork(playing);
    },
    setSelected: (index) => {
      selected = index ?? -1;
      if (selected >= 0) ensureArtwork(selected);
    },
    setReducedMotion: (value) => {
      reducedMotion = Boolean(value);
    },
    dispose,
  };
}

const HOLO_COMMON =
  "#include <common>\r\n        uniform sampler2D uWaveMask;\r\n        uniform sampler2D uMetalMask;\r\n        uniform float uCardLuma;\r\n        uniform float uFeatured;\r\n        uniform float uPearlOn;\r\n        uniform float uWaveOn;\r\n        // Smooth hue → RGB on a cosine basis. The classic abs-based wheel\r\n        // (r = abs(h*6-3)-1, etc.) has C1 kinks at every primary; when the\r\n        // half-vector sweeps through one of those h values across the\r\n        // surface, the kink reads as a visible hard band — exactly what was\r\n        // breaking the Lissajou holo gradient. Cosine waves at 120\\xb0 offsets\r\n        // give the same hue cycle but with continuous derivatives, so the\r\n        // color transitions are always smooth regardless of where Hv lands.\r\n        vec3 holoHueRgb(float h) {\r\n          float a = fract(h) * 6.2831853;\r\n          float r = 0.5 + 0.5 * cos(a);\r\n          float g = 0.5 + 0.5 * cos(a - 2.0943951);\r\n          float b = 0.5 + 0.5 * cos(a - 4.1887902);\r\n          return vec3(r, g, b);\r\n        }\r\n        // FEATURED gold pearl gradient — narrow hue range so the sheen\r\n        // reads as gold leaf instead of a rainbow, but still moves with\r\n        // domain noise + view direction so it stays alive (not flat).\r\n        // Three-stop: deep gold → amber → creamy white.\r\n        vec3 goldPearlHue(float t) {\r\n          vec3 a = vec3(0.85, 0.62, 0.20); // deep gold\r\n          vec3 b = vec3(1.00, 0.82, 0.40); // amber\r\n          vec3 c = vec3(1.00, 0.92, 0.70); // creamy\r\n          float u = fract(t);\r\n          return u < 0.5\r\n            ? mix(a, b, u * 2.0)\r\n            : mix(b, c, (u - 0.5) * 2.0);\r\n        }\r\n        float shHash21(vec2 p) {\r\n          p = fract(p * vec2(234.34, 435.345));\r\n          p += dot(p, p + 34.23);\r\n          return fract(p.x * p.y);\r\n        }\r\n        float shValueNoise(vec2 p) {\r\n          vec2 i = floor(p);\r\n          vec2 f = fract(p);\r\n          f = f * f * (3.0 - 2.0 * f);\r\n          float a = shHash21(i);\r\n          float b = shHash21(i + vec2(1.0, 0.0));\r\n          float c = shHash21(i + vec2(0.0, 1.0));\r\n          float d = shHash21(i + vec2(1.0, 1.0));\r\n          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);\r\n        }\r\n        float shFbm(vec2 p) {\r\n          float sum = 0.0;\r\n          float amp = 0.5;\r\n          for (int i = 0; i < 4; i++) {\r\n            sum += amp * shValueNoise(p);\r\n            p *= 2.0;\r\n            amp *= 0.5;\r\n          }\r\n          return sum;\r\n        }";

const HOLO_OUTPUT =
  "{\r\n          vec3 Nh = normalize(vNormal);\r\n          vec3 Vh = normalize(vViewPosition);\r\n          vec3 Hv = normalize(Nh + Vh);\r\n          float fres = 1.0 - clamp(dot(Nh, Vh), 0.0, 1.0);\r\n\r\n          // — HOLO RAINBOW on inner wave —\r\n          // For featured cards the wave still gets a holographic kiss but\r\n          // biased toward the gold half of the wheel so it doesn't fight\r\n          // the gold pearl sheen. We compress + warm-shift the hue input.\r\n          // Skipped entirely when uWaveOn is 0 (perf-tuner-driven).\r\n          vec2 wuv = vMapUv;\r\n          float waveFactor = texture2D(uWaveMask, wuv).r;\r\n          if (uWaveOn > 0.5 && waveFactor > 0.004) {\r\n            // Damp the hue rate by NdotV — at grazing angles |Hv.xy| grows,\r\n            // so the raw hue argument sweeps faster across the surface;\r\n            // slowing it keeps bands wide instead of compressed.\r\n            float NdotV = clamp(dot(Nh, Vh), 0.0, 1.0);\r\n            float hueDamp = mix(0.4, 1.0, NdotV);\r\n            float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\r\n            float rawHue = (Hv.x * 1.25 + Hv.y * 1.55 + 0.35) * hueDamp;\r\n            // Ping-pong (cosine) instead of fract() so the spectrum never\r\n            // wraps around the wheel — it slides smoothly back and forth\r\n            // between two endpoints, eliminating the magenta→red seam that\r\n            // any wrapping mapping carries even when the function itself is\r\n            // continuous. Mapped to a sub-arc (0.05 → 0.55: red→yellow→\r\n            // green→cyan) so the loud magenta/violet half of the wheel is\r\n            // never reached and the bounce reads as a foil shimmer.\r\n            float pp = 0.5 - 0.5 * cos(rawHue * 6.2831853);\r\n            float hue = mix(0.05, 0.55, pp) + (ign - 0.5) / 64.0;\r\n            float goldHue = 0.08 + 0.08 * pp;\r\n            hue = mix(hue, goldHue, uFeatured);\r\n            vec3 rbow = holoHueRgb(hue);\r\n            float intensity = 0.4 + 1.2 * pow(fres, 1.1);\r\n            outgoingLight += rbow * waveFactor * intensity * 1.0;\r\n          }\r\n\r\n          // — PEARLESCENT MICRO-SHEEN —\r\n          // Heaviest custom chunk on the card material — 4-octave shFbm\r\n          // runs three times per fragment (grain, domain, viewShift). Whole\r\n          // block skipped when uPearlOn is 0 (perf-tuner-driven).\r\n          if (uPearlOn > 0.5) {\r\n            float albLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));\r\n            float relLuma = albLuma / (uCardLuma + 0.02);\r\n            float brightWeight = pow(clamp(relLuma * 0.95, 0.0, 1.7), 1.5);\r\n\r\n            vec2 pearlUv = vMapUv - Vh.xy * 0.012;\r\n            vec2 grainUv = pearlUv * vec2(480.0, 600.0);\r\n            float grain = shFbm(grainUv);\r\n            vec2 domainUv = pearlUv * vec2(38.0, 48.0);\r\n            float domain = shFbm(domainUv);\r\n            float pearlMask = pow(grain * (0.5 + 0.7 * domain), 1.5);\r\n\r\n            vec2 viewShiftUv = grainUv + Vh.xy * 90.0;\r\n            float grainShifted = shFbm(viewShiftUv);\r\n            float viewCatch = pow(grainShifted, 2.0);\r\n\r\n            float fresShim = pow(1.0 - clamp(dot(Nh, Vh), 0.0, 1.0), 1.5);\r\n\r\n            float sheen = pearlMask * (0.35 + 1.1 * viewCatch) * (0.55 + 0.75 * fresShim);\r\n            sheen *= brightWeight;\r\n\r\n            float hueShift = fract(dot(Hv.xy, vec2(0.55, 0.75)) + domain * 0.4 + 0.1);\r\n            vec3 rainbowPearl = holoHueRgb(hueShift);\r\n            // FEATURED: replace rainbow with the gold gradient. Domain noise\r\n            // still drives where in the gradient we sit so it ripples.\r\n            vec3 goldPearl = goldPearlHue(hueShift);\r\n            vec3 pearlHue = mix(rainbowPearl, goldPearl, uFeatured);\r\n            // Rainbow pearl sits as a kiss over white; gold pearl sits ON\r\n            // gold (heavier mix) so it actually reads as warm metal, not\r\n            // tinted white. Mix factor itself ramps with uFeatured.\r\n            vec3 pearlTint = mix(vec3(1.0), pearlHue, mix(0.28, 0.85, uFeatured));\r\n            pearlTint = mix(pearlTint, diffuseColor.rgb + 0.45, 0.22);\r\n\r\n            outgoingLight += pearlTint * sheen * 1.7;\r\n          }\r\n\r\n          // — FEATURED GOLD METAL SHEEN on frame / metallic regions —\r\n          // The painted frame and footer rules already drive metalness=1\r\n          // through metalnessMap. For featured cards we pour an extra\r\n          // gold-tinted highlight onto those regions, fresnel-weighted so\r\n          // the rim glows when the card tilts. Non-featured cards skip\r\n          // this entirely (uFeatured=0 zeros the contribution).\r\n          if (uFeatured > 0.5) {\r\n            float metalMask = texture2D(uMetalMask, vMapUv).r;\r\n            vec3 goldRim = vec3(1.55, 1.18, 0.55);\r\n            float rimFres = pow(fres, 1.4);\r\n            outgoingLight += goldRim * metalMask * rimFres * 0.55;\r\n          }\r\n        }\r\n        #include <opaque_fragment>";

const GOLD_ALBEDO =
  "#include <map_fragment>\r\n        if (uFeatured > 0.5) {\r\n          float metalMaskAlbedo = texture2D(uMetalMask, vMapUv).r;\r\n          // Saturated leaf-gold albedo. Slight darkening retained at\r\n          // 0.92 mix so the metallic sheen has somewhere to brighten\r\n          // toward, instead of flat-saturating the colour.\r\n          vec3 goldAlbedo = vec3(0.95, 0.72, 0.28);\r\n          diffuseColor.rgb = mix(diffuseColor.rgb, goldAlbedo, metalMaskAlbedo * 0.92);\r\n        }";

const ROUGHNESS_SAMPLE =
  "float roughnessFactor = roughness;\r\n#ifdef USE_ROUGHNESSMAP\r\n  vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\r\n  roughnessFactor *= texelRoughness.r;\r\n#endif";

const METALNESS_SAMPLE =
  "float metalnessFactor = metalness;\r\n#ifdef USE_METALNESSMAP\r\n  vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );\r\n  metalnessFactor *= texelMetalness.r;\r\n#endif";
