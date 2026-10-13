import { greet } from '#lib/index.js';

describe('library API', () => {
  it('greets by name', () => {
    expect(greet('Ada')).toBe('Hello, Ada!');
  });
});
