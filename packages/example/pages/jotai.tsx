import * as React from "react"
import { useTree, useTreeAtom } from "reforest"
import type { Atom } from "jotai"
import { atom, useAtomValue } from "jotai"

function TotalDuration({ treeNodeAtoms }: { treeNodeAtoms: Atom<any[]> }) {
  const treeNodes = useAtomValue(treeNodeAtoms)
  const totalDuration = treeNodes.reduce((total, node: any) => total + node.duration, 0) as number

  return <div>Total Duration: {totalDuration}</div>
}

function Parent({ children }: { children: React.ReactNode }) {
  const tree = useTree(children)
  const treeNodeAtoms = React.useMemo(
    () => atom((get) => Array.from(get(tree.treeMapAtom).values()).map((atom) => get(atom))),
    [tree.treeMapAtom]
  )
  const computedTreeNodeAtoms = React.useMemo(
    () => atom((get) => Array.from(get(tree.computedTreeMapAtom).values())),
    [tree.computedTreeMapAtom]
  )
  const computedTreeNodes = useAtomValue(computedTreeNodeAtoms)

  return (
    <div>
      {tree.isRoot ? (
        <>
          <TotalDuration treeNodeAtoms={treeNodeAtoms} />
          <div>Remaining Durations: {computedTreeNodes.join(" / ")}</div>
        </>
      ) : null}
      <div style={{ display: "flex", gap: "1rem" }}>{tree.children}</div>
    </div>
  )
}

function Child({ color, duration }: { color: string; duration: number }) {
  const value = React.useMemo(() => ({ color, duration }), [color, duration])

  const { computed } = useTreeAtom(value, (treeMap) => treeMap.size + duration)

  return (
    <div style={{ display: "grid", padding: 16, backgroundColor: color, color: "white" }}>
      <div>Duration: {duration}</div>
      <div>Computed: {computed}</div>
    </div>
  )
}

export default function App() {
  const [showChild, setShowChild] = React.useState(false)

  return (
    <>
      <button onClick={() => setShowChild((bool) => !bool)}>Toggle Child</button>
      <React.Suspense fallback={null}>
        <Parent>
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
