import { ClsPluginTransactional, type TransactionalAdapter } from '@nestjs-cls/transactional';
import { type DynamicModule, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

const FAKE_CONNECTION = Symbol('FAKE_CONNECTION');

@Module({ providers: [{ provide: FAKE_CONNECTION, useValue: {} }], exports: [FAKE_CONNECTION] })
class FakeConnectionModule {}

/** Adapter for unit tests: `@Transactional()` just runs the method, no database. */
class PassThroughAdapter implements TransactionalAdapter<object, object, object> {
  readonly connectionToken = FAKE_CONNECTION;
  readonly optionsFactory = () => ({
    wrapWithTransaction: (_options: unknown, fn: () => Promise<unknown>) => fn(),
    wrapWithNestedTransaction: (_options: unknown, fn: () => Promise<unknown>) => fn(),
    getFallbackInstance: () => ({}),
  });
}

/**
 * Context and transaction support for unit tests of services that use `@Transactional()`.
 * Add it to `imports` of `Test.createTestingModule`.
 */
export function unitTestContextModule(): DynamicModule {
  return ClsModule.forRoot({
    global: true,
    plugins: [
      new ClsPluginTransactional({
        imports: [FakeConnectionModule],
        adapter: new PassThroughAdapter(),
      }),
    ],
  });
}
