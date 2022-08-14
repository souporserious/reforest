import * as React from "react"
import { Atom, PrimitiveAtom, useAtomValue } from "jotai"
import { atom, Provider, useAtom, useSetAtom } from "jotai"

import { TreeMapContext } from "./contexts"
import { useServerComputedData } from "./server"
import { isServer, useIsomorphicLayoutEffect } from "./utils"

const TreeContext = React.createContext<{
  computedTreeMapAtom: PrimitiveAtom<Map<string, any>>
  treeMapAtom: PrimitiveAtom<Map<string, any>>
  treeNodeAtoms: Atom<any[]>
} | null>(null)

const reforestScope = Symbol()

/**
 * Manage ordered data subscriptions for components.
 *
 * @example create a tree of data subscriptions
 *
 * import { useTree, useTreeAtom } from "reforest"
 *
 * function Item({ children, value }) {
 *   const treeAtom = useTreeAtom(value)
 *   return <li>{children}</li>
 * }
 *
 * function ItemList({ children }: { children: React.ReactNode }) {
 *   const tree = useTree(children)
 *   return <ul>{tree.children}</ul>
 * }
 *
 * @example omit children to manage subscriptions from outside a component.
 *
 * import { useTree } from "reforest"
 *
 * function App() {
 *   const tree = useTree()
 *   const treeMap = useAtomValue(tree.treeMapAtom)
 *   const size = treeMap.size
 *
 *   return <List tree={tree} />
 * }
 */
export function useTree(children: React.ReactNode) {
  /** The tree map collects all leaf nodes. */
  const [treeMapAtom] = React.useState(() => atom(new Map<string, any>()))
  const treeNodeAtoms = React.useMemo(
    () => atom((get) => Array.from(get(treeMapAtom).values()).map((atom) => get(atom))),
    [treeMapAtom]
  )

  /** The computed tree map collects all leaf node data computed from the tree map above. */
  const [computedTreeMapAtom] = React.useState(() => atom(new Map<string, any>()))

  /** Only use one "root" context value. In the future, this can support nested computing if needed. */
  const parentContextValue = React.useContext(TreeContext)
  const contextValue = React.useMemo(
    () => ({
      computedTreeMapAtom,
      treeMapAtom,
      treeNodeAtoms,
    }),
    [computedTreeMapAtom, treeMapAtom, treeNodeAtoms]
  )
  const parsedContextValue = parentContextValue || contextValue
  const isRoot = parentContextValue === null
  const childrenToRender = isRoot ? (
    <TreeContext.Provider value={parsedContextValue}>{children}</TreeContext.Provider>
  ) : (
    children
  )

  return {
    isRoot,
    children: childrenToRender,
    computedTreeMapAtom: parsedContextValue.computedTreeMapAtom,
    treeMapAtom: parsedContextValue.treeMapAtom,
    treeNodeAtoms: parsedContextValue.treeNodeAtoms,
  }
}

/** Subscribe data to the root useTree hook. */
export function useTreeData<TreeValue extends any, ComputedTreeValue extends any>(
  data: TreeValue,
  computeData?: (
    treeMap: Map<string, TreeValue>,
    treeValue: TreeValue,
    treeId: string
  ) => ComputedTreeValue
) {
  const treeAtom = React.useMemo(() => atom(data), [data])
  const treeId = treeAtom.toString()
  const treeContext = React.useContext(TreeContext)
  const treeMapContext = React.useContext(TreeMapContext)

  if (treeContext === null) {
    throw new Error("useTreeData must be used in a descendant component of useTree.")
  }

  const setTreeMap = useSetAtom(treeContext.treeMapAtom)
  const setComputedTreeMap = useSetAtom(treeContext.computedTreeMapAtom)

  /** Subscribe tree data to root map on the server and client. */
  if (isServer) {
    treeMapContext?.set(treeAtom.toString(), data)
  }

  useIsomorphicLayoutEffect(() => {
    setTreeMap((currentMap) => {
      const nextMap = new Map(currentMap)
      nextMap.set(treeId, treeAtom)
      return nextMap
    })

    return () => {
      setTreeMap((currentMap) => {
        const nextMap = new Map(currentMap)
        nextMap.delete(treeId)
        return nextMap
      })
    }
  }, [treeAtom])

  const treeMap = useAtomValue(treeContext.treeMapAtom)
  const clientComputedData = React.useMemo(() => {
    /**
     * Tree map size is used to determine if this is initial hydration to make sure
     * the server value is use first which might be brittle.
     */
    return computeData && treeMap.size > 0 ? computeData(treeMap, data, treeAtom.toString()) : null
  }, [treeMap, data])

  /** Compute data from all collected tree data in parent map. */
  const serverComputedData = useServerComputedData(data, treeId, computeData)

  useIsomorphicLayoutEffect(() => {
    setComputedTreeMap((currentMap) => {
      const nextMap = new Map(currentMap)
      nextMap.set(treeId, clientComputedData)
      return nextMap
    })

    return () => {
      setComputedTreeMap((currentMap) => {
        const nextMap = new Map(currentMap)
        nextMap.delete(treeId)
        return nextMap
      })
    }
  }, [clientComputedData, treeId])

  return {
    computed: clientComputedData || serverComputedData,
  }
}
