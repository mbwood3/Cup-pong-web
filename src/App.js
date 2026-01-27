import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics, useSphere, usePlane, useCylinder } from "@react-three/cannon";
import * as THREE from "three";

// 1. The Floor
function Floor() {
  const [ref] = usePlane(() => ({ 
    rotation: [-Math.PI / 2, 0, 0], 
    position: [0, -0.1, 0] 
  }));
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <circleGeometry args={[10, 64]} />
      <meshStandardMaterial color="#333" />
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
    <mesh ref={ref}>
      <sphereGeometry args={[0.15, 32, 32]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
}

// 3. The Static Cup (with optional logo texture)
function Cup({ position, rotation, color, logo }) {
  const [ref] = useCylinder(() => ({
    mass: 0, // Static = Immovable (like a wall)
    position: position,
    rotation: rotation, // Pass the calculated rotation
    args: [0.25, 0.15, 0.6, 16],
  }));

  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!logo) return;
    let tex = null;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      logo,
      (t) => {
        if (cancelled) { t.dispose(); return; }
        tex = t;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => { if (!cancelled) setTexture(null); }
    );
    return () => {
      cancelled = true;
      if (tex) tex.dispose();
    };
  }, [logo]);

  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.25, 0.15, 0.6, 32]} />
      <meshStandardMaterial
        color={texture ? "#ffffff" : color}
        map={texture || undefined}
      />
    </mesh>
  );
}

// 4. The Rack (Now with World Coordinate Math)
function CupRack({ angle, color, logo }) {
  const cups = [];
  let k = 0;
  
  // Settings
  const DISTANCE_FROM_CENTER = 2.0; // How far the rack is from the middle
  const SPACING = 0.52; // Distance between cups
  
  // Math Helpers
  const ROW_OFFSET = SPACING * Math.sqrt(3) / 2;

  // We loop through the rows/cols just like before
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      
      // 1. Calculate "Local" Position (as if rack was at 0,0,0 facing North)
      // We center the triangle so the "tip" is closest to the middle
      const localX = (col - row / 2) * SPACING;
      const localZ = row * ROW_OFFSET; // Positive Z goes "back" into the triangle

      // 2. Rotate this position around the world center
      // We add Math.PI to 'angle' so the racks face INWARDS to the center
      const theta = angle; 
      
      // Rotate local (x, z) by theta
      // We also push it out by DISTANCE_FROM_CENTER
      const worldX = (localX * Math.cos(theta)) - ((localZ + DISTANCE_FROM_CENTER) * Math.sin(theta));
      const worldZ = (localX * Math.sin(theta)) + ((localZ + DISTANCE_FROM_CENTER) * Math.cos(theta));
      
      cups.push(
        <Cup 
          key={k++} 
          position={[worldX, 0.2, worldZ]} 
          rotation={[0, -angle, 0]} // Rotate the cup to match the rack
          color={color}
          logo={logo}
        />
      );
    }
  }
  return <>{cups}</>; // Return cups directly, no <group> wrapper needed
}

// 5. The Main App
export default function App() {
  const [resetCount, setResetCount] = useState(0);

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#222", touchAction: "none" }}>
      <Canvas camera={{ position: [0, 8, 12], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        <Physics gravity={[0, -9.8, 0]} iterations={20}>
          <Floor />
          <PingPongBall resetTrigger={resetCount} />
          
          {/* Racks are now placed by angle (in radians).
             0 = Facing South
             2*PI/3 = 120 degrees
             4*PI/3 = 240 degrees
          */}
          <CupRack angle={0} color="#ff4444" logo="/logos/placeholder-red.svg" /> 
          <CupRack angle={(2 * Math.PI) / 3} color="#4444ff" logo="/logos/placeholder-blue.svg" /> 
          <CupRack angle={(4 * Math.PI) / 3} color="#44ff44" logo="/logos/placeholder-green.svg" /> 

        </Physics>
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