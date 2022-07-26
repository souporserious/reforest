import type { DocumentContext } from "next/document"
import NextDocument from "next/document"
import { createIndexedTreeProvider } from "use-indexed-children"

class Document extends NextDocument {
  static async getInitialProps(context: DocumentContext) {
    const { IndexTreeProvider, indexedTrees } = createIndexedTreeProvider()
    const originalRenderPage = context.renderPage

    context.renderPage = () =>
      originalRenderPage({
        enhanceApp: (App) => (props) =>
          (
            <IndexTreeProvider>
              <App {...props} />
            </IndexTreeProvider>
          ),
      })

    const initialProps = await NextDocument.getInitialProps(context)
    const trees = Array.from(Object.values(indexedTrees))

    trees.forEach((tree) => {
      const treeValues = Array.from(Object.values(tree))

      console.log(treeValues)
    })

    return initialProps
  }
}

export default Document
