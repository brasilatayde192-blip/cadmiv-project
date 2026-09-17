# Resultado dos testes — CADMIV

A suíte local terminou com **30 testes aprovados, zero falhas e zero testes ignorados**. Essa contagem do Node inclui dois agrupamentos: são 28 cenários mais dois testes agrupadores.

## Ambiente e alcance

- Node.js 24; Express e driver pg instalados a partir do package-lock.json.
- SQL executado com PGlite, uma distribuição embarcada do PostgreSQL, em ambiente isolado com dados fictícios.
- Requisições HTTP reais ao servidor Express local.
- Estrutura e comportamento do formulário verificados com jsdom. Isso não equivale a teste visual em navegadores reais ou em celulares.
- Teste adicional de persistência em disco: o banco embarcado foi fechado e reaberto; chassi normalizado, marca e situação permaneceram gravados.
- Auditoria das dependências de produção: nenhuma vulnerabilidade conhecida reportada pelo npm no momento da execução. Isso não substitui uma auditoria completa de segurança.

## Cenários aprovados

- Normalização de chassi, recusa de caracteres inválidos e limites de tamanho.
- Chassi duplicado recusado pela API e pela restrição UNIQUE, inclusive por SQL direto com outro cliente.
- Requisições concorrentes: um cadastro aceito e outro recusado; ausência de cliente órfão após erro.
- Maioridade usando data completa, datas impossíveis, CPF, telefone, e-mail e senha.
- Marca obrigatória no servidor, além do formulário.
- Dependentes e aceite de responsabilidade conforme o plano.
- Hash de senha com salt e recusa de senha incorreta.
- Sessão HttpOnly/SameSite, login, logout e isolamento dos dados entre clientes.
- Dados e sessão mantidos após reinício do servidor HTTP.
- Alteração persistente de telefone; recusa de alteração de nome, CPF e situação pelo cliente.
- Alerta autenticado de cadastro ativo; recusa para cadastro pendente ou senha errada.
- Consulta pública sem dados pessoais ou médicos.
- Bloqueio de arquivos internos, painel administrativo e cartão sem autenticação.
- Recusa de origem externa e requisições sem proteção contra envio cruzado.
- Limitação de tentativas de login.
- IDs únicos, todos os campos pertencendo ao formulário, troca de plano e envio correto de marca/nascimento.
- Mensagem de erro sem apagar o formulário; ausência das confirmações fictícias antigas.

## Limitações da verificação

Não foram testados o PostgreSQL gerenciado no Render, a conexão TLS ao seu banco, as credenciais da sua conta, o domínio, a infraestrutura de produção nem concorrência entre processos de um servidor PostgreSQL remoto. PGlite serializa acesso ao banco; o teste concorrente valida o comportamento HTTP/UNIQUE local, não a infraestrutura distribuída.

Nenhum dado de cliente real foi usado nos testes. Não houve publicação, alteração de GitHub ou implantação no Render.

## Reproduzir

`npm ci` instala as dependências de produção. `npm test` executa os testes unitários e pula explicitamente os conjuntos sem configuração.

Para integração em PostgreSQL de servidor, configure CADMIV_TEST_DATABASE_URL com um banco vazio EXCLUSIVO para testes. A suíte cria suas tabelas e deixa registros fictícios. Nunca use a URL do banco de produção.

Para repetir a verificação embarcada/DOM sem adicionar bibliotecas ao package.json de produção:

1. Em uma pasta separada, instale `@electric-sql/pglite` e `jsdom` com npm.
2. Defina CADMIV_TEST_PGLITE como o caminho absoluto do módulo instalado `@electric-sql/pglite`.
3. Defina CADMIV_TEST_JSDOM como o caminho absoluto do módulo instalado `jsdom`.
4. Execute `node --test --test-isolation=none test/*.test.js` na pasta CADMIV. A opção sem isolamento contorna uma restrição de criação de processos observada neste ambiente Windows.

## Preservação

A base de trabalho foi uma cópia dos 14 arquivos da pasta GPT-CADMIV, compatível com os anexos recuperados da conversa. Os originais não foram escritos. O backup CADMIV-BACKUP-ANTES-DAS-ALTERACOES não foi modificado nem sobrescrito.
