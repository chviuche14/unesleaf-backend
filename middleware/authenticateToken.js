const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    if (req.method === "OPTIONS") return res.sendStatus(204);

    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (!token || !/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ error: "Token requerido (Bearer <token>)" });
    }

    const SECRET = process.env.JWT_SECRET;
    if (!SECRET) {
        console.error("[AUTH] Falta JWT_SECRET en variables de entorno");
        return res.status(500).json({ error: "Configuración JWT ausente" });
    }

    try {
        req.user = jwt.verify(token, SECRET, { algorithms: ["HS256"], clockTolerance: 5 });
        return next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token expirado" });
        }
        return res.status(401).json({ error: "Token inválido" });
    }
}

module.exports = authenticateToken;
