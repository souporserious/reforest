import * as React from "react"
import * as ReactDOMServer from "react-dom/server"

import { buildTree, indexedTrees, useIndex, useIndexedChildren } from "../../index"

function Item({ children, value }: { children: React.ReactNode; value: string }) {
  const index = useIndex({ value })
  const indexedChildren = useIndexedChildren(children)
  return <div data-testid={index?.indexPathString}>{indexedChildren}</div>
}

function ItemList({ children }: { children: React.ReactNode }) {
  const indexedChildren = useIndexedChildren(children)
  return <>{indexedChildren}</>
}

test("server-side rendering", () => {
  ReactDOMServer.renderToString(
    <ItemList>
      <Item value="apple">Apple</Item>
      <Item value="orange">Orange</Item>
      <Item value="banana">Banana</Item>
    </ItemList>
  )

  const indexTrees = Array.from(indexedTrees.values()).map((indexMap) =>
    buildTree(Array.from((indexMap as any).values()) as any)
  )

  expect(indexTrees).toMatchSnapshot()
})
