import * as THREE from "three";

/**
 * The reference meadow, ported from the user's authored Karma Tracks grass world.
 * Coordinates stay faithful to that world: local XY is the ground; +Z is up.
 * Attach group to the card grid; attach ambience directly to the main scene.
 */
export const GRASS_STAGE = Object.freeze({
  groundZ: 0.38,
  restDz: 0.055,
  cardR: 0.32,
  tiltX: -0.21,
  bladeMinH: 0.12,
  bladeMaxH: 0.24,
  sunLocal: [3, -2, 5],
});
const DEFAULT_CARD_W = 0.78;
const DEFAULT_CARD_H = 0.975;

const WORLD_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const BRUSH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function hash(value) {
  const result = 43758.5453123 * Math.sin(value);
  return result - Math.floor(result);
}

function noise(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const cell = (a, b) => hash(127.1 * a + 311.7 * b + 0.123);
  return (
    cell(ix, iy) * (1 - sx) * (1 - sy) +
    cell(ix + 1, iy) * sx * (1 - sy) +
    cell(ix, iy + 1) * (1 - sx) * sy +
    cell(ix + 1, iy + 1) * sx * sy
  );
}

function smoothstep(low, high, value) {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function slotIndex(slots, reach) {
  const cells = new Map();
  const empty = [];
  for (const slot of slots) {
    const item = {
      x: slot.x,
      y: slot.y,
      cos: Math.cos(-slot.rz),
      sin: Math.sin(-slot.rz),
    };
    for (
      let x = Math.floor(slot.x - reach);
      x <= Math.floor(slot.x + reach);
      x++
    ) {
      for (
        let y = Math.floor(slot.y - reach);
        y <= Math.floor(slot.y + reach);
        y++
      ) {
        const key = `${x}:${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      }
    }
  }
  return {
    near: (x, y) => cells.get(`${Math.floor(x)}:${Math.floor(y)}`) || empty,
  };
}

function makeAtlas(draw, size = 160) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * 2;
  const ctx = canvas.getContext("2d");
  for (let cell = 0; cell < 4; cell++) {
    ctx.save();
    ctx.translate((cell % 2) * size, Math.floor(cell / 2) * size);
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();
    draw(ctx, size, 17.31 * cell + 3.7);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function flowerShadow(ctx, size, radius, opacity) {
  const shadow = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0.02 * size,
    size / 2,
    size / 2,
    radius,
  );
  shadow.addColorStop(0, `rgba(16,34,14,${opacity})`);
  shadow.addColorStop(1, "rgba(16,34,14,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, size, size);
}

function drawDaisy(ctx, size, seed) {
  const cx = size / 2,
    cy = size / 2;
  flowerShadow(ctx, size, 0.36 * size, 0.4);
  const petals = 10 + Math.floor(4 * hash(3.17 * seed));
  const yaw = hash(5.3 * seed) * Math.PI * 2;
  for (let i = 0; i < petals; i++) {
    const angle =
      yaw + (i / petals) * Math.PI * 2 + (hash(7.7 * seed + i) - 0.5) * 0.22;
    const length =
      size *
      (hash(27.1 * seed + i) < 0.12
        ? 0.19
        : 0.27 + 0.08 * hash(11.3 * seed + i));
    const width = size * (0.052 + 0.02 * hash(13.9 * seed + i));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const petal = ctx.createLinearGradient(0, -0.06 * size, 0, -length);
    petal.addColorStop(0, "#b9b394");
    petal.addColorStop(0.35, "#efecdc");
    petal.addColorStop(1, hash(31.7 * seed + i) < 0.25 ? "#fef7ee" : "#ffffff");
    ctx.fillStyle = petal;
    ctx.beginPath();
    ctx.ellipse(
      0,
      -(length + 0.06 * size) / 2,
      width,
      (length - 0.06 * size) / 2 + 0.03 * size,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (hash(41.3 * seed + i) < 0.5) {
      ctx.strokeStyle = "rgba(150,145,120,0.35)";
      ctx.lineWidth = 0.008 * size;
      ctx.beginPath();
      ctx.moveTo(0, -0.09 * size);
      ctx.lineTo(0, -0.85 * length);
      ctx.stroke();
    }
    ctx.restore();
  }
  let gradient = ctx.createRadialGradient(
    cx,
    cy,
    0.04 * size,
    cx,
    cy,
    0.16 * size,
  );
  gradient.addColorStop(0, "rgba(70,60,20,0.45)");
  gradient.addColorStop(1, "rgba(70,60,20,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.16 * size, 0, Math.PI * 2);
  ctx.fill();
  gradient = ctx.createRadialGradient(
    cx - 0.02 * size,
    cy - 0.03 * size,
    0.01 * size,
    cx,
    cy,
    0.105 * size,
  );
  gradient.addColorStop(0, "#ffe163");
  gradient.addColorStop(0.75, "#eab427");
  gradient.addColorStop(1, "#b97f10");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.1 * size, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 26; i++) {
    const r = Math.sqrt(hash(51.7 * seed + i)) * size * 0.085;
    const a = hash(57.1 * seed + i) * Math.PI * 2;
    ctx.fillStyle =
      hash(61.3 * seed + i) < 0.5
        ? "rgba(197,141,15,0.8)"
        : "rgba(255,229,120,0.9)";
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      0.011 * size,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawClover(ctx, size, seed) {
  const leaves = hash(2.9 * seed) < 0.25 ? 4 : 3;
  const yaw = hash(4.1 * seed) * Math.PI * 2;
  for (let i = 0; i < leaves; i++) {
    const scale = 0.85 + 0.3 * hash(6.7 * seed + i);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(
      yaw + ((Math.PI * 2) / leaves) * i + (hash(8.3 * seed + i) - 0.5) * 0.2,
    );
    ctx.scale(scale, scale);
    const gradient = ctx.createLinearGradient(0, -0.1 * size, 0, -0.34 * size);
    gradient.addColorStop(0, "#38622c");
    gradient.addColorStop(1, "#5b8a47");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(
      -0.07 * size,
      -0.22 * size,
      0.095 * size,
      0.13 * size,
      -0.35,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      0.07 * size,
      -0.22 * size,
      0.095 * size,
      0.13 * size,
      0.35,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.strokeStyle = "rgba(205,230,175,0.7)";
    ctx.lineWidth = 0.02 * size;
    ctx.beginPath();
    ctx.moveTo(-0.05 * size, -0.16 * size);
    ctx.lineTo(0, -0.24 * size);
    ctx.lineTo(0.05 * size, -0.16 * size);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDandelion(ctx, size, seed) {
  const cx = size / 2,
    cy = size / 2;
  flowerShadow(ctx, size, 0.3 * size, 0.38);
  for (const [count, length, root, tip] of [
    [20, 0.3, "#d99e12", "#f3c722"],
    [15, 0.22, "#eebd1c", "#fbd83e"],
    [10, 0.14, "#f8d335", "#ffe56a"],
  ]) {
    for (let i = 0; i < count; i++) {
      const angle =
        (i / count) * Math.PI * 2 +
        0.8 * hash(9.1 * seed + count) +
        (hash(12.7 * seed + 3.1 * i + count) - 0.5) * 0.24;
      const extent =
        size * length * (0.85 + 0.3 * hash(15.3 * seed + i + count));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(0, 0, 0, -extent);
      gradient.addColorStop(0, root);
      gradient.addColorStop(1, tip);
      ctx.fillStyle = gradient;
      const w = 0.026 * size;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.lineTo(-0.75 * w, -extent);
      ctx.lineTo(-0.28 * w, -0.92 * extent);
      ctx.lineTo(0, -extent);
      ctx.lineTo(0.28 * w, -0.92 * extent);
      ctx.lineTo(0.75 * w, -extent);
      ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    0.005 * size,
    cx,
    cy,
    0.07 * size,
  );
  gradient.addColorStop(0, "#c68d0c");
  gradient.addColorStop(1, "#9d6a08");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.065 * size, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 14; i++) {
    const radius = Math.sqrt(hash(21.7 * seed + i)) * size * 0.05,
      angle = hash(24.1 * seed + i) * Math.PI * 2;
    ctx.fillStyle = "rgba(255,222,90,0.85)";
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
      0.009 * size,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawPuff(ctx, size, seed) {
  const cx = size / 2,
    cy = size / 2;
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    0.02 * size,
    cx,
    cy,
    0.36 * size,
  );
  gradient.addColorStop(0, "rgba(250,250,240,0.5)");
  gradient.addColorStop(0.7, "rgba(250,250,240,0.16)");
  gradient.addColorStop(1, "rgba(250,250,240,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const count = 32 + Math.floor(12 * hash(2.3 * seed));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.2 * hash(7.77 * seed + i);
    const radius = size * (0.22 + 0.12 * hash(3.13 * seed + i));
    const x = cx + Math.cos(angle) * radius,
      y = cy + Math.sin(angle) * radius;
    ctx.strokeStyle = "rgba(252,252,246,0.45)";
    ctx.lineWidth = 0.007 * size;
    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(angle) * size * 0.05,
      cy + Math.sin(angle) * size * 0.05,
    );
    ctx.lineTo(x, y);
    ctx.stroke();
    for (let j = -1; j <= 1; j++) {
      const a = angle + 0.22 * j;
      ctx.strokeStyle = "rgba(255,255,250,0.7)";
      ctx.lineWidth = 0.005 * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(a) * size * 0.035,
        y + Math.sin(a) * size * 0.035,
      );
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#cfc7a6";
  ctx.beginPath();
  ctx.arc(cx, cy, 0.04 * size, 0, Math.PI * 2);
  ctx.fill();
}

function makeCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  let seed = 9;
  const random = () => hash(12.9898 * seed++);
  for (let i = 0; i < 11; i++) {
    const x = 512 * random(),
      y = 512 * random(),
      radius = 512 * (0.12 + 0.2 * random()),
      opacity = 0.26 + 0.18 * random();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const cx = x + 512 * dx,
          cy = y + 512 * dy;
        const gradient = ctx.createRadialGradient(
          cx,
          cy,
          0.12 * radius,
          cx,
          cy,
          radius,
        );
        gradient.addColorStop(0, `rgba(16,28,14,${opacity})`);
        gradient.addColorStop(1, "rgba(16,28,14,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - radius, cy - radius, 2 * radius, 2 * radius);
      }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCardShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 12.8, 64, 64, 64);
  gradient.addColorStop(0, "rgba(15,35,15,0.55)");
  gradient.addColorStop(1, "rgba(15,35,15,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const FLOWERS = {
  clover: {
    step: 0.12,
    seed: 202,
    accept: (x, y, r) =>
      noise(0.7 * x + 13.9, 0.7 * y + 27.4) > 0.62 && r < 0.7,
    hMin: 0.12,
    hMax: 0.16,
    sMin: 0.085,
    sMax: 0.12,
    tiltMax: 0.12,
    draw: drawClover,
  },
  daisy: {
    step: 0.17,
    seed: 101,
    accept: (x, y, r) => noise(0.55 * x + 7.7, 0.55 * y + 3.1) > 0.6 && r < 0.5,
    hMin: 0.19,
    hMax: 0.25,
    sMin: 0.09,
    sMax: 0.13,
    tiltMax: 0.22,
    draw: drawDaisy,
  },
  dandelion: {
    step: 0.3,
    seed: 303,
    accept: (x, y, r) =>
      r < 0.1 && noise(0.45 * x + 41.2, 0.45 * y + 11.8) > 0.45,
    hMin: 0.24,
    hMax: 0.3,
    sMin: 0.13,
    sMax: 0.18,
    tiltMax: 0.18,
    draw: drawDandelion,
  },
  puff: {
    step: 0.34,
    seed: 404,
    accept: (x, y, r) =>
      r < 0.07 && noise(0.45 * x + 61.9, 0.45 * y + 3.4) > 0.4,
    hMin: 0.26,
    hMax: 0.33,
    sMin: 0.11,
    sMax: 0.15,
    tiltMax: 0.12,
    draw: drawPuff,
  },
};

function createBladeBand(
  {
    fieldW,
    fieldH,
    fieldCy,
    step,
    nx,
    ny,
    bandRows,
    basePos,
    baseIdx,
    slots,
    cardW,
    cardH,
  },
  band,
) {
  const y0 = fieldCy - fieldH / 2,
    startRow = band * bandRows,
    endRow = Math.min(ny, startRow + bandRows);
  if (startRow >= endRow) return null;
  const capacity = nx * (endRow - startRow);
  const offsets = new Float32Array(capacity * 3),
    angles = new Float32Array(capacity),
    leans = new Float32Array(capacity * 2),
    tints = new Float32Array(capacity),
    shades = new Float32Array(capacity);
  const sun = GRASS_STAGE.sunLocal,
    sunLength = Math.hypot(sun[0], sun[1]) || 1;
  const sx = (-sun[0] / sunLength) * 0.16,
    sy = (-sun[1] / sunLength) * 0.16;
  let count = 0;
  for (let col = 0; col < nx; col++) {
    const gx = -fieldW / 2 + col * step;
    for (let row = startRow; row < endRow; row++) {
      const gy = y0 + row * step,
        seed = ((8191 * col + 131071 * row) & 65535) + 1;
      const x = gx + (hash(7.13 * seed) - 0.5) * step * 1.6,
        y = gy + (hash(3.71 * seed) - 0.5) * step * 1.6;
      const nearby = slots.near(x, y);
      let underCard = false;
      for (const slot of nearby) {
        const dx = x - slot.x,
          dy = y - slot.y,
          rx = dx * slot.cos - dy * slot.sin,
          ry = dx * slot.sin + dy * slot.cos;
        if (Math.abs(rx) < 0.485 * cardW && Math.abs(ry) < 0.485 * cardH) {
          underCard = true;
          break;
        }
      }
      if (underCard) continue;
      const yaw =
        noise(0.9 * x, 0.9 * y) * Math.PI * 4 + (hash(29.7 * seed) - 0.5) * 2.6;
      const lean =
        0.3 +
        0.75 * noise(1.4 * x + 17.3, 1.4 * y + 9.1) +
        0.55 * hash(41.3 * seed);
      let lx = Math.cos(yaw) * lean,
        ly = Math.sin(yaw) * lean;
      let shade =
        0.72 +
        0.55 * noise(0.75 * x + 31.7, 0.75 * y + 5.9) +
        (hash(53.9 * seed) - 0.5) * 0.1;
      for (const slot of nearby) {
        const dx = x - slot.x,
          dy = y - slot.y,
          rx = dx * slot.cos - dy * slot.sin,
          ry = dx * slot.sin + dy * slot.cos;
        if (Math.abs(rx) < 0.6 * cardW && Math.abs(ry) < 0.6 * cardH) {
          const d = Math.hypot(dx, dy) || 1;
          lx = (dx / d) * 1.15;
          ly = (dy / d) * 1.15;
        }
        const qx = dx - sx,
          qy = dy - sy;
        const distance = Math.max(
          Math.abs(qx * slot.cos - qy * slot.sin) / (0.62 * cardW),
          Math.abs(qx * slot.sin + qy * slot.cos) / (0.62 * cardH),
        );
        if (distance < 1) shade *= 0.58 + 0.42 * smoothstep(0.55, 1, distance);
      }
      offsets[count * 3] = x;
      offsets[count * 3 + 1] = y;
      offsets[count * 3 + 2] =
        GRASS_STAGE.bladeMinH +
        hash(11.31 * seed) * (GRASS_STAGE.bladeMaxH - GRASS_STAGE.bladeMinH);
      angles[count] = hash(17.77 * seed) * Math.PI * 2;
      leans[count * 2] = lx;
      leans[count * 2 + 1] = ly;
      tints[count] = hash(23.23 * seed);
      shades[count] = Math.min(1.25, Math.max(0.3, shade));
      count++;
    }
  }
  if (!count) return null;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(basePos, 3),
  );
  geometry.setIndex(baseIdx.slice());
  geometry.setAttribute(
    "aOffset",
    new THREE.InstancedBufferAttribute(offsets.subarray(0, count * 3), 3),
  );
  geometry.setAttribute(
    "aAngle",
    new THREE.InstancedBufferAttribute(angles.subarray(0, count), 1),
  );
  geometry.setAttribute(
    "aLean",
    new THREE.InstancedBufferAttribute(leans.subarray(0, count * 2), 2),
  );
  geometry.setAttribute(
    "aTint",
    new THREE.InstancedBufferAttribute(tints.subarray(0, count), 1),
  );
  geometry.setAttribute(
    "aShade",
    new THREE.InstancedBufferAttribute(shades.subarray(0, count), 1),
  );
  geometry.instanceCount = count;
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(
      0,
      y0 + ((startRow + endRow) / 2) * step,
      GRASS_STAGE.groundZ + 0.12,
    ),
    Math.hypot(fieldW / 2, (bandRows * step) / 2 + 0.4) + 0.4,
  );
  return geometry;
}

function createFlowerGeometry(
  type,
  { fieldW, fieldH, fieldCy, slots, cardW, cardH, flowerStepScale },
) {
  const cfg = FLOWERS[type],
    step = cfg.step * flowerStepScale;
  const offsets = [],
    scales = [],
    yaws = [],
    tilts = [],
    shades = [],
    phases = [],
    uvOffsets = [];
  const sun = GRASS_STAGE.sunLocal,
    sunLength = Math.hypot(sun[0], sun[1]) || 1;
  const sx = (-sun[0] / sunLength) * 0.16,
    sy = (-sun[1] / sunLength) * 0.16;
  let seed = cfg.seed;
  for (let gx = -fieldW / 2; gx <= fieldW / 2; gx += step)
    for (
      let gy = fieldCy - fieldH / 2;
      gy <= fieldCy + fieldH / 2;
      gy += step
    ) {
      const x = gx + (hash(5.21 * ++seed) - 0.5) * step * 1.4,
        y = gy + (hash(9.47 * seed) - 0.5) * step * 1.4;
      if (!cfg.accept(x, y, hash(3.33 * seed))) continue;
      let shade = 0.78 + 0.4 * noise(0.75 * x + 31.7, 0.75 * y + 5.9),
        underCard = false;
      for (const slot of slots.near(x, y)) {
        const dx = x - slot.x,
          dy = y - slot.y,
          rx = dx * slot.cos - dy * slot.sin,
          ry = dx * slot.sin + dy * slot.cos;
        if (Math.abs(rx) < 0.68 * cardW && Math.abs(ry) < 0.68 * cardH) {
          underCard = true;
          break;
        }
        const qx = dx - sx,
          qy = dy - sy;
        const distance = Math.max(
          Math.abs(qx * slot.cos - qy * slot.sin) / (0.62 * cardW),
          Math.abs(qx * slot.sin + qy * slot.cos) / (0.62 * cardH),
        );
        if (distance < 1) shade *= 0.6 + 0.4 * smoothstep(0.55, 1, distance);
      }
      if (underCard) continue;
      offsets.push(x, y, cfg.hMin + hash(13.7 * seed) * (cfg.hMax - cfg.hMin));
      scales.push(cfg.sMin + hash(19.3 * seed) * (cfg.sMax - cfg.sMin));
      yaws.push(hash(23.9 * seed) * Math.PI * 2);
      const yaw = hash(31.1 * seed) * Math.PI * 2,
        tilt = hash(37.7 * seed) * cfg.tiltMax;
      tilts.push(Math.cos(yaw) * tilt, Math.sin(yaw) * tilt);
      shades.push(Math.min(1.15, Math.max(0.45, shade)));
      phases.push(1.35 * x - 1.9 * y + 1.2 * hash(43.1 * seed));
      const cell = Math.floor(4 * hash(57.7 * seed));
      uvOffsets.push((cell % 2) * 0.5, Math.floor(cell / 2) * 0.5);
    }
  const plane = new THREE.PlaneGeometry(1, 1),
    geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(plane.getIndex().clone());
  geometry.setAttribute("position", plane.getAttribute("position").clone());
  geometry.setAttribute("uv", plane.getAttribute("uv").clone());
  plane.dispose();
  for (const [name, values, size] of [
    ["aOffset", offsets, 3],
    ["aScale", scales, 1],
    ["aYaw", yaws, 1],
    ["aTilt", tilts, 2],
    ["aShade", shades, 1],
    ["aPhase", phases, 1],
    ["aUvOff", uvOffsets, 2],
  ]) {
    geometry.setAttribute(
      name,
      new THREE.InstancedBufferAttribute(new Float32Array(values), size),
    );
  }
  geometry.instanceCount = offsets.length / 3;
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, fieldCy, GRASS_STAGE.groundZ + 0.2),
    Math.hypot(fieldW, fieldH) / 2 + 1,
  );
  return geometry;
}

/**
 * @param {object} options
 * @param {THREE.WebGLRenderer} options.renderer The same renderer used by the world.
 * @param {number} options.fieldW Width of the local XY meadow.
 * @param {number} options.fieldH Height of the local XY meadow.
 * @param {{x:number,y:number,rz:number}[]} options.slots Static card footprints.
 * @param {'high'|'balanced'|'low'} [options.quality='high'] Density only; preserves the authored look.
 * @param {boolean} [options.convertOutput=true] Set false only when intentionally reproducing the original unconverted direct render.
 */
export function createGrassField({
  renderer,
  parent = null,
  ambienceParent = null,
  fieldW = 14,
  fieldH = 18,
  fieldCy = 0,
  slots = [],
  cardW = DEFAULT_CARD_W,
  cardH = DEFAULT_CARD_H,
  quality = "high",
  reducedMotion = false,
  textureUrl = (import.meta.env.BASE_URL + "reference/ground-grass3.webp"),
  convertOutput = true,
} = {}) {
  if (!renderer)
    throw new Error("createGrassField requires the world WebGLRenderer.");
  const group = new THREE.Group(),
    ambience = new THREE.Group();
  group.name = "Reactive meadow";
  ambience.name = "Meadow atmosphere";
  if (parent) parent.add(group);
  if (ambienceParent) ambienceParent.add(ambience);
  const textures = new Set(),
    materials = new Set(),
    geometries = new Set();
  const keepTexture = (texture) => {
    textures.add(texture);
    return texture;
  };
  const keepGeometry = (geometry) => {
    geometries.add(geometry);
    return geometry;
  };
  const output = (shader) =>
    convertOutput
      ? shader.replace(
          /}\s*$/,
          "\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
        )
      : shader;
  const material = (options) => {
    const value = new THREE.ShaderMaterial(options);
    materials.add(value);
    return value;
  };
  const shared = {
    uTime: { value: 0 },
    uGrow: { value: 0 },
    uGrowC: { value: new THREE.Vector2(0, 0) },
    uGrowR: { value: 11 },
    uWake: { value: new THREE.Vector2(999, 999) },
    uPush: { value: 0 },
    uEdgeY: {
      value: new THREE.Vector2(
        fieldCy + fieldH / 2 + 50,
        fieldCy + fieldH / 2 + 51,
      ),
    },
    uCombTex: { value: null },
    uCombRect: {
      value: new THREE.Vector4(
        -fieldW / 2,
        fieldCy - fieldH / 2,
        1 / fieldW,
        1 / fieldH,
      ),
    },
    uCombOn: { value: 0 },
  };
  const fog = {
    uFogColor: { value: new THREE.Color("#f2e7d3") },
    uFogNear: { value: 4.2 },
    uFogFar: { value: 9.2 },
  };
  const sun = new THREE.Vector3(...GRASS_STAGE.sunLocal).normalize();
  const groundMaterial = material({
    vertexShader: GROUND_VERTEX,
    fragmentShader: output(GROUND_FRAGMENT),
    uniforms: {
      uMap: { value: null },
      uMapOn: { value: 0 },
      uTint: { value: new THREE.Color("#6f7d5a") },
      uBase: { value: new THREE.Color("#33502a") },
      uGrow: shared.uGrow,
      uGrowC: shared.uGrowC,
      uGrowR: shared.uGrowR,
      uEdgeY: shared.uEdgeY,
      ...fog,
    },
    transparent: true,
    depthWrite: true,
  });
  const groundTexture = keepTexture(
    new THREE.TextureLoader().load(
      textureUrl,
      () => {
        if (!disposed) groundMaterial.uniforms.uMapOn.value = 1;
      },
      undefined,
      () => {
        /* The authored base colour remains a complete fallback. */
      },
    ),
  );
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.anisotropy = Math.min(
    4,
    renderer.capabilities.getMaxAnisotropy(),
  );
  groundMaterial.uniforms.uMap.value = groundTexture;
  const bladeMaterial = material({
    vertexShader: BLADE_VERTEX,
    fragmentShader: output(BLADE_FRAGMENT),
    uniforms: {
      ...shared,
      ...fog,
      uWind: { value: reducedMotion ? 0 : 1 },
      uGroundZ: { value: GRASS_STAGE.groundZ },
      uRoot: { value: new THREE.Color("#26491f") },
      uTip: { value: new THREE.Color("#a3c95c") },
      uTip2: { value: new THREE.Color("#588f43") },
      uSunDir: { value: sun },
      uSunXY: { value: new THREE.Vector2(sun.x, sun.y).normalize() },
      uSunCol: { value: new THREE.Color("#fff3cf") },
      uSheen: { value: 1 },
      uCombBend: { value: 1.7 },
      uStripe: { value: 1 },
      uLaidLift: { value: 0.35 },
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
  });
  const flowerMaterials = {};
  for (const [type, cfg] of Object.entries(FLOWERS)) {
    flowerMaterials[type] = material({
      vertexShader: FLORA_VERTEX,
      fragmentShader: output(FLORA_FRAGMENT),
      uniforms: {
        ...shared,
        ...fog,
        uMap: { value: keepTexture(makeAtlas(cfg.draw)) },
        uWind: { value: reducedMotion ? 0 : 1 },
        uGroundZ: { value: GRASS_STAGE.groundZ },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
  }
  const pollenMaterial = material({
    vertexShader: POLLEN_VERTEX,
    fragmentShader: output(POLLEN_FRAGMENT),
    uniforms: {
      uTime: shared.uTime,
      uGrow: shared.uGrow,
      uArea: { value: new THREE.Vector2(fieldW / 2, fieldH / 2) },
      uAreaC: { value: new THREE.Vector2(0, fieldCy) },
      uScale: { value: 0.45 },
    },
    transparent: true,
    depthWrite: false,
  });
  const groundGeometry = keepGeometry(new THREE.PlaneGeometry(fieldW, fieldH));
  groundGeometry.translate(0, fieldCy, 0);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.z = GRASS_STAGE.groundZ;
  ground.frustumCulled = false;
  group.add(ground);

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: keepTexture(makeCardShadowTexture()),
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  materials.add(shadowMaterial);
  const shadows = new THREE.InstancedMesh(
    keepGeometry(new THREE.PlaneGeometry(1, 1)),
    shadowMaterial,
    Math.max(1, slots.length),
  );
  shadows.count = slots.length;
  shadows.renderOrder = 1;
  shadows.frustumCulled = false;
  group.add(shadows);
  const shadowMatrix = new THREE.Matrix4();
  for (let i = 0; i < slots.length; i++) {
    shadowMatrix.makeScale(cardW * 1.22, cardH * 1.22, 1);
    shadowMatrix.setPosition(
      slots[i].x,
      slots[i].y,
      GRASS_STAGE.groundZ + 0.006,
    );
    shadows.setMatrixAt(i, shadowMatrix);
  }
  shadows.instanceMatrix.needsUpdate = true;

  const density =
    quality === "low" ? 65000 : quality === "balanced" ? 125000 : 200000;
  const flowerStepScale =
    quality === "low" ? 1.45 : quality === "balanced" ? 1.15 : 1;
  const minSpacing =
    quality === "low" ? 0.078 : quality === "balanced" ? 0.058 : 0.048;
  const step = Math.max(minSpacing, Math.sqrt((fieldW * fieldH) / density)),
    bandRows = Math.max(1, Math.round(3.5 / step));
  const basePos = [],
    baseIdx = [];
  for (let i = 0; i < 4; i++) {
    const height = i / 4,
      width = 0.017 * (1 - 0.75 * height);
    basePos.push(-width, height, 0, width, height, 0);
  }
  basePos.push(0, 1, 0);
  for (let i = 0; i < 3; i++) {
    const p = i * 2;
    baseIdx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
  }
  baseIdx.push(6, 7, 8);
  const buildConfig = {
    fieldW,
    fieldH,
    fieldCy,
    step,
    nx: Math.floor(fieldW / step) + 1,
    ny: Math.floor(fieldH / step) + 1,
    bandRows,
    basePos,
    baseIdx,
    slots: slotIndex(slots, 0.62 * cardH + 0.3),
    cardW,
    cardH,
    flowerStepScale,
  };
  const bandCount = Math.max(1, Math.ceil(buildConfig.ny / bandRows)),
    flowerTypes = Object.keys(FLOWERS);
  let disposed = false,
    buildFrame = 0,
    buildIndex = 0,
    instanceCount = 0,
    resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const buildNext = () => {
    if (disposed) return;
    if (buildIndex < bandCount) {
      const geometry = createBladeBand(buildConfig, buildIndex);
      if (geometry) {
        keepGeometry(geometry);
        instanceCount += geometry.instanceCount;
        const mesh = new THREE.Mesh(geometry, bladeMaterial);
        mesh.name = `Meadow ribbon band ${buildIndex}`;
        mesh.renderOrder = 2;
        group.add(mesh);
      }
    } else {
      const type = flowerTypes[buildIndex - bandCount];
      const geometry = keepGeometry(createFlowerGeometry(type, buildConfig));
      const mesh = new THREE.Mesh(geometry, flowerMaterials[type]);
      mesh.name = type;
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    buildIndex++;
    if (buildIndex < bandCount + flowerTypes.length)
      buildFrame = requestAnimationFrame(buildNext);
    else resolveReady(true);
  };
  buildNext();

  const pollenPositions = [],
    pollenData = [];
  let pollenSeed = 71;
  const random = () => hash(7.919 * pollenSeed++);
  const totalPollen = Math.round(
    fieldW * fieldH * (quality === "low" ? 1.3 : 2.6),
  );
  const pollenBand = (count, minSize, maxSize) => {
    for (let i = 0; i < count; i++) {
      pollenPositions.push(
        (random() - 0.5) * fieldW,
        fieldCy - fieldH / 2 + random() * fieldH,
        GRASS_STAGE.groundZ + 0.08 + 0.62 * random(),
      );
      pollenData.push(
        0.1 + 0.2 * random(),
        random() * Math.PI * 2,
        minSize + random() * (maxSize - minSize),
      );
    }
  };
  pollenBand(Math.round(0.87 * totalPollen), 0.014, 0.032);
  pollenBand(Math.round(0.13 * totalPollen), 0.05, 0.09);
  const pollenGeometry = keepGeometry(new THREE.BufferGeometry());
  pollenGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(pollenPositions, 3),
  );
  pollenGeometry.setAttribute(
    "aData",
    new THREE.Float32BufferAttribute(pollenData, 3),
  );
  pollenGeometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, fieldCy, GRASS_STAGE.groundZ + 0.4),
    Math.hypot(fieldW, fieldH) / 2 + 1,
  );
  const pollen = new THREE.Points(pollenGeometry, pollenMaterial);
  pollen.name = "Drifting pollen";
  pollen.renderOrder = 5;
  pollen.frustumCulled = false;
  pollen.visible = !reducedMotion;
  group.add(pollen);

  const cloudTexture = keepTexture(makeCloudTexture()),
    cloudMaterial = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
  materials.add(cloudMaterial);
  const cloud = new THREE.Mesh(
    keepGeometry(new THREE.PlaneGeometry(30, 20)),
    cloudMaterial,
  );
  cloud.position.set(0, 0.5, 1.6);
  cloud.renderOrder = 6;
  cloud.frustumCulled = false;
  const skyMaterial = material({
    vertexShader: WORLD_VERTEX,
    fragmentShader: output(SKY_FRAGMENT),
    uniforms: { uGrow: shared.uGrow },
    transparent: true,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(
    keepGeometry(new THREE.PlaneGeometry(34, 16)),
    skyMaterial,
  );
  sky.position.set(0, 1.4, -7);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  ambience.add(sky, cloud);

  const combTarget = new THREE.WebGLRenderTarget(
    quality === "low" ? 128 : 256,
    quality === "low" ? 256 : 512,
    {
      depthBuffer: false,
      stencilBuffer: false,
      type: renderer.extensions.has("EXT_color_buffer_float")
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    },
  );
  const combScene = new THREE.Scene(),
    combCamera = new THREE.OrthographicCamera(
      -fieldW / 2,
      fieldW / 2,
      fieldCy + fieldH / 2,
      fieldCy - fieldH / 2,
      -1,
      1,
    );
  const brushMaterial = material({
    vertexShader: BRUSH_VERTEX,
    fragmentShader: COMB_FRAGMENT,
    uniforms: {
      uDir: { value: new THREE.Vector2(0, 1) },
      uStrength: { value: 0.3 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const brush = new THREE.Mesh(
    keepGeometry(new THREE.PlaneGeometry(1, 1)),
    brushMaterial,
  );
  brush.frustumCulled = false;
  brush.scale.set(0.84, 0.84, 1);
  const relaxMaterial = material({
    vertexShader: BRUSH_VERTEX,
    fragmentShader:
      "uniform float uAlpha; void main(){ gl_FragColor = vec4(.5,.5,0.,uAlpha); }",
    uniforms: { uAlpha: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const relax = new THREE.Mesh(
    keepGeometry(new THREE.PlaneGeometry(1, 1)),
    relaxMaterial,
  );
  relax.frustumCulled = false;
  relax.renderOrder = -1;
  relax.position.set(0, fieldCy, 0);
  relax.scale.set(fieldW, fieldH, 1);
  brush.visible = false;
  combScene.add(brush, relax);
  const previousTarget = renderer.getRenderTarget(),
    previousAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setRenderTarget(combTarget);
  renderer.render(combScene, combCamera);
  renderer.setRenderTarget(previousTarget);
  renderer.autoClear = previousAutoClear;
  shared.uCombTex.value = combTarget.texture;
  shared.uCombOn.value = 1;

  const pointer = {
    target: new THREE.Vector2(999, 999),
    previous: new THREE.Vector2(999, 999),
    has: false,
    active: false,
    speedAvg: 0,
    push: 0,
  };
  const comb = {
    drawing: false,
    last: new THREE.Vector2(),
    queue: [],
    energy: 0,
  };
  const scratchScale = new THREE.Vector3();
  const setPointer = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!pointer.has) {
      pointer.has = true;
      pointer.previous.set(x, y);
      shared.uWake.value.set(x, y);
    }
    pointer.target.set(x, y);
    pointer.active = true;
  };
  const beginComb = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    comb.drawing = true;
    comb.last.set(x, y);
    setPointer(x, y);
  };
  const combTo = (x, y) => {
    if (!comb.drawing || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const dx = x - comb.last.x,
      dy = y - comb.last.y,
      distance = Math.hypot(dx, dy);
    if (distance < 1e-4) return;
    const segments = Math.min(Math.ceil(distance / 0.147), 24);
    for (let i = 1; i <= segments; i++)
      comb.queue.push(
        comb.last.x + (dx * i) / segments,
        comb.last.y + (dy * i) / segments,
        dx / distance,
        dy / distance,
      );
    comb.last.set(x, y);
    comb.energy = 1;
    setPointer(x, y);
  };

  const update = (time, delta, { grow = 1, growCenter = null } = {}) => {
    if (disposed) return;
    const dt = Math.max(0.001, Math.min(delta || 1 / 60, 0.08));
    shared.uTime.value = reducedMotion ? 0 : time;
    shared.uGrow.value = grow;
    if (growCenter) shared.uGrowC.value.copy(growCenter);
    const center = shared.uGrowC.value;
    shared.uGrowR.value =
      Math.hypot(
        Math.abs(center.x) + fieldW / 2,
        Math.max(
          Math.abs(center.y - (fieldCy + fieldH / 2)),
          Math.abs(center.y - (fieldCy - fieldH / 2)),
        ),
      ) + 2;
    group.getWorldScale(scratchScale);
    pollenMaterial.uniforms.uScale.value = scratchScale.x;
    if (pointer.has) {
      const speed = pointer.active
        ? pointer.target.distanceTo(pointer.previous) / dt
        : 0;
      pointer.previous.copy(pointer.target);
      pointer.speedAvg += (speed - pointer.speedAvg) * (1 - Math.exp(-6 * dt));
      const targetPush = Math.min(0.7, 0.25 * pointer.speedAvg),
        rate = targetPush > pointer.push ? 14 : 2.2;
      pointer.push += (targetPush - pointer.push) * (1 - Math.exp(-rate * dt));
      shared.uWake.value.lerp(pointer.target, 1 - Math.exp(-7 * dt));
      shared.uPush.value = pointer.push;
    }
    if (comb.energy > 0.0015 || comb.queue.length) {
      const oldTarget = renderer.getRenderTarget(),
        oldAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(combTarget);
      brush.visible = false;
      relax.visible = true;
      relaxMaterial.uniforms.uAlpha.value = 1 - Math.exp(-0.085 * dt);
      renderer.render(combScene, combCamera);
      comb.energy *= Math.exp(-0.085 * dt);
      if (comb.queue.length) {
        relax.visible = false;
        brush.visible = true;
        const count = Math.min(comb.queue.length, 160);
        for (let i = 0; i < count; i += 4) {
          brush.position.set(comb.queue[i], comb.queue[i + 1], 0);
          brushMaterial.uniforms.uDir.value.set(
            comb.queue[i + 2],
            comb.queue[i + 3],
          );
          renderer.render(combScene, combCamera);
        }
        comb.queue.splice(0, count);
      }
      renderer.setRenderTarget(oldTarget);
      renderer.autoClear = oldAutoClear;
    }
    if (!reducedMotion) {
      cloudTexture.offset.x += 0.009 * dt;
      cloudTexture.offset.y += 0.013 * dt;
    }
    cloudMaterial.opacity = 0.9 * grow;
    shadowMaterial.opacity = 0.5 * grow;
  };

  const setReducedMotion = (value) => {
    reducedMotion = Boolean(value);
    bladeMaterial.uniforms.uWind.value = reducedMotion ? 0 : 1;
    for (const flower of Object.values(flowerMaterials))
      flower.uniforms.uWind.value = reducedMotion ? 0 : 1;
    pollen.visible = !reducedMotion;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(buildFrame);
    resolveReady(false);
    group.removeFromParent();
    ambience.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    for (const value of materials) value.dispose();
    for (const texture of textures) texture.dispose();
    combTarget.dispose();
    shadows.dispose();
    group.clear();
    ambience.clear();
    combScene.clear();
  };
  return {
    group,
    ambience,
    ready,
    update,
    setPointer,
    leavePointer: () => {
      pointer.active = false;
    },
    beginComb,
    combTo,
    endComb: () => {
      comb.drawing = false;
    },
    setReducedMotion,
    dispose,
    shared,
    materials: {
      ground: groundMaterial,
      blade: bladeMaterial,
      flora: flowerMaterials,
      pollen: pollenMaterial,
      cloud: cloudMaterial,
      sky: skyMaterial,
    },
    stats: () => ({
      bladeInstances: instanceCount,
      bands: Math.min(buildIndex, bandCount),
      ready: buildIndex >= bandCount + flowerTypes.length,
      quality,
      disposed,
    }),
  };
}

const BLADE_VERTEX =
  "\n  attribute vec3 aOffset;   // grid x, grid y, blade height\n  attribute float aAngle;   // yaw around +Z\n  attribute vec2 aLean;     // lay-down: stage-XY direction * bend (radians)\n  attribute float aTint;\n  attribute float aShade;   // baked shade: sun patches + card shadows\n  uniform float uTime;\n  uniform float uWind;\n  uniform float uGrow;\n  uniform vec2 uGrowC;\n  uniform float uGrowR;\n  uniform vec2 uWake;       // cursor wake point (grid coords, lagging)\n  uniform float uPush;      // wake strength (cursor-speed driven)\n  uniform float uGroundZ;\n  uniform vec2 uEdgeY;\n  uniform sampler2D uCombTex; // right-drag comb: RG = lay direction, B = amount\n  uniform vec4 uCombRect;   // xy = field min corner (grid coords), zw = 1/size\n  uniform float uCombOn;     // 0 until the comb RT is bound (warmup safety)\n  uniform float uCombBend;   // radians of lay at full comb\n  uniform vec2 uSunXY;       // sun azimuth, normalized — the stripe axis\n  varying float vWake;\n  varying float vGust;\n  varying float vT;\n  varying float vTint;\n  varying float vShade;\n  varying vec3 vNorm;\n  varying vec3 vWorld;\n  varying float vA;\n  varying float vLay;   // signed: how the laid blade sits against the sun\n  varying float vLaid;  // unsigned: how far it is laid at all\n  float gustEnv(float p) {\n    float g = sin(p) * 0.5 + sin(p * 0.37 + 2.1) * 0.5;\n    return smoothstep(0.45, 1.0, g);\n  }\n  // Reveal front. The 0.85 is a WIDTH knob: 1/0.85 ≈ 1.2 grid units from\n  // \"not sprouted\" to \"full height\". It used to be 0.22 — a 4.5-unit ramp,\n  // half the field — so the open dragged a huge halo of 5%-tall blades\n  // across the still-dark room, and that halo read as white/green static\n  // (user, 2026-09-08: \\xabшум при открытии и закрытии\\xbb). Keep it TIGHTER\n  // than the ground's front below so blades always sprout on lawn that has\n  // already faded in, never over the room.\n  float growAt(vec2 p) {\n    float g = clamp((uGrow * uGrowR - length(p - uGrowC)) * 0.85, 0.0, 1.0);\n    return g * g * (3.0 - 2.0 * g);\n  }\n  void main() {\n    vT = position.y;\n    vTint = aTint;\n    vShade = aShade;\n    float g = growAt(aOffset.xy);\n    // HARD CULL for un-sprouted blades. At g = 0 the ribbon's height goes to\n    // zero but its WIDTH doesn't, so every vertex lands on one line through\n    // aOffset: a mathematically zero-area triangle. Zero area should mean\n    // zero fragments — except the collapse happens after the MVP in float\n    // precision, so a sliver of area survives here and there, and across the\n    // field's ~200k instances that is several hundred stray tip-coloured\n    // pixels. That is the yellow-green static the user saw over the whole\n    // dark room whenever the lawn was mounted but not yet grown (open AND\n    // close, pop only — snow has no blade field). Pushing the vertex outside\n    // the clip cube kills it before rasterisation, which is also cheaper\n    // than letting the fragment stage sort it out.\n    if (g <= 0.0005) {\n      vWake = 0.0; vGust = 0.0; vTint = 0.0; vShade = 0.0;\n      vNorm = vec3(0.0, 0.0, 1.0); vWorld = vec3(0.0); vA = 0.0;\n      vLay = 0.0; vLaid = 0.0;\n      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\n      return;\n    }\n    float c = cos(aAngle), s = sin(aAngle);\n    // ribbon: width along yaw in the ground plane, length along +Z (grows\n    // out of the ground with the radial reveal)\n    vec3 p = vec3(position.x * c, position.x * s, position.y * aOffset.z * g);\n    // cursor wake: blades near the lagging wake point get pushed away, with\n    // per-blade susceptibility + deflection chaos (ragged cowlick, no stamp)\n    vec2 toBlade = aOffset.xy - uWake;\n    float mDist = length(toBlade);\n    float mj = fract(sin(dot(aOffset.xy, vec2(127.1, 311.7))) * 43758.5453);\n    float mInfl = smoothstep(0.55, 0.04, mDist) * uPush * (0.4 + 1.2 * mj);\n    vWake = mInfl;\n    vec2 pd = mDist > 1e-4 ? toBlade / mDist : vec2(0.0);\n    float ja = (mj - 0.5) * 1.7;\n    float cj = cos(ja), sj = sin(ja);\n    pd = vec2(pd.x * cj - pd.y * sj, pd.x * sj + pd.y * cj);\n    // gust fronts travel downwind; oscillation phase-locked to the SAME\n    // travelling phase so the bounce-back ripples with the front\n    float gph = dot(aOffset.xy, vec2(0.58, -0.82)) * 0.9 + uTime * 2.2;\n    float gustNow = gustEnv(gph);\n    float gust = gustNow * uWind;\n    vGust = gust;\n    float rel = max(0.0, gustEnv(gph - 1.0) - gustNow)\n              + 0.55 * max(0.0, gustEnv(gph - 2.1) - gustNow)\n              + 0.3 * max(0.0, gustEnv(gph - 3.3) - gustNow);\n    float ring = rel * sin(gph * 4.5 + mj * 1.3) * 0.45 * uWind;\n    // Comb: the world's verb. A right-drag stamps stroke DIRECTION into an\n    // RT (RG) with an amount (B) that decays back to neutral over ~30s, so\n    // the lane you brushed lies down and then stands up again. Direction is\n    // re-normalized rather than read at its stored length: RG and B fade\n    // toward neutral together, and multiplying two fading numbers would\n    // make the lane collapse quadratically instead of relaxing.\n    vec3 comb = texture2D(uCombTex, (aOffset.xy - uCombRect.xy) * uCombRect.zw).rgb;\n    vec2 combV = (comb.rg - 0.5) * 2.0;\n    float combLen = length(combV);\n    vec2 combDir = combLen > 1e-4 ? combV / combLen : vec2(0.0);\n    // per-blade susceptibility: a stamped lane with one bend angle reads as\n    // a decal, the same way the wake did before its chaos term\n    float combAmt = comb.b * uCombOn * (0.55 + 0.9 * mj);\n    vec2 leanVec = aLean + pd * mInfl * 2.2\n                 + combDir * (combAmt * uCombBend)\n                 + vec2(-0.58, 0.82) * (gust * (0.5 + 0.35 * mj) + ring);\n    float leanAmt = min(length(leanVec), 1.5);\n    vec2 leanDir = length(leanVec) > 1e-5 ? normalize(leanVec) : vec2(1.0, 0.0);\n    float phase = aOffset.x * 1.35 - aOffset.y * 1.9;\n    float w = sin(uTime * 1.4 + phase) * 0.6\n            + sin(uTime * 2.3 + phase * 1.7 + 1.3) * 0.4;\n    float theta = (leanAmt + w * (0.14 + 0.2 * gust) * uWind)\n                * pow(max(vT, 0.0), 1.3);\n    float st = sin(theta);\n    // Mower stripes, and the reason the verb is worth having: a blade lying\n    // across the sun turns its broad lit face up, one lying with the sun\n    // shows its edge and its own shadow. Signed dot → your stroke reads\n    // bright one way and dark the other; the unsigned term keeps a stroke\n    // square to the sun from being invisible.\n    vLay = combAmt * st * dot(leanDir, uSunXY);\n    vLaid = combAmt * st;\n    vec2 xy = p.xy + leanDir * (p.z * st);\n    float pz = p.z * cos(theta);\n    vec3 lp = vec3(aOffset.x + xy.x, aOffset.y + xy.y, uGroundZ + pz);\n    // ribbon normal, twisted per blade, tipped toward +Z as it lies down\n    vec3 n0 = vec3(-s, c, 0.0);\n    float tw = (fract(sin(aAngle * 57.29) * 4375.85) - 0.5) * 0.9;\n    n0 = normalize(n0 + vec3(leanDir, 0.0) * tw);\n    vec3 nl = normalize(mix(n0, vec3(0.0, 0.0, 1.0), st * 0.85));\n    vNorm = normalize(mat3(modelMatrix) * nl);\n    vec4 wp = modelMatrix * vec4(lp, 1.0);\n    vWorld = wp.xyz;\n    vA = 1.0 - smoothstep(uEdgeY.x, uEdgeY.y, aOffset.y);\n    gl_Position = projectionMatrix * viewMatrix * wp;\n  }\n";

const BLADE_FRAGMENT =
  "\n  uniform vec3 uRoot;\n  uniform vec3 uTip;\n  uniform vec3 uTip2;\n  uniform vec3 uSunDir;\n  uniform vec3 uSunCol;\n  uniform float uSheen;\n  uniform float uStripe; // signed comb contrast (the mower-stripe amount)\n  uniform float uLaidLift; // unsigned: laid grass reads a touch brighter\n  uniform vec3 uFogColor;\n  uniform float uFogNear;\n  uniform float uFogFar;\n  varying float vLay;\n  varying float vLaid;\n  varying float vWake;\n  varying float vGust;\n  varying float vT;\n  varying float vTint;\n  varying float vShade;\n  varying vec3 vNorm;\n  varying vec3 vWorld;\n  varying float vA;\n  void main() {\n    if (vA < 0.01) discard;\n    vec3 N = normalize(vNorm);\n    if (!gl_FrontFacing) N = -N;\n    vec3 L = normalize(uSunDir);\n    vec3 tip = mix(uTip, uTip2, vTint);\n    // pow(max(…)) — a bare pow(vT, 0.9) NaN'd at the root vertices on\n    // ANGLE and one NaN pixel through mipmap-blur bloom blacks the whole\n    // frame (see r3f_nan_pixel_bloom_black_frame)\n    vec3 col = mix(uRoot, tip, pow(max(vT, 0.0), 0.9));\n    col *= mix(0.84, 1.14, fract(vTint * 7.31));\n    col *= mix(0.5, 1.0, smoothstep(0.0, 0.55, vT)); // root AO\n    float ndl = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);\n    col *= mix(0.7, 1.18, ndl);\n    col *= vShade;\n    col *= 1.0 - 0.35 * min(vWake, 1.0); // pressed grass sits in shadow\n    col *= 1.0 + 0.09 * vGust;           // silvery gust shimmer\n    col *= max(1.0 + uStripe * vLay + uLaidLift * vLaid, 0.0); // comb stripes\n    vec3 V = normalize(cameraPosition - vWorld);\n    vec3 H = normalize(L + V);\n    float spec = pow(max(dot(N, H), 0.0), 30.0);\n    col += uSunCol * spec * (0.2 + 0.6 * vT) * uSheen * vShade;\n    float fogK = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWorld));\n    col = mix(col, uFogColor, fogK);\n    // horizon: the far end doesn't just go transparent, it goes to haze —\n    // half-alpha dark green over the cream page read as a dirty grey band\n    // instead of grass dissolving into distance\n    col = mix(uFogColor, col, clamp(vA, 0.0, 1.0));\n    gl_FragColor = vec4(col, vA);\n  }\n";

const GROUND_VERTEX =
  "\n  varying vec2 vP;\n  varying vec3 vWorld;\n  void main() {\n    vP = position.xy;\n    vec4 wp = modelMatrix * vec4(position, 1.0);\n    vWorld = wp.xyz;\n    gl_Position = projectionMatrix * viewMatrix * wp;\n  }\n";

const GROUND_FRAGMENT =
  "\n  uniform sampler2D uMap;\n  uniform float uMapOn;\n  uniform vec3 uTint;\n  uniform vec3 uBase;\n  uniform float uGrow;\n  uniform vec2 uGrowC;\n  uniform float uGrowR;\n  uniform vec2 uEdgeY;\n  uniform vec3 uFogColor;\n  uniform float uFogNear;\n  uniform float uFogFar;\n  varying vec2 vP;\n  varying vec3 vWorld;\n  void main() {\n    // lab repeat: 9 tiles over 46 units → 0.196 per unit\n    vec3 tex = texture2D(uMap, vP * 0.196).rgb * uTint;\n    vec3 col = mix(uBase, tex, uMapOn);\n    // Runs AHEAD of the blades (1.28\\xd7 the radius) and now fades in over\n    // ~1 unit instead of ~2.75, so the lawn is opaque by the time blades\n    // sprout on it rather than both crossfading over the dark room.\n    float g = clamp((uGrow * uGrowR * 1.28 - length(vP - uGrowC)) * 0.6, 0.0, 1.0);\n    float a = smoothstep(0.0, 0.55, g);\n    a *= 1.0 - smoothstep(uEdgeY.x, uEdgeY.y, vP.y);\n    float fogK = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWorld));\n    col = mix(col, uFogColor, fogK);\n    float edge = 1.0 - smoothstep(uEdgeY.x, uEdgeY.y, vP.y);\n    col = mix(uFogColor, col, clamp(edge, 0.0, 1.0));\n    gl_FragColor = vec4(col, a);\n  }\n";

const FLORA_VERTEX =
  "\n  attribute vec3 aOffset;   // grid x, grid y, head height above ground\n  attribute float aScale;\n  attribute float aYaw;\n  attribute vec2 aTilt;\n  attribute float aShade;\n  attribute float aPhase;\n  attribute vec2 aUvOff;\n  uniform float uTime;\n  uniform float uWind;\n  uniform float uGrow;\n  uniform vec2 uGrowC;\n  uniform float uGrowR;\n  uniform vec2 uWake;\n  uniform float uPush;\n  uniform float uGroundZ;\n  uniform vec2 uEdgeY;\n  uniform sampler2D uCombTex;\n  uniform vec4 uCombRect;\n  uniform float uCombOn;\n  varying vec2 vUv;\n  varying float vShade;\n  varying vec3 vWorld;\n  varying float vA;\n  float gustEnv(float p) {\n    float g = sin(p) * 0.5 + sin(p * 0.37 + 2.1) * 0.5;\n    return smoothstep(0.45, 1.0, g);\n  }\n  // Same tight front as the blades (see GRASS_BLADE_VERT).\n  float growAt(vec2 p) {\n    float g = clamp((uGrow * uGrowR - length(p - uGrowC)) * 0.85, 0.0, 1.0);\n    return g * g * (3.0 - 2.0 * g);\n  }\n  void main() {\n    vUv = uv * 0.5 + aUvOff;\n    vShade = aShade;\n    float g = growAt(aOffset.xy);\n    float c = cos(aYaw), s = sin(aYaw);\n    vec2 q = position.xy * (aScale * g);\n    q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);\n    float qz = q.x * aTilt.x + q.y * aTilt.y;\n    // same two-band wind + gust fronts as the blades — heads bob with the\n    // passing waves and get shoved downwind when a front rolls through\n    float w = sin(uTime * 1.4 + aPhase) * 0.6\n            + sin(uTime * 2.3 + aPhase * 1.7 + 1.3) * 0.4;\n    float gph = dot(aOffset.xy, vec2(0.58, -0.82)) * 0.9 + uTime * 2.2;\n    float gustNow = gustEnv(gph);\n    float gust = gustNow * uWind;\n    float rel = max(0.0, gustEnv(gph - 1.0) - gustNow)\n              + 0.55 * max(0.0, gustEnv(gph - 2.1) - gustNow)\n              + 0.3 * max(0.0, gustEnv(gph - 3.3) - gustNow);\n    float ring = rel * sin(gph * 4.0 + aPhase * 0.35) * uWind;\n    vec2 sway = vec2(w, sin(uTime * 1.1 + aPhase * 0.7))\n              * (0.09 + 0.14 * gust) * uWind * aOffset.z\n              + vec2(-0.58, 0.82) * (gust * 0.12 + ring * 0.09) * aOffset.z;\n    // heads duck away from the cursor with the blades\n    vec2 toF = aOffset.xy - uWake;\n    float fDist = length(toF);\n    float fInfl = smoothstep(0.5, 0.04, fDist) * uPush\n                * (0.5 + fract(sin(aPhase * 43.7) * 375.85));\n    vec2 fPush = (fDist > 1e-4 ? toF / fDist : vec2(0.0))\n               * fInfl * 0.24 * aOffset.z;\n    // A combed lane lays its daisies down with the blades — leaving the\n    // flowers standing upright in a flattened stripe was the one thing that\n    // gave the effect away as a texture.\n    vec3 comb = texture2D(uCombTex, (aOffset.xy - uCombRect.xy) * uCombRect.zw).rgb;\n    vec2 combV = (comb.rg - 0.5) * 2.0;\n    float combLen = length(combV);\n    float combAmt = comb.b * uCombOn * (0.6 + 0.8 * fract(sin(aPhase * 91.3) * 4375.85));\n    vec2 combPush = (combLen > 1e-4 ? combV / combLen : vec2(0.0))\n                  * combAmt * 0.55 * aOffset.z;\n    vec3 lp = vec3(\n      aOffset.x + q.x + sway.x + fPush.x + combPush.x,\n      aOffset.y + q.y + sway.y + fPush.y + combPush.y,\n      uGroundZ\n        + (aOffset.z - fInfl * 0.35 * aOffset.z - combAmt * 0.55 * aOffset.z) * g\n        + qz\n    );\n    vA = 1.0 - smoothstep(uEdgeY.x, uEdgeY.y, aOffset.y);\n    vec4 wp = modelMatrix * vec4(lp, 1.0);\n    vWorld = wp.xyz;\n    gl_Position = projectionMatrix * viewMatrix * wp;\n  }\n";

const FLORA_FRAGMENT =
  "\n  uniform sampler2D uMap;\n  uniform vec3 uFogColor;\n  uniform float uFogNear;\n  uniform float uFogFar;\n  varying vec2 vUv;\n  varying float vShade;\n  varying vec3 vWorld;\n  varying float vA;\n  void main() {\n    vec4 tex = texture2D(uMap, vUv);\n    float a = tex.a * vA;\n    if (a < 0.15) discard;\n    float fogK = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWorld));\n    vec3 col = mix(tex.rgb * vShade, uFogColor, fogK);\n    col = mix(uFogColor, col, clamp(vA, 0.0, 1.0));\n    gl_FragColor = vec4(col, a);\n  }\n";

const POLLEN_VERTEX =
  "\n  attribute vec3 aData; // drift speed, phase, size\n  uniform float uTime;\n  uniform vec2 uArea;   // half-extent of the wrap box (grid units)\n  uniform vec2 uAreaC;  // its center (grid units)\n  uniform float uScale; // grid group's world scale — keeps px size honest\n  varying float vSize;\n  void main() {\n    vSize = aData.z;\n    vec3 p = position;\n    vec2 drift = vec2(-0.58, 0.82) * (uTime * aData.x);\n    // wrap inside the FIELD, not the screen: the motes live in the\n    // scrolling grid group, so they hold their place in the world and the\n    // page scrolls past them\n    p.x = mod(p.x - uAreaC.x + drift.x + uArea.x, uArea.x * 2.0) - uArea.x + uAreaC.x;\n    p.y = mod(p.y - uAreaC.y + drift.y + uArea.y, uArea.y * 2.0) - uArea.y + uAreaC.y;\n    p.x += sin(uTime * 0.8 + aData.y) * 0.3;\n    p.y += cos(uTime * 0.6 + aData.y * 1.7) * 0.25;\n    p.z += sin(uTime * 0.5 + aData.y * 2.3) * 0.16;\n    vec4 mv = modelViewMatrix * vec4(p, 1.0);\n    gl_PointSize = clamp(aData.z * 900.0 * uScale / max(0.45, -mv.z), 1.0, 9.0);\n    gl_Position = projectionMatrix * mv;\n  }\n";

const POLLEN_FRAGMENT =
  "\n  uniform float uGrow;\n  varying float vSize;\n  void main() {\n    float d = length(gl_PointCoord - 0.5);\n    float a = smoothstep(0.5, 0.15, d);\n    // Motes are spread over the WHOLE field (no radial gate — they're a\n    // volume, not a surface), so a linear uGrow put white specks all over\n    // the dark room the moment the open started. Hold them until the lawn\n    // has actually arrived.\n    float alpha = a * mix(0.4, 0.85, smoothstep(0.05, 0.09, vSize))\n                * smoothstep(0.55, 0.95, uGrow);\n    if (alpha < 0.01) discard;\n    gl_FragColor = vec4(vec3(1.0, 0.97, 0.88), alpha);\n  }\n";

const SKY_FRAGMENT =
  '\n  uniform float uGrow;\n  varying vec3 vWorld;\n  void main() {\n    vec3 top = vec3(0.965, 0.890, 0.812); // #f6e3cf\n    vec3 bot = vec3(0.949, 0.906, 0.827); // #f2e7d3\n    vec3 c = mix(bot, top, smoothstep(-0.5, 3.0, vWorld.y));\n    // Fade in BEHIND the lawn, not ahead of it. At 0.05→0.5 the cream\n    // backplate hit full opacity while the ground disc still covered a\n    // fraction of the screen, so the open flashed one flat grey frame\n    // (cream at ~50% over the dark room) — the other half of the "шум".\n    // Snow never showed it: its dusk sky is nearly the room\'s own value.\n    gl_FragColor = vec4(c, smoothstep(0.35, 0.85, uGrow));\n  }\n';

const COMB_FRAGMENT =
  "\n  uniform vec2 uDir;\n  uniform float uStrength;\n  varying vec2 vUv;\n  void main() {\n    float d = length(vUv - 0.5) * 2.0;\n    float a = (1.0 - smoothstep(0.12, 1.0, d)) * uStrength;\n    gl_FragColor = vec4(uDir * 0.5 + 0.5, 1.0, a);\n  }\n";
