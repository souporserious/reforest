import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"

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

  for (let index = 0; index < maxLength; index++) {
    const difference = (aArray[index] ?? 0) - (bArray[index] ?? 0)

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
  const parsedValues = Array.from(dataMap.entries()).map(([indexPathString, data]) => {
    const parentIndexPathString = parseIndexPath(indexPathString).slice(0, -1).join(".")

    return {
      data,
      parentId: parentIndexPathString,
      id: indexPathString,
    }
  })
  const tree = arrayToTree(parsedValues, { dataField: null })
  const cleanedTree = cleanAndSortTree({ children: tree })

  return cleanedTree ? cleanedTree.children : []
}

/** Sorts a map by an indexPathString property. */
export function sortMapByIndexPath(treeMap: Map<string, any>) {
  const sortedEntries = Array.from(treeMap.entries()).sort((a, b) => compareIndexPaths(a[0], b[0]))

  return new Map(sortedEntries)
}

/** Flattens all tree nodes into one array. */
export function flattenChildren(children: any[]) {
  const flatChildren = children.flatMap((child) =>
    child.children ? flattenChildren(child.children) : [child]
  )

  return flatChildren
}
