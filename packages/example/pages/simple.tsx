import * as React from "react"
import type { TreeState } from "reforest"
import { useTree, useTreeData, useTreeState } from "reforest"
import { atom, useAtomValue } from "jotai"

function TotalDuration({ treeState }: { treeState: TreeState }) {
  const treeNodeAtoms = React.useMemo(
    () =>
      atom((get) => Array.from(get(treeState.atoms.treeMapAtom).values()).map((atom) => get(atom))),
    [treeState.atoms.treeMapAtom]
  )
  const treeNodes = useAtomValue(treeNodeAtoms)
  const totalDuration = treeNodes.reduce((total, node: any) => total + node.duration, 0) as number

  return <div>Total Duration: {totalDuration}</div>
}

function Parent({ children, treeState }: { children: React.ReactNode; treeState?: TreeState }) {
  const tree = useTree(children, treeState)

  return <div style={{ display: "flex", gap: "1rem" }}>{tree.children}</div>
}

function Child({ color, duration }: { color: string; duration: number }) {
  const value = React.useMemo(() => ({ color, duration }), [color, duration])
  const { computed } = useTreeData(value, (treeMap) => treeMap.size + duration)

  return (
    <div style={{ display: "grid", padding: 16, backgroundColor: color, color: "white" }}>
      <div>Duration: {duration}</div>
      <div>Computed: {computed}</div>
    </div>
  )
}

export default function App() {
  const [showChild, setShowChild] = React.useState(false)
  const treeState = useTreeState()

  return (
    <>
      <button onClick={() => setShowChild((bool) => !bool)}>Toggle Child</button>
      <TotalDuration treeState={treeState} />
      <React.Suspense fallback={null}>
        <Parent treeState={treeState}>
          <Child duration={3} color="green" />
          <Child duration={1.5} color="blue" />
          <Parent>
            <Child duration={3} color="yellow" />
            <Child duration={1.5} color="purple" />
          </Parent>
          {showChild ? <Child duration={4} color="pink" /> : null}
          <Child duration={2} color="orange" />
        </Parent>
      </React.Suspense>
    </>
  )
}
