const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get user's cart items
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of cart items }
 */
router.get('/', authenticate, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            'SELECT ci.id, ci.product_id, p.name, p.price, ci.quantity FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.user_id = $1',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /cart:
 *   post:
 *     summary: Add product to cart
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id: { type: integer }
 *               quantity: { type: integer }
 *     responses:
 *       201: { description: Added to cart }
 *       404: { description: Product not found }
 */
router.post('/', authenticate, [
    body('product_id').isInt(),
    body('quantity').isInt({ min: 1 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const userId = req.user.id;
    const { product_id, quantity } = req.body;
    try {
        const productResult = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
        if (productResult.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
        await pool.query(
            'INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart_items.quantity + $3',
            [userId, product_id, quantity]
        );
        res.status(201).json({ message: 'Added to cart' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;