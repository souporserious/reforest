import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { preload, suspend } from "suspend-react"
import { ref, subscribe } from "valtio"
import { proxyMap, proxyWithComputed } from "valtio/utils"

const DATA_ID = "__REFOREST_DATA__"
const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

const MaxIndexContext = React.createContext<number[]>([])

MaxIndexContext.displayName = "MaxIndexContext"

const IndexContext = React.createContext<string | null>(null)

IndexContext.displayName = "IndexContext"

export type TreeStateContextValue = {
  map: Map<string, any>
  computedUpdateCount: number
  computed: any | null
} | null

export const TreeStateContext = React.createContext<TreeStateContextValue>(null)

TreeStateContext.displayName = "TreeStateContext"

export const TreeCollectionContext = React.createContext<Map<string, TreeStateContextValue>>(
  proxyMap<string, TreeStateContextValue>()
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

  return new Map(serverEntries)
}

export const TreeComputedDataContext = React.createContext<Map<string, any>>(
  getInitialTreeComputedData()
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

  treeCollection.forEach((treeState, treeId) => {
    allData[treeId] = {}

    treeState.map.forEach((data, key) => {
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
  const treeCollection = proxyMap<string, TreeStateContextValue>(initialEntries)
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
  const treeCollectionContextValue = React.useRef<Map<string, TreeStateContextValue> | null>(null)
  const treeComputedDataContextValue = React.useRef<Map<string, any> | null>(null)

  if (treeCollectionContextValue.current === null) {
    /** TODO: add support for initial tree collection from script tag */

    treeCollectionContextValue.current = proxyMap<string, TreeStateContextValue>(
      initialTreeCollectionEntries
    )
  }

  if (treeComputedDataContextValue.current === null) {
    const serverEntries = getInitialTreeComputedData()

    treeComputedDataContextValue.current = new Map<string, any>(
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

  useIsomorphicLayoutEffect(() => {
    onUpdateRef.current = onUpdate
  })

  useIsomorphicLayoutEffect(() => {
    function handleTreeUpdate() {
      cleanupRef.current?.()
      cleanupRef.current = onUpdateRef.current(mapToTree(treeMap))
    }

    /** Build initial tree once children have rendered. */
    handleTreeUpdate()

    /** Subscribe to future updates to tree. */
    const cleanupSubscription = subscribe(treeMap, handleTreeUpdate)

    return () => {
      cleanupSubscription()
      cleanupRef.current?.()
      cleanupRef.current = null
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
  const treeState = React.useContext(TreeStateContext)
  const treeComputedData = React.useContext(TreeComputedDataContext)
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const generatedId = React.useId().slice(1, -1)
  const computeDataRef = React.useRef<typeof computeData>(computeData)

  useIsomorphicLayoutEffect(() => {
    computeDataRef.current = computeData
  })

  /** Capture the initial data when rendering on the server. */
  if (isServer && treeState) {
    treeState.map.set(generatedId, Object.assign({ generatedId, indexPathString }, data))
  }

  /** Add and delete data in useLayoutEffect on the client. */
  useIsomorphicLayoutEffect(() => {
    if (data === null || treeState === null) {
      return
    }

    /** Wrap tree data in ref to prevent it from being proxied. */
    const treeData = ref(Object.assign({ generatedId, indexPathString }, data))

    treeState.map.set(generatedId, treeData)

    return () => {
      treeState.map.delete(generatedId)
    }
  }, [treeState, data, generatedId])

  /** Use Suspense to re-render the component before committing the final props on the server and hydration **only**. */
  const isServerWithComputedData = isServer && computeData !== undefined
  let serverComputedData: ComputedData | null = null

  if (treeState !== null && isServerWithComputedData) {
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
                    map: sortMapByIndexPath(treeState.map),
                    computed: (treeState as any)?.computed,
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
    treeComputedData.set(generatedId, serverComputedData)
  } else {
    serverComputedData = treeComputedData.get(generatedId)
  }

  /** Listen for store changes and compute props before rendering to the screen on client. */
  const [clientComputedData, setClientComputedData] = React.useState<ComputedData | null>(null)
  const previousStringifiedComputedData = React.useRef("")

  useIsomorphicLayoutEffect(() => {
    if (computeData === undefined || treeState === null) {
      return
    }

    function computeClientData() {
      setClientComputedData((currentComputedData) => {
        const computedTreeData = (treeState as any)?.computed

        if (computedTreeData === undefined) {
          treeComputedData.set(generatedId, currentComputedData)

          return currentComputedData
        }

        const treeData = {
          map: sortMapByIndexPath(treeState!.map),
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

    const unsubscribe = subscribe(treeState, computeClientData)

    return () => {
      unsubscribe()
    }
  }, [computeData, treeState, generatedId])

  useIsomorphicLayoutEffect(() => {
    /** Store computed data so it can be retrieved in useTreeEffect. */
    treeComputedData.set(generatedId, clientComputedData)

    return () => {
      treeComputedData.delete(generatedId)
    }
  }, [clientComputedData, generatedId])

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
  }, [indexPathString, maxIndexPath, treeState, computedData])
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
  const treeState = React.useContext(TreeStateContext)
  const treeStateRef = React.useRef<TreeStateContextValue>(null)
  const generatedId = React.useId().slice(1, -1)
  const isRoot = treeState === null
  const childrenCount = React.Children.count(children)
  const maxIndexPath = React.useMemo(
    () => parentMaxIndexPath.concat(childrenCount - 1),
    [childrenCount]
  )
  const computeDataRef = React.useRef<typeof computeData>(computeData)

  if (computeData && !isRoot) {
    throw new Error("Computing data is currently only supported in the root useTree hook.")
  }

  /** Initiate this as the Map for index data if this is a top-level call. */
  if (treeStateRef.current === null) {
    if (isRoot) {
      treeStateRef.current = proxyWithComputed<
        { map: Map<string, any>; computedUpdateCount: number },
        { computed: any }
      >(
        {
          map: proxyMap(),

          /**
           * Tracks when computeData updates in order to cause the computed property
           * to change and pick up the updated computeData callback. This is essentially
           * a hack since functions can't be stored as proxy state.
           */
          computedUpdateCount: 0,
        },
        {
          computed: (snapshot) => {
            return computeDataRef.current ? computeDataRef.current(snapshot.map, generatedId) : null
          },
        }
      )

      /** Capture the initial data in render when running on the server. */
      if (isServer) {
        treeCollection.set(generatedId, treeStateRef.current)
      }
    } else {
      treeStateRef.current = treeState
    }
  }

  /** Sync computeData callback updates to proxy state. */
  useIsomorphicLayoutEffect(() => {
    const treeState = treeStateRef.current

    if (isRoot && treeState) {
      computeDataRef.current = computeData
      treeState.computedUpdateCount++
    }
  }, [computeData])

  /** Update the top-level proxy Map that collects all trees. */
  useIsomorphicLayoutEffect(() => {
    if (isRoot) {
      treeCollection.set(generatedId, treeStateRef.current)
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
      <TreeStateContext.Provider value={treeStateRef.current}>
        {childrenToRender}
      </TreeStateContext.Provider>
    )
  }

  return {
    id: generatedId,
    children: childrenToRender,
    state: treeStateRef.current,
  }
}
