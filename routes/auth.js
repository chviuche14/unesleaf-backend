const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();
const saltRounds = 10;

router.post('/register', async (req, res) => {

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    try {
        const userCheck = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: 'El email o nombre de usuario ya existe' });
        }

        const passwordHash = await bcrypt.hash(password, saltRounds);

        const newUser = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, passwordHash]
        );

        const token = jwt.sign(
            { userId: newUser.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: newUser.rows[0],
            token: token,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    try {
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [
            email,
        ]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Login exitoso',
            user: { id: user.id, username: user.username, email: user.email },
            token: token,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
});

router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userResult = await db.query(
            'SELECT id, username, email, created_at FROM users WHERE id = $1',
            [userId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(userResult.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
});

router.put('/profile', authenticateToken, async (req, res) => {
    const { username } = req.body;
    const userId = req.user.userId;

    if (!username) {
        return res.status(400).json({ error: 'El nombre de usuario es requerido' });
    }

    try {
        const updatedUser = await db.query(
            'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, email',
            [username, userId]
        );

        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Perfil actualizado exitosamente', user: updatedUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
        }
        res.status(500).send('Error en el servidor');
    }
});


router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    try {
        const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const currentHash = userResult.rows[0].password_hash;

        const isMatch = await bcrypt.compare(currentPassword, currentHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

        res.json({ message: 'Contraseña actualizada exitosamente' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
});

module.exports = router;