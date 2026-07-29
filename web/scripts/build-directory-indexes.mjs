import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const output = join(root, "build");
const ignoredNames = new Set([
  ".git", ".gitignore", "build", "node_modules", "package.json",
  "package-lock.json", "scripts", "vercel.json",
]);

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const encodePath = (value) => value
  .split("/")
  .map((part) => encodeURIComponent(part))
  .join("/");

async function copySiteFiles() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  const entries = await readdir(root, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => !ignoredNames.has(entry.name) && !entry.name.startsWith("."))
    .map((entry) => cp(join(root, entry.name), join(output, entry.name), { recursive: true })));
}

async function generateIndex(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const hasIndex = entries.some((entry) => entry.isFile() && entry.name === "index.html");

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      await generateIndex(join(directory, entry.name));
    }
  }

  if (hasIndex) return;

  const directoryPath = relative(output, directory);
  const displayPath = directoryPath ? `/${directoryPath}` : "/";
  const parent = directoryPath ? '<li><a href="../">../</a></li>' : "";
  const items = entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-CN");
    })
    .map((entry) => {
      const suffix = entry.isDirectory() ? "/" : "";
      const label = `${entry.name}${suffix}`;
      return `<li><a href="${encodePath(entry.name)}${suffix}">${escapeHtml(label)}</a></li>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>文件索引 - ${escapeHtml(displayPath)}</title>
  <style>
    body { max-width: 860px; margin: 40px auto; padding: 0 20px; color: #1f2937; font: 16px/1.6 system-ui, sans-serif; }
    h1 { font-size: 22px; }
    ul { padding-left: 20px; }
    li { margin: 6px 0; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>文件索引：${escapeHtml(displayPath)}</h1>
  <ul>${parent}${items}</ul>
</body>
</html>`;

  await writeFile(join(directory, "index.html"), html);
}

await copySiteFiles();
await generateIndex(output);
console.log(`Built static site in ${output}`);
