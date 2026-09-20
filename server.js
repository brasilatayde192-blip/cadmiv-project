'use strict';
const express = require('express');
const QRCode = require('qrcode');
const { createResetMailer } = require('./email');
const { prepararFoto } = require('./fotos');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { Pool } = require('pg');
const scrypt = promisify(crypto.scrypt);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
function normalizeChassi(value) {
  if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9 .\/\t\r\n-]+$/.test(value)) throw fail(400, 'Chassi inválido: use letras, números, espaços, ponto, barra ou hífen.');
  const result = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!result || result.length > 64) throw fail(400, 'Informe um chassi de até 64 letras e números.');
  return result;
}
function text(value, label, max = 200, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(400, `Confira o campo ${label}.`);
  return value.trim();
}
function phone(value) {
  const result = text(value, 'telefone', 30).replace(/[ ()+.-]/g, '');
  if (!/^\d{10,13}$/.test(result)) throw fail(400, 'Telefone inválido. Use sempre o mesmo formato com DDD.');
  return result;
}
function cpf(value) {
  const result = text(value, 'CPF', 14).replace(/[.-]/g, '');
  if (!/^\d{11}$/.test(result) || /^(\d)\1{10}$/.test(result)) throw fail(400, 'CPF inválido.');
  for (let n = 9; n <= 10; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(result[i]) * (n + 1 - i);
    if ((sum * 10 % 11) % 10 !== Number(result[n])) throw fail(400, 'CPF inválido.');
  }
  return result;
}
function adult(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail(400, 'Informe a data de nascimento completa.');
  const date = new Date(value + 'T12:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || +value.slice(0,4) < 1900) throw fail(400, 'Data de nascimento inválida.');
  const today = now.toISOString().slice(0, 10);
  const age = +today.slice(0,4) - +value.slice(0,4) - (today.slice(5) < value.slice(5) ? 1 : 0);
  if (age < 18) throw fail(400, 'O titular deve ter pelo menos 18 anos.');
  return value;
}
const privateKeys = ['cep','logradouro','numero','bairro','cidade','uf','contato_emergencia','telefone_emergencia','sangue','latex','medicamentos','medico','telefone_medico'];
const requiredPrivate = ['cep','logradouro','numero','bairro','cidade','uf','contato_emergencia','telefone_emergencia','latex','medicamentos'];
function validateRegistration(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'Cadastro inválido.');
  const d = { nome:text(b.nome,'nome'), cpf:cpf(b.cpf), telefone:phone(b.telefone), email:text(b.email,'e-mail',254), nascimento:adult(b.nascimento) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw fail(400,'E-mail inválido.');
  if (typeof b.senha !== 'string' || b.senha.length < 12 || b.senha.length > 128) throw fail(400,'Use uma senha de 12 a 128 caracteres.');
  d.senha=b.senha; d.marca=text(b.marca,'Marca do Veículo',100); d.modelo=text(b.modelo,'modelo',100);
  if (!['bike_comum','bike_sem_acelerador','bike_com_acelerador','bike_esportiva_alto_custo','bike_triciclo_comum','bike_triciclo_especial','patinete','monociclo'].includes(d.modelo)) throw fail(400,'Modelo inválido.');
  d.chassi=normalizeChassi(b.chassi); d.cor=text(b.cor,'cor',80); d.nota_fiscal=text(b.nota_fiscal,'nota fiscal',100); d.ano=text(b.ano,'ano',4);
  if (!/^\d{4}$/.test(d.ano) || +d.ano < 1900 || +d.ano > new Date().getUTCFullYear()+1) throw fail(400,'Ano de fabricação inválido.');
  if (!['novo','usado'].includes(b.estado_conservacao)) throw fail(400,'Selecione o estado de conservação.');
  d.estado_conservacao=b.estado_conservacao;
  if (b.cadastro_anterior !== 'Não') throw fail(409,'Veículo com cadastro anterior: procure o suporte para transferência.');
  if (!['1','2','3'].includes(b.combo)) throw fail(400,'Selecione um plano.');
  d.combo=b.combo; d.privado={};
  for (const key of privateKeys) d.privado[key]=text(b[key],key,300,requiredPrivate.includes(key));
  d.dependentes=[];
  for(let i=1;i<Number(b.combo);i++) d.dependentes.push({nome:text(b['dep'+i+'_nome'],'nome do dependente'),parentesco:text(b['dep'+i+'_parentesco'],'parentesco',50)});
  if(d.dependentes.length && b.responsabilidade !== true) throw fail(400,'Confirme a responsabilidade pelos dependentes.');
  d.responsabilidade=b.responsabilidade===true;
  return d;
}
async function hashPassword(password) {
  const salt=crypto.randomBytes(16).toString('hex');
  return salt+':'+(await scrypt(password,salt,64)).toString('hex');
}
async function verifyPassword(password,stored) {
  if(typeof password!=='string'||password.length>128) return false;
  const [salt,hash]=stored.split(':');
  const actual=await scrypt(password,salt,64),expected=Buffer.from(hash,'hex');
  return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
}
async function migrate(db) {
  const c=await db.connect();
  try { await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock(72410831)'); await c.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8')); await c.query('COMMIT'); }
  catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
function createApp(db,{production=false,origin='http://localhost:10000',sendResetEmail=null}={}) {
  const resetTasks=new Set();
  const app=express(); app.locals.resetTasks=resetTasks; app.disable('x-powered-by'); if(production) app.set('trust proxy',1);
  app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});next();});
  app.use('/api/me/foto',express.json({limit:'1mb'}));
  app.use(express.json({limit:'32kb'}));
  const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
  app.use('/api',(req,res,next)=>{
    if(req.method!=='GET'&&(req.get('X-CADMIV')!=='1'||!req.is('application/json')||(req.get('Origin')&&req.get('Origin')!==origin))) return res.status(403).json({erro:'Origem da solicitação não autorizada.'});
    next();
  });
  app.use('/api',wrap(async(req,res,next)=>{
    const sensitive=req.path==='/login'||req.path.startsWith('/senha/');
    const key=digest(req.ip+':'+(sensitive?'acesso':'api'));
    const {rows}=await db.query(`INSERT INTO cadmiv_limites(chave,quantidade,expira) VALUES($1,1,now()+interval '10 minutes')
      ON CONFLICT(chave) DO UPDATE SET quantidade=CASE WHEN cadmiv_limites.expira<now() THEN 1 ELSE cadmiv_limites.quantidade+1 END,
      expira=CASE WHEN cadmiv_limites.expira<now() THEN now()+interval '10 minutes' ELSE cadmiv_limites.expira END RETURNING quantidade`,[key]);
    if(rows[0].quantidade>(sensitive?20:150)){res.set('Retry-After','600');return res.status(429).json({erro:'Muitas tentativas. Aguarde alguns minutos.'});} next();
  }));
  function cookie(req){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('cadmiv_session='))?.slice('cadmiv_session='.length)||'';}
  async function current(req){
    const token=cookie(req);if(!/^[a-f0-9]{64}$/.test(token))throw fail(401,'Entre na sua conta.');
    const {rows}=await db.query('SELECT cliente_id FROM cadmiv_sessoes WHERE token_hash=$1 AND expira>now()',[digest(token)]);
    if(!rows.length)throw fail(401,'Sessão expirada. Entre novamente.');return rows[0].cliente_id;
  }
  async function session(c,id){const token=crypto.randomBytes(32).toString('hex');await c.query("INSERT INTO cadmiv_sessoes(token_hash,cliente_id,expira) VALUES($1,$2,now()+interval '8 hours')",[digest(token),id]);return token;}
  function setCookie(res,token,maxAge=28800000){res.cookie('cadmiv_session',token,{httpOnly:true,secure:production,sameSite:'strict',maxAge,path:'/'});}
  app.get('/healthz',wrap(async(req,res)=>{await db.query('SELECT 1');res.json({status:'ok'});}));
  app.post('/api/chassi/verificar',wrap(async(req,res)=>{const {rows}=await db.query('SELECT 1 FROM cadmiv_veiculos WHERE chassi_normalizado=$1',[normalizeChassi(req.body.chassi)]);res.json({cadastrado:rows.length>0});}));
  app.post('/api/cadastros',wrap(async(req,res)=>{
    const b=validateRegistration(req.body),passwordHash=await hashPassword(b.senha),c=await db.connect();
    try{
      await c.query('BEGIN');
      const id=crypto.randomUUID(),vehicleId=crypto.randomUUID(),codigo=crypto.randomBytes(24).toString('hex');
      await c.query(`INSERT INTO cadmiv_clientes(id,nome,cpf,telefone,email,nascimento,senha_hash,privado,dependentes,responsabilidade) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,b.nome,b.cpf,b.telefone,b.email,b.nascimento,passwordHash,JSON.stringify(b.privado),JSON.stringify(b.dependentes),b.responsabilidade]);
      await c.query(`INSERT INTO cadmiv_veiculos(id,cliente_id,codigo,chassi,marca,modelo,cor,nota_fiscal,ano,estado_conservacao,combo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[vehicleId,id,codigo,b.chassi,b.marca,b.modelo,b.cor,b.nota_fiscal,b.ano,b.estado_conservacao,b.combo]);
      const token=await session(c,id);await c.query('COMMIT');setCookie(res,token);res.status(201).json({codigo,status:'PENDENTE'});
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }));
  app.post('/api/senha/solicitar',wrap(async(req,res)=>{
    if(!sendResetEmail)throw fail(503,'A recuperação por e-mail ainda não está disponível. Tente novamente mais tarde.');
    const telefone=phone(req.body.telefone),email=text(req.body.email,'e-mail',254).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(400,'Informe um e-mail válido.');
    const key=digest('recuperacao:'+telefone);
    const {rows:limit}=await db.query(`INSERT INTO cadmiv_limites(chave,quantidade,expira) VALUES($1,1,now()+interval '10 minutes')
      ON CONFLICT(chave) DO UPDATE SET quantidade=CASE WHEN cadmiv_limites.expira<now() THEN 1 ELSE cadmiv_limites.quantidade+1 END,
      expira=CASE WHEN cadmiv_limites.expira<now() THEN now()+interval '10 minutes' ELSE cadmiv_limites.expira END RETURNING quantidade`,[key]);
    res.status(202).json({mensagem:'Se o telefone e o e-mail corresponderem ao cadastro, enviaremos um link. Confira também a pasta de spam. O link vale por 30 minutos.'});
    if(limit[0].quantidade>3)return;
    // O envio ocorre após a resposta, sem revelar a existência da conta pelo tempo do provedor.
    const task=(async()=>{
      const {rows}=await db.query('SELECT id,email FROM cadmiv_clientes WHERE telefone=$1 AND lower(email)=$2',[telefone,email]);
      if(!rows.length)return;
      const token=crypto.randomBytes(32).toString('hex'),tokenHash=digest(token);
      await db.query("INSERT INTO cadmiv_recuperacoes(token_hash,cliente_id,expira) VALUES($1,$2,now()+interval '30 minutes')",[tokenHash,rows[0].id]);
      const url=new URL('/redefinir-senha.html',origin);url.hash='token='+token;
      try{await sendResetEmail({to:rows[0].email,url:url.href});}
      catch(e){await db.query('DELETE FROM cadmiv_recuperacoes WHERE token_hash=$1',[tokenHash]);throw e;}
    })().catch(()=>console.error('Falha no envio de recuperação. Verifique o serviço de e-mail.'));
    resetTasks.add(task);task.finally(()=>resetTasks.delete(task));
  }));
  app.post('/api/senha/redefinir',wrap(async(req,res)=>{
    const token=req.body.token,senha=req.body.senha;
    if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))throw fail(400,'Link inválido ou expirado. Solicite outro link.');
    if(typeof senha!=='string'||senha.length<12||senha.length>128)throw fail(400,'Use uma senha de 12 a 128 caracteres.');
    const passwordHash=await hashPassword(senha),c=await db.connect();
    try{
      await c.query('BEGIN');
      const {rows}=await c.query('SELECT cliente_id FROM cadmiv_recuperacoes WHERE token_hash=$1 AND expira>now()',[digest(token)]);
      if(!rows.length)throw fail(400,'Link inválido ou expirado. Solicite outro link.');
      const id=rows[0].cliente_id;
      await c.query('SELECT id FROM cadmiv_clientes WHERE id=$1 FOR UPDATE',[id]);
      const used=await c.query('DELETE FROM cadmiv_recuperacoes WHERE token_hash=$1 AND expira>now() RETURNING cliente_id',[digest(token)]);
      if(!used.rows.length)throw fail(400,'Link inválido ou expirado. Solicite outro link.');
      await c.query('UPDATE cadmiv_clientes SET senha_hash=$1 WHERE id=$2',[passwordHash,id]);
      await c.query('DELETE FROM cadmiv_recuperacoes WHERE cliente_id=$1',[id]);
      await c.query('DELETE FROM cadmiv_sessoes WHERE cliente_id=$1',[id]);
      await c.query('COMMIT');setCookie(res,'',0);res.json({mensagem:'Senha alterada. Entre com seu telefone e a nova senha.'});
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }));
  app.post('/api/login',wrap(async(req,res)=>{
    const telefone=phone(req.body.telefone),c=await db.connect();
    try{
      await c.query('BEGIN');
      const {rows}=await c.query('SELECT id,senha_hash FROM cadmiv_clientes WHERE telefone=$1 FOR UPDATE',[telefone]);
      const valid=await verifyPassword(req.body.senha,rows[0]?.senha_hash||'0'.repeat(32)+':'+'0'.repeat(128));
      if(!rows.length||!valid)throw fail(401,'Telefone ou senha incorretos.');
      if(cookie(req))await c.query('DELETE FROM cadmiv_sessoes WHERE token_hash=$1',[digest(cookie(req))]);
      const token=await session(c,rows[0].id);await c.query('COMMIT');setCookie(res,token);res.json({ok:true});
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }));
  app.post('/api/logout',wrap(async(req,res)=>{await db.query('DELETE FROM cadmiv_sessoes WHERE token_hash=$1',[digest(cookie(req))]);setCookie(res,'',0);res.json({ok:true});}));
  app.get('/api/me/foto/:posicao',wrap(async(req,res)=>{
    const id=await current(req),posicao=Number(req.params.posicao);
    if(!/^[0-2]$/.test(req.params.posicao))throw fail(400,'Cartão inválido.');
    const {rows}=await db.query('SELECT imagem FROM cadmiv_fotos WHERE cliente_id=$1 AND posicao=$2',[id,posicao]);
    if(!rows.length)return res.status(404).end();
    res.type('image/jpeg').send(Buffer.from(rows[0].imagem));
  }));
  app.post('/api/me/foto',wrap(async(req,res)=>{
    const id=await current(req),posicao=req.body.posicao;
    const {rows}=await db.query('SELECT dependentes FROM cadmiv_clientes WHERE id=$1',[id]);
    if(!Number.isInteger(posicao)||posicao<0||posicao>2||posicao>rows[0].dependentes.length)throw fail(400,'Cartão inválido para este cadastro.');
    if(req.body.foto===null){await db.query('DELETE FROM cadmiv_fotos WHERE cliente_id=$1 AND posicao=$2',[id,posicao]);return res.json({ok:true});}
    let imagem;try{imagem=await prepararFoto(req.body.foto);}catch(e){throw fail(400,e.message);}
    await db.query('INSERT INTO cadmiv_fotos(cliente_id,posicao,imagem) VALUES($1,$2,$3) ON CONFLICT(cliente_id,posicao) DO UPDATE SET imagem=EXCLUDED.imagem',[id,posicao,imagem]);
    res.json({ok:true});
  }));
  app.get('/api/me/qr',wrap(async(req,res)=>{
    const id=await current(req);
    const {rows}=await db.query('SELECT codigo FROM cadmiv_veiculos WHERE cliente_id=$1',[id]);
    if(!rows.length)throw fail(404,'Veículo não localizado.');
    const url=new URL('/fiscalizacao.html',origin);url.hash='codigo='+rows[0].codigo;
    res.type('image/svg+xml').send(await QRCode.toString(url.href,{type:'svg',margin:4,errorCorrectionLevel:'M'}));
  }));
  app.get('/api/me',wrap(async(req,res)=>{
    const id=await current(req);const {rows}=await db.query(`SELECT c.nome,c.cpf,c.telefone,c.email,c.privado,c.dependentes,v.codigo,v.chassi_normalizado AS chassi,v.marca,v.modelo,v.cor,v.status,v.criado_em FROM cadmiv_clientes c JOIN cadmiv_veiculos v ON v.cliente_id=c.id WHERE c.id=$1`,[id]);res.json(rows[0]);
  }));
  app.patch('/api/me',wrap(async(req,res)=>{
    const id=await current(req);if(Object.keys(req.body).some(k=>k!=='telefone'))throw fail(400,'Nesta etapa somente o telefone pode ser atualizado.');
    await db.query('UPDATE cadmiv_clientes SET telefone=$1 WHERE id=$2',[phone(req.body.telefone),id]);res.json({ok:true});
  }));
  app.post('/api/alerta',wrap(async(req,res)=>{
    const id=await current(req);const {rows}=await db.query('SELECT senha_hash FROM cadmiv_clientes WHERE id=$1',[id]);
    if(!await verifyPassword(req.body.senha,rows[0].senha_hash))throw fail(401,'Senha incorreta.');
    const result=await db.query("UPDATE cadmiv_veiculos SET status='ROUBO' WHERE cliente_id=$1 AND status IN ('ATIVO','ROUBO') RETURNING codigo",[id]);
    if(!result.rows.length)throw fail(409,'O cadastro ainda não está ativo. Entre em contato com o suporte.');res.json({status:'ROUBO'});
  }));
  app.post('/api/consultar',wrap(async(req,res)=>{
    const result=req.body.chassi!==undefined ? await db.query('SELECT status,marca,modelo,cor,chassi_normalizado AS chassi FROM cadmiv_veiculos WHERE chassi_normalizado=$1',[normalizeChassi(req.body.chassi)]) : await db.query('SELECT status,marca,modelo,cor,chassi_normalizado AS chassi FROM cadmiv_veiculos WHERE codigo=$1',[text(req.body.codigo,'código',64)]);
    if(!result.rows.length)return res.json({status:'INVALIDO',mensagem:'Veículo não localizado na base CADMIV.'});
    const messages={PENDENTE:'Cadastro em andamento — ainda não ativo.',ATIVO:'Cadastro ativo.',ROUBO:'Alerta de furto ou roubo registrado pelo titular.',DESATIVADO:'Cadastro desativado.',ADORMECIDO:'Cadastro aguardando renovação.'};
    const r=result.rows[0];res.json({status:r.status,mensagem:messages[r.status],marca:r.marca,modelo:r.modelo,cor:r.cor,chassi:r.chassi});
  }));
  app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
  app.get('/validar',(req,res)=>res.redirect('/validar.html'));
  for(const page of ['index.html','apresentacao.html','fiscalizacao.html','termos.html','cadastro.html','login.html','alerta.html','cadastro.js','cliente.js','recuperar-senha.html','redefinir-senha.html','senha.js','cartao.js'])app.get('/'+page,(req,res)=>res.sendFile(path.join(__dirname,page)));
  for(const page of ['botao.html','cartao.html','validar.html'])app.get('/'+page,wrap(async(req,res)=>{try{await current(req);}catch(e){if(e.status===401)return res.redirect('/login.html');throw e;}res.sendFile(path.join(__dirname,page));}));
  app.get('/painel.html',(req,res)=>res.status(403).send('Painel administrativo indisponível nesta etapa. Os indicadores antigos eram demonstrativos.'));
  app.use((req,res)=>res.status(404).json({erro:'Página não encontrada.'}));
  app.use((err,req,res,next)=>{
    if(err.code==='23505')return res.status(409).json({erro:err.constraint==='cadmiv_veiculos_chassi_unique'?'Este chassi já está cadastrado.':'Já existe cadastro com estes dados. Use o acesso de cliente cadastrado.'});
    const status=err.status||503;if(status>=500)console.error('Falha na operação CADMIV:',err.code||'INTERNAL');
    res.status(status).json({erro:status>=500?'Serviço temporariamente indisponível. Tente novamente.':status===413?'Formulário muito grande.':err.type==='entity.parse.failed'?'JSON inválido.':err.message});
  });return app;
}
async function start(){
  if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL antes de iniciar.');
  const production=process.env.NODE_ENV==='production',origin=process.env.APP_ORIGIN||'http://localhost:10000';
  if(production&&(!process.env.APP_ORIGIN||!origin.startsWith('https://')))throw Error('Configure APP_ORIGIN com a URL HTTPS do site.');
  const db=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
  db.on('error',e=>console.error('Conexão PostgreSQL interrompida:',e.code||'DATABASE'));
  await migrate(db);
  const server=createApp(db,{production,origin,sendResetEmail:createResetMailer()}).listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('CADMIV iniciado com PostgreSQL.'));
  const cleanup=setInterval(()=>db.query('DELETE FROM cadmiv_sessoes WHERE expira<now(); DELETE FROM cadmiv_limites WHERE expira<now(); DELETE FROM cadmiv_recuperacoes WHERE expira<now()').catch(()=>{}),3600000);cleanup.unref();
  const shutdown=()=>{clearInterval(cleanup);server.close(()=>db.end().finally(()=>process.exit(0)));setTimeout(()=>process.exit(1),10000).unref();};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
if(require.main===module)start().catch(e=>{console.error('CADMIV não iniciou:',e.code||(e.message.startsWith('Configure')?e.message:'verifique banco e configuração'));process.exit(1);});
module.exports={createApp,migrate,normalizeChassi,validateRegistration,adult,hashPassword,verifyPassword};
