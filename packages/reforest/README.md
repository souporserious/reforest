# 🌲 reforest

Collect ordered React render data seamlessly across the server and client.

> **Note**
> While digital trees are cool, climate change is negatively impacting real trees at a rapid rate. Please consider planting a tree, starting a garden, or donating to an [organization](https://onetreeplanted.org/).

## Install

```bash
npm install reforest
```

```bash
yarn add reforest
```

## Why?

When building low-level components in React for accessibility, styling, and animation purposes, the orchestration for everything can become painful for both the library author and consumer. In general, the problem boils down to a component needing to use render data from another component[s]. This library aims to solve this problem by managing a tree of data built from other component renders in an easy API that works on the server and client.

## Related

- [use-indexed-children](https://github.com/souporserious/reforest/tree/f728464cc2b576472cf687a37db16e55b8ad9dea) (predecessor)

- [use-item-list](https://github.com/souporserious/use-item-list)

- [use-ref-list](https://github.com/souporserious/use-ref-list)

- [use-roving-index](https://github.com/souporserious/use-roving-index)

- [Managing Indexed Collections with useMutableSource](https://souporserious.com/managing-indexed-collections-with-usemutablesource/)

## Usage

> **Warning**
> The API is still in development and may change without notice. Docs coming soon..

Please note the following example is for demo purposes only and you should use a more robust solution that is fully accessible.

```tsx
import * as React from "react"
import { useTree, useTreeNode } from "reforest"

const SelectContext = React.createContext<any>(null)

function Select({ children }: { children: React.ReactNode }) {
  const highlightedIndexState = React.useState<number | null>(null)
  const [highlightedIndex, setHighlightedIndex] = highlightedIndexState
  const [selectedValue, setSelectedValue] = React.useState<React.ReactElement | null>(null)
  const tree = useTree(children)
  const moveHighlightedIndex = (amountToMove: number) => {
    setHighlightedIndex((currentIndex) => {
      if (currentIndex === null) {
        return 0
      } else {
        const nextIndex = currentIndex + amountToMove

        if (nextIndex >= tree.maxIndex) {
          return 0
        } else if (nextIndex < 0) {
          return maxIndex - 1
        }

        return currentIndex + amountToMove
      }
    })
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          moveHighlightedIndex(-1)
        } else if (event.key === "ArrowDown") {
          moveHighlightedIndex(1)
        }
      }}
    >
      <strong>{selectedValue ? <>Selected: {selectedValue}</> : `Select an option below`}</strong>
      <SelectContext.Provider value={{ highlightedIndexState, selectedValue }}>
        {indexedChildren}
      </SelectContext.Provider>
    </div>
  )
}

function Option({ children, value }: { children: React.ReactNode; value: any }) {
  const { indexPath, index } = useTreeNode()
  const selectContext = React.useContext(SelectContext)
  const [highlightedIndex, setHighlightedIndex] = selectContext.highlightedIndexState
  const isHighlighted = index === highlightedIndex
  const isSelected = selectContext.selectedValue ? selectContext.selectedValue === value : false

  return (
    <div
      onMouseOver={() => setHighlightedIndex(index)}
      onMouseOut={() => setHighlightedIndex(null)}
      onClick={() => selectContext.selectIndex(indexPath)}
      style={{ backgroundColor: isHighlighted ? "yellow" : "white" }}
    >
      {children} {isSelected && "✅"}
    </div>
  )
}

const fruits = ["Apple", "Orange", "Pear", "Kiwi", "Banana", "Mango"]

export default function App() {
  return (
    <Select>
      {fruits.map((fruit) => (
        <Option key={fruit} value={fruit}>
          {fruit}
        </Option>
      ))}
    </Select>
  )
}
```
