import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { suspend } from "suspend-react"
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
      <React.Suspense fallback={null}>
        <IndexedTreesContext.Provider value={indexedTrees}>
          {props.children}
        </IndexedTreesContext.Provider>
      </React.Suspense>
    )
  }

  return {
    IndexTreeProvider,
    indexedTrees,
    getIndexedTrees: () => {
      return Array.from(indexedTrees.values()).map((tree) => ({
        ...tree.data,
        children: indexMapToTree(tree.indexMap),
      }))
    },
  }
}

/** Subscribe to any changes to the overall indexed data. */
export function useIndexedDataEffect(
  onTreeUpdate: <UpdatedTree extends any[]>(
    trees: UpdatedTree[],
    indexMaps: Map<string, any>
  ) => void
) {
  const indexedTrees = React.useContext(IndexedTreesContext)
  const indexedData = React.useContext(IndexedDataContext)
  const onTreeUpdateRef = React.useRef<typeof onTreeUpdate>(onTreeUpdate)

  useIsomorphicLayoutEffect(() => {
    onTreeUpdateRef.current = onTreeUpdate
  })

  useIsomorphicLayoutEffect(() => {
    function buildIndexedTree() {
      const trees = Array.from(indexedTrees.values()).map((tree) => ({
        ...tree.data,
        children: indexMapToTree(tree.indexMap),
      }))

      onTreeUpdateRef.current(trees, new Map(indexedTrees))
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
export function useIndex<Data extends Record<string, any>, ComputedData extends any>(
  data: Data | null = null,
  computeData?: (collectedData: [string, Data][] | null, indexPathString: string) => ComputedData
) {
  const indexedData = React.useContext(IndexedDataContext)
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)

  /** Capture the initial data when rendering on the server. */
  if (isServer && indexedData && indexPathString) {
    indexedData.set(indexPathString, data)
  }

  /** Add and delete data in useLayoutEffect on the client. */
  useIsomorphicLayoutEffect(() => {
    if (data === null || indexedData === null || indexPathString === null) {
      return
    }

    indexedData.set(indexPathString, data)

    return () => {
      indexedData.delete(indexPathString)
    }
  }, [indexedData, data, indexPathString])

  /** Use Suspense on the server to re-render the component before committing the final props. */
  let serverComputedData: ComputedData | null = null

  if (computeData && indexPathString && isServer) {
    serverComputedData = suspend(() => {
      return new Promise(async (resolve) => {
        /** Wait one tick to allow all components to initially render. */
        setTimeout(() => {
          /** Now the collected data is available for computing. */
          const indexedDataEntries = indexedData ? Array.from(indexedData.entries()) : []
          const computedData = computeData
            ? computeData(indexedDataEntries, indexPathString)
            : indexedDataEntries

          resolve(computedData)
        })
      })
    }, [indexPathString]) as any
  }

  /** Listen for store changes and compute props before rendering to the screen on client. */
  const [clientComputedData, setClientComputedData] = React.useState<ComputedData | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (indexedData === null || indexPathString === null || computeData === undefined) {
      return
    }

    return subscribe(indexedData, () => {
      const indexedDataEntries = indexedData ? Array.from(indexedData.entries()) : []
      const computedData = computeData(indexedDataEntries, indexPathString)

      setClientComputedData(computedData)
    })
  }, [computeData, indexedData])

  return React.useMemo(() => {
    if (indexPathString === null) {
      return null
    }

    const indexPath = parseIndexPath(indexPathString)
    const maxIndex = maxIndexPath[maxIndexPath.length - 1]
    const index = indexPath[indexPath.length - 1]

    return {
      computedData: isServer ? serverComputedData : clientComputedData,
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
  }, [indexPathString, maxIndexPath, indexedData, serverComputedData, clientComputedData])
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
export function indexMapToTree(indexMap: Map<string, any>) {
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
export function useIndexedChildren<Data extends Record<string, any>>(
  children: React.ReactNode,
  data: Data | null = null,
  onTreeUpdate?: <UpdatedTree extends Data & { children: any[] }>(
    tree: UpdatedTree,
    indexMap: Map<string, any>
  ) => void
) {
  const id = React.useId()
  const indexedTrees = React.useContext(IndexedTreesContext)
  const parentMaxIndexPath = React.useContext(MaxIndexContext)
  const parentIndexPathString = React.useContext(IndexContext)
  const indexedData = React.useContext(IndexedDataContext)
  const indexedDataRef = React.useRef<Map<string, any> | null>(null)
  const childrenCount = React.Children.count(children)
  const maxIndexPath = React.useMemo(
    () => parentMaxIndexPath.concat(childrenCount - 1),
    [childrenCount]
  )
  const onTreeUpdateRef = React.useRef<typeof onTreeUpdate>(onTreeUpdate)

  useIsomorphicLayoutEffect(() => {
    onTreeUpdateRef.current = onTreeUpdate
  })

  /** Initiate this as the Map for index data if this is a top-level call. */
  if (indexedData === null) {
    indexedDataRef.current = proxyMap()

    /** Capture the initial data in render when running on the server. */
    if (isServer && indexedTrees) {
      indexedTrees.set(id, {
        data,
        indexMap: indexedDataRef.current,
      })
    }
  } else {
    indexedDataRef.current = indexedData
  }

  /** Update the top-level proxy Map of all index trees. */
  useIsomorphicLayoutEffect(() => {
    if (indexedData === null) {
      indexedTrees.set(id, {
        data,
        indexMap: indexedDataRef.current,
      })
    }

    return () => {
      if (indexedData === null) {
        indexedTrees.delete(id)
      }
    }
  }, [id, data, indexedTrees])

  /** Optionally subscribe to this trees data changes. */
  useIsomorphicLayoutEffect(() => {
    if (onTreeUpdateRef.current === undefined) {
      return
    }

    function buildIndexedTree() {
      if (indexedDataRef.current && onTreeUpdateRef.current) {
        const tree = {
          ...(data || {}),
          children: indexMapToTree(indexedDataRef.current),
        } as Data & { children: any[] }

        onTreeUpdateRef.current(tree, new Map(indexedDataRef.current))
      }
    }

    /** Build initial index tree once children have rendered. */
    buildIndexedTree()

    /** Subscribe to future updates to tree. */
    if (indexedDataRef.current) {
      return subscribe(indexedDataRef.current, buildIndexedTree)
    }
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
      <IndexedDataContext.Provider value={indexedDataRef.current}>
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

/**Returns a memoized descendant child using its index path. */
export function useDescendant(
  children: React.ReactNode,
  indexPath: number[] | null
): React.ReactElement | null {
  return React.useMemo(
    () => (indexPath ? findDescendant(children, indexPath) : null),
    [children, indexPath]
  )
}
