import { Router } from 'express';
import { schoolIntegrationService } from '../services/schoolIntegrationService';
import { requireAuth, requireSchoolAdmin } from '../middleware/auth';
import {
  insertSchoolSystemSchema,
  insertSchoolSystemModuleSchema,
  insertSchoolSystemFieldMappingSchema
} from '@shared/school-integration.schema';
import { z } from 'zod';

const router = Router();

// Middleware para todas as rotas de integração escolar
router.use(requireAuth);

// Obter todos os sistemas integrados de uma escola
router.get('/school/:schoolId', requireSchoolAdmin, async (req, res) => {
  try {
    const schoolId = parseInt(req.params.schoolId, 10);
    
    if (isNaN(schoolId)) {
      return res.status(400).json({ message: 'ID da escola inválido' });
    }
    
    const systems = await schoolIntegrationService.getSchoolSystemsBySchool(schoolId);
    return res.json(systems);
  } catch (error) {
    console.error('Erro ao obter sistemas escolares:', error);
    return res.status(500).json({ message: 'Erro ao obter sistemas escolares', error: error.message });
  }
});

// Obter um sistema escolar específico
router.get('/:id', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const system = await schoolIntegrationService.getSchoolSystem(id);
    
    if (!system) {
      return res.status(404).json({ message: 'Sistema escolar não encontrado' });
    }
    
    return res.json(system);
  } catch (error) {
    console.error('Erro ao obter sistema escolar:', error);
    return res.status(500).json({ message: 'Erro ao obter sistema escolar', error: error.message });
  }
});

// Criar um novo sistema escolar
router.post('/', requireSchoolAdmin, async (req, res) => {
  try {
    const validatedData = insertSchoolSystemSchema.parse(req.body);
    const system = await schoolIntegrationService.createSchoolSystem(validatedData);
    return res.status(201).json(system);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar sistema escolar:', error);
    return res.status(500).json({ message: 'Erro ao criar sistema escolar', error: error.message });
  }
});

// Atualizar um sistema escolar
router.put('/:id', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    // Validar parcialmente os dados (permitir atualização parcial)
    const validatedData = insertSchoolSystemSchema.partial().parse(req.body);
    const system = await schoolIntegrationService.updateSchoolSystem(id, validatedData);
    return res.json(system);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao atualizar sistema escolar:', error);
    return res.status(500).json({ message: 'Erro ao atualizar sistema escolar', error: error.message });
  }
});

// Excluir um sistema escolar
router.delete('/:id', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    await schoolIntegrationService.deleteSchoolSystem(id);
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir sistema escolar:', error);
    return res.status(500).json({ message: 'Erro ao excluir sistema escolar', error: error.message });
  }
});

// Testar conexão com sistema escolar
router.post('/:id/test-connection', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const result = await schoolIntegrationService.testConnection(id);
    return res.json(result);
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return res.status(500).json({ message: 'Erro ao testar conexão', error: error.message });
  }
});

// ---- Módulos ----

// Obter todos os módulos de um sistema escolar
router.get('/:id/modules', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const modules = await schoolIntegrationService.getModules(id);
    return res.json(modules);
  } catch (error) {
    console.error('Erro ao obter módulos:', error);
    return res.status(500).json({ message: 'Erro ao obter módulos', error: error.message });
  }
});

// Criar um novo módulo
router.post('/:id/modules', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const data = { ...req.body, schoolSystemId: id };
    const validatedData = insertSchoolSystemModuleSchema.parse(data);
    const module = await schoolIntegrationService.createModule(validatedData);
    return res.status(201).json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar módulo:', error);
    return res.status(500).json({ message: 'Erro ao criar módulo', error: error.message });
  }
});

// ---- Mapeamentos de campos ----

// Obter mapeamentos de campo para um módulo
router.get('/:id/mappings/:moduleKey', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const moduleKey = req.params.moduleKey;
    const mappings = await schoolIntegrationService.getFieldMappings(id, moduleKey);
    return res.json(mappings);
  } catch (error) {
    console.error('Erro ao obter mapeamentos de campo:', error);
    return res.status(500).json({ message: 'Erro ao obter mapeamentos de campo', error: error.message });
  }
});

// Criar novo mapeamento de campo
router.post('/:id/mappings', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const data = { ...req.body, schoolSystemId: id };
    const validatedData = insertSchoolSystemFieldMappingSchema.parse(data);
    const mapping = await schoolIntegrationService.createFieldMapping(validatedData);
    return res.status(201).json(mapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar mapeamento de campo:', error);
    return res.status(500).json({ message: 'Erro ao criar mapeamento de campo', error: error.message });
  }
});

// ---- Sincronização ----

// Agendar tarefa de sincronização
router.post('/:id/sync-tasks', requireSchoolAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    const { moduleKey, operation, priority, dataId, dataPayload, scheduledFor, executeNow } = req.body;
    
    if (!moduleKey || !operation) {
      return res.status(400).json({ message: 'Módulo e operação são obrigatórios' });
    }
    
    const taskId = await schoolIntegrationService.scheduleSyncTask(id, moduleKey, operation, {
      priority,
      dataId,
      dataPayload,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      executeNow: executeNow === true
    });
    
    return res.status(201).json({ taskId, message: 'Tarefa de sincronização agendada com sucesso' });
  } catch (error) {
    console.error('Erro ao agendar sincronização:', error);
    return res.status(500).json({ message: 'Erro ao agendar sincronização', error: error.message });
  }
});

// Executar tarefa de sincronização
router.post('/sync-tasks/:taskId/execute', requireSchoolAdmin, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ message: 'ID de tarefa inválido' });
    }
    
    const result = await schoolIntegrationService.executeSyncTask(taskId);
    return res.json(result);
  } catch (error) {
    console.error('Erro ao executar tarefa de sincronização:', error);
    return res.status(500).json({ message: 'Erro ao executar tarefa de sincronização', error: error.message });
  }
});

// ---- Webhooks ----

// Receber webhook (endpoint público sem autenticação)
router.post('/webhooks/:systemId', async (req, res) => {
  try {
    const systemId = parseInt(req.params.systemId, 10);
    
    if (isNaN(systemId)) {
      return res.status(400).json({ message: 'ID do sistema inválido' });
    }
    
    const { event } = req.body;
    
    if (!event) {
      return res.status(400).json({ message: 'Evento não especificado' });
    }
    
    // Registrar webhook para processamento assíncrono
    const webhookId = await schoolIntegrationService.registerWebhook(
      systemId,
      event,
      req.body
    );
    
    return res.status(202).json({
      message: 'Webhook recebido e enfileirado para processamento',
      webhookId
    });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ message: 'Erro ao processar webhook', error: error.message });
  }
});

export default router;