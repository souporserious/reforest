import * as React from "react"
import { act, waitFor, render, renderHook } from "@testing-library/react"

import "@testing-library/jest-dom"

import {
  useIndexedChildren,
  useIndex,
  useRovingIndex,
  useTree,
  useTreeId,
  useTreeNode,
} from "../src"

import { App } from "./App"

test("renders a simple list of items with the correct indexes", async () => {
  function Item({ children, value }: { children: React.ReactNode; value: string }) {
    const index = useIndex()
    const treeId = useTreeId()

    useTreeNode(treeId, () => ({ value }), [value])

    return <div data-testid={index?.indexPathString}>{children}</div>
  }

  function ItemList({ children }: { children: React.ReactNode }) {
    const tree = useTree(children)

    return tree.children
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
  function Item({ children }: { children: React.ReactNode; value: string }) {
    const indexedChildren = useIndexedChildren(children)
    const index = useIndex()

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
  })
})

test("renders and computes layout", () => {
  const { container, findByText } = render(<App />)

  findByText("Box")

  expect(container.firstChild).toMatchSnapshot()
})

test("index contains by default", () => {
  const maxIndex = 3
  const { result } = renderHook(() => useRovingIndex({ maxIndex }))

  act(() => {
    result.current.setActiveIndex(5)
  })

  expect(result.current.activeIndex).toBe(maxIndex)

  act(() => {
    result.current.setActiveIndex(-5)
  })

  expect(result.current.activeIndex).toBe(0)
})

test("index overflows properly", () => {
  const { result } = renderHook(() =>
    useRovingIndex({
      contain: false,
    })
  )

  act(() => {
    result.current.moveActiveIndex(-3)
  })

  expect(result.current.activeIndex).toBe(-3)
})

test("index wraps properly", () => {
  const { result } = renderHook(() =>
    useRovingIndex({
      maxIndex: 5,
      wrap: true,
    })
  )

  act(() => {
    result.current.moveActiveIndex(-3)
  })

  expect(result.current.activeIndex).toBe(2)
})

test("index moves forward", () => {
  const { result } = renderHook(() =>
    useRovingIndex({
      maxIndex: 5,
    })
  )

  act(() => {
    result.current.moveForward()
  })

  expect(result.current.activeIndex).toBe(1)
})

test("index moves backward", () => {
  const { result } = renderHook(() =>
    useRovingIndex({
      maxIndex: 5,
      wrap: true,
    })
  )

  act(() => {
    result.current.moveBackward()
  })

  expect(result.current.activeIndex).toBe(4)
})

test("disables moving backwards", () => {
  const { result } = renderHook(() => useRovingIndex({ maxIndex: 3 }))

  expect(result.current.moveBackwardDisabled).toBe(true)

  act(() => {
    result.current.moveActiveIndex(1)
  })

  expect(result.current.moveBackwardDisabled).toBe(false)
})

test("disables moving forwards", () => {
  const { result } = renderHook(() => useRovingIndex({ maxIndex: 3 }))

  expect(result.current.moveForwardDisabled).toBe(false)

  act(() => {
    result.current.setActiveIndex(3)
  })

  expect(result.current.moveForwardDisabled).toBe(true)
})
