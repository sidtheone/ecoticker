import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "node",
      testMatch: ["<rootDir>/tests/**/*.test.ts"],
      transform: { "^.+\\.tsx?$": "ts-jest" },
      testEnvironment: "node",
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "react",
      testMatch: ["<rootDir>/tests/**/*.test.tsx"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json", jsx: "react-jsx" }],
      },
      testEnvironment: "jsdom",
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
  ],
};

export default config;
