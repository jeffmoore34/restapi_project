const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get user's orders
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of orders }
 */
router.get('/', authenticate, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = $1',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Place a new order
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Order placed }
 *       400: { description: Cart empty or insufficient stock }
 */
router.post('/', authenticate, async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cartResult = await client.query(
            'SELECT ci.product_id, ci.quantity, p.price, p.stock_quantity FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.user_id = $1',
            [userId]
        );
        const cartItems = cartResult.rows;
        if (cartItems.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cart is empty' });
        }
        let totalAmount = 0;
        for (const item of cartItems) {
            if (item.quantity > item.stock_quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Insufficient stock for product ${item.product_id}` });
            }
            totalAmount += item.price * item.quantity;
        }
        const orderResult = await client.query(
            'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id',
            [userId, totalAmount, 'pending']
        );
        const orderId = orderResult.rows[0].id;
        for (const item of cartItems) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.product_id, item.quantity, item.price]
            );
            await client.query(
                'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [item.quantity, item.product_id]
            );
        }
        await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
        await client.query('COMMIT');
        res.status(201).json({ message: 'Order placed', orderId });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;