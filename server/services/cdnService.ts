/**
 * Serviço CDN para gerenciamento de arquivos estáticos
 * Implementa estratégias de cache e otimização para entrega de assets
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { cacheService } from './cacheService';

// Configurações
const CDN_BASE_PATH = process.env.CDN_PATH || path.join(process.cwd(), 'public');
const CDN_CACHE_DURATION = 60 * 60 * 24 * 7; // 7 dias em segundos
const CDN_URL = process.env.CDN_URL || '/cdn';
const CACHE_CONTROL_HEADER = `public, max-age=${CDN_CACHE_DURATION}`;

// Tipos de conteúdo suportados
const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject'
};

/**
 * Inicializa o serviço CDN
 * @returns Resultado da inicialização
 */
export async function initializeCDN(): Promise<void> {
  try {
    // Criar diretórios necessários se não existirem
    const directories = [
      CDN_BASE_PATH,
      path.join(CDN_BASE_PATH, 'images'),
      path.join(CDN_BASE_PATH, 'documents'),
      path.join(CDN_BASE_PATH, 'uploads'),
      path.join(CDN_BASE_PATH, 'assets')
    ];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
    }

    console.log(`Serviço CDN inicializado em ${CDN_BASE_PATH}`);
  } catch (error) {
    console.error('Erro ao inicializar serviço CDN:', error);
    throw error;
  }
}

/**
 * Middleware para servir arquivos estáticos com otimização de cache
 * @param options Opções do middleware
 */
export function cdnMiddleware(options: {
  maxAge?: number;
  immutable?: boolean;
} = {}) {
  const { 
    maxAge = CDN_CACHE_DURATION,
    immutable = true 
  } = options;

  // Construir header Cache-Control
  const cacheControl = `public, max-age=${maxAge}${immutable ? ', immutable' : ''}`;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar se a rota começa com o prefixo CDN
      if (!req.path.startsWith(CDN_URL)) {
        return next();
      }

      // Extrair o caminho do arquivo relativo à base do CDN
      const relativePath = req.path.substring(CDN_URL.length);
      const fullPath = path.join(CDN_BASE_PATH, relativePath);

      // Verificar se o arquivo existe
      try {
        const stat = await fs.stat(fullPath);
        
        if (!stat.isFile()) {
          return next();
        }

        // Verificar ETag para cache no navegador
        const etag = await generateEtag(fullPath, stat.mtime.toISOString());
        
        // Verificar se o cliente já tem a versão atual
        if (req.headers['if-none-match'] === etag) {
          res.status(304).end();
          return;
        }

        // Definir cabeçalhos para cache e tipo de conteúdo
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = contentTypes[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', cacheControl);
        res.setHeader('ETag', etag);

        // Ler e enviar o arquivo
        const fileBuffer = await fs.readFile(fullPath);
        res.send(fileBuffer);
      } catch (error) {
        // Arquivo não encontrado ou erro de acesso
        next();
      }
    } catch (error) {
      console.error('Erro no middleware CDN:', error);
      next(error);
    }
  };
}

/**
 * Gera uma URL CDN para um arquivo
 * @param filePath Caminho do arquivo relativo à base do CDN
 * @param version Versão ou timestamp para cache busting (opcional)
 * @returns URL CDN completa
 */
export function cdnUrl(filePath: string, version?: string | number): string {
  // Garantir que o caminho do arquivo não comece com /
  const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  
  // Adicionar parâmetro de versão para cache busting se fornecido
  const versionParam = version ? `?v=${version}` : '';
  
  return `${CDN_URL}/${cleanPath}${versionParam}`;
}

/**
 * Salva um arquivo no CDN
 * @param buffer Buffer do arquivo
 * @param filePath Caminho relativo onde salvar o arquivo
 * @param options Opções adicionais
 * @returns URL do arquivo no CDN
 */
export async function saveFileToCDN(
  buffer: Buffer,
  filePath: string,
  options: {
    generateUniqueName?: boolean;
    metadata?: Record<string, any>;
  } = {}
): Promise<string> {
  try {
    const { generateUniqueName = true, metadata = {} } = options;
    
    // Gerar nome único baseado no hash do conteúdo se necessário
    let finalPath = filePath;
    if (generateUniqueName) {
      const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 10);
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      const dir = path.dirname(filePath);
      finalPath = path.join(dir, `${baseName}-${hash}${ext}`);
    }
    
    // Caminho completo no sistema de arquivos
    const fullPath = path.join(CDN_BASE_PATH, finalPath);
    
    // Criar diretório se não existir
    const directory = path.dirname(fullPath);
    if (!existsSync(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }
    
    // Salvar o arquivo
    await fs.writeFile(fullPath, buffer);
    
    // Salvar metadados se fornecidos
    if (Object.keys(metadata).length > 0) {
      const metadataPath = `${fullPath}.meta.json`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }
    
    console.log(`Arquivo salvo no CDN: ${fullPath}`);
    
    // Retornar URL do CDN
    return cdnUrl(finalPath);
  } catch (error) {
    console.error('Erro ao salvar arquivo no CDN:', error);
    throw error;
  }
}

/**
 * Remove um arquivo do CDN
 * @param cdnPath Caminho CDN do arquivo a ser removido
 * @returns Sucesso da operação
 */
export async function removeFileFromCDN(cdnPath: string): Promise<boolean> {
  try {
    // Extrair caminho relativo da URL CDN
    const urlPrefix = `${CDN_URL}/`;
    if (!cdnPath.startsWith(urlPrefix)) {
      throw new Error(`Caminho CDN inválido: ${cdnPath}`);
    }
    
    const relativePath = cdnPath.substring(urlPrefix.length).split('?')[0]; // Remover parâmetros de query
    const fullPath = path.join(CDN_BASE_PATH, relativePath);
    
    // Verificar se arquivo existe
    if (!existsSync(fullPath)) {
      console.warn(`Arquivo não encontrado no CDN: ${fullPath}`);
      return false;
    }
    
    // Remover arquivo
    await fs.unlink(fullPath);
    
    // Remover metadados se existirem
    const metadataPath = `${fullPath}.meta.json`;
    if (existsSync(metadataPath)) {
      await fs.unlink(metadataPath);
    }
    
    console.log(`Arquivo removido do CDN: ${fullPath}`);
    return true;
  } catch (error) {
    console.error('Erro ao remover arquivo do CDN:', error);
    throw error;
  }
}

/**
 * Gera um ETag para um arquivo baseado em seu conteúdo e data de modificação
 * @param filePath Caminho completo do arquivo
 * @param mtime Data de modificação ISO string
 * @returns ETag para controle de cache
 */
async function generateEtag(filePath: string, mtime: string): Promise<string> {
  // Verificar se já temos o ETag em cache
  const cacheKey = `etag:${filePath}:${mtime}`;
  const cachedEtag = await cacheService.get(cacheKey);
  
  if (cachedEtag) {
    return cachedEtag as string;
  }
  
  // Gerar novo ETag baseado no hash do conteúdo do arquivo
  const fileBuffer = await fs.readFile(filePath);
  const hash = crypto
    .createHash('md5')
    .update(fileBuffer)
    .update(mtime)
    .digest('hex');
  
  const etag = `"${hash}"`;
  
  // Cachear o ETag para uso futuro
  await cacheService.set(cacheKey, etag, { ttl: CDN_CACHE_DURATION });
  
  return etag;
}

/**
 * Obtém informações de um arquivo no CDN
 * @param cdnPath Caminho CDN do arquivo
 * @returns Informações do arquivo
 */
export async function getCDNFileInfo(cdnPath: string): Promise<{
  exists: boolean;
  size?: number;
  mtime?: Date;
  contentType?: string;
  metadata?: Record<string, any>;
}> {
  try {
    // Extrair caminho relativo da URL CDN
    const urlPrefix = `${CDN_URL}/`;
    if (!cdnPath.startsWith(urlPrefix)) {
      throw new Error(`Caminho CDN inválido: ${cdnPath}`);
    }
    
    const relativePath = cdnPath.substring(urlPrefix.length).split('?')[0]; // Remover parâmetros de query
    const fullPath = path.join(CDN_BASE_PATH, relativePath);
    
    // Verificar se arquivo existe
    if (!existsSync(fullPath)) {
      return { exists: false };
    }
    
    // Obter informações do arquivo
    const stat = await fs.stat(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Tentar ler metadados se existirem
    let metadata: Record<string, any> | undefined;
    const metadataPath = `${fullPath}.meta.json`;
    
    if (existsSync(metadataPath)) {
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        console.warn(`Erro ao ler metadados do arquivo CDN: ${metadataPath}`, error);
      }
    }
    
    return {
      exists: true,
      size: stat.size,
      mtime: stat.mtime,
      contentType,
      metadata
    };
  } catch (error) {
    console.error('Erro ao obter informações do arquivo CDN:', error);
    throw error;
  }
}

export default {
  initializeCDN,
  cdnMiddleware,
  cdnUrl,
  saveFileToCDN,
  removeFileFromCDN,
  getCDNFileInfo
};