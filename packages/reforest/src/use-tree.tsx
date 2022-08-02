import * as React from "react"
import create from "zustand"

import { useIndex } from "./use-indexed-children"
import { isServer, mapToTree, useIsomorphicLayoutEffect } from "./utils"

let globalTimeoutId: ReturnType<typeof setTimeout>

/** Global store that manages all tree state. */
export const useTreeStore = create<{
  needsUpdate: boolean
  treeMap: Map<string, any>
  subscribeTreeData: (key: string, value: any) => () => void
  clearTreeData: () => void
}>((set, get) => ({
  needsUpdate: false,
  treeMap: new Map(),
  subscribeTreeData: (id, data) => {
    const { treeMap, needsUpdate } = get()

    treeMap.set(id, data)

    /** Keep clearing timeout until the last hook renders. */
    clearTimeout(globalTimeoutId)

    if (needsUpdate === false) {
      set({ needsUpdate: true })
    }

    globalTimeoutId = setTimeout(() => {
      set({ needsUpdate: false })
    })

    return () => {
      treeMap.delete(id)
    }
  },
  clearTreeData: () => {
    set({ treeMap: new Map() })
  },
}))

/**
 * Subscribes data to the global tree context and returns a unique id that can
 * be used for fetching computed data in useComputedData.
 */
export function useTreeData(data: any) {
  const treeId = React.useId()
  const index = useIndex()
  const indexPathString = index ? index.indexPathString : null

  /** Capture the initial data when rendering on the server. */
  if (isServer) {
    useTreeStore
      .getState()
      .subscribeTreeData(treeId, Object.assign({ treeId, indexPathString }, data))
  }

  useIsomorphicLayoutEffect(() => {
    return useTreeStore
      .getState()
      .subscribeTreeData(treeId, Object.assign({ treeId, indexPathString }, data))
  }, [treeId, indexPathString, data])

  return treeId
}

/** Subscribe to tree updates. */
export function useTreeEffect(
  /** Updates when any tree data is changed. */
  onUpdate: (tree: ReturnType<typeof mapToTree>) => void | (() => void),

  /** Dependencies for the effect. */
  dependencies: any[] = []
) {
  const onUpdateRef = React.useRef<typeof onUpdate>(onUpdate)
  const cleanupRef = React.useRef<ReturnType<typeof onUpdate> | null>(null)
  const previousStringifiedTree = React.useRef("")

  useIsomorphicLayoutEffect(() => {
    onUpdateRef.current = onUpdate
  })

  useIsomorphicLayoutEffect(() => {
    function handleTreeUpdate(state: any) {
      let treeData = {}

      state.treeMap.forEach((data, key) => {
        treeData[key] = data
      })

      const nextStringifiedTree = JSON.stringify(treeData)

      if (previousStringifiedTree.current !== nextStringifiedTree) {
        const tree = mapToTree(state.treeMap)

        if (tree) {
          cleanupRef.current = onUpdateRef.current(tree)
        }

        previousStringifiedTree.current = nextStringifiedTree
      }
    }

    /** Build initial tree once children have rendered. */
    handleTreeUpdate(useTreeStore.getState())

    /** Subscribe to future updates to tree. */
    const cleanupSubscription = useTreeStore.subscribe(handleTreeUpdate)

    return () => {
      cleanupSubscription()
      cleanupRef.current?.()
      previousStringifiedTree.current = ""
    }
  }, dependencies)
}
