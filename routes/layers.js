const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/authenticateToken');

const layerMapping = {
    1: { table: 'sitios_unesco', alias: 'p' },
    2: { table: 'ciudades_mundo', alias: 'c' },
    3: { table: 'hidrografia_mundo', alias: 'h' },
    4: { table: 'continentes', alias: 'n' },
};


router.get('/', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 1 AS id, 'Sitios Unesco' AS name, 'Point' AS type
            UNION ALL
            SELECT 2 AS id, 'Ciudades del Mundo' AS name, 'Point' AS type
            UNION ALL
            SELECT 3 AS id, 'Hidrografía del Mundo' AS name, 'MultiLineString' AS type
            /* --- CORRECCIÓN 1: Se eliminó el ';' que estaba aquí --- */
            UNION ALL
            SELECT 4 AS id, 'Continentes' AS name, 'Polygon' AS type;
        `;
        const { rows } = await db.query(query);
        res.json(rows);

    } catch (err) {
        console.error('Error al obtener la lista de capas:', err.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const layerConfig = layerMapping[id];

        if (!layerConfig) {
            return res.status(404).json({ error: 'Capa no encontrada' });
        }

        const { table, alias } = layerConfig;


        const query = `
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
            ) AS geojson_data
            FROM (
                SELECT jsonb_build_object(
                    'type', 'Feature',
                    'id', ogc_fid,
                    'properties', to_jsonb(${alias}) - 'geom',
                    'geometry', ST_AsGeoJSON(${alias}.geom)::jsonb
                ) AS feature
                FROM public.${table} AS ${alias}
            ) AS features;
        `;

        console.log(`Ejecutando consulta para capa ID ${id} (tabla ${table})...`);
        const { rows } = await db.query(query);
        console.log(`Datos de capa ${id} obtenidos.`);

        res.json(rows[0]);

    } catch (err) {
        console.error(`Error al obtener datos de la capa ${req.params.id}:`, err.message);
        res.status(500).json({ error: `Error al procesar la capa: ${err.message}` });
    }
});

module.exports = router;