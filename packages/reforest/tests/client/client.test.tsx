import * as React from "react"
import { waitFor, render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { useTree, useTreeData, useTreeEffect } from "../../index"

test("renders a simple list of items with the correct indexes", async () => {
  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const tree = useTree(children)
    const data = useTreeData(React.useMemo(() => ({ value }), [value]))

    return <div data-testid={data?.indexPathString}>{tree.children}</div>
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const tree = useTree(children)

    return <>{tree.children}</>
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
    const tree = useTree(children)
    const data = useTreeData(React.useMemo(() => ({ value }), [value]))

    return <div data-testid={data?.indexPathString}>{tree.children}</div>
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const tree = useTree(children)

    useTreeEffect(tree.treeMap, handleTreeUpdate)

    return tree.children
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
