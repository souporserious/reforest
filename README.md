# use-indexed-children

Manages and provides descendant index paths.

[Codesandbox Demo](https://codesandbox.io/s/useindexedchildren-demo-0bpkby)

## Install

```bash
npm install use-indexed-children
```

## Usage

Please note the following is for demo purposes only and you should use a more robust solution that is accessible.

```tsx
import * as React from "react"
import {
  useDescendant,
  useIndexedChildren,
  useIndexPath,
} from "use-indexed-children"

const SelectContext = React.createContext<any>(null)

function Select({ children }: { children: React.ReactNode }) {
  const selectedIndexPathState = React.useState(null)
  const [selectedIndexPath] = selectedIndexPathState
  const descendant = useDescendant(children, selectedIndexPath)
  const indexedChildren = useIndexedChildren(children)

  return (
    <div>
      {descendant
        ? `Selected: ${descendant.props.children}`
        : `Select an option below`}

      <SelectContext.Provider value={selectedIndexPathState}>
        {indexedChildren}
      </SelectContext.Provider>
    </div>
  )
}

function Option({
  children,
  value,
}: {
  children: React.ReactNode
  value: any
}) {
  const indexPath = useIndexPath()
  const selectContext = React.useContext(SelectContext)
  const [selectedIndexPath, setSelectedIndexPath] = selectContext
  const isSelected = indexPath === selectedIndexPath

  return (
    <div onClick={() => setSelectedIndexPath(isSelected ? null : indexPath)}>
      {isSelected ? "✅" : "⬜️"} {children}
    </div>
  )
}

export default function App() {
  return (
    <Select>
      <Option value="apple">Apple</Option>
      <Option value="orange">Orange</Option>
      <Option value="banana">Banana</Option>
    </Select>
  )
}
```
