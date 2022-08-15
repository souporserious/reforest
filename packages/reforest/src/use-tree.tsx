import * as React from "react"
import { atom, useAtomValue, useSetAtom } from "jotai"

import { TreeAtomsContext, TreeMapContext } from "./contexts"
import { useServerComputedData } from "./server"
import { useIndex, useIndexedChildren } from "./use-indexed-children"
import { isServer, mapToChildren, sortMapByIndexPath, useIsomorphicLayoutEffect } from "./utils"

/**
 * Control tree state from outside a component.
 *
 * @example
 * import type { TreeState } from "reforest"
 * import { useTree, useTreeData, useTreeState } from "reforest"
 *
 * function Item({ children, value }) {
 *   useTreeData(value)
 *   return <li>{children}</li>
 * }
 *
 * function ItemList({ children }: { children: React.ReactNode, treeState: TreeState }) {
 *   const tree = useTree(children, treeState)
 *   return <ul>{tree.children}</ul>
 * }
 *
 * function App() {
 *   const treeState = useTreeState()
 *   return (
 *     <ItemList treeState={treeState}>
 *       <Item value="apple">Apple</Item>
 *       <Item value="banana">Banana</Item>
 *       <Item value="cherry">Cherry</Item>
 *     </ItemList>
 *   )
 * }
 */
export function useTreeState() {
  /** Tree map collects all leaf nodes. */
  const [treeMapAtom] = React.useState(() => atom(new Map<string, Record<string, any>>()))

  /** Computed tree map collects all leaf node data computed from the tree map above. */
  const [computedTreeMapAtom] = React.useState(() => atom(new Map<string, any>()))

  const treeMapEntriesAtom = React.useMemo(
    () =>
      atom((get) => {
        const computedMap = get(computedTreeMapAtom)

        return Array.from(get(treeMapAtom).entries()).map(([id, atom]) => [
          id,
          Object.assign({ computed: computedMap.get(id) }, get(atom as any)),
        ])
      }),
    [treeMapAtom, computedTreeMapAtom]
  )

  const atoms = React.useMemo(
    () => ({
      computedTreeMapAtom,
      treeMapAtom,
      treeMapEntriesAtom,
    }),
    [computedTreeMapAtom, treeMapAtom, treeMapEntriesAtom]
  )

  const treeMapEntries = useAtomValue(treeMapEntriesAtom)
  const treeMap = new Map(treeMapEntries as any) as Map<string, Record<string, any>>
  const treeChildren = mapToChildren(treeMap as any) as Array<any>

  return { atoms, treeMap, treeChildren }
}

export type TreeState = ReturnType<typeof useTreeState>

/**
 * Manage ordered data subscriptions for components.
 *
 * @example create a tree of data subscriptions
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
export function useTree(children: React.ReactNode, parentTreeState?: TreeState) {
  const defaultTreeState = useTreeState()
  const treeState = parentTreeState || defaultTreeState
  const parentContextValue = React.useContext(TreeAtomsContext)
  const parsedContextValue = parentContextValue || treeState.atoms
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
    children: childrenToRender,
    treeMap: treeState.treeMap,
    treeChildren: treeState.treeChildren,
    isRoot,
  }
}

/** Subscribe data to the root useTree hook. */
export function useTreeData<TreeValue extends any, ComputedTreeValue extends any>(
  data: TreeValue,
  computeData?: (treeMap: Map<string, TreeValue>, treeId: string) => ComputedTreeValue,
  dependencies: React.DependencyList = []
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
     * the server value is used first.
     */
    return computeData && treeMap.size > 0 ? computeData(sortedTreeMap, treeAtom.toString()) : null
  }, dependencies.concat([treeMap, data]))

  /** Compute data from all collected tree data in parent map. */
  const serverComputedData = useServerComputedData(treeId, computeData)

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

  const computedData = (clientComputedData || serverComputedData) as ComputedTreeValue

  return {
    computed: computedData,
    index,
    treeId,
  }
}
