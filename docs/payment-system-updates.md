# Documentação de Atualizações no Sistema de Pagamento

## Visão Geral

Este documento descreve as recentes atualizações feitas no sistema de pagamento do EduMatrik AI, particularmente na gestão de gateways de pagamento. As alterações foram implementadas para resolver problemas de atualização de registros no banco de dados PostgreSQL, especialmente relacionados com a definição de gateway padrão e a alternância do modo sandbox.

## Problemas Resolvidos

### 1. Problema com parâmetros posicionais no SQL

**Sintoma:** As consultas SQL com parâmetros posicionais (`$1`, `$2`, etc.) estavam falhando de forma inconsistente, especialmente ao:
- Definir um gateway como padrão
- Alternar o modo sandbox
- Atualizar configurações específicas

**Causa raiz:** O driver PostgreSQL estava tendo problemas ao interpretar os parâmetros posicionais em queries complexas, especialmente quando múltiplos parâmetros estavam envolvidos ou quando a mesma query atualizava múltiplos campos.

### 2. Tratamento inadequado de erros

**Sintoma:** Quando ocorriam erros nas operações de banco de dados, eles não eram devidamente registrados ou informados ao usuário, resultando em:
- Falhas silenciosas nas atualizações
- Dificuldade em diagnosticar problemas
- Estado inconsistente no banco de dados

**Causa raiz:** Falta de tratamento adequado de exceções nos métodos do modelo `PaymentGatewaySettings`.

## Soluções Implementadas

### 1. Substituição direta de parâmetros em consultas SQL

Em vez de usar o mecanismo de parâmetros posicionais do PostgreSQL, implementamos:

1. Uma abordagem que constrói a query SQL dinamicamente, mas de forma segura:
   ```typescript
   // Construir a query com valores interpolados diretamente
   let updateQuery = `
     UPDATE payment_gateway_settings
     SET ${updateFields.join(', ')}
     WHERE id = ${id}
     RETURNING *
   `;
   
   // Substituir placeholders com valores reais (com escape para strings)
   for (let i = 0; i < values.length - 1; i++) {
     const placeholder = `$${i + 2}`;
     const value = typeof values[i + 1] === 'string' 
       ? `'${values[i + 1].replace(/'/g, "''")}'` 
       : values[i + 1];
     updateQuery = updateQuery.replace(placeholder, value);
   }
   ```

2. Tratamento específico para strings com escape de aspas simples para prevenir injeções SQL.

### 2. Melhoria no tratamento de erros

1. Adicionamos blocos `try...catch` em todas as funções do modelo:
   ```typescript
   try {
     // Código de operação do banco de dados
   } catch (error) {
     console.error('Erro ao [operação]:', error);
     throw error;
   }
   ```

2. Adicionamos mensagens específicas de erro para facilitar o diagnóstico.

### 3. Simplificação de consultas

1. Alteramos consultas complexas para usar identificação por ID direta em vez de consultas condicionais, como:
   ```typescript
   // Antes
   UPDATE payment_gateway_settings SET is_default = FALSE WHERE is_default = TRUE
   
   // Depois
   UPDATE payment_gateway_settings SET is_default = FALSE WHERE is_default = TRUE AND id != ${id}
   ```

## Recomendações para Futuras Implementações

### 1. Padrões para Operações SQL Seguras

1. **Evitar parâmetros posicionais em queries complexas**: Para queries com muitos parâmetros ou que afetam múltiplos registros, considere:
   - Construir dinamicamente a query com interpolação direta (com escape para valores de string)
   - Ou usar ORM como Drizzle com seus métodos de alto nível

2. **Sanitização de entradas**: Sempre realizar escape em valores de string para prevenir injeção SQL:
   ```typescript
   if (typeof value === 'string') {
     value = `'${value.replace(/'/g, "''")}'`;
   }
   ```

### 2. Tratamento de Erros

1. **Sempre usar blocos try-catch**: Envolver todas as operações de banco de dados em blocos try-catch.

2. **Logging detalhado**: Registrar detalhes do erro, incluindo:
   - Tipo de operação que falhou
   - Parâmetros usados (exceto dados sensíveis)
   - Mensagem de erro do banco de dados

3. **Propagação de erros**: Após registrar o erro, propagar para a camada superior para tratamento adequado.

### 3. Testes

1. **Testes unitários**: Implementar testes para cada função do modelo com casos de:
   - Sucesso na operação
   - Falha esperada (ex: tentar atualizar ID inexistente)
   - Tratamento de erros de banco de dados

2. **Testes de integração**: Verificar o funcionamento end-to-end com o banco de dados real.

## Script de Diagnóstico

Foi desenvolvido um script de diagnóstico em `tools/debug-payment-settings.js` que pode ser usado para:

1. Verificar a estrutura da tabela
2. Listar todas as configurações atuais de gateways
3. Identificar problemas comuns como:
   - Gateways sem chave API
   - Ausência de gateway padrão
4. Realizar correções diretas, como:
   - Alternar modo sandbox
   - Definir gateway padrão

## Referências

- [Documentação do PostgreSQL sobre parâmetros parametrizados](https://www.postgresql.org/docs/current/sql-prepare.html)
- [Boas práticas de segurança contra injeção SQL](https://owasp.org/www-community/attacks/SQL_Injection)
- [Documentação do Drizzle ORM](https://orm.drizzle.team/docs/overview)