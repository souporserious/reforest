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

import { mapToChildren, useTree, useTreeData } from "../src"

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
  const node = React.useMemo(
    () => createGrid({ columns, rows, width, height }),
    [columns, rows, width, height]
  )

  useTreeData(node)

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
  const node = React.useMemo(
    () => createColumn({ columns, rows, width, height }),
    [columns, rows, width, height]
  )
  const tree = useTree(children)

  useTreeData(node)

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
  const node = React.useMemo(
    () => createRow({ columns, rows, width, height }),
    [columns, rows, width, height]
  )
  const tree = useTree(children)

  useTreeData(node)

  return tree.children
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
  const rootNode = React.useContext(RootNodeContext)

  if (rootNode === null) {
    throw new Error("Box must be used in Grid.")
  }

  const node = React.useMemo(() => createNode({ width, height }), [width, height])
  const treeData = useTreeData(node, (treeMap, treeId) => {
    const treeChildren = mapToChildren(treeMap)
    const computedLayout = computeLayout({ ...rootNode, children: treeChildren })
    const flattenedLayout = flattenLayout(computedLayout.layout)
    const nodeLayout = flattenedLayout?.children.find((node: any) => node.treeId === treeId)

    return {
      width: nodeLayout?.width,
      height: nodeLayout?.height,
      top: nodeLayout?.column,
      left: nodeLayout?.row,
    }
  })

  return <div style={treeData.computed}>{children}</div>
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
