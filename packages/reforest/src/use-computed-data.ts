import * as React from "react"
import { suspend } from "suspend-react"
import shallow from "zustand/shallow"

import { ComputedDataContext } from "./contexts"
import { useTreeStore } from "./use-tree"
import { isServer, sortMapByIndexPath, useIsomorphicLayoutEffect } from "./utils"

/** Track initial component renders. */
let globalResolves: any[] = []
let globalTimeoutId: ReturnType<typeof setTimeout>

/** Compute data based on all collected tree data. */
export function useComputedData<ComputedData extends any>(
  computeData: (
    treeMap: Map<string, { generatedId: string; indexPathString: string } & Record<string, any>>
  ) => ComputedData
) {
  const treeComputedData = React.useContext(ComputedDataContext)
  const generatedId = React.useId()
  const computeDataRef = React.useRef(computeData)

  useIsomorphicLayoutEffect(() => {
    computeDataRef.current = computeData
  })

  /** Use Suspense to re-render the component before committing the final props on the server. */
  let serverComputedData: any = null

  if (isServer) {
    serverComputedData = suspend(() => {
      return new Promise((resolve) => {
        /** Keep clearing timeout until the last component renders. */
        clearTimeout(globalTimeoutId)

        /** Store all of the promises to compute. */
        globalResolves.push(() =>
          resolve(computeData(sortMapByIndexPath(useTreeStore.getState().treeMap)))
        )

        /** Push to the end of the event stack to allow all leaf components to initially render. */
        globalTimeoutId = setTimeout(() => {
          /** Resolve all of the leaf promises now that we have stored and computed all data. */
          globalResolves.forEach((resolve) => resolve())
          globalResolves = []
        })
      })
    }, [generatedId])

    /** Store computed data so it can be injected on the server. */
    treeComputedData?.set(generatedId, serverComputedData)
  } else {
    serverComputedData = treeComputedData?.get(generatedId)
  }

  const clientComputedData = useTreeStore((state) => {
    return computeDataRef.current ? computeDataRef.current(sortMapByIndexPath(state.treeMap)) : null
  }, shallow)

  return clientComputedData || serverComputedData
}
