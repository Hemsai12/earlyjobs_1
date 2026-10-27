import http from 'node:http';
import crypto from 'node:crypto';
import mysql from 'mysql2';

const localUsers = { admin: '1234', john: 'pass' };
const storedTokens = [];
const SECRET_KEY = 'my_super_secret_key_2026';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'hemsai707';
const DB_NAME = process.env.DB_NAME || 'login_signup';

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectTimeout: 2000,
  waitForConnections: false,
});

let isMysqlOnline = false;

function initMySQL() {
  const rootConn = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    connectTimeout: 2000,
  });

  rootConn.connect((err) => {
    if (err) {
      isMysqlOnline = false;
      console.log('⚠️ MySQL service is currently offline or unreachable.');
      console.log('👉 To connect real MySQL, run in terminal: sudo service mysql start');
      console.log('💡 Note: The server will automatically use local memory until MySQL is started!\n');
      return;
    }

    isMysqlOnline = true;
    rootConn.query('CREATE DATABASE IF NOT EXISTS login_signup', () => {
      rootConn.query('USE login_signup', () => {
        rootConn.query(`
          CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `, () => {
          console.log('✅ Connected to MySQL database "login_signup" successfully!\n');
          rootConn.end();
        });
      });
    });
  });
}

initMySQL();

function makeUniqueJwt(username) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');

  const payload = Buffer.from(
    JSON.stringify({
      user: username,
      jti: crypto.randomUUID(),
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

const server = http.createServer((req, res) => {
  // Full CORS Headers (Prevents browser from blocking POST requests)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));

  req.on('end', () => {
    let data = {};
    if (body) {
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
    }
    if (req.method === 'GET' && req.url === '/users') {
      if (isMysqlOnline) {
        pool.query('SELECT username, password FROM users', (err, results) => {
          if (!err && results) {
            const userMap = {};
            results.forEach((row) => (userMap[row.username] = row.password));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(userMap));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(localUsers));
        });
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(localUsers));
      return;
    }

    
    if (req.method === 'POST' && req.url === '/signup') {
      const { username, password } = data;

      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Please enter username and password!' }));
        return;
      }

      const trimmedUser = username.trim();
      const trimmedPass = password.trim();

      
      if (isMysqlOnline) {
        const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
        pool.query(sql, [trimmedUser, trimmedPass], (err) => {
          if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Username "${trimmedUser}" is already taken!` }));
              return;
            }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `MySQL error: ${err.message}` }));
            return;
          }

          const token = makeUniqueJwt(trimmedUser);
          storedTokens.push({ username: trimmedUser, token });
          console.log(`✅ [MySQL] Signed up: "${trimmedUser}", JWT: ${token}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token, username: trimmedUser, message: 'Signup successful!' }));
        });
        return;
      }

      if (localUsers[trimmedUser]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Username "${trimmedUser}" is already taken!` }));
        return;
      }

      localUsers[trimmedUser] = trimmedPass;
      const token = makeUniqueJwt(trimmedUser);
      storedTokens.push({ username: trimmedUser, token });
      console.log(`✅ [Local] Signed up: "${trimmedUser}", JWT: ${token}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, username: trimmedUser, message: 'Signup successful!' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/login') {
      const { username, password } = data;

      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Please enter username and password!' }));
        return;
      }

      const trimmedUser = username.trim();
      const trimmedPass = password.trim();

      
      if (isMysqlOnline) {
        const sql = 'SELECT * FROM users WHERE username = ?';
        pool.query(sql, [trimmedUser], (err, results) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `MySQL error: ${err.message}` }));
            return;
          }

          if (!results || results.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `User "${trimmedUser}" not found! Click "Sign Up" first.` }));
            return;
          }

          const user = results[0];
          if (user.password !== trimmedPass) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Wrong username or password!' }));
            return;
          }

          const token = makeUniqueJwt(user.username);
          storedTokens.push({ username: user.username, token });
          console.log(`✅ [MySQL] Logged in: "${user.username}", JWT: ${token}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token, username: user.username }));
        });
        return;
      }

    
      if (!localUsers[trimmedUser]) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `User "${trimmedUser}" not found! Click "Sign Up" first.` }));
        return;
      }

      if (localUsers[trimmedUser] !== trimmedPass) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Wrong username or password!' }));
        return;
      }

      const token = makeUniqueJwt(trimmedUser);
      storedTokens.push({ username: trimmedUser, token });
      console.log(`✅ [Local] Logged in: "${trimmedUser}", JWT: ${token}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, username: trimmedUser }));
      return;
    }

    res.writeHead(404);
    res.end();
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:5000`);
});

