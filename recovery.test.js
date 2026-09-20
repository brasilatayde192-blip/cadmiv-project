const test=require('node:test');const assert=require('node:assert/strict');
const {createResetMailer}=require('../email');
test('E-mail de recuperação exige configuração e envia somente link pelo provedor HTTPS',async()=>{
 assert.equal(createResetMailer({}),null);let sent;
 const mail=createResetMailer({RESEND_API_KEY:'chave-de-teste',MAIL_FROM:'CADMIV <teste@example.com>'},async(url,options)=>{sent={url,options};return {ok:true};});
 await mail({to:'destino@example.com',url:'https://cadmiv.example/redefinir-senha.html#token=teste'});
 assert.equal(sent.url,'https://api.resend.com/emails');
 const body=JSON.parse(sent.options.body);assert.deepEqual(body.to,['destino@example.com']);assert.match(body.text,/30 minutos/);assert.match(body.text,/#token=teste/);
 const failure=createResetMailer({RESEND_API_KEY:'teste',MAIL_FROM:'teste@example.com'},async()=>({ok:false}));
 await assert.rejects(failure({to:'a@example.com',url:'https://example.com'}),/EMAIL_DELIVERY_FAILED/);
});
test('Tela de nova senha não envia confirmação divergente e remove token do endereço',{skip:!process.env.CADMIV_TEST_JSDOM},async()=>{
 const {JSDOM}=require(process.env.CADMIV_TEST_JSDOM),fs=require('fs'),path=require('path'),vm=require('vm');
 const root=path.join(__dirname,'..'),token='a'.repeat(64);
 const dom=new JSDOM(fs.readFileSync(path.join(root,'redefinir-senha.html'),'utf8'),{url:'https://example.test/redefinir-senha.html#token='+token,runScripts:'outside-only'}),w=dom.window,d=w.document;
 if(d.readyState==='loading')await new Promise(r=>d.addEventListener('DOMContentLoaded',r,{once:true}));
 const calls=[];w.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({mensagem:'Senha alterada.'})};};
 new vm.Script(fs.readFileSync(path.join(root,'senha.js'),'utf8')).runInContext(dom.getInternalVMContext());d.dispatchEvent(new w.Event('DOMContentLoaded'));
 assert.equal(w.location.hash,'');const form=d.querySelector('form');d.getElementById('senha').value='MinhaNovaSenha123';d.getElementById('confirmacao').value='OutraNovaSenha123';
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(calls.length,0);assert.match(d.getElementById('mensagem').textContent,/iguais/);
 d.getElementById('confirmacao').value='MinhaNovaSenha123';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));
 assert.equal(calls[0].body.token,token);assert.equal(calls[0].body.confirmacao,undefined);assert.equal(form.hidden,true);assert.equal(d.getElementById('entrar').hidden,false);w.close();
});
