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
 let server,base,app;const emails=[];let mailFails=false;
 async function launch(){app=createApp(db,{sendResetEmail:async mail=>{if(mailFails)throw Error('simulado');emails.push(mail);}});server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;}
 async function request(route,body,cookie,method){const r=await fetch(base+route,{method:body===undefined?'GET':method||'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json','X-CADMIV':'1'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});return {status:r.status,body:await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
 let cookie,codigo;
 try{
  await migrate(db);await migrate(db);await launch();
  await t.test('Arquivos internos e painel não são públicos',async()=>{for(const p of ['/server.js','/schema.sql','/package.json','/.env','/node.js'])assert.equal((await request(p)).status,404);assert.equal((await request('/painel.html')).status,403);assert.equal((await request('/cartao.html')).status,302);assert.equal((await request('/api/me')).status,401);});
  await t.test('Cadastro salva e retorna sessão HttpOnly',async()=>{const r=await request('/api/cadastros',fixture());assert.equal(r.status,201,r.body);cookie=r.cookie;codigo=JSON.parse(r.body).codigo;assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);assert.equal(JSON.parse(r.body).status,'PENDENTE');});
  await t.test('QR individual exige sessão e contém somente link de consulta',async()=>{
   assert.equal((await request('/api/me/qr')).status,401);
   const r=await request('/api/me/qr',undefined,cookie);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/svg/);
   const expected=await require('qrcode').toString('http://localhost:10000/fiscalizacao.html#codigo='+codigo,{type:'svg',margin:4,errorCorrectionLevel:'M'});assert.equal(r.body,expected);
   const card=await request('/cartao.html',undefined,cookie);assert.ok(!card.body.includes('caixa_cpf_real'));assert.ok(card.body.includes('qr-veiculo'));
  });
  await t.test('Marca vazia recusada antes de gravar',async()=>assert.equal((await request('/api/cadastros',{...fixture(2),marca:''})).status,400));
  await t.test('Chassi duplicado normalizado e transação sem cliente órfão',async()=>{const r=await request('/api/cadastros',{...fixture(2),chassi:' te.st/e 1 '});assert.equal(r.status,409,r.body);assert.match(r.body,/chassi/);assert.equal((await db.query('SELECT count(*)::integer AS n FROM cadmiv_clientes')).rows[0].n,1);});
  await t.test('UNIQUE impede gravação direta com variante do chassi',async()=>{await db.query(`INSERT INTO cadmiv_clientes(id,nome,cpf,telefone,email,nascimento,senha_hash) SELECT '00000000-0000-4000-8000-000000000098',nome,'12345678999','11911112222',email,nascimento,senha_hash FROM cadmiv_clientes LIMIT 1`);await assert.rejects(db.query(`INSERT INTO cadmiv_veiculos(id,cliente_id,codigo,chassi,marca,modelo,cor,nota_fiscal,ano,estado_conservacao,combo) SELECT '00000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000098','outro','t.e-s t/e1',marca,modelo,cor,nota_fiscal,ano,estado_conservacao,combo FROM cadmiv_veiculos LIMIT 1`),e=>e.code==='23505' && e.constraint==='cadmiv_veiculos_chassi_unique');await db.query("DELETE FROM cadmiv_clientes WHERE id='00000000-0000-4000-8000-000000000098'");});
  await t.test('Consulta pública não expõe dados pessoais',async()=>{for(const b of [{chassi:'teste-1'},{codigo}]){const r=await request('/api/consultar',b),d=JSON.parse(r.body);assert.deepEqual(Object.keys(d).sort(),['chassi','cor','marca','mensagem','modelo','status']);assert.equal(d.status,'PENDENTE');assert.equal(d.marca,'Marca Teste');assert.ok(!r.body.includes(fixture().cpf));}assert.equal(JSON.parse((await request('/api/consultar',{chassi:'inexistente'})).body).status,'INVALIDO');});
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
  await t.test('Fotos do titular e dependentes são privadas, persistentes e validadas',async()=>{
   const sharp=require('sharp');const imagem=await sharp({create:{width:700,height:900,channels:3,background:'#269655'}}).png().toBuffer();
   const foto='data:image/png;base64,'+imagem.toString('base64');
   const pessoa={...fixture(9),combo:'3',dep1_nome:'Dependente Um',dep1_parentesco:'Filho',dep2_nome:'Dependente Dois',dep2_parentesco:'Filho',responsabilidade:true};
   const registrado=await request('/api/cadastros',pessoa);assert.equal(registrado.status,201,registrado.body);const dono=registrado.cookie;
   assert.equal((await request('/api/me/foto',{posicao:0,foto})).status,401);
   for(const posicao of [0,1,2])assert.equal((await request('/api/me/foto',{posicao,foto},dono)).status,200);
   assert.equal((await request('/api/me/foto',{posicao:3,foto},dono)).status,400);
   assert.equal((await request('/api/me/foto',{posicao:0,foto:'data:image/png;base64,bmFvIGltYWdlbQ=='},dono)).status,400);
   assert.equal((await request('/api/me/foto/0')).status,401);
   const other=await request('/api/cadastros',fixture(10));assert.equal(other.status,201);
   assert.equal((await request('/api/me/foto/0',undefined,other.cookie)).status,404);
   assert.equal((await request('/api/me/foto',{posicao:1,foto},other.cookie)).status,400);
   await new Promise(r=>server.close(r));await launch();
   const response=await fetch(base+'/api/me/foto/2',{headers:{Cookie:dono}});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/jpeg/);
   const meta=await sharp(Buffer.from(await response.arrayBuffer())).metadata();assert.ok(meta.width<=480&&meta.height<=640);assert.equal(meta.exif,undefined);
   const pub=JSON.parse((await request('/api/consultar',{chassi:pessoa.chassi})).body);assert.deepEqual(Object.keys(pub).sort(),['chassi','cor','marca','mensagem','modelo','status']);
   assert.equal((await request('/api/me/foto',{posicao:2,foto:null},dono)).status,200);assert.equal((await request('/api/me/foto/2',undefined,dono)).status,404);
  });
  await t.test('Recuperação usa link único, expira e encerra sessões antigas',async()=>{
   await db.query('DELETE FROM cadmiv_limites');
   const person=fixture(8),registered=await request('/api/cadastros',person),oldCookie=registered.cookie;
   assert.equal(registered.status,201);
   const ask=async body=>{const r=await request('/api/senha/solicitar',body);await Promise.all([...app.locals.resetTasks]);return r;};
   const a=await ask({telefone:person.telefone,email:person.email});
   const b=await ask({telefone:'11999990000',email:'ausente@example.com'});
   const c=await ask({telefone:person.telefone,email:'diferente@example.com'});
   assert.equal(a.status,202);assert.equal(a.body,b.body);assert.equal(a.body,c.body);assert.equal(emails.length,1);
   const token=new URLSearchParams(new URL(emails[0].url).hash.slice(1)).get('token');
   assert.match(token,/^[a-f0-9]{64}$/);assert.ok(!a.body.includes(token));
   const stored=(await db.query('SELECT token_hash FROM cadmiv_recuperacoes')).rows;assert.equal(stored.length,1);assert.notEqual(stored[0].token_hash,token);
   assert.equal((await request('/api/senha/redefinir',{token,senha:'curta'})).status,400);
   const changed=await Promise.all([request('/api/senha/redefinir',{token,senha:'NovaSenhaTeste123!'}),request('/api/senha/redefinir',{token,senha:'NovaSenhaTeste123!'})]);
   assert.deepEqual(changed.map(r=>r.status).sort(),[200,400]);
   assert.equal((await request('/api/me',undefined,oldCookie)).status,401);
   assert.equal((await request('/api/login',{telefone:person.telefone,senha:person.senha})).status,401);
   assert.equal((await request('/api/login',{telefone:person.telefone,senha:'NovaSenhaTeste123!'})).status,200);
   await db.query('DELETE FROM cadmiv_limites');await ask({telefone:person.telefone,email:person.email});
   const expired=new URLSearchParams(new URL(emails.at(-1).url).hash.slice(1)).get('token');
   await db.query("UPDATE cadmiv_recuperacoes SET expira=now()-interval '1 minute'");
   assert.equal((await request('/api/senha/redefinir',{token:expired,senha:'OutraSenhaTeste123!'})).status,400);
   assert.equal((await request('/api/senha/redefinir',{token:'0'.repeat(64),senha:'OutraSenhaTeste123!'})).status,400);
  });
  await t.test('Recuperação limita envios e remove links após falha no provedor',async()=>{
   await db.query('DELETE FROM cadmiv_limites');await db.query('DELETE FROM cadmiv_recuperacoes');
   const p=fixture(8),body={telefone:p.telefone,email:p.email},before=emails.length;
   for(let i=0;i<4;i++){assert.equal((await request('/api/senha/solicitar',body)).status,202);await Promise.all([...app.locals.resetTasks]);}
   assert.equal(emails.length-before,3);
   await db.query('DELETE FROM cadmiv_limites');await db.query('DELETE FROM cadmiv_recuperacoes');mailFails=true;
   assert.equal((await request('/api/senha/solicitar',body)).status,202);await Promise.all([...app.locals.resetTasks]);mailFails=false;
   assert.equal((await db.query('SELECT * FROM cadmiv_recuperacoes')).rows.length,0);
  });
  await t.test('Limitação de tentativas funciona',async()=>{let r;for(let i=0;i<22;i++)r=await request('/api/login',{telefone:'11999999999',senha:'errada'});assert.equal(r.status,429);});
 }finally{if(server)await new Promise(r=>server.close(r));await close();}
});
