require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const layersRoutes = require("./routes/layers");
const registrosRoutes = require("./routes/registros");

const app = express();

// --- CORS: habilita origen 5173 y 3000, Authorization y Content-Type ---
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://148.230.94.222"
];

app.use(cors({
    origin: function (origin, callback) {
        // permitir herramientas sin origin (curl, Postman) y orígenes listados
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Origen no permitido por CORS: " + origin));
    },
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // true si vas a usar cookies
}));

// Responder preflight explícitamente (por si algún middleware corta el flujo)
app.options("*", cors());

// Body parser
app.use(express.json());

// Rutas
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/layers", layersRoutes);
app.use("/api/registros", registrosRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}`);
});
