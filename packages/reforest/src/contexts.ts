import * as React from "react"
import { Atom, PrimitiveAtom } from "jotai"

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

export const ComputedDataContext = React.createContext<Map<string, any>>(getInitialComputedData())

ComputedDataContext.displayName = "ComputedDataContext"

export const TreeAtomsContext = React.createContext<{
  computedTreeMapAtom: PrimitiveAtom<Map<string, any>>
  treeMapAtom: PrimitiveAtom<Map<string, any>>
  treeMapEntriesAtom: Atom<any[]>
} | null>(null)

TreeAtomsContext.displayName = "TreeAtomsContext"

export const TreeMapContext = React.createContext<Map<string, any>>(new Map())

TreeMapContext.displayName = "TreeMapContext"