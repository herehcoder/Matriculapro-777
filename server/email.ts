import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY não está definido. O envio de e-mails não funcionará.');
}

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Serviço para envio de e-mails usando Resend
 */
export const emailService = {
  /**
   * Envia um e-mail usando Resend
   * @param options Opções de envio de e-mail
   * @returns Resultado do envio
   */
  async sendEmail(options: EmailOptions) {
    try {
      const { to, subject, html, from = 'noreply@edumatrikapp.com' } = options;
      
      const data = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });
      
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error);
      return { success: false, error };
    }
  },

  /**
   * Envia um e-mail de redefinição de senha
   * @param to Email do destinatário
   * @param resetToken Token de redefinição de senha
   * @param userName Nome do usuário
   * @returns Resultado do envio
   */
  async sendPasswordResetEmail(to: string, resetToken: string, userName: string) {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="background-color: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">EduMatrik AI</h1>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #111827; font-weight: 600;">Olá, ${userName}</h2>
          <p style="color: #4b5563; line-height: 1.5;">Recebemos uma solicitação para redefinir sua senha do EduMatrik.</p>
          <p style="color: #4b5563; line-height: 1.5;">Se você não solicitou uma redefinição de senha, ignore este e-mail ou entre em contato com o suporte.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: 600;">Redefinir Senha</a>
          </div>
          <p style="color: #4b5563; line-height: 1.5;">Ou acesse o link abaixo:</p>
          <p style="color: #4b5563; line-height: 1.5;"><a href="${resetUrl}" style="color: #4F46E5; text-decoration: underline;">${resetUrl}</a></p>
          <p style="color: #4b5563; line-height: 1.5;">Este link expirará em 1 hora por motivos de segurança.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 0.875rem; text-align: center;">© ${new Date().getFullYear()} EduMatrik AI. Todos os direitos reservados.</p>
        </div>
      </div>
    `;
    
    return await this.sendEmail({
      to,
      subject: 'Redefinição de Senha - EduMatrik AI',
      html,
    });
  }
};