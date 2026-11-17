-- Não deduz pagamentos a partir de cadastros ou do status de veículos.
CREATE TABLE IF NOT EXISTS cadmiv_planos (
 id integer PRIMARY KEY CHECK(id BETWEEN 1 AND 3),
 nome text NOT NULL,
 centavos integer NOT NULL CHECK(centavos BETWEEN 1 AND 100000000),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
INSERT INTO cadmiv_planos(id,nome,centavos) VALUES
 (1,'1 Cartão Digital — Titular',2499),
 (2,'2 Cartões Digitais — Titular e 1 dependente',3999),
 (3,'3 Cartões Digitais — Titular e 2 dependentes',4999)
ON CONFLICT(id) DO NOTHING;

-- Histórico financeiro não é apagado pela exclusão de um cadastro.
CREATE TABLE IF NOT EXISTS cadmiv_cobrancas (
 id uuid PRIMARY KEY,
 cliente_id uuid REFERENCES cadmiv_clientes(id) ON DELETE SET NULL,
 plano integer NOT NULL REFERENCES cadmiv_planos(id),
 centavos integer NOT NULL CHECK(centavos>0),
 uf text NOT NULL,
 provedor text NOT NULL,
 referencia text NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provedor,referencia)
);
CREATE UNIQUE INDEX IF NOT EXISTS cadmiv_cobranca_adesao ON cadmiv_cobrancas(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS cadmiv_recebimentos (
 cobranca_id uuid PRIMARY KEY REFERENCES cadmiv_cobrancas(id),
 provedor text NOT NULL,
 transacao text NOT NULL,
 pago_em timestamptz NOT NULL,
 confirmado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provedor,transacao)
);
CREATE INDEX IF NOT EXISTS cadmiv_recebimentos_data ON cadmiv_recebimentos(pago_em);

ALTER TABLE cadmiv_cobrancas ADD COLUMN IF NOT EXISTS pix_copia_cola text;
ALTER TABLE cadmiv_cobrancas ADD COLUMN IF NOT EXISTS pix_expira_em timestamptz;
ALTER TABLE cadmiv_cobrancas ADD COLUMN IF NOT EXISTS pix_proxima_consulta timestamptz;
CREATE INDEX IF NOT EXISTS cadmiv_pix_consulta
 ON cadmiv_cobrancas(provedor,pix_proxima_consulta) WHERE pix_proxima_consulta IS NOT NULL;
