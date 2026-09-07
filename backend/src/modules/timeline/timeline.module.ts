import { TimelineController } from './timeline.controller';
import { TimelineRepository } from './timeline.repository';
import { TimelineService } from './timeline.service';

export interface TimelineModule {
  readonly timelineController: TimelineController;
  readonly timelineService: TimelineService;
}

export function createTimelineModule(): TimelineModule {
  const repository = new TimelineRepository();
  const service = new TimelineService(repository);

  return {
    timelineController: new TimelineController(service),
    timelineService: service,
  };
}
