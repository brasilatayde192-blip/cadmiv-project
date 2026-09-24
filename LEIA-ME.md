# CADMIV — atualização de 24/09/2026, preparação da renovação

## Renovação e nota fiscal

- CADMIV no topo do acesso e da recuperação de senha usa Arial, negrito, 32px, como no portal de pagamento.
- Após login autenticado, cartões com validade vencida mostram o lembrete amarelo. Acesso direto às páginas privadas do cartão também retorna ao lembrete; emissão de QR e impressão pelo botão conferem o vencimento.
- Um novo ano é calculado a partir de cada data de renovação confirmada, com aniversário em 28/02 quando a renovação foi em 29/02. A primeira ativação usa a mesma duração. A data do primeiro cadastro permanece intacta; no cartão renovado aparece a data da renovação e a validade.
- Esta entrega PREPARA as telas. PIX ainda não está integrado: o botão de cobrança fica desativado e não há rota que aceite do navegador uma confirmação de pagamento. A tela de agradecimento só aparece quando o servidor encontra uma renovação registrada e vigente, com situação ATIVO. A futura integração deverá validar a confirmação do provedor, atualizar as datas com segurança e evitar confirmações duplicadas. Não há ativação automática disponível nesta entrega.
- A migração adiciona campos sem apagar registros. Cadastros existentes sem data confirmada de ativação/renovação não ganham datas inventadas nem passam a ser considerados pagos. Cadastros PENDENTE continuam na etapa de testes. Registros legados ATIVO sem data exigem conferência antes do lançamento. O alerta ROUBO permanece visível na consulta mesmo se o cartão vencer.
- Nota fiscal admite até 100 caracteres, números e letras, sem mínimo de nove dígitos. Para novos cadastros sem nota, abrir a opção abaixo do campo e escolher somente Doação ou Presente. Com uma opção marcada, o número não é enviado nem exigido; ao desmarcar, o número volta a ser exigido. A opção fica preservada e bloqueada na edição, assim como o número da nota fiscal.

Teste no serviço cadmiv-teste antes de publicar para uso real. Os cenários de pagamento nos testes automatizados usam somente um banco isolado; não representam cobrança real. Não altere datas do banco real para simular pagamento.

## Aviso vermelho e trava de veículo duplicado

Erros no cadastro aparecem no topo com uma luz vermelha à esquerda e o texto à direita. O brilho pulsa suavemente; a preferência do dispositivo por movimento reduzido desativa a animação. O aviso recebe foco ao tentar salvar com erro. Ao editar um campo, o aviso anterior é limpo e a próxima tentativa confere os dados novamente. Mensagens de carregamento e sucesso não usam a luz vermelha.

A trava existente no banco impede repetir um chassi/número de série normalizado, em qualquer situação do registro, inclusive ATIVO e ROUBO. Espaços, pontuação e diferenças entre maiúsculas/minúsculas não criam um chassi distinto. A consulta antecipada ajuda no formulário, mas a restrição no banco também protege o envio direto e concorrente.

Esta conferência usa somente os registros existentes no CADMIV. Não consulta bases policiais, não identifica fisicamente um veículo com número informado diferente e não conserva uma restrição depois da exclusão definitiva do registro. O aviso de duplicidade não revela dados pessoais do titular nem altera o alerta existente.

## Primeiro passo para o proprietário

Este pacote é uma cópia de trabalho modificada. Os arquivos originais e o backup CADMIV-BACKUP-ANTES-DAS-ALTERACOES não foram alterados. Extraia o ZIP em uma NOVA pasta. Não extraia dentro do backup.

A aplicação ainda precisa da configuração PostgreSQL/Render abaixo antes de funcionar na internet. Não basta abrir os HTMLs com duplo clique. Não substitua o site em produção antes de configurar o banco e testar em um serviço separado.

## O que foi entregue

- PostgreSQL real no lugar do objeto em memória, com tabelas de clientes, veículos, sessões e limite de tentativas.
- Cadastro transacional: cliente, veículo e sessão são salvos juntos; se houver duplicidade, a operação inteira é desfeita.
- Chassi normalizado no backend: maiúsculas e remoção de espaços, pontos, barras e hífens. Letras acentuadas e outros símbolos são recusados para evitar interpretações ambíguas.
- Coluna de chassi normalizado gerada pelo próprio PostgreSQL e restrição UNIQUE. A mesma regra protege gravações diretas no banco. A pré-consulta do formulário é apenas uma orientação; a garantia final é do banco.
- Campo obrigatório Marca do Veículo. Dados de contato, endereço, saúde, veículo e dependentes do formulário são persistidos. Dados de saúde e endereço ficam no registro privado do cliente.
- Senhas com hash scrypt e salt; sessões aleatórias armazenadas no banco, com cookie HttpOnly/SameSite e Secure em produção. Limite de tentativas persistido no banco.
- Login real, consulta e edição dos próprios dados, exclusão confirmada, saída da conta e alerta de furto/roubo autenticado para cadastro ativo.
- Consulta pública devolve somente situação, mensagem, marca, modelo, cor e chassi. Não devolve nome, CPF, telefone, endereço ou saúde.
- Arquivos internos, configurações e código do servidor não são disponibilizados pelo servidor HTTP.
- Data completa de nascimento, maioridade, CPF, campos obrigatórios e tamanho dos dados são validados no backend.
- index.html, apresentação e separação novo cliente / cliente cadastrado preservados. Formulário mantém estilos e seções, com correções de estrutura e dependentes.

## O que ainda não está concluído

Esta é a fundação solicitada, não o lançamento comercial completo.

- PIX, confirmação de pagamento e ativação automática não estão integrados. Todo cadastro novo recebe PENDENTE. Nenhum clique confirma pagamento. A tela informa claramente essa limitação.
- Transferência direta de titularidade, renovação automática e administração ainda precisam de implementação. A exclusão do próprio cadastro foi incluída na revisão 2.
- O alerta pode ser registrado por um cliente autenticado cujo cadastro esteja ATIVO. Cadastros PENDENTES não podem simular ativação. Não há endpoint público para ativar um cadastro. O teste ativa apenas registros fictícios diretamente no banco de teste.
- Nesta rodada há um titular e um veículo por CPF/telefone; um novo veículo para cliente existente exige uma próxima etapa. Não tente cadastrar novamente o mesmo veículo para alterar dados.
- O cadastro completo pode ser aberto para edição na área do cliente. Nome do titular, CPF, Chassi, Número da Nota Fiscal, plano, situação e data original ficam protegidos no servidor.
- O painel.html foi preservado como arquivo, mas sua rota retorna indisponível. Seus números anteriores eram demonstrativos, e não existe autenticação administrativa pronta.
- node.js foi preservado como arquivo original; contém uma cópia antiga de configuração e NÃO deve ser executado. A aplicação inicia por server.js.
- Não houve migração de cadastros históricos: os arquivos fornecidos usavam simulação/localStorage. Não se deve considerar esses dados automaticamente importados ou verificados.
- A apresentação visual foi preservada no que era possível. Foram retirados os controles de upload sem armazenamento e as confirmações falsas que interferiam nesta fundação.

## GitHub e Render — passo a passo

1. Extraia o ZIP em uma pasta nova. A pasta CADMIV contém os arquivos a enviar. Guarde o backup antigo intacto.
2. No GitHub, use uma branch de teste do repositório CADMIV. Envie o conteúdo da pasta CADMIV, incluindo server.js, schema.sql, cadastro.js, cliente.js, package.json e package-lock.json. Não envie node_modules nem um arquivo .env com senha real. O ZIP já exclui node_modules.
3. No Render, crie um PostgreSQL e um Web Service de teste, na mesma conta e região. Use um banco vazio para esta primeira implantação. A URL interna é preferível para conexões entre serviços Render da mesma região.
4. Conecte o Web Service à branch que contém os arquivos. Se os arquivos estiverem dentro de uma subpasta CADMIV no repositório, configure Root Directory como CADMIV. Se estiverem na raiz, deixe Root Directory vazio.
5. Configure Build Command: `npm ci`. Configure Start Command: `npm start`. O projeto pede Node 24. Configure Health Check Path: `/healthz`.
6. Nas variáveis de ambiente do Web Service, configure:
   - `DATABASE_URL`: URL interna do PostgreSQL fornecida pelo Render, com usuário e senha. Este valor é segredo e não deve ir ao GitHub.
   - `NODE_ENV`: `production`.
   - `APP_ORIGIN`: endereço HTTPS exato do Web Service, sem barra final, por exemplo `https://seu-servico.onrender.com`. Se mudar para domínio próprio, atualize este valor para a origem usada pelos clientes.
   - `PORT`: não precisa definir; o servidor usa a porta fornecida pelo Render.
7. A primeira inicialização cria as tabelas e índices automaticamente, em transação. Inicializações seguintes não apagam registros. Não existe fallback para banco em memória: se a configuração falhar, o servidor não inicia.
8. Confirme que `/healthz` responde com status ok. Depois teste cadastro, login, consulta e tentativa de chassi duplicado no serviço de teste. Um cadastro recém-criado deve continuar PENDENTE.
9. Só depois de validar o serviço de teste, planeje a troca do serviço principal. Pagamento e ativação precisam estar concluídos antes de abrir um fluxo comercial completo.

Conexões externas ao PostgreSQL Render precisam de TLS. Use a URL de conexão indicada pelo Render e sua configuração de SSL; não acrescente `rejectUnauthorized: false` por conta própria. A aplicação passa DATABASE_URL ao driver pg, sem substituir silenciosamente suas opções de conexão.

O banco usa dados privados reais quando você começa a cadastrar clientes. Restrinja acesso administrativo e acesso externo ao banco, e configure backup/recuperação no provedor conforme sua necessidade. Não publique as credenciais.

## Arquivos e fluxo

- Entrada: index.html → apresentacao.html.
- Novo cliente: fiscalizacao.html → termos.html → cadastro.html → validar.html → cartao.html (dados do cadastro com situação explícita).
- Cliente cadastrado: login.html → botao.html (área do cliente).
- alerta.html oferece autenticação e registro do alerta para conta ativa.
- server.js centraliza validação, autenticação e API; schema.sql define a persistência; cadastro.js e cliente.js ligam as telas ao servidor.

As dependências de produção são Express, pg, qrcode e sharp (tratamento das fotos). A criptografia usa o próprio Node.js. O arquivo de lock registra as versões instaladas.

## Testes e reprodução

Consulte TESTES.md para o resultado desta entrega e as limitações. `npm test` executa testes unitários e informa explicitamente quando os testes de integração/DOM estão ignorados por falta de configuração.

Para executar os testes de integração com PostgreSQL de servidor, defina `CADMIV_TEST_DATABASE_URL` para um banco de teste VAZIO, reservado para testes. Nunca use o banco de produção. A suíte recusa um banco que já tenha a tabela cadmiv_clientes. Os registros fictícios ficam nesse banco ao terminar.

Para teste local da aplicação com PostgreSQL instalado, copie .env.example para .env, preencha seus valores e execute `node --env-file=.env server.js`. No Render, use as variáveis da interface e `npm start`.

## Documentação consultada

- Render, implantação Express: https://render.com/docs/deploy-node-express-app
- Render, PostgreSQL e conexões: https://render.com/docs/postgresql-creating-connecting
- Driver pg e TLS: https://node-postgres.com/features/ssl

## Atualização de 18/09/2026

Cartão sem CPF e QR individual gerado no servidor com a biblioteca qrcode. O QR abre fiscalizacao.html com um código aleatório no fragmento do endereço; a página consulta a situação atual do banco. Não inclui dados pessoais. Marca, modelo, cor e chassi permitem comparação manual com o veículo. Cadastros pendentes permanecem pendentes. A leitura não comprova a identidade do portador nem a regularidade de trânsito. A imagem QR genérica antiga foi removida.

## Recuperação de senha — 18/09/2026

O login oferece Esqueci minha senha. O cliente informa telefone e e-mail cadastrados e recebe um link de uso único válido por 30 minutos. A senha anterior nunca é enviada nem exibida. Após a troca, todas as sessões e links de recuperação da conta são invalidados. A recuperação não altera a situação do veículo.

A integração inicial usa a API HTTPS do Resend, sem dependência adicional. O Render Free bloqueia as portas SMTP comuns. Configure apenas no Environment do Render: RESEND_API_KEY (segredo) e MAIL_FROM (remetente autorizado no serviço). APP_ORIGIN precisa ser o endereço HTTPS correto; o comando APP_ORIGIN="$RENDER_EXTERNAL_URL" npm start continua válido. Nunca coloque chaves no GitHub. É necessário verificar o domínio/remetente conforme o provedor e testar a entrega; nenhum envio real foi feito nesta implementação.

Sem essas duas variáveis, a solicitação responde que a recuperação ainda não está disponível; o restante da aplicação funciona. A resposta com o serviço configurado é genérica e não confirma a existência da conta. Máximo de três envios por telefone em dez minutos e limite de pedidos por IP. Tokens são armazenados somente como hash. O envio ocorre em segundo plano no processo do servidor: reinício durante o envio pode interrompê-lo, exigindo um novo pedido. Falhas de entrega são registradas sem token, endereço ou senha.

Um cadastro feito com e-mail fictício não poderá receber a recuperação. Use uma caixa sob seu controle no teste de entrega. Não há recuperação automática sem acesso ao e-mail; validação de identidade para atendimento manual e alteração do e-mail não foram implementadas.

Fontes: https://render.com/docs/free#other-limitations ; https://resend.com/docs/api-reference/emails/send-email ; https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html


## Atualização 19/09 — fotos, segunda via e impressão

Este pacote completo substitui os arquivos da branch cadmiv-teste; não é necessário criar outro serviço ou outro banco. Mantenha as variáveis e os comandos existentes no Render. Envie todos os arquivos, especialmente cartao.js, fotos.js, server.js, schema.sql, package.json e package-lock.json. O servidor cria a tabela de fotos na próxima inicialização sem apagar cadastros.

Na atualização de 20/09, as fotos passaram para as caixas do titular e dos dependentes dentro do formulário de cadastro. Use Buscar no Arquivo ou Tirar Foto Agora; confira a prévia. Cadastro e fotos são salvos juntos. As fotos são opcionais e a câmera exige permissão do navegador. Na área do cliente, escolha Visualizar cartões / Imprimir Segunda Via.

O navegador reduz as imagens; o servidor valida, reprocessa e remove metadados, limita a 480 × 640 pixels e 200 KB por foto. As fotos ficam no PostgreSQL, protegidas pela sessão do titular, e não são incluídas na consulta pública nem no QR-code. A foto não comprova identidade.

A segunda via reutiliza o cadastro existente. O layout de impressão foi compactado, com controles ocultos e um cartão por folha A4 ou Carta em retrato. Confira a prévia antes de imprimir: escolha escala 100%, desative cabeçalhos/rodapés e confirme que aparece uma página. A paginação real ainda precisa dessa conferência: a execução do navegador de teste foi bloqueada pelo ambiente local.

Os avisos de cancelamento e empréstimo foram incluídos no formulário e nos termos. Não há cobrança, cancelamento ou transferência implementados nesta etapa. A redação preserva os reembolsos legais e trata a autorização de empréstimo como recomendação. Referências: Código de Defesa do Consumidor, arts. 49 e 51, https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm .


## Atualização 20/09 — formulário e cartão

- index.html, apresentacao.html, fiscalizacao.html e termos.html preservados byte a byte em relação ao pacote de 19/09. Nenhum backup original foi alterado.
- Aviso abaixo do título do cadastro removido. Fotos JPEG/PNG/WebP de até 10 MB são reduzidas no navegador e validadas no servidor; um problema de foto impede a gravação do cadastro inteiro, para permitir correção e nova tentativa. Titular e até dois dependentes possuem caixas próprias.
- Cartão sem os informativos de situação na página: a situação real no banco e na consulta pública não foi alterada. CPF continua ausente do cartão. Quatro disposições e texto de consulta ficam dentro da moldura, com marca/modelo, data original de registro e www.cadmiv.com.br. O botão de retorno ao início está abaixo do cartão.
- Botão Salvar Cadastro e Gerar PIX preparado conforme solicitado. PIX real e liberação de impressão mediante pagamento NÃO foram integrados, aguardando a escolha do banco/provedor. A tela seguinte informa que não há cobrança. A impressão continua disponível para testar o cartão; não lançar comercialmente esse fluxo antes da integração.
- Para atualizar o serviço de testes, envie todo o conteúdo deste pacote para a branch cadmiv-teste e confirme o deploy. Preserve as configurações existentes do Render. Os arquivos ZIP e backups não devem ser enviados ao repositório.
- Teste um cadastro novo com fotos, confira titular/dependentes e a prévia de impressão. Ainda é necessário conferir a paginação em navegador e o uso de câmera física.


## Revisão 2 — editar e excluir cadastro

Na Área do Cliente, clique em Abrir Cadastro para Alterações. O mesmo formulário será preenchido com os dados já salvos. É possível alterar endereço, telefone, e-mail, nascimento (mantendo maioridade), informações de contato/saúde, marca, modelo, cor, ano, estado de conservação, dados dos dependentes do plano e fotos. Confirme a senha atual ao final e clique em Salvar Alterações. Nome do titular, CPF, Chassi e Número da Nota Fiscal não podem ser alterados, nem por solicitação direta à API. Plano, situação, código e data de registro também são preservados. Alterações no telefone mudam o login; alterações de telefone/e-mail invalidam links de recuperação anteriores.

A foto do titular foi movida para uma seção inicialmente escondida, abaixo dos planos e junto dos dependentes. A seção aparece depois de escolher uma opção, inclusive no plano de um cartão. Fotos existentes carregam na edição e permanecem salvas se não forem substituídas ou removidas.

No topo do formulário em edição, Excluir meu cadastro por venda ou doação abre uma confirmação. O cliente deve escolher motivo, informar a senha e digitar EXCLUIR. Voltar sem excluir cancela a ação. A confirmação apaga da base operacional o cliente, o veículo, as fotos, os dependentes, as sessões e os links de recuperação, liberando o chassi para novo cadastro. O QR antigo deixa de localizar o veículo. Não existe transferência automática ou reembolso automático. Backups externos do provedor e cópias guardadas pelo proprietário não são apagados por esse botão; precisam de política própria de retenção. Nenhum cadastro real foi excluído durante o desenvolvimento.

Este pacote possui 36 arquivos, incluindo a pasta test. Envie todo o conteúdo da pasta CADMIV para cadmiv-teste. O arquivo novo cadastro-edicao.js é necessário. O backup original e os quatro HTMLs preservados continuam intactos. PIX permanece pendente de integração.

### Mostrar ou ocultar a senha

Os campos de senha para ativar alerta de furto/roubo na área do cliente e para salvar alterações agora têm o botão de macaquinho: olhos fechados com a senha oculta e olhos abertos com a senha visível. O botão apenas alterna a visualização; não envia o formulário nem altera o valor digitado.
