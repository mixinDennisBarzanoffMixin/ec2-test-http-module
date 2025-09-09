const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log(process.env.DB_USER);
console.log(process.env.DB_HOST);
console.log(process.env.DB_NAME);
console.log(process.env.DB_PASSWORD);
console.log(process.env.DB_PORT);
console.log(process.env.SERVER_ID);
console.log(process.env.PORT);

// PostgreSQL connection pool (pool = δεξαμενή συνδέσεων)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'testdb',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(express.json());

// Health check route (για το load balancer)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    server: process.env.SERVER_ID || 'server-1',
    timestamp: new Date().toISOString()
  });
});

// Root route με database query
app.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    const serverInfo = {
      message: 'Hello from EC2 Load Balancer Test!',
      server_id: process.env.SERVER_ID || 'server-1',
      database_time: result.rows[0].current_time,
      database_version: result.rows[0].db_version,
      request_count: await getRequestCount(client)
    };
    client.release();
    res.json(serverInfo);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      error: 'Database connection failed',
      server_id: process.env.SERVER_ID || 'server-1'
    });
  }
});

// Route για να προσθέτουμε requests (για testing)
app.post('/requests', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO requests (server_id, timestamp, data) VALUES ($1, NOW(), $2) RETURNING *',
      [process.env.SERVER_ID || 'server-1', JSON.stringify(req.body)]
    );
    client.release();
    res.json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Failed to insert request' });
  }
});

// Route για να βλέπουμε όλα τα requests
app.get('/requests', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM requests ORDER BY timestamp DESC LIMIT 50');
    client.release();
    res.json({ 
      requests: result.rows,
      total_count: result.rows.length,
      server_id: process.env.SERVER_ID || 'server-1'
    });
  } catch (err) {
    console.error('Select error:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Helper function για να μετράμε requests
async function getRequestCount(client) {
  try {
    const result = await client.query('SELECT COUNT(*) FROM requests');
    return parseInt(result.rows[0].count);
  } catch (err) {
    return 0; // αν δεν υπάρχει το table ακόμα
  }
}

// Initialize database table στο startup
async function initDatabase() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(50),
        timestamp TIMESTAMP DEFAULT NOW(),
        data JSONB
      )
    `);
    console.log('Database table initialized');
    client.release();
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Server ID: ${process.env.SERVER_ID || 'server-1'}`);
  await initDatabase();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
