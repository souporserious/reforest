import * as React from "react"
import { suspend } from "suspend-react"

import { ComputedDataContext, TreeStateContext } from "./contexts"
import { isServer, sortMapByIndexPath, useIsomorphicLayoutEffect } from "./utils"

/** Track initial component renders. */
let globalResolves: any[] = []
let globalTimeoutId: ReturnType<typeof setTimeout>

/** Compute data based on all collected tree data. */
export function useComputedData<ComputedData extends any>(
  computeData: (
    treeMap: Map<string, { generatedId: string; indexPathString: string } & Record<string, any>>
  ) => ComputedData,
  dependencies: any[] = []
) {
  const treeState = React.useContext(TreeStateContext)
  const treeComputedData = React.useContext(ComputedDataContext)
  const generatedId = React.useId()

  if (treeState === null) {
    throw new Error("useComputedData must be used within a component that uses useTree.")
  }

  /** Use Suspense to re-render the component before committing the final props on the server. */
  const isServerWithComputedData = isServer && computeData !== undefined
  let serverComputedData: any = null

  if (isServerWithComputedData) {
    serverComputedData = suspend(() => {
      return new Promise((resolve) => {
        /** Keep clearing timeout until the last component renders. */
        clearTimeout(globalTimeoutId)

        /** Store all of the promises to compute. */
        globalResolves.push(() => {
          const sortedTreeMap = sortMapByIndexPath(treeState.treeMap)
          const computedData = computeData(sortedTreeMap)

          resolve(computedData)
        })

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

  const clientComputedData = null

  // const snapshot = useSnapshot(treeState)
  // const clientComputedData = React.useMemo(
  //   () => (computeData ? computeData(sortMapByIndexPath(snapshot.treeMap)) : null),
  //   dependencies.concat(snapshot)
  // )

  // useIsomorphicLayoutEffect(() => {
  //   treeComputedData?.set(generatedId, clientComputedData)
  //   return () => {
  //     treeComputedData?.delete(generatedId)
  //   }
  // }, [clientComputedData, generatedId])

  return clientComputedData || serverComputedData
}
