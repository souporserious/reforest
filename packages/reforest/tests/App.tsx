import * as React from "react"
import {
  createGrid,
  createColumn,
  createRow,
  createSpace,
  createNode,
  computeLayout,
  flattenLayout,
} from "@jsxui/layout"

import { mapToTree, useTree, useTreeData } from "../index"

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
  const tree = useTree(
    children,
    React.useCallback(
      (treeMap) => {
        const tree = mapToTree(treeMap)
        const rootTree = { ...node, children: tree.children }
        const computedLayout = computeLayout(rootTree)
        const flattenedLayout = flattenLayout(computedLayout.layout)

        return {
          computedLayout: computedLayout.layout,
          flattenedLayout: flattenedLayout,
        }
      },
      [node]
    )
  )

  return <div style={{ width, height }}>{tree.children}</div>
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
  const node = React.useMemo(() => createNode({ width, height }), [width, height])
  const data = useTreeData(node, (tree, id) => {
    const rootLayout = tree.computed?.flattenedLayout
    const nodeLayout = rootLayout?.children.find((node) => node.generatedId === id)

    return {
      width: nodeLayout?.width,
      height: nodeLayout?.height,
      top: nodeLayout?.column,
      left: nodeLayout?.row,
    }
  })

  return <div style={data?.computed || {}}>{children}</div>
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
