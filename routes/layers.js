const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/authenticateToken');

// Mapeo de capas/vistas -> tabla (o vista)
const layerMapping = {
    1: { table: 'sitios_unesco' },
    2: { table: 'ciudades_mundo' },
    3: { table: 'hidrografia_mundo' },
    4: { table: 'continentes' },
    5: { table: 'v_ciudades_buffer200_conteo' },      // Vistas
    6: { table: 'v_unesco_continentes_conteo' },
};

// Lista para el panel (Capas + Consultas)
router.get('/', authenticateToken, async (_req, res) => {
    try {
        const query = `
      SELECT 1 AS id, 'Sitios Unesco' AS name, 'Point' AS type
      UNION ALL
      SELECT 2 AS id, 'Ciudades del Mundo' AS name, 'Point' AS type
      UNION ALL
      SELECT 3 AS id, 'Hidrografía del Mundo' AS name, 'MultiLineString' AS type
      UNION ALL
      SELECT 4 AS id, 'Continentes' AS name, 'MultiPolygon' AS type
      UNION ALL
      SELECT 5 AS id, 'Ciudades: buffer 200 km (conteo UNESCO)' AS name, 'Polygon' AS type
      UNION ALL
      SELECT 6 AS id, 'UNESCO por continente (conteo)' AS name, 'MultiPolygon' AS type
    ;`;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener la lista de capas:', err.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GeoJSON por ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const cfg = layerMapping[id];
        if (!cfg) return res.status(404).json({ error: 'Capa no encontrada' });

        const query = `
            SELECT jsonb_build_object(
                           'type', 'FeatureCollection',
                           'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
                   ) AS geojson_data
            FROM (
                     SELECT jsonb_build_object(
                                    'type', 'Feature',
                                    'id', row_number() OVER (),
                                    'properties', to_jsonb(t) - 'geom',
                                    'geometry', ST_AsGeoJSON(t.geom)::jsonb
                            ) AS feature
                     FROM public.${cfg.table} AS t
                 ) AS features;
        `;

        console.log(`Consultando capa/vista ${id} -> ${cfg.table}`);
        const { rows } = await db.query(query);
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error al obtener datos de la capa ${req.params.id}:`, err.message);
        res.status(500).json({ error: `Error al procesar la capa: ${err.message}` });
    }
});

module.exports = router;
