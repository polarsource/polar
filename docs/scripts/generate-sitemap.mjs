#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://polar.sh/docs";
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const docsRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sitemapPath = join(docsRoot, "sitemap.xml");

const readJson = (path) => JSON.parse(readFileSync(join(docsRoot, path), "utf8"));

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");

const loadOpenApi = (openapi) => {
  const spec = readJson(openapi.source);
  const resolve = (entry) => {
    const [method, ...rest] = entry.split(" ");
    const target = rest.join(" ");
    if (method === "webhook") {
      return `${openapi.directory}/${target.replaceAll(".", "_")}`;
    }
    const operation = spec.paths?.[target]?.[method.toLowerCase()];
    if (!operation) {
      throw new Error(`${entry} not found in ${openapi.source}`);
    }
    return `${openapi.directory}/${slugify(operation.tags[0])}/${slugify(operation.summary)}`;
  };
  return resolve;
};

const isOpenApiEntry = (entry) => {
  const [first] = entry.split(" ");
  return first === "webhook" || HTTP_METHODS.has(first);
};

const collectPages = (node, resolveOpenApi, pages) => {
  if (typeof node === "string") {
    pages.push(isOpenApiEntry(node) ? resolveOpenApi(node) : node);
    return;
  }
  const resolver = node.openapi ? loadOpenApi(node.openapi) : resolveOpenApi;
  for (const key of ["tabs", "groups", "pages"]) {
    for (const child of node[key] ?? []) {
      collectPages(child, resolver, pages);
    }
  }
  const versions = node.versions ?? [];
  const current = versions.filter((version) => version.default);
  for (const version of current) {
    collectPages(version, resolver, pages);
  }
};

const resolveWithoutSpec = (entry) => {
  throw new Error(`${entry} has no OpenAPI spec in scope`);
};

const buildSitemap = () => {
  const docs = readJson("docs.json");
  const pages = [];
  collectPages(docs.navigation, resolveWithoutSpec, pages);
  const urls = [...new Set(pages)]
    .sort()
    .map((page) => `  <url>\n    <loc>${BASE_URL}/${page}</loc>\n  </url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
};

const collectVersions = (node) => [
  ...(node.versions ?? []),
  ...["tabs", "groups"].flatMap((key) => (node[key] ?? []).flatMap(collectVersions)),
];

const findNoindexErrors = () => {
  const docs = readJson("docs.json");
  const noindexPaths = new Set(
    (docs.seo?.paths ?? [])
      .filter((entry) => entry.metatags?.robots?.includes("noindex"))
      .map((entry) => entry.path),
  );
  return collectVersions(docs.navigation)
    .filter((version) => version.openapi?.directory)
    .flatMap(({ version, default: isDefault, openapi: { directory } }) => {
      if (isDefault && noindexPaths.has(directory)) {
        return [`The current version ${version} must not be noindexed: remove "${directory}" from seo.paths.`];
      }
      if (!isDefault && !noindexPaths.has(directory)) {
        return [`Version ${version} is not the current one: add "${directory}" with robots noindex to seo.paths.`];
      }
      return [];
    });
};

const noindexErrors = findNoindexErrors();
if (noindexErrors.length > 0) {
  console.error(["docs/docs.json:", ...noindexErrors].join("\n  "));
  process.exit(1);
}

const sitemap = buildSitemap();

if (process.argv.includes("--check")) {
  let committed = "";
  try {
    committed = readFileSync(sitemapPath, "utf8");
  } catch {}
  if (committed !== sitemap) {
    console.error("docs/sitemap.xml is out of date. Run `pnpm sitemap` in docs/ and commit the result.");
    process.exit(1);
  }
  console.log("docs/sitemap.xml is up to date.");
} else {
  writeFileSync(sitemapPath, sitemap);
  console.log(`Wrote ${sitemap.split("<loc>").length - 1} URLs to docs/sitemap.xml.`);
}
