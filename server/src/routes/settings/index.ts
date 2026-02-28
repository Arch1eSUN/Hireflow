/**
 * Settings routes — aggregated from sub-modules.
 *
 * Import path stays the same for `server/src/index.ts`:
 *   import { settingsRoutes } from './routes/settings';
 *
 * The directory `routes/settings/` replaces the old `routes/settings.ts` file.
 */
import { FastifyInstance } from 'fastify';
import { registerCoreRoutes } from './core';
import { registerPolicyRoutes } from './policy';
import { registerKeyRoutes } from './keys';
import { registerIntegrationRoutes } from './integrations';

export async function settingsRoutes(app: FastifyInstance) {
    await registerCoreRoutes(app);
    await registerPolicyRoutes(app);
    await registerKeyRoutes(app);
    await registerIntegrationRoutes(app);
}
