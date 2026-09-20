'use strict';
const sharp=require('sharp');
async function prepararFoto(value){
 if(typeof value!=='string'||value.length>900000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))throw Error('Envie uma foto JPEG, PNG ou WebP de até 650 KB.');
 const data=Buffer.from(value.split(',')[1],'base64');
 try{
  const image=sharp(data,{limitInputPixels:16000000,failOn:'warning'}),meta=await image.metadata();
  if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages||1)>1)throw Error('Formato');
  const result=await image.rotate().resize(480,640,{fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:80}).toBuffer();
  if(result.length>200000)throw Error('Tamanho');return result;
 }catch{throw Error('Não foi possível ler a foto. Escolha outra imagem JPEG, PNG ou WebP.');}
}
module.exports={prepararFoto};
