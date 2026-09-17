'use strict';
async function apiCadastro(path,body){
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CADMIV':'1'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível salvar.');return data;
}
function gerenciarCombo(){
 const count=Number(document.querySelector('[name="combo"]:checked')?.value||1)-1;
 for(let i=1;i<=2;i++){
  const block=document.getElementById('dep'+i),active=i<=count;
  block.style.display=active?'block':'none';
  block.querySelectorAll('input,select').forEach(el=>{el.disabled=!active;el.required=active;});
 }
 document.getElementById('secao-responsabilidade').style.display=count?'block':'none';
 document.getElementById('responsabilidade').disabled=!count;
 document.getElementById('responsabilidade').required=!!count;
}
function forcarAberturaDependentes(){gerenciarCombo();}
function verificarIdadeCompleta(){return true;}
function mascaraCPF(el){
 const v=el.value.replace(/\D/g,'').slice(0,11);
 el.value=v.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4');
}
function verificarContestacaoVeiculo(){
 const el=document.getElementById('cadastro_anterior');el.setCustomValidity(el.value==='Sim'?'Procure o suporte para transferência do cadastro existente.':'');
}
let chassiRequest=0;
async function verificarChassiCadastrado(){
 const input=document.getElementById('chassi_veiculo'),message=document.getElementById('alerta-trava');
 const value=input.value,request=++chassiRequest;input.setCustomValidity('');
 if(!value.trim()){message.style.display='none';return;}
 try{
  const d=await apiCadastro('/api/chassi/verificar',{chassi:value});
  if(request!==chassiRequest||input.value!==value)return;
  message.style.display=d.cadastrado?'block':'none';
  message.textContent='Este chassi já está cadastrado. Use o acesso de cliente cadastrado ou procure o suporte.';
  input.setCustomValidity(d.cadastrado?'Chassi já cadastrado.':'');
 }catch(e){if(request===chassiRequest){message.style.display='block';message.textContent='Não foi possível verificar agora. A conferência será repetida ao salvar.';}}
}
document.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('data_emissao').value=new Date().toLocaleDateString('pt-BR');
 document.getElementById('cadmiv_ano').max=new Date().getFullYear();
 document.getElementById('chassi_veiculo').addEventListener('input',e=>{chassiRequest++;e.target.setCustomValidity('');document.getElementById('alerta-trava').style.display='none';});
 gerenciarCombo();
 const form=document.getElementById('form-cadastro');let saving=false;
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(saving||!form.reportValidity())return;
  const b=Object.fromEntries(new FormData(form));
  b.nascimento=document.getElementById('cadmiv_ano').value+'-'+document.getElementById('nasc_mes').value.padStart(2,'0')+'-'+document.getElementById('nasc_dia').value.padStart(2,'0');
  b.responsabilidade=document.getElementById('responsabilidade').checked&&!document.getElementById('responsabilidade').disabled;
  const message=document.getElementById('mensagem-cadastro');saving=true;
  form.querySelectorAll('[type="submit"]').forEach(el=>el.disabled=true);message.textContent='Salvando cadastro...';
  try{await apiCadastro('/api/cadastros',b);window.location.assign('validar.html');}
  catch(err){message.textContent=err.message;message.scrollIntoView({block:'center'});}
  finally{saving=false;form.querySelectorAll('[type="submit"]').forEach(el=>el.disabled=false);}
 });
});
