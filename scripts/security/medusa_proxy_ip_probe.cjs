// Exercise the installed Express dependency with a one-hop loopback proxy.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { createRequire } = require("node:module");
const { once } = require("node:events");
const { test } = require("node:test");

test("locked Express resolves the fixed proxy dependency and attributes trusted edge traffic", async (t) => {
  assert.ok(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
  const backend = path.join(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR, "apps/backend/package.json");
  const requireBackend = createRequire(backend);
  const requireCli = createRequire(requireBackend.resolve("@medusajs/cli/package.json"));
  const requireFramework = createRequire(requireBackend.resolve("@medusajs/framework/http"));
  for (const resolveFrom of [requireCli, requireFramework]) {
    const requireExpress = createRequire(resolveFrom.resolve("express/package.json"));
    assert.equal(requireExpress("proxy-addr/package.json").version, "2.0.8");
  }

  const app = requireFramework("express")();
  app.set("trust proxy", 1);
  app.get("/", (req, res) => res.json({ ip: req.ip, peers: req.ips }));

  const origin = app.listen(0, "127.0.0.1");
  t.after(() => origin.close());
  await once(origin, "listening");

  const proxy = http.createServer((req, res) => {
    const upstream = http.get({
      host: "127.0.0.1",
      port: origin.address().port,
      headers: { "x-forwarded-for": req.socket.remoteAddress },
    }, (response) => response.pipe(res));
    upstream.on("error", () => res.writeHead(502).end());
  });
  proxy.listen(0, "127.0.0.1");
  t.after(() => proxy.close());
  await once(proxy, "listening");

  // Give the client and proxy different loopback addresses.
  const throughProxy = await new Promise((resolve, reject) => {
    http.get({
      host: "127.0.0.1",
      localAddress: "127.0.0.2",
      port: proxy.address().port,
      headers: { "x-forwarded-for": "192.0.2.40" },
    }, async (res) => {
      res.setEncoding("utf8");
      let body = "";
      try {
        for await (const chunk of res) body += chunk;
        assert.equal(res.statusCode, 200);
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    }).on("error", reject);
  });
  assert.deepEqual(throughProxy, { ip: "127.0.0.2", peers: ["127.0.0.2"] });

  const direct = await fetch(`http://127.0.0.1:${origin.address().port}/`);
  assert.equal(direct.status, 200);
  assert.deepEqual(await direct.json(), { ip: "127.0.0.1", peers: [] });
});
