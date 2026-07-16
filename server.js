const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Este comando força o motor a entregar QUALQUER arquivo da pasta automaticamente
app.use(express.static(__dirname));

// Rota para o Cartão de Boas-Vindas principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor CADMIV rodando na porta ${PORT}`);
});
