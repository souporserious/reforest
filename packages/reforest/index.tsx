import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { preload, suspend } from "suspend-react"
import { proxy, subscribe } from "valtio"
import { proxyMap } from "valtio/utils"

const DATA_ID = "__REFOREST_DATA__"
const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

type TreeMap = Map<string, any>

type RootTree = { data: any; treeMap: TreeMap | null }

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

export type TreeComputedDataContextValue<ComputedData extends any = any> = {
  computed: ComputedData | null
  compute: () => void
}

const TreeComputedDataContext = React.createContext<TreeComputedDataContextValue | null>(null)

TreeComputedDataContext.displayName = "TreeComputedDataContext"

/** Preload available data when first loading client. */
let initialTreeCollectionIds: string[] | null = null

if (!isServer) {
  const serverData = document.getElementById(DATA_ID)?.innerHTML

  if (serverData) {
    const treeCollection = JSON.parse(serverData)

    const initialTreeCollectionEntries = Object.values(treeCollection).flatMap(
      (tree: Record<string, any>) => Object.entries(tree)
    )

    initialTreeCollectionIds = initialTreeCollectionEntries.map(([id]) => id)

    initialTreeCollectionEntries.forEach(([, data]) => preload(async () => data, [data.id]))
  }
}

/**
 * Parses a numerical dot-separated string as an index path.
 *
 * @example
 * parseIndexPath('0.10.2') -> [0, 10, 2]
 */
export function parseIndexPath(indexPathString: string) {
  return indexPathString.split(".").map((index) => parseInt(index, 10))
}

/** Stringifys a tree map. */
export function stringifyTreeCollection(treeCollection: Map<string, any>) {
  let allData = {}

  treeCollection.forEach((tree, treeId) => {
    allData[treeId] = {}

    tree.treeMap?.forEach((data, key) => {
      allData[treeId][key] = data
    })
  })

  return JSON.stringify(allData)
}

/** Wraps a tree with a Map for gathering indexed data on the server. */
export function createTreeProvider(initialEntries?: [string, any][]) {
  const treeCollection = proxyMap<string, RootTree>(initialEntries)

  function TreeProvider(props: { children: React.ReactNode }) {
    return (
      <TreeCollectionContext.Provider value={treeCollection}>
        {props.children}
      </TreeCollectionContext.Provider>
    )
  }

  return {
    TreeProvider,
    treeCollection,
    stringifyTreeCollection: () => stringifyTreeCollection(treeCollection),
    getInitializerScript: () =>
      `<script id="${DATA_ID}" type="application/json">${stringifyTreeCollection(
        treeCollection
      )}</script>`,
  }
}

/** Provides a tree collection for subscribing to all tree data on the client, see [createTreeProvider] for rendering on the server. */
export function TreeProvider({
  children,
  initialEntries,
}: {
  children: React.ReactNode
  initialEntries?: [string, any][]
}) {
  const treeCollection = React.useContext(TreeCollectionContext)
  const treeCollectionContextValue = React.useRef<Map<string, RootTree> | null>(null)

  if (treeCollectionContextValue.current === null) {
    if (initialEntries) {
      treeCollectionContextValue.current = proxyMap<string, RootTree>(initialEntries)
    } else {
      treeCollectionContextValue.current = treeCollection
    }
  }

  return (
    <TreeCollectionContext.Provider value={treeCollectionContextValue.current}>
      {children}
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
      generatedId: tree.generatedId,
      children: tree.children.map(cleanAndSortTree),
    }
  }

  return tree.data
}

/** Builds a tree from a Map of data collected in useTree. */
export function mapToTree(dataMap: Map<string, any>) {
  const parsedValues = Array.from(dataMap.entries()).map(([generatedId, data]) => {
    const parentIndexPathString = parseIndexPath(data.indexPathString).slice(0, -1).join(".")

    return {
      data,
      generatedId,
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
  const isClientWithInitialData = !isServer && initialTreeCollectionIds !== null
  let serverComputedData: ComputedData | null = null

  if (treeMap !== null && (isServer || isClientWithInitialData)) {
    serverComputedData = suspend(
      () => {
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
                      computed: treeComputedData?.computed,
                    },
                    generatedId
                  )
                : null
            )
          )

          /** Push to the end of the event stack to allow all components to initially render. */
          globalTimeoutId = setTimeout(() => {
            /** Resolve all of the leaf promises now that we have stored and computed all data. */
            globalResolves.forEach((resolve) => resolve())
            globalResolves = []
          })
        })
      },
      [generatedId],
      {
        /** Hack the equality function to only run once on the client and not forever infinite loop since React.useId changes. */
        equal(a, b) {
          const aIndex = initialTreeCollectionIds?.indexOf(a)
          const bIndex = initialTreeCollectionIds?.indexOf(b)

          return a === b || aIndex === -1 || bIndex === -1
        },
      }
    ) as ComputedData
  }

  /** Listen for store changes and compute props before rendering to the screen on client. */
  const [clientComputedData, setClientComputedData] = React.useState<ComputedData | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (computeData === undefined || treeMap === null) {
      return
    }

    function computeClientData() {
      setClientComputedData((currentComputedData) => {
        const computedData = computeData!(
          {
            map: sortMapByIndexPath(treeMap!),
            computed: treeComputedData?.computed,
          },
          generatedId
        )

        if (JSON.stringify(currentComputedData) === JSON.stringify(computedData)) {
          return currentComputedData
        }

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
  const data = null
  const parentMaxIndexPath = React.useContext(MaxIndexContext)
  const parentIndexPathString = React.useContext(IndexContext)
  const treeCollection = React.useContext(TreeCollectionContext)
  const treeMap = React.useContext(TreeMapContext)
  const treeMapRef = React.useRef<TreeMapContextValue>(null)
  const treeComputedDataRef = React.useRef<TreeComputedDataContextValue | null>(null)
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
      let initialEntries: [string, any][] = []

      /** Hydrate data if available in document head. */
      if (!isServer) {
        const serverData = document.getElementById(DATA_ID)?.innerHTML

        if (generatedId && serverData) {
          const serverComputedData = JSON.parse(serverData)[generatedId]

          if (serverComputedData) {
            initialEntries = Object.entries(serverComputedData)
          }
        }
      }

      treeMapRef.current = proxyMap(initialEntries)

      /** Computed data allows leaf useTreeData calls to use a single computed source. */
      const treeComputedData = proxy<TreeComputedDataContextValue<ComputedData>>({
        computed: null,
        compute: () => {
          const computedData = computeDataRef.current
            ? computeDataRef.current(treeMapRef.current!, generatedId)
            : null

          treeComputedData!.computed = computedData
        },
      })

      treeComputedDataRef.current = treeComputedData

      /** Capture the initial data in render when running on the server. */
      if (isServer) {
        treeCollection.set(generatedId, {
          data,
          treeMap: treeMapRef.current,
        })
      }
    } else {
      treeMapRef.current = treeMap
    }
  }

  useIsomorphicLayoutEffect(() => {
    if (!isRoot || treeMapRef.current === null) {
      return
    }

    function handleUpdate() {
      treeComputedDataRef.current?.compute()
    }

    handleUpdate()

    return subscribe(treeMapRef.current, handleUpdate)
  }, [])

  /** Update the top-level proxy Map that collects all trees. */
  useIsomorphicLayoutEffect(() => {
    if (isRoot) {
      treeCollection.set(generatedId, {
        data,
        treeMap: treeMapRef.current,
      })
    }

    return () => {
      if (isRoot) {
        treeCollection.delete(generatedId)
      }
    }
  }, [isRoot, generatedId, data, treeCollection])

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
          <TreeComputedDataContext.Provider value={treeComputedDataRef.current}>
            {childrenToRender}
          </TreeComputedDataContext.Provider>
        </TreeMapContext.Provider>
      </RootIdContext.Provider>
    )
  }

  return {
    id: generatedId,
    children: childrenToRender,
    map: treeMapRef.current,
    computed: treeComputedDataRef.current,
  }
}
