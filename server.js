const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Permite que o motor leia todos os arquivos da pasta
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Rota principal (Cartão de boas-vindas)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Liga as páginas de forma automática
app.get('/:pagina', (req, res) => {
    const pagina = req.params.pagina;
    res.sendFile(path.join(__dirname, pagina));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
