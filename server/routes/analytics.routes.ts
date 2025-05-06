/**
 * Rotas de Analytics e Business Intelligence
 * Implementa endpoints para métricas avançadas de conversão, previsões de demanda,
 * relatórios personalizados e exportação de dados
 */

import { Request, Response, Express } from 'express';
import { analyticsService } from '../services/analyticsService';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { enrollments, leads, schools, students, courses, users, payments } from '@shared/schema';
import { parse } from 'json2csv';
import * as XLSX from 'xlsx';
import { logAction } from '../services/securityService';
import fs from 'fs';
import path from 'path';
import PdfPrinter from 'pdfmake';

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
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: 'Não autorizado' });
    
    if (user.role === 'admin' || user.role === 'school') {
      return next();
    }
    
    return res.status(403).json({ message: 'Acesso negado' });
  };

  /**
   * Middleware para verificar permissões de escola e ajustar o parâmetro schoolId
   */
  const validateSchoolAccess = (req: Request, res: Response, next: Function) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: 'Não autorizado' });
    
    // Se for usuário de escola, forçar o schoolId como o da própria escola
    if (user.role === 'school' || user.role === 'attendant') {
      req.query.schoolId = user.schoolId.toString();
    }
    
    // Se for admin, pode acessar qualquer escola ou todas
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
      const period = req.query.period as string || 'last30days';
      
      // Obter métricas de conversão
      const metrics = await analyticsService.getConversionMetrics(schoolId, period);
      res.json(metrics);
    } catch (error) {
      console.error('Erro ao obter métricas de conversão:', error);
      res.status(500).json({ 
        message: 'Erro ao obter métricas de conversão', 
        error: error.message 
      });
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
      const period = req.query.period as string || 'last30days';
      
      // Obter detalhes de conversão
      const details = await analyticsService.getConversionDetails(schoolId, source, period);
      res.json(details);
    } catch (error) {
      console.error('Erro ao obter detalhes de conversão:', error);
      res.status(500).json({ 
        message: 'Erro ao obter detalhes de conversão', 
        error: error.message 
      });
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
      const months = req.query.months ? parseInt(req.query.months as string) : 3;
      const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
      
      if (!schoolId) {
        return res.status(400).json({ message: 'ID da escola é obrigatório' });
      }
      
      // Obter previsão de demanda
      const forecast = await analyticsService.getDemandForecast(schoolId, months, courseId);
      res.json(forecast);
    } catch (error) {
      console.error('Erro ao obter previsão de demanda:', error);
      res.status(500).json({ 
        message: 'Erro ao obter previsão de demanda', 
        error: error.message 
      });
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
      let schoolId: number | undefined;
      
      if (user.role === 'school' || user.role === 'attendant') {
        schoolId = user.schoolId;
      } else if (user.role === 'admin' && req.query.schoolId) {
        schoolId = parseInt(req.query.schoolId as string);
      }
      
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      // Obter relatórios
      const reports = await analyticsService.getReports({
        userId: user.id,
        schoolId,
        page,
        limit
      });
      
      res.json(reports);
    } catch (error) {
      console.error('Erro ao obter lista de relatórios:', error);
      res.status(500).json({ 
        message: 'Erro ao obter lista de relatórios', 
        error: error.message 
      });
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
      
      // Definir usuário e escola para o relatório
      config.userId = user.id;
      
      if (user.role === 'school' || user.role === 'attendant') {
        config.schoolId = user.schoolId;
      } else if (user.role === 'admin' && !config.schoolId) {
        // Admins podem gerar relatórios para qualquer escola ou global
        config.schoolId = req.body.schoolId || undefined;
      }
      
      // Validar configuração mínima
      if (!config.type || !config.title) {
        return res.status(400).json({ 
          message: 'Configuração inválida. Tipo e título são obrigatórios.' 
        });
      }
      
      // Gerar relatório
      const result = await analyticsService.generateReport(config);
      
      // Registrar ação
      await logAction(
        user.id.toString(),
        'report_generated',
        'reports',
        result.reportId,
        { reportType: config.type }
      );
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ 
        message: 'Erro ao gerar relatório', 
        error: error.message 
      });
    }
  });

  /**
   * @route GET /api/analytics/reports/:id
   * @desc Baixar relatório específico
   * @access Admin, School
   */
  app.get('/api/analytics/reports/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const reportId = req.params.id;
      
      // Obter detalhes do relatório
      const report = await analyticsService.getReport(reportId, {
        userId: user.id,
        schoolId: user.role === 'school' || user.role === 'attendant' ? user.schoolId : undefined
      });
      
      if (!report || !report.filePath) {
        return res.status(404).json({ message: 'Relatório não encontrado' });
      }
      
      // Verificar permissão
      if (user.role !== 'admin' && report.schoolId !== user.schoolId && report.userId !== user.id) {
        return res.status(403).json({ message: 'Acesso negado a este relatório' });
      }
      
      // Enviar arquivo
      res.download(report.filePath, `${report.title}.${report.filePath.split('.').pop()}`);
      
      // Registrar ação
      await logAction(
        user.id.toString(),
        'report_downloaded',
        'reports',
        reportId,
        { reportTitle: report.title }
      );
      
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
      res.status(500).json({ 
        message: 'Erro ao baixar relatório', 
        error: error.message 
      });
    }
  });

  /**
   * @route GET /api/analytics/export/:entity
   * @desc Exportar dados de uma entidade específica
   * @access Admin, School
   */
  app.get('/api/analytics/export/:entity', isAuthenticated, isAdminOrSchool, validateSchoolAccess, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const entity = req.params.entity;
      const format = (req.query.format as string || 'csv').toLowerCase();
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : undefined;
      
      // Verificar permissão para escola
      if (user.role !== 'admin' && user.schoolId !== schoolId) {
        return res.status(403).json({ message: 'Acesso negado a dados de outra escola' });
      }
      
      // Verificar entidade válida
      const validEntities = ['enrollments', 'students', 'leads', 'courses', 'payments'];
      if (!validEntities.includes(entity)) {
        return res.status(400).json({ message: 'Entidade inválida para exportação' });
      }
      
      // Preparar filtros
      const filters: any = {};
      if (schoolId) {
        filters.schoolId = schoolId;
      }
      
      // Datas de filtro opcional
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      // Obter dados
      const data = await analyticsService.exportEntityData(entity, filters);
      
      if (!data || data.length === 0) {
        return res.status(404).json({ message: 'Nenhum dado encontrado para exportar' });
      }
      
      // Exportar em formato específico
      const fileName = `edumatrik_${entity}_${new Date().toISOString().slice(0, 10)}`;
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.json`);
        return res.json(data);
      } 
      else if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, entity);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        return res.send(Buffer.from(excelBuffer));
      }
      else if (format === 'pdf') {
        // Configuração para pdfmake
        const fonts = {
          Roboto: {
            normal: path.join(process.cwd(), 'node_modules', 'pdfmake', 'build', 'fonts', 'Roboto-Regular.ttf'),
            bold: path.join(process.cwd(), 'node_modules', 'pdfmake', 'build', 'fonts', 'Roboto-Medium.ttf'),
            italics: path.join(process.cwd(), 'node_modules', 'pdfmake', 'build', 'fonts', 'Roboto-Italic.ttf'),
            bolditalics: path.join(process.cwd(), 'node_modules', 'pdfmake', 'build', 'fonts', 'Roboto-MediumItalic.ttf')
          }
        };
        
        const printer = new PdfPrinter(fonts);
        
        // Extrair colunas
        const columns = Object.keys(data[0]);
        
        // Criar definição da tabela
        const tableBody = [
          columns.map(col => ({ text: col, style: 'tableHeader' }))
        ];
        
        // Adicionar dados
        data.forEach(row => {
          const rowData = columns.map(col => {
            // Formatação especial para datas e valores
            if (row[col] instanceof Date) {
              return { text: row[col].toLocaleDateString('pt-BR') };
            }
            return { text: String(row[col] || '') };
          });
          tableBody.push(rowData);
        });
        
        // Definição do documento
        const docDefinition = {
          content: [
            { text: `Exportação de ${entity}`, style: 'header' },
            { text: `Gerado em ${new Date().toLocaleDateString('pt-BR')}`, style: 'subheader' },
            { table: {
                headerRows: 1,
                widths: Array(columns.length).fill('*'),
                body: tableBody
              }
            }
          ],
          styles: {
            header: {
              fontSize: 18,
              bold: true,
              margin: [0, 0, 0, 10]
            },
            subheader: {
              fontSize: 12,
              italic: true,
              margin: [0, 0, 0, 10]
            },
            tableHeader: {
              bold: true,
              fillColor: '#eeeeee'
            }
          }
        };
        
        // Gerar PDF
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        
        // Configurar cabeçalhos
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`);
        
        pdfDoc.pipe(res);
        pdfDoc.end();
        
        return;
      }
      else {
        // Padrão: CSV
        const opts = { fields: Object.keys(data[0]) };
        const csv = parse(data, opts);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`);
        return res.send(csv);
      }
      
    } catch (error) {
      console.error(`Erro ao exportar ${req.params.entity}:`, error);
      res.status(500).json({ 
        message: `Erro ao exportar dados`, 
        error: error.message 
      });
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
      const period = req.query.period as string || '30days';
      
      // Obter KPIs
      const kpiData = await analyticsService.getKpiDashboard(schoolId, period);
      res.json(kpiData);
    } catch (error) {
      console.error('Erro ao obter KPI dashboard:', error);
      res.status(500).json({ 
        message: 'Erro ao obter KPI dashboard', 
        error: error.message 
      });
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
      const months = req.query.months ? parseInt(req.query.months as string) : 3;
      
      if (!schoolId) {
        return res.status(400).json({ message: 'ID da escola é obrigatório' });
      }
      
      // Obter previsão de receita
      const forecast = await analyticsService.getRevenueForecast(schoolId, months);
      res.json(forecast);
    } catch (error) {
      console.error('Erro ao obter previsão de receita:', error);
      res.status(500).json({ 
        message: 'Erro ao obter previsão de receita', 
        error: error.message 
      });
    }
  });

  return app;
}