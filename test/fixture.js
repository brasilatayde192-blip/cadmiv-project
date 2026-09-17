module.exports=function fixture(n=1){
 const base=String(123456780+n).padStart(9,'0');let digits=base;
 for(let len=9;len<=10;len++){let sum=0;for(let i=0;i<len;i++)sum+=Number(digits[i])*(len+1-i);digits+=(sum*10%11)%10;}
 return {nome:'Cliente Teste '+n,cpf:digits,telefone:'119'+String(n).padStart(8,'0'),email:'teste'+n+'@example.invalid',nascimento:'1990-01-01',senha:'senha-de-teste-longa',marca:'Marca Teste',modelo:'patinete',chassi:'TESTE-'+n,cor:'Azul',nota_fiscal:'NF-TESTE',ano:'2025',estado_conservacao:'novo',cadastro_anterior:'Não',combo:'1',cep:'01001000',logradouro:'Rua Teste',numero:'1',bairro:'Teste',cidade:'Teste',uf:'SP',contato_emergencia:'amigo',telefone_emergencia:'11900000000',latex:'nao',medicamentos:'Nenhuma'};
};
