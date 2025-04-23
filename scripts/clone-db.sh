#!/bin/bash

# Configuração do banco de dados externo
EXTERNAL_DB_URL="postgresql://neondb_owner:npg_gxio9mv7utlP@ep-delicate-glade-a6uygypx.us-west-2.aws.neon.tech/neondb?sslmode=require"
EXTERNAL_DB_HOST="ep-delicate-glade-a6uygypx.us-west-2.aws.neon.tech"
EXTERNAL_DB_USER="neondb_owner"
EXTERNAL_DB_PASSWORD="npg_gxio9mv7utlP"
EXTERNAL_DB_NAME="neondb"

# Configuração do banco de dados local
LOCAL_DB_URL="${DATABASE_URL}"

# Criar SQL para esquema
echo "Extraindo schema do banco de dados externo..."
PGPASSWORD=${EXTERNAL_DB_PASSWORD} pg_dump -h ${EXTERNAL_DB_HOST} -U ${EXTERNAL_DB_USER} -d ${EXTERNAL_DB_NAME} -s > schema.sql

# Criar SQL para dados
echo "Extraindo dados do banco de dados externo..."
PGPASSWORD=${EXTERNAL_DB_PASSWORD} pg_dump -h ${EXTERNAL_DB_HOST} -U ${EXTERNAL_DB_USER} -d ${EXTERNAL_DB_NAME} -a > data.sql

# Aplicar schema e dados ao banco local
echo "Aplicando schema ao banco local..."
psql "${LOCAL_DB_URL}" -f schema.sql

echo "Aplicando dados ao banco local..."
psql "${LOCAL_DB_URL}" -f data.sql

echo "Processo de clonagem concluído!"