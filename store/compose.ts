// Thin docker compose wrapper shared by setup.ts and seed.ts.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const STORE_DIR = import.meta.dir;
export const REPO_DIR = resolve(STORE_DIR, "..");
export const STORE_URL = "http://localhost:8080";
const COMPOSE_FILE = resolve(STORE_DIR, "docker-compose.yml");

export async function compose(args: string[], opts: { quiet?: boolean } = {}) {
  const proc = Bun.spawn(["docker", "compose", "-f", COMPOSE_FILE, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (!opts.quiet) {
    if (out) process.stdout.write(out);
    if (err) process.stderr.write(err);
  }
  return { code, out, err };
}

/** Copy a host file or directory contents (`dir/.`) into the cli container. */
export async function copyIn(src: string, dest: string) {
  const r = await compose(["cp", src, `cli:${dest}`], { quiet: true });
  if (r.code !== 0) throw new Error(`copy ${src} -> ${dest} failed:\n${r.err}`);
}

/**
 * Run one wp-cli command in the cli container; `out` is its combined output.
 * Container stdout can be lost on some hosts, so the output goes to a file in the
 * container and is copied out.
 */
export async function wp(args: string[]) {
  const log = `/tmp/wp-${Date.now()}.log`;
  // The exit code is appended to the file too: exec's own exit code is not reliable here.
  const script = `wp "$@" > ${log} 2>&1; echo "__exit=$?" >> ${log}; sync`;
  const r = await compose(["exec", "-T", "cli", "sh", "-c", script, "sh", ...args], { quiet: true });
  // On this host exec can return before the command finishes, so poll for the marker (up to 5 minutes).
  const dest = join(mkdtempSync(join(tmpdir(), "ff-wp-")), "wp.log");
  let raw = "";
  for (let i = 0; i < 300 && !/__exit=\d+\s*$/.test(raw); i++) {
    if (i) await Bun.sleep(1000);
    if ((await compose(["cp", `cli:${log}`, dest], { quiet: true })).code === 0) raw = readFileSync(dest, "utf8");
  }
  const m = raw.match(/__exit=(\d+)\s*$/);
  return { code: m ? Number(m[1]) : 1, out: raw.replace(/__exit=\d+\s*$/, ""), err: r.err };
}
