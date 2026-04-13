import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import srsGenerateRouter from './routes/srsGenerate';
import healthRouter from './routes/health';
import openApiSpec from './docs/openapi';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/docs.json', (_req, res) => {
  res.json(openApiSpec);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api/health', healthRouter);
app.use('/api/srs', srsGenerateRouter);

export default app;
