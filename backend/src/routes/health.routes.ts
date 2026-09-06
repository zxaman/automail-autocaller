import { Router } from 'express';

import { getHealth, getReadiness } from '../modules/health/health.controller';

export const healthRouter = Router();

healthRouter.get('/health', getHealth);
healthRouter.get('/health/ready', getReadiness);
