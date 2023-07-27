import { Environment, Mask, ScrollControls, useMask, useScroll } from "@react-three/drei"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { useRef } from "react"
import * as THREE from "three"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader"
import "../app/canvas.css"

function Logo() {
  const mesh = useRef<any>()
  const maskRef = useRef<any>()
  const ringRef = useRef<any>()
  const shapes = useLoader(SVGLoader, "/reforest.svg")
  const scroll = useScroll()
  const stencil = useMask(1, false)

  useFrame((state, delta) => {
    const offset = scroll.offset
    const portalScale = 1.0 + offset * 2 // Scale the portal down
    maskRef.current.scale.set(portalScale, portalScale, portalScale)
    ringRef.current.scale.set(portalScale, portalScale, portalScale)
  })

  return (
    <>
      <mesh ref={ringRef}>
        <ringGeometry args={[50, 51, 100]} />
        <meshStandardMaterial color="#B8860B" metalness={1.0} roughness={0.1} />
      </mesh>
      <Mask ref={maskRef} id={1} colorWrite depthWrite={false}>
        <circleGeometry args={[50, 100]} />
      </Mask>
      <mesh ref={mesh}>
        <group scale={[0.1, 0.1, 0.1]} rotation={[Math.PI, 0, 0]} position={[-120, 100, -10]}>
          {shapes.paths.map((path, index) => (
            <mesh key={index}>
              <shapeGeometry attach="geometry" args={[path.toShapes(true)]} />
              <meshBasicMaterial
                attach="material"
                color={new THREE.Color().setHSL(index / shapes.paths.length, 1, 0.5)}
                side={THREE.DoubleSide}
                {...stencil}
              />
            </mesh>
          ))}
        </group>
      </mesh>
    </>
  )
}

function Scene() {
  return (
    <ScrollControls>
      <Logo />
    </ScrollControls>
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
          position: [0, 0, 150],
          fov: 45,
          near: 0.1,
          far: 2000,
        }}
        gl={{ localClippingEnabled: true }}
      >
        <color attach="background" args={["#171d6c"]} />
        <ambientLight />
        <Environment preset="sunset" />
        <pointLight position={[0, 0, 10]} color="deeppink" intensity={10} />
        <Scene />
      </Canvas>
    </div>
  )
}
