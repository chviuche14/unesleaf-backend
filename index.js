// index.js
require('dotenv').config(); // Carga las variables de .env
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const layerRoutes = require('./routes/layers');
const registrosRoutes = require('./routes/registros'); // 👈 NUEVO

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
// en index.js, antes de app.use('/api/auth', authRoutes)
const morgan = require('morgan');
app.use(morgan('dev'));
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/auth')) {
    console.log('AUTH BODY =>', req.method, req.path, req.body);
  }
  next();
});


// --- Rutas ---
app.get('/', (req, res) => {
  res.send('API de UnesLeaf Backend está funcionando!');
});

app.use('/api/auth', authRoutes);
app.use('/api/layers', layerRoutes);
app.use('/api/registros', registrosRoutes); // 👈 NUEVO

// --- Iniciar Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
