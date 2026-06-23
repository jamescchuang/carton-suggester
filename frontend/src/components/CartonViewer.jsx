import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";

// One packed item: a colored, centered box. py3dbp gives the min corner;
// three.js meshes are centered, so we offset by half-size. The whole carton
// is recentered on the origin by subtracting half the carton size.
//
// Items are rendered OPAQUE on purpose: overlapping translucent boxes cause
// depth-sorting artifacts (flicker / see-through) that change as the camera
// rotates. Only the outer shell is translucent.
function PackedBox({ position, size, color, carton }) {
  const center = [
    position[0] + size[0] / 2 - carton[0] / 2,
    position[1] + size[1] / 2 - carton[1] / 2,
    position[2] + size[2] / 2 - carton[2] / 2,
  ];
  return (
    <mesh position={center}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.05} roughness={0.7} />
      <Edges threshold={15} color="#0d1218" />
    </mesh>
  );
}

function CartonShell({ size }) {
  return (
    <mesh>
      <boxGeometry args={size} />
      {/* depthWrite=false so the shell never occludes the items inside it. */}
      <meshBasicMaterial color="#88aaff" transparent opacity={0.05} depthWrite={false} />
      <Edges threshold={1} color="#5577aa" />
    </mesh>
  );
}

export default function CartonViewer({ carton, colorMap }) {
  const size = carton.size; // [w, h, l]
  const maxDim = Math.max(...size) || 1;
  const dist = maxDim * 2.2;

  return (
    <div className="viewer">
      <Canvas
        // Remount when the carton (or item count) changes so the camera re-fits.
        key={`${size.join("x")}-${carton.items.length}`}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{
          position: [dist, dist * 0.85, dist * 1.15],
          fov: 45,
          near: maxDim * 0.01,
          far: dist * 50,
        }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[1, 2, 3]} intensity={1.1} />
        <directionalLight position={[-2, 1, -1]} intensity={0.4} />

        <CartonShell size={size} />
        {carton.items.map((it) => (
          <PackedBox
            key={it.uid}
            position={it.position}
            size={it.size}
            color={colorMap[it.name] || "#888"}
            carton={size}
          />
        ))}

        <gridHelper
          args={[maxDim * 4, 16, "#2a3340", "#1c242e"]}
          position={[0, -size[1] / 2 - 0.01, 0]}
        />

        <OrbitControls
          makeDefault
          enablePan
          enableDamping
          dampingFactor={0.12}
          target={[0, 0, 0]}
          minDistance={maxDim * 0.4}
          maxDistance={dist * 6}
        />
      </Canvas>
    </div>
  );
}
