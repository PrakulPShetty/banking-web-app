import express from "express";
import path from "path";
import bodyParser from "body-parser";

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

// Dummy credentials (replace with DB check later)
const users = [
  { username: "prakul", password: "1234" },
  { username: "admin", password: "admin123" }
];

// Routes
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Check against users array
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    // Pass username to dashboard
    res.render("dashboard", { username: user.username });
  } else {
    res.render("login", { error: "❌ Invalid username or password" });
  }
});

// Logout (redirect to login)
app.get("/logout", (req, res) => {
  res.redirect("/login");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}/login`);
});
