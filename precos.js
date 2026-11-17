'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const labels=[...document.querySelectorAll('.price-label[data-plano]')];
 try{const r=await fetch('/api/planos',{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();for(const el of labels){const p=d.planos.find(p=>String(p.id)===el.dataset.plano);if(!p)throw Error();el.textContent='Valor: '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.centavos/100)+' (PIX)';}}
 catch{for(const el of labels)el.textContent='Preço indisponível. Atualize a página antes de contratar.';}
});
