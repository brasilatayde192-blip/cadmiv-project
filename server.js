const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Motor ultra inteligente: entrega qualquer arquivo HTML automaticamente, mesmo sem digitar .html no link!
app.use(express.static(__dirname, { extensions: ['html', 'htm'] }));
app.use(express.json());

// Rota principal para o Cartão de Boas-Vindas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor CADMIV rodando com sucesso na porta ${PORT}`);
});
