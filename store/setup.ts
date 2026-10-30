// bun run store [-- --url <app address>]: start WordPress + MariaDB, install WooCommerce and our plugin, seed the products.
// Safe to rerun. `bun run store:down` stops the containers (data volumes are kept).
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { ffUrl } from "./args";
import { compose, copyIn, STORE_DIR, STORE_URL, wp } from "./compose";
import { seed } from "./seed";

const SITE_TITLE = "Sunday Pharmacy (demo store)";
const TAGLINE = "Sun care for every UV day";
let FF_URL = "";
try { FF_URL = ffUrl(process.argv.slice(2), process.env.FF_URL); } catch (e) { console.error((e as Error).message); process.exit(1); }

async function wpOk(args: string[]) {
  return (await wp(args)).code === 0;
}

async function must(args: string[]) {
  const r = await wp(args);
  if (r.code !== 0) throw new Error(`wp ${args.join(" ")} failed:\n${r.out}${r.err}`);
  return r.out.trim();
}

async function waitForSite() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(STORE_URL, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {}
    await Bun.sleep(2000);
  }
  throw new Error(`${STORE_URL} did not answer in 3 minutes`);
}

if (process.argv[2] === "down") {
  process.exit((await compose(["down"])).code);
}

if ((await compose(["up", "-d", "--quiet-pull", "db", "wordpress", "cli"])).code !== 0) throw new Error("docker compose up failed");
console.log("waiting for WordPress...");
await waitForSite();

// Copied in (not bind-mounted) so it also works when the Docker daemon cannot see this repo.
await copyIn(resolve(STORE_DIR, "future-face-woocommerce"), "/var/www/html/wp-content/plugins");

// wp-config.php is written by the wordpress container on first start; wait for the database too.
for (let i = 0; i < 30 && !(await wpOk(["db", "check"])); i++) await Bun.sleep(2000);

const envPassword = process.env.FF_STORE_ADMIN_PASSWORD;
if (!(await wpOk(["core", "is-installed"]))) {
  const password = envPassword || randomBytes(12).toString("base64url");
  await must([
    "core", "install", `--url=${STORE_URL}`, `--title=${SITE_TITLE}`,
    "--admin_user=admin", `--admin_password=${password}`, "--admin_email=admin@example.com", "--skip-email",
  ]);
  console.log(`admin login: admin / ${envPassword ? "(FF_STORE_ADMIN_PASSWORD)" : password}`);
  if (!envPassword) console.log("(random password, printed once; set FF_STORE_ADMIN_PASSWORD to choose your own)");
} else if (envPassword) {
  await must(["user", "update", "admin", `--user_pass=${envPassword}`]);
}

await must(["option", "update", "blogname", SITE_TITLE]);
await must(["option", "update", "blogdescription", TAGLINE]);
await must(["option", "update", "ff_wc_url", FF_URL]);
await must(["rewrite", "structure", "/%postname%/", "--hard"]);

if (!(await wpOk(["plugin", "is-installed", "woocommerce"]))) {
  console.log("installing WooCommerce...");
  await must(["plugin", "install", "woocommerce"]);
}
await must(["plugin", "activate", "woocommerce"]);
await must(["plugin", "activate", "future-face-woocommerce"]); // needs WooCommerce active first

// WooCommerce's built-in demo-store banner labels the shop as a demo.
await must(["option", "update", "woocommerce_demo_store", "yes"]);
await must(["option", "update", "woocommerce_demo_store_notice", "Demo store: nothing here is for sale. Prices are placeholders."]);

// WordPress's install-time sample content: the "Hello world!" post and the "Sample Page" nav entry.
const sample = await must(["post", "list", "--post_type=any", "--fields=ID,post_title", "--format=csv"]);
for (const line of sample.split("\n").slice(1)) {
  const [id, ...title] = line.split(",");
  if (/^"?(Hello world!|Sample Page|Sample)"?$/.test(title.join(",").trim())) await must(["post", "delete", id, "--force"]);
}

console.log("seeding products...");
const url = await seed();
console.log(`\nStore: ${STORE_URL}\nSPF 50 product: ${url}\nAdmin: ${STORE_URL}/wp-admin (user: admin)`);
