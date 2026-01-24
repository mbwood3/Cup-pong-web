import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Physics, useSphere, usePlane, useCylinder } from "@react-three/cannon";

// 1. The Floor
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

// 2. The Ball
function PingPongBall() {
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: [0, 5, 0],
    args: [0.15],
    restitution: 0.9,
  }));

  return (
    <mesh 
      ref={ref} 
      onClick={() => api.position.set(0, 5, 0)}
    >
      <sphereGeometry args={[0.15, 32, 32]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
}

// 3. A Single Cup
function Cup({ position, color }) {
  const [ref] = useCylinder(() => ({
    mass: 0.2, 
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
  return (
    <div style={{ height: "100vh", width: "100vw", background: "#222" }}>
      <Canvas camera={{ position: [0, 8, 8], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls />

        <Physics gravity={[0, -9.8, 0]}>
          <Floor />
          <PingPongBall />
          
          {/* Player 1 */}
          <CupRack position={[0, 0, 2]} rotation={[0, Math.PI, 0]} color="red" />
          
          {/* Player 2 */}
          <group rotation={[0, (2 * Math.PI) / 3, 0]}>
            <CupRack position={[0, 0, 2]} rotation={[0, Math.PI, 0]} color="blue" />
          </group>

          {/* Player 3 */}
          <group rotation={[0, (4 * Math.PI) / 3, 0]}>
            <CupRack position={[0, 0, 2]} rotation={[0, Math.PI, 0]} color="green" />
          </group>
        </Physics>

      </Canvas>
    </div>
  );
}
