/**
 * Rotas para gerenciamento de templates do WhatsApp
 */

import { Express, Request, Response } from 'express';
import { whatsappTemplateService } from './services/whatsappTemplateService';
import { insertWhatsappTemplateSchema } from '@shared/whatsapp.schema';
import { z } from 'zod';

/**
 * Registra rotas para gerenciamento de templates do WhatsApp
 * @param app Aplicação Express
 * @param isAuthenticated Middleware de autenticação
 */
export function registerWhatsappTemplateRoutes(app: Express, isAuthenticated: any) {
  /**
   * Middleware para verificar se o usuário tem acesso aos templates da escola
   */
  const hasSchoolAccess = (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const schoolId = parseInt(req.params.schoolId);
    
    if (req.user.role === 'admin') {
      return next(); // Admins têm acesso a tudo
    }
    
    if (req.user.schoolId === schoolId || req.user.role === 'school') {
      return next(); // Usuários da mesma escola têm acesso
    }
    
    return res.status(403).json({ message: 'Acesso negado' });
  };

  /**
   * @route GET /api/whatsapp/templates
   * @desc Listar todos os templates globais
   * @access Private
   */
  app.get('/api/whatsapp/templates', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const templates = await whatsappTemplateService.getTemplates(category);
      
      res.json(templates);
    } catch (error) {
      console.error('Erro ao listar templates:', error);
      res.status(500).json({ 
        message: 'Erro ao listar templates', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  /**
   * @route GET /api/whatsapp/templates/school/:schoolId
   * @desc Listar templates de uma escola específica (incluindo globais)
   * @access Private
   */
  app.get('/api/whatsapp/templates/school/:schoolId', 
    isAuthenticated, 
    hasSchoolAccess,
    async (req: Request, res: Response) => {
      try {
        const schoolId = parseInt(req.params.schoolId);
        const category = req.query.category as string | undefined;
        
        const templates = await whatsappTemplateService.getTemplates(category, schoolId);
        
        res.json(templates);
      } catch (error) {
        console.error('Erro ao listar templates da escola:', error);
        res.status(500).json({ 
          message: 'Erro ao listar templates da escola', 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        });
      }
    }
  );

  /**
   * @route GET /api/whatsapp/templates/:id
   * @desc Obter um template específico
   * @access Private
   */
  app.get('/api/whatsapp/templates/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const template = await whatsappTemplateService.getTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: 'Template não encontrado' });
      }
      
      // Verificar acesso ao template
      if (template.schoolId && 
          req.user!.role !== 'admin' && 
          template.schoolId !== req.user!.schoolId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Erro ao obter template:', error);
      res.status(500).json({ 
        message: 'Erro ao obter template', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  /**
   * @route POST /api/whatsapp/templates
   * @desc Criar um novo template
   * @access Private (Admin ou School)
   */
  app.post('/api/whatsapp/templates', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Verificar permissões
      if (req.user!.role !== 'admin' && req.user!.role !== 'school') {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      // Validar dados
      const validationSchema = insertWhatsappTemplateSchema.extend({
        variables: z.array(
          z.object({
            name: z.string(),
            type: z.enum(['string', 'number', 'date', 'boolean', 'currency']),
            required: z.boolean(),
            description: z.string().optional(),
            defaultValue: z.any().optional()
          })
        ).optional()
      });
      
      const templateData = validationSchema.parse(req.body);
      
      // Se não for admin, restringir à escola do usuário
      if (req.user!.role !== 'admin') {
        templateData.schoolId = req.user!.schoolId;
      }
      
      // Criar template
      const template = await whatsappTemplateService.createTemplate(
        templateData, 
        req.user!.id
      );
      
      res.status(201).json(template);
    } catch (error) {
      console.error('Erro ao criar template:', error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        message: 'Erro ao criar template', 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof z.ZodError ? error.errors : undefined
      });
    }
  });

  /**
   * @route PUT /api/whatsapp/templates/:id
   * @desc Atualizar um template existente
   * @access Private (Admin ou dono da escola)
   */
  app.put('/api/whatsapp/templates/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar se template existe
      const template = await whatsappTemplateService.getTemplate(id);
      if (!template) {
        return res.status(404).json({ message: 'Template não encontrado' });
      }
      
      // Verificar permissões
      if (req.user!.role !== 'admin' && 
          (template.schoolId === null || template.schoolId !== req.user!.schoolId)) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      // Validar dados
      const validationSchema = z.object({
        name: z.string().min(3).optional(),
        content: z.string().min(5).optional(),
        category: z.string().optional(),
        active: z.boolean().optional(),
        variables: z.array(
          z.object({
            name: z.string(),
            type: z.enum(['string', 'number', 'date', 'boolean', 'currency']),
            required: z.boolean(),
            description: z.string().optional(),
            defaultValue: z.any().optional()
          })
        ).optional()
      });
      
      const updateData = validationSchema.parse(req.body);
      
      // Atualizar template
      const updatedTemplate = await whatsappTemplateService.updateTemplate(
        id, 
        updateData, 
        req.user!.id
      );
      
      res.json(updatedTemplate);
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        message: 'Erro ao atualizar template', 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof z.ZodError ? error.errors : undefined
      });
    }
  });

  /**
   * @route DELETE /api/whatsapp/templates/:id
   * @desc Desativar um template
   * @access Private (Admin ou dono da escola)
   */
  app.delete('/api/whatsapp/templates/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar se template existe
      const template = await whatsappTemplateService.getTemplate(id);
      if (!template) {
        return res.status(404).json({ message: 'Template não encontrado' });
      }
      
      // Verificar permissões
      if (req.user!.role !== 'admin' && 
          (template.schoolId === null || template.schoolId !== req.user!.schoolId)) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      // Desativar template
      const result = await whatsappTemplateService.deactivateTemplate(id, req.user!.id);
      
      res.json(result);
    } catch (error) {
      console.error('Erro ao desativar template:', error);
      res.status(500).json({ 
        message: 'Erro ao desativar template', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  /**
   * @route POST /api/whatsapp/templates/process
   * @desc Processar um template com dados
   * @access Private
   */
  app.post('/api/whatsapp/templates/process', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Validar corpo da requisição
      const requestSchema = z.object({
        templateId: z.number().optional(),
        templateContent: z.string().optional(),
        data: z.record(z.any())
      }).refine(data => data.templateId !== undefined || data.templateContent !== undefined, {
        message: "Deve fornecer templateId ou templateContent"
      });
      
      const { templateId, templateContent, data } = requestSchema.parse(req.body);
      
      // Processar template
      const processedContent = await whatsappTemplateService.processTemplate(
        templateId || templateContent!,
        data
      );
      
      res.json({ 
        processed: true, 
        content: processedContent
      });
    } catch (error) {
      console.error('Erro ao processar template:', error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        message: 'Erro ao processar template', 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof z.ZodError ? error.errors : undefined
      });
    }
  });

  /**
   * @route POST /api/whatsapp/templates/validate
   * @desc Validar dados para um template
   * @access Private
   */
  app.post('/api/whatsapp/templates/validate', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Validar corpo da requisição
      const requestSchema = z.object({
        templateId: z.number().optional(),
        templateContent: z.string().optional(),
        data: z.record(z.any())
      }).refine(data => data.templateId !== undefined || data.templateContent !== undefined, {
        message: "Deve fornecer templateId ou templateContent"
      });
      
      const { templateId, templateContent, data } = requestSchema.parse(req.body);
      
      // Validar dados para o template
      const validation = await whatsappTemplateService.validateTemplateData(
        templateId || templateContent!,
        data
      );
      
      res.json(validation);
    } catch (error) {
      console.error('Erro ao validar dados para template:', error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        message: 'Erro ao validar dados para template', 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof z.ZodError ? error.errors : undefined
      });
    }
  });

  /**
   * @route GET /api/whatsapp/templates/extract-variables
   * @desc Extrair variáveis de um conteúdo de template
   * @access Private
   */
  app.post('/api/whatsapp/templates/extract-variables', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: 'Conteúdo inválido ou não fornecido' });
      }
      
      const variables = whatsappTemplateService.extractVariables(content);
      
      res.json({ variables });
    } catch (error) {
      console.error('Erro ao extrair variáveis:', error);
      res.status(500).json({ 
        message: 'Erro ao extrair variáveis', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });
}