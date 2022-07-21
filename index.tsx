import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { subscribe } from "valtio"
import { proxyMap } from "valtio/utils"

const MaxIndexContext = React.createContext<number[]>([])
const IndexContext = React.createContext<string | null>(null)
const IndexDataContext = React.createContext<Map<string, any> | null>(null)
const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

/**
 * Parses a numerical dot-separated string as an index path.
 *
 * @example
 * parseIndexPath('0.10.2') -> [0, 10, 2]
 */
export function parseIndexPath(indexPathString: string) {
  return indexPathString.split(".").map((index) => parseInt(index, 10))
}

export const indexChildrenMap = proxyMap()

/**
 * Returns the index path data based on the closest useIndexedChildren.
 * Optionally attach data that can be retrieved in useIndexedChildren.
 */
export function useIndex<Data extends any>(data: Data | null = null) {
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const indexData = React.useContext(IndexDataContext)
  const index = React.useMemo(() => {
    if (indexPathString === null) {
      return null
    }

    const indexPath = parseIndexPath(indexPathString)
    const maxIndex = maxIndexPath[maxIndexPath.length - 1]
    const index = indexPath[indexPath.length - 1]

    return {
      maxIndex,
      maxIndexPath,
      index,
      indexPath,
      indexPathString,
      isFirst: index === 0,
      isLast: index === maxIndex,
      isEven: index % 2 === 0,
      isOdd: Math.abs(index % 2) === 1,
    }
  }, [maxIndexPath, indexPathString])

  useIsomorphicLayoutEffect(() => {
    if (data === null || indexData === null || index === null) {
      return
    }

    const { indexPathString, indexPath } = index
    const parentIndexPathString = indexPath.slice(0, -1).join(".")

    indexData.set(indexPathString, {
      indexPathString,
      parentIndexPathString,
      data,
    } as any)

    return () => {
      indexData.delete(indexPathString)
    }
  }, [data, index])

  /** Capture the initial data when rendering on the server. */
  if (isServer && indexData && index) {
    const { indexPathString, indexPath } = index
    const parentIndexPathString = indexPath.slice(0, -1).join(".")

    indexData.set(indexPathString, {
      indexPathString,
      parentIndexPathString,
      data,
    } as any)
  }

  return index
}

type Tree = {
  children?: Tree[]
} & {
  [key: string]: any
}

/**
 * Simple recursive function that removes indexPathString and parentIndexPathString
 * keys as well as normalizes simple data types.
 */
function cleanTree(tree: Tree | Array<any>) {
  if (Array.isArray(tree)) {
    return cleanTree({ children: tree }).children
  }

  tree.children?.forEach((child) => {
    delete child.parentIndexPathString
    delete child.indexPathString

    if (child?.children?.length === 0) {
      delete child.children
    }

    Object.assign(child, child.data)

    delete child.data

    cleanTree(child)
  })

  return tree
}

/** Builds an index tree from a Map of index paths. */
export function buildTree(indexMap: Map<string, any>) {
  const sortedKeys = Array.from(indexMap.keys()).sort()
  const values = Array.from(indexMap.values())
  const sortedValues = sortedKeys.map((_, index) => {
    const data = values[index]
    return data
  })
  const tree = arrayToTree(sortedValues, {
    id: "indexPathString",
    parentId: "parentIndexPathString",
    dataField: null,
  })
  const cleanedTree = cleanTree(tree)

  return cleanedTree
}

/** Provides the current index path for each child. */
export function useIndexedChildren(
  children: React.ReactNode,
  onTreeUpdate?: <UpdatedTree extends Tree>(tree: UpdatedTree) => void
) {
  const id = React.useId().slice(1, -1)
  const parentMaxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const indexData = React.useContext(IndexDataContext)
  const indexDataRef = React.useRef<Map<string, any> | null>(null)
  const childrenCount = React.Children.count(children)
  const maxIndexPath = React.useMemo(
    () => parentMaxIndexPath.concat(childrenCount),
    [childrenCount]
  )
  const onTreeUpdateRef = React.useRef<typeof onTreeUpdate>(onTreeUpdate)

  useIsomorphicLayoutEffect(() => {
    onTreeUpdateRef.current = onTreeUpdate
  })

  /** Initiate this as the Map for index data if this is a top-level call. */
  if (indexData === null) {
    indexDataRef.current = proxyMap()

    /** Capture the initial data in render when running on the server. */
    if (isServer) {
      indexChildrenMap.set(id, indexDataRef.current)
    }
  } else {
    indexDataRef.current = indexData
  }

  useIsomorphicLayoutEffect(() => {
    if (onTreeUpdateRef.current === undefined) {
      return
    }

    function handleUpdate() {
      if (indexDataRef.current && onTreeUpdateRef.current) {
        const tree = buildTree(indexDataRef.current)
        onTreeUpdateRef.current(tree)
      }
    }

    /** Build initial tree once children have rendered. */
    handleUpdate()

    /** Subscribe to future updates to the tree. */
    return subscribe(indexDataRef.current!, handleUpdate)
  }, [])

  const childrenToRender = (
    <MaxIndexContext.Provider value={maxIndexPath}>
      {React.Children.map(children, (child, index) =>
        React.isValidElement(child) ? (
          <IndexContext.Provider
            key={child.key}
            value={indexPathString ? `${indexPathString}.${index.toString()}` : index.toString()}
          >
            {child}
          </IndexContext.Provider>
        ) : (
          child
        )
      )}
    </MaxIndexContext.Provider>
  )

  if (indexData === null) {
    return (
      <IndexDataContext.Provider value={indexDataRef.current}>
        {childrenToRender}
      </IndexDataContext.Provider>
    )
  }

  return childrenToRender
}

/** Finds a descendant child based on its index path. */
export function findDescendant(children: React.ReactNode, indexPath: number[]): React.ReactElement {
  let path = indexPath.slice()

  while (path.length > 0) {
    let searchIndex = path.shift()

    if (React.isValidElement(children)) {
      children = (children as React.ReactElement).props.children
    }

    children = React.Children.toArray(children).find((_, childIndex) => childIndex === searchIndex)
  }

  return children as React.ReactElement
}

/** Returns a memoized descendant child using its index path. */
export function useDescendant(
  children: React.ReactNode,
  indexPath: number[] | null
): React.ReactElement | null {
  return React.useMemo(
    () => (indexPath ? findDescendant(children, indexPath) : null),
    [children, indexPath]
  )
}
