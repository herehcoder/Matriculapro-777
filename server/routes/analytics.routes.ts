/**
 * Rotas de Analytics e Business Intelligence
 * Implementa endpoints para métricas avançadas de conversão, previsões de demanda,
 * relatórios personalizados e exportação de dados
 */

import { Express, Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/analyticsService";
import { Parser } from "json2csv";
import * as ExcelJS from "xlsx";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "../db";

/**
 * Registra rotas de analytics
 * @param app Aplicação Express
 * @param isAuthenticated Middleware de autenticação
 */
export function registerAnalyticsRoutes(app: Express, isAuthenticated: any) {
  /**
   * Middleware para verificar se o usuário é admin ou usuário de escola
   */
  const isAdminOrSchool = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const user = req.user as any;
    if (!user || (user.role !== "admin" && user.role !== "school")) {
      return res.status(403).json({ 
        message: "Acesso negado - somente administradores e escolas podem acessar essas métricas" 
      });
    }

    next();
  };

  /**
   * Middleware para verificar permissões de escola e ajustar o parâmetro schoolId
   */
  const validateSchoolAccess = (req: Request, res: Response, next: Function) => {
    const user = req.user as any;
    
    // Se não for admin, só pode ver dados da própria escola
    if (user.role !== "admin") {
      req.query.schoolId = user.schoolId?.toString();
    }
    
    // Se for uma escola e não for informado schoolId, usa o da escola logada
    if (user.role === "school" && !req.query.schoolId && user.schoolId) {
      req.query.schoolId = user.schoolId.toString();
    }
    
    next();
  };

  /**
   * @route GET /api/analytics/conversion-metrics
   * @desc Métricas avançadas de conversão (leads para matrículas)
   * @access Admin, School
   */
  app.get('/api/analytics/conversion-metrics', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      const period = (req.query.period as string) || 'last30days';
      
      const metrics = await analyticsService.getConversionMetrics(schoolId, period);
      
      res.json(metrics);
    } catch (error) {
      console.error('Erro ao obter métricas de conversão:', error);
      res.status(500).json({ message: `Erro ao obter métricas: ${error.message}` });
    }
  });

  /**
   * @route GET /api/analytics/conversion-detail
   * @desc Detalhes de conversão por origem
   * @access Admin, School
   */
  app.get('/api/analytics/conversion-detail', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      const source = req.query.source as string;
      const period = (req.query.period as string) || 'last30days';
      
      const details = await analyticsService.getConversionDetails(schoolId, source, period);
      
      res.json(details);
    } catch (error) {
      console.error('Erro ao obter detalhes de conversão:', error);
      res.status(500).json({ message: `Erro ao obter detalhes: ${error.message}` });
    }
  });

  /**
   * @route GET /api/analytics/demand-forecast
   * @desc Previsão de demanda de matrículas
   * @access Admin, School
   */
  app.get('/api/analytics/demand-forecast', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      
      if (!schoolId) {
        return res.status(400).json({ message: "ID da escola é obrigatório para previsão de demanda" });
      }
      
      const months = req.query.months ? parseInt(req.query.months as string) : 3;
      const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
      
      const forecast = await analyticsService.getDemandForecast(schoolId, months, courseId);
      
      res.json(forecast);
    } catch (error) {
      console.error('Erro ao gerar previsão de demanda:', error);
      res.status(500).json({ message: `Erro ao gerar previsão: ${error.message}` });
    }
  });

  /**
   * @route GET /api/analytics/reports
   * @desc Lista de relatórios disponíveis
   * @access Admin, School, Attendant
   */
  app.get('/api/analytics/reports', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      let filters: any = {};
      
      // Se não for admin, só pode ver relatórios da própria escola
      if (user.role !== "admin" && user.schoolId) {
        filters.schoolId = user.schoolId;
      } else if (req.query.schoolId) {
        filters.schoolId = parseInt(req.query.schoolId as string);
      }
      
      if (req.query.type) {
        filters.type = req.query.type;
      }
      
      const reports = await analyticsService.getReports(filters);
      
      res.json(reports);
    } catch (error) {
      console.error('Erro ao listar relatórios:', error);
      res.status(500).json({ message: `Erro ao listar relatórios: ${error.message}` });
    }
  });

  /**
   * @route POST /api/analytics/reports
   * @desc Gerar novo relatório personalizado
   * @access Admin, School
   */
  app.post('/api/analytics/reports', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const config = req.body;
      
      // Se não for admin, só pode gerar relatórios da própria escola
      if (user.role !== "admin") {
        config.schoolId = user.schoolId;
      }
      
      // Configurações obrigatórias
      if (!config.type || !config.title) {
        return res.status(400).json({ message: "Tipo e título do relatório são obrigatórios" });
      }
      
      const report = await analyticsService.generateReport(config);
      
      res.status(201).json(report);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ message: `Erro ao gerar relatório: ${error.message}` });
    }
  });

  /**
   * @route GET /api/analytics/reports/:id
   * @desc Baixar relatório específico
   * @access Admin, School
   */
  app.get('/api/analytics/reports/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const reportId = req.params.id;
      const report = await analyticsService.getReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }
      
      // Verificar permissões
      const user = req.user as any;
      if (user.role !== "admin" && report.schoolId !== user.schoolId) {
        return res.status(403).json({ message: "Sem permissão para acessar este relatório" });
      }
      
      const fileData = await analyticsService.downloadReport(reportId);
      
      // Configurar cabeçalhos baseado no tipo de arquivo
      const filename = `relatorio_${report.type}_${reportId}.${report.format}`;
      let contentType = 'application/octet-stream';
      
      switch (report.format) {
        case 'csv':
          contentType = 'text/csv';
          break;
        case 'xlsx':
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          contentType = 'application/pdf';
          break;
        case 'json':
          contentType = 'application/json';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileData.content);
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
      res.status(500).json({ message: `Erro ao baixar relatório: ${error.message}` });
    }
  });

  /**
   * @route GET /api/analytics/export/:entity
   * @desc Exportar dados de uma entidade específica
   * @access Admin, School
   */
  app.get('/api/analytics/export/:entity', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const entity = req.params.entity;
      const format = (req.query.format as string) || 'csv';
      
      // Validar entidade
      const validEntities = ['enrollments', 'students', 'leads', 'courses', 'payments'];
      if (!validEntities.includes(entity)) {
        return res.status(400).json({ 
          message: `Entidade inválida. Use uma das seguintes: ${validEntities.join(', ')}` 
        });
      }
      
      // Validar formato
      const validFormats = ['csv', 'xlsx', 'json'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({ 
          message: `Formato inválido. Use um dos seguintes: ${validFormats.join(', ')}` 
        });
      }
      
      // Processar filtros
      const filters: any = {};
      
      if (req.query.schoolId) {
        filters.schoolId = parseInt(req.query.schoolId as string);
      }
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      // Obter dados
      const data = await analyticsService.exportEntityData(entity, filters);
      
      if (!data || data.length === 0) {
        return res.status(404).json({ message: "Nenhum dado encontrado com os filtros especificados" });
      }
      
      // Processar resposta baseado no formato
      const filename = `export_${entity}_${new Date().toISOString().split('T')[0]}.${format}`;
      
      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.json(data);
          break;
          
        case 'csv':
          const parser = new Parser({ header: true });
          const csv = parser.parse(data);
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.send(csv);
          break;
          
        case 'xlsx':
          const workbook = ExcelJS.utils.book_new();
          const worksheet = ExcelJS.utils.json_to_sheet(data);
          ExcelJS.utils.book_append_sheet(workbook, worksheet, entity);
          
          const tempFilePath = path.join(os.tmpdir(), filename);
          ExcelJS.writeFile(workbook, tempFilePath);
          
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          const fileStream = fs.createReadStream(tempFilePath);
          fileStream.pipe(res);
          
          // Limpar arquivo após envio
          fileStream.on('end', () => {
            fs.unlinkSync(tempFilePath);
          });
          break;
      }
    } catch (error) {
      console.error(`Erro ao exportar dados de ${req.params.entity}:`, error);
      res.status(500).json({ message: `Erro ao exportar dados: ${error.message}` });
    }
  });

  /**
   * @route GET /api/analytics/kpi-dashboard
   * @desc Dashboard de KPIs principais
   * @access Admin, School
   */
  app.get('/api/analytics/kpi-dashboard', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      const period = (req.query.period as string) || '30days';
      
      const kpis = await analyticsService.getKpiDashboard(schoolId, period);
      
      res.json(kpis);
    } catch (error) {
      console.error('Erro ao obter KPI dashboard:', error);
      res.status(500).json({ message: `Erro ao obter KPIs: ${error.message}` });
    }
  });

  /**
   * @route GET /api/analytics/revenue-forecast
   * @desc Previsão de receita
   * @access Admin, School
   */
  app.get('/api/analytics/revenue-forecast', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      
      if (!schoolId) {
        return res.status(400).json({ message: "ID da escola é obrigatório para previsão de receita" });
      }
      
      const months = req.query.months ? parseInt(req.query.months as string) : 3;
      
      const forecast = await analyticsService.getRevenueForecast(schoolId, months);
      
      res.json(forecast);
    } catch (error) {
      console.error('Erro ao gerar previsão de receita:', error);
      res.status(500).json({ message: `Erro ao gerar previsão: ${error.message}` });
    }
  });
  
  /**
   * @route GET /api/analytics/metric-alerts
   * @desc Obter alertas de métricas
   * @access Admin, School
   */
  app.get('/api/analytics/metric-alerts', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      let schoolId: number | undefined = undefined;
      let userId: number | undefined = undefined;
      
      // Se for admin e passar schoolId, filtra por escola
      if (user.role === 'admin' && req.query.schoolId) {
        schoolId = parseInt(req.query.schoolId as string);
      } 
      // Se for escola, filtra pela própria escola
      else if (user.role === 'school') {
        schoolId = user.schoolId;
      }
      
      // Se solicitar alertas pessoais
      if (req.query.personal === 'true') {
        userId = user.id;
        schoolId = undefined; // Se pessoal, ignora escola
      }
      
      const alerts = await analyticsService.getMetricAlerts(schoolId, userId);
      
      res.json(alerts);
    } catch (error) {
      console.error('Erro ao obter alertas de métricas:', error);
      res.status(500).json({ message: `Erro ao obter alertas: ${error.message}` });
    }
  });
  
  /**
   * @route GET /api/analytics/metric-alerts/:id
   * @desc Obter um alerta de métrica por ID
   * @access Admin, School
   */
  app.get('/api/analytics/metric-alerts/:id', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      const alertId = parseInt(req.params.id);
      const user = req.user as any;
      
      const alert = await analyticsService.getMetricAlertById(alertId);
      
      if (!alert) {
        return res.status(404).json({ message: 'Alerta não encontrado' });
      }
      
      // Verificar permissões
      if (user.role !== 'admin' && 
          alert.schoolId !== user.schoolId && 
          alert.userId !== user.id) {
        return res.status(403).json({ message: 'Sem permissão para acessar este alerta' });
      }
      
      res.json(alert);
    } catch (error) {
      console.error(`Erro ao obter alerta ID ${req.params.id}:`, error);
      res.status(500).json({ message: `Erro ao obter alerta: ${error.message}` });
    }
  });
  
  /**
   * @route POST /api/analytics/metric-alerts
   * @desc Criar um novo alerta de métrica
   * @access Admin, School
   */
  app.post('/api/analytics/metric-alerts', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const alertData = req.body;
      
      // Se não for admin, só pode criar alertas para si mesmo ou para sua escola
      if (user.role !== 'admin') {
        if (alertData.schoolId && alertData.schoolId !== user.schoolId) {
          return res.status(403).json({ message: 'Sem permissão para criar alertas para outra escola' });
        }
        
        // Se não especificar schoolId, associar à escola do usuário
        if (!alertData.schoolId && user.schoolId) {
          alertData.schoolId = user.schoolId;
        }
        
        // Se não especificar userId, associar ao usuário
        if (!alertData.userId && !alertData.schoolId) {
          alertData.userId = user.id;
        }
      }
      
      // Validações básicas
      if (!alertData.metric || !alertData.condition || !alertData.threshold || !alertData.period || !alertData.notification_type) {
        return res.status(400).json({ message: 'Campos obrigatórios não informados' });
      }
      
      // Definir status ativo por padrão
      if (alertData.is_active === undefined) {
        alertData.is_active = true;
      }
      
      const newAlert = await analyticsService.createMetricAlert(alertData);
      
      res.status(201).json(newAlert);
    } catch (error) {
      console.error('Erro ao criar alerta de métrica:', error);
      res.status(500).json({ message: `Erro ao criar alerta: ${error.message}` });
    }
  });
  
  /**
   * @route PATCH /api/analytics/metric-alerts/:id
   * @desc Atualizar um alerta de métrica
   * @access Admin, School
   */
  app.patch('/api/analytics/metric-alerts/:id', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      const alertId = parseInt(req.params.id);
      const user = req.user as any;
      const updateData = req.body;
      
      // Obter alerta atual
      const existingAlert = await analyticsService.getMetricAlertById(alertId);
      
      if (!existingAlert) {
        return res.status(404).json({ message: 'Alerta não encontrado' });
      }
      
      // Verificar permissões
      if (user.role !== 'admin' && 
          existingAlert.schoolId !== user.schoolId && 
          existingAlert.userId !== user.id) {
        return res.status(403).json({ message: 'Sem permissão para modificar este alerta' });
      }
      
      // Impedir alteração de schoolId ou userId por não-admins
      if (user.role !== 'admin') {
        if (updateData.schoolId && updateData.schoolId !== existingAlert.schoolId) {
          return res.status(403).json({ message: 'Sem permissão para alterar a escola do alerta' });
        }
        
        if (updateData.userId && updateData.userId !== existingAlert.userId) {
          return res.status(403).json({ message: 'Sem permissão para alterar o usuário do alerta' });
        }
      }
      
      const updatedAlert = await analyticsService.updateMetricAlert(alertId, updateData);
      
      res.json(updatedAlert);
    } catch (error) {
      console.error(`Erro ao atualizar alerta ID ${req.params.id}:`, error);
      res.status(500).json({ message: `Erro ao atualizar alerta: ${error.message}` });
    }
  });
  
  /**
   * @route DELETE /api/analytics/metric-alerts/:id
   * @desc Excluir um alerta de métrica
   * @access Admin, School
   */
  app.delete('/api/analytics/metric-alerts/:id', isAuthenticated, isAdminOrSchool, async (req: Request, res: Response) => {
    try {
      const alertId = parseInt(req.params.id);
      const user = req.user as any;
      
      // Obter alerta atual
      const existingAlert = await analyticsService.getMetricAlertById(alertId);
      
      if (!existingAlert) {
        return res.status(404).json({ message: 'Alerta não encontrado' });
      }
      
      // Verificar permissões
      if (user.role !== 'admin' && 
          existingAlert.schoolId !== user.schoolId && 
          existingAlert.userId !== user.id) {
        return res.status(403).json({ message: 'Sem permissão para excluir este alerta' });
      }
      
      const success = await analyticsService.deleteMetricAlert(alertId);
      
      if (success) {
        res.status(204).end();
      } else {
        res.status(500).json({ message: 'Falha ao excluir alerta' });
      }
    } catch (error) {
      console.error(`Erro ao excluir alerta ID ${req.params.id}:`, error);
      res.status(500).json({ message: `Erro ao excluir alerta: ${error.message}` });
    }
  });
  
  /**
   * @route POST /api/analytics/trigger-alerts
   * @desc Acionar verificação de alertas manualmente
   * @access Admin
   */
  app.post('/api/analytics/trigger-alerts', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      // Somente administradores podem acionar verificação manual
      if (user.role !== 'admin') {
        return res.status(403).json({ 
          message: 'Somente administradores podem acionar verificação manual de alertas' 
        });
      }
      
      const triggeredCount = await analyticsService.checkAndTriggerAlerts();
      
      res.json({
        success: true,
        message: `Verificação concluída. ${triggeredCount} alertas disparados.`
      });
    } catch (error) {
      console.error('Erro ao verificar alertas manualmente:', error);
      res.status(500).json({ message: `Erro ao verificar alertas: ${error.message}` });
    }
  });
}