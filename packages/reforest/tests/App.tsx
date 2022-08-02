import * as React from "react"
import type { LayoutNode } from "@jsxui/layout"
import {
  createGrid,
  createColumn,
  createRow,
  createSpace,
  createNode,
  computeLayout,
  flattenLayout,
} from "@jsxui/layout"

import { mapToTree, useComputedData, useIndexedChildren, useTreeData } from "../src"

const RootNode = React.createContext<LayoutNode | null>(null)

function Grid({
  children,
  columns,
  rows,
  width,
  height,
}: {
  children: React.ReactNode
  columns: number
  rows: number
  width?: number
  height?: number
}) {
  const node = React.useMemo(
    () => createGrid({ columns, rows, width, height }),
    [columns, rows, width, height]
  )
  const indexedChildren = useIndexedChildren(children)

  useTreeData(node)

  return (
    <div style={{ width, height }}>
      <RootNode.Provider value={node}>{indexedChildren}</RootNode.Provider>
    </div>
  )
}

function Column({
  children,
  columns,
  rows,
  width,
  height,
}: {
  children: React.ReactNode
  columns?: number
  rows?: number
  width?: number
  height?: number
}) {
  const node = React.useMemo(
    () => createColumn({ columns, rows, width, height }),
    [columns, rows, width, height]
  )
  const indexedChildren = useIndexedChildren(children)

  useTreeData(node)

  return indexedChildren
}

function Row({
  children,
  columns,
  rows,
  width,
  height,
}: {
  children: React.ReactNode
  columns?: number
  rows?: number
  width?: number
  height?: number
}) {
  const node = React.useMemo(
    () => createRow({ columns, rows, width, height }),
    [columns, rows, width, height]
  )
  const indexedChildren = useIndexedChildren(children)

  useTreeData(node)

  return indexedChildren
}

function Space({ size }: { size?: number }) {
  const node = React.useMemo(() => createSpace({ size }), [size])

  useTreeData(node)

  return null
}

function Box({
  children,
  width,
  height,
}: {
  children: React.ReactNode
  width?: number
  height?: number
}) {
  const rootNode = React.useContext(RootNode)

  if (rootNode === null) {
    throw new Error("Box must be used in Grid.")
  }

  const node = React.useMemo(() => createNode({ width, height }), [width, height])
  const treeId = useTreeData(node)
  const computed = useComputedData((treeMap) => {
    console.log(treeMap.size)
    return {}
    // const tree = mapToTree(treeMap)
    // const rootTree = { ...rootNode, children: tree.children }
    // const computedLayout = computeLayout(rootTree).layout
    // const flattenedLayout = flattenLayout(computedLayout.layout)
    // const nodeLayout = flattenedLayout?.children.find((node: any) => node.treeId === treeId)

    // return {
    //   width: nodeLayout?.width,
    //   height: nodeLayout?.height,
    //   top: nodeLayout?.column,
    //   left: nodeLayout?.row,
    // }
  })

  return <div style={computed}>{children}</div>
}

export function App() {
  return (
    <React.Suspense fallback={null}>
      <Grid columns={600} rows={400}>
        <Row>
          <Space />
          <Column>
            <Space />
            <Box>Box</Box>
            <Space />
          </Column>
          <Space />
        </Row>
      </Grid>
    </React.Suspense>
  )
}
