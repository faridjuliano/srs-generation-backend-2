import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import srsGenerateRouter from './routes/srsGenerate';
import healthRouter from './routes/health';
import validateRouter from './routes/validate';
import autoFixRouter from './routes/autoFix';
import openApiSpec from './docs/openapi';
import projectRoutes from "./routes/project";
import exportRoutes from "./routes/export.routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/docs.json', (_req, res) => {
  res.json(openApiSpec);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api/health', healthRouter);
app.use('/api/srs', srsGenerateRouter);
app.use('/api/srs', validateRouter);
app.use('/api/srs', autoFixRouter);
app.use("/api/projects", projectRoutes);
app.use("/api/export", exportRoutes);

export default app;
