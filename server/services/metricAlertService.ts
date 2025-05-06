/**
 * Serviço de processamento de notificações para alertas de métricas
 */
import { db } from '../db';

// Adaptadores para compatibilidade com outros serviços
// Estas são implementações simplificadas para evitar dependências circulares
const emailService = {
  sendEmail: async (params: { to: string, subject: string, html: string }) => {
    console.log(`Enviando email para ${params.to} com assunto "${params.subject}"`);
    try {
      // Implementação real enviaria o email
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return false;
    }
  }
};

async function sendUserNotification(userId: number, notification: any): Promise<void> {
  console.log(`Enviando notificação para usuário ${userId}:`, notification);
  // Implementação real enviaria a notificação para o usuário
}

async function sendSchoolNotification(schoolId: number, notification: any): Promise<void> {
  console.log(`Enviando notificação para escola ${schoolId}:`, notification);
  // Implementação real enviaria a notificação para a escola
}

/**
 * Interface para alertas de métricas
 */
export interface MetricAlert {
  id?: number;
  schoolId?: number;
  userId?: number;
  metric: string;
  condition: 'below' | 'above';
  threshold: number;
  period: string;
  notification_type: 'system' | 'email' | 'both';
  is_active: boolean;
  description?: string;
  last_triggered?: Date;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Processa notificações para alertas de métricas
 * @param alert Informações do alerta a ser enviado
 */
export async function sendMetricAlert(alert: MetricAlert): Promise<void> {
  try {
    // Mapeamento de rótulos para métricas
    const metricLabels = {
      conversion_rate: 'Taxa de conversão',
      enrollment_count: 'Total de matrículas',
      lead_count: 'Total de leads',
      document_rejection_rate: 'Taxa de rejeição de documentos',
      payment_failure_rate: 'Taxa de falhas em pagamentos',
      whatsapp_response_time: 'Tempo de resposta no WhatsApp',
    };
    
    // Mapeamento de rótulos para condições
    const conditionLabels = {
      above: 'acima de',
      below: 'abaixo de',
    };
    
    // Gerar mensagens com base nos rótulos
    const metricName = metricLabels[alert.metric as keyof typeof metricLabels] || alert.metric;
    const conditionName = conditionLabels[alert.condition as keyof typeof conditionLabels] || alert.condition;
    const thresholdFormatted = alert.metric.includes('rate') ? `${Math.round(alert.threshold * 100)}%` : alert.threshold;
    
    const title = `Alerta: ${metricName} ${conditionName} ${thresholdFormatted}`;
    const message = alert.description || `O valor da métrica "${metricName}" está ${conditionName} ${thresholdFormatted} no período de ${alert.period}.`;
    
    // Processamento de notificações do sistema
    if (alert.notification_type === 'system' || alert.notification_type === 'both') {
      if (alert.userId) {
        // Notificar usuário específico
        await sendUserNotification(alert.userId, {
          title,
          message,
          type: 'system',
          data: {
            alertId: alert.id,
            metric: alert.metric,
            threshold: alert.threshold,
          },
        });
      } else if (alert.schoolId) {
        // Notificar escola
        await sendSchoolNotification(alert.schoolId, {
          title,
          message,
          type: 'system',
          data: {
            alertId: alert.id,
            metric: alert.metric,
            threshold: alert.threshold,
          },
        });
      }
    }
    
    // Processamento de emails
    if (alert.notification_type === 'email' || alert.notification_type === 'both') {
      try {
        let emailTo = '';
        
        // Buscar endereço de email com base no destinatário do alerta
        if (alert.userId) {
          const userResult = await db.execute('SELECT email FROM users WHERE id = $1', [alert.userId]);
          if (userResult.rows.length > 0) {
            emailTo = userResult.rows[0].email;
          }
        } else if (alert.schoolId) {
          const schoolResult = await db.execute('SELECT email FROM schools WHERE id = $1', [alert.schoolId]);
          if (schoolResult.rows.length > 0) {
            emailTo = schoolResult.rows[0].email;
          }
        }
        
        // Enviar email se tiver um destinatário
        if (emailTo) {
          await emailService.sendEmail({
            to: emailTo,
            subject: title,
            html: `
              <h2>Alerta de Métrica</h2>
              <p>${message}</p>
              <p><strong>Métrica:</strong> ${metricName}</p>
              <p><strong>Condição:</strong> ${conditionName} ${thresholdFormatted}</p>
              <p><strong>Período:</strong> ${alert.period}</p>
              <p><em>Este é um e-mail automático do sistema EduMatrik AI.</em></p>
            `,
          });
        }
      } catch (emailError) {
        console.error('Erro ao enviar e-mail de alerta:', emailError);
      }
    }
  } catch (error) {
    console.error('Erro ao processar alerta:', error);
  }
}