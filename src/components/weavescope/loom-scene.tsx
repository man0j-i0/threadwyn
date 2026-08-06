"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { hexToHsl, type WeaveKey } from "@/lib/weave";
import { hashString } from "@/lib/utils";
import { makeStudioEnv } from "./env-map";
import { Cord, Needle } from "./needle";

/**
 * The filament field.
 *
 * Three beats, crossfaded as you scroll:
 *
 *   needle a threaded needle, hero-lit, cord in this fabric's colour
 *   fibre  loose filaments drifting free, before anything holds them together
 *   yarn   the same filaments spiralling into bundles — twist is what turns
 *          loose fibre into something with tensile strength
 *
 * The sequence then hands off to the real product swatch in the DOM, so it
 * lands on the exact image a buyer sees everywhere else in the catalogue.
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

/**
 * Camera shots.
 *
 * Each beat gets a deliberate framing rather than one linear dolly across the
 * whole scroll: the needle is a centred hero, the fibre pulls wide and low to
 * feel enveloping, the twist punches in tight and off-axis so the helix reads,
 * and the last shot eases back out to hand over to the swatch.
 *
 * Between shots the camera rolls and the focal length breathes. That is what
 * separates a move that feels shot from one that feels interpolated.
 */
type Shot = { at: number; pos: readonly [number, number, number]; fov: number; roll: number };

const SHOTS: readonly Shot[] = [
  { at: 0.0, pos: [0, 0.16, 4.9], fov: 40, roll: 0 },
  { at: 0.33, pos: [-0.75, 0.42, 3.5], fov: 48, roll: -0.05 },
  { at: 0.63, pos: [0.62, -0.22, 2.15], fov: 33, roll: 0.07 },
  { at: 0.92, pos: [0, 0.24, 3.4], fov: 42, roll: 0 },
];

/** Smootherstep — zero first and second derivative at both ends, so a shot
 *  leaves and arrives without a visible kink. */
function smoother(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

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
 * Bundle layout.
 *
 * A rank of parallel horizontal ropes reads as a diagram. Real yarn in a mill
 * is stacked, crossed and receding, so the field mixes orientations: two hero
 * bundles across the frame, a couple standing vertically well behind them, and
 * a few on the diagonal between. Depth and scale fall off together, so the
 * background ones sink into fog instead of competing.
 */
const BUNDLE_LAYOUT = [
  { angle: 0, lane: -0.95, depth: 0.35, scale: 1, radius: 0.17, turns: 7 },
  { angle: 0, lane: 0.85, depth: -0.15, scale: 0.94, radius: 0.15, turns: 8 },
  { angle: 90, lane: -2.35, depth: -2.6, scale: 0.62, radius: 0.1, turns: 9 },
  { angle: 90, lane: 2.15, depth: -3.1, scale: 0.55, radius: 0.095, turns: 10 },
  { angle: 31, lane: 1.5, depth: -1.5, scale: 0.76, radius: 0.12, turns: 8 },
  { angle: -24, lane: -1.9, depth: -1.9, scale: 0.7, radius: 0.115, turns: 9 },
  { angle: 68, lane: 0.4, depth: -3.6, scale: 0.48, radius: 0.085, turns: 11 },
] as const;

/**
 * Filaments spiralling around shared axes. Z-twist, which is what almost all
 * commercial ring-spun yarn uses, so the direction is the direction you would
 * see under a loupe.
 */
function buildYarn(count: number, palette: Palette, seed: number, radial: number, bundles: number) {
  const rand = rng(seed ^ 0x9e3779b9);
  const tubes: THREE.BufferGeometry[] = [];

  const layout = BUNDLE_LAYOUT.slice(0, Math.max(3, bundles));
  const perBundle = Math.max(5, Math.round(count / layout.length));

  for (const slot of layout) {
    const rad = (slot.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const bendA = (0.08 + rand() * 0.12) * slot.scale;
    const bendF = 0.4 + rand() * 0.3;
    const bendP = rand() * Math.PI * 2;
    const bundleR = slot.radius * slot.scale;
    const span = SPAN * (slot.angle % 180 === 0 ? 1 : 1.35);

    // Background bundles carry fewer filaments — nobody counts them, and they
    // are the cheapest place to give the frame budget back.
    const filaments = Math.max(4, Math.round(perBundle * (0.45 + slot.scale * 0.55)));

    for (let f = 0; f < filaments; f++) {
      const phase = (f / filaments) * Math.PI * 2 + rand() * 0.3;
      const pts: THREE.Vector3[] = [];
      const SEG = 56;

      for (let st = 0; st <= SEG; st++) {
        const t = st / SEG;
        const along = (t - 0.5) * span;
        const off = Math.sin(t * Math.PI * 2 * bendF + bendP) * bendA;
        const a = phase + t * Math.PI * 2 * slot.turns;

        // Build in the bundle's own frame, then rotate into the scene.
        const lx = along;
        const ly = slot.lane + off + Math.sin(a) * bundleR;
        const z = slot.depth + Math.cos(a) * bundleR + Math.cos(t * Math.PI * 2 * bendF * 0.7 + bendP) * bendA * 0.7;

        pts.push(new THREE.Vector3(lx * cos - ly * sin, lx * sin + ly * cos, z));
      }

      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
      const r = (0.023 + rand() * 0.01) * slot.scale;
      const tube = new THREE.TubeGeometry(curve, SEG * 2, r, radial, false);

      // Deeper bundles pull from the darker end of the ramp, so depth reads
      // even before the fog gets to them.
      const bias = slot.scale > 0.85 ? 1 : slot.scale > 0.65 ? 0 : -1;
      const idx = THREE.MathUtils.clamp(
        Math.floor(rand() * palette.tones.length) + bias,
        0,
        palette.tones.length - 1,
      );
      tubes.push(tint(tube, palette.tones[idx]!));
    }
  }

  const merged = mergeGeometries(tubes, false)!;
  for (const t of tubes) t.dispose();
  return merged;
}

/* ---------------------------------------------------------------- rig --- */

function Field({
  hex,
  gsm,
  seedText,
  progress,
  quality,
}: {
  hex: string;
  gsm: number;
  seedText: string;
  progress: React.RefObject<number>;
  quality: "high" | "low";
}) {
  // Owned here, not passed in: this is the component that drives it each frame.
  const dof = useRef<DepthOfFieldEffect | null>(null);
  const radial = quality === "high" ? 8 : 5;
  // Heavier cloth is spun coarser, so it shows fewer, thicker filaments here.
  const filaments = Math.round((quality === "high" ? 46 : 26) * (gsm > 300 ? 0.8 : 1));

  const palette = useMemo(() => paletteFrom(hex), [hex]);
  const seed = useMemo(() => hashString(seedText), [seedText]);

  const geos = useMemo(
    () => ({
      fibre: buildFibre(filaments, palette, seed, radial),
      yarn: buildYarn(filaments, palette, seed, radial, quality === "high" ? 7 : 4),
    }),
    [filaments, palette, seed, radial, quality],
  );

  // Materials live behind refs, not a memo: their opacity is driven every frame
  // from scroll, and a memoised value is not ours to mutate.
  const fibreMat = useRef<THREE.MeshStandardMaterial>(null);
  const yarnMat = useRef<THREE.MeshStandardMaterial>(null);

  const needleRef = useRef<THREE.Group>(null);
  const fibreRef = useRef<THREE.Group>(null);
  const yarnRef = useRef<THREE.Group>(null);

  // Scroll events arrive in coarse, irregular bursts. Everything on screen
  // follows this damped value instead of the raw one, which is the difference
  // between the camera stepping and the camera gliding.
  const eased = useRef(0);
  const elapsed = useRef(0);
  const shot = useRef(new THREE.Vector3(0, 0.16, 4.9));

  const { gl } = useThree();

  // Painted, not fetched — see env-map.ts. Metal needs something to reflect.
  const envMap = useMemo(() => makeStudioEnv(gl), [gl]);

  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const raw = THREE.MathUtils.clamp(progress.current ?? 0, 0, 1);
    // Accumulated from `delta` rather than read off `state.clock`. three r185
    // deprecates Clock in favour of Timer, and R3F still exposes the old one,
    // so touching it logs a deprecation on every mount. We only ever needed a
    // monotonically increasing seconds value for the breathing motions below,
    // and `delta` already gives us that without the dependency.
    elapsed.current += delta;
    const t = elapsed.current;

    // Critically damped follow, frame-rate independent. 1 - e^(-k·dt) reaches
    // the target at the same speed whether the tab is running at 60 or 144.
    eased.current += (raw - eased.current) * (1 - Math.exp(-9 * Math.min(delta, 0.05)));
    const p = eased.current;

    const band = (centre: number, width: number) =>
      THREE.MathUtils.clamp(1 - Math.abs(p - centre) / width, 0, 1);
    const soft = (v: number) => v * v * (3 - 2 * v);

    const wNeedle = soft(band(0.0, 0.28));
    const oFibre = soft(band(0.42, 0.3));
    const oYarn = soft(band(0.63, 0.19));

    if (fibreMat.current) fibreMat.current.opacity = oFibre;
    if (yarnMat.current) yarnMat.current.opacity = oYarn;

    // Depth of field is strong on the needle, where it does the work of making
    // the shot read as macro photography, and resolves to nothing by the time
    // the filaments are the subject — you asked to see the strands sharp, and
    // a permanent blur would just be a smeared render.
    if (dof.current) {
      const focus = THREE.MathUtils.clamp((p - 0.16) / 0.42, 0, 1);
      dof.current.bokehScale = THREE.MathUtils.lerp(3.4, 0, soft(focus));
      const cocUniforms = dof.current.circleOfConfusionMaterial.uniforms;
      cocUniforms.focusRange.value = THREE.MathUtils.lerp(0.012, 0.16, soft(focus));
    }

    if (needleRef.current) {
      needleRef.current.visible = wNeedle > 0.01;
      const withdraw = THREE.MathUtils.clamp((p - 0.14) / 0.22, 0, 1);
      needleRef.current.position.y = 0.15 + withdraw * 2.8;
      needleRef.current.position.z = -withdraw * 1.5;
      needleRef.current.rotation.z = 0.12 + Math.sin(t * 0.22) * 0.03 + withdraw * 0.3;
      for (const child of needleRef.current.children) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.Material | undefined;
        if (mat) {
          mat.transparent = true;
          mat.opacity = wNeedle;
        }
      }
    }

    if (fibreRef.current) {
      // Culled well before it is invisible: a 3% ghost still writes depth and
      // still tangles through whatever is coming forward.
      fibreRef.current.visible = oFibre > 0.06;
      fibreRef.current.position.z = 1.6 - p * 4.4;
      fibreRef.current.rotation.z = Math.sin(t * 0.09) * 0.035;
      fibreRef.current.position.x = Math.sin(t * 0.07) * 0.12;
    }

    if (yarnRef.current) {
      yarnRef.current.visible = oYarn > 0.06;
      // Starts behind the fibre and arrives in front of it, so the handoff
      // reads as the camera moving through rather than as a dissolve.
      yarnRef.current.position.z = 3.4 - p * 4.2;
      yarnRef.current.rotation.x = 0.05 + Math.sin(t * 0.11) * 0.02;
      yarnRef.current.rotation.z = Math.sin(t * 0.08 + 1) * 0.02;
    }

    // --- camera -----------------------------------------------------------

    // Find the shot pair we sit between and how far through we are.
    let a = SHOTS[0]!;
    let b = SHOTS[SHOTS.length - 1]!;
    for (let i = 0; i < SHOTS.length - 1; i++) {
      if (p >= SHOTS[i]!.at && p <= SHOTS[i + 1]!.at) {
        a = SHOTS[i]!;
        b = SHOTS[i + 1]!;
        break;
      }
    }
    const span = Math.max(1e-4, b.at - a.at);
    const local = smoother((p - a.at) / span);

    shot.current.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], local),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], local),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], local),
    );

    // A slow handheld drift on top, so a held shot never looks frozen.
    shot.current.x += Math.sin(t * 0.19) * 0.06;
    shot.current.y += Math.cos(t * 0.14) * 0.04;

    const k = 1 - Math.exp(-7 * Math.min(delta, 0.05));
    camera.position.lerp(shot.current, k);
    camera.lookAt(0, 0, 0);

    // Roll is applied after lookAt, which would otherwise flatten it. It peaks
    // mid-transition and settles at each shot — the whip between beats.
    const whip = Math.sin(local * Math.PI);
    camera.rotateZ(THREE.MathUtils.lerp(a.roll, b.roll, local) + whip * 0.045);

    // Focal length breathes through the move. Small numbers: past about six
    // degrees this stops reading as a lens and starts reading as a glitch.
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, local) + whip * 3.5;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, fov, k);
      camera.updateProjectionMatrix();
    }
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

      {/* Shallow focus on the needle, resolving to fully sharp by the time the
          filaments are the subject — ramped per frame above. Rendered at 720p
          rather than 480p: the blur pass was the source of the blocky
          highlight, because a specular smaller than one low-res texel has
          nowhere to resolve. Skipped entirely on low-power devices, where it
          is by far the most expensive pass. */}
      {quality === "high" ? (
        <EffectComposer enableNormalPass={false} multisampling={4}>
          <DepthOfField
            ref={dof}
            focusDistance={0.019}
            focalLength={0.09}
            bokehScale={3.4}
            height={720}
          />
          <Vignette eskil={false} offset={0.26} darkness={0.66} />
        </EffectComposer>
      ) : null}
    </>
  );
}

export default function LoomScene({
  hex,
  gsm = 160,
  seed = "threadwyn",
  progress,
  quality = "high",
  active = true,
}: {
  weave?: WeaveKey;
  hex: string;
  gsm?: number;
  seed?: string;
  progress: React.RefObject<number>;
  quality?: "high" | "low";
  /**
   * Whether the stage is actually on screen. Drives `frameloop`, so the
   * renderer stops entirely when the scene is scrolled past instead of
   * animating filaments nobody can see.
   */
  active?: boolean;
}) {
  const fog = useMemo(() => paletteFrom(hex).fog, [hex]);

  return (
    <Canvas
      gl={{ antialias: quality === "high", alpha: true, powerPreference: "high-performance" }}
      // Capping DPR is the cheapest frame-rate win available on a 4K display:
      // the fragment cost of this scene scales with pixels, not with geometry.
      dpr={quality === "high" ? [1, 1.6] : [1, 1.15]}
      camera={{ position: [0, 0.2, 4.8], fov: 40, near: 0.1, far: 40 }}
      frameloop={active ? "always" : "never"}
    >
      {/* Three-point rig. The strong key from upper-left is what gives the
          tubes their cylindrical read; the cool fill keeps the shadow side from
          going dead; the rim separates filaments from the background. */}
      <ambientLight intensity={0.5} color="#FBF3E4" />
      <directionalLight position={[3.6, 4.2, 3.4]} intensity={2.4} color="#FFF6E6" />
      <directionalLight position={[-3.4, -1.2, 1.6]} intensity={0.85} color="#9FBFCC" />
      <directionalLight position={[0, 1.4, -4]} intensity={1.15} color="#FFE7C4" />

      <Field hex={hex} gsm={gsm} seedText={seed} progress={progress} quality={quality} />

      {/* Depth falloff — the far filaments sink into the dark. */}
      <fog attach="fog" args={[`#${fog.getHexString()}`, 4.4, 14]} />

    </Canvas>
  );
}
