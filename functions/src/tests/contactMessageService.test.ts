import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  CONTACT_LIMITS,
  buildContactEmail,
  clientIp,
  escapeHtml,
  hashIp,
  isSpamSubmission,
  nextRateWindow,
  normaliseTopic,
  validateContactMessage,
} from "../services/contactMessageService";

const good = {
  name: "  Nethmi   Perera ",
  email: "Nethmi@Example.com",
  topic: "Partnership",
  subject: "University pilot",
  message: "Hello team,\r\nwe would like to try Amica with our students.",
  consent: true,
};

test("accepts a good message and cleans it", () => {
  const r = validateContactMessage(good);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.name, "Nethmi Perera");
  assert.equal(r.value.email, "nethmi@example.com");
  assert.equal(r.value.topic, "Partnership");
  assert.equal(r.value.message, "Hello team,\nwe would like to try Amica with our students.");
});

test("field names are case-insensitive and subject defaults from topic", () => {
  const r = validateContactMessage({ Name: "A", Email: "a@b.co", Message: "long enough message", Topic: "Press" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.subject, "Press enquiry");
});

test("rejects missing or bad fields with readable errors", () => {
  const r = validateContactMessage({ name: "", email: "not-an-email", message: "hi" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.errors.length, 3);
});

test("rejects a message that is too long, and a refused consent", () => {
  const long = validateContactMessage({ ...good, message: "x".repeat(CONTACT_LIMITS.messageMax + 1) });
  assert.equal(long.ok, false);
  const noConsent = validateContactMessage({ ...good, consent: false });
  assert.equal(noConsent.ok, false);
});

test("header injection characters are stripped from one-line fields", () => {
  const r = validateContactMessage({ ...good, subject: "Hi\r\nBcc: evil@x.com" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.subject, "Hi Bcc: evil@x.com");
  assert.equal(validateContactMessage({ ...good, email: "a@b.co\nBcc:x@y.z" }).ok, false);
});

test("unknown topics become Other", () => {
  assert.equal(normaliseTopic("Hacking"), "Other");
  assert.equal(normaliseTopic("Early access"), "Early access");
});

test("honeypot detects bots", () => {
  assert.equal(isSpamSubmission({ _honey: "http://spam" }), true);
  assert.equal(isSpamSubmission({ _honey: "" }), false);
  assert.equal(isSpamSubmission({}), false);
});

test("rate window allows the limit then blocks until the window resets", () => {
  let w = nextRateWindow(undefined, 0, 2, 1000);
  assert.ok(w.allowed);
  w = nextRateWindow(w.window, 10, 2, 1000);
  assert.ok(w.allowed);
  const blocked = nextRateWindow(w.window, 20, 2, 1000);
  assert.equal(blocked.allowed, false);
  const reset = nextRateWindow(w.window, 1000, 2, 1000);
  assert.ok(reset.allowed);
  assert.equal(reset.window.count, 1);
});

test("ip is hashed, never stored raw", () => {
  const h = hashIp("203.0.113.9");
  assert.match(h, /^[a-f0-9]{32}$/);
  assert.notEqual(h, hashIp("203.0.113.10"));
  assert.equal(clientIp("203.0.113.9, 10.0.0.1", "1.1.1.1"), "203.0.113.9");
  assert.equal(clientIp(undefined, "1.1.1.1"), "1.1.1.1");
});

test("email escapes HTML and carries reply-to", () => {
  const r = validateContactMessage({ ...good, message: "<script>alert(1)</script> hello there" });
  assert.ok(r.ok);
  if (!r.ok) return;
  const mail = buildContactEmail(r.value, { id: "abc", receivedAt: new Date("2026-09-24T05:00:00Z") });
  assert.equal(mail.subject, "[Amica website] Partnership: University pilot");
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.deepEqual(mail.replyTo, { name: "Nethmi Perera", address: "nethmi@example.com" });
  assert.ok(mail.text.includes("contact_messages/abc"));
  assert.equal(escapeHtml(`"'&`), "&quot;&#39;&amp;");
});
