# use-indexed-children

Manages and provides descendant index paths.

## Install

```bash
npm install use-indexed-children
```

## Usage

```tsx
import * as React from "react"
import {
  useDescendant,
  useIndexedChildren,
  useIndexPath,
} from "use-indexed-children"

function Select({ children }: { children: React.ReactNode }) {
  const indexedChildren = useIndexedChildren(children)

  return <div>{indexedChildren}</div>
}

function Option({
  children,
  value,
}: {
  children: React.ReactNode
  value: any
}) {
  const indexPath = useIndexPath()

  return (
    <div>
      {children} {indexPath}
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
