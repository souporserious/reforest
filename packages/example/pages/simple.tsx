import * as React from "react"
import type { TreeStateStore } from "reforest"
import { useTree, useTreeData, useTreeState } from "reforest"

function TotalDuration({ useTreeStore }: { useTreeStore: TreeStateStore }) {
  const treeMap = useTreeStore((state) => state.treeMap)
  const totalDuration = Array.from(treeMap.values()).reduce(
    (total, node: any) => total + node.duration,
    0
  )

  return <div>Total Duration: {totalDuration}</div>
}

function Parent({ children }: { children: React.ReactNode }) {
  const tree = useTree(children)

  if (tree.isPreRender) {
    return tree.children
  }

  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      {tree.children}
      {tree.isRoot ? <TotalDuration useTreeStore={tree.useStore} /> : null}
    </div>
  )
}

function Child({
  children,
  color,
  duration,
}: {
  children?: React.ReactNode
  color: string
  duration: number
}) {
  const useTreeStore = useTreeState()
  const treeMap = useTreeStore((state) => state.treeMap)
  const computed = treeMap.size + duration

  const { isPreRender } = useTreeData(React.useMemo(() => ({ color, duration }), [color, duration]))

  if (isPreRender) {
    return null
  }

  return (
    <div style={{ display: "grid", padding: 16, backgroundColor: color, color: "white" }}>
      <div>Duration: {duration}</div>
      <div>Computed: {computed}</div>
      {children}
    </div>
  )
}

function SubParent() {
  const [showChild, setShowChild] = React.useState(false)

  return (
    <Parent>
      <Child duration={3} color="yellow">
        <button onClick={() => setShowChild((bool) => !bool)}>Toggle Child</button>
      </Child>
      <Child duration={1.5} color="purple" />
      {showChild ? <Child duration={1} color="teal" /> : null}
    </Parent>
  )
}

export default function App() {
  const [showChild, setShowChild] = React.useState(false)

  return (
    <>
      <button onClick={() => setShowChild((bool) => !bool)}>Toggle Child</button>
      <Parent>
        <Child duration={3} color="green" />
        <Child duration={1.5} color="blue" />
        <SubParent />
        {showChild ? <Child duration={4} color="pink" /> : null}
        <Child duration={2} color="orange" />
      </Parent>
    </>
  )
}
