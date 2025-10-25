const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { lng, lat, texto, tipo } = req.body;

        if (lng === undefined || lat === undefined) {
            return res.status(400).json({ error: 'lng y lat son obligatorios' });
        }
        const lon = Number(lng);
        const la  = Number(lat);
        if (!Number.isFinite(lon) || !Number.isFinite(la)) {
            return res.status(400).json({ error: 'lng/lat deben ser números' });
        }
        if (la < -90 || la > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: 'lng/lat fuera de rango' });
        }

        const usuarioId = Number(req.user?.id);
        if (!usuarioId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const insertSql = `
            INSERT INTO public.registros (usuario_id, geom, texto_busqueda, tipo)
            VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5)
                RETURNING id, creado_en;
        `;
        const { rows } = await db.query(insertSql, [
            usuarioId,
            lon,
            la,
            texto ?? null,
            tipo ?? null,
        ]);

        return res.status(201).json({
            ok: true,
            id: rows[0].id,
            creado_en: rows[0].creado_en,
        });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ error: 'usuario_id no existe en public.users' });
        }
        console.error('Error guardando registro:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});


router.get('/', authenticateToken, async (req, res) => {
    try {
        const usuarioId = Number(req.user?.id);
        if (!usuarioId) return res.status(401).json({ error: 'Usuario no autenticado' });

        const limit = Math.max(1, Math.min(parseInt(req.query.limit || '50', 10), 200));

        const sql = `
            SELECT
                r.id,
                u.username,
                r.texto_busqueda,
                r.tipo,
                r.creado_en,
                ST_X(r.geom) AS lng,
                ST_Y(r.geom) AS lat
            FROM public.registros r
                     JOIN public.users u ON u.id = r.usuario_id
            WHERE r.usuario_id = $1
            ORDER BY r.creado_en DESC
                LIMIT ${limit};
        `;
        const { rows } = await db.query(sql, [usuarioId]);
        return res.json({ items: rows });
    } catch (err) {
        console.error('Error listando registros:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
