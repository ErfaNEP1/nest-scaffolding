import { describe, expect, it } from 'vitest';
import { checkLabels, createCounter, createHistogram } from './metrics';

describe('metrics helper', () => {
  it('accepts dotted snake_case names', () => {
    expect(() => createCounter('app.orders.created', { description: 'x' })).not.toThrow();
  });

  it.each(['orders', 'App.Orders', 'app.orders-created', 'app..x'])('rejects name %s', (name) => {
    expect(() => createHistogram(name, { description: 'x' })).toThrow(/Invalid metric name/);
  });

  it('rejects high-cardinality labels', () => {
    expect(() => {
      checkLabels(['queue', 'user_id']);
    }).toThrow(/user_id/);
    expect(() =>
      createCounter('app.orders.created', { description: 'x', labels: ['requestId'] }),
    ).toThrow(/requestId/);
  });
});
