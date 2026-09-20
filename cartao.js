'use strict';
let dadosCartoes=null,cartaoInicializado=false,photoVersion=0,fotoCarregando=false,fotoErro=false;
const ce=id=>document.getElementById(id);
async function mostrarFoto(){
 const version=++photoVersion;fotoCarregando=true;fotoErro=false;ce('imprimir-cartao').disabled=true;
 const img=ce('foto-pessoa');img.hidden=true;img.removeAttribute('src');ce('sem-foto').hidden=false;ce('sem-foto').textContent='Sem foto';
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
 const i=Number(ce('pessoa-cartao').value);ce('mensagem-foto').textContent='';
 ce('caixa_nome_real').textContent=i===0?dadosCartoes.nome:dadosCartoes.dependentes[i-1].nome;
 ce('tipo-cartao').textContent=i===0?'Titular':'Dependente '+i;mostrarFoto();
}
function iniciarCartoes(d){
 dadosCartoes=d;const select=ce('pessoa-cartao');if(!select)return;
 select.replaceChildren();[d.nome,...d.dependentes.map(p=>p.nome)].forEach((name,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i===0?'Titular':'Dependente '+i)+' — '+name;select.append(o);});select.disabled=false;
 if(!cartaoInicializado){
  cartaoInicializado=true;select.addEventListener('change',selecionarCartao);
  ce('imprimir-cartao').addEventListener('click',async()=>{
   if(fotoCarregando||fotoErro)return;
   try{const qr=ce('qr-veiculo');if(qr.hidden||!qr.src)throw Error();await qr.decode();if(!ce('foto-pessoa').hidden)await ce('foto-pessoa').decode();await document.fonts.ready;window.print();}catch{ce('mensagem-foto').textContent='Aguarde o carregamento do cartão e do QR-code antes de imprimir.';}
  });
 }
 selecionarCartao();
}
