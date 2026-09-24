'use strict';
// HTTPS é compatível com Render Free; nunca registre a chave ou o link de recuperação.
function createResetMailer(env=process.env,send=fetch) {
 if(!env.RESEND_API_KEY || !env.MAIL_FROM)return null;
 return async({to,url})=>{
  const response=await send('https://api.resend.com/emails',{
   method:'POST',signal:AbortSignal.timeout(15000),
   headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject:'CADMIV — crie uma nova senha',
    text:'Recebemos um pedido para criar uma nova senha no CADMIV.\n\nAbra este link em até 30 minutos:\n'+url+'\n\nO link pode ser usado uma única vez. Se você não fez este pedido, ignore esta mensagem. Sua senha atual continua válida. Não compartilhe este link.'})
  });
  if(!response.ok)throw Error('EMAIL_DELIVERY_FAILED');
 };
}
module.exports={createResetMailer};
