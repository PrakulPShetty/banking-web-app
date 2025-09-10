const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// PostgreSQL connection
const pool = new Pool({
  user: "postgres",          // your PostgreSQL username
  host: "localhost",
  database: "world",         // your database name
  password: "PRAKULPSHETTY", // your PostgreSQL password
  port: 5432
});

// ROUTES

// Manager Dashboard → show form + employee table
app.get("/manager", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employees ORDER BY id ASC");
    res.render("addemp", { employees: result.rows });  // Pass employees to EJS
  } catch (err) {
    console.error(err);
    res.send("Error fetching employees from database");
  }
});

// API → Add Employee
app.post("/api/add-employee", async (req, res) => {
  const { empid, name, email, password, role } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO employees (empid, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [empid, name, email, password, role]
    );
    res.json({ success: true, employee: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// API → Delete Employee
app.post("/api/delete-employee/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM employees WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
