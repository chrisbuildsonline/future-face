// Builds the image, runs the full suite in a named container, and checks the log.
// The log goes through a file + docker cp because `docker run --rm` can lose
// container stdout on some hosts.
import { mkdirSync, readFileSync } from "node:fs";

const NAME = "future-face-suite";
const IMAGE = "future-face";
const LOG = "test-results/docker-suite.log";

function docker(args: string[], opts: { inherit?: boolean } = {}) {
  const r = Bun.spawnSync(["docker", ...args], {
    stdout: opts.inherit ? "inherit" : "pipe",
    stderr: opts.inherit ? "inherit" : "pipe",
  });
  return r.exitCode;
}

function fail(msg: string): never {
  console.error(`docker:test FAILED: ${msg}`);
  process.exit(1);
}

if (docker(["build", "-t", IMAGE, "."], { inherit: true }) !== 0) fail("image build");

docker(["rm", "-f", NAME]);

const script = [
  "bun run test > /app/suite.log 2>&1; echo test_exit=$? >> /app/suite.log",
  "bun run typecheck >> /app/suite.log 2>&1; echo typecheck_exit=$? >> /app/suite.log",
  "bun run e2e >> /app/suite.log 2>&1; echo e2e_exit=$? >> /app/suite.log",
].join("; ");

const runExit = docker(["run", "--name", NAME, IMAGE, "sh", "-c", script], { inherit: true });

mkdirSync("test-results", { recursive: true });
const cpExit = docker(["cp", `${NAME}:/app/suite.log`, LOG]);
docker(["rm", "-f", NAME]);
if (cpExit !== 0) fail(`could not copy log out of container (docker run exit ${runExit})`);

const log = readFileSync(LOG, "utf8");
console.log(log);

const problems: string[] = [];
for (const k of ["test", "typecheck", "e2e"]) {
  if (!new RegExp(`^${k}_exit=0$`, "m").test(log)) problems.push(`${k}_exit is not 0`);
}
if (!/^\s*0 fail\b/m.test(log)) problems.push("bun test did not report 0 fail");
if (!/^\s*\d+ passed\b/m.test(log)) problems.push("Playwright reported no passed tests");
if (/^\s*\d+ failed\b/m.test(log)) problems.push("Playwright reported failed tests");

if (problems.length) fail(problems.join("; "));
console.log("docker:test OK");
