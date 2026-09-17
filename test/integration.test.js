const test=require('node:test');const assert=require('node:assert/strict');const {Pool}=require('pg');
const {createApp,migrate}=require('../server');const fixture=require('./fixture');
const configured=process.env.CADMIV_TEST_DATABASE_URL||process.env.CADMIV_TEST_PGLITE;
test('Integração HTTP e PostgreSQL (banco isolado)',{skip:!configured},async t=>{
 let db,close;
 if(process.env.CADMIV_TEST_PGLITE){
  const {PGlite}=require(process.env.CADMIV_TEST_PGLITE);const pg=new PGlite();
  let tail=Promise.resolve();
  const connect=async()=>{const prev=tail;let release;tail=new Promise(r=>release=r);await prev;return {query:async(sql,args)=>args?pg.query(sql,args):(await pg.exec(sql)).at(-1),release};};
  db={connect,query:async(sql,args)=>{const c=await connect();try{return await c.query(sql,args);}finally{c.release();}}};close=()=>pg.close();
 }else{
  // Use somente um banco vazio reservado para testes, nunca o banco de produção.
  db=new Pool({connectionString:process.env.CADMIV_TEST_DATABASE_URL});close=()=>db.end();
  const {rows}=await db.query("SELECT to_regclass('cadmiv_clientes') AS existing");if(rows[0].existing){await close();throw Error('O banco de teste deve estar vazio.');}
 }
 let server,base;
 async function launch(){server=createApp(db).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;}
 async function request(route,body,cookie,method){const r=await fetch(base+route,{method:body===undefined?'GET':method||'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json','X-CADMIV':'1'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});return {status:r.status,body:await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
 let cookie,codigo;
 try{
  await migrate(db);await migrate(db);await launch();
  await t.test('Arquivos internos e painel não são públicos',async()=>{for(const p of ['/server.js','/schema.sql','/package.json','/.env','/node.js'])assert.equal((await request(p)).status,404);assert.equal((await request('/painel.html')).status,403);assert.equal((await request('/cartao.html')).status,302);assert.equal((await request('/api/me')).status,401);});
  await t.test('Cadastro salva e retorna sessão HttpOnly',async()=>{const r=await request('/api/cadastros',fixture());assert.equal(r.status,201,r.body);cookie=r.cookie;codigo=JSON.parse(r.body).codigo;assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);assert.equal(JSON.parse(r.body).status,'PENDENTE');});
  await t.test('Marca vazia recusada antes de gravar',async()=>assert.equal((await request('/api/cadastros',{...fixture(2),marca:''})).status,400));
  await t.test('Chassi duplicado normalizado e transação sem cliente órfão',async()=>{const r=await request('/api/cadastros',{...fixture(2),chassi:' te.st/e 1 '});assert.equal(r.status,409,r.body);assert.match(r.body,/chassi/);assert.equal((await db.query('SELECT count(*)::integer AS n FROM cadmiv_clientes')).rows[0].n,1);});
  await t.test('UNIQUE impede gravação direta com variante do chassi',async()=>{await db.query(`INSERT INTO cadmiv_clientes(id,nome,cpf,telefone,email,nascimento,senha_hash) SELECT '00000000-0000-4000-8000-000000000098',nome,'12345678999','11911112222',email,nascimento,senha_hash FROM cadmiv_clientes LIMIT 1`);await assert.rejects(db.query(`INSERT INTO cadmiv_veiculos(id,cliente_id,codigo,chassi,marca,modelo,cor,nota_fiscal,ano,estado_conservacao,combo) SELECT '00000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000098','outro','t.e-s t/e1',marca,modelo,cor,nota_fiscal,ano,estado_conservacao,combo FROM cadmiv_veiculos LIMIT 1`),e=>e.code==='23505' && e.constraint==='cadmiv_veiculos_chassi_unique');await db.query("DELETE FROM cadmiv_clientes WHERE id='00000000-0000-4000-8000-000000000098'");});
  await t.test('Consulta pública não expõe dados pessoais',async()=>{for(const b of [{chassi:'teste-1'},{codigo}]){const r=await request('/api/consultar',b),d=JSON.parse(r.body);assert.deepEqual(Object.keys(d).sort(),['cor','marca','mensagem','modelo','status']);assert.equal(d.status,'PENDENTE');assert.equal(d.marca,'Marca Teste');assert.ok(!r.body.includes(fixture().cpf));}assert.equal(JSON.parse((await request('/api/consultar',{chassi:'inexistente'})).body).status,'INVALIDO');});
  await t.test('Pré-consulta retorna somente existência',async()=>assert.deepEqual(JSON.parse((await request('/api/chassi/verificar',{chassi:'teste1'})).body),{cadastrado:true}));
  await t.test('Reinício do servidor mantém cadastro e sessão',async()=>{await new Promise(r=>server.close(r));await launch();const r=await request('/api/me',undefined,cookie);assert.equal(r.status,200,r.body);assert.equal(JSON.parse(r.body).cpf,fixture().cpf);});
  await t.test('Senha errada não permite login nem alerta',async()=>{assert.equal((await request('/api/login',{telefone:fixture().telefone,senha:'admin'})).status,401);assert.equal((await request('/api/alerta',{senha:'admin'},cookie)).status,401);assert.equal((await request('/api/alerta',{senha:fixture().senha})).status,401);});
  await t.test('Cadastro pendente não ativa alerta nem aceita status pelo cliente',async()=>{assert.equal((await request('/api/alerta',{senha:fixture().senha},cookie)).status,409);assert.equal((await request('/api/me',{status:'ATIVO'},cookie,'PATCH')).status,400);});
  await t.test('Login verdadeiro e isolamento entre clientes',async()=>{const b=fixture(3),r=await request('/api/cadastros',b);assert.equal(r.status,201,r.body);const me=JSON.parse((await request('/api/me',undefined,r.cookie)).body);assert.equal(me.nome,b.nome);assert.notEqual(me.cpf,fixture().cpf);const login=await request('/api/login',{telefone:b.telefone,senha:b.senha});assert.equal(login.status,200);});
  await t.test('Nome e CPF imutáveis; atualização de telefone real',async()=>{assert.equal((await request('/api/me',{nome:'Troca'},cookie,'PATCH')).status,400);assert.equal((await request('/api/me',{cpf:fixture(4).cpf},cookie,'PATCH')).status,400);assert.equal((await request('/api/me',{telefone:'11988887777'},cookie,'PATCH')).status,200);assert.equal(JSON.parse((await request('/api/me',undefined,cookie)).body).telefone,'11988887777');});
  await t.test('Alerta de cliente ativo persiste e consulta reflete status',async()=>{await db.query("UPDATE cadmiv_veiculos SET status='ATIVO' WHERE codigo=$1",[codigo]);assert.equal((await request('/api/alerta',{senha:fixture().senha},cookie)).status,200);assert.equal(JSON.parse((await request('/api/consultar',{codigo})).body).status,'ROUBO');});
  await t.test('Origem externa e postagem sem proteção rejeitadas',async()=>{for(const headers of [{'Content-Type':'application/json'},{'Content-Type':'application/json','X-CADMIV':'1',Origin:'https://outro.example'}]){const r=await fetch(base+'/api/login',{method:'POST',headers,body:'{}'});assert.equal(r.status,403);}});
  await t.test('Duas tentativas concorrentes resultam em um cadastro',async()=>{const results=await Promise.all([request('/api/cadastros',{...fixture(5),chassi:'CONCORRENTE'}),request('/api/cadastros',{...fixture(6),chassi:'con-cor rente'})]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);});
  await t.test('Logout invalida a sessão no banco',async()=>{assert.equal((await request('/api/logout',{},cookie)).status,200);assert.equal((await request('/api/me',undefined,cookie)).status,401);});
  await t.test('Limitação de tentativas funciona',async()=>{let r;for(let i=0;i<22;i++)r=await request('/api/login',{telefone:'11999999999',senha:'errada'});assert.equal(r.status,429);});
 }finally{if(server)await new Promise(r=>server.close(r));await close();}
});
