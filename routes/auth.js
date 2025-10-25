const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    console.error("[AUTH] Falta JWT_SECRET en variables de entorno");
    throw new Error("JWT_SECRET requerido");
}

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '7d' }
    );
}

function authRequired(req, res, next) {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body || {};
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Faltan campos' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const hash = await bcrypt.hash(password, 10);
        const { rows } = await db.query(
            `INSERT INTO public.users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
            [username.trim(), email.trim().toLowerCase(), hash]
        );

        const user = rows[0];
        const token = signToken(user);
        res.status(201).json({ message: 'Usuario creado', token, user });
    } catch (e) {
        if (e.code === '23505') {
            return res.status(409).json({ error: 'El usuario o correo ya existe' });
        }
        console.error(e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Faltan credenciales' });
        }

        const { rows } = await db.query(
            'SELECT id, username, email, password_hash FROM public.users WHERE lower(email) = lower($1)',
            [email.trim()]
        );
        if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });

        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = signToken(user);
        res.json({ message: 'Login ok', token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/auth/me
router.get('/me', authRequired, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, username, email, created_at FROM public.users WHERE id = $1',
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ user: rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// PUT /api/auth/profile
router.put('/profile', authRequired, async (req, res) => {
    try {
        const { username } = req.body || {};
        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'username es requerido' });
        }
        if (username.trim().length < 3) {
            return res.status(400).json({ error: 'El username debe tener al menos 3 caracteres' });
        }

        const { rows } = await db.query(
            `UPDATE public.users
       SET username = $1
       WHERE id = $2
       RETURNING id, username, email, created_at`,
            [username.trim(), req.user.id]
        );

        if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Perfil actualizado', user: rows[0] });
    } catch (e) {
        if (e.code === '23505') {
            return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
        }
        console.error(e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authRequired, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Faltan campos' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        const { rows } = await db.query(
            'SELECT id, password_hash FROM public.users WHERE id = $1',
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

        const ok = await (require('bcryptjs')).compare(currentPassword, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

        const newHash = await (require('bcryptjs')).hash(newPassword, 10);
        await db.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

        res.json({ message: 'Contraseña actualizada' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
