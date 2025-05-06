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
}