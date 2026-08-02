"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * A needle, threaded.
 *
 * Built rather than downloaded, for the same reason as everything else here:
 * the cord takes this fabric's colour, so the opening shot is about the cloth
 * you clicked on and not a generic prop.
 *
 * The eye is the only fiddly part — an elongated slot through a flat shank. It
 * is an extruded shape with a hole, which gives real geometry for the light to
 * wrap around; a texture-mapped fake falls apart the moment the camera moves.
 */
export function Needle({
  envMap,
  metal = "#E8EAEC",
}: {
  envMap: THREE.Texture | null;
  metal?: string;
}) {
  const { shank, shaft, point } = useMemo(() => {
    // --- shank: rounded flat paddle with a slot through it ---
    const outline = new THREE.Shape();
    const w = 0.075;
    const h = 0.32;
    outline.moveTo(-w, -h);
    outline.quadraticCurveTo(-w * 1.18, 0, -w, h * 0.82);
    outline.quadraticCurveTo(0, h * 1.12, w, h * 0.82);
    outline.quadraticCurveTo(w * 1.18, 0, w, -h);
    outline.lineTo(-w, -h);

    const slot = new THREE.Path();
    const sw = 0.032;
    const sh = 0.185;
    slot.moveTo(-sw, -sh);
    slot.quadraticCurveTo(-sw * 1.35, 0, -sw, sh);
    slot.quadraticCurveTo(0, sh * 1.3, sw, sh);
    slot.quadraticCurveTo(sw * 1.35, 0, sw, -sh);
    slot.quadraticCurveTo(0, -sh * 1.3, -sw, -sh);
    outline.holes.push(slot);

    const shank = new THREE.ExtrudeGeometry(outline, {
      depth: 0.036,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.012,
      bevelSegments: 4,
      curveSegments: 28,
    });
    shank.center();

    // --- shaft: long taper from the shank down toward the point ---
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      profile.push(new THREE.Vector2(0.036 * (1 - t * 0.22), -t * 1.7));
    }
    const shaft = new THREE.LatheGeometry(profile, 28);

    const point = new THREE.ConeGeometry(0.028, 0.34, 28);

    return { shank, shaft, point };
  }, []);

  const material = useMemo(
    () =>
      // Slightly rougher than a mirror on purpose. A razor-thin specular on a
      // thin cylinder is exactly what aliases into a pixelated sparkle; a
      // broader highlight resolves cleanly at any resolution.
      new THREE.MeshPhysicalMaterial({
        color: metal,
        metalness: 1,
        roughness: 0.26,
        envMap,
        envMapIntensity: 1.25,
        clearcoat: 0.35,
        clearcoatRoughness: 0.28,
      }),
    [envMap, metal],
  );

  return (
    <group>
      <mesh geometry={shank} material={material} position={[0, 0, 0]} />
      <mesh geometry={shaft} material={material} position={[0, -0.3, 0]} />
      <mesh geometry={point} material={material} position={[0, -2.17, 0]} />
    </group>
  );
}

/**
 * A twisted cord — three strands helixing around a sinuous axis, the way a
 * real plied thread is made. It passes through the needle's eye, so the axis is
 * pinned to pass through the origin at the midpoint.
 */
export function Cord({
  hex,
  envMap,
  strands = 3,
  radial = 8,
}: {
  hex: string;
  envMap: THREE.Texture | null;
  strands?: number;
  radial?: number;
}) {
  const geometry = useMemo(() => {
    const SEG = 240;
    const SPAN = 9;
    const cordR = 0.028;
    const tubes: THREE.BufferGeometry[] = [];

    // The axis dips through the eye and lifts away on both sides — the shape
    // in every needle-and-thread photograph ever taken.
    const axis = (t: number) => {
      const x = (t - 0.5) * SPAN;
      const pinch = Math.exp(-((x / 1.5) ** 2)); // 1 at the eye, 0 far away
      const y = (1 - pinch) * (Math.sign(x) * 0.55 + Math.sin(x * 0.42) * 0.4);
      const z = (1 - pinch) * Math.sin(x * 0.3 + 1.1) * 0.55;
      return new THREE.Vector3(x, y, z);
    };

    for (let s = 0; s < strands; s++) {
      const phase = (s / strands) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];

      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const base = axis(t);
        const a = phase + t * Math.PI * 2 * 46; // twist rate
        // The helix collapses to nothing at the eye so the cord can fit through.
        const squeeze = 1 - 0.55 * Math.exp(-((base.x / 1.1) ** 2));
        pts.push(
          new THREE.Vector3(
            base.x,
            base.y + Math.sin(a) * cordR * squeeze,
            base.z + Math.cos(a) * cordR * squeeze,
          ),
        );
      }

      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
      tubes.push(new THREE.TubeGeometry(curve, SEG, 0.019, radial, false));
    }

    // Merging by hand keeps this to one draw call without pulling in the
    // BufferGeometryUtils import twice.
    const merged = tubes[0]!;
    for (let i = 1; i < tubes.length; i++) {
      const g = tubes[i]!;
      const combined = mergePair(merged.clone(), g);
      merged.copy(combined);
      combined.dispose();
      g.dispose();
    }
    return merged;
  }, [strands, radial]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: 0.66,
        metalness: 0.02,
        envMap,
        envMapIntensity: 0.5,
      }),
    [hex, envMap],
  );

  return <mesh geometry={geometry} material={material} />;
}

/** Minimal two-geometry merge for identically-attributed tubes. */
function mergePair(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry();

  for (const name of ["position", "normal", "uv"] as const) {
    const aa = a.getAttribute(name) as THREE.BufferAttribute | undefined;
    const ba = b.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!aa || !ba) continue;
    const arr = new Float32Array(aa.array.length + ba.array.length);
    arr.set(aa.array as Float32Array, 0);
    arr.set(ba.array as Float32Array, aa.array.length);
    out.setAttribute(name, new THREE.BufferAttribute(arr, aa.itemSize));
  }

  const ai = a.getIndex();
  const bi = b.getIndex();
  if (ai && bi) {
    const offset = (a.getAttribute("position") as THREE.BufferAttribute).count;
    const idx = new Uint32Array(ai.count + bi.count);
    for (let i = 0; i < ai.count; i++) idx[i] = ai.getX(i);
    for (let i = 0; i < bi.count; i++) idx[ai.count + i] = bi.getX(i) + offset;
    out.setIndex(new THREE.BufferAttribute(idx, 1));
  }

  a.dispose();
  return out;
}
