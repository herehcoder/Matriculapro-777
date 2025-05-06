import { Router } from 'express';
import { legacySystemService } from '../services/legacySystemService';
import { requireAuth, requireSchoolAdmin } from '../middleware/auth';
import { 
  insertLegacySystemSchema,
  insertLegacyEndpointSchema,
  insertLegacyDataMappingSchema
} from '@shared/legacy.schema';
import { z } from 'zod';

const router = Router();

// Middleware para todas as rotas de sistemas legados
router.use(requireAuth);

// Obter todos os sistemas legados de uma escola
router.get('/school/:schoolId', requireSchoolAdmin, async (req, res) => {
  try {
    const schoolId = parseInt(req.params.schoolId, 10);
    
    if (isNaN(schoolId)) {
      return res.status(400).json({ message: 'ID da escola inválido' });
    }
    
    const systems = await legacySystemService.getLegacySystemsBySchool(schoolId);
    return res.json(systems);
  } catch (error) {
    console.error('Erro ao obter sistemas legados:', error);
    return res.status(500).json({ message: 'Erro ao obter sistemas legados', error: error.message });
  }
});

// Obter um sistema legado específico
router.get('/:id', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const system = await legacySystemService.getLegacySystem(id);
    
    if (!system) {
      return res.status(404).json({ message: 'Sistema legado não encontrado' });
    }
    
    return res.json(system);
  } catch (error) {
    console.error('Erro ao obter sistema legado:', error);
    return res.status(500).json({ message: 'Erro ao obter sistema legado', error: error.message });
  }
});

// Criar um novo sistema legado
router.post('/', requireSchoolAdmin, async (req, res) => {
  try {
    const validatedData = insertLegacySystemSchema.parse(req.body);
    const system = await legacySystemService.createLegacySystem(validatedData);
    return res.status(201).json(system);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar sistema legado:', error);
    return res.status(500).json({ message: 'Erro ao criar sistema legado', error: error.message });
  }
});

// Atualizar um sistema legado
router.put('/:id', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    // Validar parcialmente os dados (permitir atualização parcial)
    const validatedData = insertLegacySystemSchema.partial().parse(req.body);
    const system = await legacySystemService.updateLegacySystem(id, validatedData);
    return res.json(system);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao atualizar sistema legado:', error);
    return res.status(500).json({ message: 'Erro ao atualizar sistema legado', error: error.message });
  }
});

// Excluir um sistema legado
router.delete('/:id', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    await legacySystemService.deleteLegacySystem(id);
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir sistema legado:', error);
    return res.status(500).json({ message: 'Erro ao excluir sistema legado', error: error.message });
  }
});

// Testar conexão com sistema legado
router.post('/:id/test-connection', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const result = await legacySystemService.testConnection(id);
    return res.json(result);
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return res.status(500).json({ message: 'Erro ao testar conexão', error: error.message });
  }
});

// Iniciar sincronização de dados
router.post('/:id/sync', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const { entityType, direction, filters, limit, executeNow } = req.body;
    
    if (!entityType || !direction) {
      return res.status(400).json({ message: 'Tipo de entidade e direção são obrigatórios' });
    }
    
    const result = await legacySystemService.synchronize(id, entityType, direction, {
      filters,
      limit,
      executeNow: executeNow === true
    });
    
    return res.json(result);
  } catch (error) {
    console.error('Erro ao sincronizar dados:', error);
    return res.status(500).json({ message: 'Erro ao sincronizar dados', error: error.message });
  }
});

// Obter status de sincronização
router.get('/:id/sync-status', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const { entityType } = req.query;
    const status = await legacySystemService.getSyncStatus(id, entityType as string);
    return res.json(status);
  } catch (error) {
    console.error('Erro ao obter status de sincronização:', error);
    return res.status(500).json({ message: 'Erro ao obter status de sincronização', error: error.message });
  }
});

// ---- Endpoints ----

// Obter endpoints de um sistema legado
router.get('/:id/endpoints', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const endpoints = await legacySystemService.getEndpoints(id);
    return res.json(endpoints);
  } catch (error) {
    console.error('Erro ao obter endpoints:', error);
    return res.status(500).json({ message: 'Erro ao obter endpoints', error: error.message });
  }
});

// Criar novo endpoint
router.post('/:id/endpoints', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const data = { ...req.body, legacySystemId: id };
    const validatedData = insertLegacyEndpointSchema.parse(data);
    const endpoint = await legacySystemService.createEndpoint(validatedData);
    return res.status(201).json(endpoint);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar endpoint:', error);
    return res.status(500).json({ message: 'Erro ao criar endpoint', error: error.message });
  }
});

// ---- Mapeamentos de dados ----

// Obter mapeamento de dados para uma entidade
router.get('/:id/mappings/:entityType', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const entityType = req.params.entityType;
    const mapping = await legacySystemService.getDataMapping(id, entityType);
    
    if (!mapping) {
      return res.status(404).json({ message: 'Mapeamento não encontrado' });
    }
    
    return res.json(mapping);
  } catch (error) {
    console.error('Erro ao obter mapeamento:', error);
    return res.status(500).json({ message: 'Erro ao obter mapeamento', error: error.message });
  }
});

// Criar novo mapeamento de dados
router.post('/:id/mappings', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const data = { ...req.body, legacySystemId: id };
    const validatedData = insertLegacyDataMappingSchema.parse(data);
    const mapping = await legacySystemService.createDataMapping(validatedData);
    return res.status(201).json(mapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar mapeamento:', error);
    return res.status(500).json({ message: 'Erro ao criar mapeamento', error: error.message });
  }
});

export default router;