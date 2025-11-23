const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});


// -------------------------------------------------------

app.use(bodyParser.json());
app.use(cors({
    origin: ['https://inventory-management-frontend-ph25.netlify.app'],
    methods: ['GET','POST','PUT','DELETE'],
    credentials: true,
}));


app.listen(port, () => {
  console.log(`Server running: http://localhost:${port}`);
});

// ---------------- CREATE TABLES ----------------
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        unit TEXT,
        category TEXT,
        brand TEXT,
        stock INTEGER NOT NULL,
        status TEXT,
        image TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        old_quantity INTEGER,
        new_quantity INTEGER,
        change_date TEXT,
        user_info TEXT
      );
    `);

    console.log("Tables created/verified!");
  } catch (err) {
    console.error("Table create error:", err);
  }
})();

// ---------------- GET ALL PRODUCTS ----------------
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- UPDATE PRODUCT ----------------
app.put('/api/product/:id', async (req, res) => {
  const { id } = req.params;
  const { name, unit, category, brand, stock, status } = req.body;

  const sql = `
    UPDATE products
    SET name = $1, unit = $2, category = $3, brand = $4, stock = $5, status = $6
    WHERE id = $7
  `;
  const values = [name, unit, category, brand, stock, status, id];

  try {
    const result = await pool.query(sql, values);
    res.json({ message: "Product updated successfully", updatedId: id, changes: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- IMPORT PRODUCTS ----------------
app.post('/api/products/import', async (req, res) => {
  const products = req.body.products;

  const sql = `
    INSERT INTO products (name, unit, category, brand, stock, status, image)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (name) DO NOTHING
  `;

  try {
    for (let p of products) {
      await pool.query(sql, [
        p.name,
        p.unit,
        p.category,
        p.brand,
        p.stock,
        p.status,
        p.image
      ]);
    }

    res.json({ message: 'Products imported successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- EXPORT PRODUCTS ----------------
app.get('/api/products/export', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products");
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- PRODUCT HISTORY ----------------
app.get('/api/products/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM inventory_history WHERE product_id = $1",
      [id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- ADD NEW PRODUCT ----------------
app.post('/api/product/new', async (req, res) => {
  const { name, unit, category, brand, stock, status, image } = req.body;

  const sql = `
    INSERT INTO products (name, unit, category, brand, stock, status, image)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
  const values = [name, unit, category, brand, stock, status, image];

  try {
    const result = await pool.query(sql, values);
    res.json({ message: "Product added successfully", productId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- DELETE ALL PRODUCTS ----------------
app.delete('/api/products/all', async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM products");
    res.json({ message: "All products deleted", changes: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
