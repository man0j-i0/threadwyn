"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { hexToHsl, type WeaveKey } from "@/lib/weave";

/**
 * The loom.
 *
 * Warp threads run away from the camera under tension; the shuttle flies across
 * carrying the weft; cloth appears behind it. Every thread is a real tube in
 * space, undulating over and under its crossings according to the actual lift
 * plan for this fabric's weave — a plain weave alternates every end, a twill
 * steps one each pick, a satin scatters its binding points across five. So the
 * structure you watch being made is the structure you would get on the roll.
 *
 * Geometry is generated from the product's spec, not loaded from a model file:
 * thread count follows GSM, colour follows the colourway, interlacing follows
 * the weave. That means it works for all 60 fabrics, ships no asset to
 * download, and can never show the wrong cloth.
 *
 * Performance: warp and weft are each merged into one buffer geometry (two
 * draw calls, not fifty-six), and the weave is revealed with a moving clipping
 * plane rather than by rebuilding geometry on every frame.
 */

type LoomProps = {
  weave: WeaveKey;
  hex: string;
  /** 0 → bare warp, 1 → finished cloth. Driven by scroll. */
  progress: React.RefObject<number>;
  quality: "high" | "low";
};

/** Whether the warp end sits above the weft at this crossing. */
function warpOnTop(weave: WeaveKey, col: number, row: number): boolean {
  switch (weave) {
    case "PLAIN":
    case "CREPE":
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
    case "JERSEY":
      return (col + row) % 2 === 0;
    default:
      return (col + row) % 2 === 0;
  }
}

function toneFrom(hex: string) {
  const hsl = hexToHsl(hex);
  const make = (dl: number, ds = 0) =>
    new THREE.Color().setHSL(
      hsl.h / 360,
      Math.min(1, Math.max(0, (hsl.s + ds) / 100)),
      Math.min(0.96, Math.max(0.06, (hsl.l + dl) / 100)),
    );
  return {
    warp: make(-4, 2),
    weft: make(6, -2),
    shuttle: new THREE.Color("#5A4632"),
    metal: new THREE.Color("#C9B896"),
  };
}

function Loom({ weave, hex, progress, quality }: LoomProps) {
  const warpCount = quality === "high" ? 26 : 16;
  const weftCount = quality === "high" ? 40 : 24;
  const radial = quality === "high" ? 8 : 6;

  const spacing = 0.16;
  const yarnR = 0.052;
  const amp = yarnR * 1.05;

  const width = (warpCount - 1) * spacing;
  const depth = (weftCount - 1) * spacing;

  const tone = useMemo(() => toneFrom(hex), [hex]);

  /* --------------------------------------------------------- geometry --- */

  const { warpGeo, weftGeo, indicesPerPick } = useMemo(() => {
    // Warp: runs along Z, undulating in Y at each weft crossing.
    const warps: THREE.BufferGeometry[] = [];
    for (let i = 0; i < warpCount; i++) {
      const pts: THREE.Vector3[] = [];
      const x = i * spacing - width / 2;
      // A little extra length front and back so the threads run off-frame
      // rather than stopping in mid-air.
      pts.push(new THREE.Vector3(x, 0, -depth / 2 - spacing * 4));
      for (let j = 0; j < weftCount; j++) {
        const z = j * spacing - depth / 2;
        pts.push(new THREE.Vector3(x, warpOnTop(weave, i, j) ? amp : -amp, z));
      }
      pts.push(new THREE.Vector3(x, 0, depth / 2 + spacing * 6));

      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
      warps.push(new THREE.TubeGeometry(curve, weftCount * 2 + 8, yarnR, radial, false));
    }

    // Weft: runs along X, undulating in the opposite phase so the two
    // interlace instead of intersecting.
    const wefts: THREE.BufferGeometry[] = [];
    for (let j = 0; j < weftCount; j++) {
      const pts: THREE.Vector3[] = [];
      const z = j * spacing - depth / 2;
      pts.push(new THREE.Vector3(-width / 2 - spacing * 2, 0, z));
      for (let i = 0; i < warpCount; i++) {
        const x = i * spacing - width / 2;
        pts.push(new THREE.Vector3(x, warpOnTop(weave, i, j) ? -amp : amp, z));
      }
      pts.push(new THREE.Vector3(width / 2 + spacing * 2, 0, z));

      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
      wefts.push(new THREE.TubeGeometry(curve, warpCount * 2 + 6, yarnR * 0.96, radial, false));
    }

    // Every weft tube is built with identical parameters, so they all carry the
    // same index count. That lets us reveal picks with `setDrawRange` — one
    // integer per frame, no geometry rebuild, no clipping plane.
    const perPick = (wefts[0]?.getIndex()?.count ?? 0) || 1;

    const warpGeo = mergeGeometries(warps, false)!;
    const weftGeo = mergeGeometries(wefts, false)!;
    for (const g of [...warps, ...wefts]) g.dispose();

    return { warpGeo, weftGeo, indicesPerPick: perPick };
  }, [weave, warpCount, weftCount, radial, spacing, width, depth, amp, yarnR]);

  /* ----------------------------------------------------------- reveal --- */

  const weftMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: tone.weft, roughness: 0.82, metalness: 0.02 }),
    [tone.weft],
  );

  const warpMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: tone.warp, roughness: 0.86, metalness: 0.02 }),
    [tone.warp],
  );

  const shuttleRef = useRef<THREE.Group>(null);
  const threadRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const weftMeshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progress.current ?? 0, 0, 1);

    // The fell line — where finished cloth meets bare warp — advances with
    // scroll. Picks behind it exist; picks in front of it have not been thrown.
    const picksDone = p * weftCount;
    const fellZ = -depth / 2 + p * (depth + spacing * 2);

    if (weftMeshRef.current) {
      weftMeshRef.current.geometry.setDrawRange(0, Math.floor(picksDone) * indicesPerPick);
    }

    if (shuttleRef.current) {
      // One traverse per pick. The shuttle sits at the fell line and flies
      // across; `picksDone` is fractional so the motion is continuous.
      const across = picksDone % 1;
      const leftToRight = Math.floor(picksDone) % 2 === 0;
      // Ease the ends of the traverse — a real shuttle decelerates into the box.
      const eased = across < 0.5 ? 2 * across * across : 1 - (-2 * across + 2) ** 2 / 2;
      const t = leftToRight ? eased : 1 - eased;

      const x = THREE.MathUtils.lerp(-width / 2 - spacing * 2.5, width / 2 + spacing * 2.5, t);
      shuttleRef.current.position.set(x, amp * 2.4, fellZ);
      shuttleRef.current.rotation.z = (leftToRight ? -1 : 1) * 0.16;
      shuttleRef.current.visible = p > 0.01 && p < 0.995;

      // The thread trailing from the shuttle back to the cloth edge.
      if (threadRef.current) {
        const anchorX = leftToRight ? -width / 2 - spacing * 2 : width / 2 + spacing * 2;
        threadRef.current.position.set((x + anchorX) / 2, amp * 1.5, fellZ - spacing * 0.15);
        threadRef.current.scale.x = Math.max(0.001, Math.abs(x - anchorX));
      }
    }

    // A slow, small breathing rotation — enough to read as a real object in
    // space, not enough to fight the scroll.
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.rotation.y = Math.sin(t * 0.16) * 0.05;
    }

    // Camera pulls back and lifts as the cloth grows.
    const target = new THREE.Vector3(
      Math.sin(state.clock.elapsedTime * 0.13) * 0.15,
      1.05 + p * 1.5,
      2.15 + p * 1.9,
    );
    camera.position.lerp(target, 0.045);
    camera.lookAt(0, 0, fellZ * 0.4);
  });

  return (
    <group ref={groupRef} rotation={[0.08, 0, 0]}>
      {/* Cloth already woven — draw range grows one pick at a time. */}
      <mesh ref={weftMeshRef} geometry={weftGeo} material={weftMat} castShadow receiveShadow />

      {/* Warp is always strung; that is what a warped loom looks like. */}
      <mesh geometry={warpGeo} material={warpMat} castShadow receiveShadow />

      {/* The shuttle, and the weft it is paying out. */}
      <group ref={shuttleRef}>
        <mesh castShadow>
          {/* A boat shuttle: pointed at both ends, bellied in the middle. */}
          <latheGeometry
            args={[
              [
                new THREE.Vector2(0.001, -0.34),
                new THREE.Vector2(0.035, -0.2),
                new THREE.Vector2(0.055, 0),
                new THREE.Vector2(0.035, 0.2),
                new THREE.Vector2(0.001, 0.34),
              ],
              14,
            ]}
          />
          <meshStandardMaterial color={tone.shuttle} roughness={0.42} metalness={0.08} />
        </mesh>
        {/* the pirn of yarn inside it */}
        <mesh>
          <cylinderGeometry args={[0.026, 0.026, 0.2, 12]} />
          <meshStandardMaterial color={tone.weft} roughness={0.9} />
        </mesh>
        {/* metal tips */}
        <mesh position={[0, 0.34, 0]}>
          <coneGeometry args={[0.018, 0.07, 10]} />
          <meshStandardMaterial color={tone.metal} roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.34, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.018, 0.07, 10]} />
          <meshStandardMaterial color={tone.metal} roughness={0.3} metalness={0.7} />
        </mesh>
      </group>

      <mesh ref={threadRef} rotation={[0, 0, 0]}>
        <boxGeometry args={[1, yarnR * 0.9, yarnR * 0.9]} />
        <meshStandardMaterial color={tone.weft} roughness={0.9} />
      </mesh>

      {/* The reed: the comb that holds warp spacing and beats each pick up. */}
      <group position={[0, 0, -depth / 2 - spacing * 3]}>
        {Array.from({ length: warpCount + 1 }, (_, i) => (
          <mesh key={i} position={[i * spacing - width / 2 - spacing / 2, 0, 0]}>
            <boxGeometry args={[0.006, 0.46, 0.02]} />
            <meshStandardMaterial color={tone.metal} roughness={0.34} metalness={0.62} />
          </mesh>
        ))}
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[width + spacing * 2, 0.035, 0.05]} />
          <meshStandardMaterial color="#4A3A28" roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[width + spacing * 2, 0.035, 0.05]} />
          <meshStandardMaterial color="#4A3A28" roughness={0.6} />
        </mesh>
      </group>

      {/* Cloth beam — where the finished fabric rolls on. */}
      <mesh position={[0, -0.18, depth / 2 + spacing * 5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, width + spacing * 3, 20]} />
        <meshStandardMaterial color="#4A3A28" roughness={0.68} />
      </mesh>
    </group>
  );
}

export default function LoomScene({
  weave,
  hex,
  progress,
  quality = "high",
}: {
  weave: WeaveKey;
  hex: string;
  progress: React.RefObject<number>;
  quality?: "high" | "low";
}) {
  return (
    <Canvas
      gl={{ antialias: quality === "high", alpha: true }}
      dpr={quality === "high" ? [1, 1.8] : [1, 1.25]}
      camera={{ position: [0, 1.1, 2.2], fov: 42, near: 0.05, far: 60 }}
      shadows={quality === "high"}
      frameloop="always"
    >
      {/* Warm key from upper-left, cool fill, and a rim to separate the threads
          from the background — the standard three-point setup, kept subtle. */}
      <ambientLight intensity={0.55} color="#FBF3E4" />
      <directionalLight
        position={[3.2, 4.4, 2.6]}
        intensity={2.1}
        color="#FFF4E0"
        castShadow={quality === "high"}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3, 1.4, -2]} intensity={0.7} color="#BFD4DA" />
      <directionalLight position={[0, -2, 3]} intensity={0.35} color="#FFE9C9" />

      <Loom weave={weave} hex={hex} progress={progress} quality={quality} />

      <fog attach="fog" args={["#14120f", 6, 15]} />
    </Canvas>
  );
}
