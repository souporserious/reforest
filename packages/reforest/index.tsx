import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { suspend } from "suspend-react"
import { ref, subscribe } from "valtio"
import { proxyMap } from "valtio/utils"

const DATA_ID = "__REFOREST_DATA__"
const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

const MaxIndexContext = React.createContext<number[]>([])

MaxIndexContext.displayName = "MaxIndexContext"

const IndexContext = React.createContext<string | null>(null)

IndexContext.displayName = "IndexContext"

export type TreeMapContextValue = Map<string, any> | null

export const TreeMapContext = React.createContext<TreeMapContextValue>(null)

TreeMapContext.displayName = "TreeMapContext"

export const TreeCollectionContext = React.createContext<Map<string, TreeMapContextValue>>(
  proxyMap<string, TreeMapContextValue>()
)

TreeCollectionContext.displayName = "TreeCollectionContext"

/** Gets the initial computed data from the injected script tag. */
export function getInitialTreeComputedData() {
  let serverEntries: [string, any][] = []

  /** Hydrate data if available in document head. */
  if (!isServer) {
    const serverData = document.getElementById(DATA_ID)?.innerHTML

    if (serverData) {
      const serverComputedData = JSON.parse(serverData)

      if (serverComputedData) {
        serverEntries = Object.entries(serverComputedData)
      }
    }
  }

  return proxyMap(serverEntries)
}

export const TreeComputedDataContext = React.createContext<Map<string, any>>(
  getInitialTreeComputedData()
)

TreeComputedDataContext.displayName = "TreeComputedDataContext"

/**
 * Parses a numerical dot-separated string as an index path.
 *
 * @example
 * parseIndexPath('0.10.2') -> [0, 10, 2]
 */
export function parseIndexPath(indexPathString: string) {
  return indexPathString.split(".").map((index) => parseInt(index, 10))
}

/** Stringify a tree collection. */
export function stringifyTreeCollection(treeCollection: Map<string, any>) {
  let allData = {}

  treeCollection.forEach((treeMap, treeId) => {
    allData[treeId] = {}

    treeMap.forEach((data, key) => {
      allData[treeId][key] = data
    })
  })

  return JSON.stringify(allData)
}

/** Stringify a tree map. */
export function stringifyTreeMap(treeMap: Map<string, any>) {
  let allData = {}

  treeMap.forEach((data, key) => {
    allData[key] = data
  })

  return JSON.stringify(allData)
}

/** Wraps a tree with a Map for gathering indexed data on the server. */
export function createTreeProvider(initialEntries?: [string, any][]) {
  const treeCollection = proxyMap<string, TreeMapContextValue>(initialEntries)
  const treeComputedData = proxyMap<string, any>()

  function TreeProvider(props: { children: React.ReactNode }) {
    return (
      <TreeCollectionContext.Provider value={treeCollection}>
        <TreeComputedDataContext.Provider value={treeComputedData}>
          {props.children}
        </TreeComputedDataContext.Provider>
      </TreeCollectionContext.Provider>
    )
  }

  return {
    TreeProvider,
    treeCollection,
    treeComputedData,
    stringifyTreeCollection: () => stringifyTreeCollection(treeCollection),
    stringifyTreeComputedData: () => stringifyTreeMap(treeComputedData),
    getInitializerScript: () =>
      `<script id="${DATA_ID}" type="application/json">${stringifyTreeMap(
        treeComputedData
      )}</script>`,
  }
}

/** Provides a tree collection for subscribing to all tree data on the client, see [createTreeProvider] for rendering on the server. */
export function TreeProvider({
  children,
  initialTreeCollectionEntries,
  initialTreeComputedDataEntries,
}: {
  children: React.ReactNode
  initialTreeCollectionEntries?: [string, any][]
  initialTreeComputedDataEntries?: [string, any][]
}) {
  const treeCollectionContextValue = React.useRef<Map<string, TreeMapContextValue> | null>(null)
  const treeComputedDataContextValue = React.useRef<Map<string, any> | null>(null)

  if (treeCollectionContextValue.current === null) {
    /** TODO: add support for initial tree collection from script tag */

    treeCollectionContextValue.current = proxyMap<string, TreeMapContextValue>(
      initialTreeCollectionEntries
    )
  }

  if (treeComputedDataContextValue.current === null) {
    const serverEntries = getInitialTreeComputedData()

    treeComputedDataContextValue.current = proxyMap<string, any>(
      initialTreeComputedDataEntries || serverEntries
    )
  }

  return (
    <TreeCollectionContext.Provider value={treeCollectionContextValue.current}>
      <TreeComputedDataContext.Provider value={treeComputedDataContextValue.current}>
        {children}
      </TreeComputedDataContext.Provider>
    </TreeCollectionContext.Provider>
  )
}

/** Recursive function that removes "id" and "parentId" keys and returns each indexed data. */
function cleanAndSortTree(tree: any) {
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

/** Builds a tree from a Map of data collected in useTree. */
export function mapToTree(dataMap: Map<string, any>) {
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

  return cleanedTree
}

/** Sorts a map by an indexPathString property. */
export function sortMapByIndexPath(treeMap: Map<string, any>) {
  const sortedEntries = Array.from(treeMap.entries()).sort(
    (a, b) => parseFloat(a[1].indexPathString) - parseFloat(b[1].indexPathString)
  )

  return new Map(sortedEntries)
}

/** Generates a computed data getter for a generated id. */
export function useGetComputedData() {
  const treeComputedData = React.useContext(TreeComputedDataContext)

  return React.useCallback(
    (generatedId: string) => treeComputedData.get(generatedId),
    [treeComputedData]
  )
}

/** Track initial component renders. */
let globalResolves: any[] = []
let globalTimeoutId: ReturnType<typeof setTimeout>

/**
 * Returns the current index and optional computed data based on the closest useTree.
 */
export function useTreeData<Data extends Record<string, any>, ComputedData extends any>(
  data: Data | null = null,
  computeData?: (
    treeMap: Map<string, { generatedId: string; indexPathString: string } & Data>,
    generatedId: string
  ) => ComputedData,
  dependencies: any[] = []
) {
  const treeMap = React.useContext(TreeMapContext)
  const treeComputedData = React.useContext(TreeComputedDataContext)
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const generatedId = React.useId().slice(1, -1)
  const computeDataRef = React.useRef<typeof computeData>(computeData)

  useIsomorphicLayoutEffect(() => {
    computeDataRef.current = computeData
  })

  /** Capture the initial data when rendering on the server. */
  if (isServer && treeMap) {
    treeMap.set(generatedId, Object.assign({ generatedId, indexPathString }, data))
  }

  /** Add and delete data in useLayoutEffect on the client. */
  useIsomorphicLayoutEffect(() => {
    if (data === null || treeMap === null) {
      return
    }

    /** Wrap tree data in ref to prevent it from being proxied. */
    const treeData = ref(Object.assign({ generatedId, indexPathString }, data))

    treeMap.set(generatedId, treeData)

    return () => {
      treeMap.delete(generatedId)
    }
  }, [treeMap, data])

  /** Use Suspense to re-render the component before committing the final props on the server. */
  const isServerWithComputedData = isServer && computeData !== undefined
  let serverComputedData: ComputedData | null = null

  if (treeMap !== null && isServerWithComputedData) {
    serverComputedData = suspend(() => {
      return new Promise((resolve) => {
        /** Keep clearing timeout until the last component renders. */
        clearTimeout(globalTimeoutId)

        /** Store all of the promises to compute. */
        globalResolves.push(() =>
          resolve(computeData ? computeData(sortMapByIndexPath(treeMap), generatedId) : null)
        )

        /** Push to the end of the event stack to allow all leaf components to initially render. */
        globalTimeoutId = setTimeout(() => {
          /** Resolve all of the leaf promises now that we have stored and computed all data. */
          globalResolves.forEach((resolve) => resolve())
          globalResolves = []
        })
      })
    }, [generatedId]) as ComputedData

    /** Store computed data so it can be injected on the server. */
    treeComputedData.set(generatedId, serverComputedData)
  } else {
    serverComputedData = treeComputedData.get(generatedId)
  }

  /** Listen for store changes and compute props before rendering to the screen on client. */
  const [clientComputedData, setClientComputedData] = React.useState<ComputedData | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (computeDataRef.current === undefined || treeMap === null) {
      return
    }

    function computeClientData() {
      const computedData = computeDataRef.current!(sortMapByIndexPath(treeMap!), generatedId)

      treeComputedData.set(generatedId, computedData)

      setClientComputedData(computedData)
    }

    const unsubscribe = subscribe(treeMap, computeClientData)

    return () => {
      unsubscribe()
      treeComputedData.delete(generatedId)
    }
  }, dependencies.concat([computeData, treeMap]))

  const computedData = clientComputedData || serverComputedData

  return React.useMemo(() => {
    if (indexPathString === null) {
      return null
    }

    const indexPath = parseIndexPath(indexPathString)
    const maxIndex = maxIndexPath[maxIndexPath.length - 1]
    const index = indexPath[indexPath.length - 1]

    return {
      computed: computedData,
      generatedId,
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
  }, [indexPathString, maxIndexPath, treeMap, computedData])
}

/** Provide indexes and subscribe to descendant component data. */
export function useTree<Data extends Record<string, any>, ComputedData extends any>(
  children: React.ReactNode
) {
  const parentMaxIndexPath = React.useContext(MaxIndexContext)
  const parentIndexPathString = React.useContext(IndexContext)
  const treeCollection = React.useContext(TreeCollectionContext)
  const treeComputedData = React.useContext(TreeComputedDataContext)
  const treeMap = React.useContext(TreeMapContext)
  const treeMapRef = React.useRef<TreeMapContextValue>(null)
  const generatedId = React.useId().slice(1, -1)
  const isRoot = treeMap === null
  const childrenCount = React.Children.count(children)
  const maxIndexPath = React.useMemo(
    () => parentMaxIndexPath.concat(childrenCount - 1),
    [childrenCount]
  )

  /** Initiate this as the Map for index data if this is a top-level call. */
  if (treeMapRef.current === null) {
    if (isRoot) {
      treeMapRef.current = proxyMap()

      /** Capture the initial data in render when running on the server. */
      if (isServer) {
        treeCollection.set(generatedId, treeMapRef.current)
      }
    } else {
      treeMapRef.current = treeMap
    }
  }

  /** Update the top-level proxy Map that collects all trees. */
  useIsomorphicLayoutEffect(() => {
    if (isRoot) {
      treeCollection.set(generatedId, treeMapRef.current)
    }

    return () => {
      if (isRoot) {
        treeCollection.delete(generatedId)
      }
    }
  }, [isRoot, treeCollection])

  let childrenToRender = (
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

  if (isRoot) {
    childrenToRender = (
      <TreeMapContext.Provider value={treeMapRef.current}>
        {childrenToRender}
      </TreeMapContext.Provider>
    )
  }

  return {
    id: generatedId,
    children: childrenToRender,
    map: treeMapRef.current!,
    subscribe: React.useCallback((callback) => {
      let cleanup: null | (() => void) = null
      const handleUpdate = () => {
        cleanup?.()
        cleanup = callback(mapToTree(treeMapRef.current!))
      }
      const unsubscribe = subscribe(treeComputedData, handleUpdate)

      handleUpdate()

      return () => {
        cleanup?.()
        unsubscribe()
      }
    }, []),
  }
}
