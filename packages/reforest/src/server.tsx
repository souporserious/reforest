import * as React from "react"

import { ComputedDataContext } from "./contexts"

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
