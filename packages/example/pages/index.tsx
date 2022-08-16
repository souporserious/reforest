import * as React from "react"
import { flat } from "tree-visit"
import { useTree, useTreeData } from "reforest"
import { scroll, timeline } from "motion"

const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

const TimelineContext = React.createContext<{ scroll?: boolean } | null>(null)

function Timeline({
  children: childrenProp,
  scroll: scrollProp,
}: {
  children: React.ReactNode
  scroll?: boolean
}) {
  const tree = useTree(childrenProp)

  useIsomorphicLayoutEffect(() => {
    const ids = new Set()
    let totalDuration = 0

    if (tree.treeChildren === null) {
      return
    }

    const sceneKeyframes = tree.treeChildren
      .flatMap((scene) => {
        const sequences = flat(scene, {
          getChildren: (node) => node?.children || [],
        })
          .sort((a, b) => parseFloat(a.indexPathString) - parseFloat(b.indexPathString))
          .slice(1)

        const keyframes = sequences.map((keyframe) => {
          const { id, treeId, delay = 0, width, height, scale, backgroundColor, opacity } = keyframe
          const styles = {
            width,
            height,
            scale,
            opacity,
            backgroundColor,
            transform: "translate(0px, 0px)",
          }
          const options = { duration: scene.duration, at: totalDuration, delay }
          const hasId = ids.has(id)
          const parsedId = id || treeId

          if (hasId) {
            const bounds = document.getElementById(id)?.getBoundingClientRect()
            const xOffset = window.scrollX + (bounds?.x || 0)
            const yOffset = window.scrollY + (bounds?.y || 0)

            styles.transform = `translate(${xOffset}px, ${yOffset}px)`
          } else {
            ids.add(id)
          }

          return [`#${parsedId}`, styles, options]
        })

        totalDuration += scene.duration

        return keyframes
      })
      .filter(Boolean)

    if (sceneKeyframes) {
      const controls = timeline(sceneKeyframes as any)

      if (scrollProp && controls.pause) {
        return scroll(controls)
      }
    }
  }, [scrollProp, tree.treeChildren])

  const styles = {
    display: "grid",
    width: "100%",
    minHeight: "100vh",
  }

  return (
    <main style={styles}>
      <TimelineContext.Provider value={{ scroll: scrollProp }}>
        {tree.children}
      </TimelineContext.Provider>
    </main>
  )
}

function Scene({
  children: childrenProp,
  duration = 1,
}: {
  children: React.ReactNode
  duration?: number
}) {
  const timelineContextValue = React.useContext(TimelineContext)
  const tree = useTree(childrenProp)
  const node = React.useMemo(() => ({ type: "scene", duration }), [duration])

  useTreeData(node)

  if (timelineContextValue?.scroll) {
    return (
      <section style={{ display: "grid", height: `${100 * (duration + 1)}vh` }}>
        <div
          style={{
            display: "grid",
            placeItems: "center",
            height: `100vh`,
            position: "sticky",
            top: 0,
          }}
        >
          {tree.children}
        </div>
      </section>
    )
  }

  return (
    <section
      style={{
        gridArea: "1 / 1",
        display: "grid",
        placeItems: "center",
        height: "100vh",
      }}
    >
      {tree.children}
    </section>
  )
}

function Box({
  id,
  width,
  height,
  backgroundColor,
  opacity = [1, 1],
  scale,
  delay,
}: {
  id?: string
  width?: string
  height?: string
  backgroundColor?: string
  opacity?: [number, number]
  scale?: [number, number]
  delay?: number
}) {
  const node = React.useMemo(
    () => ({
      type: "box",
      id,
      width,
      height,
      backgroundColor,
      opacity,
      scale,
      delay,
    }),
    []
  )

  const treeData = useTreeData(node, (treeMap, treeId) => {
    const ids = new Set()
    let shouldRender = false

    treeMap.forEach(({ id }, treeIdToCompare) => {
      const isSameId = treeId === treeIdToCompare
      const hasId = ids.has(id)
      if (isSameId) {
        shouldRender = !hasId
      }
      if (!hasId) {
        ids.add(id)
      }
    })

    return { shouldRender }
  })

  if (!treeData.computed.shouldRender) {
    return null
  }

  return (
    <div
      id={id}
      style={{
        width,
        height,
        backgroundColor,
        opacity: opacity ? opacity[0] : undefined,
      }}
    />
  )
}

export default function App() {
  const [scroll, setScroll] = React.useState(true)

  return (
    <>
      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 1000 }}>
        <label>
          Scroll:
          <input type="checkbox" checked={scroll} onChange={() => setScroll(!scroll)} />
        </label>
      </div>
      <Timeline scroll={scroll}>
        <Scene duration={2}>
          <Box id="box-1" width="80vw" height="60vh" backgroundColor="blue" />
        </Scene>
        <Scene duration={3}>
          <Box id="box-1" width="70vw" height="50vh" backgroundColor="darkblue" />
          {scroll ? (
            <Box id="box-2" width="60vw" height="40vh" backgroundColor="blue" opacity={[0, 1]} />
          ) : null}
        </Scene>
        <Scene duration={1.5}>
          <Box id="box-1" width="60vw" height="80vh" backgroundColor="orange" />
          <Box id="box-2" width="20vw" height="90vh" backgroundColor="pink" />
        </Scene>
      </Timeline>
    </>
  )
}
