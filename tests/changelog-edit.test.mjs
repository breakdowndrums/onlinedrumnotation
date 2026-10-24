import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function setup({ admin = true, missing = false, failure = false } = {}) {
  const calls = [];
  const database = { from(table) {
    const query = {
      update(patch) { calls.push({ table, patch }); return query; },
      eq(key, value) { calls.at(-1).filter = [key, value]; return query; },
      select() { return query; },
      async maybeSingle() { return { data: missing ? null : { id: "entry-1" }, error: failure ? { message: "Database failed" } : null }; },
    };
    return query;
  } };
  const context = vm.createContext({ Buffer });
  const source = await readFile(new URL("../api/changelog.js", import.meta.url), "utf8");
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => new vm.SyntheticModule(["getRequestUser", "hasSupabaseAdmin", "supabaseAdmin"], function () {
    this.setExport("getRequestUser", async () => ({ isAdmin: admin }));
    this.setExport("hasSupabaseAdmin", true);
    this.setExport("supabaseAdmin", database);
  }, { context }));
  await module.evaluate();
  return { calls, async update(overrides = {}) {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await module.namespace.default({ method: "POST", body: {
      action: "update", changelogId: "entry-1", title: " Oct 24, 2026 ", body: " Updated changelog text ", ...overrides,
    } }, response);
    return response;
  } };
}

test("admin edits title and body without republishing the changelog", async () => {
  const h = await setup();
  assert.equal((await h.update()).code, 200);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].patch.title, "Oct 24, 2026");
  assert.equal(h.calls[0].patch.body, "Updated changelog text");
  assert.deepEqual(Object.keys(h.calls[0].patch).sort(), ["body", "title", "updated_at"]);
  assert.deepEqual(h.calls[0].filter, ["id", "entry-1"]);
});

test("non-admins cannot edit changelog entries", async () => {
  const h = await setup({ admin: false });
  assert.equal((await h.update()).code, 403);
  assert.equal(h.calls.length, 0);
});

test("changelog editing validates id, title and body before writing", async () => {
  const h = await setup();
  for (const patch of [{ changelogId: "" }, { title: " " }, { title: "a".repeat(121) }, { title: null }, { body: "ab" }, { body: "a".repeat(2001) }, { body: 123 }]) {
    assert.equal((await h.update(patch)).code, 400);
  }
  assert.equal(h.calls.length, 0);
});

test("missing changelog entries and database errors are reported", async () => {
  assert.equal((await (await setup({ missing: true })).update()).code, 404);
  assert.equal((await (await setup({ failure: true })).update()).code, 500);
});
