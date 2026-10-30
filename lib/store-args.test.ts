import { expect, test } from "bun:test";
import { ffUrl } from "../store/args";

test("--url beats FF_URL and the default", () => {
  expect(ffUrl(["--url", "http://localhost:3100"], "http://env:1")).toBe("http://localhost:3100");
});

test("--url=value form", () => {
  expect(ffUrl(["--url=http://localhost:3100"], undefined)).toBe("http://localhost:3100");
});

test("FF_URL fallback, then default", () => {
  expect(ffUrl([], "http://env:1")).toBe("http://env:1");
  expect(ffUrl([], undefined)).toBe("http://localhost:3000");
  expect(ffUrl([], "")).toBe("http://localhost:3000");
});

test("ignores other args such as down", () => {
  expect(ffUrl(["down"], undefined)).toBe("http://localhost:3000");
});

test("rejects non-http urls and garbage", () => {
  expect(() => ffUrl(["--url", "ftp://localhost"], undefined)).toThrow();
  expect(() => ffUrl(["--url=nonsense"], undefined)).toThrow();
  expect(() => ffUrl(["--url"], undefined)).toThrow();
  expect(() => ffUrl([], "ftp://x")).toThrow();
});
