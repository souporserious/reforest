module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/*.tsx"],
  transform: { "^.+\\.(t|j)sx?$": ["@swc/jest"] },
}
