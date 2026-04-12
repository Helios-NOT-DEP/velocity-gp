// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

describe('test setup localStorage mock', () => {
  it('preserves empty-string values in getItem', () => {
    globalThis.localStorage.setItem('empty-value', '');

    expect(globalThis.localStorage.getItem('empty-value')).toBe('');
  });

  it('coerces null and undefined values using String() semantics', () => {
    const storageLike = globalThis.localStorage as unknown as {
      setItem: (key: string, value: unknown) => void;
    };

    storageLike.setItem('undefined-value', undefined);
    storageLike.setItem('null-value', null);

    expect(globalThis.localStorage.getItem('undefined-value')).toBe('undefined');
    expect(globalThis.localStorage.getItem('null-value')).toBe('null');
  });
});
