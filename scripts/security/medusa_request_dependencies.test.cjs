const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");

assert.ok(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const backend = path.join(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR, "apps/backend/package.json");
const requireBackend = createRequire(backend);
const requireFramework = createRequire(requireBackend.resolve("@medusajs/framework/http"));

test("Express keeps JSON, form and original webhook bytes with the locked parser", async (t) => {
  const express = requireFramework("express");
  const requireExpress = createRequire(requireFramework.resolve("express/package.json"));
  assert.equal(requireExpress("body-parser/package.json").version, "1.20.9");

  const app = express();
  app.post("/json", express.json(), (req, res) => res.json(req.body));
  app.post("/form", express.urlencoded({ extended: true }), (req, res) => res.json(req.body));
  app.post("/webhook", express.json({
    verify(req, _res, buffer) {
      req.rawBody = buffer;
    },
  }), (req, res) => res.type("text/plain").send(req.rawBody.toString("utf8")));
  app.use((error, _req, res, _next) => res.sendStatus(error.status ?? 500));

  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await once(server, "listening");
  const post = (route, type, body) => fetch(`http://127.0.0.1:${server.address().port}/${route}`, {
    method: "POST", headers: { "content-type": type }, body,
  });

  const json = await post("json", "application/json", '{"quantity":2}');
  assert.equal(json.status, 200);
  assert.deepEqual(await json.json(), { quantity: 2 });

  const form = await post("form", "application/x-www-form-urlencoded", "order[currency]=ALL");
  assert.equal(form.status, 200);
  assert.deepEqual(await form.json(), { order: { currency: "ALL" } });

  const webhookBody = '{ "currency": "ALL", "reference": "provë" }\n';
  const webhook = await post("webhook", "application/json", webhookBody);
  assert.equal(webhook.status, 200);
  assert.equal(await webhook.text(), webhookBody);

  const invalid = await post("json", "application/json", "{");
  assert.equal(invalid.status, 400);
  await invalid.text();
});

test("backend and public Medusa schemas accept and reject ordinary order input", () => {
  assert.equal(requireBackend("zod/package.json").version, "4.6.6");
  for (const { z } of [requireBackend("zod"), requireBackend("@medusajs/framework/zod")]) {
    const order = z.object({
      currency: z.enum(["ALL", "EUR"]),
      items: z.array(z.object({ quantity: z.number().int().positive() })).min(1).max(2),
    });
    assert.deepEqual(order.parse({ currency: "ALL", items: [{ quantity: 2 }] }), {
      currency: "ALL", items: [{ quantity: 2 }],
    });
    assert.equal(order.safeParse({ currency: "ALL", items: [{ quantity: 0 }] }).success, false);
    assert.equal(order.safeParse({ currency: "ALL", items: [] }).success, false);
  }
});
