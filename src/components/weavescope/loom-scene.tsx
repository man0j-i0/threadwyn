"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { hexToHsl, type WeaveKey } from "@/lib/weave";
import { hashString } from "@/lib/utils";
import { makeStudioEnv } from "./env-map";
import { Cord, Needle } from "./needle";

/**
 * The filament field.
 *
 * Three arrangements of the same threads, crossfaded as you scroll:
 *
 *   fibre  loose filaments drifting free, before anything holds them together
 *   yarn   the same filaments spiralling into bundles — twist is what turns
 *          loose fibre into something with tensile strength
 *   cloth  the bundles straightened into warp and weft, interlacing on this
 *          fabric's actual lift plan
 *
 * Everything is generated from the product's spec — filament count follows GSM,
 * the palette is stepped from the colourway, and the interlacing follows the
 * weave. No downloaded model, so it runs across the whole catalogue and can
 * never render the wrong cloth.
 *
 * Performance: each arrangement is merged into a single buffer geometry built
 * once at mount (three draw calls total). Scroll only changes material opacity
 * and a group transform, so there is no per-frame geometry work at all.
 */

type Palette = { tones: THREE.Color[]; fog: THREE.Color };

/** A tonal ramp stepped off the colourway: deep shadow through to highlight. */
function paletteFrom(hex: string): Palette {
  const hsl = hexToHsl(hex);
  const step = (dl: number, ds: number, dh = 0) =>
    new THREE.Color().setHSL(
      (((hsl.h + dh) % 360) + 360) / 360 % 1,
      Math.min(1, Math.max(0.04, (hsl.s + ds) / 100)),
      Math.min(0.95, Math.max(0.05, (hsl.l + dl) / 100)),
    );

  // Very dark or very pale cloth still needs contrast between filaments, so the
  // ramp opens up rather than clamping flat at either end.
  const spread = hsl.l < 22 ? 34 : hsl.l > 78 ? -34 : 22;

  return {
    tones: [
      step(-spread * 0.9, 6, -4),
      step(-spread * 0.35, 2, 2),
      step(0, 0),
      step(spread * 0.6, -8, -2),
      step(spread * 1.05, -18, 3),
    ],
    fog: step(-spread * 1.4, -10),
  };
}

/** Deterministic PRNG so a fabric's field looks the same on every visit. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function warpOnTop(weave: WeaveKey, col: number, row: number): boolean {
  switch (weave) {
    case "PLAIN":
    case "CREPE":
    case "JERSEY":
      return (col + row) % 2 === 0;
    case "CANVAS":
      return (Math.floor(col / 2) + Math.floor(row / 2)) % 2 === 0;
    case "TWILL":
    case "DOBBY":
      return (col + row) % 3 !== 0;
    case "HERRINGBONE": {
      const band = Math.floor(col / 4) % 2 === 0;
      return band ? (col + row) % 3 !== 0 : (col - row + 12) % 3 !== 0;
    }
    case "SATIN":
      return (col * 2 + row) % 5 !== 0;
    case "JACQUARD":
      return (col * 2 + row) % 4 !== 0 || (col + row) % 7 === 0;
    case "RIB":
      return col % 2 === 0;
    default:
      return (col + row) % 2 === 0;
  }
}

/** Paints one tone across every vertex of a tube. */
function tint(geo: THREE.BufferGeometry, colour: THREE.Color) {
  const count = geo.attributes.position!.count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geo;
}

const SPAN = 9;

/* --------------------------------------------------------------- fibre --- */

/**
 * Loose filaments. Three sine waves of different wavelength layered per
 * filament, so no two share a silhouette and the field reads as organic rather
 * than as a stack of parallel curves.
 */
function buildFibre(count: number, palette: Palette, seed: number, radial: number) {
  const rand = rng(seed);
  const tubes: THREE.BufferGeometry[] = [];

  for (let i = 0; i < count; i++) {
    const lane = (i / (count - 1) - 0.5) * 3.6;
    const depth = (rand() - 0.5) * 3.4;

    const a1 = 0.34 + rand() * 0.5;
    const a2 = 0.14 + rand() * 0.3;
    const a3 = 0.06 + rand() * 0.14;
    const f1 = 0.5 + rand() * 0.42;
    const f2 = 1.15 + rand() * 0.95;
    const f3 = 2.4 + rand() * 1.9;
    const p1 = rand() * Math.PI * 2;
    const p2 = rand() * Math.PI * 2;
    const p3 = rand() * Math.PI * 2;
    const drift = (rand() - 0.5) * 1.5;

    const pts: THREE.Vector3[] = [];
    const SEG = 48;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const x = (t - 0.5) * SPAN;
      const y =
        lane +
        Math.sin(t * Math.PI * 2 * f1 + p1) * a1 +
        Math.sin(t * Math.PI * 2 * f2 + p2) * a2 +
        Math.sin(t * Math.PI * 2 * f3 + p3) * a3;
      const z = depth + Math.cos(t * Math.PI * 2 * f2 + p2) * a2 * 1.5 + drift * t;
      pts.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const r = 0.021 + rand() * 0.022;
    const tube = new THREE.TubeGeometry(curve, SEG * 2, r, radial, false);
    tubes.push(tint(tube, palette.tones[Math.floor(rand() * palette.tones.length)]!));
  }

  const merged = mergeGeometries(tubes, false)!;
  for (const t of tubes) t.dispose();
  return merged;
}

/* ---------------------------------------------------------------- yarn --- */

/**
 * The same filaments, now spiralling around shared axes. Z-twist, which is what
 * almost all commercial ring-spun yarn uses, so the direction is the direction
 * you would see under a loupe.
 */
function buildYarn(count: number, palette: Palette, seed: number, radial: number, bundles: number) {
  const rand = rng(seed ^ 0x9e3779b9);
  const tubes: THREE.BufferGeometry[] = [];
  const perBundle = Math.max(3, Math.round(count / bundles));

  for (let b = 0; b < bundles; b++) {
    const lane = (b / Math.max(1, bundles - 1) - 0.5) * 3.1;
    const depth = (rand() - 0.5) * 1.9;
    const bendA = 0.18 + rand() * 0.24;
    const bendF = 0.55 + rand() * 0.5;
    const bendP = rand() * Math.PI * 2;
    const bundleR = 0.085 + rand() * 0.05;
    const turns = 4 + Math.floor(rand() * 3);

    for (let f = 0; f < perBundle; f++) {
      const phase = (f / perBundle) * Math.PI * 2 + rand() * 0.35;
      const pts: THREE.Vector3[] = [];
      const SEG = 56;

      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        const x = (t - 0.5) * SPAN;
        // Axis of the bundle, gently sinuous.
        const ay = lane + Math.sin(t * Math.PI * 2 * bendF + bendP) * bendA;
        const az = depth + Math.cos(t * Math.PI * 2 * bendF * 0.7 + bendP) * bendA * 0.8;
        // Helix around it.
        const a = phase + t * Math.PI * 2 * turns;
        pts.push(new THREE.Vector3(x, ay + Math.sin(a) * bundleR, az + Math.cos(a) * bundleR));
      }

      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
      const tube = new THREE.TubeGeometry(curve, SEG * 2, 0.017 + rand() * 0.011, radial, false);
      tubes.push(tint(tube, palette.tones[Math.floor(rand() * palette.tones.length)]!));
    }
  }

  const merged = mergeGeometries(tubes, false)!;
  for (const t of tubes) t.dispose();
  return merged;
}

/* --------------------------------------------------------------- cloth --- */

/**
 * Warp and weft interlacing on this fabric's lift plan. Still drawn as flowing
 * tubes rather than a rigid grid — real cloth off the loom is never flat, and
 * the gentle drape is what stops it reading as graph paper.
 */
function buildCloth(weave: WeaveKey, palette: Palette, seed: number, radial: number, ends: number) {
  const rand = rng(seed ^ 0x85ebca6b);
  const tubes: THREE.BufferGeometry[] = [];

  const picks = Math.round(ends * 1.25);
  const spacing = 5.6 / ends;
  const amp = 0.03;
  const warpTone = palette.tones[1]!;
  const weftTone = palette.tones[3]!;

  // A soft, slow undulation across the whole cloth — the drape.
  const drape = (x: number, z: number) =>
    Math.sin(x * 0.42 + z * 0.3) * 0.16 + Math.cos(z * 0.55 - x * 0.18) * 0.1;

  for (let i = 0; i < ends; i++) {
    const x = (i - (ends - 1) / 2) * spacing;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= picks; j++) {
      const z = (j - picks / 2) * spacing;
      const over = warpOnTop(weave, i, j) ? amp : -amp;
      pts.push(new THREE.Vector3(x, drape(x, z) + over, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
    tubes.push(tint(new THREE.TubeGeometry(curve, picks * 2, 0.019, radial, false), warpTone));
  }

  for (let j = 0; j < picks; j++) {
    const z = (j - picks / 2) * spacing;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= ends; i++) {
      const x = (i - (ends - 1) / 2) * spacing;
      const over = warpOnTop(weave, Math.min(i, ends - 1), j) ? -amp : amp;
      pts.push(new THREE.Vector3(x, drape(x, z) + over, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
    tubes.push(tint(new THREE.TubeGeometry(curve, ends * 2, 0.018, radial, false), weftTone));
  }

  // A few loose fibres lifting off the surface — cloth has hair.
  for (let h = 0; h < 8; h++) {
    const pts: THREE.Vector3[] = [];
    const sx = (rand() - 0.5) * 5;
    const sz = (rand() - 0.5) * 5;
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      pts.push(
        new THREE.Vector3(
          sx + t * (rand() * 0.5 + 0.3),
          drape(sx, sz) + Math.sin(t * 3) * 0.06 + t * 0.1,
          sz + Math.sin(t * 5) * 0.05,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    tubes.push(tint(new THREE.TubeGeometry(curve, 20, 0.006, 4, false), palette.tones[4]!));
  }

  const merged = mergeGeometries(tubes, false)!;
  for (const t of tubes) t.dispose();
  return merged;
}

/* ---------------------------------------------------------------- rig --- */

function Field({
  weave,
  hex,
  gsm,
  seedText,
  progress,
  quality,
}: {
  weave: WeaveKey;
  hex: string;
  gsm: number;
  seedText: string;
  progress: React.RefObject<number>;
  quality: "high" | "low";
}) {
  const radial = quality === "high" ? 8 : 5;
  const filaments = quality === "high" ? 46 : 26;
  // Heavier cloth is coarser and shows fewer, thicker ends at this scale.
  const ends = Math.max(10, Math.min(22, Math.round(26 - gsm / 32)));

  const palette = useMemo(() => paletteFrom(hex), [hex]);
  const seed = useMemo(() => hashString(seedText), [seedText]);

  const geos = useMemo(
    () => ({
      fibre: buildFibre(filaments, palette, seed, radial),
      yarn: buildYarn(filaments, palette, seed, radial, quality === "high" ? 7 : 5),
      cloth: buildCloth(weave, palette, seed, radial, ends),
    }),
    [filaments, palette, seed, radial, quality, weave, ends],
  );

  // Materials live behind refs, not a memo: their opacity is driven every frame
  // from scroll, and a memoised value is not ours to mutate.
  const fibreMat = useRef<THREE.MeshStandardMaterial>(null);
  const yarnMat = useRef<THREE.MeshStandardMaterial>(null);
  const clothMat = useRef<THREE.MeshStandardMaterial>(null);

  const needleRef = useRef<THREE.Group>(null);
  const fibreRef = useRef<THREE.Group>(null);
  const yarnRef = useRef<THREE.Group>(null);
  const clothRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();

  // Painted, not fetched — see env-map.ts. Metal needs something to reflect.
  const envMap = useMemo(() => makeStudioEnv(gl), [gl]);

  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progress.current ?? 0, 0, 1);
    const t = state.clock.elapsedTime;

    // Four overlapping windows. Each state is fully present at its centre and
    // dissolves into the next — a focus pull, not a hard cut.
    const band = (centre: number, width: number) =>
      THREE.MathUtils.clamp(1 - Math.abs(p - centre) / width, 0, 1);
    const soft = (v: number) => v * v * (3 - 2 * v);

    const wNeedle = soft(band(0.0, 0.26));
    const oFibre = soft(band(0.34, 0.26));
    const oYarn = soft(band(0.62, 0.24));
    const oCloth = soft(band(0.97, 0.3));

    if (fibreMat.current) fibreMat.current.opacity = oFibre;
    if (yarnMat.current) yarnMat.current.opacity = oYarn;
    if (clothMat.current) clothMat.current.opacity = oCloth;

    // Opening beat: the needle sits in frame, threaded, then withdraws as the
    // cord unravels into loose fibre.
    if (needleRef.current) {
      needleRef.current.visible = wNeedle > 0.01;
      needleRef.current.scale.setScalar(1);
      const withdraw = THREE.MathUtils.clamp((p - 0.1) / 0.2, 0, 1);
      needleRef.current.position.y = 0.15 + withdraw * 2.6;
      needleRef.current.position.z = -withdraw * 1.4;
      needleRef.current.rotation.z = 0.12 + Math.sin(t * 0.22) * 0.035 + withdraw * 0.3;
      for (const child of needleRef.current.children) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.Material | undefined;
        if (mat) {
          mat.transparent = true;
          mat.opacity = wNeedle;
        }
      }
    }

    // The outgoing state drifts back and the incoming comes forward, which
    // reads as depth rather than as a dissolve.
    if (fibreRef.current) {
      fibreRef.current.visible = oFibre > 0.01;
      fibreRef.current.position.z = 1.2 - p * 2.6;
      fibreRef.current.rotation.z = Math.sin(t * 0.09) * 0.04;
      fibreRef.current.position.x = Math.sin(t * 0.07) * 0.12;
    }
    if (yarnRef.current) {
      yarnRef.current.visible = oYarn > 0.01;
      yarnRef.current.position.z = 2.1 - p * 2.6;
      yarnRef.current.rotation.x = 0.06 + Math.sin(t * 0.11) * 0.03;
      yarnRef.current.rotation.z = Math.sin(t * 0.08 + 1) * 0.03;
    }
    if (clothRef.current) {
      clothRef.current.visible = oCloth > 0.01;
      clothRef.current.position.z = 2.6 - p * 2.4;
      clothRef.current.rotation.x = THREE.MathUtils.lerp(0.95, 0.4, THREE.MathUtils.clamp((p - 0.72) / 0.28, 0, 1));
      clothRef.current.rotation.y = Math.sin(t * 0.07) * 0.06;
    }

    // Slow dolly in, so the whole sequence feels like one continuous approach.
    const target = new THREE.Vector3(Math.sin(t * 0.05) * 0.2, 0.18 + p * 0.45, 4.9 - p * 1.7);
    camera.position.lerp(target, 0.04);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <group ref={needleRef} position={[0, 0.15, 0]} rotation={[0, 0, 0.12]}>
        <Needle envMap={envMap} />
        <Cord hex={hex} envMap={envMap} radial={radial} />
      </group>

      <group ref={fibreRef}>
        <mesh geometry={geos.fibre}>
          <meshStandardMaterial ref={fibreMat} vertexColors transparent opacity={0} roughness={0.52} metalness={0.04} />
        </mesh>
      </group>
      <group ref={yarnRef}>
        <mesh geometry={geos.yarn}>
          <meshStandardMaterial ref={yarnMat} vertexColors transparent opacity={0} roughness={0.5} metalness={0.04} />
        </mesh>
      </group>
      <group ref={clothRef} rotation={[0.95, 0, 0]}>
        <mesh geometry={geos.cloth}>
          <meshStandardMaterial ref={clothMat} vertexColors transparent opacity={0} roughness={0.58} metalness={0.03} />
        </mesh>
      </group>
    </>
  );
}

export default function LoomScene({
  weave,
  hex,
  gsm = 160,
  seed = "threadwyn",
  progress,
  quality = "high",
}: {
  weave: WeaveKey;
  hex: string;
  gsm?: number;
  seed?: string;
  progress: React.RefObject<number>;
  quality?: "high" | "low";
}) {
  const fog = useMemo(() => paletteFrom(hex).fog, [hex]);

  return (
    <Canvas
      gl={{ antialias: quality === "high", alpha: true }}
      dpr={quality === "high" ? [1, 1.8] : [1, 1.25]}
      camera={{ position: [0, 0.2, 4.8], fov: 40, near: 0.1, far: 40 }}
      frameloop="always"
    >
      {/* Three-point rig. The strong key from upper-left is what gives the
          tubes their cylindrical read; the cool fill keeps the shadow side from
          going dead; the rim separates filaments from the background. */}
      <ambientLight intensity={0.5} color="#FBF3E4" />
      <directionalLight position={[3.6, 4.2, 3.4]} intensity={2.4} color="#FFF6E6" />
      <directionalLight position={[-3.4, -1.2, 1.6]} intensity={0.85} color="#9FBFCC" />
      <directionalLight position={[0, 1.4, -4]} intensity={1.15} color="#FFE7C4" />

      <Field weave={weave} hex={hex} gsm={gsm} seedText={seed} progress={progress} quality={quality} />

      {/* Depth falloff — the far filaments sink into the dark. */}
      <fog attach="fog" args={[`#${fog.getHexString()}`, 4.4, 14]} />

      {/* Shallow depth of field is the single thing that makes macro textile
          photography read as photography. One sharp band, everything in front
          of and behind it falling off. Skipped entirely on low-power devices —
          it is the most expensive pass here by a wide margin. */}
      {quality === "high" ? (
        <EffectComposer enableNormalPass={false}>
          <DepthOfField focusDistance={0.012} focalLength={0.045} bokehScale={5.5} height={480} />
          <Vignette eskil={false} offset={0.24} darkness={0.72} />
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}
