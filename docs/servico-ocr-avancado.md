# Documentação do Serviço de OCR Avançado - Matricula

## Visão Geral

O Serviço de OCR Avançado é um componente central do sistema Matricula, responsável por processar, validar e extrair informações de documentos submetidos durante o processo de matrícula. Utilizando tecnologias de reconhecimento óptico de caracteres (OCR) combinadas com técnicas de machine learning, o serviço automatiza a verificação de documentos como RG, CPF, comprovantes de residência e históricos escolares.

## Arquitetura do Serviço

O serviço de OCR Avançado é composto por várias camadas que trabalham em conjunto:

```
+-------------------+
|                   |
|  API de Entrada   |
|                   |
+--------+----------+
         |
         v
+--------+----------+
|                   |
| Fila de Processos |
|                   |
+--------+----------+
         |
         v
+--------+----------+     +-------------------+
|                   |     |                   |
| Workers de OCR    +---->+ Tesseract Engine  |
|                   |     |                   |
+--------+----------+     +-------------------+
         |
         v
+--------+----------+     +-------------------+
|                   |     |                   |
| Validação de ML   +---->+ TensorFlow.js     |
|                   |     |                   |
+--------+----------+     +-------------------+
         |
         v
+--------+----------+
|                   |
| Armazenamento     |
| de Resultados     |
|                   |
+-------------------+
```

## Componentes Principais

### 1. API de Entrada

Endpoints REST que recebem documentos para processamento:

```
POST /api/documents/upload - Upload de documento via web
POST /api/documents/analyze - Análise de documento já armazenado
POST /api/documents/verify - Verificação de dados extraídos
```

### 2. Fila de Processos

Sistema de fila para gerenciar o processamento assíncrono de documentos:

- Priorização baseada em tipo de documento e urgência
- Balanceamento de carga entre workers
- Gerenciamento de falhas e retentativas

### 3. Workers de OCR

Processos dedicados que executam o reconhecimento óptico de caracteres:

```typescript
// Exemplo simplificado de worker OCR
class OcrWorker {
  constructor(private workerId: number) {}
  
  async start() {
    console.log(`Worker OCR #${this.workerId} iniciado`);
    while (true) {
      const job = await this.getNextJob();
      if (job) {
        try {
          const result = await this.processDocument(job);
          await this.saveResult(job.id, result);
        } catch (error) {
          await this.handleError(job.id, error);
        }
      } else {
        await this.sleep(1000); // Espera se não houver jobs
      }
    }
  }
  
  private async processDocument(job) {
    // Processamento OCR com Tesseract
  }
}
```

### 4. Motor de OCR (Tesseract)

Utiliza a biblioteca Tesseract.js para reconhecimento de texto em imagens:

- Suporte a múltiplos idiomas (português e inglês por padrão)
- Otimizações para documentos brasileiros
- Pré-processamento de imagem para melhorar resultados

### 5. Validação de Machine Learning

Utiliza modelos de ML para validar dados extraídos:

- Verificação de padrões em documentos
- Detecção de adulterações
- Extração inteligente de campos específicos

```typescript
// Exemplo de validação de RG com ML
async function validateRgDocument(extractedData, image) {
  // Carregar modelo TensorFlow.js para validação de RG
  const model = await tf.loadLayersModel('file://./models/rg-validator/model.json');
  
  // Preparar dados para o modelo
  const features = prepareFeatures(extractedData, image);
  
  // Executar inferência
  const predictions = model.predict(features);
  
  return {
    isValid: predictions[0] > 0.85,
    confidence: predictions[0],
    details: extractValidationDetails(predictions)
  };
}
```

### 6. Armazenamento de Resultados

Persistência dos resultados em banco de dados para consulta futura:

- Armazenamento dos dados extraídos
- Armazenamento de metadados de validação
- Histórico de processamento

## Tipos de Documentos Suportados

O serviço de OCR Avançado suporta os seguintes tipos de documentos:

1. **Documentos de Identificação**
   - RG / Carteira de Identidade
   - CNH (Carteira Nacional de Habilitação)
   - Passaporte
   - Certidão de Nascimento

2. **Documentos de Comprovação**
   - Comprovante de Residência (contas de água, luz, gás, telefone)
   - Comprovante de Matrícula de instituição anterior
   - Histórico Escolar
   - Declaração de Transferência

3. **Documentos Financeiros**
   - Comprovante de Pagamento
   - Declaração de Imposto de Renda (para bolsas)
   - Contracheque (para análise de bolsas)

## Fluxo de Processamento de Documentos

### 1. Recebimento e Preparação

```typescript
async function prepareDocument(file: UploadedFile): Promise<ProcessingJob> {
  // Verificar tipo de arquivo e converter se necessário
  const fileType = await getFileType(file.buffer);
  
  let imageBuffer: Buffer;
  
  if (fileType === 'application/pdf') {
    // Converter PDF para imagem
    imageBuffer = await convertPdfToImage(file.buffer);
  } else if (['image/jpeg', 'image/png'].includes(fileType)) {
    imageBuffer = file.buffer;
  } else {
    throw new Error('Formato de arquivo não suportado');
  }
  
  // Pré-processamento da imagem
  const enhancedImage = await enhanceImage(imageBuffer);
  
  // Criar job para processamento
  return {
    id: uuidv4(),
    documentType: file.documentType,
    image: enhancedImage,
    createdAt: new Date(),
    priority: getPriorityForDocumentType(file.documentType),
    status: 'pending'
  };
}
```

### 2. Reconhecimento de Texto (OCR)

```typescript
async function performOcr(image: Buffer, options: OcrOptions): Promise<OcrResult> {
  // Inicializar Tesseract com as configurações apropriadas
  const worker = await createWorker({
    langPath: path.join(__dirname, '../lang-data'),
    logger: progress => console.log('OCR Progress:', progress),
    languages: ['por', 'eng'],
    ...options
  });
  
  // Executar OCR
  const { data } = await worker.recognize(image);
  
  // Extrair texto, coordenadas e confiança
  const result = {
    text: data.text,
    words: data.words.map(word => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox
    })),
    paragraphs: extractParagraphs(data),
    confidence: data.confidence
  };
  
  await worker.terminate();
  
  return result;
}
```

### 3. Extração de Dados Estruturados

```typescript
async function extractDataFromDocument(ocrResult: OcrResult, documentType: DocumentType): Promise<ExtractedData> {
  // Selecionar extrator apropriado para o tipo de documento
  const extractor = getExtractorForDocumentType(documentType);
  
  // Extrair dados usando expressões regulares e heurísticas
  const extractedData = await extractor.extract(ocrResult);
  
  // Normalizar dados extraídos
  return normalizeData(extractedData, documentType);
}

// Exemplo de extrator para RG
class RgExtractor implements DocumentExtractor {
  extract(ocrResult: OcrResult): ExtractedData {
    return {
      nome: this.extractName(ocrResult),
      numero: this.extractRgNumber(ocrResult),
      orgaoEmissor: this.extractIssuingAuthority(ocrResult),
      dataEmissao: this.extractIssueDate(ocrResult),
      dataNascimento: this.extractBirthDate(ocrResult),
      filiacaoPai: this.extractFatherName(ocrResult),
      filiacaoMae: this.extractMotherName(ocrResult),
      naturalidade: this.extractBirthplace(ocrResult)
    };
  }
  
  private extractRgNumber(ocrResult: OcrResult): string {
    // Usar regex para encontrar padrão de RG no texto
    const rgRegex = /RG:?\s*(\d{1,2}\.?\d{3}\.?\d{3}-?[0-9X])/i;
    const match = ocrResult.text.match(rgRegex);
    return match ? match[1] : '';
  }
  
  // Outros métodos de extração...
}
```

### 4. Validação de Dados

```typescript
async function validateExtractedData(
  extractedData: ExtractedData,
  image: Buffer,
  documentType: DocumentType,
  enrollmentData?: EnrollmentData
): Promise<ValidationResult> {
  // Validar consistência interna dos dados
  const internalValidation = validateDataConsistency(extractedData, documentType);
  
  // Validar com machine learning
  const mlValidation = await validateWithMachineLearning(extractedData, image, documentType);
  
  // Se há dados de matrícula, comparar dados extraídos com os informados
  let comparisonValidation = { valid: true, matches: [] };
  if (enrollmentData) {
    comparisonValidation = compareWithEnrollmentData(extractedData, enrollmentData, documentType);
  }
  
  // Combinar resultados
  return {
    valid: internalValidation.valid && mlValidation.valid && comparisonValidation.valid,
    confidence: calculateOverallConfidence([internalValidation, mlValidation, comparisonValidation]),
    details: {
      internalValidation,
      mlValidation,
      comparisonValidation
    }
  };
}
```

### 5. Decisão e Armazenamento

```typescript
async function finalizeDocumentProcessing(
  jobId: string,
  extractedData: ExtractedData,
  validationResult: ValidationResult
): Promise<ProcessingResult> {
  // Determinar status final baseado na validação
  let status: DocumentStatus;
  
  if (validationResult.valid && validationResult.confidence > 0.9) {
    status = 'approved';
  } else if (validationResult.confidence < 0.6) {
    status = 'rejected';
  } else {
    status = 'needs_review';
  }
  
  // Armazenar resultados no banco de dados
  const result = await db.documentResults.create({
    data: {
      jobId,
      extractedData,
      validationResult,
      status,
      processedAt: new Date()
    }
  });
  
  // Enviar notificações baseadas no resultado
  await sendProcessingNotifications(jobId, status);
  
  return {
    id: result.id,
    status,
    extractedData,
    confidence: validationResult.confidence
  };
}
```

## Modelos e Algoritmos de Machine Learning

### Modelos Principais

1. **Detector de Documentos**: Localiza e recorta documentos em imagens
2. **Classificador de Documentos**: Identifica o tipo de documento
3. **Validador de Documentos**: Verifica a autenticidade do documento
4. **Extratores Específicos**: Modelos especializados para cada tipo de documento

### Treinamento e Atualização

Os modelos são treinados usando:

- Conjunto de dados de documentos brasileiros
- Técnicas de augmentação de dados para melhorar a robustez
- Fine-tuning para documentos específicos de instituições educacionais

O sistema inclui rotinas para:

1. Avaliação contínua da performance dos modelos
2. Retraining periódico com novos dados
3. Feedback loop de correções manuais para melhorar os modelos

## Configuração e Otimização

### Configurações de Performance

O serviço pode ser configurado para diferentes níveis de recursos:

```
# Configurações de OCR
OCR_WORKERS=4                       # Número de workers paralelos
OCR_QUEUE_LIMIT=100                 # Limite da fila de processamento
OCR_RETRY_ATTEMPTS=3                # Tentativas em caso de falha
OCR_CONFIDENCE_THRESHOLD=0.75       # Limite mínimo de confiança

# Configurações de ML
ML_MODEL_PATH=./models              # Caminho para modelos de ML
ML_DEVICE=GPU                       # Dispositivo para execução (GPU/CPU)
ML_BATCH_SIZE=16                    # Tamanho do lote para inferência

# Configurações de Armazenamento
DOCUMENT_STORAGE_PATH=./uploads     # Caminho para armazenamento temporário
DOCUMENT_RETENTION_DAYS=30          # Período de retenção de documentos
```

### Otimização de Recursos

Estratégias para otimizar o uso de recursos:

1. **CPU e Memória**:
   - Processamento em lotes para melhor utilização da CPU
   - Cache de resultados OCR para documentos similares
   - Limpeza periódica de arquivos temporários

2. **Disco**:
   - Compressão de imagens antes do armazenamento
   - Política de retenção para remoção automática de documentos antigos

3. **Rede**:
   - Compressão de imagens durante o upload
   - Transferência eficiente entre serviços

## Segurança e Privacidade

### Proteção de Dados

1. **Criptografia**:
   - Criptografia em trânsito (TLS/SSL)
   - Criptografia em repouso para documentos armazenados
   - Chaves de criptografia rotacionadas periodicamente

2. **Controle de Acesso**:
   - Permissões baseadas em função para acesso a documentos
   - Logs detalhados de acesso a documentos sensíveis
   - Autenticação de dois fatores para operações críticas

3. **Anonimização**:
   - Remoção de dados sensíveis não necessários
   - Separação de dados pessoais e dados de processamento

### Conformidade LGPD

O serviço foi projetado com a LGPD (Lei Geral de Proteção de Dados) em mente:

- Documentação de base legal para processamento
- Procedimentos para tratamento de solicitações de titulares
- Tempo de retenção definido para cada tipo de documento
- Registros de atividades de processamento

## Fallbacks e Resiliência

### Estratégias de Fallback

O sistema implementa múltiplos níveis de fallback:

1. **Fallback de OCR**:
   - Se o Tesseract falhar, tenta serviço de OCR alternativo
   - Se automação falhar, encaminha para revisão manual

2. **Fallback de ML**:
   - Modelos locais simplificados quando recursos são limitados
   - Regras baseadas em heurística quando ML não está disponível

3. **Degradação Graciosa**:
   - Funcionamento em modo de capacidade reduzida
   - Priorização de documentos críticos em situações de sobrecarga

### Monitoramento e Recuperação

O sistema inclui:

- Monitoramento em tempo real da performance
- Alertas automáticos para falhas e degradação
- Recuperação automática de workers com falha
- Procedimentos de disaster recovery para perda de dados

## Integração com o Sistema

### Interfaces para Outros Serviços

O Serviço de OCR Avançado se integra com:

1. **Sistema de Matrículas**:
   - Solicitação de validação de documentos
   - Atualização de status de matrículas baseada em resultados OCR

2. **Integração WhatsApp**:
   - Recebimento de documentos via WhatsApp
   - Envio de resultados e solicitações de documentos adicionais

3. **Dashboard Administrativo**:
   - Visualização de métricas de processamento
   - Interface para revisão manual de documentos com baixa confiança

## Exemplos de Uso

### 1. Validação de RG para Matrícula

```typescript
// Front-end: Envio do documento
async function uploadRgDocument(file, enrollmentId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', 'rg');
  formData.append('enrollmentId', enrollmentId);
  
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
}

// Back-end: Processamento
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    // Iniciar processamento assíncrono
    const jobId = await documentService.queueDocumentForProcessing(
      req.file,
      req.body.documentType,
      req.body.enrollmentId
    );
    
    res.status(202).json({
      status: 'processing',
      jobId,
      estimatedCompletionTime: '30 seconds'
    });
    
    // O processamento continua em background...
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Verificação de Histórico Escolar

```typescript
// Uso do serviço para extrair notas e disciplinas
async function processTranscript(transcriptImage) {
  // Extrair texto via OCR
  const ocrResult = await ocrService.performOcr(transcriptImage, {
    languages: ['por'],
    segmentationMode: 'table_detection'
  });
  
  // Extrair estrutura de tabela com notas
  const tables = await tableExtractor.extractTables(ocrResult);
  
  // Mapear disciplinas e notas
  const grades = await gradeExtractor.extractGrades(tables);
  
  // Validar consistência
  const validationResult = await transcriptValidator.validate(grades);
  
  return {
    grades,
    validation: validationResult
  };
}
```

## Solução de Problemas Comuns

### Problemas de Qualidade de Imagem

**Sintoma**: Baixa confiança no OCR para documentos específicos

**Solução**:
1. Verificar a resolução da imagem (mínimo 300dpi recomendado)
2. Usar pré-processamento para melhorar contraste e nitidez
3. Solicitar novo upload com orientações para melhor captura

### Falsos Positivos/Negativos na Validação

**Sintoma**: Documentos genuínos rejeitados ou falsos aceitos

**Solução**:
1. Ajustar limiares de confiança para o tipo de documento específico
2. Adicionar o documento ao conjunto de treinamento com classificação correta
3. Implementar validações adicionais específicas para o caso

### Performance Degradada

**Sintoma**: Tempos de processamento excessivos

**Solução**:
1. Verificar uso de recursos (CPU/memória/disco)
2. Aumentar número de workers de OCR
3. Otimizar tamanho e resolução das imagens antes do processamento
4. Considerar adicionar recursos computacionais

## Recursos Adicionais

### Documentação API

Detalhes completos da API REST do serviço:

```
GET    /api/documents/:enrollmentId        - Lista documentos para uma matrícula
POST   /api/documents/upload               - Envia novo documento
POST   /api/documents/analyze              - Analisa documento existente
GET    /api/documents/job/:jobId           - Verifica status de processamento
POST   /api/documents/verify/:documentId   - Verifica manualmente um documento
DELETE /api/documents/:id                  - Remove um documento
```

### Ferramentas de Diagnóstico

O serviço inclui ferramentas para diagnóstico e depuração:

- Interface web para visualizar resultados de OCR
- Inspetor de confiança por campo extraído
- Visualizador de regiões detectadas em documentos
- Logs detalhados de cada etapa do processamento

### Métricas e Analytics

Métricas coletadas para monitoramento e otimização:

- Taxa de sucesso por tipo de documento
- Tempo médio de processamento
- Distribuição de confiança por campo
- Taxa de documentos que requerem revisão manual

---

Documentação gerada em: Abril de 2025  
Versão do Serviço: 1.0.0