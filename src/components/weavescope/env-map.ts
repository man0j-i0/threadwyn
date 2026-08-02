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
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Sky → horizon → floor.
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#F2F4F6");
  sky.addColorStop(0.42, "#C6CDD4");
  sky.addColorStop(0.52, "#6E7681");
  sky.addColorStop(1, "#14161A");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 256);

  // Overhead soft-box: the long highlight that runs down a needle's shaft.
  const box = ctx.createRadialGradient(150, 40, 4, 150, 40, 130);
  box.addColorStop(0, warm);
  box.addColorStop(0.45, "rgba(255,243,224,0.55)");
  box.addColorStop(1, "rgba(255,243,224,0)");
  ctx.fillStyle = box;
  ctx.fillRect(0, 0, 512, 256);

  // Cool rim from behind-left, which separates the subject from the ground.
  const rim = ctx.createRadialGradient(400, 90, 4, 400, 90, 110);
  rim.addColorStop(0, cool);
  rim.addColorStop(1, "rgba(175,198,210,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 512, 256);

  // A second, tighter kicker keeps long metal from going dead in the middle.
  const kick = ctx.createRadialGradient(280, 150, 2, 280, 150, 60);
  kick.addColorStop(0, "rgba(255,255,255,0.7)");
  kick.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = kick;
  ctx.fillRect(0, 0, 512, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();

  return target.texture;
}
