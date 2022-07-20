import * as React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { useIndex, useIndexedChildren } from "."

function Item({ children }: { children: React.ReactNode }) {
  const index = useIndex()
  const indexedChildren = useIndexedChildren(children)
  return <div data-testid={index?.indexPathString}>{indexedChildren}</div>
}

function ItemList({ children }: { children: React.ReactNode }) {
  const indexedChildren = useIndexedChildren(children)
  return <>{indexedChildren}</>
}

test("renders a simple list of items with the correct indexes", () => {
  const { queryByTestId } = render(
    <ItemList>
      <Item>Apple</Item>
      <Item>Orange</Item>
      <Item>Banana</Item>
    </ItemList>
  )

  expect(queryByTestId("1")).toHaveTextContent("Orange")
})

test("renders a complex list of items with the correct indexes", () => {
  const { queryByTestId } = render(
    <ItemList>
      <Item>
        Apple
        <Item>Fuji</Item>
        <Item>Gala</Item>
        <Item>Honeycrisp</Item>
      </Item>
      <Item>
        Orange
        <Item>Mandarin</Item>
        <Item>Naval</Item>
        <Item>Tangerine</Item>
      </Item>
      <Item>
        Pear
        <Item>Anjou</Item>
        <Item>Asian</Item>
        <Item>Bosc</Item>
      </Item>
    </ItemList>
  )

  expect(queryByTestId("2.3")).toHaveTextContent("Bosc")
})
