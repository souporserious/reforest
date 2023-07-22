import { Environment, MeshPortalMaterial, OrbitControls, Svg } from "@react-three/drei"
import { Canvas, useLoader } from "@react-three/fiber"
import { useRef } from "react"
import * as THREE from "three"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader"
import "../app/canvas.css"

function Logo() {
  const svgRef = useRef<any>()
  const shapes = useLoader(SVGLoader, "/reforest.svg")

  return (
    <>
      <mesh>
        <ringGeometry args={[50, 52, 100]} />
        <meshStandardMaterial color="#B8860B" metalness={1.0} roughness={0.1} />
      </mesh>
      <mesh>
        <circleGeometry args={[50, 100]} />
        <MeshPortalMaterial side={THREE.DoubleSide}>
          <Svg
            fillMaterial={{
              wireframe: false,
            }}
            position={[-70, 70, 0]}
            scale={0.05}
            src="/reforest.svg"
            strokeMaterial={{
              wireframe: false,
            }}
          />
        </MeshPortalMaterial>
      </mesh>
    </>
  )
}

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 100],
        }}
      >
        <color attach="background" args={["#171d6c"]} />
        <ambientLight />
        <Environment preset="sunset" />
        <pointLight position={[0, 0, 10]} color="deeppink" intensity={10} />
        <Logo />
        <OrbitControls />
      </Canvas>
    </div>
  )
}
