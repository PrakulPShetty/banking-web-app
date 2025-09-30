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

// Middleware to protect manager routes
function isAuthenticated(req, res, next) {
  if (req.session.managerId) return next();
  res.redirect("/login");
}

// Middleware to protect employee routes
function isEmployee(req, res, next) {
  if (req.session.employeeId) return next();
  res.redirect("/employee-login");
}

// Root → Landing Page
app.get("/", (req, res) => res.render("index"));

// ---------------- MANAGER ROUTES ---------------- //

// Signup
app.get("/signup", (req, res) => res.render("signup"));

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

// Login
app.get("/login", (req, res) => res.render("login"));

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

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send("Error logging out");
    res.redirect("/");
  });
});

// Manager Dashboard
app.get("/manager", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM employees_credentials");
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
  const { username, name, email, role, salary, password } = req.body;
  if (!username || !name || !email || !role || !salary || !password) return res.send("All fields are required");

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO employees_credentials (username, name, email, role, salary, password) VALUES ($1, $2, $3, $4, $5, $6)",
      [username, name, email, role, salary, hashedPassword]
    );
    res.redirect("/manager");
  } catch (err) {
    console.error(err);
    res.send("Error adding employee. Try again later.");
  }
});

// Delete Employee
app.post("/delete-employee/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM employees_credentials WHERE id=$1", [id]);
    res.redirect("/manager");
  } catch (err) {
    console.error(err);
    res.send("Error deleting employee");
  }
});

// Edit Employee
app.post("/edit-employee/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { username, name, email, role, salary, password } = req.body;

  try {
    let query, params;
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = "UPDATE employees_credentials SET username=$1, name=$2, email=$3, role=$4, salary=$5, password=$6 WHERE id=$7";
      params = [username, name, email, role, salary, hashedPassword, id];
    } else {
      query = "UPDATE employees_credentials SET username=$1, name=$2, email=$3, role=$4, salary=$5 WHERE id=$6";
      params = [username, name, email, role, salary, id];
    }
    await db.query(query, params);
    res.redirect("/manager");
  } catch (err) {
    console.error(err);
    res.send("Error updating employee");
  }
});

// View all employees (for manager)
app.get("/employees", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM employees_credentials");
    res.render("employee", { employees: result.rows });
  } catch (err) {
    console.error(err);
    res.send("Error fetching employees");
  }
});


// View single employee
app.get("/view-employee/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM employees_credentials WHERE id=$1", [id]);
    if (result.rows.length === 0) return res.send("Employee not found");
    res.render("viewEmployee", { employee: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.send("Error fetching employee details");
  }
});

// Reports Page
app.get("/reports", isAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM employees_credentials");
    const totalEmployees = result.rows.length;
    const totalSalary = result.rows.reduce((sum, e) => sum + parseFloat(e.salary), 0);

    const managers = result.rows.filter(e => e.role === "Manager").length;
    const cashiers = result.rows.filter(e => e.role === "Cashier").length;
    const accountants = result.rows.filter(e => e.role === "Accountant").length;
    const clerks = result.rows.filter(e => e.role === "Clerk").length;
    const itSupport = result.rows.filter(e => e.role === "IT Support").length;

    res.render("reports", { 
      totalEmployees, totalSalary, managers, cashiers, accountants, clerks, itSupport 
    });
  } catch (err) {
    console.error(err);
    res.render("reports", { 
      totalEmployees: 0, totalSalary: 0, managers: 0, cashiers: 0, accountants: 0, clerks: 0, itSupport: 0 
    });
  }
});

// ---------------- EMPLOYEE ROUTES ---------------- //

app.get("/employee-login", (req, res) => res.render("employeeLogin", { error: null }));

app.post("/employee-login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM employees_credentials WHERE username=$1", [username]);
    if (result.rows.length === 0) return res.render("employeeLogin", { error: "Employee not found" });

    const employee = result.rows[0];
    const match = await bcrypt.compare(password, employee.password);
    if (match) {
      req.session.employeeId = employee.id;
      req.session.employeeName = employee.name;
      req.session.employeeUsername = employee.username;
      res.redirect("/employee-dashboard");
    } else {
      res.render("employeeLogin", { error: "Invalid password" });
    }
  } catch (err) {
    console.error(err);
    res.render("employeeLogin", { error: "Error during login. Try again later." });
  }
});



// ---------------- EMPLOYEE DASHBOARD ---------------- //
app.get("/employee-dashboard", isEmployee, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM employees_credentials WHERE id=$1",
      [req.session.employeeId]
    );

    if (result.rows.length === 0) return res.send("Employee not found");

    res.render("employeeDashboard", { employee: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.send("Error fetching employee details");
  }
});

// ---------------- CUSTOMER ROUTES ---------------- //

// Add Customer (GET)
app.get("/employee/add-customer", isEmployee, (req, res) => {
  res.render("addCustomer", { employee: req.session.employee });
});

// Add Customer (POST)
app.post("/employee/add-customer", isEmployee, async (req, res) => {
  const { name, email, account_no, balance } = req.body;
  try {
    await db.query(
      "INSERT INTO customers (name, email, account_no, balance) VALUES ($1, $2, $3, $4)",
      [name, email, account_no, balance]
    );
    res.redirect("/employee-dashboard");
  } catch (err) {
    console.error(err);
    res.send("Error adding customer");
  }
});

// Edit Customer (GET)
app.get("/employee/edit-customer/:id", isEmployee, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM customers WHERE id=$1", [id]);
    if (result.rows.length === 0) return res.send("Customer not found");
    res.render("editCustomer", { employee: req.session.employee, customer: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.send("Error fetching customer");
  }
});

// Edit Customer (POST)
app.post("/employee/edit-customer/:id", isEmployee, async (req, res) => {
  const { id } = req.params;
  const { name, email, balance } = req.body;
  try {
    await db.query(
      "UPDATE customers SET name=$1, email=$2, balance=$3 WHERE id=$4",
      [name, email, balance, id]
    );
    res.redirect("/employee-dashboard");
  } catch (err) {
    console.error(err);
    res.send("Error updating customer");
  }
});

// ---------------- TRANSACTION ROUTES ---------------- //

// Transaction Form
app.get("/employee/transactions", isEmployee, (req, res) => {
  res.render("transactions", { employee: req.session.employee });
});

// Process Transaction
app.post("/employee/transactions", isEmployee, async (req, res) => {
  const { type, account_no, amount, to_account } = req.body;
  try {
    if (type === "deposit") {
      await db.query("UPDATE customers SET balance = balance + $1 WHERE account_no=$2", [amount, account_no]);
    } else if (type === "withdraw") {
      await db.query("UPDATE customers SET balance = balance - $1 WHERE account_no=$2", [amount, account_no]);
    } else if (type === "transfer") {
      await db.query("UPDATE customers SET balance = balance - $1 WHERE account_no=$2", [amount, account_no]);
      await db.query("UPDATE customers SET balance = balance + $1 WHERE account_no=$2", [amount, to_account]);
    }

    // Save transaction history
    await db.query(
      "INSERT INTO transactions (account_no, type, amount, balance, to_account) VALUES ($1, $2, $3, (SELECT balance FROM customers WHERE account_no=$1), $4)",
      [account_no, type, amount, to_account || null]
    );

    res.redirect("/employee-dashboard");
  } catch (err) {
    console.error(err);
    res.send("Error processing transaction");
  }
});

// ---------------- REPORT ROUTES ---------------- //

// Daily Report
app.get("/employee/daily-report", isEmployee, async (req, res) => {
  try {
    const tx = await db.query("SELECT * FROM transactions WHERE date::date = CURRENT_DATE");
    const totalDeposits = tx.rows.filter(t => t.type === "deposit").reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalWithdrawals = tx.rows.filter(t => t.type === "withdraw").reduce((sum, t) => sum + parseFloat(t.amount), 0);

    res.render("dailyReport", {
      employee: req.session.employee,
      report: { totalTransactions: tx.rows.length, totalDeposits, totalWithdrawals }
    });
  } catch (err) {
    console.error(err);
    res.send("Error generating daily report");
  }
});

// Customer Statement
app.get("/employee/statement/:account_no", isEmployee, async (req, res) => {
  const { account_no } = req.params;
  try {
    const result = await db.query("SELECT * FROM transactions WHERE account_no=$1 ORDER BY date DESC", [account_no]);
    res.render("statement", { employee: req.session.employee, account_no, transactions: result.rows });
  } catch (err) {
    console.error(err);
    res.send("Error fetching statement");
  }
});

// Reports Summary
app.get("/employee/reports", isEmployee, async (req, res) => {
  try {
    const totalEmployees = (await db.query("SELECT COUNT(*) FROM employees_credentials")).rows[0].count;
    const totalSalary = (await db.query("SELECT SUM(salary) FROM employees_credentials")).rows[0].sum || 0;
    const managers = (await db.query("SELECT COUNT(*) FROM employees_credentials WHERE role='Manager'")).rows[0].count;
    const cashiers = (await db.query("SELECT COUNT(*) FROM employees_credentials WHERE role='Cashier'")).rows[0].count;
    const accountants = (await db.query("SELECT COUNT(*) FROM employees_credentials WHERE role='Accountant'")).rows[0].count;
    const clerks = (await db.query("SELECT COUNT(*) FROM employees_credentials WHERE role='Clerk'")).rows[0].count;
    const itSupport = (await db.query("SELECT COUNT(*) FROM employees_credentials WHERE role='IT Support'")).rows[0].count;

    res.render("reports", {
      employee: req.session.employee,
      totalEmployees,
      totalSalary,
      managers,
      cashiers,
      accountants,
      clerks,
      itSupport
    });
  } catch (err) {
    console.error(err);
    res.send("Error fetching reports");
  }
});

// ---------------- LOGOUT ---------------- //
app.get("/employee-logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send("Error logging out");
    res.redirect("/");
  });
});

// ---------------- SERVER ---------------- //

app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
