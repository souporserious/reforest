import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { useRef, useState } from "react"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader"
import * as THREE from "three"
import { Box, OrbitControls, Svg } from "@react-three/drei"

function Logo() {
  const svgRef = useRef<any>()
  const shapes = useLoader(SVGLoader, "/reforest.svg")

  return (
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
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <Logo />
        <OrbitControls />
      </Canvas>
    </div>
  )
}
