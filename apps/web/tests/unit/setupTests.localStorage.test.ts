// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

describe('test setup localStorage mock', () => {
  it('preserves empty-string values in getItem', () => {
    globalThis.localStorage.setItem('empty-value', '');

    expect(globalThis.localStorage.getItem('empty-value')).toBe('');
  });
});
