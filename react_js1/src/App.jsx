import { useState, useEffect } from 'react';
import './styles.css';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [savedUsers, setSavedUsers] = useState({});
  const [user, setUser] = useState(() => localStorage.getItem('currentUser') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Fetch saved users from Node.js server on load
  const fetchUsers = () => {
    fetch('http://localhost:5000/users')
      .then((res) => res.json())
      .then((data) => setSavedUsers(data || {}))
      .catch(() => {});
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. Auto-fill password when selecting username from dropdown
  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    setError('');
    if (!isSignup && savedUsers[val]) {
      setPassword(savedUsers[val]);
    }
  };

  // 3. Handle Submit (Login or Sign Up)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setError('Please fill in both fields.');
      return;
    }

    setLoading(true);

    const endpoint = isSignup
      ? 'http://localhost:5000/signup'
      : 'http://localhost:5000/login';

    // 5-second timeout controller so buttons never freeze
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUser,
          password: trimmedPass,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Request failed');
        setLoading(false);
        return;
      }

      // 🔍 1. Log Token to the Browser Console tab
      console.log('====================================');
      console.log(`✅ Generated JWT Token (${isSignup ? 'Signup' : 'Login'}):`);
      console.log(data.token);
      console.log('====================================');

      // 💾 2. Save Token in Browser Application Tab
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('currentUser', data.username);
      document.cookie = `jwt_token=${data.token}; path=/; max-age=3600`;

      // Update dropdown list
      fetchUsers();

      // Set user (Token is NOT displayed in UI!)
      setUser(data.username);
      setLoading(false);
    } catch (err) {
      clearTimeout(timeoutId);
      setLoading(false);
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check if "node server.js" is running.');
      } else {
        setError('Server offline. Start: node server.js');
      }
    }
  };

  // 4. Logout
  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('currentUser');
    document.cookie = 'jwt_token=; path=/; max-age=0';
    setUser('');
    setUsername('');
    setPassword('');
    setError('');
  };

  return (
    <div className="login-container">
      {!user ? (
        // Login & Signup Form
        <form onSubmit={handleSubmit} className="login-form">
          <h2>{isSignup ? 'Sign Up' : 'Login'}</h2>

          {error && <p className="error-message">{error}</p>}

          <div className="form-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={handleUsernameChange}
              list="users-list"
              autoComplete="username"
              required
            />
            {/* Native browser dropdown */}
            <datalist id="users-list">
              {Object.keys(savedUsers).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Login'}
          </button>

          {/* Toggle between Login and Signup */}
          <p className="toggle-text">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            <span
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
            >
              {isSignup ? 'Login' : 'Sign Up'}
            </span>
          </p>
        </form>
      ) : (
        // Welcome Screen (NO JWT token shown in UI!)
        <div className="welcome-box">
          <h2>Welcome, {user}!</h2>
          <p style={{ textAlign: 'center', color: '#555', margin: '8px 0 16px' }}>
            You are logged in.
          </p>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
