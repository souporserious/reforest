# use-indexed-children

Manages and provides descendant index paths.

[Codesandbox Demo](https://codesandbox.io/s/useindexedchildren-demo-0bpkby)

## Install

```bash
npm install use-indexed-children
```

## Usage

Please note the following example is for demo purposes only and you should use a more robust solution that is fully accessible.

```tsx
import * as React from "react"
import {
  findDescendant,
  useIndexedChildren,
  useIndexPath,
} from "use-indexed-children"

const SelectContext = React.createContext<any>(null)

function Select({ children }: { children: React.ReactNode }) {
  const highlightedIndexState = React.useState<number | null>(null)
  const [highlightedIndex, setHighlightedIndex] = highlightedIndexState
  const [selectedValue, setSelectedValue] =
    React.useState<React.ReactElement | null>(null)
  const indexedChildren = useIndexedChildren(children)
  const maxIndex = indexedChildren.length
  const moveHighlightedIndex = (amountToMove: number) => {
    setHighlightedIndex((currentIndex) => {
      if (currentIndex === null) {
        return 0
      } else {
        const nextIndex = currentIndex + amountToMove

        if (nextIndex >= maxIndex) {
          return 0
        } else if (nextIndex < 0) {
          return maxIndex - 1
        }

        return currentIndex + amountToMove
      }
    })
  }
  const selectIndex = (index: string) => {
    const descendant = findDescendant(children, index)
    if (descendant) {
      setSelectedValue(descendant.props.value)
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          moveHighlightedIndex(-1)
        } else if (event.key === "ArrowDown") {
          moveHighlightedIndex(1)
        } else if (
          event.key === "Enter" &&
          typeof highlightedIndex === "number"
        ) {
          selectIndex(highlightedIndex.toString())
        }
      }}
    >
      <strong>
        {selectedValue ? (
          <>Selected: {selectedValue}</>
        ) : (
          `Select an option below`
        )}
      </strong>
      <SelectContext.Provider
        value={{ highlightedIndexState, selectIndex, selectedValue }}
      >
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
  const index = parseInt(indexPath, 10)
  const selectContext = React.useContext(SelectContext)
  const [highlightedIndex, setHighlightedIndex] =
    selectContext.highlightedIndexState
  const isHighlighted = index === highlightedIndex
  const isSelected = selectContext.selectedValue
    ? selectContext.selectedValue === value
    : false

  return (
    <div
      onMouseOver={() => setHighlightedIndex(parseInt(indexPath, 10))}
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
