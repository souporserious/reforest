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

import { mapToChildren, useTree, useTreeId, useTreeNode, useTreeState, usePrerender } from "../src"

const RootNodeContext = React.createContext<LayoutNode | null>(null)

type GridProps = {
  children: React.ReactNode
  columns: number
  rows: number
  width?: number
  height?: number
}

function RootGrid({ children, columns, rows, width, height }: GridProps) {
  const node = React.useMemo(
    () => createGrid({ columns, rows, width, height }),
    [columns, rows, width, height]
  )

  return (
    <div style={{ width, height }}>
      <RootNodeContext.Provider value={node}>{children}</RootNodeContext.Provider>
    </div>
  )
}

function SubGrid({ children, columns, rows, width, height }: GridProps) {
  const treeId = useTreeId()

  useTreeNode(treeId, () => createGrid({ columns, rows, width, height }))

  return <div style={{ width, height }}>{children}</div>
}

function Grid({ children, ...restProps }: GridProps) {
  const tree = useTree(children)

  return tree.isRoot ? (
    <RootGrid {...restProps}>{tree.children}</RootGrid>
  ) : (
    <SubGrid {...restProps}>{tree.children}</SubGrid>
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
  const tree = useTree(children)
  const treeId = useTreeId()

  useTreeNode(treeId, () => createColumn({ columns, rows, width, height }))

  return tree.children
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
  const tree = useTree(children)
  const treeId = useTreeId()

  useTreeNode(treeId, () => createRow({ columns, rows, width, height }))

  return tree.children
}

function Space({ size }: { size?: number }) {
  const treeId = useTreeId()

  useTreeNode(treeId, () => createSpace({ size }))

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
  const rootNode = React.useContext(RootNodeContext)

  if (rootNode === null) {
    throw new Error("Box must be used in Grid.")
  }

  const treeId = useTreeId()
  const isPrerender = usePrerender()

  useTreeNode(treeId, () => createNode({ width, height }), [width, height])

  if (isPrerender) {
    return null
  }

  const treeState = useTreeState()
  const treeMap = treeState((state) => state.treeMap)
  const treeChildren = mapToChildren(treeMap)
  const computedLayout = computeLayout({ ...rootNode, children: treeChildren })
  const flattenedLayout = flattenLayout(computedLayout.layout)
  const nodeLayout = flattenedLayout?.children.find((treeNode: any) => treeNode.treeId === treeId)
  const computedStyles = {
    width: nodeLayout?.width,
    height: nodeLayout?.height,
    top: nodeLayout?.column,
    left: nodeLayout?.row,
  }

  return <div style={computedStyles}>{children}</div>
}

export function App() {
  return (
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
  )
}
