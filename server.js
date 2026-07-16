const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// O motor agora lê os arquivos na raiz e em subpastas automaticamente
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'CADMIV')));

// Abre o lindo Cartão de Boas-Vindas principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor CADMIV rodando com sucesso na porta ${PORT}`);
});
