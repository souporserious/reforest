"use client"
import * as React from "react"
import type { LayoutNode, LeafNode } from "@jsxui/layout"
import {
  computeLayout,
  createNode,
  createSpace,
  flattenLayout,
  layoutTypeFactories,
} from "@jsxui/layout"
import type { TreeStateStore } from "reforest"
import {
  mapToChildren,
  useTree,
  useTreeNode,
  useTreeId,
  useTreeState,
  usePrerender,
} from "reforest"
import { capitalCase } from "case-anything"
import flattenChildren from "react-keyed-flatten-children"

export const RootNodeContext = React.createContext<Partial<LayoutNode> | null>(null)

RootNodeContext.displayName = "RootNodeContext"

export const GridContext = React.createContext<{
  columnUnit: number
  columnSpaceUnit: number
  rowUnit: number
  rowSpaceUnit: number
  baseUnit?: "width" | "height" | "minimum" | number
  columns: number | undefined
  rows: number | undefined
  space: number
  debug: boolean
} | null>(null)

GridContext.displayName = "GridContext"

export function useGrid() {
  const gridContext = React.useContext(GridContext)

  if (gridContext === null) {
    throw new Error(
      "The useGrid hook must be used in a descendant component of Grid, Column, or Row."
    )
  }

  return gridContext
}

export type GridDimensions = Partial<Pick<LayoutNode, "width" | "height" | "weight">>

export type GridProps = {
  /** Unique identifier for the grid. */
  id?: string

  /** Adds grid lines and colors to more easily visualize and debug position and spacing. */
  debug?: boolean

  /** Main relative value each grid unit is based on. */
  baseUnit?: "width" | "height" | "minimum" | number

  /** Number of horizontal divisions of the available space. */
  columns?: number | undefined

  /** Number of vertical divisions of the available space. */
  rows?: number | undefined

  /** Amount of space between each column and row. */
  space?: number

  /** Any valid React element. Only layout and leaf nodes will be counted towards the computed layout. */
  children: React.ReactNode

  /** Active variations for this component and its descendants. */
  variants?: any

  /** Allows control of the tree state for intropsection and computing data based on layout. */
  treeState?: TreeStateStore | undefined
}

function roundValue(value: number) {
  return Math.round(value * 10000) / 10000
}

function RootGrid({
  baseUnit = "minimum",
  debug = false,
  children,
  space = 0,
  node,
}: Omit<GridProps, "columns" | "rows"> & { node: Partial<LayoutNode> }) {
  const { columns, rows } = node
  const generatedId = React.useId().slice(1, -1)
  const parsedId = node.id || generatedId
  const gridContextValue = React.useMemo(
    () => ({
      columnUnit: roundValue(100 / columns!),
      columnSpaceUnit: roundValue(((columns! - 1) * space) / columns!),
      rowUnit: roundValue(100 / rows!),
      rowSpaceUnit: roundValue(((rows! - 1) * space) / rows!),
      baseUnit,
      columns,
      rows,
      space,
      debug,
    }),
    [baseUnit, columns, rows, space, debug]
  )
  const rootNodeContextValue = React.useMemo(
    () => layoutTypeFactories[node.type!](node),
    Object.values(node)
  )
  const baseUnitModes = {
    width: "var(--column-unit)",
    height: "var(--row-unit)",
    minimum: "min(var(--column-unit), var(--row-unit))",
  } as const
  const columnUnit =
    gridContextValue.columnSpaceUnit === 0
      ? `${gridContextValue.columnUnit}vw`
      : `calc(${gridContextValue.columnUnit}vw - ${gridContextValue.columnSpaceUnit}px)`
  const rowUnit =
    gridContextValue.rowSpaceUnit === 0
      ? `${gridContextValue.rowUnit}vh`
      : `calc(${gridContextValue.rowUnit}vh - ${gridContextValue.rowSpaceUnit}px)`
  const style = {
    "--column-unit": columnUnit,
    "--row-unit": rowUnit,
    "--base-unit": typeof baseUnit === "number" ? baseUnit : baseUnitModes[baseUnit],
    "--space-unit": `${space}px`,
    "--width": columns!,
    "--height": rows!,
    margin: "auto",
  }

  return (
    <div id={parsedId} className={capitalCase(node.type!)} style={style}>
      <GridContext.Provider value={gridContextValue}>
        <RootNodeContext.Provider value={rootNodeContextValue}>{children}</RootNodeContext.Provider>
      </GridContext.Provider>
    </div>
  )
}

function SubGrid({ children, node }: { children: React.ReactNode; node: Partial<LayoutNode> }) {
  const treeId = useTreeId()

  useTreeNode(treeId, () => layoutTypeFactories[node.type!](node), Object.values(node))

  return <>{children}</>
}

export function useGridProps(
  node: Partial<LayoutNode>,
  { baseUnit = "minimum", debug = false, space = 0, children, treeState }: GridProps
) {
  const tree = useTree(flattenChildren(children), treeState)

  /** Render a top-level grid if a layout has not been defined yet. */
  if (tree.isRoot) {
    return (
      <RootGrid node={node} baseUnit={baseUnit} debug={debug} space={space}>
        {tree.children}
      </RootGrid>
    )
  }

  return <SubGrid node={node}>{tree.children}</SubGrid>
}

export function Grid({
  id,
  columns,
  rows,
  width,
  height,
  weight,
  ...restProps
}: GridProps & GridDimensions) {
  const gridContext = React.useContext(GridContext)

  if (columns === undefined && gridContext === null) {
    columns = 1
  }

  if (rows === undefined && gridContext === null) {
    rows = 1
  }

  return useGridProps(
    {
      type: "grid",
      id,
      columns,
      rows,
      width,
      height,
      weight,
    },
    restProps
  )
}

export function Column({
  id,
  columns,
  rows,
  width,
  height,
  weight,
  ...restProps
}: GridProps & GridDimensions) {
  const gridContext = React.useContext(GridContext)

  if (columns === undefined && gridContext === null) {
    columns = 1
  }

  return useGridProps(
    {
      type: "column",
      id,
      columns: columns!,
      rows,
      width,
      height,
      weight,
    },
    restProps
  )
}

export function Row({
  id,
  columns,
  rows,
  width,
  height,
  weight,
  ...restProps
}: GridProps & GridDimensions) {
  const gridContext = React.useContext(GridContext)

  if (rows === undefined && gridContext === null) {
    rows = 1
  }

  return useGridProps(
    {
      type: "row",
      id,
      columns,
      rows: rows!,
      width,
      height,
      weight,
    },
    restProps
  )
}

export function useNode(
  getData: Parameters<typeof useTreeNode>[1],
  dependencies: React.DependencyList = []
) {
  const rootNode = React.useContext(RootNodeContext)
  const treeId = useTreeId()
  const treeNode = useTreeNode(treeId, getData, dependencies)
  const isPrerender = usePrerender()

  if (isPrerender) {
    return {
      layoutStyles: null,
      nodeLayout: null,
      parsedId: null,
      shouldRender: false,
    } as const
  }

  const grid = useGrid()
  const treeMap = useTreeState((state) => state.treeMap)
  const treeChildren = mapToChildren(treeMap)
  const rootTree = {
    ...rootNode,
    children: treeChildren || [],
  } as LayoutNode
  const computedLayout = computeLayout(rootTree)
  const flattenedLayout = flattenLayout(computedLayout.layout, grid.debug)
  const nodeLayout = flattenedLayout.children.find((node) => (node as any).treeId === treeId)
  const ids = new Set()
  let shouldRender = true

  treeMap.forEach((node) => {
    if (node.id === null) {
      return
    }

    const isSameInstance = node.treeId === treeId
    const hasId = ids.has(node.id)

    if (isSameInstance) {
      shouldRender = !hasId
    }

    if (!hasId) {
      ids.add(node.id)
    }
  })

  const layoutStyles: Record<string, any> = {}

  if (nodeLayout) {
    if (nodeLayout.width !== 1) {
      layoutStyles["--width"] = nodeLayout.width
    }

    if (nodeLayout.height !== 1) {
      layoutStyles["--height"] = nodeLayout.height
    }

    if (nodeLayout.column !== 1) {
      layoutStyles["--x"] = nodeLayout.column - 1
    }

    if (nodeLayout.row !== 1) {
      layoutStyles["--y"] = nodeLayout.row - 1
    }
  }

  const parsedId = treeNode.id || treeId

  return {
    layoutStyles,
    nodeLayout,
    parsedId,
    shouldRender,
  } as const
}

export function Space({
  id,
  children,
  size: sizeProp = "fill",
  weight = 1,
}: {
  id?: string
  children?: React.ReactNode
  size?: LeafNode["width"]
  weight?: LeafNode["weight"]
}) {
  const [size, setSize] = React.useState(sizeProp)
  const { shouldRender, parsedId, layoutStyles, nodeLayout } = useNode(
    () => createSpace({ id, size, weight }),
    [id, size, weight]
  )
  const grid = useGrid()

  React.useEffect(() => {
    setSize(sizeProp)
  }, [sizeProp])

  if (!shouldRender) {
    return null
  }

  if (children === undefined) {
    if (grid.debug) {
      return <div id={parsedId} style={layoutStyles} />
    }

    return null
  }

  return (
    <div id={parsedId} style={layoutStyles}>
      {children}
    </div>
  )
}

export function Circle({
  id,
  size,
  weight,
  color = "rgba(255, 255, 255, 0.2)",
}: {
  id?: string
  size?: LeafNode["width"]
  weight?: number
  color?: string
}) {
  const { shouldRender, parsedId, layoutStyles } = useNode(
    () => createNode({ id, weight, width: size, height: size }),
    [id, size, weight]
  )

  if (!shouldRender) {
    return null
  }

  return (
    <div
      id={parsedId}
      className="Circle"
      style={{
        ...layoutStyles,
        backgroundColor: color,
        borderRadius: "100%",
      }}
    />
  )
}

export function Text({
  children,
  id,
  length,
  size = 1,
  weight,
  color = "rgba(255, 255, 255, 0.2)",
}: {
  children: React.ReactNode
  id?: string
  length: LeafNode["width"]
  size?: LeafNode["width"]
  weight?: number
  color?: string
}) {
  const { shouldRender, parsedId, layoutStyles } = useNode(
    () => createNode({ id, weight, width: length, height: size }),
    [id, length, size, weight]
  )

  if (!shouldRender) {
    return null
  }

  return (
    <span
      id={parsedId}
      className="Text"
      style={{
        ...layoutStyles,
        fontSize: `calc(var(--base-unit) * ${size})`,
        color,
      }}
    >
      {children}
    </span>
  )
}
