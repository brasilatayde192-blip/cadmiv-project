const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const enabled=process.env.CADMIV_TEST_JSDOM;
test('Cartões: seleção, fotos privadas, falhas e câmera encerrada',{skip:!enabled},async()=>{
 const {JSDOM}=require(enabled),root=path.join(__dirname,'..');
 const dom=new JSDOM(fs.readFileSync(path.join(root,'cartao.html'),'utf8'),{url:'http://localhost/cartao.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 const tick=()=>new Promise(r=>setTimeout(r,10));let photoFailure=false,printed=0,posts=[];
 w.URL.createObjectURL=()=> 'blob:teste';w.URL.revokeObjectURL=()=>{};w.HTMLImageElement.prototype.decode=async()=>{};d.fonts={ready:Promise.resolve()};w.print=()=>printed++;
 w.fetch=async()=>photoFailure?{ok:false,status:500}:{ok:false,status:404};
 w.api=async(url,body)=>{posts.push({url,body});return {ok:true};};
 new (require('node:vm').Script)(fs.readFileSync(path.join(root,'cartao.js'),'utf8')).runInContext(dom.getInternalVMContext());
 w.iniciarCartoes({nome:'Titular',dependentes:[{nome:'Dependente um'},{nome:'Dependente dois'}]});await tick();
 assert.equal(d.getElementById('pessoa-cartao').options.length,3);
 const select=d.getElementById('pessoa-cartao');select.value='2';select.dispatchEvent(new w.Event('change'));await tick();
 assert.equal(d.getElementById('caixa_nome_real').textContent,'Dependente dois');
 d.getElementById('remover-foto').click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(posts.at(-1).body)),{posicao:2,foto:null});
 const qr=d.getElementById('qr-veiculo');qr.src='/api/me/qr';qr.hidden=false;d.getElementById('imprimir-cartao').click();await tick();assert.equal(printed,1);
 photoFailure=true;select.value='1';select.dispatchEvent(new w.Event('change'));await tick();assert.equal(d.getElementById('imprimir-cartao').disabled,true);
 d.getElementById('remover-foto').click();await tick();assert.equal(d.getElementById('imprimir-cartao').disabled,true);assert.match(d.getElementById('mensagem-foto').textContent,/carregar a foto/);
 let resolveCamera,stopped=0;Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:()=>new Promise(r=>resolveCamera=r)}});
 d.getElementById('abrir-camera').click();select.value='0';select.dispatchEvent(new w.Event('change'));resolveCamera({getTracks:()=>[{stop:()=>stopped++}]});await tick();
 assert.equal(stopped,1);assert.equal(d.getElementById('camera-foto').hidden,true);
 dom.window.close();
});

