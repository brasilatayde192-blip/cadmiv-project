const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const enabled=process.env.CADMIV_TEST_JSDOM;
test('Formulário de edição carrega dados, bloqueia identidade e só exclui após confirmação',{skip:!enabled},async()=>{
 const {JSDOM}=require(enabled),root=path.join(__dirname,'..'),fixture=require('./fixture')(),dom=new JSDOM(fs.readFileSync(path.join(root,'cadastro.html'),'utf8'),{url:'http://localhost/cadastro.html?editar=1',runScripts:'outside-only'}),w=dom.window,d=w.document;
 if(d.readyState==='loading')await new Promise(r=>d.addEventListener('DOMContentLoaded',r,{once:true}));
 const data={...fixture,privado:fixture,dependentes:[],responsabilidade:false,combo:1,criado_em:'2026-09-18T12:00:00Z'},calls=[];w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,options)=>{if(!options?.method&&url==='/api/me')return {ok:true,json:async()=>data};if(url.startsWith('/api/me/foto/'))return {ok:false,status:404};calls.push({url,method:options.method,body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true})};};
 for(const name of ['cadastro.js','cadastro-edicao.js'])new vm.Script(fs.readFileSync(path.join(root,name),'utf8')).runInContext(dom.getInternalVMContext());
 d.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(r=>setTimeout(r,25));assert.equal(w.cadmivEdicao.pronto,true);
 const form=d.getElementById('form-cadastro');for(const key of ['nome','cpf','chassi','nota_fiscal'])assert.equal(form.querySelector('[name="'+key+'"]').readOnly,true);
 assert.equal(d.getElementById('data_emissao').value,'18/09/2026');assert.equal(d.getElementById('foto-titular').style.display,'block');assert.equal(d.getElementById('dep1').style.display,'none');
 form.querySelector('[name="nome"]').value='Tentativa de troca';form.querySelector('[name="logradouro"]').value='Rua Atualizada';d.getElementById('senha-atual-edicao').value=fixture.senha;
 assert.equal(form.checkValidity(),true);form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,25));assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/me');assert.equal(calls[0].method,'PATCH');assert.equal(calls[0].body.logradouro,'Rua Atualizada');for(const key of ['nome','cpf','chassi','nota_fiscal','combo','senha'])assert.equal(Object.hasOwn(calls[0].body,key),false);assert.deepEqual(calls[0].body.fotos,{});assert.match(d.getElementById('mensagem-cadastro').textContent,/Alterações salvas/);
 d.getElementById('abrir-exclusao').click();d.getElementById('executar-exclusao').click();await new Promise(r=>setTimeout(r,10));assert.equal(calls.length,1);d.getElementById('cancelar-exclusao').click();assert.equal(d.getElementById('confirmar-exclusao').open,false);
 d.getElementById('abrir-exclusao').click();d.getElementById('motivo-exclusao').value='venda';d.getElementById('senha-exclusao').value=fixture.senha;d.getElementById('texto-exclusao').value='EXCLUIR';d.getElementById('executar-exclusao').click();await new Promise(r=>setTimeout(r,10));assert.equal(calls[1].url,'/api/me/excluir');assert.match(d.querySelector('.container').textContent,/Cadastro excluído/);dom.window.close();
});
