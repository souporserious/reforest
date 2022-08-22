import * as React from "react"
import type { UseBoundStore, StoreApi } from "zustand"

export const PreRenderContext = React.createContext(false)

PreRenderContext.displayName = "PreRenderContext"

export const MaxIndexContext = React.createContext<number[]>([])

MaxIndexContext.displayName = "MaxIndexContext"

export const IndexContext = React.createContext<string | null>(null)

IndexContext.displayName = "IndexContext"

export type TreeState = {
  treeMap: Map<string, any>
  preRenderedTreeIds: Map<string, string>
  shouldPreRender: boolean
  setTreeData: (key: string, value: any, shouldUpdate?: boolean) => void
  deleteTreeData: (key: string, shouldUpdate?: boolean) => void
}

export type TreeStateStore = UseBoundStore<StoreApi<TreeState>>

export const TreeStateContext = React.createContext<TreeStateStore | null>(null)

TreeStateContext.displayName = "TreeStateContext"
