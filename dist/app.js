"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const srsGenerate_1 = __importDefault(require("./routes/srsGenerate"));
const health_1 = __importDefault(require("./routes/health"));
const openapi_1 = __importDefault(require("./docs/openapi"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/api/docs.json', (_req, res) => {
    res.json(openapi_1.default);
});
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.default));
app.use('/api/health', health_1.default);
app.use('/api/srs', srsGenerate_1.default);
exports.default = app;
