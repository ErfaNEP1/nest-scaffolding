import { type DynamicModule, Global, Module, type Type } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { ConfigService } from '../../config';
import { DbSessionContext, NoopDbSessionContext } from './db-session-context';
import { SnakeNamingStrategy } from './snake-naming.strategy';
import {
  SessionAwareTypeOrmAdapter,
  TRANSACTION_CONNECTION,
  type TransactionConnection,
} from './transactional-adapter';
import { PinoTypeOrmLogger, SLOW_QUERY_MS } from './typeorm-logger';

export interface DatabaseModuleOptions {
  /** Replaces the default (no-op) {@link DbSessionContext}. */
  sessionContext?: Type<DbSessionContext>;
  /** `false` builds the DataSource without connecting (OpenAPI generation, tooling). */
  connect?: boolean;
}

function dataSourceOptions(
  config: ConfigService,
  logger: PinoLogger,
  connect: boolean,
): TypeOrmModuleOptions {
  const db = config.get('database');
  logger.setContext('Database');
  return {
    type: 'postgres',
    url: db.url,
    // Entities are registered explicitly by each module with TypeOrmModule.forFeature().
    autoLoadEntities: true,
    // The schema is owned by db/migrations; TypeORM never changes it.
    synchronize: false,
    migrationsRun: false,
    migrations: [],
    namingStrategy: new SnakeNamingStrategy(),
    manualInitialization: !connect,
    retryAttempts: 3,
    retryDelay: 1_000,
    logger: new PinoTypeOrmLogger(logger),
    logging: ['query', 'error', 'warn'],
    maxQueryExecutionTime: SLOW_QUERY_MS,
    extra: {
      max: db.poolMax,
      idleTimeoutMillis: db.idleTimeoutMs,
      connectionTimeoutMillis: db.connectionTimeoutMs,
      statement_timeout: db.statementTimeoutMs,
      application_name: config.get('app').name,
      options: '-c TimeZone=UTC',
    },
  };
}

/** TypeORM DataSource (queries only), transactions and the session context hook. */
@Global()
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions = {}): DynamicModule {
    const connect = options.connect ?? true;
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService, PinoLogger],
          useFactory: (config: ConfigService, logger: PinoLogger) =>
            dataSourceOptions(config, logger, connect),
        }),
      ],
      providers: [
        { provide: DbSessionContext, useClass: options.sessionContext ?? NoopDbSessionContext },
        {
          provide: TRANSACTION_CONNECTION,
          inject: [DataSource, DbSessionContext],
          useFactory: (dataSource: DataSource, sessionContext: DbSessionContext) =>
            ({ dataSource, sessionContext }) satisfies TransactionConnection,
        },
      ],
      exports: [TypeOrmModule, DbSessionContext, TRANSACTION_CONNECTION],
    };
  }
}

/** The nestjs-cls plugin that powers `@Transactional()` and `TransactionHost`. */
export function transactionalPlugin(): ClsPluginTransactional {
  return new ClsPluginTransactional({ adapter: new SessionAwareTypeOrmAdapter() });
}
