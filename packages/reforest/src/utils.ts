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

/** Recursive function that removes "id" and "parentId" keys and returns each indexed data. */
export function cleanAndSortTree(tree: any) {
  if (tree.children?.length > 0) {
    /** Sort children by the index path. */
    tree.children.sort((a, b) => parseFloat(a.indexPathString) - parseFloat(b.indexPathString))

    return {
      ...tree.data,
      children: tree.children.map(cleanAndSortTree),
    }
  }

  return tree.data
}

/** Builds an array of trees from a Map of data collected in useTree. */
export function mapToChildren(dataMap: Map<string, any>) {
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

  return cleanedTree ? cleanedTree.children : null
}

/** Sorts a map by an indexPathString property. */
export function sortMapByIndexPath(treeMap: Map<string, any>) {
  const sortedEntries = Array.from(treeMap.entries()).sort(
    (a, b) => parseFloat(a[1].indexPathString) - parseFloat(b[1].indexPathString)
  )

  return new Map(sortedEntries)
}

/** Flattens and sorts all tree nodes into one array. */
export function flattenChildren(children: any[], _shouldSort: boolean = true) {
  const flatChildren = children.flatMap((child) =>
    child.children ? flattenChildren(child.children) : [child]
  )

  return _shouldSort
    ? flatChildren.sort((a, b) => parseFloat(a.indexPathString) - parseFloat(b.indexPathString))
    : flatChildren
}
