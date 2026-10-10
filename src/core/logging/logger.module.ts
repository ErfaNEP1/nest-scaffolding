import type { DynamicModule } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request } from 'express';
import { LoggerModule, type Params } from 'nestjs-pino';
import { type LoggerOptions, stdTimeFunctions } from 'pino';
import { ConfigService } from '../../config';
import { currentContext } from '../context/context';
import { requestIdFor } from '../context/request-id';
import { redactDeep, redactObject } from './redact';

/** Paths that are never access-logged (probes and scrapes). */
const NOT_ACCESS_LOGGED = /^\/(health|metrics)(\/|$)/;

/** Route template such as `/api/v1/samples/:id`, never the raw URL (keeps cardinality low). */
export function routeTemplate(req: IncomingMessage): string {
  const route: unknown = (req as Partial<Request>).route;
  if (route && typeof route === 'object' && 'path' in route && typeof route.path === 'string') {
    // Unknown routes and middleware errors only match a catch-all `*path` pattern.
    return route.path.includes('*') ? '<unmatched>' : route.path;
  }
  return '<unmatched>';
}

/** Base pino options shared by the API, the worker and scripts. */
export function pinoOptions(config: ConfigService): LoggerOptions {
  const app = config.get('app');
  const logging = config.get('logging');
  return {
    level: logging.level,
    base: { service: app.name, env: app.env, version: app.version },
    timestamp: stdTimeFunctions.isoTime,
    messageKey: 'msg',
    formatters: {
      level: (label) => ({ level: label }),
      log: redactObject,
    },
    mixin: () => {
      // requestId is bound by pino-http on request loggers; avoid a duplicate key here.
      const { requestId: _requestId, ...values } = currentContext();
      return values;
    },
    ...(logging.pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
        }
      : {}),
  };
}

function accessLogObject(req: IncomingMessage, res: ServerResponse, responseTime: unknown) {
  const debug = req.log.isLevelEnabled('debug');
  return {
    method: req.method,
    route: routeTemplate(req),
    statusCode: res.statusCode,
    durationMs: responseTime,
    ...(debug ? { requestHeaders: redactDeep(req.headers) } : {}),
  };
}

function loggerParams(config: ConfigService): Params {
  return {
    pinoHttp: {
      ...pinoOptions(config),
      quietReqLogger: true,
      quietResLogger: true,
      customAttributeKeys: { reqId: 'requestId' },
      genReqId: (req) => requestIdFor(req),
      autoLogging: { ignore: (req) => NOT_ACCESS_LOGGED.test(req.url ?? '') },
      // Errors are logged once, with context, by the global exception filter.
      customLogLevel: () => 'info',
      customSuccessMessage: () => 'request completed',
      customErrorMessage: () => 'request completed',
      customSuccessObject: (req, res, loggable: { responseTime?: unknown }) =>
        accessLogObject(req, res, loggable.responseTime),
      customErrorObject: (req, res, _error, loggable: { responseTime?: unknown }) =>
        accessLogObject(req, res, loggable.responseTime),
    },
  };
}

/** Logging through pino (nestjs-pino). Import once in each root module. */
export function loggerModule(): DynamicModule {
  return LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: loggerParams,
  });
}
