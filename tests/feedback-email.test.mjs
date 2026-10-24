import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as emailModule from "../api/_feedbackEmail.js";

const feedback = { id: "feedback-1", body: "Can you add <swing>?", admin_reply: "Yes, thanks!", author_label: "Alex" };

function mockDatabase() {
  const state = { calls: [], claims: new Map(), contact: "alex@example.com", rows: [feedback], failedUpdate: false };
  const database = {
    state,
    async rpc(name, args) {
      state.calls.push({ rpc: name, args });
      if (name === "submit_feedback_with_contact") return { data: "new-feedback", error: null };
      const key = args.p_reply_hash;
      const status = state.claims.get(key);
      if (status === "sent" || status === "pending") return { data: status };
      state.claims.set(key, "pending");
      return { data: "send" };
    },
    from(table) {
      const call = { table, filters: [] };
      state.calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return query; },
        update(patch) { call.patch = patch; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        gte() { return query; }, in() { return query; }, order() { return query; }, limit() { return query; },
        maybeSingle() { call.single = true; return query; },
        then(resolve, reject) {
          if (table === "feedback_reply_emails" && call.patch) {
            const hash = call.filters.find(([key]) => key === "reply_hash")?.[1];
            if (!state.failedUpdate) state.claims.set(hash, call.patch.status);
          }
          let data = [];
          if (table === "feedback_items") data = call.single ? { ...feedback, ...call.patch } : state.rows;
          if (table === "feedback_contacts") data = call.single ? { email: state.contact } : [{ feedback_id: feedback.id, email: state.contact }];
          return Promise.resolve({ data, count: 0, error: state.failedUpdate && call.patch ? { message: "Database unavailable" } : null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return database;
}

async function makeHandler(database, isAdmin = false) {
  const context = vm.createContext({ Buffer, console });
  const source = await readFile(new URL("../api/feedback.js", import.meta.url), "utf8");
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    const values = specifier === "./_supabaseAdmin.js"
      ? { supabaseAdmin: database, hasSupabaseAdmin: true, getRequestUser: async () => ({ user: isAdmin ? { id: "admin" } : null, isAdmin }) }
      : emailModule;
    return new vm.SyntheticModule(Object.keys(values), function () {
      Object.entries(values).forEach(([key, value]) => this.setExport(key, value));
    }, { context });
  });
  await module.evaluate();
  return async (method, body = {}) => {
    const response = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await module.namespace.default({ method, body, headers: { "x-feedback-fingerprint": "visitor" }, query: {} }, response);
    return response;
  };
}

test("email validation is optional and rejects malformed addresses/header injection", () => {
  assert.equal(emailModule.normalizeContactEmail(""), "");
  assert.equal(emailModule.normalizeContactEmail(" Alex@example.com "), "Alex@example.com");
  for (const value of ["bad", "alex@example.com\r\nBcc: other@example.com", "a".repeat(255) + "@example.com"]) {
    assert.throws(() => emailModule.normalizeContactEmail(value));
  }
});

test("email contains question and full answer, escaping user HTML", () => {
  const message = emailModule.buildFeedbackEmail({ name: "<Alex>", question: feedback.body, answer: "<script>bad()</script>\nFull answer" });
  assert.ok(message.text.includes(feedback.body));
  assert.ok(message.text.includes("Full answer"));
  assert.ok(message.html.includes("&lt;script&gt;"));
  assert.ok(!message.html.includes("<script>"));
  assert.ok(message.html.includes("https://onlinedrumnotation.com/"));
});

test("anonymous submission stores optional contacts through the private transaction", async () => {
  const database = mockDatabase();
  const handler = await makeHandler(database);
  const response = await handler("POST", { action: "submit", body: "My feedback", name: " Alex ", email: "alex@example.com" });
  assert.equal(response.code, 200);
  const submission = database.state.calls.find((call) => call.rpc === "submit_feedback_with_contact");
  assert.equal(submission.args.p_email, "alex@example.com");
  assert.equal(submission.args.p_item.author_label, "Alex");
  assert.equal(submission.args.p_item.user_id, null);
  assert.equal(submission.args.p_item.email, undefined);
});

test("invalid email is rejected without storing feedback", async () => {
  const database = mockDatabase();
  const handler = await makeHandler(database);
  assert.equal((await handler("POST", { action: "submit", body: "Feedback", email: "broken" })).code, 400);
  assert.ok(!database.state.calls.some((call) => call.rpc));
});

test("name and email remain optional for anonymous feedback", async () => {
  const database = mockDatabase();
  const response = await (await makeHandler(database))("POST", { action: "submit", body: "A quick idea" });
  assert.equal(response.code, 200);
  const submission = database.state.calls.find((call) => call.rpc === "submit_feedback_with_contact");
  assert.equal(submission.args.p_email, null);
  assert.equal(submission.args.p_item.author_label, "Anonymous");
});

test("public listing does not query contacts or notification records", async () => {
  const database = mockDatabase();
  const response = await (await makeHandler(database))("GET");
  assert.equal(response.code, 200);
  assert.ok(!JSON.stringify(response.data).includes("alex@example.com"));
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.ok(!database.state.calls.some((call) => ["feedback_contacts", "feedback_reply_emails"].includes(call.table)));
  assert.ok(database.state.calls.find((call) => call.table === "feedback_items").filters.some(([key, value]) => key === "is_public" && value === true));
});

test("admin listing includes private contact and notification status", async () => {
  const response = await (await makeHandler(mockDatabase(), true))("GET");
  assert.equal(response.data.items[0].contact_email, "alex@example.com");
});

test("anonymous visitors cannot moderate or send emails", async () => {
  const database = mockDatabase();
  const response = await (await makeHandler(database))("POST", { action: "moderate", feedbackId: feedback.id, adminReply: "Hi", sendEmail: true });
  assert.equal(response.code, 403);
  assert.equal(database.state.calls.length, 0);
});

test("visibility and status changes never send email", async () => {
  const database = mockDatabase();
  const response = await (await makeHandler(database, true))("POST", { action: "moderate", feedbackId: feedback.id, makePublic: true, resolutionStatus: "done" });
  assert.equal(response.code, 200);
  assert.ok(!database.state.calls.some((call) => call.rpc || call.table === "feedback_contacts"));
});

test("send preserves reply on failure, retries safely and deduplicates identical replies", async (t) => {
  const previousFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  const oldFrom = process.env.FEEDBACK_EMAIL_FROM;
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (oldKey == null) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldFrom == null) delete process.env.FEEDBACK_EMAIL_FROM; else process.env.FEEDBACK_EMAIL_FROM = oldFrom;
  });
  process.env.RESEND_API_KEY = "test-key";
  process.env.FEEDBACK_EMAIL_FROM = "Arne <notifications@example.com>";
  let requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return { ok: requests.length !== 1, json: async () => requests.length === 1 ? { message: "failure" } : { id: "email-1" } };
  };
  const database = mockDatabase();
  const handler = await makeHandler(database, true);
  const payload = { action: "moderate", feedbackId: feedback.id, adminReply: "Full reply", sendEmail: true };
  const failed = await handler("POST", payload);
  assert.equal(failed.data.notification.status, "failed");
  assert.ok(database.state.calls.some((call) => call.table === "feedback_items" && call.patch?.admin_reply === "Full reply"));
  const sent = await handler("POST", payload);
  assert.equal(sent.data.notification.status, "sent");
  const repeated = await handler("POST", payload);
  assert.equal(repeated.data.notification.status, "sent");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers["Idempotency-Key"], requests[1].headers["Idempotency-Key"]);
  assert.ok(JSON.parse(requests[1].body).text.includes("Full reply"));
  assert.ok(JSON.parse(requests[1].body).text.includes(feedback.body));
  const pendingDatabase = mockDatabase();
  pendingDatabase.rpc = async () => ({ data: "pending" });
  assert.equal((await emailModule.emailFeedbackReply(pendingDatabase, feedback, "alex@example.com")).status, "pending");
  assert.equal(requests.length, 2);
  pendingDatabase.rpc = async () => ({ data: "expired" });
  assert.equal((await emailModule.emailFeedbackReply(pendingDatabase, feedback, "alex@example.com")).status, "failed");
  assert.equal(requests.length, 2);
  delete process.env.RESEND_API_KEY;
  const missingConfig = await handler("POST", { ...payload, adminReply: "Another reply" });
  assert.equal(missingConfig.data.notification.status, "failed");
  assert.equal(requests.length, 2);
});

test("private tables have RLS and no client grants", async () => {
  const sql = await readFile(new URL("../supabase-feedback-email.sql", import.meta.url), "utf8");
  for (const table of ["feedback_contacts", "feedback_reply_emails"]) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security`));
  }
  assert.ok(sql.includes("from public, anon, authenticated"));
  assert.ok(sql.includes("on delete cascade"));
});
