import * as React from "react"
import * as ReactDOMServer from "react-dom/server"

import { createIndexedTreeProvider, useIndex, useIndexedChildren } from "../../index"

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
  const { IndexTreeProvider, getIndexedTrees } = createIndexedTreeProvider()

  ReactDOMServer.renderToString(
    <IndexTreeProvider>
      <ItemList>
        <Item value="apple">Apple</Item>
        <Item value="orange">Orange</Item>
        <Item value="banana">Banana</Item>
      </ItemList>
    </IndexTreeProvider>
  )

  const indexedTrees = getIndexedTrees()

  expect(indexedTrees).toMatchSnapshot()
})
