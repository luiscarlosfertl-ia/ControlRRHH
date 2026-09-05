import test from "node:test";
import assert from "node:assert/strict";
import {
  viewHelp,
  fieldHelp,
  circuits,
  viewSteps,
} from "../../frontend/src/helpContent.js";
import { catalog } from "../../frontend/src/catalog.js";
import { normalizeView } from "../../frontend/src/navigation.js";

test("asistencia: todos los recursos tienen conceptos, pasos, relaciones y campos documentados", () => {
  for (const key of [
    ...Object.keys(catalog),
    "dashboard",
    "schedule",
    "settings",
    "help",
    "reports",
  ]) {
    const topic = viewHelp[key];
    assert.ok(topic?.concept.length > 50, key);
    assert.ok(topic.sequence.length >= 3, key);
    for (const related of topic.related) assert.ok(viewHelp[related], related);
    assert.ok(
      viewSteps(key).every(
        (s) => s.view === key && s.target && s.body && s.title,
      ),
    );
    for (const field of catalog[key]?.fields || [])
      assert.ok(fieldHelp[field.key], `${key}.${field.key}`);
  }
});
test("circuitos sólo apuntan a vistas conocidas; navegación valida URL y fallback", () => {
  assert.equal(new Set(circuits.map((c) => c.id)).size, circuits.length);
  for (const circuit of circuits) {
    assert.ok(circuit.views.length >= 4);
    circuit.views.forEach((v) => assert.ok(viewHelp[v]));
  }
  const allowed = Object.keys(viewHelp);
  assert.equal(normalizeView("#reviews", allowed), "reviews");
  assert.equal(normalizeView("#help", allowed), "help");
  assert.equal(normalizeView("#no-existe", allowed), "dashboard");
});
