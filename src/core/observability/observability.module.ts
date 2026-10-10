import { Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { runningTelemetry } from './telemetry';

/** Flushes traces and metrics when the application shuts down. */
@Injectable()
export class TelemetryShutdown implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await runningTelemetry()?.shutdown();
  }
}

@Module({ providers: [TelemetryShutdown] })
export class ObservabilityModule {}
