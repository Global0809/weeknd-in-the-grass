import * as THREE from "three";

const CARD_W = 0.78;
const CARD_H = 0.975;

const PASS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// A circular nine-tap kernel, run twice at half resolution. The second pass
// rotates the ring to avoid the rectangular signature of a box/axis blur.
const BOKEH_FRAGMENT = /* glsl */ `
  uniform sampler2D uSource;
  uniform vec2 uTexel;
  uniform float uRadius;
  uniform float uAngle;
  varying vec2 vUv;
  void main() {
    vec3 col = texture2D(uSource, vUv).rgb * 0.2;
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.78539816339 + uAngle;
      vec2 offset = vec2(cos(angle), sin(angle)) * uTexel * uRadius;
      col += texture2D(uSource, clamp(vUv + offset, vec2(0.0), vec2(1.0))).rgb * 0.1;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const OUTPUT_FRAGMENT = /* glsl */ `
  uniform sampler2D uSource;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture2D(uSource, vUv).rgb, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * One-context inspection compositor. It softens the live meadow, then draws
 * a sharp edition card with its original shared foil materials on top.
 *
 * rect is an unrotated card box in logical canvas pixels: {x,y,width,height}.
 * pointer is a card UV ({x,y} or {u,v}) in [0,1]; its centre is {.5,.5}.
 * render returns false when selection/rect is unavailable, allowing the owner
 * to use its ordinary renderer.render(scene,camera) path.
 */
export function createInspectionRenderer({
  renderer,
  scene,
  camera,
  getCards,
} = {}) {
  if (!renderer || !scene || !camera || typeof getCards !== "function") {
    throw new Error(
      "createInspectionRenderer requires renderer, scene, camera and getCards.",
    );
  }

  const size = renderer.getSize(new THREE.Vector2());
  let width = Math.max(1, size.x),
    height = Math.max(1, size.y);
  let pixelRatio = renderer.getPixelRatio();
  let targetWidth = 1,
    targetHeight = 1,
    blurWidth = 1,
    blurHeight = 1;
  let sceneTarget = null,
    blurA = null,
    blurB = null;
  let disposed = false,
    cardClone = null,
    cloneSource = null;
  let tiltX = 0,
    tiltY = 0;

  const passGeometry = new THREE.BufferGeometry();
  passGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  passGeometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2),
  );
  const blurMaterial = new THREE.ShaderMaterial({
    vertexShader: PASS_VERTEX,
    fragmentShader: BOKEH_FRAGMENT,
    uniforms: {
      uSource: { value: null },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 1 },
      uAngle: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const outputMaterial = new THREE.ShaderMaterial({
    vertexShader: PASS_VERTEX,
    fragmentShader: OUTPUT_FRAGMENT,
    uniforms: { uSource: { value: null } },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const passScene = new THREE.Scene();
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const passMesh = new THREE.Mesh(passGeometry, blurMaterial);
  passMesh.frustumCulled = false;
  passScene.add(passMesh);

  const foreground = new THREE.Scene();
  foreground.background = null;
  const foregroundCamera = new THREE.PerspectiveCamera(
    38,
    width / height,
    0.01,
    30,
  );
  foregroundCamera.position.set(0, 0, 3.6);
  foregroundCamera.lookAt(0, 0, 0);
  foreground.add(new THREE.AmbientLight("#fff3d9", 2.1));
  const key = new THREE.DirectionalLight("#fff4dd", 2.4);
  key.position.set(3, -2, 5);
  foreground.add(key);
  const fill = new THREE.PointLight("#ffedb8", 1.5, 12);
  fill.position.set(3, 1.5, 5);
  foreground.add(fill);

  function calculateTargetSize() {
    const limit = width < 640 ? 1 : 1.5;
    const scale = Math.min(Math.max(pixelRatio || 1, 0.5), limit);
    const maxSize = renderer.capabilities.maxTextureSize;
    const fit = Math.min(
      1,
      maxSize / (width * scale),
      maxSize / (height * scale),
    );
    targetWidth = Math.max(1, Math.round(width * scale * fit));
    targetHeight = Math.max(1, Math.round(height * scale * fit));
    blurWidth = Math.max(1, Math.round(targetWidth / 2));
    blurHeight = Math.max(1, Math.round(targetHeight / 2));
  }

  function ensureTargets() {
    if (sceneTarget) return;
    calculateTargetSize();
    const type = renderer.extensions.has("EXT_color_buffer_float")
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;
    const options = {
      type,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      stencilBuffer: false,
    };
    sceneTarget = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
      ...options,
      depthBuffer: true,
    });
    blurA = new THREE.WebGLRenderTarget(blurWidth, blurHeight, {
      ...options,
      depthBuffer: false,
    });
    blurB = new THREE.WebGLRenderTarget(blurWidth, blurHeight, {
      ...options,
      depthBuffer: false,
    });
    sceneTarget.texture.name = "Inspection meadow linear";
    blurA.texture.name = "Inspection bokeh ring A";
    blurB.texture.name = "Inspection bokeh ring B";
  }

  function resize(
    nextWidth,
    nextHeight,
    nextPixelRatio = renderer.getPixelRatio(),
  ) {
    if (disposed) return;
    const logicalWidth = Math.max(1, Number(nextWidth) || 1),
      logicalHeight = Math.max(1, Number(nextHeight) || 1);
    const ratio = Math.max(0.5, Number(nextPixelRatio) || 1);
    if (
      width === logicalWidth &&
      height === logicalHeight &&
      pixelRatio === ratio
    )
      return;
    width = logicalWidth;
    height = logicalHeight;
    pixelRatio = ratio;
    foregroundCamera.aspect = width / height;
    foregroundCamera.updateProjectionMatrix();
    calculateTargetSize();
    if (sceneTarget) {
      sceneTarget.setSize(targetWidth, targetHeight);
      blurA.setSize(blurWidth, blurHeight);
      blurB.setSize(blurWidth, blurHeight);
    }
  }

  function render({
    selected,
    rect,
    pointer = null,
    time = 0,
    delta = 1 / 60,
    reducedMotion = false,
  } = {}) {
    if (disposed || !Number.isInteger(selected) || !rect) return false;
    const cards = getCards();
    const source = Array.isArray(cards) ? cards[selected]?.mesh : null;
    if (!source?.isMesh || !source.geometry || !source.material) return false;
    const { x, y, width: rectWidth, height: rectHeight } = rect;
    if (
      ![x, y, rectWidth, rectHeight].every(Number.isFinite) ||
      rectWidth <= 1 ||
      rectHeight <= 1
    )
      return false;
    ensureTargets();

    if (cloneSource !== source) {
      if (cardClone) foreground.remove(cardClone);
      // Geometry/material arrays stay owned by createEraCards, including every
      // image map and shader uniform. This compositor never disposes them.
      cardClone = new THREE.Mesh(source.geometry, source.material);
      cardClone.name = "Live foil inspection card";
      cardClone.frustumCulled = false;
      cardClone.castShadow = false;
      cardClone.receiveShadow = false;
      foreground.add(cardClone);
      cloneSource = source;
      tiltX = 0;
      tiltY = 0;
    }
    cardClone.geometry = source.geometry;
    cardClone.material = source.material;
    cardClone.visible = true;
    foreground.environment = scene.environment;
    foreground.environmentIntensity = scene.environmentIntensity;
    foreground.environmentRotation.copy(scene.environmentRotation);

    const viewportHeight = 2 * Math.tan(THREE.MathUtils.degToRad(19)) * 3.6;
    const viewportWidth = viewportHeight * foregroundCamera.aspect;
    const cx = x + rectWidth / 2,
      cy = y + rectHeight / 2;
    cardClone.position.set(
      (cx / width - 0.5) * viewportWidth,
      (0.5 - cy / height) * viewportHeight,
      0,
    );
    const sx = ((rectWidth / width) * viewportWidth) / CARD_W,
      sy = ((rectHeight / height) * viewportHeight) / CARD_H;
    cardClone.scale.set(sx, sy, (sx + sy) / 2);
    const uv = pointer?.uv || pointer;
    const u = THREE.MathUtils.clamp(uv?.u ?? uv?.x ?? 0.5, 0, 1),
      v = THREE.MathUtils.clamp(uv?.v ?? uv?.y ?? 0.5, 0, 1);
    const blend = reducedMotion
      ? 1
      : 1 - Math.exp(-8 * Math.min(Math.max(delta, 0.001), 0.08));
    const tx = reducedMotion ? 0 : (0.5 - v) * 0.08,
      ty = reducedMotion ? 0 : (u - 0.5) * 0.1;
    tiltX += (tx - tiltX) * blend;
    tiltY += (ty - tiltY) * blend;
    cardClone.rotation.set(tiltX, tiltY, 0.026);

    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMipmap = renderer.getActiveMipmapLevel();
    const previousAutoClear = renderer.autoClear;
    const previousXr = renderer.xr.enabled;
    try {
      renderer.xr.enabled = false;
      renderer.autoClear = false;
      // Owned RT viewports are physical texture sizes. setRenderTarget handles
      // them without changing the renderer's logical viewport/scissor settings.
      renderer.setRenderTarget(sceneTarget);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);

      const logicalRadius = Math.min(12, Math.max(4.5, width * 0.008));
      const renderScale = targetWidth / width;
      passMesh.material = blurMaterial;
      blurMaterial.uniforms.uSource.value = sceneTarget.texture;
      blurMaterial.uniforms.uTexel.value.set(1 / targetWidth, 1 / targetHeight);
      blurMaterial.uniforms.uRadius.value = logicalRadius * renderScale * 0.7;
      blurMaterial.uniforms.uAngle.value = 0;
      renderer.setRenderTarget(blurA);
      renderer.render(passScene, passCamera);

      blurMaterial.uniforms.uSource.value = blurA.texture;
      blurMaterial.uniforms.uTexel.value.set(1 / blurWidth, 1 / blurHeight);
      blurMaterial.uniforms.uRadius.value = logicalRadius * renderScale * 0.35;
      blurMaterial.uniforms.uAngle.value = Math.PI / 8;
      renderer.setRenderTarget(blurB);
      renderer.render(passScene, passCamera);

      // Linear background is encoded only here. Foreground built-in materials
      // perform their own normal output conversion into the same destination.
      renderer.setRenderTarget(previousTarget, previousFace, previousMipmap);
      passMesh.material = outputMaterial;
      outputMaterial.uniforms.uSource.value = blurB.texture;
      renderer.render(passScene, passCamera);
      renderer.clearDepth();
      renderer.render(foreground, foregroundCamera);
    } finally {
      renderer.setRenderTarget(previousTarget, previousFace, previousMipmap);
      renderer.autoClear = previousAutoClear;
      renderer.xr.enabled = previousXr;
    }
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    foreground.environment = null;
    foreground.clear();
    cardClone = null;
    cloneSource = null;
    sceneTarget?.dispose();
    blurA?.dispose();
    blurB?.dispose();
    passGeometry.dispose();
    blurMaterial.dispose();
    outputMaterial.dispose();
    passScene.clear();
  }

  return { render, resize, dispose };
}
