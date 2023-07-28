import {
  Environment,
  Mask,
  OrbitControls,
  ScrollControls,
  useMask,
  useScroll,
} from "@react-three/drei"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader"
import "../app/canvas.css"

function CustomShape({ path, index }: { path: any; index: number }) {
  const stencil = useMask(1, false)
  const shapeRef = useRef<any>()
  const scroll = useScroll()

  useFrame((state, delta) => {
    const offset = scroll.offset

    // move the shape in the negative x direction based on the scroll offset and the index
    shapeRef.current.position.z = -offset * 2 - index * 15
  })

  return (
    <mesh ref={shapeRef}>
      <shapeGeometry attach="geometry" args={[path.toShapes(true), 50]} />
      <meshBasicMaterial
        attach="material"
        color={path.color}
        side={THREE.DoubleSide}
        {...stencil}
      />
    </mesh>
  )
}
function Logo() {
  const mesh = useRef<any>()
  const maskRef = useRef<any>()
  const ringRef = useRef<any>()

  const shapes = useLoader(SVGLoader, "/reforest.svg")
  const scroll = useScroll()

  useFrame((state, delta) => {
    const offset = scroll.offset
    const portalScale = 1.0 + offset * 2 // Scale the portal down
    maskRef.current.scale.set(portalScale, portalScale, portalScale)
    ringRef.current.scale.set(portalScale, portalScale, portalScale)

    // move the camera to look at the side of the logo
    state.camera.position.x = offset * 30
    state.camera.lookAt(mesh.current.position)
  })

  return (
    <>
      <mesh ref={ringRef}>
        <ringGeometry args={[50, 51, 100]} />
        <meshStandardMaterial color="#B8860B" metalness={1.0} roughness={0.1} />
      </mesh>
      <Mask ref={maskRef} id={1} colorWrite depthWrite={false}>
        <circleGeometry args={[50, 100]} />
        <meshBasicMaterial color="black" />
      </Mask>
      <mesh ref={mesh}>
        <group scale={[0.1, 0.1, 0.1]} rotation={[Math.PI, 0, 0]} position={[-120, 100, -100]}>
          {shapes.paths.map((path, index) => (
            <CustomShape key={index} path={path} index={index} />
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
        <Scene />
        {/* <OrbitControls /> */}
      </Canvas>
    </div>
  )
}
