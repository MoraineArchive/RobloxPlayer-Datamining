import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const MARKER = "<!-- moraine-datamining-commit-comment -->";
const EVENT_PATH = /^\d{4}\/\d{2}\/\d{2}\/([^/]+)\/event\.json$/;

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const clean = (value) => String(value ?? "").replace(/[\r\n`]/g, "");
const count = (values) =>
  Array.isArray(values)
    ? values.filter((value) => value !== "metadata.json").length
    : 0;

export function detectAddedEvents(files) {
  return files.filter((file) => EVENT_PATH.test(file.replaceAll("\\", "/")));
}

export function detectFromGit(before, after, cwd = process.cwd()) {
  if (!/^[0-9a-f]{40}$/i.test(before) || !/^[0-9a-f]{40}$/i.test(after))
    throw new Error("Push range must contain full Git SHAs");
  const output = execFileSync(
    "git",
    ["diff", "--diff-filter=A", "--name-only", before, after],
    { cwd, encoding: "utf8" },
  );
  return detectAddedEvents(output.split(/\r?\n/).filter(Boolean));
}

export function validateEvent(event, eventFile) {
  const normalized = eventFile.replaceAll("\\", "/");
  const match = normalized.match(EVENT_PATH);
  if (!match) throw new Error(`Invalid event path: ${normalized}`);
  const archivePath = normalized.slice(0, -"/event.json".length);
  if (!event || typeof event !== "object")
    throw new Error("event.json must be an object");
  if (typeof event.type !== "string" || !event.type.endsWith(".changed"))
    throw new Error("event.json has an invalid type");
  if (Number.isNaN(Date.parse(event.observedAt)))
    throw new Error("event.json has an invalid observedAt");
  if (event.upstreamChange !== true)
    throw new Error("event.json is not an upstream change");
  if (event.archivePath !== archivePath)
    throw new Error("event.json archivePath does not match its directory");
  if (!Array.isArray(event.surfaces) || event.surfaces.length === 0)
    throw new Error("event.json has no surfaces");
  if (
    typeof event.product !== "string" ||
    !["Player", "Studio"].includes(event.product)
  )
    throw new Error("event.json has an invalid product");
  if (event.target !== undefined && typeof event.target !== "string")
    throw new Error("event.json has an invalid target");
  if (event.version !== undefined && typeof event.version !== "string")
    throw new Error("event.json has an invalid version");
  if (event.guid !== undefined && typeof event.guid !== "string")
    throw new Error("event.json has an invalid GUID");
  if (
    (event.type === "build.changed" || event.surfaces.includes("Build")) &&
    (!event.version || !event.guid)
  )
    throw new Error("build event has no version or GUID");
  return { ...event, archivePath };
}

function semanticRows(surface, semantic) {
  if (!semantic || typeof semantic !== "object" || Array.isArray(semantic))
    return [];
  const delta = (label, value) =>
    value &&
    typeof value === "object" &&
    [value.added, value.changed, value.removed].every(Array.isArray)
      ? {
          label,
          added: value.added.length,
          changed: value.changed.length,
          removed: value.removed.length,
        }
      : null;
  if ([semantic.added, semantic.changed, semantic.removed].every(Array.isArray))
    return [delta(surface, semantic)].filter(Boolean);
  const labels = {
    classes: "API Classes",
    members: "API Members",
    enums: "API Enums",
    sources: surface,
  };
  return Object.entries(semantic)
    .map(([name, value]) => delta(labels[name] ?? `${surface} ${name}`, value))
    .filter(Boolean);
}

export function changeRows(changes) {
  if (
    !changes ||
    typeof changes !== "object" ||
    !changes.datasets ||
    typeof changes.datasets !== "object"
  )
    throw new Error("changes.json has no datasets");
  const rows = [];
  for (const [surface, dataset] of Object.entries(changes.datasets)) {
    const semantic = semanticRows(surface, dataset?.semantic);
    if (
      semantic.length &&
      semantic.some((row) => row.added || row.changed || row.removed)
    )
      rows.push(...semantic);
    else {
      const files = dataset?.files;
      if (
        !files ||
        ![files.added, files.changed, files.removed].every(Array.isArray)
      )
        throw new Error(`changes.json has an invalid ${surface} file delta`);
      rows.push({
        surface,
        label: surface,
        added: count(files.added),
        changed: count(files.changed),
        removed: count(files.removed),
      });
    }
  }
  return rows.filter((row) => row.added || row.changed || row.removed);
}

export function findingLines(markdown, limit = 20) {
  const all = markdown
    .split(/\r?\n/)
    .filter((line) => /^- (?:\+|~|-|`)/.test(line))
    .map((line) => line.slice(0, 500));
  return {
    shown: all.slice(0, limit),
    remaining: Math.max(0, all.length - limit),
  };
}

export function renderComment({
  event,
  changes,
  findings,
  serverUrl,
  repository,
  sha,
}) {
  const rows = changeRows(changes);
  const eventUrl = `${serverUrl}/${repository}/tree/${sha}/${event.archivePath}`;
  const isBuild =
    event.type === "build.changed" || event.surfaces.includes("Build");
  const labels = {
    "live-settings.changed": "LIVE settings update",
    "web.changed": "Web update",
    "studio-api.changed": "API update",
    "plugins.changed": "Plugins update",
    "luapackages.changed": "LuaPackages update",
    "inexperience.changed": "InExperience update",
    "universal-app.changed": "UniversalApp update",
    "native.changed": "Native update",
    "fastvariables.changed": "FastVariables update",
    "datasets.changed": "Datamining update",
  };
  const lines = [MARKER, `## ${clean(event.product)} Datamining`, ""];
  if (isBuild) {
    lines.push(
      "**Build**",
      `\`${clean(event.version)}\``,
      "",
      "**GUID**",
      `\`${clean(event.guid)}\``,
      "",
    );
  } else {
    lines.push("**Event**", labels[event.type] ?? clean(event.type), "");
  }
  lines.push(
    "**Observed**",
    `\`${new Date(event.observedAt).toISOString()}\``,
    "",
    "### Changes",
    "",
    "| Surface | Added | Changed | Removed |",
    "|---|---:|---:|---:|",
    ...rows.map(
      (row) =>
        `| ${clean(row.label)} | +${row.added} | ~${row.changed} | -${row.removed} |`,
    ),
    "",
    "### Findings",
    "",
  );
  const selected = findingLines(findings);
  lines.push(
    ...(selected.shown.length
      ? selected.shown
      : ["No strong cross-surface correlations in this event."]),
  );
  if (selected.remaining)
    lines.push(`- ... and ${selected.remaining} more findings`);
  lines.push("", `**Event:** [\`${event.archivePath}/\`](${eventUrl})`, "");
  return lines.join("\n");
}

export async function upsertComment({ comments, body, create, update }) {
  const existing = comments.find((comment) => comment.body?.includes(MARKER));
  if (existing) {
    await update(existing.id, body);
    return "updated";
  }
  await create(body);
  return "created";
}

async function githubRequest(route, options = {}) {
  const response = await fetch(`${process.env.GITHUB_API_URL}${route}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

export async function run(env = process.env) {
  const files = detectFromGit(env.BEFORE_SHA, env.AFTER_SHA);
  if (files.length === 0) {
    console.log("No newly added chronological event.json; no commit comment.");
    return "skipped";
  }
  if (files.length !== 1)
    throw new Error(
      `Expected exactly one new event, found ${files.length}: ${files.join(", ")}`,
    );
  const eventFile = files[0];
  const event = validateEvent(await json(eventFile), eventFile);
  const directory = path.dirname(eventFile);
  await json(path.join(directory, "provenance.json"));
  const changes = await json(path.join(directory, "changes.json"));
  const findings = await readFile(path.join(directory, "findings.md"), "utf8");
  const body = renderComment({
    event,
    changes,
    findings,
    serverUrl: env.GITHUB_SERVER_URL,
    repository: env.GITHUB_REPOSITORY,
    sha: env.AFTER_SHA,
  });
  const commitRoute = `/repos/${env.GITHUB_REPOSITORY}/commits/${env.AFTER_SHA}/comments`;
  const comments = await githubRequest(commitRoute);
  return upsertComment({
    comments,
    body,
    create: (newBody) =>
      githubRequest(commitRoute, {
        method: "POST",
        body: JSON.stringify({ body: newBody }),
      }),
    update: (id, newBody) =>
      githubRequest(`/repos/${env.GITHUB_REPOSITORY}/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: newBody }),
      }),
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  run()
    .then((result) => console.log(`Commit comment: ${result}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
