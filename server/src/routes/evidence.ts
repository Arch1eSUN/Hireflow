import { FastifyInstance } from 'fastify';
import { authenticate } from '../utils/auth';
import { prisma } from '../utils/prisma';
const PdfPrinter = require('pdfmake') as any;

export const evidenceRoutes = async (app: FastifyInstance) => {
    app.post('/api/interviews/:id/evidence/export', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const interview = await prisma.interview.findFirst({
                where: { id, job: { companyId: user.companyId } },
                include: { candidate: true, job: true },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const logs = await prisma.auditLog.findMany({
                where: { targetId: interview.id, action: 'integrity.event' },
                orderBy: { createdAt: 'asc' },
            });

            // Using standard Helvetica font to avoid needing TTF files
            const fonts = {
                Helvetica: {
                    normal: 'Helvetica',
                    bold: 'Helvetica-Bold',
                    italics: 'Helvetica-Oblique',
                    bolditalics: 'Helvetica-BoldOblique',
                },
            };

            const printer = new PdfPrinter(fonts);

            const riskEvents = logs
                .map((log) => {
                    const meta = (log.metadata as any) || {};
                    return {
                        timestamp: log.createdAt,
                        type: meta.type || 'UNKNOWN',
                        severity: meta.severity || 'low',
                        description: meta.message || 'Integrity event',
                    };
                })
                .filter((e) => e.severity === 'high' || e.severity === 'medium');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfmake TDocumentDefinitions
            const docDefinition: any = {
                defaultStyle: { font: 'Helvetica' },
                content: [
                    { text: 'Candidate Integrity & Evidence Report', style: 'header' },
                    { text: `\nCandidate: ${interview.candidate.name || 'Unknown'}` },
                    { text: `Email: ${interview.candidate.email || 'Unknown'}` },
                    { text: `Job Title: ${interview.job.title}` },
                    { text: `Interview Date: ${interview.createdAt.toLocaleDateString()}` },
                    { text: `\nIntegrity Alerts (${riskEvents.length})`, style: 'subheader' },
                ],
                styles: {
                    header: { fontSize: 18, bold: true },
                    subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
                },
            };

            if (riskEvents.length > 0) {
                riskEvents.forEach((e) => {
                    docDefinition.content.push({
                        text: `• [${new Date(e.timestamp).toLocaleTimeString()}] ${String(e.type).toUpperCase()}: ${e.description} (Risk: ${e.severity})`,
                        margin: [10, 2, 0, 2]
                    });
                });
            } else {
                docDefinition.content.push({ text: 'No high or medium risk events detected.', margin: [10, 2, 0, 2] });
            }

            if (interview.secondOpinion) {
                const opinion: any = typeof interview.secondOpinion === 'string' ? JSON.parse(interview.secondOpinion) : interview.secondOpinion;
                docDefinition.content.push({ text: '\nAI Second Opinion', style: 'subheader' });
                docDefinition.content.push({ text: `Recommendation: ${opinion.recommendation}` });
                docDefinition.content.push({ text: `Summary: ${opinion.summary}` });
            }

            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            pdfDoc.end();

            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `attachment; filename="evidence-report-${interview.id}.pdf"`);

            return reply.send(pdfDoc);
        } catch (err: unknown) {
            request.log.error(err, 'Failed to generate PDF');
            return reply.status(500).send({ error: 'Failed to generate PDF document' });
        }
    });
};
