/** @jest-environment node */
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { Writable } from "stream"

import { createTreeProvider, useTree, useTreeData } from "../index"
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
    const data = useTreeData(
      React.useMemo(() => ({ value }), [value]),
      (tree) => {
        if (tree.map) {
          return tree.map.size
        }
        return 0
      }
    )
    const tree = useTree(children)

    return (
      <div data-testid={data?.indexPathString}>
        {data!.computed} {tree.children}
      </div>
    )
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const tree = useTree(children)

    return tree.children
  }

  const { TreeProvider, stringifyTreeCollection } = createTreeProvider()
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
  expect(stringifyTreeCollection()).toMatchSnapshot()
})

test("changing rendered elements based on computed data", async () => {
  function Box({ id }: { id: string }) {
    const data = useTreeData(
      React.useMemo(() => ({ id }), [id]),
      (tree, generatedId) => {
        const ids = new Set()
        let shouldRender = false

        tree.map?.forEach(({ id }, generatedIdToCompare) => {
          const isSameId = generatedId === generatedIdToCompare
          const hasId = ids.has(id)

          if (isSameId) {
            shouldRender = !hasId
          }

          if (!hasId) {
            ids.add(id)
          }
        })

        return shouldRender
      }
    )

    return data?.computed ? <div id={id} /> : null
  }

  function Parent({ children }: { children: React.ReactNode }) {
    const tree = useTree(children)

    return tree.children
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
  const { TreeProvider, stringifyTreeCollection } = createTreeProvider()

  const renderedString = await render(
    <TreeProvider>
      <App />
    </TreeProvider>
  )

  expect(renderedString).toMatchSnapshot()
  expect(stringifyTreeCollection()).toMatchSnapshot()
})
