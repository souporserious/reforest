import * as React from "react"
import { ref, proxy } from "valtio"
import { proxyMap } from "valtio/utils"

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

export const TreeComputedDataContext = React.createContext<Map<string, any>>(
  getInitialComputedData()
)

TreeComputedDataContext.displayName = "TreeComputedDataContext"

export function createInitialTreeState() {
  const initialEntries: any = []
  const state = proxy<{
    treeMap: Map<string, any>
    subscribeTreeData: (key: string, value: any) => () => void
  }>({
    treeMap: proxyMap<string, any>(initialEntries),
    subscribeTreeData: (key: string, value: any) => {
      state.treeMap.set(key, ref(value))
      return () => {
        state.treeMap.delete(key)
      }
    },
  })

  return state
}

export type TreeStateContextValue = {
  treeMap: Map<string, any>
  subscribeTreeData: (key: string, value: any) => () => void
}

export const TreeStateContext = React.createContext<TreeStateContextValue | null>(null)

TreeStateContext.displayName = "TreeStateContext"

export const TreeMapContext = React.createContext<Map<string, any>>(new Map())

TreeMapContext.displayName = "TreeMapContext"
