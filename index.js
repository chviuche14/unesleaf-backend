// index.js
require('dotenv').config(); // Carga las variables de .env
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const layerRoutes = require('./routes/layers');

const app = express();
const PORT = process.env.PORT || 5001;


app.use(cors());
app.use(express.json());

// --- Rutas ---
app.get('/', (req, res) => {
    res.send('API de UnesLeaf Backend está funcionando!');
});

app.use('/api/auth', authRoutes);
app.use('/api/layers', layerRoutes);

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});