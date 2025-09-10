const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = 3000;

// PostgreSQL connection
const pool = new Pool({
  user: "postgres",        // your pgAdmin username
  host: "localhost",       // database host
  database: "world",   // your database name
  password: "PRAKULPSHETTY",        // your pgAdmin password
  port: 5432               // default PostgreSQL port
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
  res.render("index", { title: "Banking Web App" });
});

// Show list of employees
app.get("/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employees ORDER BY id ASC");
    res.render("employees", { employees: result.rows });
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).send("Database error while fetching employees");
  }
});

// Show add employee form
app.get("/add-employee", (req, res) => {
  res.render("add-employee");
});

// Handle add employee form submission
app.post("/add-employee", async (req, res) => {
  const { name, email, position } = req.body;

  try {
    await pool.query(
      "INSERT INTO employees (name, email, position) VALUES ($1, $2, $3)",
      [name, email, position]
    );
    console.log("Employee added successfully!");
    res.redirect("/employees");
  } catch (err) {
    console.error("Error inserting employee:", err);
    res.status(500).send("Database error while adding employee");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
