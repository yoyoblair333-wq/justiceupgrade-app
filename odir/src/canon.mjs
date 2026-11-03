// Canonical JSON identical to the JusticeUpgrade contract's `_dump`:
//   json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
// and sha256 identical to the contract's `_digest`:
//   hashlib.sha256(text.encode("utf-8")).hexdigest()
//
// Every hash shared between ODIR, this adapter and the on-chain court is a sha256 of this
// encoding (or, for a single evidence item, of the contract's "kind\nlabel\ncontent" string).
// Only strings, integers, booleans, null, arrays and plain objects are allowed; floats are
// refused because CPython and JavaScript print them differently.
//
// Mirrors C:\ODIR\repos\GenLayer-Integration-ODIR\adapter\src\canon.js in style and discipline.
import crypto from 'node:crypto';

export class CanonError extends Error {}

function sortValue(v, path) {
  if (v === null) return null;
  if (Array.isArray(v)) return v.map((x, i) => sortValue(x, `${path}[${i}]`));
  switch (typeof v) {
    case 'string': case 'boolean': return v;
    case 'number':
      if (!Number.isInteger(v) || !Number.isSafeInteger(v)) throw new CanonError(`non-integer number at ${path}`);
      return v;
    case 'object': {
      const out = {};
      for (const k of Object.keys(v).sort()) {
        if (v[k] === undefined) continue;
        out[k] = sortValue(v[k], `${path}.${k}`);
      }
      return out;
    }
    default: throw new CanonError(`unsupported value (${typeof v}) at ${path}`);
  }
}

// CPython's ensure_ascii escapes every code point above 0x7F as \uXXXX (astral ones as a
// surrogate pair, which is what JavaScript strings already hold). \uXXXX is lower-case hex,
// exactly as json.dumps emits it.
const escapeNonAscii = (s) => s.replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

export function canonical(value) {
  return escapeNonAscii(JSON.stringify(sortValue(value, '$')));
}

// sha256 hex of a raw UTF-8 string — the contract's `_digest(text)`.
export const sha256 = (text) => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');

// sha256 hex of a value's canonical JSON — the contract's `_digest(_dump(value))`.
export const digest = (value) => sha256(canonical(value));
