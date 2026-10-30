import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findBannedWords } from "./banned";

const ROOT = resolve(import.meta.dir + "/..");
const read = (rel: string) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};

const README = read("README.md");
const DEMO = read("docs/DEMO.md");
const DOCS: Record<string, string> = { "README.md": README, "docs/DEMO.md": DEMO };

function sourceFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

function envVarsRead(): string[] {
  const files = [
    ...sourceFiles("lib").filter((f) => dirname(f) === "lib"),
    ...sourceFiles("app"),
    ...sourceFiles("scripts"),
  ];
  const names = new Set<string>();
  for (const f of files)
    for (const m of read(f).matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
  return [...names].sort();
}

describe("README env vars", () => {
  const vars = envVarsRead();

  test("the scan finds the known env vars", () => {
    for (const v of ["YOUCAM_SECRET_KEY", "YOUCAM_API_URL", "LIVE_RUNS_MAX"])
      expect(vars).toContain(v);
  });

  test("mentions every env var the code reads", () => {
    expect(vars.filter((v) => !README.includes(v))).toEqual([]);
  });
});

describe("README credits and citations", () => {
  for (const phrase of [
    "Skin Analysis",
    "Aging Generator",
    "Skin Simulation",
    "Open-Meteo",
    "CC BY 4.0",
    "Hughes",
    "2013",
    "10.7326/0003-4819-158-11-201306040-00002",
  ])
    test(`mentions "${phrase}"`, () => {
      expect(README).toContain(phrase);
    });
});

describe("scripts", () => {
  const scripts = Object.keys(JSON.parse(read("package.json")).scripts);

  test("every `bun run <name>` in the docs exists in package.json", () => {
    const missing: string[] = [];
    for (const [file, text] of Object.entries(DOCS))
      for (const m of text.matchAll(/bun run ([A-Za-z0-9:_-]+)/g))
        if (!scripts.includes(m[1])) missing.push(`${file}: ${m[1]}`);
    expect(missing).toEqual([]);
  });

  for (const cmd of [
    "bun install",
    "bun run dev",
    "bun run test",
    "bun run e2e",
    "bun run typecheck",
  ])
    test(`README tells the reader to run \`${cmd}\``, () => {
      expect(README).toContain(cmd);
    });
});

describe("links", () => {
  test("docs/DEMO.md exists", () => {
    expect(existsSync(join(ROOT, "docs/DEMO.md"))).toBe(true);
  });

  test("every relative link and image target resolves to a file", () => {
    const broken: string[] = [];
    for (const [file, text] of Object.entries(DOCS))
      for (const m of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = m[1];
        if (/^(https?:|#|mailto:)/.test(target)) continue;
        const path = decodeURI(target.split("#")[0]);
        if (!existsSync(resolve(ROOT, dirname(file), path))) broken.push(`${file}: ${target}`);
      }
    expect(broken).toEqual([]);
  });

  for (const target of ["docs/DEMO.md", "LICENSE", "fixtures/LICENSE.txt"])
    test(`README links to ${target}`, () => {
      expect(README).toMatch(new RegExp(`\\]\\((\\./)?${target.replace(/[.]/g, "\\.")}(#[^)]*)?\\)`));
    });
});

describe("no medical wording", () => {
  for (const [file, text] of Object.entries(DOCS))
    test(`${file} contains no banned words`, () => {
      expect(text).not.toBe(""); // a missing doc must not pass vacuously
      expect(findBannedWords(text)).toEqual([]);
    });
});
