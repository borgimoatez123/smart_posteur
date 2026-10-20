import { Router } from 'express';
import deviceRoutes from '../modules/devices/device.routes';
import telemetryRoutes from '../modules/telemetry/telemetry.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import historyRoutes from '../modules/history/history.routes';
import sessionRoutes from '../modules/sessions/session.routes';
import eventRoutes from '../modules/events/event.routes';
import aiRoutes from '../modules/ai/ai.routes';

const router = Router();

router.use('/devices', deviceRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/history', historyRoutes);
router.use('/sessions', sessionRoutes);
router.use('/events', eventRoutes);
router.use('/ai', aiRoutes);

export default router;
