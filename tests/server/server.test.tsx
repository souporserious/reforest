import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { Writable } from "stream"

import { createIndexedTreeProvider, useIndex, useIndexedChildren } from "../../index"

/** Simple render function to mock what renderToPipeableStream does. */
function render(element: React.ReactNode) {
  return new Promise((resolve) => {
    let isReady = false
    const response = new (class extends Writable {
      _write(chunk, _, next) {
        if (isReady) {
          resolve(chunk.toString())
        }
        next()
      }
    })()
    const stream = ReactDOMServer.renderToPipeableStream(element, {
      onShellReady() {
        stream.pipe(response)
      },
      onAllReady() {
        isReady = true
      },
    })
  })
}

test("server-side rendering", async () => {
  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const index = useIndex({ value }, (indexedData) => {
      if (indexedData) {
        return indexedData.length
      }
      return 0
    })
    const indexedChildren = useIndexedChildren(children)

    return (
      <div data-testid={index?.indexPathString}>
        {index!.computedData} {indexedChildren}
      </div>
    )
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children)
    return <>{indexedChildren}</>
  }

  const { IndexTreeProvider, getIndexedTrees } = createIndexedTreeProvider()
  const renderedString = await render(
    <IndexTreeProvider>
      <ItemList>
        <Item value="apple">Apple</Item>
        <Item value="orange">Orange</Item>
        <Item value="banana">Banana</Item>
      </ItemList>
    </IndexTreeProvider>
  )

  const indexedTrees = getIndexedTrees()

  expect(renderedString).toMatchSnapshot()
  expect(indexedTrees).toMatchSnapshot()
})

test("changing rendered elements based on computed data", async () => {
  function Box({ id }: { id: string }) {
    const index = useIndex({ id }, (indexedData, localIndexPathString) => {
      const ids = new Set()
      let shouldRender = false

      indexedData?.forEach(([indexPathString, { id }]) => {
        const isSameIndex = indexPathString === localIndexPathString
        const hasId = ids.has(id)

        if (isSameIndex) {
          shouldRender = !hasId
        }

        if (!hasId) {
          ids.add(id)
        }
      })

      return shouldRender
    })

    return index?.computedData ? <div id={id} /> : null
  }

  function Parent({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children)
    return <>{indexedChildren}</>
  }

  const { IndexTreeProvider } = createIndexedTreeProvider()
  const renderedString = await render(
    <IndexTreeProvider>
      <Parent>
        <Box id="a" />
        <Box id="b" />
        <Box id="c" />
        <Box id="b" />
      </Parent>
    </IndexTreeProvider>
  )

  expect(renderedString).toMatchSnapshot()
})
