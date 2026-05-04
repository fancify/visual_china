import assert from "node:assert/strict";
import test from "node:test";

let createPerfMonitor;

try {
  ({ createPerfMonitor } = await import("../src/game/perfMonitor.ts"));
} catch (error) {
  assert.fail(
    `expected perf monitor module to exist: ${error instanceof Error ? error.message : String(error)}`
  );
}

function createRendererInfo(overrides = {}) {
  return {
    info: {
      render: {
        calls: 12,
        triangles: 2400
      },
      memory: {
        geometries: 8,
        textures: 3
      },
      programs: new Array(2).fill({})
    },
    ...overrides
  };
}

function withDocumentHidden(hidden, callback) {
  const previousDocument = globalThis.document;
  globalThis.document = { hidden };

  try {
    callback();
  } finally {
    globalThis.document = previousDocument;
  }
}

test("detects a sudden frame-time spike against a stable 60-frame baseline", () => {
  withDocumentHidden(false, () => {
    const renderer = createRendererInfo();
    const warnings = [];
    const perfMonitor = createPerfMonitor();
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    try {
      for (let index = 0; index < 60; index += 1) {
        perfMonitor.observe(renderer, 1);
      }

      renderer.info.render.calls = 240;
      renderer.info.render.triangles = 120_000;
      perfMonitor.observe(renderer, 50);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /FPS spike at/);
    assert.match(warnings[0], /50\.00ms/);
    assert.match(warnings[0], /median 1\.00ms/);
  });
});

test("does not flag a steady low-fps workload as a spike", () => {
  withDocumentHidden(false, () => {
    const renderer = createRendererInfo();
    const warnings = [];
    const perfMonitor = createPerfMonitor();
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    try {
      for (let index = 0; index < 60; index += 1) {
        perfMonitor.observe(renderer, 100);
      }

      perfMonitor.observe(renderer, 100);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(warnings.length, 0);
  });
});

test("rotates the recent frame buffer when capacity is exceeded", () => {
  withDocumentHidden(false, () => {
    const renderer = createRendererInfo();
    const perfMonitor = createPerfMonitor({ bufferSize: 3 });

    perfMonitor.observe(renderer, 1);
    perfMonitor.observe(renderer, 2);
    perfMonitor.observe(renderer, 3);
    perfMonitor.observe(renderer, 4);

    assert.deepEqual(
      perfMonitor.getRecentFrames().map((sample) => sample.ms),
      [2, 3, 4]
    );
  });
});

test("does not warn for spikes while the tab is hidden by default", () => {
  withDocumentHidden(true, () => {
    const renderer = createRendererInfo();
    const warnings = [];
    const perfMonitor = createPerfMonitor();
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    try {
      for (let index = 0; index < 60; index += 1) {
        perfMonitor.observe(renderer, 1);
      }

      perfMonitor.observe(renderer, 50);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(warnings.length, 0);
  });
});
