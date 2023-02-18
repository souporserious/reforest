import * as React from "react"
import { create } from "zustand"

import type { TreeState, TreeStateStore } from "./contexts"
import { PrerenderContext, TreeStateContext } from "./contexts"
import { useIndex, useIndexedChildren } from "./use-indexed-children"
import { sortMapByIndexPath, useIsomorphicLayoutEffect } from "./utils"

/**
 * Control tree state from outside a component.
 *
 * @example
 * import type { TreeMap } from "reforest"
 * import { useTree, useTreeNode, useTreeMap } from "reforest"
 *
 * function Item({ children, value }) {
 *   useTreeNode(value)
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
export function useTreeState(): TreeStateStore
export function useTreeState<U>(selector: (state: TreeState) => U): U
export function useTreeState(selector?: (state: TreeState) => unknown) {
  const treeStateContext = React.useContext(TreeStateContext)
  const [treeState] = React.useState(
    () =>
      treeStateContext ||
      create<TreeState>((set, get) => ({
        treeMap: new Map(),
        prerenderedTreeIds: new Map(),
        shouldPrerender: true,
        setTreeData: (id, data) => {
          const { treeMap } = get()

          treeMap.set(id, data)

          set({ treeMap: sortMapByIndexPath(treeMap) })
        },
        deleteTreeData: (id) => {
          const { treeMap } = get()

          treeMap.delete(id)

          set({ treeMap: sortMapByIndexPath(treeMap) })
        },
      }))
  )

  return selector ? treeState(selector) : treeState
}

/** Pre-renders children to capture data in useTreeNode hooks for initial component renders. */
function PrerenderTree({ children }: { children: React.ReactNode }) {
  const treeState = useTreeState()
  const shouldPrerender = treeState((state) => state.shouldPrerender)

  useIsomorphicLayoutEffect(() => {
    treeState.setState({
      prerenderedTreeIds: new Map(),
      shouldPrerender: false,
    })
  }, [])

  return shouldPrerender ? (
    <PrerenderContext.Provider value={true}>{children}</PrerenderContext.Provider>
  ) : null
}

/**
 * Manage ordered data subscriptions for components.
 *
 * @example create a tree of data subscriptions
 * import { useTree, useTreeNode } from "reforest"
 *
 * function Item({ children, value }) {
 *   useTreeNode(value)
 *   return <li>{children}</li>
 * }
 *
 * function ItemList({ children }: { children: React.ReactNode }) {
 *   const tree = useTree(children)
 *   return <ul>{tree.children}</ul>
 * }
 */
export function useTree(children: React.ReactNode, treeState?: TreeStateStore) {
  const treeStateContext = React.useContext(TreeStateContext)
  const treeStateLocal = useTreeState()
  const parsedTreeState = treeStateContext || treeState || treeStateLocal
  const isPrerender = React.useContext(PrerenderContext)
  const isRoot = treeStateContext === null
  const indexedChildren = useIndexedChildren(children)
  const childrenToRender = isRoot ? (
    <TreeStateContext.Provider value={parsedTreeState}>
      <PrerenderTree>{indexedChildren}</PrerenderTree>
      {indexedChildren}
    </TreeStateContext.Provider>
  ) : (
    indexedChildren
  )

  return {
    children: childrenToRender,
    useStore: parsedTreeState,
    isPrerender,
    isRoot,
  }
}

/** Subscribe data to the root useTree hook. */
export function useTreeNode(getData: () => any, dependencies: React.DependencyList = []) {
  const isPrerender = React.useContext(PrerenderContext)
  const treeStateContext = React.useContext(TreeStateContext)

  if (treeStateContext === null) {
    throw new Error("useTreeNode must be used in a descendant component of useTree.")
  }

  const { deleteTreeData, prerenderedTreeIds, setTreeData, treeMap } = treeStateContext.getState()
  const { indexPathString } = useIndex()!
  const generatedId = React.useId().slice(1, -1)
  const treeId = prerenderedTreeIds.get(indexPathString) || generatedId
  const treeData = React.useMemo(
    () => Object.assign({ treeId }, getData()),
    dependencies.concat(treeId)
  )

  if (isPrerender) {
    /** Mutate tree data when pre-rendering so it's available when doing the subsequent render of root children. */
    treeMap.set(indexPathString, treeData)

    /** Store the treeId so there's a stable id between pre-render and actual render. */
    prerenderedTreeIds.set(indexPathString, treeId)
  } else {
    /** After the initial pre-render we switch to a simple effect for coordinating data updates. */
    React.useEffect(() => {
      setTreeData(indexPathString, treeData)

      return () => {
        deleteTreeData(indexPathString)
      }
    }, [indexPathString, treeData])
  }

  return {
    id: treeId,
    data: treeData,
    indexPathString,
    isPrerender,
  }
}
