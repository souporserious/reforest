import * as React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
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

import { useIndexedChildren, useIndex } from "../../index"

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
  const indexedChildren = useIndexedChildren(children, (tree: Node[]) => {
    node.children = tree

    const computedLayout = computeLayout(node)
    const flattenedLayout = flattenLayout(computedLayout.layout)
  })

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

  const indexedChildren = useIndexedChildren(children)

  useIndex(node)

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

  useIndex(node)

  return indexedChildren
}

function Space({ size }: { size?: number }) {
  const node = React.useMemo(() => createSpace({ size }), [size])

  useIndex(node)

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

  useIndex(node)

  return <div>{children}</div>
}

function App() {
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

test("renders and computes layout", () => {
  const { findByText } = render(<App />)

  findByText("Box")
})
