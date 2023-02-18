import * as React from "react"
import { create } from "zustand"

import type { TreeState, TreeStateStore } from "./contexts"
import { PreRenderContext, TreeStateContext } from "./contexts"
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
        preRenderedTreeIds: new Map(),
        shouldPreRender: true,
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
function PreRenderTree({ children }: { children: React.ReactNode }) {
  const treeState = useTreeState()
  const shouldPreRender = treeState((state) => state.shouldPreRender)

  useIsomorphicLayoutEffect(() => {
    treeState.setState({
      preRenderedTreeIds: new Map(),
      shouldPreRender: false,
    })
  }, [])

  return shouldPreRender ? (
    <PreRenderContext.Provider value={true}>{children}</PreRenderContext.Provider>
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
  const isPreRender = React.useContext(PreRenderContext)
  const isRoot = treeStateContext === null
  const indexedChildren = useIndexedChildren(children)
  const childrenToRender = isRoot ? (
    <TreeStateContext.Provider value={parsedTreeState}>
      <PreRenderTree>{indexedChildren}</PreRenderTree>
      {indexedChildren}
    </TreeStateContext.Provider>
  ) : (
    indexedChildren
  )

  return {
    children: childrenToRender,
    useStore: parsedTreeState,
    isPreRender,
    isRoot,
  }
}

/** Subscribe data to the root useTree hook. */
export function useTreeNode(getData: () => any, dependencies: React.DependencyList = []) {
  const isPreRender = React.useContext(PreRenderContext)
  const treeStateContext = React.useContext(TreeStateContext)

  if (treeStateContext === null) {
    throw new Error("useTreeNode must be used in a descendant component of useTree.")
  }

  const { deleteTreeData, preRenderedTreeIds, setTreeData, treeMap } = treeStateContext.getState()
  const { indexPathString } = useIndex()!
  const generatedId = React.useId().slice(1, -1)
  const treeId = preRenderedTreeIds.get(indexPathString) || generatedId
  const treeData = React.useMemo(
    () => Object.assign({ treeId }, getData()),
    dependencies.concat(treeId)
  )

  if (isPreRender) {
    /** Mutate tree data when pre-rendering so it's available when doing the subsequent render of root children. */
    treeMap.set(indexPathString, treeData)

    /** Store the treeId so there's a stable id between pre-render and actual render. */
    preRenderedTreeIds.set(indexPathString, treeId)
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
    isPreRender,
  }
}
