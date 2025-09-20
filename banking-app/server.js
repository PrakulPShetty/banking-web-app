import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

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

// Root route → redirect to manager dashboard
app.get("/", (req, res) => {
  res.redirect("/manager");
});

// Manager Dashboard - fetch employees and render
app.get("/manager", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM employees");
    res.render("manager", { employees: result.rows });
  } catch (err) {
    console.error(err);
    res.render("manager", { employees: [] });
  }
});

// Add Employee to DB
app.post("/add-employee", async (req, res) => {
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

// Delete employee by ID
app.post("/delete-employee/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM employees WHERE id = $1", [id]);
    res.redirect("/manager");
  } catch (err) {
    console.error(err);
    res.send("Error deleting employee");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
