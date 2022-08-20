import * as React from "react"
import { useSnapshot } from "valtio"

import { TreeStateContext, TreeMapContext, createInitialTreeState } from "./contexts"
import { useServerComputedData } from "./server"
import { useIndex, useIndexedChildren } from "./use-indexed-children"
import { isServer, sortMapByIndexPath, useIsomorphicLayoutEffect } from "./utils"

/** Callback when the tree map is. */
export function useTreeEffect(
  treeState: TreeState | null,
  callback: (treeMap: Map<string, any>) => void | (() => void),
  dependencies: React.DependencyList = []
) {
  const contextTreeState = React.useContext(TreeStateContext)
  const parsedTreeState = treeState || contextTreeState

  if (parsedTreeState === null) {
    throw new Error("treeState must be defined")
  }

  const snapshot = useSnapshot(parsedTreeState)

  useIsomorphicLayoutEffect(() => {
    const treeMap = sortMapByIndexPath(snapshot.treeMap)

    return callback(treeMap)
  }, dependencies.concat(snapshot))
}

/** Get the current tree map with optional computed data. */
export function useTreeSnapshot<ComputedData extends any>(
  treeState: TreeState | null,
  computeData?: (treeMap: Map<string, any>) => ComputedData,
  dependencies: React.DependencyList = []
) {
  const contextTreeState = React.useContext(TreeStateContext)
  const parsedTreeState = treeState || contextTreeState

  if (parsedTreeState === null) {
    throw new Error("treeState must be defined")
  }

  const snapshot = useSnapshot(parsedTreeState)

  return React.useMemo(() => {
    const treeMap = sortMapByIndexPath(snapshot.treeMap)

    return computeData ? computeData(treeMap) : treeMap
  }, dependencies.concat(snapshot)) as ComputedData
}

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
  const [treeState] = React.useState(() => createInitialTreeState())

  return treeState
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
 */
export function useTree(children: React.ReactNode, parentTreeState?: TreeState) {
  const defaultTreeState = useTreeState()
  const [treeMap] = React.useState(() => new Map<string, Record<string, any>>())
  const treeStateContextValue = React.useContext(TreeStateContext)
  const parsedContextValue = treeStateContextValue || parentTreeState || defaultTreeState
  const isRoot = treeStateContextValue === null
  const indexedChildren = useIndexedChildren(children)
  const childrenToRender = isRoot ? (
    <TreeMapContext.Provider value={treeMap}>
      <TreeStateContext.Provider value={parsedContextValue}>
        {indexedChildren}
      </TreeStateContext.Provider>
    </TreeMapContext.Provider>
  ) : (
    indexedChildren
  )

  return {
    children: childrenToRender,
    state: parsedContextValue,
    isRoot,
  }
}

/** Subscribe data to the root useTree hook. */
export function useTreeData<TreeValue extends any, ComputedTreeValue extends any>(
  data: TreeValue,
  computeData?: (treeMap: Map<string, TreeValue>, treeId: string) => ComputedTreeValue,
  dependencies: React.DependencyList = []
) {
  const treeState = React.useContext(TreeStateContext)
  const treeMapContext = React.useContext(TreeMapContext)
  const treeId = React.useId().slice(1, -1)

  if (treeState === null) {
    throw new Error("useTreeData must be used in a descendant component of useTree.")
  }

  const index = useIndex()!
  const indexPathString = index.indexPathString

  /**
   * Subscribe tree data to root map on the server and client.
   * Note, treeMapContext is for the server and treeMapAtom is for the client.
   */
  if (isServer) {
    treeMapContext.set(treeId, Object.assign({ indexPathString, treeId }, data))
  }

  useIsomorphicLayoutEffect(() => {
    return treeState.subscribeTreeData(treeId, Object.assign({ indexPathString, treeId }, data))
  }, [treeState, treeId, data])

  /** Compute data from all collected tree data in parent map. */
  const serverComputedData = useServerComputedData(treeId, computeData)
  const clientComputedData = useTreeSnapshot(
    null,
    (treeMap) =>
      computeData && treeMap.size > 0 ? computeData(sortMapByIndexPath(treeMap), treeId) : null,
    dependencies
  )
  const computedData = (clientComputedData || serverComputedData) as ComputedTreeValue

  return {
    computed: computedData,
    index,
    treeId,
  }
}
