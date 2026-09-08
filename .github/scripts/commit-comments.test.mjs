import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  MARKER,
  changeRows,
  detectAddedEvents,
  detectFromGit,
  findingLines,
  renderComment,
  upsertComment,
  validateEvent,
} from "./commit-comments.mjs";

const eventPath = "2026/09/08/03-42-18Z_build_version-abcdef/event.json";
const baseEvent = (product = "Studio", values = {}) => ({
  schemaVersion: 1,
  type: "build.changed",
  observedAt: "2026-09-08T03:42:18Z",
  upstreamChange: true,
  target: product === "Studio" ? "WindowsStudio64" : "WindowsPlayer",
  product,
  version: "0.738.0.7381234",
  guid: "version-abcdef1234567890",
  surfaces: ["Build", "API"],
  archivePath: eventPath.replace("/event.json", ""),
  ...values,
});
const changes = (surface = "API") => ({
  schemaVersion: 1,
  datasets: {
    [surface]: {
      files: {
        added: ["added", "metadata.json"],
        changed: ["changed"],
        removed: ["removed"],
      },
      semantic: null,
    },
  },
});
const render = (
  event,
  data = changes(),
  findings = "# Findings\n\n- + `SomeNewClass`\n",
) =>
  renderComment({
    event,
    changes: data,
    findings,
    serverUrl: "https://example.test",
    repository: "Moraine/Data",
    sha: "a".repeat(40),
  });

test("BUILD Studio and Player comments contain build identity", () => {
  for (const product of ["Studio", "Player"]) {
    const body = render(baseEvent(product));
    assert.match(body, new RegExp(`## ${product} Datamining`));
    assert.match(body, /0\.738\.0\.7381234/);
    assert.match(body, /version-abcdef1234567890/);
  }
});

test("LIVE, Web, API and Plugins labels render", () => {
  for (const [type, surface, label] of [
    ["live-settings.changed", "LiveSettings", "LIVE settings update"],
    ["web.changed", "Web", "Web update"],
    ["studio-api.changed", "API", "API update"],
    ["plugins.changed", "Plugins", "Plugins update"],
  ]) {
    const event = baseEvent(
      surface === "API" || surface === "Plugins" ? "Studio" : "Player",
      { type, surfaces: [surface] },
    );
    assert.match(render(event, changes(surface)), new RegExp(label));
  }
});

test("event without findings remains compact", () => {
  assert.match(
    render(
      baseEvent(),
      changes(),
      "# Findings\n\nNo strong cross-surface correlations in this event.\n",
    ),
    /No strong cross-surface correlations/,
  );
});

test("1000 findings are capped at 20", () => {
  const findings = Array.from(
    { length: 1000 },
    (_, index) => `- \`finding-${index}\``,
  ).join("\n");
  const selected = findingLines(findings);
  assert.equal(selected.shown.length, 20);
  assert.equal(selected.remaining, 980);
  assert.match(
    render(baseEvent(), changes(), findings),
    /\.\.\. and 980 more findings/,
  );
});

test("approved quarantined and redacted representations stay redacted", () => {
  const body = render(
    baseEvent(),
    changes(),
    "- `[REDACTED]`\n- `quarantined: sha256:abc`\n",
  );
  assert.match(body, /\[REDACTED\]/);
  assert.match(body, /quarantined: sha256:abc/);
  assert.doesNotMatch(body, /Bearer |password=/i);
});

test("invalid event.json is rejected", () => {
  for (const invalid of [
    { ...baseEvent(), type: "baseline" },
    { ...baseEvent(), observedAt: "invalid" },
    { ...baseEvent(), archivePath: "wrong" },
    { ...baseEvent(), surfaces: [] },
  ])
    assert.throws(() => validateEvent(invalid, eventPath));
});

test("baseline and upstreamChange=false are rejected", () => {
  assert.throws(() =>
    validateEvent(
      baseEvent("Studio", { type: "baseline", upstreamChange: false }),
      eventPath,
    ),
  );
  assert.throws(() =>
    validateEvent(baseEvent("Studio", { upstreamChange: false }), eventPath),
  );
});

test("zero and two new events are distinguishable", () => {
  assert.deepEqual(detectAddedEvents(["README.md"]), []);
  assert.equal(
    detectAddedEvents([eventPath, "2027/01/02/x/event.json"]).length,
    2,
  );
});

test("semantic and file deltas use + ~ - counts", () => {
  const rows = changeRows(changes());
  assert.deepEqual(rows[0], {
    surface: "API",
    label: "API",
    added: 1,
    changed: 1,
    removed: 1,
  });
  const semantic = changeRows({
    datasets: {
      API: {
        semantic: { classes: { added: [1], changed: [2], removed: [3] } },
      },
    },
  });
  assert.equal(semantic[0].label, "API Classes");
  const zeroSemantic = changeRows({
    datasets: {
      InExperience: {
        files: {
          added: ["latest-asset.json"],
          changed: ["instances.json"],
          removed: [],
        },
        semantic: { sources: { added: [], changed: [], removed: [] } },
      },
    },
  });
  assert.deepEqual(zeroSemantic[0], {
    surface: "InExperience",
    label: "InExperience",
    added: 1,
    changed: 1,
    removed: 0,
  });
});

test("rerun updates the marker comment instead of duplicating it", async () => {
  const calls = [];
  const result = await upsertComment({
    comments: [{ id: 7, body: `${MARKER}\nold` }],
    body: "new",
    create: () => calls.push("create"),
    update: (id, body) => calls.push(["update", id, body]),
  });
  assert.equal(result, "updated");
  assert.deepEqual(calls, [["update", 7, "new"]]);
});

test("first run creates one marker comment", async () => {
  const calls = [];
  const result = await upsertComment({
    comments: [],
    body: `${MARKER}\nnew`,
    create: (body) => calls.push(body),
    update: () => calls.push("update"),
  });
  assert.equal(result, "created");
  assert.equal(calls.length, 1);
});

test("event link is pinned to the pushed SHA", () => {
  assert.match(
    render(baseEvent()),
    new RegExp(
      `tree/${"a".repeat(40)}/2026/09/08/03-42-18Z_build_version-abcdef`,
    ),
  );
});

test("temporary Git repository detects one real event with +1 ~1 -1", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "moraine-comment-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  await writeFile(path.join(root, "README.md"), "baseline\n");
  git("add", ".");
  git("commit", "-m", "baseline");
  const before = git("rev-parse", "HEAD");
  const directory = path.join(root, path.dirname(eventPath));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(root, eventPath), JSON.stringify(baseEvent()));
  await writeFile(
    path.join(directory, "changes.json"),
    JSON.stringify(changes("Web")),
  );
  await writeFile(path.join(directory, "findings.md"), "# Findings\n");
  await writeFile(path.join(directory, "provenance.json"), "{}");
  git("add", ".");
  git("commit", "-m", "8 September 2026 - Web update");
  const after = git("rev-parse", "HEAD");
  assert.deepEqual(detectFromGit(before, after, root), [eventPath]);
  assert.equal(
    git("log", "-1", "--format=%s"),
    "8 September 2026 - Web update",
  );
  assert.deepEqual(changeRows(changes("Web"))[0], {
    surface: "Web",
    label: "Web",
    added: 1,
    changed: 1,
    removed: 1,
  });
});
