import * as React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { useIndexedDataEffect, useIndex, useIndexedChildren } from "../../index"

test("renders a simple list of items with the correct indexes", () => {
  const handleTreeUpdate = jest.fn()

  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const index = useIndex({ value })
    const indexedChildren = useIndexedChildren(children)
    return <div data-testid={index?.indexPathString}>{indexedChildren}</div>
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children)
    return <>{indexedChildren}</>
  }

  function Selected() {
    useIndexedDataEffect(handleTreeUpdate)
    return <div>Selected</div>
  }

  const { queryByTestId } = render(
    <>
      <Selected />
      <ItemList>
        <Item value="apple">Apple</Item>
        <Item value="orange">Orange</Item>
        <Item value="banana">Banana</Item>
      </ItemList>
    </>
  )

  expect(queryByTestId("1")).toHaveTextContent("Orange")

  expect(handleTreeUpdate).toHaveBeenCalledTimes(1)
})

test("renders a complex list of items with the correct indexes", () => {
  const handleTreeUpdate = jest.fn()

  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const index = useIndex({ value })
    const indexedChildren = useIndexedChildren(children)
    return <div data-testid={index?.indexPathString}>{indexedChildren}</div>
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const indexedChildren = useIndexedChildren(children, null, handleTreeUpdate)
    return <>{indexedChildren}</>
  }

  const { queryByTestId } = render(
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
  )

  expect(queryByTestId("2.3")).toHaveTextContent("Bosc")

  expect(handleTreeUpdate).toHaveBeenCalledTimes(1)

  expect(handleTreeUpdate).toMatchSnapshot()
})
