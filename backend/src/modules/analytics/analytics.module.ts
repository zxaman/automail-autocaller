import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

export interface AnalyticsModule {
  readonly analyticsController: AnalyticsController;
  readonly analyticsService: AnalyticsService;
}

export function createAnalyticsModule(): AnalyticsModule {
  const repository = new AnalyticsRepository();
  const service = new AnalyticsService(repository);

  return {
    analyticsController: new AnalyticsController(service),
    analyticsService: service,
  };
}
