import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Edges } from "@react-three/drei";
import { Physics, useSphere, usePlane, useCylinder, useCompoundBody } from "@react-three/cannon";
import * as THREE from "three";

function makeStarfieldMoonTexture({ width = 1024, height = 512, seed = 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const rand = (() => {
    // deterministic-ish LCG
    let s = (seed >>> 0) || 1;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 4294967296;
  })();

  // Space gradient
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#040017");
  g.addColorStop(0.5, "#090032");
  g.addColorStop(1, "#12001a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Nebula blobs
  for (let i = 0; i < 18; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = (0.08 + rand() * 0.25) * Math.min(width, height);
    const hue = (rand() * 360) | 0;
    const neb = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
    neb.addColorStop(0, `hsla(${hue}, 95%, 65%, 0.22)`);
    neb.addColorStop(1, `hsla(${hue}, 95%, 45%, 0)`);
    ctx.fillStyle = neb;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stars
  for (let i = 0; i < 2200; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const s = rand() < 0.985 ? 1 : 2;
    const a = 0.25 + rand() * 0.7;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, s, s);
  }

  // Big “crazy moon” disk baked into sky texture (for distant vibe)
  const moonX = width * 0.78;
  const moonY = height * 0.28;
  const moonR = height * 0.22;
  const moon = ctx.createRadialGradient(moonX, moonY, moonR * 0.05, moonX, moonY, moonR);
  moon.addColorStop(0, "rgba(250,250,255,0.95)");
  moon.addColorStop(0.55, "rgba(220,230,255,0.8)");
  moon.addColorStop(1, "rgba(160,170,210,0)");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 1.25, 0, Math.PI * 2);
  ctx.fill();

  // Crater hints on baked moon
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 60; i++) {
    const cx = moonX + (rand() * 2 - 1) * moonR * 0.7;
    const cy = moonY + (rand() * 2 - 1) * moonR * 0.7;
    const r = (0.02 + rand() * 0.12) * moonR;
    const crater = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    crater.addColorStop(0, "rgba(140,140,170,0.95)");
    crater.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
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
  const skyTex = useMemo(() => makeStarfieldMoonTexture({ seed: 7 }), []);
  const craterTex = useMemo(() => makeCraterMapTexture({ seed: 11 }), []);
  const moonRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (moonRef.current) {
      moonRef.current.rotation.y = t * 0.06;
      moonRef.current.rotation.z = t * 0.02;
    }
  });

  return (
    <>
      {/* Skydome */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[45, 48, 48]} />
        <meshBasicMaterial map={skyTex} side={THREE.BackSide} />
      </mesh>

      {/* Big “crazy moon” object */}
      <mesh ref={moonRef} position={[10, 11, -18]} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[4.2, 64, 64]} />
        <meshStandardMaterial
          color="#d8ddff"
          emissive="#6b4dff"
          emissiveIntensity={0.22}
          roughness={0.85}
          metalness={0.05}
          bumpMap={craterTex}
          bumpScale={0.55}
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
    const r = 16;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 6.5 + Math.sin(a * 2) * 1.2, Math.sin(a) * r));
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
    <group ref={group} position={[0, 6, 0]}>
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
    position: [0, -0.1, 0] 
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
    mass: 0.05, // Standard ping pong ball is 2.7g, but 0.05 feels right in Sim
    position: [0, 2, 6],
    args: [0.15],
    restitution: 0.8, // Bounciness
    linearDamping: 0.1, // Air resistance
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

      const forceFactor = 4; 
      
      // Calculate velocity based on swipe speed
      const vX = (deltaX / timeDiff) * forceFactor;
      const vY = (Math.abs(deltaY) / timeDiff) * forceFactor * 0.5; 
      const vZ = - (Math.abs(deltaY) / timeDiff) * forceFactor;

      api.velocity.set(vX, vY, vZ);
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
  const WALL_RADIUS = INNER_RADIUS + WALL_THICKNESS * 0.5;
  const SEG_LEN = (2 * Math.PI * WALL_RADIUS) / WALLS * 0.9;
  const BOTTOM_THICKNESS = 0.06;

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
      shapes,
    };
  }, undefined, [position[0], position[1], position[2], rotation[0], rotation[1], rotation[2]]);

  // Goal sensor: an invisible trigger volume inside the cup.
  // When the ball touches this, we count it as "in the cup" and remove the cup.
  const scoredRef = useRef(false);
  useCylinder(
    () => ({
      mass: 0,
      type: "Static",
      collisionResponse: false,
      position,
      rotation,
      args: [INNER_RADIUS * 0.85, INNER_RADIUS * 0.85, CUP_HEIGHT * 0.45, 12],
      onCollide: (e) => {
        if (scoredRef.current) return;
        if (!e?.body?.userData || e.body.userData.type !== "ball") return;
        scoredRef.current = true;
        onScored?.(id);
      },
    }),
    undefined,
    [id, onScored, position[0], position[1], position[2], rotation[0], rotation[1], rotation[2]]
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
    <mesh ref={ref} castShadow receiveShadow>
      <cylinderGeometry args={[0.25, 0.15, 0.6, 32]} />
      <PsychedelicCupMaterial baseColor={color} seed={seed} map={texture} />
      {/* Outline + neon rim for cup differentiation */}
      <Edges scale={1.01} threshold={15} color="#050505" />
      <Edges scale={1.045} threshold={15} color={outlineColor} />
    </mesh>
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
        
        <Physics gravity={[0, -9.8, 0]} iterations={20}>
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