'use strict';
const dinheiro=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)/100);
let carregando=false,precosInicializados=false;
function linhas(id,rows){const body=document.getElementById(id);body.replaceChildren();for(const cells of rows){const tr=document.createElement('tr');for(const value of cells){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}}
async function atualizar(){
 if(carregando)return;carregando=true;
 try{
  const r=await fetch('/api/admin/financeiro',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível carregar.');
  document.getElementById('hoje-total').textContent=d.hoje;
  document.getElementById('mes-total').textContent=d.mes;
  document.getElementById('receita-total').textContent=dinheiro(d.receita);
  document.getElementById('pix-aviso').textContent=d.pix_disponivel
   ?'Os recebimentos aparecem após a confirmação pela Efí.'
   :'As cobranças Pix estão desativadas neste servidor.';
  linhas('planos',d.planos.map(p=>{const venda=d.por_plano.find(v=>v.plano===p.id);return [p.nome,dinheiro(p.centavos),venda?.quantidade||0,dinheiro(venda?.centavos||0)];}));
  linhas('estados',d.por_uf.length?d.por_uf.map(u=>[u.uf,u.quantidade,(100*u.quantidade/d.mes).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%']):[['Sem recebimentos neste mês','0','—']]);
  if(!precosInicializados){for(const p of d.planos)document.getElementById('preco'+p.id).value=(p.centavos/100).toFixed(2).replace('.',',');precosInicializados=true;}
  document.getElementById('estado').textContent='Atualizado em '+new Date(d.atualizado_em).toLocaleString('pt-BR',{timeZone:d.fuso})+' (Brasília).';
 }catch(e){document.getElementById('estado').textContent=e.message+' Os números anteriores, se exibidos, não foram atualizados.';}finally{carregando=false;}
}
document.getElementById('precos').addEventListener('submit',async e=>{
 e.preventDefault();const message=document.getElementById('precos-estado'),button=e.target.querySelector('button');
 try{
  const centavos=[1,2,3].map(i=>{const value=document.getElementById('preco'+i).value.trim();if(!/^\d{1,7}([,.]\d{1,2})?$/.test(value))throw Error('Use apenas o valor, como 24,99.');const n=Math.round(Number(value.replace(',','.'))*100);if(n<1||n>100000000)throw Error('Confira os preços.');return n;});
  button.disabled=true;const r=await fetch('/api/admin/planos',{method:'PUT',headers:{'Content-Type':'application/json','X-CADMIV':'1'},body:JSON.stringify({centavos})});const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível salvar.');message.textContent='Preços atualizados no cadastro e no painel. Recebimentos anteriores preservados.';await atualizar();
 }catch(e){message.textContent=e.message;}finally{button.disabled=false;}
});
document.getElementById('atualizar').addEventListener('click',atualizar);atualizar();setInterval(()=>{if(!document.hidden)atualizar();},30000);
