import * as THREE from "three";

/**
 * Recreates the reference's three white studio reflection panels.
 * The returned cleanup restores the prior environment only while this helper's
 * texture is still installed; it never disposes an environment owned elsewhere.
 * Recreate after WebGL context restoration because PMREM targets have no CPU copy.
 */
export function createStudioEnvironment(
  renderer,
  scene,
  { quality = "high" } = {},
) {
  if (!renderer || !scene)
    throw new Error("createStudioEnvironment requires a renderer and scene.");

  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x000000);
  const panelMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const topGeometry = new THREE.PlaneGeometry(5, 1.2);
  const sideGeometry = new THREE.PlaneGeometry(0.5, 4);
  const top = new THREE.Mesh(topGeometry, panelMaterial);
  top.position.set(0, 3, 0);
  top.rotation.x = Math.PI / 2;
  const left = new THREE.Mesh(sideGeometry, panelMaterial);
  left.position.set(-3.5, 0, 0);
  left.rotation.y = Math.PI / 2;
  const right = new THREE.Mesh(sideGeometry, panelMaterial);
  right.position.set(3.5, 0, 0);
  right.rotation.y = -Math.PI / 2;
  studio.add(top, left, right);

  const generator = new THREE.PMREMGenerator(renderer);
  let target;
  try {
    // High exactly matches the original fromScene(studio, .04) default size256.
    // Lower tiers preserve the same lighting while reducing reflection storage.
    const size = quality === "low" ? 64 : quality === "balanced" ? 128 : 256;
    target = generator.fromScene(studio, 0.04, 0.1, 100, { size });
  } finally {
    generator.dispose();
    topGeometry.dispose();
    sideGeometry.dispose();
    panelMaterial.dispose();
    studio.clear();
  }

  const previousEnvironment = scene.environment;
  const previousIntensity = scene.environmentIntensity;
  const previousRotation = scene.environmentRotation.clone();
  scene.environment = target.texture;
  scene.environmentIntensity = 1;
  scene.environmentRotation.set(0, 0, 0);

  let disposed = false;
  return function disposeStudioEnvironment() {
    if (disposed) return;
    disposed = true;
    if (scene.environment === target.texture) {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      scene.environmentRotation.copy(previousRotation);
    }
    target.dispose();
  };
}
