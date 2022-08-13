import * as React from "react"

import { DATA_ID, isServer } from "./utils"

export const MaxIndexContext = React.createContext<number[]>([])

MaxIndexContext.displayName = "MaxIndexContext"

export const IndexContext = React.createContext<string | null>(null)

IndexContext.displayName = "IndexContext"

/** Gets the initial computed data from the injected script tag. */
export function getInitialComputedData() {
  let serverEntries: [string, any][] = []

  /** Hydrate data if available in document head. */
  if (!isServer) {
    const serverJSON = document.getElementById(DATA_ID)?.innerHTML

    if (serverJSON) {
      const serverComputedData = JSON.parse(serverJSON)

      if (serverComputedData) {
        serverEntries = Object.entries(serverComputedData)
      }
    }
  }

  return new Map(serverEntries)
}

export const ComputedDataContext = React.createContext<Map<string, any> | null>(
  getInitialComputedData()
)

ComputedDataContext.displayName = "ComputedDataContext"

export type TreeStateContextValue<ComputedData extends any = any> = {
  treeMap: Map<string, any>
  subscribeTreeData: (key: string, value: any) => () => void
} & {
  computed: ComputedData | null
}

export const TreeStateContext = React.createContext<TreeStateContextValue | null>(null)
