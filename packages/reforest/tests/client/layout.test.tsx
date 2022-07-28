import * as React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { App } from "../App"

test("renders and computes layout", () => {
  const { findByText } = render(<App />)

  findByText("Box")
})
