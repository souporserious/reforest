import * as React from "react"
import type { UseBoundStore, StoreApi } from "zustand"

export const PrerenderContext = React.createContext(false)

PrerenderContext.displayName = "PrerenderContext"

export const MaxIndexContext = React.createContext<number[]>([])

MaxIndexContext.displayName = "MaxIndexContext"

export const IndexContext = React.createContext<string | null>(null)

IndexContext.displayName = "IndexContext"

export type TreeState = {
  treeMap: Map<string, any>
  prerenderedTreeIds: Map<string, string>
  shouldPrerender: boolean
  setTreeData: (key: string, value: any, shouldUpdate?: boolean) => void
  deleteTreeData: (key: string, shouldUpdate?: boolean) => void
}

export type TreeStateStore = UseBoundStore<StoreApi<TreeState>>

export const TreeStateContext = React.createContext<TreeStateStore | null>(null)

TreeStateContext.displayName = "TreeStateContext"
