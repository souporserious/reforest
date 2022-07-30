import * as React from "react"
import * as ReactDOMServer from "react-dom/server"

import { createTreeProvider } from "../../index"
import { App } from "../App"

test("server-side tree collection", () => {
  const { TreeProvider, stringifyTreeCollection } = createTreeProvider()

  ReactDOMServer.renderToString(
    <TreeProvider>
      <App />
    </TreeProvider>
  )

  expect(stringifyTreeCollection()).toMatchSnapshot()
})
