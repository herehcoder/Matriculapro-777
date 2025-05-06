#!/bin/bash

# Script para executar testes Jest

# Definir variável de ambiente para testes
export NODE_ENV=test

# Executar testes com Jest
echo "Executando testes..."
npx jest "$@"