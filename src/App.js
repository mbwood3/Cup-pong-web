import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Edges } from "@react-three/drei";
import { Physics, useContactMaterial, useSphere, usePlane, useCylinder, useCompoundBody } from "@react-three/cannon";
import * as THREE from "three";

function PhysicsTuning() {
  // "GamePigeon-ish" tuning: less bouncy on floor, snappier rim interactions.
  useContactMaterial(
    { name: "ball" },
    { name: "floor" },
    { friction: 0.28, restitution: 0.32 },
    []
  );
  useContactMaterial(
    { name: "ball" },
    { name: "cup" },
    { friction: 0.22, restitution: 0.42 },
    []
  );
  return null;
}

function PsyMoonSky() {
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vDir;
        uniform float uTime;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = p * 2.03 + vec2(17.0, 9.0);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          // Spherical UV from direction
          float u = atan(vDir.z, vDir.x) / (6.28318530718) + 0.5;
          float v = asin(clamp(vDir.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
          vec2 uv = vec2(u, v);

          // Base space gradient
          vec3 top = vec3(0.02, 0.00, 0.09);
          vec3 bot = vec3(0.07, 0.00, 0.10);
          vec3 col = mix(bot, top, smoothstep(0.0, 1.0, uv.y));

          // Psychedelic nebula flow
          float t = uTime * 0.05;
          vec2 p = uv * 3.5;
          p += vec2(sin(t + uv.y * 2.0), cos(t * 1.3 + uv.x * 2.0)) * 0.35;
          float n = fbm(p + vec2(t * 2.0, -t * 1.6));
          float n2 = fbm(p * 1.7 - vec2(t * 1.2, t * 1.9));
          vec3 nebA = vec3(0.85, 0.15, 1.00);
          vec3 nebB = vec3(0.10, 0.90, 1.00);
          vec3 nebC = vec3(1.00, 0.65, 0.15);
          col += mix(nebA, nebB, n) * (0.25 * smoothstep(0.25, 0.85, n2));
          col += nebC * (0.12 * smoothstep(0.55, 0.95, n));

          // Stars (crisp + twinkly)
          vec2 suv = uv * vec2(1400.0, 700.0);
          vec2 cell = floor(suv);
          vec2 f = fract(suv);
          float h = hash(cell);
          float star = smoothstep(0.9975, 1.0, h) * (1.0 - length(f - 0.5) * 1.6);
          float tw = 0.65 + 0.35 * sin(uTime * 2.7 + h * 19.0);
          col += vec3(1.0) * star * tw;

          // Subtle vignette
          float vig = smoothstep(0.95, 0.2, length(uv - 0.5));
          col *= (0.85 + 0.15 * vig);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    return m;
  }, []);

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh scale={[-1, 1, 1]} frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[60, 48, 48]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function makeCraterMapTexture({ size = 512, seed = 2 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const rand = (() => {
    let s = (seed >>> 0) || 1;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 4294967296;
  })();

  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);

  // soft noise
  for (let i = 0; i < 14000; i++) {
    const x = (rand() * size) | 0;
    const y = (rand() * size) | 0;
    const v = 118 + ((rand() * 40) | 0);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // craters
  for (let i = 0; i < 220; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = (0.02 + rand() * 0.12) * size;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, "rgb(90,90,90)");
    grad.addColorStop(0.55, "rgb(150,150,150)");
    grad.addColorStop(1, "rgb(128,128,128)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function CrazyMoonBackdrop() {
  const craterTex = useMemo(() => makeCraterMapTexture({ size: 1024, seed: 11 }), []);
  const moonRef = useRef();
  const haloRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (moonRef.current) {
      moonRef.current.rotation.y = t * 0.06;
      moonRef.current.rotation.z = t * 0.02;
    }
    if (haloRef.current) {
      haloRef.current.material.opacity = 0.22 + 0.08 * Math.sin(t * 1.1);
    }
  });

  return (
    <>
      <PsyMoonSky />

      {/* Big “crazy moon” object */}
      <mesh ref={moonRef} position={[10, 11, -22]} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[4.2, 64, 64]} />
        <meshStandardMaterial
          color="#d8ddff"
          emissive="#6b4dff"
          emissiveIntensity={0.28}
          roughness={0.85}
          metalness={0.05}
          bumpMap={craterTex}
          bumpScale={0.55}
        />
      </mesh>

      {/* Moon halo glow */}
      <mesh ref={haloRef} position={[10, 11, -22]} castShadow={false} receiveShadow={false} renderOrder={-10}>
        <sphereGeometry args={[5.2, 48, 48]} />
        <meshBasicMaterial
          color="#9a7bff"
          transparent
          opacity={0.24}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
        />
      </mesh>
    </>
  );
}

function MoonDragon() {
  const group = useRef();
  const wingL = useRef();
  const wingR = useRef();

  const bodyMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#b9a6ff"),
      emissive: new THREE.Color("#7b2cff"),
      emissiveIntensity: 0.65,
      roughness: 0.35,
      metalness: 0.15,
      toneMapped: false,
    });
    return m;
  }, []);

  const wingMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#201028"),
      emissive: new THREE.Color("#ff4dff"),
      emissiveIntensity: 0.55,
      roughness: 0.75,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
    });
    return m;
  }, []);

  const curve = useMemo(() => {
    const pts = [];
    // Keep the dragon in front of the camera (in the sky, near the moon).
    const center = new THREE.Vector3(0, 10.5, -12);
    const r = 9.5;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          center.x + Math.cos(a) * r,
          center.y + Math.sin(a * 2) * 1.4,
          center.z + Math.sin(a) * r
        )
      );
    }
    return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
  }, []);

  const tubeGeom = useMemo(() => {
    return new THREE.TubeGeometry(curve, 160, 0.16, 10, true);
  }, [curve]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = group.current;
    if (!g) return;

    // Move along curve
    const u = (t * 0.03) % 1;
    const p = curve.getPointAt(u);
    const p2 = curve.getPointAt((u + 0.01) % 1);
    g.position.copy(p);
    g.lookAt(p2);

    // Subtle banking
    g.rotation.z += 0.25 * Math.sin(t * 0.9);

    // Wing flap
    const flap = Math.sin(t * 5.2) * 0.55 + Math.sin(t * 2.1) * 0.15;
    if (wingL.current) {
      wingL.current.rotation.z = 0.25 + flap;
      wingL.current.rotation.y = 0.55;
    }
    if (wingR.current) {
      wingR.current.rotation.z = -0.25 - flap;
      wingR.current.rotation.y = -0.55;
    }

    // Color shifting glow
    const hue = (t * 0.06) % 1;
    bodyMat.color.setHSL(hue, 0.9, 0.6);
    bodyMat.emissive.setHSL((hue + 0.55) % 1, 1, 0.45);
    bodyMat.emissiveIntensity = 0.55 + 0.25 * Math.sin(t * 1.7);
  });

  return (
    <group ref={group} position={[0, 10, -12]} scale={2.4} frustumCulled={false}>
      <pointLight color="#c06bff" intensity={1.15} distance={18} decay={2} position={[0, 0.6, 0.8]} />
      {/* Body */}
      <mesh geometry={tubeGeom} material={bodyMat} castShadow />
      {/* Head */}
      <mesh position={[0, 0, 0.35]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#a400ff"
          emissiveIntensity={1.1}
          roughness={0.2}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Wings */}
      <group position={[0, 0, -0.1]}>
        <mesh ref={wingL} position={[0.35, 0.05, 0]} material={wingMat} castShadow>
          <planeGeometry args={[1.4, 0.65, 1, 1]} />
        </mesh>
        <mesh ref={wingR} position={[-0.35, 0.05, 0]} material={wingMat} castShadow>
          <planeGeometry args={[1.4, 0.65, 1, 1]} />
        </mesh>
      </group>
    </group>
  );
}

function PsychedelicCupMaterial({ baseColor, seed, map }) {
  const materialRef = useRef();
  const shaderRef = useRef(null);

  const baseHsl = useMemo(() => {
    const c = new THREE.Color(baseColor);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return hsl;
  }, [baseColor]);

  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uSeed = { value: seed };
      shaderRef.current = shader;

      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        "varying vec3 vPsyPos;\nvoid main() {"
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPsyPos = position;"
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "varying vec3 vPsyPos;\nuniform float uTime;\nuniform float uSeed;\nvoid main() {"
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float t = uTime * 1.25 + uSeed * 0.73;
        float flow = sin((vPsyPos.y * 9.0 + vPsyPos.x * 3.0 + vPsyPos.z * 3.0) + t * 2.0) * 0.5 + 0.5;
        vec3 palette = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + (t + vPsyPos.y * 6.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * palette, 0.75);
        diffuseColor.rgb += palette * (0.12 * flow);
        `
      );
    };

    mat.needsUpdate = true;
  }, [seed]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (shaderRef.current) shaderRef.current.uniforms.uTime.value = t;

    const mat = materialRef.current;
    if (!mat) return;

    const hue =
      (baseHsl.h +
        0.12 * Math.sin(t * 0.35 + seed * 0.9) +
        (seed * 0.03) % 1) %
      1;

    mat.color.setHSL((hue + 1) % 1, Math.min(1, baseHsl.s + 0.35), Math.min(0.65, baseHsl.l + 0.15));
    mat.emissive.setHSL((hue + 0.55) % 1, 1, 0.35);
    mat.emissiveIntensity = 0.35 + 0.25 * Math.sin(t * 1.7 + seed);
  });

  return (
    <meshPhysicalMaterial
      ref={materialRef}
      map={map || undefined}
      roughness={0.35}
      metalness={0.25}
      clearcoat={0.9}
      clearcoatRoughness={0.1}
      iridescence={1}
      iridescenceIOR={1.3}
      iridescenceThicknessRange={[100, 400]}
      toneMapped={false}
    />
  );
}

// 1. The Floor
function Floor() {
  const [ref] = usePlane(() => ({ 
    rotation: [-Math.PI / 2, 0, 0], 
    position: [0, -0.1, 0],
    material: { name: "floor" },
  }));
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <circleGeometry args={[10, 64]} />
      <meshStandardMaterial color="#2d2d44" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

// 2. The Smart Ball
function PingPongBall({ resetTrigger }) {
  const [ref, api] = useSphere(() => ({
    mass: 0.04, // Slightly lighter for a more GamePigeon-ish feel
    position: [0, 2, 6],
    args: [0.15],
    material: { name: "ball" },
    linearDamping: 0.14, // Air resistance
    angularDamping: 0.38,
    userData: { type: "ball" },
  }));

  useEffect(() => {
    // Reset logic
    api.position.set(0, 2, 5); // Start slightly closer
    api.velocity.set(0, 0, 0);
    api.angularVelocity.set(0, 0, 0);
  }, [resetTrigger, api]);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const timeDiff = endTime - startTime;
      
      // Safety check for accidental taps
      if (timeDiff < 50) return;

      // GamePigeon-ish throw curve: mostly forward with a controllable arc.
      const swipeY = Math.max(0, -deltaY); // only upward swipes throw
      const swipeX = deltaX;
      const power = Math.min(1, swipeY / 420); // normalize

      const vZ = -(2.4 + power * 5.6);
      const vY = 1.55 + power * 6.9;
      const vX = THREE.MathUtils.clamp((swipeX / timeDiff) * 1.8, -2.2, 2.2);

      api.velocity.set(vX, vY, vZ);
      // Add a bit of "english" (spin) for feel
      api.angularVelocity.set(0, vX * 2.2, 0);
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [api]);

  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[0.15, 32, 32]} />
      <meshStandardMaterial color="white" emissive="#222" emissiveIntensity={0.35} roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

// 3. The Static Cup (with optional logo texture)
function Cup({ id, position, rotation, color, logo, seed = 0, onScored }) {
  // Physics: build a hollow "cup" using wall segments + a bottom.
  // This lets the ball fall *into* the cup instead of colliding with a solid cylinder.
  const CUP_HEIGHT = 0.6;
  const WALLS = 10;
  const WALL_THICKNESS = 0.05;
  const INNER_RADIUS = 0.19;
  const SENSOR_RADIUS = INNER_RADIUS * 0.62;
  const SENSOR_HEIGHT = CUP_HEIGHT * 0.28;
  const WALL_RADIUS = INNER_RADIUS + WALL_THICKNESS * 0.5;
  const SEG_LEN = (2 * Math.PI * WALL_RADIUS) / WALLS * 0.9;
  const BOTTOM_THICKNESS = 0.06;
  const [cupX, cupY, cupZ] = position;
  const [rotX, rotY, rotZ] = rotation;
  const sensorPosition = useMemo(() => [cupX, cupY - CUP_HEIGHT * 0.22, cupZ], [cupX, cupY, cupZ]);

  const [ref] = useCompoundBody(() => {
    const shapes = [];
    // Wall ring (boxes)
    for (let i = 0; i < WALLS; i++) {
      const theta = (i / WALLS) * Math.PI * 2;
      const x = Math.cos(theta) * WALL_RADIUS;
      const z = Math.sin(theta) * WALL_RADIUS;
      // Rotate so the long axis is tangent to the circle (theta + 90deg)
      shapes.push({
        type: "Box",
        args: [WALL_THICKNESS * 0.5, CUP_HEIGHT * 0.5, SEG_LEN * 0.5],
        position: [x, 0, z],
        rotation: [0, theta + Math.PI / 2, 0],
      });
    }
    // Bottom "disc"
    shapes.push({
      type: "Cylinder",
      args: [INNER_RADIUS, INNER_RADIUS, BOTTOM_THICKNESS, 16],
      position: [0, -CUP_HEIGHT * 0.5 + BOTTOM_THICKNESS * 0.5, 0],
      rotation: [Math.PI / 2, 0, 0],
    });

    return {
      mass: 0,
      position,
      rotation,
      material: { name: "cup" },
      shapes,
    };
  }, undefined, [cupX, cupY, cupZ, rotX, rotY, rotZ]);

  // Goal sensor: an invisible trigger volume inside the cup.
  // When the ball touches this, we count it as "in the cup" and remove the cup.
  const scoredRef = useRef(false);
  const handleTrigger = useCallback(
    (e) => {
      if (scoredRef.current) return;
      const body = e?.body;
      if (!body) return;
      const isBall = body.userData?.type === "ball" || body.material?.name === "ball";
      if (!isBall) return;

      const p = body.position;
      const dx = p.x - cupX;
      const dz = p.z - cupZ;
      const inside = dx * dx + dz * dz < SENSOR_RADIUS * SENSOR_RADIUS;
      const lowEnough = p.y < cupY + CUP_HEIGHT * 0.15;
      if (!inside || !lowEnough) return;

      scoredRef.current = true;
      onScored?.(id);
    },
    [CUP_HEIGHT, SENSOR_RADIUS, cupX, cupY, cupZ, id, onScored]
  );

  const [sensorRef] = useCylinder(
    () => ({
      mass: 0,
      type: "Static",
      isTrigger: true,
      collisionResponse: false,
      position: sensorPosition,
      rotation,
      // Smaller + lower than full cup volume to avoid false positives on rim hits.
      args: [SENSOR_RADIUS, SENSOR_RADIUS, SENSOR_HEIGHT, 12],
      onCollideBegin: handleTrigger,
    }),
    undefined,
    [sensorPosition[0], sensorPosition[1], sensorPosition[2], rotX, rotY, rotZ, handleTrigger]
  );

  const [texture, setTexture] = useState(null);
  const outlineColor = useMemo(() => {
    const c = new THREE.Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    const outline = new THREE.Color().setHSL((hsl.h + 0.5) % 1, 1, 0.68);
    return outline.getStyle();
  }, [color]);

  useEffect(() => {
    if (!logo) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      logo,
      (t) => {
        if (cancelled) {
          t.dispose();
          return;
        }
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        setTexture(t);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null);
      }
    );
    return () => {
      cancelled = true;
      // Do not dispose the applied texture here; the material may still
      // reference it. Only in-flight textures are disposed (in load callback
      // when cancelled).
    };
  }, [logo]);

  return (
    <group>
      <mesh ref={ref} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.15, 0.6, 32]} />
        <PsychedelicCupMaterial baseColor={color} seed={seed} map={texture} />
        {/* Outline + neon rim for cup differentiation */}
        <Edges scale={1.01} threshold={15} color="#050505" />
        <Edges scale={1.045} threshold={15} color={outlineColor} />
      </mesh>
      <mesh ref={sensorRef} position={sensorPosition} rotation={rotation} visible={false}>
        <cylinderGeometry args={[SENSOR_RADIUS, SENSOR_RADIUS, SENSOR_HEIGHT, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function makeInitialCups() {
  const racks = [
    { angle: 0, color: "#ff4444", logo: `${process.env.PUBLIC_URL || ""}/logos/placeholder-red.svg`, seedOffset: 0 },
    { angle: (2 * Math.PI) / 3, color: "#4444ff", logo: `${process.env.PUBLIC_URL || ""}/logos/placeholder-blue.svg`, seedOffset: 100 },
    { angle: (4 * Math.PI) / 3, color: "#44ff44", logo: `${process.env.PUBLIC_URL || ""}/logos/placeholder-green.svg`, seedOffset: 200 },
  ];

  const DISTANCE_FROM_CENTER = 2.0;
  const SPACING = 0.52;
  const ROW_OFFSET = (SPACING * Math.sqrt(3)) / 2;

  const out = [];
  let id = 0;
  for (const rack of racks) {
    const angle = rack.angle;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        const localX = (col - row / 2) * SPACING;
        const localZ = row * ROW_OFFSET;

        const worldX = localX * Math.cos(angle) - (localZ + DISTANCE_FROM_CENTER) * Math.sin(angle);
        const worldZ = localX * Math.sin(angle) + (localZ + DISTANCE_FROM_CENTER) * Math.cos(angle);

        out.push({
          id: id++,
          position: [worldX, 0.2, worldZ],
          rotation: [0, -angle, 0],
          color: rack.color,
          logo: rack.logo,
          seed: rack.seedOffset + id,
        });
      }
    }
  }
  return out;
}

// 5. The Main App
export default function App() {
  const [resetCount, setResetCount] = useState(0);
  const initialCups = useMemo(() => makeInitialCups(), []);
  const [cups, setCups] = useState(() => initialCups);

  const handleCupScored = useMemo(() => {
    return (cupId) => {
      setCups((prev) => prev.filter((c) => c.id !== cupId));
      // reset the ball after a make
      setResetCount((n) => n + 1);
    };
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#222", touchAction: "none" }}>
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 45 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <CrazyMoonBackdrop />
        <MoonDragon />
        <ambientLight intensity={0.22} />
        <directionalLight
          position={[6, 12, 6]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={30}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0002}
        />
        <pointLight position={[-6, 8, -6]} intensity={0.35} />
        
        <Physics
          gravity={[0, -9.8, 0]}
          broadphase="SAP"
          iterations={30}
          allowSleep
          defaultContactMaterial={{
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3,
            frictionEquationStiffness: 1e8,
            frictionEquationRelaxation: 3,
          }}
        >
          <PhysicsTuning />
          <Floor />
          <PingPongBall resetTrigger={resetCount} />
          
          {cups.map((c) => (
            <Cup key={c.id} {...c} onScored={handleCupScored} />
          ))}

        </Physics>

        {/* Soft extra depth under the action */}
        <ContactShadows position={[0, -0.095, 0]} opacity={0.55} scale={18} blur={3.25} far={10} />
      </Canvas>
      
      {/* ... Button Code (Keep as is) ... */}
      <div style={{
        position: "absolute", bottom: "50px", width: "100%", 
        display: "flex", justifyContent: "center", pointerEvents: "none"
      }}>
        <button 
          style={{
            padding: "15px 30px", fontSize: "20px", background: "white", 
            border: "none", borderRadius: "50px", pointerEvents: "auto", 
            boxShadow: "0px 4px 10px rgba(0,0,0,0.3)", cursor: "pointer", fontWeight: "bold"
          }}
          onClick={() => setResetCount(resetCount + 1)}
        >
          Reset Ball
        </button>
      </div>
    </div>
  );
}