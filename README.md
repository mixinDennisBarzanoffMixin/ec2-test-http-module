# EC2 Load Balancer Test Server

Ένας απλός Node.js server για δοκιμή load balancing στο AWS EC2 με PostgreSQL. (A simple Node.js server for testing load balancing on AWS EC2 with PostgreSQL.)

## Setup (Εγκατάσταση)

1. **Install dependencies (εγκατάσταση εξαρτήσεων):**
   ```bash
   npm install
   ```

2. **Setup environment variables (ρύθμιση μεταβλητών περιβάλλοντος):**
   ```bash
   cp env.example .env
   # Edit .env with your database credentials (επεξεργασία με τα στοιχεία της βάσης)
   ```

3. **Start PostgreSQL database (εκκίνηση PostgreSQL):**
   ```bash
   # Local PostgreSQL
   createdb testdb
   
   # Or use Docker
   docker run --name postgres-test -e POSTGRES_PASSWORD=password -e POSTGRES_DB=testdb -p 5432:5432 -d postgres
   ```

4. **Run the server (εκτέλεση server):**
   ```bash
   npm start
   ```

## API Endpoints (Σημεία API)

- `GET /` - Main endpoint with database info (κύριο endpoint με πληροφορίες βάσης)
- `GET /health` - Health check for load balancer (έλεγχος υγείας για load balancer)
- `GET /requests` - View all requests (προβολή όλων των αιτημάτων)
- `POST /requests` - Add new request (προσθήκη νέου αιτήματος)

## Load Balancing Test (Δοκιμή Load Balancing)

1. **Deploy to multiple EC2 instances (ανάπτυξη σε πολλές EC2 instances):**
   - Set different `SERVER_ID` in each instance (διαφορετικό `SERVER_ID` σε κάθε instance)
   - Use same RDS database for all instances (ίδια RDS βάση για όλες)

2. **Test load distribution (δοκιμή κατανομής φορτίου):**
   ```bash
   # Multiple requests to see different servers respond
   for i in {1..10}; do curl http://your-load-balancer-url/; done
   ```

## Environment Variables (Μεταβλητές Περιβάλλοντος)

- `DB_HOST` - Database host (διεύθυνση βάσης)
- `DB_PORT` - Database port (πόρτα βάσης)
- `DB_NAME` - Database name (όνομα βάσης)
- `DB_USER` - Database username (όνομα χρήστη βάσης)
- `DB_PASSWORD` - Database password (κωδικός βάσης)
- `PORT` - Server port (πόρτα server)
- `SERVER_ID` - Unique server identifier (μοναδικό αναγνωριστικό server)
