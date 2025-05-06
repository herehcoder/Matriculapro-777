import { Router } from 'express';
import legacyRoutes from './legacy.routes';
import schoolIntegrationRoutes from './school-integration.routes';
import i18nRoutes from './i18n.routes';

const router = Router();

// Registrar rotas para as integrações adicionais
router.use('/api/legacy', legacyRoutes);
router.use('/api/school-integration', schoolIntegrationRoutes);
router.use('/api/i18n', i18nRoutes);

export default router;