import { describe, expect, it } from 'vitest';
import { SnakeNamingStrategy, snakeCase } from './snake-naming.strategy';

describe('SnakeNamingStrategy', () => {
  it.each([
    ['displayName', 'display_name'],
    ['rowVersion', 'row_version'],
    ['HTTPServer2', 'http_server2'],
    ['SampleItem', 'sample_item'],
    ['already_snake', 'already_snake'],
  ])('%s -> %s', (input, expected) => {
    expect(snakeCase(input)).toBe(expected);
  });

  it('keeps names given in decorators', () => {
    const strategy = new SnakeNamingStrategy();
    expect(strategy.tableName('SampleItem', 'custom_items')).toBe('custom_items');
    expect(strategy.tableName('SampleItem', undefined)).toBe('sample_item');
    expect(strategy.columnName('createdAt', undefined, [])).toBe('created_at');
  });
});
