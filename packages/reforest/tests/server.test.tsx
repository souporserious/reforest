/** @jest-environment node */
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { Writable } from "stream"

import { createTreeProvider, useComputedData, useIndexedChildren, useTreeData } from "../src"
import { App } from "./App"

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

test("computed data renders on server", async () => {
  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const treeId = useTreeData(React.useMemo(() => ({ value }), [value]))
    const computed = useComputedData((treeMap) => {
      if (treeMap) {
        return treeMap.size
      }
      return 0
    })
    const indexedChildren = useIndexedChildren(children)

    return (
      <div data-testid={treeId}>
        {computed} {indexedChildren}
      </div>
    )
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children)

    return indexedChildren
  }

  const { TreeProvider, stringifyTreeComputedData } = createTreeProvider()
  const renderedString = await render(
    <React.Suspense fallback={null}>
      <TreeProvider>
        <ItemList>
          <Item value="apple">Apple</Item>
          <Item value="orange">Orange</Item>
          <Item value="banana">Banana</Item>
        </ItemList>
      </TreeProvider>
    </React.Suspense>
  )

  expect(renderedString).toMatchSnapshot()
  expect(stringifyTreeComputedData()).toMatchSnapshot()
})

test("changing rendered elements based on computed data", async () => {
  function Box({ id }: { id: string }) {
    const treeId = useTreeData(React.useMemo(() => ({ id }), [id]))
    const shouldRender = useComputedData((treeMap) => {
      const ids = new Set()
      let shouldRender = false

      treeMap?.forEach(({ id }, treeIdToCompare) => {
        const isSameId = treeId === treeIdToCompare
        const hasId = ids.has(id)

        if (isSameId) {
          shouldRender = !hasId
        }

        if (!hasId) {
          ids.add(id)
        }
      })

      return shouldRender
    })

    return shouldRender ? <div id={id} /> : null
  }

  function Parent({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children)

    return indexedChildren
  }

  const { TreeProvider } = createTreeProvider()
  const renderedString = await render(
    <React.Suspense fallback={null}>
      <TreeProvider>
        <Parent>
          <Box id="a" />
          <Box id="b" />
          <Box id="c" />
          <Box id="b" />
        </Parent>
      </TreeProvider>
    </React.Suspense>
  )

  expect(renderedString).toMatchSnapshot()
})

test("tree collection", async () => {
  const { TreeProvider, stringifyTreeComputedData } = createTreeProvider()

  const renderedString = await render(
    <TreeProvider>
      <App />
    </TreeProvider>
  )

  expect(renderedString).toMatchSnapshot()
  expect(stringifyTreeComputedData()).toMatchSnapshot()
})
