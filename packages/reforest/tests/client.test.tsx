import * as React from "react"
import { waitFor, render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { useIndexedChildren, useIndex, useTreeData, useTreeEffect } from "../src"

import { App } from "./App"

test("renders a simple list of items with the correct indexes", async () => {
  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const indexedChildren = useIndexedChildren(children)
    const index = useIndex()

    useTreeData(React.useMemo(() => ({ value }), [value]))

    return <div data-testid={index?.indexPathString}>{indexedChildren}</div>
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children)

    return indexedChildren
  }

  await waitFor(() => {
    const { queryByTestId } = render(
      <React.Suspense fallback={null}>
        <ItemList>
          <Item value="apple">Apple</Item>
          <Item value="orange">Orange</Item>
          <Item value="banana">Banana</Item>
        </ItemList>
      </React.Suspense>
    )

    expect(queryByTestId("1")).toHaveTextContent("Orange")
  })
})

test("renders a complex list of items with the correct indexes", async () => {
  const handleTreeUpdate = jest.fn()

  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const indexedChildren = useIndexedChildren(children)
    const index = useIndex()

    useTreeData(React.useMemo(() => ({ value }), [value]))

    return <div data-testid={index?.indexPathString}>{indexedChildren}</div>
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children)

    useTreeEffect(handleTreeUpdate)

    return indexedChildren
  }

  await waitFor(() => {
    const { queryByTestId } = render(
      <React.Suspense fallback={null}>
        <ItemList>
          <Item value="apples">
            Apples
            <Item value="fuji">Fuji</Item>
            <Item value="gala">Gala</Item>
            <Item value="honeycrisp">Honeycrisp</Item>
          </Item>
          <Item value="apples">
            Oranges
            <Item value="mandarin">Mandarin</Item>
            <Item value="naval">Naval</Item>
            <Item value="tangerine">Tangerine</Item>
          </Item>
          <Item value="pears">
            Pears
            <Item value="anjou">Anjou</Item>
            <Item value="asian">Asian</Item>
            <Item value="bosc">Bosc</Item>
          </Item>
        </ItemList>
      </React.Suspense>
    )

    expect(queryByTestId("2.3")).toHaveTextContent("Bosc")

    expect(handleTreeUpdate).toHaveBeenCalledTimes(1)

    expect(handleTreeUpdate).toMatchSnapshot()
  })
})

test("renders and computes layout", () => {
  const { container, findByText } = render(<App />)

  findByText("Box")

  expect(container.firstChild).toMatchSnapshot()
})
