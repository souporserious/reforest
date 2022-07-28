import type { DocumentContext } from "next/document"
import NextDocument from "next/document"
import { createTreeProvider } from "reforest"

class Document extends NextDocument {
  static async getInitialProps(context: DocumentContext) {
    const { TreeProvider, stringifyTreeCollection } = createTreeProvider()
    const originalRenderPage = context.renderPage

    context.renderPage = () =>
      originalRenderPage({
        enhanceApp: (App) => (props) =>
          (
            <TreeProvider>
              <App {...props} />
            </TreeProvider>
          ),
      })

    const initialProps = await NextDocument.getInitialProps(context)

    initialProps.head.push(
      <script
        id="reforest"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: stringifyTreeCollection() }}
      />
    )

    return initialProps
  }
}

export default Document
