import * as React from "react"
import { proxy, useSnapshot } from "valtio"
import { proxyMap, proxyWithComputed } from "valtio/utils"
import memoize from "proxy-memoize"

import { TreeStateContext } from "./contexts"
import { useIndex, useIndexedChildren } from "./use-indexed-children"
import { mapToTree, sortMapByIndexPath, useIsomorphicLayoutEffect } from "./utils"

export function useTree<ComputedData extends any>(
  children: React.ReactNode,
  computeData?: (snapshot: any) => ComputedData
) {
  const treeStateContext = React.useContext(TreeStateContext)
  const treeStateRef = React.useRef<any>(null)
  const computeDataRef = React.useRef<typeof computeData>(computeData)

  useIsomorphicLayoutEffect(() => {
    computeDataRef.current = computeData
  })

  if (treeStateContext === null && treeStateRef.current === null) {
    const state = proxyWithComputed<
      {
        treeMap: Map<string, any>
        subscribeTreeData: (key: string, value: any) => () => void
      },
      { computed: ComputedData | null }
    >(
      {
        treeMap: proxyMap<string, any>(),
        subscribeTreeData: (key: string, value: any) => {
          state.treeMap.set(key, value)
          return () => {
            state.treeMap.delete(key)
          }
        },
      },
      {
        computed: memoize((snapshot: any) => {
          return computeDataRef.current ? computeDataRef.current(snapshot.treeMap) : null
        }),
      }
    )

    treeStateRef.current = state
  } else {
    treeStateRef.current = treeStateContext
  }

  const childrenToRender = (
    <TreeStateContext.Provider value={treeStateRef.current}>
      {useIndexedChildren(children)}
    </TreeStateContext.Provider>
  )

  return {
    children: childrenToRender,
    state: treeStateRef.current,
  }
}

export function useTreeData(data: any) {
  const treeState = React.useContext(TreeStateContext)
  const treeId = React.useId()
  const index = useIndex()

  useIsomorphicLayoutEffect(() => {
    if (treeState === null) {
      return
    }

    return treeState.subscribeTreeData(
      treeId,
      Object.assign({ treeId, indexPathString: index?.indexPathString }, data)
    )
  }, [treeState, treeId, index, data])

  return treeId
}

const noopProxy = proxy({})

export function useTreeSnapshot(treeState: ReturnType<typeof useTree>["state"] | null) {
  const snapshot = useSnapshot(treeState || noopProxy)

  return React.useMemo(
    () => ({
      map: snapshot.treeMap ? sortMapByIndexPath(snapshot.treeMap) : new Map(),
      tree: snapshot.treeMap ? mapToTree(snapshot.treeMap) : [],
    }),
    [snapshot]
  )
}
