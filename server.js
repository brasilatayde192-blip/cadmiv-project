const express = require('express');
const path = require('path');
const app = express();

// A Render exige que a porta seja lida dinamicamente do servidor deles
const PORT = process.env.PORT || 10000; 

// Servir os arquivos diretamente na raiz do projeto
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// BANCO DE DADOS SIMULADO DO CADMIV PARA TESTES DE STATUS
const bancoCredenciais = {
    "CAD-112233-BR": { status: "REGULAR", mensagem: "✓ CREDENCIAL REGULAR E ATIVA NO SISTEMA NACIONAL" },
    "CAD-445566-BR": { status: "ROUBO", mensagem: "⚠️ ALERTA: CREDENCIAL BLOQUEADA POR MOTIVO DE ROUBO/FURTO" },
    "CAD-778899-BR": { status: "ADORMECIDO", mensagem: "💤 STATUS: CREDENCIAL ADORMECIDA / AGUARDANDO ATUALIZAÇÃO" }
};

// Rota para a página de Boas-Vindas (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para a página de Validação Corporativa (validar.html)
app.get('/validar', (req, res) => {
    res.sendFile(path.join(__dirname, 'validar.html'));
});

// Rota inteligente que processa a consulta enviada pela página de validação
app.post('/api/consultar', (req, res) => {
    const codigoDigitado = req.body.codigo;
    
    if (bancoCredenciais[codigoDigitado]) {
        res.json(bancoCredenciais[codigoDigitado]);
    } else {
        res.json({ status: "INVALIDO", mensagem: "❌ ERRO: CÓDIGO NÃO ENCONTRADO OU INVÁLIDO NO CADMIV" });
    }
});

// Inicialização do Servidor do CADMIV na Nuvem Gratuita
app.listen(PORT, '0.0.0.0', () => {
    console.log(`==================================================`);
    console.log(`   SISTEMA NACIONAL CADMIV ATIVO E BLINDADO       `);
    console.log(`   Rodando com sucesso na nuvem mundial!         `);
    console.log(`==================================================`);
});