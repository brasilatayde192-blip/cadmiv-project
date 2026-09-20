-- Fundação inicial, transacional e idempotente. Não apaga tabelas existentes.
CREATE TABLE IF NOT EXISTS cadmiv_clientes (
 id uuid PRIMARY KEY, nome text NOT NULL, cpf text NOT NULL UNIQUE,
 telefone text NOT NULL UNIQUE, email text NOT NULL, nascimento date NOT NULL,
 senha_hash text NOT NULL, privado jsonb NOT NULL DEFAULT '{}',
 dependentes jsonb NOT NULL DEFAULT '[]', responsabilidade boolean NOT NULL DEFAULT false,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cadmiv_veiculos (
 id uuid PRIMARY KEY, cliente_id uuid NOT NULL UNIQUE REFERENCES cadmiv_clientes(id), codigo text NOT NULL UNIQUE,
 chassi text NOT NULL CHECK(length(chassi)<=128 AND chassi ~ '^[A-Za-z0-9[:space:]./-]+$'),
 chassi_normalizado text GENERATED ALWAYS AS (regexp_replace(upper(chassi COLLATE "C"),'[^A-Z0-9]','','g')) STORED,
 CONSTRAINT cadmiv_veiculos_chassi_unique UNIQUE(chassi_normalizado),
 CONSTRAINT cadmiv_chassi_tamanho CHECK(length(chassi_normalizado) BETWEEN 1 AND 64),
 marca text NOT NULL CHECK(length(trim(marca)) BETWEEN 1 AND 100), modelo text NOT NULL,
 cor text NOT NULL, nota_fiscal text NOT NULL, ano integer NOT NULL,
 estado_conservacao text NOT NULL CHECK(estado_conservacao IN ('novo','usado')),
 combo integer NOT NULL CHECK(combo BETWEEN 1 AND 3),
 status text NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','ATIVO','ROUBO','DESATIVADO','ADORMECIDO')),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cadmiv_sessoes (
 token_hash text PRIMARY KEY, cliente_id uuid NOT NULL REFERENCES cadmiv_clientes(id) ON DELETE CASCADE, expira timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS cadmiv_sessoes_expira ON cadmiv_sessoes(expira);
CREATE TABLE IF NOT EXISTS cadmiv_limites(chave text PRIMARY KEY,quantidade integer NOT NULL,expira timestamptz NOT NULL);

CREATE TABLE IF NOT EXISTS cadmiv_recuperacoes (
 token_hash text PRIMARY KEY,
 cliente_id uuid NOT NULL REFERENCES cadmiv_clientes(id) ON DELETE CASCADE,
 expira timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS cadmiv_recuperacoes_cliente ON cadmiv_recuperacoes(cliente_id);
CREATE INDEX IF NOT EXISTS cadmiv_recuperacoes_expira ON cadmiv_recuperacoes(expira);

CREATE TABLE IF NOT EXISTS cadmiv_fotos (
 cliente_id uuid NOT NULL REFERENCES cadmiv_clientes(id) ON DELETE CASCADE,
 posicao smallint NOT NULL CHECK(posicao BETWEEN 0 AND 2),
 imagem bytea NOT NULL CHECK(octet_length(imagem)<=200000),
 PRIMARY KEY(cliente_id,posicao)
);
