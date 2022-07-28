import * as React from "react"
import {
  createGrid,
  createColumn,
  createNode,
  createSpace,
  computeLayout,
  flattenLayout,
  createRow,
  Node,
} from "@jsxui/layout"

import { useTree, useTreeData } from "../index"

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
  const indexedChildren = useTree(children)

  return <div style={{ width, height }}>{indexedChildren}</div>
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

  const indexedChildren = useTree(children)

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

  const indexedChildren = useTree(children)

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
  const node = React.useMemo(() => createNode({ width, height }), [width, height])

  useTreeData(node)

  return <div>{children}</div>
}

export function App() {
  return (
    <Grid columns={12} rows={12}>
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
