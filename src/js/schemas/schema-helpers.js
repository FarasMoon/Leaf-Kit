// ============================================================
// Schema Builder Helpers — field & config factories
// ============================================================
// Shared utility functions to reduce repetition in schema definitions.
// Each schema file (firefly.js, mizuki.js, fuwari.js) uses these
// factories to build its config objects.

// ── Field factories (F) ──
const F = {
  /** Text input */
  txt(key, label, opts) { return { key, label, type: "text", ...opts }; },
  /** Multiline textarea */
  area(key, label, opts) { return { key, label, type: "textarea", ...opts }; },
  /** Number input (min/max/step supported via opts) */
  num(key, label, opts) { return { key, label, type: "number", ...opts }; },
  /** Checkbox / boolean toggle */
  chk(key, label, opts) { return { key, label, type: "checkbox", ...opts }; },
  /** Dropdown select (options is required) */
  sel(key, label, options, opts) { return { key, label, type: "select", options, ...opts }; },
  /** Range slider */
  range(key, label, min, max, opts) { return { key, label, type: "range", min, max, ...opts }; },
  /** Date picker */
  date(key, label, opts) { return { key, label, type: "date", ...opts }; },
  /** Image upload field */
  img(key, label, uploadDir, opts) { return { key, label, type: "image", uploadDir, ...opts }; },
};

// ── Array field factory (A) ──
function A(rootKey, label, nodeFields, opts) {
  return { rootKey, label, nodeFields, ...opts };
}

// ── Config object factories (C) ──
function C(file, desc, label, fields) {
  return { file, desc, label, fields };
}

/** Config with an arrayFields entry (e.g., profileConfig.links, galleryConfig.albums) */
function CA(file, desc, label, fields, arrayFields) {
  return { file, desc, label, fields, arrayFields };
}

/** Config with arrayFieldsList (e.g., sidebar multiple component lists) */
function CAL(file, desc, label, fields, arrayFieldsList) {
  return { file, desc, label, fields, arrayFieldsList };
}

/** Config with splitExports (e.g., pioConfig for Firefly) */
function CS(file, desc, label, fields, opts) {
  return { file, desc, label, fields, ...opts };
}
