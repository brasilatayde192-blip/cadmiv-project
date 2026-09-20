'use strict';
let dadosCartoes=null,cartaoInicializado=false,fotoPreparada=null,cameraStream=null,photoVersion=0,fotoCarregando=false,fotoErro=false,cameraVersion=0,selectionVersion=0;
const ce=id=>document.getElementById(id);
function fecharCamera(){cameraVersion++;if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;ce('camera-foto').srcObject=null;ce('camera-foto').hidden=true;ce('capturar-foto').hidden=true;ce('fechar-camera').hidden=true;}
function limparPrevia(){fotoPreparada=null;ce('previa-foto').hidden=true;ce('previa-foto').removeAttribute('src');ce('salvar-foto').disabled=true;ce('arquivo-foto').value='';}
async function mostrarFoto(){
 const version=++photoVersion;fotoCarregando=true;fotoErro=false;ce('imprimir-cartao').disabled=true;
 const img=ce('foto-pessoa');img.hidden=true;img.removeAttribute('src');ce('sem-foto').hidden=false;
 try{
  const response=await fetch('/api/me/foto/'+ce('pessoa-cartao').value,{cache:'no-store'});
  if(version!==photoVersion)return;
  if(response.status===404)return;
  if(!response.ok)throw Error('Não foi possível carregar a foto. Atualize a página antes de imprimir.');
  const url=URL.createObjectURL(await response.blob());
  try{const loaded=new Image();loaded.src=url;await loaded.decode();if(version!==photoVersion)return;img.src=url;img.hidden=false;ce('sem-foto').hidden=true;await img.decode();}finally{URL.revokeObjectURL(url);}
 }catch(e){if(version===photoVersion){fotoErro=true;ce('mensagem-foto').textContent=e.message;ce('sem-foto').textContent='Foto indisponível';}}
 finally{if(version===photoVersion){fotoCarregando=false;ce('imprimir-cartao').disabled=fotoErro;}}
}
function selecionarCartao(){
 selectionVersion++;const i=Number(ce('pessoa-cartao').value);fecharCamera();limparPrevia();ce('mensagem-foto').textContent='';
 ce('caixa_nome_real').textContent=i===0?dadosCartoes.nome:dadosCartoes.dependentes[i-1].nome;
 ce('tipo-cartao').textContent=i===0?'Titular':'Dependente '+i;ce('sem-foto').textContent='Sem foto';mostrarFoto();
}
function prepararCanvas(source,width,height){
 const scale=Math.min(1,480/width,640/height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);fotoPreparada=canvas.toDataURL('image/jpeg',.82);ce('previa-foto').src=fotoPreparada;ce('previa-foto').hidden=false;ce('salvar-foto').disabled=false;ce('mensagem-foto').textContent='Confira a prévia e clique em Salvar foto neste cartão.';
}
async function enviarFoto(remove=false){
 if(!remove&&!fotoPreparada)return;
 const posicao=Number(ce('pessoa-cartao').value),foto=remove?null:fotoPreparada;
 for(const id of ['salvar-foto','remover-foto','pessoa-cartao','arquivo-foto','abrir-camera','imprimir-cartao'])ce(id).disabled=true;
 ce('mensagem-foto').textContent='Salvando foto...';
 try{await api('/api/me/foto',{posicao,foto});limparPrevia();ce('sem-foto').textContent='Sem foto';await mostrarFoto();if(!fotoErro)ce('mensagem-foto').textContent=remove?'Foto removida.':'Foto salva neste cartão.';}
 catch(e){ce('mensagem-foto').textContent=e.message;}
 finally{for(const id of ['remover-foto','pessoa-cartao','arquivo-foto','abrir-camera','imprimir-cartao'])ce(id).disabled=false;ce('salvar-foto').disabled=!fotoPreparada;ce('imprimir-cartao').disabled=fotoErro||fotoCarregando;}
}
function iniciarCartoes(d){
 dadosCartoes=d;const select=ce('pessoa-cartao');if(!select)return;
 select.replaceChildren();[d.nome,...d.dependentes.map(p=>p.nome)].forEach((name,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i===0?'Titular':'Dependente '+i)+' — '+name;select.append(o);});select.disabled=false;
 if(!cartaoInicializado){
  cartaoInicializado=true;select.addEventListener('change',selecionarCartao);
  ce('arquivo-foto').addEventListener('change',async e=>{
   const file=e.target.files[0],person=selectionVersion;limparPrevia();if(!file)return;
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){ce('mensagem-foto').textContent='Escolha uma foto JPEG, PNG ou WebP de até 10 MB.';return;}
   const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(person===selectionVersion)prepararCanvas(img,img.naturalWidth,img.naturalHeight);}catch{ce('mensagem-foto').textContent='Não foi possível abrir a imagem. Escolha outra foto.';}finally{URL.revokeObjectURL(url);}
  });
  ce('abrir-camera').addEventListener('click',async()=>{
   if(!navigator.mediaDevices?.getUserMedia){ce('mensagem-foto').textContent='Câmera indisponível neste navegador. Use Escolher foto do arquivo.';return;}
   fecharCamera();const requestVersion=cameraVersion;try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});if(requestVersion!==cameraVersion){stream.getTracks().forEach(t=>t.stop());return;}cameraStream=stream;ce('camera-foto').srcObject=cameraStream;ce('camera-foto').hidden=false;ce('capturar-foto').hidden=false;ce('fechar-camera').hidden=false;ce('mensagem-foto').textContent='Posicione-se e clique em Capturar foto.';}catch{ce('mensagem-foto').textContent='Não foi possível acessar a câmera. Autorize o acesso no navegador ou escolha uma foto do arquivo.';}
  });
  ce('fechar-camera').addEventListener('click',fecharCamera);
  ce('capturar-foto').addEventListener('click',()=>{const v=ce('camera-foto');if(!v.videoWidth)return;prepararCanvas(v,v.videoWidth,v.videoHeight);fecharCamera();});
  ce('salvar-foto').addEventListener('click',()=>enviarFoto());ce('remover-foto').addEventListener('click',()=>enviarFoto(true));
  ce('imprimir-cartao').addEventListener('click',async()=>{
   if(fotoCarregando||fotoErro)return;
   if(fotoPreparada){ce('mensagem-foto').textContent='Salve a foto escolhida antes de imprimir.';return;}
   try{const qr=ce('qr-veiculo');if(qr.hidden||!qr.src)throw Error();await qr.decode();if(!ce('foto-pessoa').hidden)await ce('foto-pessoa').decode();await document.fonts.ready;window.print();}catch{ce('mensagem-foto').textContent='Aguarde o carregamento do cartão e do QR-code antes de imprimir.';}
  });
  window.addEventListener('pagehide',fecharCamera);
 }
 selecionarCartao();
}
