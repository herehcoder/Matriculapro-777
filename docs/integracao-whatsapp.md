# Documentação de Integração com WhatsApp - Matricula

## Visão Geral

A integração com WhatsApp é um componente fundamental do sistema Matricula, permitindo comunicação automatizada com alunos e responsáveis durante todo o processo de matrícula. Esta integração é realizada através da Evolution API, uma solução terceira que funciona como intermediária entre o sistema Matricula e a API oficial do WhatsApp.

## Arquitetura da Integração

```
+----------------+      +----------------+      +------------------+
|                |      |                |      |                  |
|    Matricula   +----->+  Evolution API +----->+  WhatsApp Cloud  |
|    Backend     |      |                |      |  API             |
|                |      |                |      |                  |
+-------+--------+      +----------------+      +------------------+
        ^
        |
        v
+-------+--------+
|                |
|    Matricula   |
|    Frontend    |
|                |
+----------------+
```

## Componentes Principais

### 1. Serviço EvolutionApiService

O sistema Matricula implementa um serviço dedicado para gerenciar a comunicação com a Evolution API:

```typescript
// Classe simplificada do serviço de WhatsApp
class EvolutionApiService {
  constructor(private apiUrl: string, private apiKey: string) {}

  async initialize() { /* ... */ }
  
  // Gerenciamento de instâncias
  async createInstance(instanceName: string, schoolId: number) { /* ... */ }
  async getInstanceStatus(instanceId: string) { /* ... */ }
  async connectInstance(instanceId: string) { /* ... */ }
  async disconnectInstance(instanceId: string) { /* ... */ }
  
  // Envio de mensagens
  async sendTextMessage(instanceId: string, to: string, message: string) { /* ... */ }
  async sendMediaMessage(instanceId: string, to: string, media: MediaData) { /* ... */ }
  async sendTemplateMessage(instanceId: string, to: string, template: TemplateData) { /* ... */ }
  
  // Webhook handlers
  async handleConnectionUpdate(webhook: ConnectionUpdateWebhook) { /* ... */ }
  async handleIncomingMessage(webhook: MessageWebhook) { /* ... */ }
  async handleMessageStatus(webhook: StatusWebhook) { /* ... */ }
}
```

### 2. Rotas de API para Evolution API

O backend do Matricula expõe endpoints para interagir com a Evolution API:

```
POST /api/evolutionapi/initialize - Inicializa a conexão com a Evolution API
POST /api/evolutionapi/instances - Cria uma nova instância do WhatsApp
GET /api/evolutionapi/instances - Lista todas as instâncias disponíveis
GET /api/evolutionapi/instances/:id/status - Verifica o status de uma instância
POST /api/evolutionapi/instances/:id/connect - Conecta uma instância
POST /api/evolutionapi/instances/:id/disconnect - Desconecta uma instância
POST /api/evolutionapi/instances/:id/messages - Envia mensagem via instância
GET /api/evolutionapi/instances/:id/messages - Lista mensagens de uma instância
GET /api/evolutionapi/instances/:id/contacts - Lista contatos de uma instância
```

### 3. Webhook Endpoints

A Evolution API envia webhooks para o Matricula quando ocorrem eventos no WhatsApp:

```
POST /api/evolutionapi/webhook - Endpoint principal que recebe todos os webhooks
```

O sistema processa três tipos principais de webhooks:
- Atualizações de conexão (QR code, status da conexão)
- Mensagens recebidas
- Atualizações de status de mensagem (enviada, entregue, lida)

## Fluxos de Comunicação

### 1. Configuração de Instância do WhatsApp

1. Administrador ou escola solicita a criação de uma instância de WhatsApp
2. O sistema cria a instância via Evolution API
3. O QR code para login é gerado e exibido para o administrador/escola
4. Administrador/escola escaneia o QR code com o aplicativo WhatsApp
5. A instância é conectada e pronta para uso

### 2. Envio de Mensagens Automáticas

O sistema envia mensagens automaticamente em diversos pontos do processo:

- Confirmação de início de matrícula
- Solicitação de documentos pendentes
- Aprovação ou rejeição de documentos
- Informações sobre pagamento
- Confirmação de matrícula finalizada

Exemplo de fluxo de mensagem automática:

```typescript
// Envio de confirmação de matrícula
async function sendEnrollmentConfirmation(enrollment: Enrollment) {
  const student = await getStudent(enrollment.studentId);
  const school = await getSchool(enrollment.schoolId);
  const instance = await getInstance(school.whatsappInstanceId);
  
  if (!instance || instance.status !== "connected") {
    // Fallback para email/notificação interna
    return await sendFallbackNotification(student, "enrollment_confirmation");
  }
  
  const message = `Olá ${student.name}, sua matrícula na ${school.name} foi confirmada com sucesso! Seu número de matrícula é: ${enrollment.id}.`;
  
  return await evolutionApiService.sendTextMessage(
    instance.id,
    student.phone,
    message
  );
}
```

### 3. Recebimento de Documentos via WhatsApp

Alunos podem enviar documentos diretamente pelo WhatsApp:

1. Aluno envia foto do documento (RG, CPF, etc) pelo WhatsApp
2. O webhook recebe a mensagem com a mídia
3. O sistema baixa a mídia e a armazena temporariamente
4. O serviço de OCR processa o documento
5. O documento é associado à matrícula do aluno
6. Uma mensagem de confirmação é enviada ao aluno

### 4. Atendimento Híbrido

O sistema permite que atendentes intervenham em conversas automatizadas:

1. Bot gerencia a conversa inicial com o aluno
2. Se necessário, um atendente pode assumir a conversa
3. O histórico completo da conversa é disponibilizado ao atendente
4. O atendente pode retornar a conversa para o bot após resolver a questão

## Modo de Fallback

O sistema implementa um modo de fallback para quando a integração com o WhatsApp não está disponível:

1. Se a Evolution API estiver inacessível, o sistema entra em modo de fallback
2. Comunicações críticas são enviadas por email ou notificações internas
3. O sistema monitora continuamente a disponibilidade da integração com o WhatsApp
4. Quando a integração volta a funcionar, o sistema retoma o uso do WhatsApp

## Configuração e Pré-requisitos

### Requisitos para Usar a Integração

- Número de telefone válido com WhatsApp Business ativo
- API Key válida da Evolution API
- URL da Evolution API configurada

### Variáveis de Ambiente

```
EVOLUTION_API_URL=https://api.evolution.com
EVOLUTION_API_KEY=seu_api_key
WHATSAPP_ADMIN_NUMBER=5511999999999
```

### Modelo de Dados

O sistema armazena informações sobre instâncias de WhatsApp:

```typescript
// Modelo de instância de WhatsApp
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: serial("id").primaryKey(),
  instanceName: text("instance_name").notNull(),
  instanceId: text("instance_id").notNull().unique(),
  schoolId: integer("school_id").references(() => schools.id),
  status: text("status").default("disconnected"),
  qrCode: text("qr_code"),
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
```

### Menu de Administração

O sistema oferece uma interface de administração para gerenciar instâncias de WhatsApp:

- Visualização de todas as instâncias
- Criação de novas instâncias
- Monitoramento de status das instâncias
- Logs de mensagens enviadas e recebidas
- Estatísticas de uso

## Boas Práticas e Limitações

### Boas Práticas

1. **Respeite os Limites de API**: Evite enviar muitas mensagens em curto período
2. **Use Mensagens Personalizadas**: Personalize comunicações com dados do aluno
3. **Trate Desconexões**: Monitore e reconecte instâncias desconectadas
4. **Implemente Fallbacks**: Sempre tenha um método alternativo de comunicação
5. **Mantenha Logs Detalhados**: Logs ajudam a diagnosticar problemas de comunicação

### Limitações Conhecidas

1. **Dependência de Serviço Terceiro**: A Evolution API pode ter indisponibilidades
2. **Políticas do WhatsApp**: Mudanças nas políticas podem afetar a integração
3. **QR Code Expira**: Códigos QR para conexão têm tempo limitado
4. **Limitações de Mídia**: Tamanho máximo de arquivos que podem ser enviados
5. **Taxas de Limitação**: O WhatsApp impõe limites de taxa para envio de mensagens

## Resolução de Problemas

### Problemas Comuns

1. **QR Code Expirado**
   - Solução: Gere um novo QR code através da API

2. **Instância Desconectada**
   - Solução: Verifique a conexão com internet do dispositivo e reconecte a instância

3. **Mensagens Não Entregues**
   - Solução: Verifique o status da instância e se o número de destino é válido

4. **Webhook Não Recebido**
   - Solução: Verifique se a URL do webhook está corretamente configurada na Evolution API

### Logs e Monitoramento

O sistema mantém logs detalhados de todas as interações com a Evolution API:

```typescript
// Exemplo de log de mensagem
{
  direction: "outbound",
  status: "sent",
  instanceId: "instance123",
  to: "5511999999999",
  messageType: "text",
  content: "Olá, sua matrícula foi confirmada!",
  timestamp: "2025-04-23T15:30:00Z",
  messageId: "wamid.12345",
  error: null
}
```

## Testes e Validação

### Ambiente de Testes

O sistema oferece um ambiente de teste que simula a Evolution API para desenvolvimento sem necessidade de conexão real ao WhatsApp:

```
# Ativar modo de teste
EVOLUTION_API_MODE=mock
```

### Testes Automatizados

Exemplos de testes automatizados para a integração:

```typescript
// Teste de envio de mensagem
test('should send WhatsApp message successfully', async () => {
  const result = await evolutionApiService.sendTextMessage('instance123', '5511999999999', 'Test message');
  expect(result.status).toBe('sent');
});

// Teste de tratamento de webhook
test('should process incoming message webhook', async () => {
  const webhook = { /* mock webhook data */ };
  await webhookHandler.processWebhook(webhook);
  // Verify message was stored and processed
});
```

## Contatos e Recursos Adicionais

- **Documentação da Evolution API**: [https://docs.evolution-api.com](https://docs.evolution-api.com)
- **Guia do WhatsApp Business API**: [https://developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp)
- **Suporte Técnico**: whatsapp-support@matricula.pro

---

Documentação gerada em: Abril de 2025  
Versão da Integração: 1.0.0