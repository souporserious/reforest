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

const RootNodeContext = React.createContext<any>(null)

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
  const tree = useTree(children)

  return (
    <RootNodeContext.Provider value={node}>
      <div style={{ width, height }}>{tree.children}</div>
    </RootNodeContext.Provider>
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
  const node = React.useMemo(() => createNode({ width, height }), [width, height])
  const data = useTreeData(
    node,
    (treeMap, id) => {
      const tree = mapToTree(treeMap)
      const rootTree = { ...rootNode, children: tree ? tree.children : [] }
      const computedLayout = computeLayout(rootTree)
      const flattenedLayout = flattenLayout(computedLayout.layout)
      const nodeLayout = flattenedLayout?.children.find((node) => (node as any).generatedId === id)

      return {
        width: nodeLayout?.width,
        height: nodeLayout?.height,
        top: nodeLayout?.column,
        left: nodeLayout?.row,
      }
    },
    [rootNode]
  )

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
