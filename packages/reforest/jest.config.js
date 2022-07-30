module.exports = {
  projects: [
    {
      displayName: "server",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/server/*.tsx"],
      transform: { "^.+\\.(t|j)sx?$": ["@swc/jest"] },
    },
    {
      displayName: "client",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/tests/client/*.tsx"],
      transform: { "^.+\\.(t|j)sx?$": ["@swc/jest"] },
    },
  ],
}
