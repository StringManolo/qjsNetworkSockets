import express from '../extra/express.js';

const app = express();

const db = {
  users: [
    { id: 1, name: 'Anna', email: 'anna@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
  ]
};

// Loggin Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// users CRUD
app.get('/api/users', (req, res) => {
  res.json(db.users);
});

app.get('/api/users/:id', (req, res) => {
  const user = db.users.find(u => u.id == req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/users', (req, res) => {
  const newUser = {
    id: db.users.length + 1,
    name: req.body.name || 'No name',
    email: req.body.email || 'noemail@email.com'
  };
  db.users.push(newUser);
  res.status(201).json(newUser);
});

app.delete('/api/users/:id', (req, res) => {
  const index = db.users.findIndex(u => u.id == req.params.id);
  if (index !== -1) {
    db.users.splice(index, 1);
    res.status(204).send('');
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.listen(8080);
