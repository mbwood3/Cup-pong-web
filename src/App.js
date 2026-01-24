import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics, useSphere, usePlane, useCylinder } from "@react-three/cannon";

// 1. The Floor (Table)
function Floor() {
  const [ref] = usePlane(() => ({ 
    rotation: [-Math.PI / 2, 0, 0], 
    position: [0, -0.1, 0] 
  }));
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <circleGeometry args={[4, 64]} />
      <meshStandardMaterial color="#333" />
    </mesh>
  );
}

// 2. The Smart Ball (Now with Swipe!)
function PingPongBall({ resetTrigger }) {
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: [0, 2, 6], // Start closer to the camera (Player position)
    args: [0.15],
    restitution: 0.7,
  }));

  // Reset the ball whenever the "Reset" button is pressed
  useEffect(() => {
    api.position.set(0, 2, 6);
    api.velocity.set(0, 0, 0);
    api.angularVelocity.set(0, 0, 0);
  }, [resetTrigger, api]);

  // The Swipe Logic
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

      // Math: Calculate distance and time
      const deltaX = endX - startX;
      const deltaY = endY - startY; 
      const timeDiff = endTime - startTime;

      // Math: Convert swipe into 3D force
      // We divide by timeDiff so faster swipes = more power
      const forceFactor = 8; 
      
      const vX = (deltaX / timeDiff) * forceFactor;
      const vY = (Math.abs(deltaY) / timeDiff) * forceFactor * 0.8; // Upward arc
      const vZ = - (Math.abs(deltaY) / timeDiff) * forceFactor * 1.2; // Forward power (Negative Z is forward)

      // Apply the force to the ball
      api.velocity.set(vX, vY, vZ);
    };

    // Listen for touches on the whole window
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

// 3. A Single Cup
function Cup({ position, color }) {
  const [ref] = useCylinder(() => ({
    mass: 0.1, 
    position: position,
    args: [0.25, 0.15, 0.6, 16], 
  }));

  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.25, 0.15, 0.6, 32]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// 4. The Rack
function CupRack({ position, rotation, color }) {
  const cups = [];
  let k = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      const x = col * 0.6 - row * 0.3;
      const z = row * 0.5;
      cups.push(
        <Cup key={k++} position={[x, 0.3, z]} color={color} />
      );
    }
  }
  return (
    <group position={position} rotation={rotation}>
      {cups}
    </group>
  );
}

// 5. The Main App
export default function App() {
  // State to handle resetting the ball
  const [resetCount, setResetCount] = useState(0);

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#222", touchAction: "none" }}>
      
      {/* The 3D World */}
      <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        <Physics gravity={[0, -9.8, 0]}>
          <Floor />
          <PingPongBall resetTrigger={resetCount} />
          
          {/* Cups */}
          <CupRack position={[0, 0, 0]} rotation={[0, Math.PI, 0]} color="red" />
          <group rotation={[0, (2 * Math.PI) / 3, 0]}>
            <CupRack position={[0, 0, 0]} rotation={[0, Math.PI, 0]} color="blue" />
          </group>
          <group rotation={[0, (4 * Math.PI) / 3, 0]}>
            <CupRack position={[0, 0, 0]} rotation={[0, Math.PI, 0]} color="green" />
          </group>
        </Physics>
      </Canvas>

      {/* The User Interface (Overlay) */}
      <div style={{
        position: "absolute",
        bottom: "50px",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none" // Let touches pass through to the game
      }}>
        <button 
          style={{
            padding: "15px 30px",
            fontSize: "20px",
            background: "white",
            border: "none",
            borderRadius: "50px",
            pointerEvents: "auto", // Re-enable clicks for the button
            boxShadow: "0px 4px 10px rgba(0,0,0,0.3)"
          }}
          onClick={() => setResetCount(resetCount + 1)}
        >
          Reset Ball
        </button>
      </div>

    </div>
  );
}
