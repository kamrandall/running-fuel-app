import test from "node:test";
import assert from "node:assert/strict";

import { canScrollElement, selectScrollPanel } from "../src/scroll-routing.js";

test("selectScrollPanel prefers the hovered panel over the focused panel", () => {
  const setupPanel = { id: "setup" };
  const planPanel = { id: "plan" };

  const result = selectScrollPanel({
    hoveredPanel: setupPanel,
    focusedPanel: planPanel,
    visiblePanels: [setupPanel, planPanel]
  });

  assert.equal(result, setupPanel);
});

test("selectScrollPanel falls back to the focused panel when nothing is hovered", () => {
  const setupPanel = { id: "setup" };
  const planPanel = { id: "plan" };

  const result = selectScrollPanel({
    hoveredPanel: null,
    focusedPanel: planPanel,
    visiblePanels: [setupPanel, planPanel]
  });

  assert.equal(result, planPanel);
});

test("selectScrollPanel ignores panels outside the visible planner", () => {
  const visiblePanel = { id: "visible" };
  const hiddenPanel = { id: "hidden" };

  const result = selectScrollPanel({
    hoveredPanel: hiddenPanel,
    focusedPanel: null,
    visiblePanels: [visiblePanel]
  });

  assert.equal(result, null);
});

test("canScrollElement detects when downward scrolling is still possible", () => {
  assert.equal(
    canScrollElement({ scrollTop: 120, clientHeight: 400, scrollHeight: 1200 }, 80),
    true
  );
});

test("canScrollElement blocks downward routing at the bottom edge", () => {
  assert.equal(
    canScrollElement({ scrollTop: 800, clientHeight: 400, scrollHeight: 1200 }, 80),
    false
  );
});

test("canScrollElement detects when upward scrolling is still possible", () => {
  assert.equal(
    canScrollElement({ scrollTop: 120, clientHeight: 400, scrollHeight: 1200 }, -80),
    true
  );
});

test("canScrollElement blocks upward routing at the top edge", () => {
  assert.equal(
    canScrollElement({ scrollTop: 0, clientHeight: 400, scrollHeight: 1200 }, -80),
    false
  );
});

test("canScrollElement returns false for non-scrollable elements", () => {
  assert.equal(
    canScrollElement({ scrollTop: 0, clientHeight: 400, scrollHeight: 400 }, 80),
    false
  );
});
