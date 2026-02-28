/**
 * Interview routes — aggregated from sub-modules.
 *
 * Import path stays the same for `server/src/index.ts`:
 *   import { interviewRoutes } from './routes/interviews';
 *
 * The directory `routes/interviews/` replaces the old `routes/interviews.ts` file.
 */
import { FastifyInstance } from 'fastify';
import { registerCoreRoutes } from './core';
import { registerMonitorRoutes } from './monitor';
import { registerPublicRoutes } from './public';

// Re-export helpers that other modules depend on
export { getCompanyMonitorPolicy } from './helpers';

export async function interviewRoutes(app: FastifyInstance) {
    await registerCoreRoutes(app);
    await registerMonitorRoutes(app);
    await registerPublicRoutes(app);
}
