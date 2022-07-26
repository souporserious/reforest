import * as React from "react"
import { flat } from "tree-visit"
import { useIndexedChildren, useIndex } from "use-indexed-children"

const TimelineContext = React.createContext<{ scroll?: boolean } | null>(null)

function Timeline({
  children,
  scroll: scrollProp,
}: {
  children: React.ReactNode
  scroll?: boolean
}) {
  const handleTreeUpdate = React.useCallback(({ children: scenes }) => {
    let totalDuration = 0

    const sceneKeyframes = scenes.flatMap((scene) => {
      const sequences = flat(scene.children, {
        getChildren: (node) => node?.children || [],
      })
      const keyframes = sequences.flatMap((keyframes) => {
        return keyframes.map((keyframe) => {
          const { id, delay, width, height, scale, backgroundColor, opacity } = keyframe

          return [
            `#${id}`,
            { width, height, scale, opacity, backgroundColor },
            { delay, at: totalDuration },
          ]
        })
      })

      totalDuration += scene.duration

      return keyframes
    })

    console.log(sceneKeyframes)
  }, [])

  const indexedChildren = useIndexedChildren(children, null, handleTreeUpdate as any)
  const styles = {
    display: "grid",
    width: "100%",
    minHeight: "100vh",
  }

  return (
    <main style={styles}>
      <TimelineContext.Provider value={{ scroll: scrollProp }}>
        {indexedChildren}
      </TimelineContext.Provider>
    </main>
  )
}

function Scene({ children, duration = 1 }: { children: React.ReactNode; duration?: number }) {
  const timelineContextValue = React.useContext(TimelineContext)
  const id = React.useId().slice(1, -1)
  const node = React.useMemo(() => ({ id, duration }), [id, duration])

  useIndex(node)

  const indexedChildren = useIndexedChildren(children)

  if (timelineContextValue?.scroll) {
    return (
      <section id={id} style={{ display: "grid", height: `${100 * (duration + 1)}vh` }}>
        <div
          style={{
            display: "grid",
            placeItems: "center",
            height: `100vh`,
            position: "sticky",
            top: 0,
          }}
        >
          {indexedChildren}
        </div>
      </section>
    )
  }

  return (
    <section
      id={id}
      style={{
        gridArea: "1 / 1",
        display: "grid",
        placeItems: "center",
        height: "100vh",
      }}
    >
      {indexedChildren}
    </section>
  )
}

function Box({
  id: idProp,
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
  const generatedId = React.useId().slice(1, -1)
  const id = idProp || generatedId
  const node = React.useMemo(
    () => ({
      id,
      width,
      height,
      backgroundColor,
      opacity,
      scale,
      delay,
    }),
    [id, width, height, backgroundColor, opacity, scale, delay]
  )

  const index = useIndex(node, (indexedData, localIndexPathString) => {
    const ids = new Set()
    let shouldRender = false

    indexedData?.forEach(([indexPathString, { id }]) => {
      const isSameIndex = indexPathString === localIndexPathString
      const hasId = ids.has(id)

      if (isSameIndex) {
        shouldRender = !hasId
      }

      if (!hasId) {
        ids.add(id)
      }
    })

    return shouldRender
  })
  const shouldRender = index!.computedData

  if (!shouldRender) {
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
          <Box id="box-1" width="80vw" height="60vh" backgroundColor="green" />
        </Scene>
        <Scene duration={3}>
          <Box id="box-1" width="70vw" height="50vh" backgroundColor="darkblue" />
          <Box id="box-2" width="60vw" height="40vh" backgroundColor="blue" opacity={[0, 1]} />
        </Scene>
        <Scene duration={1.5}>
          <Box id="box-1" width="60vw" height="80vh" backgroundColor="orange" />
          <Box id="box-2" width="20vw" height="90vh" backgroundColor="pink" />
        </Scene>
      </Timeline>
    </>
  )
}
