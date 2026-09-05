import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readFrontend = (path) =>
  readFile(new URL(`../../frontend/${path}`, import.meta.url), "utf8");

test("identidad visual: usa la paleta naranja de Origen Ingenio", async () => {
  const [styles, html, components, catalog, brand, main] = await Promise.all([
    readFrontend("src/styles.css"),
    readFrontend("index.html"),
    readFrontend("src/components.jsx"),
    readFrontend("src/catalog.js"),
    readFrontend("src/Brand.jsx"),
    readFrontend("src/main.jsx"),
  ]);

  for (const token of [
    "--oi-orange: #ff6500",
    "--oi-orange-dark: #df5500",
    "--oi-orange-soft: #fff2e8",
    "--oi-ink: #182333",
    "--oi-line: #dfe5eb",
  ]) {
    assert.ok(styles.includes(token), token);
  }

  for (const legacyBrandColor of [
    "#5d6fd1",
    "#495bb7",
    "#6579d5",
    "#7588d9",
    "#786be6",
    "#8293dd",
  ]) {
    assert.equal(styles.toLowerCase().includes(legacyBrandColor), false);
    assert.equal(components.toLowerCase().includes(legacyBrandColor), false);
    assert.equal(catalog.toLowerCase().includes(legacyBrandColor), false);
  }

  assert.match(html, /name="theme-color" content="#ff6500"/);
  assert.ok(
    components.includes('filters[key]?.length ? "var(--oi-orange)" : "none"'),
  );
  assert.match(catalog, /field\.type === "color"\s*\? "#ff6500"/);
  assert.match(brand, /\/branding\/control-rrhh-horizontal\.png/);
  assert.match(brand, /\/branding\/control-rrhh-mark\.png/);
  assert.match(brand, /Desarrollado con <strong>Codex<\/strong>/);
  assert.match(main, /<CodexCredit compact \/>/);
  assert.match(html, /rel="icon"[\s\S]*control-rrhh-mark\.png/);

  // Los colores semánticos no se sustituyen por la marca.
  assert.ok(styles.includes("border-color: #39a77c"));
  assert.ok(styles.includes("border-color: #d3686f"));
});

test("identidad visual: los dos logos PNG quedan empaquetados", async () => {
  const [mark, horizontal] = await Promise.all([
    readFile(
      new URL(
        "../../frontend/public/branding/control-rrhh-mark.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../../frontend/public/branding/control-rrhh-horizontal.png",
        import.meta.url,
      ),
    ),
  ]);
  const pngSignature = "89504e470d0a1a0a";
  assert.equal(mark.subarray(0, 8).toString("hex"), pngSignature);
  assert.equal(horizontal.subarray(0, 8).toString("hex"), pngSignature);
  assert.ok(mark.length > 300_000);
  assert.ok(horizontal.length > 580_000);
});
