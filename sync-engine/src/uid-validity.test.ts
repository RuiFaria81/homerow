import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameUidValidity, normalizeUidValidity } from './uid-validity.js';

test('normalizeUidValidity handles nullish and trims', () => {
  assert.equal(normalizeUidValidity(null), null);
  assert.equal(normalizeUidValidity(undefined), null);
  assert.equal(normalizeUidValidity('  '), null);
  assert.equal(normalizeUidValidity(' 1771330502 '), '1771330502');
  assert.equal(normalizeUidValidity(1771330502), '1771330502');
});

test('isSameUidValidity treats numeric/string forms as equal', () => {
  assert.equal(isSameUidValidity('1771330502', 1771330502), true);
  assert.equal(isSameUidValidity(1771330502, '1771330502'), true);
});

test('isSameUidValidity rejects real changes and nullish values', () => {
  assert.equal(isSameUidValidity('1771330502', 1771330503), false);
  assert.equal(isSameUidValidity(null, 1771330502), false);
  assert.equal(isSameUidValidity('1771330502', null), false);
});
