import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

/** Composition root for the dashboard module. */
export function createDashboardModule() {
  const dashboardRepository = new DashboardRepository();
  const dashboardService = new DashboardService(dashboardRepository);

  return {
    dashboardController: new DashboardController(dashboardService),
    dashboardService,
    dashboardRepository,
  };
}

export type DashboardModule = ReturnType<typeof createDashboardModule>;
