/**
 * Serviço OCR usando a API do Mistral AI
 * 
 * Este serviço implementa reconhecimento de texto usando a API gratuita do Mistral AI
 * para substituir o Tesseract que é pesado e requer muitos recursos computacionais.
 */

import fetch from 'node-fetch';
import fs from 'fs';

export class MistralOcrService {
  private apiKey: string;
  private apiBaseUrl: string = 'https://api.mistral.ai/v1/ocr';
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MISTRAL_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Aviso: MISTRAL_API_KEY não fornecida. Algumas funcionalidades podem não funcionar corretamente.');
    }
  }

  /**
   * Verifica se o serviço está configurado corretamente
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Realiza o processamento OCR em um arquivo
   * @param filePath Caminho para o arquivo de imagem ou PDF
   * @returns Texto extraído do documento
   */
  async processFile(filePath: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('API do Mistral não configurada. Defina MISTRAL_API_KEY nas variáveis de ambiente.');
    }

    try {
      // Ler o arquivo e converter para base64
      const fileBuffer = fs.readFileSync(filePath);
      const base64File = fileBuffer.toString('base64');
      
      // Determinar o tipo MIME com base na extensão do arquivo
      let mimeType = 'application/octet-stream';
      if (filePath.toLowerCase().endsWith('.pdf')) {
        mimeType = 'application/pdf';
      } else if (filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (filePath.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      }
      
      // Construir a URL de dados
      const dataUrl = `data:${mimeType};base64,${base64File}`;
      
      return await this.processDataUrl(dataUrl);
    } catch (error) {
      console.error(`Erro ao processar OCR do arquivo: ${error}`);
      throw new Error(`Falha ao processar OCR: ${error}`);
    }
  }

  /**
   * Processa uma URL de dados base64
   * @param dataUrl URL de dados Base64 (ex: data:application/pdf;base64,...)
   * @returns Texto extraído do documento
   */
  async processDataUrl(dataUrl: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('API do Mistral não configurada. Defina MISTRAL_API_KEY nas variáveis de ambiente.');
    }

    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-ocr-latest',
          document: {
            type: 'document_url',
            document_url: dataUrl
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API do Mistral respondeu com erro: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as MistralOcrResponse;
      
      // Combinar o conteúdo em Markdown de todas as páginas em um único texto
      const allText = result.pages.map(page => page.markdown).join('\n\n');
      
      return allText;
    } catch (error) {
      console.error(`Erro na API do Mistral: ${error}`);
      throw new Error(`Falha na API do Mistral: ${error}`);
    }
  }

  /**
   * Processa uma URL de imagem ou PDF
   * @param url URL da imagem ou PDF
   * @returns Texto extraído do documento
   */
  async processUrl(url: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('API do Mistral não configurada. Defina MISTRAL_API_KEY nas variáveis de ambiente.');
    }

    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-ocr-latest',
          document: {
            type: 'document_url',
            document_url: url
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API do Mistral respondeu com erro: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as MistralOcrResponse;
      
      // Combinar o conteúdo em Markdown de todas as páginas em um único texto
      const allText = result.pages.map(page => page.markdown).join('\n\n');
      
      return allText;
    } catch (error) {
      console.error(`Erro na API do Mistral: ${error}`);
      throw new Error(`Falha na API do Mistral: ${error}`);
    }
  }
}

// Definição de tipos para a resposta da API Mistral OCR
interface MistralOcrResponse {
  pages: {
    index: number;
    markdown: string;
    images: Array<{
      id: string;
      top_left_x: number;
      top_left_y: number;
      bottom_right_x: number;
      bottom_right_y: number;
      image_base64?: string;
    }>;
    dimensions: {
      dpi: number;
      height: number;
      width: number;
    };
  }[];
}

// Exportar uma instância padrão do serviço
export default new MistralOcrService();