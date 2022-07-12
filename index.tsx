import type { ReactNode, ReactElement } from "react"
import React, {
  createContext,
  isValidElement,
  useContext,
  useMemo,
} from "react"
import flattenChildren from "react-keyed-flatten-children"

const MaxIndexContext = createContext<number[]>([])
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
  const maxIndexPath = useContext(MaxIndexContext)
  const indexPathString = useContext(IndexContext)
  const indexPath = useMemo(
    () => parseIndexPath(indexPathString),
    [indexPathString]
  )
  const maxIndex = maxIndexPath[maxIndexPath.length - 1]
  const index = indexPath[indexPath.length - 1]

  if (indexPathString === "") {
    return null
  }

  return {
    maxIndex,
    index,
    maxIndexPath,
    indexPath,
    isFirstIndex: index === 0,
    isLastIndex: index === maxIndex,
    isEven: index % 2 === 0,
    isOdd: Math.abs(index % 2) === 1,
  }
}

/** Passes an index to each child regardless of fragments. */
export function useIndexedChildren(children: ReactNode) {
  const parentMaxIndex = useContext(MaxIndexContext)
  const indexPathString = useContext(IndexContext)
  const flattenedChildren = flattenChildren(children).filter(isValidElement)
  const maxIndex = useMemo(
    () => parentMaxIndex.concat(flattenedChildren.length),
    [flattenedChildren.length]
  )

  return (
    <MaxIndexContext.Provider value={maxIndex}>
      {flattenedChildren.map((child, index) => (
        <IndexContext.Provider
          key={child.key}
          value={indexPathString + index.toString()}
        >
          {child}
        </IndexContext.Provider>
      ))}
    </MaxIndexContext.Provider>
  )
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
