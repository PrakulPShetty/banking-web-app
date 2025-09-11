import express from 'express';
import bodyParser from 'body-parser';
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); 

app.set('view engine', 'ejs');

const users = [
  { username: "prakul", password: "1234" },
  { username: "abhay", password: "5678" },
  { username: "devapriya", password: "abcd" }
];

// GET Login
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// POST Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Check user exists in array
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    res.render("dashboard", { username: user.username });
  } else {
    res.render("login", { error: "Invalid username or password ❌" });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}/login`);
});
