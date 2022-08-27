/** @jest-environment node */
import * as React from "react"
import { renderToString } from "react-dom/server"

import { useTree, useTreeNode, useTreeState } from "../src"

test("computed data renders on server", () => {
  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const tree = useTree(children)
    const node = useTreeNode(() => ({ value }), [value])

    if (node.isPreRender) {
      return null
    }

    const treeMap = useTreeState((state) => state.treeMap)

    return (
      <div data-testid={node.id}>
        {treeMap.size} {tree.children}
      </div>
    )
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const tree = useTree(children)

    return tree.children
  }

  const renderedString = renderToString(
    <ItemList>
      <Item value="apple">Apple</Item>
      <Item value="orange">Orange</Item>
      <Item value="banana">Banana</Item>
    </ItemList>
  )

  expect(renderedString).toMatchSnapshot()
})

test("changing rendered elements based on computed data", () => {
  function Box({ id }: { id: string }) {
    const node = useTreeNode(() => ({ id }), [id])

    if (node.isPreRender) {
      return null
    }

    const treeMap = useTreeState((state) => state.treeMap)
    const ids = new Set()
    let shouldRender = false

    treeMap.forEach((treeNode) => {
      const isSameInstance = treeNode.treeId === node.id
      const hasId = ids.has(treeNode.id)

      if (isSameInstance) {
        shouldRender = !hasId
      }

      if (!hasId) {
        ids.add(treeNode.id)
      }
    })

    return shouldRender ? <div id={id} /> : null
  }

  function Parent({ children }: { children: React.ReactNode }) {
    const tree = useTree(children)

    return tree.children
  }

  const renderedString = renderToString(
    <Parent>
      <Box id="a" />
      <Box id="b" />
      <Box id="c" />
      <Box id="b" />
    </Parent>
  )

  expect(renderedString).toMatchSnapshot()
})
