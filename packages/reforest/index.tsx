import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { preload, suspend } from "suspend-react"
import { subscribe } from "valtio"

import { proxyMap } from "./proxyMap"

const DATA_ID = "__REFOREST_DATA__"
const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

type TreeMap = Map<string, any>

type RootTree = TreeMap | null

const RootIdContext = React.createContext<string | null>(null)

RootIdContext.displayName = "RootIdContext"

const MaxIndexContext = React.createContext<number[]>([])

MaxIndexContext.displayName = "MaxIndexContext"

const IndexContext = React.createContext<string | null>(null)

IndexContext.displayName = "IndexContext"

export const TreeCollectionContext = React.createContext<Map<string, RootTree>>(
  proxyMap<string, RootTree>()
)

TreeCollectionContext.displayName = "TreeCollectionContext"

export type TreeMapContextValue = Map<string, any> | null

export const TreeMapContext = React.createContext<TreeMapContextValue>(null)

TreeMapContext.displayName = "TreeMapContext"

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

  return serverEntries
}

const initialTreeComputedData = getInitialTreeComputedData()

export const TreeComputedDataContext = React.createContext<Map<string, any> | null>(
  initialTreeComputedData.length > 0 ? new Map(initialTreeComputedData) : null
)

TreeComputedDataContext.displayName = "TreeComputedDataContext"

/** Preloads available data when on the client. */
export function preloadClientData() {
  if (!isServer) {
    const serverData = document.getElementById(DATA_ID)?.innerHTML

    if (serverData) {
      const treeComputedData = JSON.parse(serverData)

      Object.entries(treeComputedData).forEach(([key, value]) => {
        preload(async () => value, [key])
      })
    }
  }
}

preloadClientData()

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
  const treeCollection = proxyMap<string, RootTree>(initialEntries)
  const treeComputedData = new Map<string, any>()

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
  const treeCollectionContext = React.useContext(TreeCollectionContext)
  const treeCollectionContextValue = React.useRef<Map<string, RootTree> | null>(null)
  const treeComputedDataContext = React.useContext(TreeComputedDataContext)
  const treeComputedDataContextValue = React.useRef<Map<string, any> | null>(null)

  if (treeCollectionContext === null && treeCollectionContextValue.current === null) {
    /** TODO: add support for initial tree collection from script tag */

    treeCollectionContextValue.current = proxyMap<string, RootTree>(initialTreeCollectionEntries)
  }

  if (treeComputedDataContext === null && treeComputedDataContextValue.current === null) {
    const serverEntries = getInitialTreeComputedData()

    treeComputedDataContextValue.current = new Map<string, any>(
      initialTreeComputedDataEntries || serverEntries
    )
  }

  return (
    <TreeCollectionContext.Provider
      value={treeCollectionContext || treeCollectionContextValue.current}
    >
      <TreeComputedDataContext.Provider
        value={treeComputedDataContext || treeComputedDataContextValue.current}
      >
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

/** Subscribe to tree updates. */
export function useTreeEffect(
  /** A tree map to subscribe to. Must be a [proxyMap](https://valtio.pmnd.rs/docs/utils/proxyMap) from valtio. */
  treeMap: Map<string, any>,

  /** Updates when any tree data is changed and returns a nested tree array. */
  onUpdate: (tree: ReturnType<typeof mapToTree>) => void | (() => void),

  /** Dependencies for the effect. */
  dependencies: any[] = []
) {
  const onUpdateRef = React.useRef<typeof onUpdate>(onUpdate)
  const cleanupRef = React.useRef<ReturnType<typeof onUpdate> | null>(null)
  const previousStringifiedTree = React.useRef("")

  useIsomorphicLayoutEffect(() => {
    onUpdateRef.current = onUpdate
  })

  useIsomorphicLayoutEffect(() => {
    function handleTreeUpdate() {
      if (onUpdateRef.current) {
        let treeData = {}

        treeMap.forEach((data, key) => {
          treeData[key] = data
        })

        const nextStringifiedTree = JSON.stringify(treeData)

        if (previousStringifiedTree.current !== nextStringifiedTree) {
          cleanupRef.current = onUpdateRef.current(mapToTree(treeMap))

          previousStringifiedTree.current = nextStringifiedTree
        }
      }
    }

    /** Build initial tree once children have rendered. */
    handleTreeUpdate()

    /** Subscribe to future updates to tree. */
    const cleanupSubscription = subscribe(treeMap, handleTreeUpdate)

    return () => {
      cleanupSubscription()
      cleanupRef.current?.()
    }
  }, dependencies.concat(treeMap))
}

/** Track initial component renders. */
let globalResolves: any[] = []
let globalTimeoutId: ReturnType<typeof setTimeout>

/**
 * Returns the current index and optional computed data based on the closest useTree.
 * Attached data can be retrieved in useTree or useTreeEffect.
 */
export function useTreeData<Data extends Record<string, any>, ComputedData extends any>(
  data: Data | null = null,
  computeData?: (
    tree: {
      map: Map<string, { generatedId: string; indexPathString: string } & Data> | null
      computed: any
    },
    generatedId: string
  ) => ComputedData
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

    treeMap.set(generatedId, Object.assign({ generatedId, indexPathString }, data))

    return () => {
      treeMap.delete(generatedId)
    }
  }, [treeMap, data, generatedId])

  /** Use Suspense to re-render the component before committing the final props on the server and hydration **only**. */
  const isServerWithComputedData = isServer && computeData !== undefined
  let serverComputedData: ComputedData | null = null

  if (treeMap !== null && isServerWithComputedData) {
    serverComputedData = suspend(() => {
      return new Promise((resolve) => {
        /** Keep clearing timeout until the last component renders. */
        clearTimeout(globalTimeoutId)

        /** Store all of the promises to compute. */
        globalResolves.push(() =>
          resolve(
            computeDataRef.current
              ? computeDataRef.current(
                  {
                    map: sortMapByIndexPath(treeMap),
                    computed: (treeMap as any)?.computed,
                  },
                  generatedId
                )
              : null
          )
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
    treeComputedData?.set(generatedId, serverComputedData)
  } else {
    serverComputedData = treeComputedData?.get(generatedId)
  }

  /** Listen for store changes and compute props before rendering to the screen on client. */
  const [clientComputedData, setClientComputedData] = React.useState<ComputedData | null>(null)
  const previousStringifiedComputedData = React.useRef("")

  useIsomorphicLayoutEffect(() => {
    if (computeData === undefined || treeMap === null) {
      return
    }

    function computeClientData() {
      setClientComputedData((currentComputedData) => {
        const computedTreeData = (treeMap as any)?.computed

        if (computedTreeData === undefined) {
          return currentComputedData
        }

        const treeData = {
          map: sortMapByIndexPath(treeMap!),
          computed: computedTreeData,
        }
        const computedData = computeData!(treeData, generatedId)
        const nextStringifiedComputedData = JSON.stringify(computedData)

        if (previousStringifiedComputedData.current === nextStringifiedComputedData) {
          return currentComputedData
        }

        previousStringifiedComputedData.current = nextStringifiedComputedData

        return computedData
      })
    }

    computeClientData()

    return subscribe(treeMap, computeClientData)
  }, [computeData, treeMap, generatedId])

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
  children: React.ReactNode,
  computeData?: (
    treeMap: Map<string, { generatedId: string; indexPathString: string } & Data>,
    rootId: string
  ) => ComputedData
) {
  const parentMaxIndexPath = React.useContext(MaxIndexContext)
  const parentIndexPathString = React.useContext(IndexContext)
  const treeCollection = React.useContext(TreeCollectionContext)
  const treeMap = React.useContext(TreeMapContext)
  const treeMapRef = React.useRef<TreeMapContextValue>(null)
  const contextRootId = React.useContext(RootIdContext)
  const initialRootId = React.useId().slice(1, -1)
  const generatedId = contextRootId || initialRootId
  const isRoot = treeMap === null
  const childrenCount = React.Children.count(children)
  const maxIndexPath = React.useMemo(
    () => parentMaxIndexPath.concat(childrenCount - 1),
    [childrenCount]
  )
  const computeDataRef = React.useRef<typeof computeData>(computeData)

  if (computeData && !isRoot) {
    throw new Error("Computing data is currently only supported in the root useTree hook.")
  }

  useIsomorphicLayoutEffect(() => {
    computeDataRef.current = computeData
  })

  /** Initiate this as the Map for index data if this is a top-level call. */
  if (treeMapRef.current === null) {
    if (isRoot) {
      treeMapRef.current = proxyMap([], {
        /** TODO: for some reason proxy-memoize wasn't working here, should look into optimizing this call if possible. */
        computed: (snap) => {
          return computeDataRef.current ? computeDataRef.current(snap, generatedId) : null
        },
      })

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
  }, [isRoot, generatedId, treeCollection])

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
      <RootIdContext.Provider value={generatedId}>
        <TreeMapContext.Provider value={treeMapRef.current}>
          {childrenToRender}
        </TreeMapContext.Provider>
      </RootIdContext.Provider>
    )
  }

  return {
    id: generatedId,
    children: childrenToRender,
    map: treeMapRef.current,
  }
}
