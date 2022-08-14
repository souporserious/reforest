import * as React from "react"
import { atom, useAtomValue, useSetAtom } from "jotai"

import { TreeAtomsContext, TreeMapContext } from "./contexts"
import { useServerComputedData } from "./server"
import { useIndex, useIndexedChildren } from "./use-indexed-children"
import { isServer, sortMapByIndexPath, useIsomorphicLayoutEffect } from "./utils"

/**
 * Manage ordered data subscriptions for components.
 *
 * @example create a tree of data subscriptions
 *
 * import { useTree, useTreeData } from "reforest"
 *
 * function Item({ children, value }) {
 *   useTreeData(value)
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
 * import { useAtomValue } from "jotai"
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
  const parentContextValue = React.useContext(TreeAtomsContext)
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
  const indexedChildren = useIndexedChildren(children)
  const childrenToRender = isRoot ? (
    <TreeAtomsContext.Provider value={parsedContextValue}>
      {indexedChildren}
    </TreeAtomsContext.Provider>
  ) : (
    indexedChildren
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
  const treeAtomsContext = React.useContext(TreeAtomsContext)
  const treeMapContext = React.useContext(TreeMapContext)

  if (treeAtomsContext === null) {
    throw new Error("useTreeData must be used in a descendant component of useTree.")
  }

  const index = useIndex()!
  const indexPathString = index.indexPathString
  const treeAtom = React.useMemo(
    () => atom(Object.assign({ indexPathString }, data)),
    [data, indexPathString]
  )
  const treeId = treeAtom.toString()

  const setTreeMapAtom = useSetAtom(treeAtomsContext.treeMapAtom)
  const setComputedTreeMapAtom = useSetAtom(treeAtomsContext.computedTreeMapAtom)

  /** Subscribe tree data to root map on the server and client. */
  if (isServer) {
    treeMapContext?.set(treeAtom.toString(), Object.assign({ indexPathString, treeId }, data))
  }

  useIsomorphicLayoutEffect(() => {
    treeMapContext.set(treeId, Object.assign({ indexPathString, treeId }, data))

    setTreeMapAtom((currentMap) => {
      const nextMap = new Map(currentMap)
      nextMap.set(treeId, treeAtom)
      return nextMap
    })

    return () => {
      treeMapContext.delete(treeId)

      setTreeMapAtom((currentMap) => {
        const nextMap = new Map(currentMap)
        nextMap.delete(treeId)
        return nextMap
      })
    }
  }, [treeAtom])

  const treeMap = useAtomValue(treeAtomsContext.treeMapAtom)
  const clientComputedData = React.useMemo(() => {
    const sortedTreeMap = sortMapByIndexPath(treeMapContext)

    /**
     * Tree map size is used to determine if this is initial hydration to make sure
     * the server value is use first which might be brittle.
     */
    return computeData && treeMap.size > 0
      ? computeData(sortedTreeMap, data, treeAtom.toString())
      : null
  }, [treeMap, data])

  /** Compute data from all collected tree data in parent map. */
  const serverComputedData = useServerComputedData(data, treeId, computeData)

  useIsomorphicLayoutEffect(() => {
    setComputedTreeMapAtom((currentMap) => {
      const nextMap = new Map(currentMap)
      nextMap.set(treeId, clientComputedData)
      return nextMap
    })

    return () => {
      setComputedTreeMapAtom((currentMap) => {
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
