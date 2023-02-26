module.exports = {
  // The test environment that Jest will use
  testEnvironment: "node",

  // The root directory for Jest tests
  roots: ["<rootDir>/src"],

  // The file extensions Jest will look for
  moduleFileExtensions: ["ts", "js"],

  // The test regex pattern to match test files
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",

  // The module name mapper to resolve module paths
  moduleNameMapper: {
    "^obsidian$": "<rootDir>/src/__mocks__/obsidian.ts",
  },

  // The transform config for TypeScript files
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },

  // The coverage report config
  collectCoverage: true,
  coverageDirectory: "<rootDir>/coverage",
};
