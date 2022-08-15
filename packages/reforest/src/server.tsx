import * as React from "react"
import { suspend } from "suspend-react"

import { ComputedDataContext, TreeMapContext } from "./contexts"
import { isServer, sortMapByIndexPath } from "./utils"

const DATA_ID = "__REFOREST_DATA__"

/** Stringify a tree map. */
export function stringifyTreeMap(treeMap: Map<string, any>) {
  let allData = {}

  treeMap.forEach((data, key) => {
    allData[key] = data
  })

  return JSON.stringify(allData)
}

/** Wraps a tree with a Map for gathering indexed data on the server. */
export function createTreeProvider(initialEntries?: [string, any][]) {
  const treeComputedData = new Map<string, any>(initialEntries)

  function TreeProvider(props: { children: React.ReactNode }) {
    return (
      <ComputedDataContext.Provider value={treeComputedData}>
        {props.children}
      </ComputedDataContext.Provider>
    )
  }

  return {
    TreeProvider,
    treeComputedData,
    stringifyTreeComputedData: () => stringifyTreeMap(treeComputedData),
    getInitializerScript: () =>
      `<script id="${DATA_ID}" type="application/json">${stringifyTreeMap(
        treeComputedData
      )}</script>`,
  }
}

/** Track initial component renders. */
let globalResolves: any[] = []
let globalTimeoutId: ReturnType<typeof setTimeout>

/** Compute data based on all collected tree data. */
export function useServerComputedData<TreeValue extends any, ComputedTreeValue extends any>(
  treeId: string,
  computeData?: (treeMap: Map<string, TreeValue>, treeId: string) => ComputedTreeValue
) {
  const treeMap = React.useContext(TreeMapContext)
  const treeComputedData = React.useContext(ComputedDataContext)

  /** Use Suspense to re-render the component before committing the final props on the server. */
  const isServerWithComputedData = isServer && treeMap && computeData !== undefined
  let serverComputedData: any = null

  if (isServerWithComputedData) {
    serverComputedData = suspend(() => {
      return new Promise((resolve) => {
        /** Keep clearing timeout until the last component renders. */
        clearTimeout(globalTimeoutId)

        /** Store all of the promises to compute. */
        globalResolves.push(() => {
          const sortedTreeMap = sortMapByIndexPath(treeMap)
          const computedData = computeData(sortedTreeMap, treeId)

          resolve(computedData)
        })

        /** Push to the end of the event stack to allow all leaf components to initially render. */
        globalTimeoutId = setTimeout(() => {
          /** Resolve all of the leaf promises now that we have stored and computed all data. */
          globalResolves.forEach((resolve) => resolve())
          globalResolves = []
        })
      })
    }, [treeId])

    /** Store computed data so it can be injected on the server. */
    treeComputedData?.set(treeId, serverComputedData)
  } else {
    serverComputedData = treeComputedData?.get(treeId)
  }

  return serverComputedData
}
