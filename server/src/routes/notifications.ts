import { FastifyInstance } from 'fastify';
import { MOCK_NOTIFICATIONS } from '../data';
import { success } from '../utils/response';

export async function notificationRoutes(app: FastifyInstance) {
    app.get('/api/notifications', async () => {
        return success(MOCK_NOTIFICATIONS);
    });

    app.post('/api/notifications/:id/read', async (request) => {
        const { id } = request.params as { id: string };
        const notif = MOCK_NOTIFICATIONS.find(n => n.id === id);
        if (notif) {
            notif.read = true;
        }
        return success({ success: true });
    });
}
