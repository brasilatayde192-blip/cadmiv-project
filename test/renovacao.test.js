const test=require('node:test'),assert=require('node:assert/strict');
const {umAnoApos,vigencia}=require('../vigencia'),{validateRegistration,createApp,migrate}=require('../server'),fixture=require('./fixture');
test('Validade anual: aniversário, ano bissexto, renovação e preservação do alerta',()=>{
 assert.equal(umAnoApos('2026-09-24T12:00:00Z'),'2027-09-24T12:00:00.000Z');
 assert.equal(umAnoApos('2024-02-29T12:00:00Z'),'2025-02-28T12:00:00.000Z');
 const v={status:'ATIVO',ativado_em:'2024-01-01T12:00:00Z',renovado_em:'2026-09-24T12:00:00Z'};
 assert.equal(vigencia(v,new Date('2027-09-24T11:59:59Z')).vencido,false);
 assert.equal(vigencia(v,new Date('2027-09-24T12:00:00Z')).status,'ADORMECIDO');
 assert.equal(vigencia({...v,status:'ROUBO'},new Date('2028-01-01')).status,'ROUBO');
 assert.equal(vigencia({status:'PENDENTE'}).vencido,false);
 assert.equal(vigencia({status:'ATIVO'}).valido_ate,null);
});
test('Nota fiscal flexível, doação e presente exclusivos, sem impor nove dígitos',()=>{
 for(const nf of ['1','000123456','NF-123456789012345','A'.repeat(100)])assert.equal(validateRegistration({...fixture(),nota_fiscal:nf}).nota_fiscal,nf);
 for(const origem_sem_nota of ['doacao','presente'])assert.equal(validateRegistration({...fixture(),nota_fiscal:'',origem_sem_nota}).nota_fiscal,'');
 for(const patch of [{nota_fiscal:''},{origem_sem_nota:'doacao'},{nota_fiscal:'',origem_sem_nota:['doacao','presente']},{nota_fiscal:'',origem_sem_nota:'outro'}])assert.throws(()=>validateRegistration({...fixture(),...patch}));
});
test('Telas: lembrete só após autenticação, PIX indisponível e opções sem nota',{skip:!process.env.CADMIV_TEST_JSDOM},async()=>{
 const {JSDOM}=require(process.env.CADMIV_TEST_JSDOM),fs=require('node:fs'),path=require('node:path'),{Script}=require('node:vm'),root=path.join(__dirname,'..');
 const dom=new JSDOM(fs.readFileSync(path.join(root,'login.html'),'utf8'),{url:'http://localhost/login.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.HTMLElement.prototype.scrollIntoView=()=>{};let data={vencido:true,status:'ADORMECIDO'},autorizado=false;
 w.api=async()=>{if(!autorizado)throw Error('Entre na sua conta.');return data;};
 new Script(fs.readFileSync(path.join(root,'renovacao.js'),'utf8')).runInContext(dom.getInternalVMContext());
 assert.equal(d.getElementById('renovacao').hidden,true);await w.carregarRenovacao();assert.equal(d.getElementById('renovacao-pendente').hidden,true);
 autorizado=true;await w.carregarRenovacao();assert.equal(d.getElementById('renovacao-pendente').hidden,false);assert.equal(d.querySelector('#renovacao-pendente button').disabled,true);assert.equal(d.getElementById('renovacao-concluida').hidden,true);
 data={vencido:false,status:'ATIVO',renovacao_confirmada:true,renovado_em:'2026-09-24T12:00:00Z',valido_ate:'2027-09-24T12:00:00Z'};await w.carregarRenovacao();assert.equal(d.getElementById('renovacao-concluida').hidden,false);assert.equal(d.getElementById('renovacao-pendente').hidden,true);assert.match(d.getElementById('mensagem-renovacao').textContent,/2027/);w.close();
 const formDom=new JSDOM(fs.readFileSync(path.join(root,'cadastro.html'),'utf8'),{url:'http://localhost/cadastro.html',runScripts:'outside-only'}),f=formDom.window,doc=f.document;
 if(doc.readyState==='loading')await new Promise(r=>doc.addEventListener('DOMContentLoaded',r,{once:true}));
 new Script(fs.readFileSync(path.join(root,'cadastro.js'),'utf8')).runInContext(formDom.getInternalVMContext());doc.dispatchEvent(new f.Event('DOMContentLoaded'));
 const nf=doc.getElementById('nota-fiscal'),origens=doc.querySelectorAll('[name="origem_sem_nota"]');nf.value='NF-123456789012345';origens[0].click();assert.equal(nf.disabled,true);assert.equal(new f.FormData(doc.querySelector('form')).get('nota_fiscal'),null);assert.equal(origens[0].checked,true);origens[1].click();assert.equal(origens[0].checked,false);assert.equal(origens[1].checked,true);origens[1].click();assert.equal(nf.disabled,false);assert.equal(nf.required,true);assert.equal(nf.value,'NF-123456789012345');f.close();
});
test('Renovação e origem sem nota no banco isolado',{skip:!process.env.CADMIV_TEST_PGLITE},async()=>{
 const {PGlite}=require(process.env.CADMIV_TEST_PGLITE),pg=new PGlite();let tail=Promise.resolve();
 const connect=async()=>{const prev=tail;let release;tail=new Promise(r=>release=r);await prev;return {query:async(sql,args)=>args?pg.query(sql,args):(await pg.exec(sql)).at(-1),release};};
 const db={connect,query:async(sql,args)=>{const c=await connect();try{return await c.query(sql,args);}finally{c.release();}}};let server;
 try{
  await migrate(db);await migrate(db);server=createApp(db).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  async function req(url,body,cookie,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'X-CADMIV':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});return {status:r.status,data:await r.text(),location:r.headers.get('location'),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  assert.equal((await req('/api/me/renovacao')).status,401);
  const p={...fixture(80),nota_fiscal:'',origem_sem_nota:'doacao'},created=await req('/api/cadastros',p);assert.equal(created.status,201,created.data);const cookie=created.cookie;
  let me=JSON.parse((await req('/api/me',null,cookie)).data);const original=me.criado_em;
  assert.equal(me.origem_sem_nota,'doacao');assert.equal(me.nota_fiscal,'');assert.equal(me.valido_ate,null);
  assert.equal((await req('/api/me',{telefone:p.telefone,senha_atual:p.senha},cookie,'PATCH')).status,200);
  assert.equal((await req('/api/me',{origem_sem_nota:'presente',senha_atual:p.senha},cookie,'PATCH')).status,400);
  await db.query("UPDATE cadmiv_veiculos SET status='ATIVO',ativado_em='2020-01-01T12:00:00Z'");
  const login=await req('/api/login',{telefone:p.telefone,senha:p.senha});assert.equal(JSON.parse(login.data).renovar,true);
  for(const page of ['botao.html','cartao.html','validar.html']){const r=await req('/'+page,null,cookie);assert.equal(r.status,302);assert.equal(r.location,'/login.html?renovar=1');}
  assert.equal((await req('/api/me/qr',null,cookie)).status,403);
  assert.equal(JSON.parse((await req('/api/consultar',{chassi:p.chassi})).data).status,'ADORMECIDO');
  assert.equal((await req('/api/me/renovacao',{pago:true},cookie)).status,409);
  assert.equal((await req('/api/me',{renovado_em:new Date().toISOString(),senha_atual:p.senha},cookie,'PATCH')).status,400);
  assert.equal(JSON.parse((await req('/api/me',null,cookie)).data).criado_em,original);
  // Simula SOMENTE NO BANCO ISOLADO o dado que futuramente virá do provedor confirmado.
  const paid=new Date().toISOString();await db.query("UPDATE cadmiv_veiculos SET renovado_em=$1,status='ATIVO'",[paid]);
  const renewed=JSON.parse((await req('/api/me/renovacao',null,cookie)).data);assert.equal(renewed.renovacao_confirmada,true);assert.equal(renewed.pagamento_disponivel,false);assert.equal(renewed.valido_ate,umAnoApos(paid));
  assert.equal((await req('/cartao.html',null,cookie)).status,200);assert.equal((await req('/api/me/qr',null,cookie)).status,200);
  assert.equal(JSON.parse((await req('/api/me',null,cookie)).data).criado_em,original);
  await db.query("UPDATE cadmiv_veiculos SET status='ROUBO',renovado_em='2020-01-01T12:00:00Z'");
  assert.equal(JSON.parse((await req('/api/consultar',{chassi:p.chassi})).data).status,'ROUBO');
  assert.equal(JSON.parse((await req('/api/me/renovacao',null,cookie)).data).renovacao_confirmada,false);
  assert.equal((await req('/api/cadastros',{...fixture(81),chassi:p.chassi})).status,409);
  await migrate(db);assert.equal(JSON.parse((await req('/api/me',null,cookie)).data).criado_em,original);
 }finally{if(server)await new Promise(r=>server.close(r));await pg.close();}
});
