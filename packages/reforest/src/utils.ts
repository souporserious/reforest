import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"

export const DATA_ID = "__REFOREST_DATA__"

export const isServer = typeof window === "undefined"

export const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

/**
 * Parses a numerical dot-separated string as an index path.
 *
 * @example
 * parseIndexPath('0.10.2') -> [0, 10, 2]
 */
export function parseIndexPath(indexPathString: string) {
  return indexPathString.split(".").map((index) => parseInt(index, 10))
}

/**
 * Compares two index path strings.
 * Credit: https://twitter.com/katylava/status/1558222958702780418
 */
export function compareIndexPaths(a: string = "", b: string = "") {
  let aArray = a.split(".").map(Number)
  let bArray = b.split(".").map(Number)

  if (aArray.includes(NaN) || bArray.includes(NaN)) {
    throw new Error("Version contains parts that are not numbers")
  }

  const maxLength = Math.max(a.length, b.length)

  /** Make sure arrays are the same length by padding shorter one with Os. */
  aArray = Array.from({ ...aArray, length: maxLength }, (value) => value ?? 0)
  bArray = Array.from({ ...bArray, length: maxLength }, (value) => value ?? 0)

  for (let index = 0; index < maxLength; index++) {
    const difference = aArray[index] - bArray[index]

    if (difference === 0) {
      continue
    }

    return difference > 0 ? 1 : -1
  }

  return 0
}

/** Recursive function that removes "id" and "parentId" keys and returns each indexed data. */
export function cleanAndSortTree(tree: any) {
  if (tree.children?.length > 0) {
    /** Sort children by the index path. */
    tree.children.sort((a, b) => compareIndexPaths(a.indexPathString, b.indexPathString))

    return {
      ...tree.data,
      children: tree.children.map(cleanAndSortTree),
    }
  }

  return tree.data
}

/** Builds an array of trees from a Map of data collected in useTree. */
export function mapToChildren(dataMap: Map<string, any>): Array<any> {
  const parsedValues = Array.from(dataMap.values()).map((data) => {
    const parentIndexPathString = parseIndexPath(data.indexPathString).slice(0, -1).join(".")

    return {
      data,
      parentId: parentIndexPathString,
      id: data.indexPathString,
    }
  })
  const tree = arrayToTree(parsedValues, { dataField: null })
  const cleanedTree = cleanAndSortTree({ children: tree })

  return cleanedTree ? cleanedTree.children : []
}

/** Sorts a map by an indexPathString property. */
export function sortMapByIndexPath(treeMap: Map<string, any>) {
  const sortedEntries = Array.from(treeMap.entries()).sort((a, b) =>
    compareIndexPaths(a[1].indexPathString, b[1].indexPathString)
  )

  return new Map(sortedEntries)
}

/** Flattens and sorts all tree nodes into one array. */
export function flattenChildren(children: any[], _shouldSort: boolean = true) {
  const flatChildren = children.flatMap((child) =>
    child.children ? flattenChildren(child.children) : [child]
  )

  return _shouldSort
    ? flatChildren.sort((a, b) => compareIndexPaths(a.indexPathString, b.indexPathString))
    : flatChildren
}
