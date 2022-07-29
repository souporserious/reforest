import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { clear, preload, suspend } from "suspend-react"
import { subscribe } from "valtio"
import { proxyMap } from "valtio/utils"

const DATA_ID = "__REFOREST_DATA__"
const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

type TreeMap = Map<string, any>

type RootTree = { data: any; treeMap: TreeMap | null }

type Tree = { children?: Tree[] } & { [key: string]: any }

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
if (!isServer) {
  const serverData = document.getElementById(DATA_ID)?.innerHTML

  if (serverData) {
    const treeCollection = JSON.parse(serverData)
    const allTreeValues = Object.values(treeCollection).flatMap((tree: Record<string, any>) =>
      Object.values(tree)
    )

    allTreeValues.forEach((data) => preload(async () => data, [data.id]))
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

  function stringifyTreeCollection() {
    let allData = {}

    treeCollection.forEach((tree, treeId) => {
      allData[treeId] = {}

      tree.treeMap?.forEach((data, key) => {
        allData[treeId][key] = data
      })
    })

    return JSON.stringify(allData)
  }

  return {
    TreeProvider,
    treeCollection,
    stringifyTreeCollection,
    getInitializerScript: () => {
      return `<script id="${DATA_ID}" type="application/json">${stringifyTreeCollection()}</script>`
    },
  }
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

/** Builds a tree from a Map of data collected in useTreeChildren. */
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
  onTreeUpdate: <UpdatedTree extends Tree>(
    trees: UpdatedTree[],
    treeCollection: Map<string, any>
  ) => void
) {
  const treeCollection = React.useContext(TreeCollectionContext)
  const tree = React.useContext(TreeMapContext)
  const onTreeUpdateRef = React.useRef<typeof onTreeUpdate>(onTreeUpdate)

  useIsomorphicLayoutEffect(() => {
    onTreeUpdateRef.current = onTreeUpdate
  })

  useIsomorphicLayoutEffect(() => {
    function buildIndexedTree() {
      const trees = Array.from(treeCollection.values()).map((tree) => ({
        ...tree.data,
        ...(tree.treeMap ? mapToTree(tree.treeMap) : { children: [] }),
      }))

      onTreeUpdateRef.current(trees, new Map(treeCollection))
    }

    /** Build initial index tree once children have rendered. */
    buildIndexedTree()

    /** Subscribe to future updates to indexed trees. */
    const treeCollectionCleanup = subscribe(treeCollection, buildIndexedTree)
    const treeCleanup = tree ? subscribe(tree, buildIndexedTree) : null

    return () => {
      treeCollectionCleanup()
      treeCleanup?.()
    }
  }, [treeCollection, tree])
}

/** Track initial component renders. */
let globalResolves: any[] = []
let globalTimeoutId: ReturnType<typeof setTimeout>

/**
 * Returns the index path data based on the closest useIndexedChildren.
 * Optionally attach data that can be retrieved in useIndexedChildren.
 */
export function useTreeData<Data extends Record<string, any>, ComputedData extends any>(
  data: Data | null = null,
  computeData?: (collectedData: Map<string, Data> | null, indexPathString: string) => ComputedData
) {
  const treeMap = React.useContext(TreeMapContext)
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const generatedId = React.useId().slice(1, -1)
  const parsedId = data?.id || generatedId
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

      /** Clear suspend-react cache when ids change. */
      clear([generatedId])
    }
  }, [treeMap, data, generatedId])

  /** Use Suspense to re-render the component before committing the final props. */
  const computedData = suspend(() => {
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
  }, [generatedId]) as ComputedData

  return React.useMemo(() => {
    if (indexPathString === null) {
      return null
    }

    const indexPath = parseIndexPath(indexPathString)
    const maxIndex = maxIndexPath[maxIndexPath.length - 1]
    const index = indexPath[indexPath.length - 1]

    return {
      computed: computedData,
      id: parsedId,
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

/** Provides the current index path for each child. */
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

  useIsomorphicLayoutEffect(() => {
    onUpdateRef.current = onUpdate
  })

  /** Initiate this as the Map for index data if this is a top-level call. */
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
    if (treeCollection) {
      treeCollection.set(rootId, {
        data,
        treeMap: treeMapRef.current,
      })
    }
  } else {
    treeMapRef.current = treeMap
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
        } as Data & { children: any[] }

        onUpdateRef.current(tree, new Map(treeMapRef.current))
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
    treeMap: new Map(treeMapRef.current),
  }
}
