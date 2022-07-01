import {
  type ReactNode,
  createContext,
  isValidElement,
  useContext,
  useMemo,
} from "react"
import flattenChildren from "react-keyed-flatten-children"

const IndexContext = createContext<string>("")

/** Returns the current index path this hook is rendered in. */
export function useIndexPath() {
  const indexPathString = useContext(IndexContext)

  return useMemo(() => indexPathString.split(""), [indexPathString])
}

/** Passes an index to each child regardless of fragments. */
export function useIndexedChildren(children: ReactNode) {
  const indexPathString = useContext(IndexContext)

  return flattenChildren(children)
    .filter(isValidElement)
    .map((child, index) => (
      <IndexContext.Provider
        key={child.key}
        value={indexPathString + index.toString()}
      >
        {child}
      </IndexContext.Provider>
    ))
}
