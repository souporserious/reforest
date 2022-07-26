import * as React from "react"
import * as ReactDOMServer from "react-dom/server"

import { createIndexedTreeProvider } from "../../index"
import { App } from "../App"

test("server-side tree collection", () => {
  const { IndexTreeProvider, getIndexedTrees } = createIndexedTreeProvider()

  ReactDOMServer.renderToString(
    <IndexTreeProvider>
      <App />
    </IndexTreeProvider>
  )

  const indexedTrees = getIndexedTrees()

  expect(indexedTrees).toMatchSnapshot()
})
