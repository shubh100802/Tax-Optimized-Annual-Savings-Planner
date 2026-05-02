const express = require("express");
const cors = require("cors");
const path = require("path");
const { generatePlan } = require("./taxEngine");

// ========== APP CONFIG ==========
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

// ========== HEALTH ROUTES ==========
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Money OS Tax Planner API",
    version: "1.0.0",
  });
});

// ========== TAX PLANNER ROUTES ==========
app.post("/api/plan", (req, res) => {
  const plan = generatePlan(req.body);

  if (!plan.ok) {
    return res.status(400).json(plan);
  }

  return res.json(plan);
});

app.get("/api/sample-plan", (req, res) => {
  const samplePlan = generatePlan({
    annualSalary: 1800000,
    existingInvestments: {
      section80C: 60000,
      section80D: 0,
      nps: 0,
    },
    taxRegimeChoice: "auto",
    financialGoal: "balanced-wealth-growth",
    age: 32,
    monthlyExpenses: 85000,
  });

  res.json(samplePlan);
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    errors: ["Route not found."],
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    ok: false,
    errors: ["Unexpected server error."],
  });
});

// ========== SERVER BOOT ==========
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Money OS API running at http://localhost:${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Stop the existing server or run with a different PORT.`);
      console.error(`PowerShell: netstat -ano | Select-String ':${PORT}'`);
      console.error("Then stop the listed PID: Stop-Process -Id <PID>");
      process.exit(1);
    }

    throw error;
  });
}

module.exports = app;
