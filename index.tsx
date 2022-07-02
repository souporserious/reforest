import type { ReactNode, ReactElement } from "react"
import React, {
  Children,
  createContext,
  isValidElement,
  useContext,
  useMemo,
} from "react"
import flattenChildren from "react-keyed-flatten-children"

const IndexContext = createContext<string>("")

/**
 * Parses a numerical string as an index path.
 *
 * @example
 * parseIndexPath('028') -> [0, 2, 8]
 */
export function parseIndexPath(indexPathString: string) {
  return indexPathString.split("").map((index) => parseInt(index, 10))
}

/** Returns the current index path this hook is rendered in. */
export function useIndexPath() {
  const indexPathString = useContext(IndexContext)

  if (indexPathString === "") {
    throw new Error(
      "The useIndexPath hook must be a descendant of useIndexedChildren."
    )
  }

  return indexPathString
}

/** Passes an index to each child regardless of fragments. */
export function useIndexedChildren(children: ReactNode) {
  const indexPathString = useContext(IndexContext)

  return flattenChildren(children)
    .filter(isValidElement)
    .map((child, index) => (
      <IndexContext.Provider
        key={child.key}
        value={indexPathString + index.toString()}
      >
        {child}
      </IndexContext.Provider>
    ))
}

/** Finds a descendant child based on its index path. */
export function findDescendant(
  children: ReactNode,
  indexPath: string
): ReactElement {
  let path = parseIndexPath(indexPath)

  while (path.length > 0) {
    let searchIndex = path.shift()

    if (isValidElement(children)) {
      children = (children as ReactElement).props.children
    }

    children = flattenChildren(children).find(
      (_, childIndex) => childIndex === searchIndex
    )
  }

  return children as ReactElement
}

/** Returns a memoized descendant child using its index path. */
export function useDescendant(
  children: ReactNode,
  indexPath: string | null
): ReactElement | null {
  return useMemo(
    () => (indexPath ? findDescendant(children, indexPath) : null),
    [children, indexPath]
  )
}
