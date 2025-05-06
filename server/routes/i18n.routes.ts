import { Router, Request, Response } from 'express';
import { i18nService } from '../services/i18nService';
import { requireAuth, requireAdmin, requireSchoolAdmin } from '../middleware/auth';
import {
  insertLanguageSchema,
  insertSchoolLanguageSchema,
  insertTranslationKeySchema,
  insertTranslationSchema,
  insertUserLanguagePreferenceSchema
} from '@shared/i18n.schema';
import { z } from 'zod';

const router = Router();

// Middleware para a maioria das rotas
router.use(requireAuth);

// ----- Gerenciamento de idiomas -----

// Obter todos os idiomas ativos
router.get('/languages', async (req, res) => {
  try {
    const languages = await i18nService.getLanguages();
    return res.json(languages);
  } catch (error) {
    console.error('Erro ao obter idiomas:', error);
    return res.status(500).json({ message: 'Erro ao obter idiomas', error: error.message });
  }
});

// Obter idioma padrão
router.get('/languages/default', async (req, res) => {
  try {
    const language = await i18nService.getDefaultLanguage();
    return res.json(language);
  } catch (error) {
    console.error('Erro ao obter idioma padrão:', error);
    return res.status(500).json({ message: 'Erro ao obter idioma padrão', error: error.message });
  }
});

// Criar novo idioma (apenas admin)
router.post('/languages', requireAdmin, async (req, res) => {
  try {
    const validatedData = insertLanguageSchema.parse(req.body);
    const language = await i18nService.createLanguage(validatedData);
    return res.status(201).json(language);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar idioma:', error);
    return res.status(500).json({ message: 'Erro ao criar idioma', error: error.message });
  }
});

// ----- Idiomas por escola -----

// Obter idiomas de uma escola
router.get('/schools/:schoolId/languages', requireSchoolAdmin, async (req, res) => {
  try {
    const schoolId = parseInt(req.params.schoolId, 10);
    
    if (isNaN(schoolId)) {
      return res.status(400).json({ message: 'ID da escola inválido' });
    }
    
    const languages = await i18nService.getSchoolLanguages(schoolId);
    return res.json(languages);
  } catch (error) {
    console.error('Erro ao obter idiomas da escola:', error);
    return res.status(500).json({ message: 'Erro ao obter idiomas da escola', error: error.message });
  }
});

// Adicionar idioma a uma escola
router.post('/schools/:schoolId/languages', requireSchoolAdmin, async (req, res) => {
  try {
    const schoolId = parseInt(req.params.schoolId, 10);
    
    if (isNaN(schoolId)) {
      return res.status(400).json({ message: 'ID da escola inválido' });
    }
    
    const data = { ...req.body, schoolId };
    const validatedData = insertSchoolLanguageSchema.parse(data);
    const schoolLanguage = await i18nService.addLanguageToSchool(validatedData);
    return res.status(201).json(schoolLanguage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao adicionar idioma à escola:', error);
    return res.status(500).json({ message: 'Erro ao adicionar idioma à escola', error: error.message });
  }
});

// ----- Chaves de tradução -----

// Obter chaves de tradução
router.get('/keys', async (req, res) => {
  try {
    const filter = req.query.filter as string;
    const keys = await i18nService.getTranslationKeys(filter);
    return res.json(keys);
  } catch (error) {
    console.error('Erro ao obter chaves de tradução:', error);
    return res.status(500).json({ message: 'Erro ao obter chaves de tradução', error: error.message });
  }
});

// Criar nova chave de tradução
router.post('/keys', requireAdmin, async (req, res) => {
  try {
    const validatedData = insertTranslationKeySchema.parse(req.body);
    const key = await i18nService.createTranslationKey(validatedData);
    return res.status(201).json(key);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao criar chave de tradução:', error);
    return res.status(500).json({ message: 'Erro ao criar chave de tradução', error: error.message });
  }
});

// ----- Traduções -----

// Obter traduções para um idioma (e escola, se especificada)
router.get('/translations/:languageId', async (req, res) => {
  try {
    const languageId = parseInt(req.params.languageId, 10);
    const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string, 10) : undefined;
    
    if (isNaN(languageId)) {
      return res.status(400).json({ message: 'ID do idioma inválido' });
    }
    
    if (schoolId !== undefined && isNaN(schoolId)) {
      return res.status(400).json({ message: 'ID da escola inválido' });
    }
    
    const translations = await i18nService.getTranslations(languageId, schoolId);
    return res.json(translations);
  } catch (error) {
    console.error('Erro ao obter traduções:', error);
    return res.status(500).json({ message: 'Erro ao obter traduções', error: error.message });
  }
});

// Adicionar tradução
router.post('/translations', requireSchoolAdmin, async (req, res) => {
  try {
    const validatedData = insertTranslationSchema.parse(req.body);
    const translation = await i18nService.addTranslation(validatedData);
    return res.status(201).json(translation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao adicionar tradução:', error);
    return res.status(500).json({ message: 'Erro ao adicionar tradução', error: error.message });
  }
});

// Atualizar tradução
router.put('/translations/:id', requireSchoolAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    
    // Validar parcialmente os dados (permitir atualização parcial)
    const validatedData = insertTranslationSchema.partial().parse(req.body);
    
    // Usar ID do usuário autenticado
    const user = req.user as any;
    const translation = await i18nService.updateTranslation(id, validatedData, user.id);
    return res.json(translation);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao atualizar tradução:', error);
    return res.status(500).json({ message: 'Erro ao atualizar tradução', error: error.message });
  }
});

// ----- Preferências de idioma do usuário -----

// Obter preferência de idioma do usuário
router.get('/user-preferences', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const preference = await i18nService.getUserLanguagePreference(user.id);
    return res.json(preference || { languageId: null });
  } catch (error: any) {
    console.error('Erro ao obter preferência de idioma:', error);
    return res.status(500).json({ message: 'Erro ao obter preferência de idioma', error: error.message });
  }
});

// Definir preferência de idioma do usuário
router.post('/user-preferences', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const data = { ...req.body, userId: user.id };
    const validatedData = insertUserLanguagePreferenceSchema.parse(data);
    const preference = await i18nService.setUserLanguagePreference(validatedData);
    return res.json(preference);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao definir preferência de idioma:', error);
    return res.status(500).json({ message: 'Erro ao definir preferência de idioma', error: error.message });
  }
});

// ----- Tradução automática -----

// Iniciar job de tradução automática
router.post('/translation-jobs', requireSchoolAdmin, async (req, res) => {
  try {
    const { sourceLanguageId, targetLanguageId, keyIds } = req.body;
    
    if (!sourceLanguageId || !targetLanguageId) {
      return res.status(400).json({ message: 'Idiomas fonte e alvo são obrigatórios' });
    }
    
    // Iniciar job (vai processar assincronamente)
    const jobId = await i18nService.startTranslationJob(
      parseInt(sourceLanguageId, 10),
      parseInt(targetLanguageId, 10),
      req.user.id,
      keyIds
    );
    
    return res.status(202).json({
      jobId,
      message: 'Job de tradução iniciado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao iniciar job de tradução:', error);
    return res.status(500).json({ message: 'Erro ao iniciar job de tradução', error: error.message });
  }
});

// ----- Inicialização do sistema -----

// Inicializar sistema de internacionalização (apenas admin)
router.post('/initialize', requireAdmin, async (req, res) => {
  try {
    await i18nService.initializeSystem();
    return res.json({ message: 'Sistema de internacionalização inicializado com sucesso' });
  } catch (error) {
    console.error('Erro ao inicializar sistema de i18n:', error);
    return res.status(500).json({ message: 'Erro ao inicializar sistema de i18n', error: error.message });
  }
});

export default router;