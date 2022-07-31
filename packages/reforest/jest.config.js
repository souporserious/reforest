module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/*.test.tsx"],
  transform: { "^.+\\.(t|j)sx?$": ["@swc/jest"] },
}
