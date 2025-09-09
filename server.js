const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🔧 Environment variables loaded:'); // Φορτώθηκαν οι μεταβλητές περιβάλλοντος
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***hidden***' : 'not set'); // κρυμμένο για ασφάλεια
console.log('DB_PORT:', process.env.DB_PORT);
console.log('SERVER_ID:', process.env.SERVER_ID);
console.log('PORT:', process.env.PORT);

// PostgreSQL connection pool (pool = δεξαμενή συνδέσεων)
if (!process.env.DB_URL) {
  throw new Error('DB_URL is not set');
}
const pool = new Pool({
  connectionString: process.env.DB_URL
});

// Middleware
console.log('⚙️ Setting up middleware...'); // Ρυθμίζουμε middleware
app.use(express.json());

// Health check route (για το load balancer)
app.get('/health', (req, res) => {
  console.log('❤️ Health check requested'); // Ζητήθηκε έλεγχος υγείας
  res.json({ 
    status: 'OK', 
    server: process.env.SERVER_ID || 'server-1',
    timestamp: new Date().toISOString()
  });
});

// Root route με database query
app.get('/', async (req, res) => {
  console.log('🏠 Root route accessed'); // Προσπελάστηκε η κύρια διαδρομή
  try {
    console.log('🔌 Connecting to database...'); // Συνδεόμαστε στη βάση δεδομένων
    const client = await pool.connect();
    console.log('✅ Database connection successful'); // Επιτυχής σύνδεση
    
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    console.log('📊 Database query executed successfully'); // Το query εκτελέστηκε επιτυχώς
    
    const serverInfo = {
      message: 'Hello from EC2 Load Balancer Test!',
      server_id: process.env.SERVER_ID || 'server-1',
      database_time: result.rows[0].current_time,
      database_version: result.rows[0].db_version,
      request_count: await getRequestCount(client)
    };
    client.release();
    console.log('🔓 Database connection released'); // Απελευθερώθηκε η σύνδεση
    res.json(serverInfo);
  } catch (err) {
    console.error('❌ Database error:', err); // Σφάλμα βάσης δεδομένων
    res.status(500).json({ 
      error: 'Database connection failed',
      server_id: process.env.SERVER_ID || 'server-1'
    });
  }
});

// Route για να προσθέτουμε requests (για testing)
app.post('/requests', async (req, res) => {
  console.log('📝 POST /requests - Adding new request'); // Προσθέτουμε νέο αίτημα
  console.log('Request body:', req.body); // Περιεχόμενο αιτήματος
  try {
    const client = await pool.connect();
    console.log('🔌 Connected to database for insert'); // Συνδεθήκαμε για εισαγωγή
    
    const result = await client.query(
      'INSERT INTO requests (server_id, timestamp, data) VALUES ($1, NOW(), $2) RETURNING *',
      [process.env.SERVER_ID || 'server-1', JSON.stringify(req.body)]
    );
    console.log('✅ Request inserted successfully:', result.rows[0].id); // Επιτυχής εισαγωγή
    client.release();
    res.json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error('❌ Insert error:', err); // Σφάλμα εισαγωγής
    res.status(500).json({ error: 'Failed to insert request' });
  }
});

// Route για να βλέπουμε όλα τα requests
app.get('/requests', async (req, res) => {
  console.log('📋 GET /requests - Fetching all requests'); // Ανακτούμε όλα τα αιτήματα
  try {
    const client = await pool.connect();
    console.log('🔌 Connected to database for select'); // Συνδεθήκαμε για επιλογή
    
    const result = await client.query('SELECT * FROM requests ORDER BY timestamp DESC LIMIT 50');
    console.log(`📊 Found ${result.rows.length} requests`); // Βρέθηκαν αιτήματα
    client.release();
    res.json({ 
      requests: result.rows,
      total_count: result.rows.length,
      server_id: process.env.SERVER_ID || 'server-1'
    });
  } catch (err) {
    console.error('❌ Select error:', err); // Σφάλμα επιλογής
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Helper function για να μετράμε requests
async function getRequestCount(client) {
  console.log('🔢 Counting total requests...'); // Μετράμε συνολικά αιτήματα
  try {
    const result = await client.query('SELECT COUNT(*) FROM requests');
    const count = parseInt(result.rows[0].count);
    console.log(`📊 Total request count: ${count}`); // Συνολικός αριθμός αιτημάτων
    return count;
  } catch (err) {
    console.log('⚠️ Table does not exist yet, returning 0'); // Ο πίνακας δεν υπάρχει ακόμα
    return 0; // αν δεν υπάρχει το table ακόμα
  }
}

// Initialize database table στο startup
async function initDatabase() {
  console.log('🗄️ Initializing database table...'); // Αρχικοποιούμε τον πίνακα βάσης
  try {
    const client = await pool.connect();
    console.log('🔌 Connected to database for initialization'); // Συνδεθήκαμε για αρχικοποίηση
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(50),
        timestamp TIMESTAMP DEFAULT NOW(),
        data JSONB
      )
    `);
    console.log('✅ Database table initialized successfully'); // Επιτυχής αρχικοποίηση πίνακα
    client.release();
  } catch (err) {
    console.error('❌ Database initialization error:', err); // Σφάλμα αρχικοποίησης
  }
}

// Start server
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`); // Ο server τρέχει στη θύρα
  console.log(`📊 Server ID: ${process.env.SERVER_ID || 'server-1'}`);
  console.log('🔄 Starting database initialization...'); // Ξεκινάμε αρχικοποίηση βάσης
  await initDatabase();
  console.log('🎉 Server startup complete!'); // Ολοκληρώθηκε η εκκίνηση
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received shutdown signal...'); // Λάβαμε σήμα τερματισμού
  console.log('🔄 Shutting down gracefully...'); // Τερματίζουμε ομαλά
  await pool.end();
  console.log('🔌 Database pool closed'); // Κλείσαμε το pool συνδέσεων
  console.log('👋 Goodbye!'); // Αντίο!
  process.exit(0);
});
