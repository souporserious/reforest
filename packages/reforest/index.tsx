import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { preload, suspend } from "suspend-react"
import { subscribe } from "valtio"
import { proxyMap } from "valtio/utils"

const DATA_ID = "__REFOREST_DATA__"
const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

type TreeMap = Map<string, any>

type RootTree = { data: any; treeMap: TreeMap | null }

const RootIdContext = React.createContext<string | null>(null)

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
function cleanTree(tree: any) {
  if (tree.children && tree.children?.length > 0) {
    /** Sort children by the index path. */
    tree.children.sort((a, b) => parseFloat(a.indexPathString) - parseFloat(b.indexPathString))

    return {
      ...tree.data,
      generatedId: tree.generatedId,
      children: tree.children.map(cleanTree),
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
  const cleanedTree = cleanTree({ children: tree })

  return cleanedTree
}

/** Subscribe to all tree updates. */
export function useTreeEffect(
  /** A tree map to subscribe to. Must be a [proxyMap](https://valtio.pmnd.rs/docs/utils/proxyMap) from valtio. */
  treeMap: Map<string, any>,

  /** Updates when any tree data is changed and returns a nested tree array. */
  onTreeUpdate: (tree: ReturnType<typeof mapToTree>) => void
) {
  const onTreeUpdateRef = React.useRef<typeof onTreeUpdate>(onTreeUpdate)

  useIsomorphicLayoutEffect(() => {
    onTreeUpdateRef.current = onTreeUpdate
  })

  useIsomorphicLayoutEffect(() => {
    function handleTreeUpdate() {
      onTreeUpdateRef.current(mapToTree(treeMap))
    }

    /** Build initial tree once children have rendered. */
    handleTreeUpdate()

    /** Subscribe to future updates to tree. */
    return subscribe(treeMap, handleTreeUpdate)
  }, [treeMap])
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
  computeData?: (collectedData: Map<string, Data> | null, generatedId: string) => ComputedData
) {
  const treeMap = React.useContext(TreeMapContext)
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const generatedId = React.useId().slice(1, -1)
  const computeDataRef = React.useRef<typeof computeData>(computeData)

  useIsomorphicLayoutEffect(() => {
    computeDataRef.current = computeData
  })

  /** Capture the initial data when rendering on the server. */
  if (isServer && treeMap) {
    treeMap.set(generatedId, Object.assign({ indexPathString }, data))
  }

  /** Add and delete data in useLayoutEffect on the client. */
  useIsomorphicLayoutEffect(() => {
    if (data === null || treeMap === null) {
      return
    }

    treeMap.set(generatedId, Object.assign({ indexPathString }, data))

    return () => {
      treeMap.delete(generatedId)
    }
  }, [treeMap, data, generatedId])

  /** Use Suspense to re-render the component before committing the final props on the server and hydration **only**. */
  const isClientWithInitialData = !isServer && initialTreeCollectionIds !== null
  let serverComputedData: ComputedData | null = null

  if (isServer || isClientWithInitialData) {
    serverComputedData = suspend(
      () => {
        return new Promise((resolve) => {
          /** Keep clearing timeout until the last component renders. */
          clearTimeout(globalTimeoutId)

          /** Store all of the promises to compute. */
          globalResolves.push(() =>
            resolve(computeDataRef.current ? computeDataRef.current(treeMap, generatedId) : treeMap)
          )

          /** Push to the end of the event stack to allow all components to initially render. */
          globalTimeoutId = setTimeout(() => {
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
    if (treeMap === null || computeData === undefined) {
      return
    }

    function computeClientData() {
      setClientComputedData((currentComputedData) => {
        const computedData = computeData!(treeMap ? new Map(treeMap) : null, generatedId!)

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
export function useTree<Data extends Record<string, any>>(
  children: React.ReactNode,
  data: Data | null = null,
  onUpdate?: <UpdatedTree extends Data & { children: Data[] }>(
    tree: UpdatedTree,
    treeMap: Map<string, any>
  ) => void
) {
  const parentMaxIndexPath = React.useContext(MaxIndexContext)
  const parentIndexPathString = React.useContext(IndexContext)
  const treeCollection = React.useContext(TreeCollectionContext)
  const treeMap = React.useContext(TreeMapContext)
  const treeMapRef = React.useRef<TreeMapContextValue>(null)
  const parentRootId = React.useContext(RootIdContext)
  const generatedRootId = React.useId().slice(1, -1)
  const rootId = parentRootId || generatedRootId
  const isRoot = treeMap === null
  const childrenCount = React.Children.count(children)
  const maxIndexPath = React.useMemo(
    () => parentMaxIndexPath.concat(childrenCount - 1),
    [childrenCount]
  )
  const onUpdateRef = React.useRef<typeof onUpdate>(onUpdate)
  const previousStringifiedTree = React.useRef("")

  useIsomorphicLayoutEffect(() => {
    onUpdateRef.current = onUpdate
  })

  /** Initiate this as the Map for index data if this is a top-level call. */
  if (treeMapRef.current === null) {
    if (isRoot) {
      let initialEntries: [string, any][] = []

      /** Hydrate data if available in document head. */
      if (!isServer) {
        const serverData = document.getElementById(DATA_ID)?.innerHTML

        if (rootId && serverData) {
          const serverComputedData = JSON.parse(serverData)[rootId]

          if (serverComputedData) {
            initialEntries = Object.entries(serverComputedData)
          }
        }
      }

      treeMapRef.current = proxyMap(initialEntries)

      /** Capture the initial data in render when running on the server. */
      if (isServer) {
        treeCollection.set(rootId, {
          data,
          treeMap: treeMapRef.current,
        })
      }
    } else {
      treeMapRef.current = treeMap
    }
  }

  /** Update the top-level proxy Map of all index trees. */
  useIsomorphicLayoutEffect(() => {
    if (isRoot) {
      treeCollection.set(rootId, {
        data,
        treeMap: treeMapRef.current,
      })
    }

    return () => {
      if (isRoot) {
        treeCollection.delete(rootId)
      }
    }
  }, [isRoot, rootId, data, treeCollection])

  /** Optionally subscribe to this trees data changes. */
  useIsomorphicLayoutEffect(() => {
    if (onUpdateRef.current === undefined) {
      return
    }

    function buildTree() {
      if (treeMapRef.current && onUpdateRef.current) {
        const tree = {
          ...(data || {}),
          ...mapToTree(treeMapRef.current),
        } as Data & { children: Data[] }
        const nextStringifiedTree = JSON.stringify(tree, null, 2)

        if (previousStringifiedTree.current !== nextStringifiedTree) {
          onUpdateRef.current(tree, new Map(treeMapRef.current))

          previousStringifiedTree.current = nextStringifiedTree
        }
      }
    }

    /** Build initial index tree once children have rendered. */
    buildTree()

    /** Subscribe to future updates to tree. */
    if (treeMapRef.current) {
      return subscribe(treeMapRef.current, buildTree)
    }
  }, [treeMap])

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
      <RootIdContext.Provider value={rootId}>
        <TreeMapContext.Provider value={treeMapRef.current}>
          {childrenToRender}
        </TreeMapContext.Provider>
      </RootIdContext.Provider>
    )
  }

  return {
    children: childrenToRender,
    treeMap: treeMapRef.current,
  }
}
