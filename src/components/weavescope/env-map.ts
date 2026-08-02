import * as THREE from "three";

/**
 * A procedurally drawn studio environment.
 *
 * Chrome and any high-metalness surface renders as flat grey without something
 * to reflect — but the usual fix, `<Environment preset="studio" />`, fetches an
 * HDRI from a CDN. That is a network dependency on a page that otherwise has
 * none, and a broken one turns the needle into a dull grey stick.
 *
 * So the environment is painted here instead: a soft-box band overhead, a
 * gradient falling to a dark floor, and two rim sources. Thirty lines, no
 * request, and it gives metal something convincing to reflect.
 */
export function makeStudioEnv(renderer: THREE.WebGLRenderer, warm = "#FFF3E0", cool = "#AFC6D2") {
  // 2048×1024. A small env map is the usual reason a chrome highlight looks
  // blocky — the reflection is literally a magnified handful of texels.
  const W = 2048;
  const H = 1024;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Sky → horizon → floor.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#F2F4F6");
  sky.addColorStop(0.42, "#C6CDD4");
  sky.addColorStop(0.52, "#6E7681");
  sky.addColorStop(1, "#14161A");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Overhead soft-box: the long highlight that runs down a needle's shaft.
  // Wide and soft — a hard-edged source is what produces an aliased specular.
  const box = ctx.createRadialGradient(W * 0.29, H * 0.16, 10, W * 0.29, H * 0.16, W * 0.34);
  box.addColorStop(0, warm);
  box.addColorStop(0.4, "rgba(255,243,224,0.6)");
  box.addColorStop(1, "rgba(255,243,224,0)");
  ctx.fillStyle = box;
  ctx.fillRect(0, 0, W, H);

  // Cool rim from behind-left, which separates the subject from the ground.
  const rim = ctx.createRadialGradient(W * 0.78, H * 0.35, 10, W * 0.78, H * 0.35, W * 0.26);
  rim.addColorStop(0, cool);
  rim.addColorStop(1, "rgba(175,198,210,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, W, H);

  // A second, broader kicker keeps long metal from going dead in the middle.
  const kick = ctx.createRadialGradient(W * 0.55, H * 0.58, 8, W * 0.55, H * 0.58, W * 0.18);
  kick.addColorStop(0, "rgba(255,255,255,0.6)");
  kick.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = kick;
  ctx.fillRect(0, 0, W, H);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // Trilinear + anisotropy so grazing reflections down the shaft stay smooth.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();

  return target.texture;
}
