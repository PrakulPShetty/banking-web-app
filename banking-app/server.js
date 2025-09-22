import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import session from "express-session";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "yourSecretKey",
  resave: false,
  saveUninitialized: false
}));
app.set("view engine", "ejs");

// PostgreSQL connection
const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASS,
  port: process.env.PG_PORT,
});

db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ DB connection error:", err));

// Middleware to protect routes
function isAuthenticated(req, res, next) {
  if (req.session.managerId) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// Root → redirect to login
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Manager Signup
app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await db.query(
      "INSERT INTO managers (username, email, password) VALUES ($1, $2, $3)",
      [username, email, hashedPassword]
    );
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.send("Error signing up. Maybe email/username already exists.");
  }
});

// Manager Login
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM managers WHERE email=$1", [email]);
    if (result.rows.length === 0) return res.send("Manager not found");

    const manager = result.rows[0];
    const match = await bcrypt.compare(password, manager.password);
    if (match) {
      req.session.managerId = manager.id;
      req.session.managerName = manager.username;
      res.redirect("/manager");
    } else {
      res.send("Incorrect password");
    }
  } catch (err) {
    console.error(err);
    res.send("Error during login");
  }
});

// ✅ Logout Route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.send("Error logging out");
    }
    res.redirect("/login");
  });
});

// Manager Dashboard (protected)
app.get("/manager", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM employees");
    res.render("manager", { 
      employees: result.rows,
      managerName: req.session.managerName
    });
  } catch (err) {
    console.error(err);
    res.render("manager", { employees: [], managerName: req.session.managerName });
  }
});

// Add Employee
app.post("/add-employee", isAuthenticated, async (req, res) => {
  const { name, email, role, salary } = req.body;
  try {
    await db.query(
      "INSERT INTO employees (name, email, role, salary) VALUES ($1, $2, $3, $4)",
      [name, email, role, salary]
    );
    res.redirect("/manager");
  } catch (err) {
    console.error(err);
    res.send("Error adding employee");
  }
});

// Delete Employee
app.post("/delete-employee/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM employees WHERE id=$1", [id]);
    res.redirect("/manager");
  } catch (err) {
    console.error(err);
    res.send("Error deleting employee");
  }
});

// Edit Employee
app.post("/edit-employee/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, salary } = req.body;
  try {
    await db.query(
      "UPDATE employees SET name=$1, email=$2, role=$3, salary=$4 WHERE id=$5",
      [name, email, role, salary, id]
    );
    res.redirect("/manager");
  } catch (err) {
    console.error(err);
    res.send("Error updating employee");
  }
});

// Employee List Page
app.get("/employees", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM employees");
    res.render("employee", { employees: result.rows });
  } catch (err) {
    console.error(err);
    res.render("employee", { employees: [] });
  }
});

// Reports Page
app.get("/reports", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM employees");
    const totalEmployees = result.rows.length;
    const totalSalary = result.rows.reduce((a, b) => a + parseFloat(b.salary), 0);
    const managers = result.rows.filter(e => e.role === "Manager").length;
    const cashiers = result.rows.filter(e => e.role === "Cashier").length;
    res.render("reports", { totalEmployees, totalSalary, managers, cashiers });
  } catch (err) {
    console.error(err);
    res.render("reports", { totalEmployees: 0, totalSalary: 0, managers: 0, cashiers: 0 });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
