import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { subscribe } from "valtio"
import { proxyMap } from "valtio/utils"

const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

const MaxIndexContext = React.createContext<number[]>([])
const IndexContext = React.createContext<string | null>(null)
export const IndexedTreesContext = React.createContext<Map<string, any>>(proxyMap<string, any>())
export const IndexedDataContext = React.createContext<Map<string, any> | null>(null)

MaxIndexContext.displayName = "MaxIndexContext"
IndexContext.displayName = "IndexContext"
IndexedTreesContext.displayName = "IndexedTreesContext"
IndexedDataContext.displayName = "IndexedDataContext"

/**
 * Parses a numerical dot-separated string as an index path.
 *
 * @example
 * parseIndexPath('0.10.2') -> [0, 10, 2]
 */
export function parseIndexPath(indexPathString: string) {
  return indexPathString.split(".").map((index) => parseInt(index, 10))
}

/** Wraps a tree with a Map for gathering indexed data on the server. */
export function createIndexedTreeProvider() {
  const indexedTrees = proxyMap<string, any>()

  function IndexTreeProvider(props: { children: React.ReactNode }) {
    return (
      <IndexedTreesContext.Provider value={indexedTrees}>
        {props.children}
      </IndexedTreesContext.Provider>
    )
  }

  return {
    IndexTreeProvider,
    indexedTrees,
  }
}

/** Subscribe to any changes to the overall indexed data. */
export function useIndexedDataEffect(
  onTreeUpdate: <UpdatedTree extends any[]>(tree: UpdatedTree) => void
) {
  const indexedTrees = React.useContext(IndexedTreesContext)
  const indexedData = React.useContext(IndexedDataContext)
  const onTreeUpdateRef = React.useRef<typeof onTreeUpdate>(onTreeUpdate)

  useIsomorphicLayoutEffect(() => {
    onTreeUpdateRef.current = onTreeUpdate
  })

  useIsomorphicLayoutEffect(() => {
    function buildIndexedTree() {
      const trees = Array.from(indexedTrees.values()).map(buildTreeFromMap)
      onTreeUpdateRef.current(trees)
    }

    /** Build initial index tree once children have rendered. */
    buildIndexedTree()

    /** Subscribe to future updates to indexed trees. */
    const indexedTreesCleanup = subscribe(indexedTrees, buildIndexedTree)
    const indexedDataCleanup = indexedData ? subscribe(indexedData, buildIndexedTree) : null

    return () => {
      indexedTreesCleanup()
      indexedDataCleanup?.()
    }
  }, [indexedTrees, indexedData])
}

/**
 * Returns the index path data based on the closest useIndexedChildren.
 * Optionally attach data that can be retrieved in useIndexedChildren.
 */
export function useIndex<Data extends any>(data: Data | null = null) {
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const indexedData = React.useContext(IndexedDataContext)
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
    if (data === null || indexedData === null || index === null) {
      return
    }
    const { indexPathString } = index

    indexedData.set(indexPathString, data)

    return () => {
      indexedData.delete(indexPathString)
    }
  }, [indexedData, data, index])

  /** Capture the initial data when rendering on the server. */
  if (isServer && indexedData && index) {
    const { indexPathString } = index

    indexedData.set(indexPathString, data)
  }

  return index
}

type Tree = {
  children?: Tree[]
} & {
  [key: string]: any
}

/** Recursive function that removes "id" and "parentId" keys and returns each indexed data. */
function cleanTree(tree: Tree | Array<any>) {
  if (Array.isArray(tree)) {
    return cleanTree({ children: tree }).children
  }

  if (tree.children && tree.children?.length > 0) {
    return {
      ...tree.data,
      children: tree.children.map(cleanTree),
    }
  }

  return tree.data
}

/** Builds an index tree from a Map of index paths. */
export function buildTreeFromMap(indexMap: Map<string, any>) {
  const parsedValues = Array.from(indexMap.entries()).map(([indexPathString, data]) => {
    const parentIndexPathString = parseIndexPath(indexPathString.toString()).slice(0, -1).join(".")

    return {
      data,
      id: indexPathString,
      parentId: parentIndexPathString,
    }
  })
  const tree = arrayToTree(parsedValues, { dataField: null })
  const cleanedTree = cleanTree(tree)

  return cleanedTree
}

/** Provides the current index path for each child. */
export function useIndexedChildren(
  children: React.ReactNode,
  onTreeUpdate?: <UpdatedTree extends any[]>(tree: UpdatedTree) => void
) {
  const id = React.useId().slice(1, -1)
  const indexedTrees = React.useContext(IndexedTreesContext)
  const parentMaxIndexPath = React.useContext(MaxIndexContext)
  const parentIndexPathString = React.useContext(IndexContext)
  const indexedData = React.useContext(IndexedDataContext)
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
  if (indexedData === null) {
    indexDataRef.current = proxyMap()

    /** Capture the initial data in render when running on the server. */
    if (isServer && indexedTrees) {
      indexedTrees.set(id, indexDataRef.current)
    }
  } else {
    indexDataRef.current = indexedData
  }

  /** Update the top-level proxy Map of all index trees. */
  useIsomorphicLayoutEffect(() => {
    if (indexedData === null) {
      indexedTrees.set(id, indexDataRef.current)
    }

    return () => {
      if (indexedData === null) {
        indexedTrees.delete(id)
      }
    }
  }, [id, indexedTrees])

  /** Optionally subscribe to this trees data changes. */
  useIsomorphicLayoutEffect(() => {
    if (indexedData === null || onTreeUpdateRef.current === undefined) {
      return
    }

    function buildIndexedTree() {
      if (indexDataRef.current && onTreeUpdateRef.current) {
        const tree = buildTreeFromMap(indexDataRef.current)
        onTreeUpdateRef.current(tree)
      }
    }

    /** Build initial index tree once children have rendered. */
    buildIndexedTree()

    /** Subscribe to future updates to tree. */
    return subscribe(indexedData, buildIndexedTree)
  }, [indexedData])

  const childrenToRender = (
    <MaxIndexContext.Provider value={maxIndexPath}>
      {React.Children.map(children, (child, index) =>
        React.isValidElement(child) ? (
          <IndexContext.Provider
            key={child.key}
            value={
              parentIndexPathString === null
                ? index.toString()
                : `${parentIndexPathString}.${index.toString()}`
            }
          >
            {child}
          </IndexContext.Provider>
        ) : (
          child
        )
      )}
    </MaxIndexContext.Provider>
  )

  if (indexedData === null) {
    return (
      <IndexedDataContext.Provider value={indexDataRef.current}>
        {childrenToRender}
      </IndexedDataContext.Provider>
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
