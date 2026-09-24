const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const enabled=process.env.CADMIV_TEST_JSDOM;
test('Formulário e telas no DOM do navegador',{skip:!enabled},async t=>{
 const {JSDOM}=require(enabled);const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost:10000/cadastro.html',runScripts:'outside-only'});const w=dom.window,d=w.document;
 let calls=[];w.fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return {ok:false,json:async()=>({erro:'Erro controlado para teste'})};};w.HTMLElement.prototype.scrollIntoView=()=>{};
 if(d.readyState==='loading')await new Promise(r=>d.addEventListener('DOMContentLoaded',r,{once:true}));new (require('node:vm').Script)(fs.readFileSync(path.join(root,'cadastro.js'),'utf8')).runInContext(dom.getInternalVMContext());d.dispatchEvent(new w.Event('DOMContentLoaded'));
 await t.test('Campos e dependentes pertencem ao formulário; IDs únicos',()=>{const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(ids.length,new Set(ids).size);for(const name of ['marca','nome','cpf','email','telefone','senha','modelo','chassi','dep1_nome','dep2_nome','responsabilidade'])assert.equal(d.querySelector('[name="'+name+'"]').form.id,'form-cadastro');assert.equal(d.querySelector('[name="marca"]').required,true);});
 await t.test('Troca de plano reativa obrigatoriedade dos dependentes',()=>{d.getElementById('combo3').checked=true;w.gerenciarCombo();assert.equal(d.querySelector('[name="dep2_nome"]').disabled,false);assert.equal(d.querySelector('[name="dep2_nome"]').required,true);d.getElementById('combo1').checked=true;w.gerenciarCombo();assert.equal(d.querySelector('[name="dep2_nome"]').disabled,true);assert.equal(d.getElementById('responsabilidade').required,false);});
 await t.test('Fotos no formulário: dependentes opcionais, seleção isolada e câmera interrompida',async()=>{
  d.getElementById('combo3').checked=true;w.gerenciarCombo();const box=d.querySelector('[data-foto="2"]'),file=box.querySelector('[data-arquivo]');assert.equal(file.required,false);assert.equal(file.disabled,false);
  w.URL.createObjectURL=()=> 'blob:teste';w.URL.revokeObjectURL=()=>{};w.HTMLImageElement.prototype.decode=async()=>{};w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,dGVzdGU=';
  Object.defineProperty(file,'files',{configurable:true,value:[new w.File(['x'],'teste.jpg',{type:'image/jpeg'})]});file.dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,15));assert.equal(w.obterFotosCadastro(3)[2],'data:image/jpeg;base64,dGVzdGU=');assert.equal(w.obterFotosCadastro(1).length,1);assert.equal(w.obterFotosCadastro(3)[0],null);
  let resolveCamera,stopped=0;Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:()=>new Promise(r=>resolveCamera=r)}});box.querySelector('[data-camera]').click();d.getElementById('combo1').checked=true;w.gerenciarCombo();resolveCamera({getTracks:()=>[{stop:()=>stopped++}]});await new Promise(r=>setTimeout(r,15));assert.equal(stopped,1);assert.equal(box.querySelector('[data-video]').hidden,true);assert.equal(file.disabled,true);
 });
 await t.test('Setas indicam todas as pendências e respeitam plano, nota fiscal e correção individual',async()=>{
  const form=d.getElementById('form-cadastro'),nome=d.querySelector('[name="nome"]'),email=d.querySelector('[name="email"]'),nota=d.getElementById('nota-fiscal');
  assert.equal(d.querySelectorAll('.seta-cadastro').length,0);
  assert.equal(form.reportValidity(),false);await new Promise(r=>setTimeout(r,0));
  for(const campo of form.querySelectorAll('input,select,textarea'))assert.equal(campo.classList.contains('campo-pendente'),campo.willValidate&&!campo.validity.valid);
  assert.ok(d.querySelectorAll('.seta-cadastro').length>5);assert.equal(nome.getAttribute('aria-invalid'),'true');
  nome.value='Cliente Teste';nome.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(nome.classList.contains('campo-pendente'),false);assert.equal(nome.previousElementSibling.querySelector('.seta-cadastro'),null);assert.equal(email.classList.contains('campo-pendente'),true);
  const origem=d.querySelector('[value="doacao"][name="origem_sem_nota"]');origem.checked=true;origem.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(nota.classList.contains('campo-pendente'),false);
  origem.checked=false;origem.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(nota.classList.contains('campo-pendente'),true);
  d.getElementById('combo3').checked=true;w.gerenciarCombo();d.getElementById('combo3').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.querySelector('[name="dep2_nome"]').classList.contains('campo-pendente'),true);
  d.getElementById('combo1').checked=true;w.gerenciarCombo();d.getElementById('combo1').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.querySelector('[name="dep2_nome"]').classList.contains('campo-pendente'),false);assert.equal(d.querySelector('[data-arquivo]').classList.contains('campo-pendente'),false);
 });
 await t.test('Envio inclui marca e campos certos, e mantém formulário após erro',async()=>{const fixture=require('./fixture')();for(const [key,value] of Object.entries(fixture)){const el=d.querySelector('[name="'+key+'"]');if(el && el.type!=='radio')el.value=value;}d.getElementById('nasc_dia').value='1';d.getElementById('nasc_mes').value='1';d.getElementById('cadmiv_ano').value='1990';d.getElementById('combo1').checked=true;d.querySelector('[name="nome"]').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(d.querySelectorAll('.seta-cadastro').length,0);assert.equal(d.getElementById('form-cadastro').checkValidity(),true);d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.equal(calls.at(-1).url,'/api/cadastros');assert.equal(calls.at(-1).body.marca,'Marca Teste');assert.equal(calls.at(-1).body.nome,fixture.nome);assert.equal(calls.at(-1).body.nascimento,'1990-01-01');assert.equal(d.getElementById('mensagem-cadastro').textContent,'Erro controlado para teste');assert.equal(d.getElementById('btn-enviar').disabled,false);});
 await t.test('Alerta vermelho mostra CPF inválido, recebe foco e desaparece ao corrigir',async()=>{
  const form=d.getElementById('form-cadastro'),message=d.getElementById('mensagem-cadastro'),cpf=d.querySelector('[name="cpf"]');
  let posts=0;w.fetch=async()=>{posts++;return {ok:false,json:async()=>({erro:'CPF inválido.'})};};
  cpf.value='111.111.111-11';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,25));
  assert.equal(posts,1);assert.equal(message.textContent,'CPF inválido.');assert.equal(message.classList.contains('alerta-cadastro'),true);assert.equal(message.getAttribute('role'),'alert');assert.equal(d.activeElement,message);assert.equal(d.getElementById('btn-enviar').disabled,false);
  cpf.value=require('./fixture')().cpf;cpf.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(message.textContent,'');assert.equal(message.classList.contains('alerta-cadastro'),false);
  w.mostrarMensagemCadastro('Salvando cadastro...');assert.equal(message.classList.contains('alerta-cadastro'),false);
 });
 await t.test('Campo obrigatório bloqueia envio e destaca o primeiro erro no topo',async()=>{
  const form=d.getElementById('form-cadastro'),nome=d.querySelector('[name="nome"]'),message=d.getElementById('mensagem-cadastro');
  nome.value='';assert.equal(form.reportValidity(),false);await new Promise(r=>setTimeout(r,0));assert.match(message.textContent,/Preencha este campo/);assert.equal(message.classList.contains('alerta-cadastro'),true);assert.equal(d.activeElement,message);
  nome.value='Cliente Teste';nome.dispatchEvent(new w.Event('input',{bubbles:true}));
 });
 await t.test('Chassi cadastrado bloqueia formulário com aviso visível, sem depender do envio',async()=>{
  const input=d.getElementById('chassi_veiculo'),message=d.getElementById('mensagem-cadastro');
  w.fetch=async()=>({ok:true,json:async()=>({cadastrado:true})});await w.verificarChassiCadastrado();assert.equal(input.validity.customError,true);
  input.reportValidity();await new Promise(r=>setTimeout(r,0));assert.match(message.textContent,/Não é permitido criar outro cadastro/);assert.equal(message.classList.contains('alerta-cadastro'),true);
  input.value='NOVO-CHASSI';input.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(input.validity.customError,false);assert.equal(message.textContent,'');
 });
 await t.test('Páginas não usam sucesso simulado ou armazenamento pessoal',()=>{for(const name of ['cadastro.html','validar.html','login.html','cartao.html','botao.html','alerta.html','fiscalizacao.html']){const content=fs.readFileSync(path.join(root,name),'utf8');assert.ok(!content.includes('localStorage.setItem'));assert.ok(!content.includes('Pagamento PIX confirmado'));assert.ok(!content.includes('shadowSenha'));const page=new JSDOM(content);for(const el of page.window.document.querySelectorAll('script[src]'))assert.ok(fs.existsSync(path.join(root,el.getAttribute('src'))));page.window.close();}});
 w.close();
});
