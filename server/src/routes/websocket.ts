import { FastifyInstance } from 'fastify';

export async function websocketRoutes(app: FastifyInstance) {
    app.get('/api/ws/interview/stream', { websocket: true }, (connection, req) => {
        console.log('Client connected to WebSocket');

        connection.socket.on('message', (message: any) => {
            // Mock processing audio chunk
            const data = JSON.parse(message.toString());
            console.log('Received:', data);

            if (data.type === 'AUDIO_CHUNK') {
                // Determine if AI should reply (mock logic)
                setTimeout(() => {
                    connection.socket.send(JSON.stringify({
                        type: 'AI_SPEAKING',
                        text: 'Could you elaborate on how you handle state management in complex applications?',
                        isSpeaking: true
                    }));

                    // Simulate speaking duration
                    setTimeout(() => {
                        connection.socket.send(JSON.stringify({
                            type: 'AI_SILENT',
                            isSpeaking: false
                        }));
                    }, 3000);
                }, 1000);
            }
        });

        // Send initial greeting
        setTimeout(() => {
            connection.socket.send(JSON.stringify({
                type: 'AI_SPEAKING',
                text: 'Hello! Let\'s start with a brief introduction. Tell me about your background.',
                isSpeaking: true
            }));

            setTimeout(() => {
                connection.socket.send(JSON.stringify({
                    type: 'AI_SILENT',
                    isSpeaking: false
                }));
            }, 3000);
        }, 1000);
    });
}
