# Guia de Instalação e Configuração - Matricula

Este guia fornece instruções detalhadas para instalar, configurar e executar o sistema Matricula em diferentes ambientes.

## Requisitos de Sistema

### Requisitos Mínimos

- **Node.js**: v16.0.0 ou superior
- **PostgreSQL**: v12.0 ou superior
- **Memória RAM**: 2GB (mínimo), 4GB+ (recomendado)
- **Espaço em Disco**: 1GB para o código + espaço para uploads de documentos

### Dependências Externas

- Conta Stripe para processamento de pagamentos
- Conta Pusher para notificações em tempo real
- Instância da Evolution API para integração com WhatsApp
- Conta Resend para envio de emails

## Instalação Local (Desenvolvimento)

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/matricula.git
cd matricula
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```
# Configuração de Banco de Dados
DATABASE_URL=postgresql://usuario:senha@localhost:5432/matricula_db

# Configurações JWT
JWT_SECRET=seu_jwt_secret
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d

# Configurações de Stripe
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLIC_KEY=pk_test_...

# Configurações de Pusher
PUSHER_APP_ID=seu_app_id
PUSHER_APP_KEY=seu_app_key
PUSHER_APP_SECRET=seu_app_secret
PUSHER_APP_CLUSTER=seu_app_cluster

# Configurações da Evolution API
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key

# Configurações Resend (Email)
RESEND_API_KEY=sua_resend_api_key

# Configurações de Segurança
ENCRYPTION_KEY=sua_chave_de_criptografia
```

### 4. Configuração do Banco de Dados

Certifique-se de que o PostgreSQL está em execução e crie o banco de dados:

```bash
psql -U postgres -c "CREATE DATABASE matricula_db"
```

Execute as migrações para criar as tabelas:

```bash
npm run db:push
```

### 5. Iniciar o Servidor em Modo Desenvolvimento

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:5000` e o frontend em desenvolvimento estará disponível em `http://localhost:3000`.

## Implantação em Produção

### Opção 1: Vercel (Recomendado)

O projeto está otimizado para deploy na Vercel:

1. Conecte o repositório à sua conta Vercel
2. Configure as variáveis de ambiente no painel da Vercel
3. Selecione Node.js como framework preset
4. Para o banco de dados, configure o Neon PostgreSQL como serviço integrado
5. A Vercel fará build e deploy automático do projeto

Importante: Para o banco de dados, recomenda-se usar o Neon PostgreSQL, que tem excelente integração com a Vercel e oferece um plano gratuito generoso.

### Opção 2: Replit

1. Crie um novo Repl e importe o código do repositório
2. Configure as variáveis de ambiente nas configurações do Repl
3. Execute o comando para instalação de dependências:
   ```bash
   npm install
   ```
4. Iniciar o servidor em produção:
   ```bash
   npm start
   ```

### Opção 3: Servidor Próprio

1. Clone o repositório em seu servidor
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Construa a versão de produção:
   ```bash
   npm run build
   ```
4. Configure um proxy reverso (Nginx ou Apache) para servir a aplicação
5. Use o PM2 para manter o servidor rodando:
   ```bash
   npm install -g pm2
   pm2 start npm -- start
   ```

## Configuração de Serviços Externos

### 1. Configuração do Stripe

1. Crie uma conta em [stripe.com](https://stripe.com)
2. Obtenha as chaves de API no painel do Stripe
3. Configure os webhook endpoints no painel do Stripe para apontar para `/api/webhooks/stripe`
4. Configure os produtos e preços no painel do Stripe

### 2. Configuração do Pusher

1. Crie uma conta em [pusher.com](https://pusher.com)
2. Crie um novo aplicativo Channels
3. Obtenha as credenciais do aplicativo
4. Configure os canais privados com autenticação corretamente

### 3. Configuração da Evolution API

1. Configure uma instância da Evolution API seguindo a documentação oficial
2. Obtenha a URL e a chave de API
3. Configure os webhooks para apontar para `/api/webhooks/evolution`

### 4. Configuração do Resend (Email)

1. Crie uma conta em [resend.com](https://resend.com)
2. Obtenha a chave de API
3. Verifique seu domínio para envio de emails

## Configurações Avançadas

### Configuração de Alta Disponibilidade

Para ambientes de produção com alta demanda, considere:

1. **Clusterização**: Use o modo cluster do Node.js:
   ```bash
   pm2 start npm --name "matricula" -i max -- start
   ```

2. **Balanceamento de Carga**: Configure um balanceador de carga como Nginx ou HAProxy

3. **Cache**: Configure um servidor Redis para cache:
   ```
   REDIS_URL=redis://usuario:senha@seu-servidor-redis:6379
   ```

### Ajuste de Performance

1. **Otimização de Consultas**: Ajuste os índices do banco de dados:
   ```sql
   CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
   CREATE INDEX idx_documents_enrollment_id ON documents(enrollment_id);
   ```

2. **Limitação de Taxa**: Configure a limitação de taxa para proteger a API:
   ```
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=100
   ```

3. **Workers para OCR**: Ajuste o número de workers para processamento de OCR:
   ```
   OCR_WORKERS=4
   ```

## Manutenção do Sistema

### Backup do Banco de Dados

Configure backups automáticos do PostgreSQL:

```bash
# Backup diário
0 0 * * * pg_dump -U usuario matricula_db | gzip > /backups/matricula_$(date +\%Y\%m\%d).sql.gz

# Remoção de backups antigos (manter 30 dias)
0 1 * * * find /backups/ -name "matricula_*.sql.gz" -mtime +30 -delete
```

### Logs e Monitoramento

1. Configure o Winston para logs estruturados:
   ```
   LOG_LEVEL=info
   LOG_FILE=/var/log/matricula/app.log
   ```

2. Configure o monitoramento de saúde da aplicação:
   ```
   HEALTH_CHECK_PATH=/health
   HEALTH_CHECK_INTERVAL=60000
   ```

## Solução de Problemas Comuns

### Erro de Conexão com o Banco de Dados

**Sintoma**: Erro "ECONNREFUSED" ao tentar conectar ao PostgreSQL

**Solução**:
1. Verifique se o PostgreSQL está em execução
2. Confirme que a string de conexão está correta
3. Verifique as permissões do usuário do banco de dados

### Problemas com o OCR

**Sintoma**: Falhas no processamento de documentos

**Solução**:
1. Verifique se a chave da API do Optiic está corretamente configurada no ambiente:
   ```
   OPTIIC_API_KEY=sua_chave_api
   ```
2. Verifique os limites de uso da sua conta Optiic (quotas da API)

### Problemas com Envio de Email

**Sintoma**: Emails não são enviados

**Solução**:
1. Verifique a chave da API Resend
2. Confirme que o domínio está verificado
3. Verifique as cotas de envio

### Quedas Frequentes do Servidor

**Sintoma**: O servidor reinicia frequentemente

**Solução**:
1. Aumente a memória disponível
2. Verifique vazamentos de memória
3. Configure o PM2 para reiniciar automaticamente

## Migração de Dados

### Migração de uma Versão Anterior

Se você está migrando de uma versão anterior do Matricula:

1. Faça backup do banco de dados atual
2. Execute o script de migração:
   ```bash
   npm run migrate:legacy
   ```
3. Verifique os logs para confirmar a migração bem-sucedida

### Importação de Dados Externos

Para importar dados de outro sistema:

1. Converta os dados para o formato CSV ou JSON compatível
2. Use o script de importação:
   ```bash
   npm run import -- --file=seus_dados.csv --type=students
   ```

## Configurações de Segurança

### HTTPS

Configure o HTTPS para ambientes de produção:

1. Obtenha certificados SSL (Let's Encrypt)
2. Configure o servidor web (Nginx/Apache) para usar HTTPS
3. Configure o redirecionamento de HTTP para HTTPS

### Proteção contra Ataques Comuns

1. Configure o Helmet.js para proteção do cabeçalho HTTP:
   ```
   ENABLE_HELMET=true
   ```

2. Configure limites para upload de arquivos:
   ```
   MAX_FILE_SIZE=10485760  # 10MB
   MAX_FILES_PER_REQUEST=5
   ```

3. Configure a proteção CSRF:
   ```
   CSRF_PROTECTION=true
   CSRF_TOKEN_EXPIRY=3600  # 1 hora
   ```

## Contatos e Suporte

- **Suporte Técnico**: support@matricula.pro
- **Bugs e Problemas**: bugs@matricula.pro
- **Documentação Completa**: docs.matricula.pro

---

Documentação gerada em: Abril de 2025  
Versão: 1.0.0