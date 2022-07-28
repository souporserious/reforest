import type { DocumentContext } from "next/document"
import NextDocument from "next/document"
import { createTreeProvider } from "reforest"

class Document extends NextDocument {
  static async getInitialProps(context: DocumentContext) {
    const { TreeProvider, getInitializerScript } = createTreeProvider()
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

    return {
      ...initialProps,
      html: initialProps.html.concat(getInitializerScript()),
    }
  }
}

export default Document
