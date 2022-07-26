import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { Writable } from "stream"

import { createIndexedTreeProvider, useIndex, useIndexedChildren } from "../../index"

function Item({ children, value }: { children: React.ReactNode; value: string }) {
  const index = useIndex({ value }, (indexedData) => {
    if (indexedData) {
      return Array.from(Object.values(indexedData)).length
    }

    return 0
  })
  const indexedChildren = useIndexedChildren(children)

  return (
    <div data-testid={index?.indexPathString}>
      {index?.computedData} {indexedChildren}
    </div>
  )
}

function ItemList({ children }: { children: React.ReactNode }) {
  const indexedChildren = useIndexedChildren(children)
  return <>{indexedChildren}</>
}

test("server-side rendering", async () => {
  const { IndexTreeProvider, getIndexedTrees } = createIndexedTreeProvider()
  const renderedString = await new Promise((resolve) => {
    let isReady = false
    const response = new (class extends Writable {
      _write(chunk, _, next) {
        if (isReady) {
          resolve(chunk.toString())
        }
        next()
      }
    })()
    const stream = ReactDOMServer.renderToPipeableStream(
      <IndexTreeProvider>
        <ItemList>
          <Item value="apple">Apple</Item>
          <Item value="orange">Orange</Item>
          <Item value="banana">Banana</Item>
        </ItemList>
      </IndexTreeProvider>,
      {
        onShellReady() {
          stream.pipe(response)
        },
        onAllReady() {
          isReady = true
        },
      }
    )
  })

  const indexedTrees = getIndexedTrees()

  expect(renderedString).toMatchSnapshot()
  expect(indexedTrees).toMatchSnapshot()
})
