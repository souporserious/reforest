import * as React from "react"
import { arrayToTree } from "performant-array-to-tree"
import { suspend } from "suspend-react"
import { subscribe } from "valtio"
import { proxyMap } from "valtio/utils"

const isServer = typeof window === "undefined"
const useIsomorphicLayoutEffect = isServer ? React.useEffect : React.useLayoutEffect

type IndexMap = Map<string, any>

type RootTree = { data: any; indexMap: IndexMap | null }

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
export function createTreeProvider() {
  const treeCollection = proxyMap<string, RootTree>()

  function TreeProvider(props: { children: React.ReactNode }) {
    return (
      <TreeCollectionContext.Provider value={treeCollection}>
        <React.Suspense fallback={null}>{props.children}</React.Suspense>
      </TreeCollectionContext.Provider>
    )
  }

  return {
    TreeProvider,
    treeCollection,
    getTreeCollection: () => {
      let allData = {}

      treeCollection.forEach((tree, treeId) => {
        allData[treeId] = {}

        tree.indexMap?.forEach((data, key) => {
          allData[treeId][key] = data
        })
      })

      return JSON.stringify(allData)
    },
  }
}

/** Recursive function that removes "id" and "parentId" keys and returns each indexed data. */
function cleanTree(tree: any) {
  if (tree.children && tree.children?.length > 0) {
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
    const parentIndexPathString = parseIndexPath(data.indexPathString.toString())
      .slice(0, -1)
      .join(".")

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
        children: tree.indexMap ? mapToTree(tree.indexMap) : [],
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

/**
 * Returns the index path data based on the closest useIndexedChildren.
 * Optionally attach data that can be retrieved in useIndexedChildren.
 */
export function useTreeData<Data extends Record<string, any>, ComputedData extends any>(
  data: Data | null = null,
  computeData?: (collectedData: [string, Data][] | null, indexPathString: string) => ComputedData
) {
  const treeMap = React.useContext(TreeMapContext)
  const maxIndexPath = React.useContext(MaxIndexContext)
  const indexPathString = React.useContext(IndexContext)
  const generatedId = React.useId().slice(1, -1)
  const parsedId = data?.id || generatedId

  /** Capture the initial data when rendering on the server. */
  /** TODO: this is where we can set initial data? We should only do this ONCE */
  /** react strict mode re-renders  */
  if (isServer && treeMap) {
    treeMap.set(generatedId, data)
  }

  /** Add and delete data in useLayoutEffect on the client. */
  useIsomorphicLayoutEffect(() => {
    if (data === null || treeMap === null) {
      return
    }

    treeMap.set(generatedId, data)

    return () => {
      treeMap.delete(generatedId)
    }
  }, [treeMap, data, generatedId])

  /** Use Suspense on the server to re-render the component before committing the final props. */
  // let initialComputedData: ComputedData | null = null

  // if (computeData && indexedData && indexPathString) {
  //   initialComputedData = suspend(() => {
  //     return new Promise((resolve) => {
  //       /** Wait one tick to allow all components to initially render. */
  //       setTimeout(() => {
  //         /** Now the collected data is available for computing. */
  //         const indexedDataEntries = indexedData ? Array.from(indexedData.entries()) : []

  //         const computedData = computeData
  //           ? computeData(indexedDataEntries, indexPathString)
  //           : indexedDataEntries

  //         resolve(computedData)
  //       })
  //     })
  //   }, [indexPathString]) as any
  // }

  /** Listen for store changes and compute props before rendering to the screen. */
  // const [computedData, setComputedData] = React.useState<ComputedData | null>(initialComputedData)

  // function computeClientData() {
  //   if (indexPathString === null || computeData === undefined) {
  //     return
  //   }

  //   const indexedDataEntries = indexedData ? Array.from(indexedData.entries()) : []
  //   const computedData = computeData(indexedDataEntries, indexPathString)

  //   setComputedData((currentComputedData) => {
  //     return JSON.stringify(computedData) === JSON.stringify(currentComputedData)
  //       ? currentComputedData
  //       : computedData
  //   })
  // }

  // useIsomorphicLayoutEffect(() => {
  //   if (indexedData === null || indexPathString === null || computeData === undefined) {
  //     return
  //   }

  //   return subscribe(indexedData, computeClientData)
  // }, [computeData, indexedData])

  return React.useMemo(() => {
    if (indexPathString === null) {
      return null
    }

    const indexPath = parseIndexPath(indexPathString)
    const maxIndex = maxIndexPath[maxIndexPath.length - 1]
    const index = indexPath[indexPath.length - 1]

    return {
      id: parsedId,
      generatedId,
      // computedData,
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
  }, [indexPathString, maxIndexPath, treeMap])
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
  const generatedRootId = React.useId()
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
    // if (!isServer) {
    //   const serverData = document.getElementById("reforest")?.innerHTML

    //   if (rootId && serverData) {
    //     const serverComputedData = JSON.parse(serverData)[rootId]

    //     if (serverComputedData) {
    //       initialEntries = Object.entries(serverComputedData)
    //     }
    //   }
    // }

    treeMapRef.current = proxyMap(initialEntries)

    /** Capture the initial data in render when running on the server. */
    if (treeCollection) {
      treeCollection.set(rootId, {
        data,
        indexMap: treeMapRef.current,
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
        indexMap: treeMapRef.current,
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
          children: mapToTree(treeMapRef.current),
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
  }
}
