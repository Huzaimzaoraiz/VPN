import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { startGrpcServer } from './grpc/server';

// Routes (to be implemented)
import authRoutes from './api/auth';
import gatewayRoutes from './api/gateways';
import networkRoutes from './api/networks';
import devicesRoutes from './api/devices';
import routesRoutes from './api/routes';
import firewallRoutes from './api/firewall';

const app = express();

app.use(cors({ origin: env.CORS_ORIGINS }));
app.use(express.json());

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/gateways', gatewayRoutes);
app.use('/api/v1/networks', networkRoutes);
app.use('/api/v1/devices', devicesRoutes);
app.use('/api/v1/routes', routesRoutes);
app.use('/api/v1/firewall', firewallRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'vpn-controller-node' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({
    detail: err.message || 'Internal Server Error'
  });
});

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`✅ REST API listening on http://0.0.0.0:${env.PORT}`);
  
  // Boot up the gRPC Server in the same process (or could be run separately)
  startGrpcServer();
});
