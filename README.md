# Money OS — Tax-Optimized Annual Savings Planner

> A premium fintech dashboard that compares tax regimes, optimizes 80C / 80D / NPS allocations, and turns tax planning into a monthly cash-flow strategy.

![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-API-000000?style=for-the-badge&logo=express&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-Frontend-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Hackathon MVP](https://img.shields.io/badge/Hackathon-Finalist_Ready-8B5CF6?style=for-the-badge)

---

## 🧠 Problem Statement

Tax planning often becomes a March panic exercise.

Users struggle with:

- Choosing the wrong tax regime without comparing old vs new properly
- Rushing last-minute 80C / 80D / NPS investments
- Locking money into tax-saving products without checking monthly affordability
- Missing how bonuses, salary hikes, EMIs, or family goals affect tax strategy

Most tax calculators stop at numbers. Money OS turns those numbers into a practical annual plan.

---

## 💡 Solution

Money OS helps salaried users make smarter tax decisions across the financial year.

It takes salary, existing investments, tax regime preference, goals, age, and expenses, then returns:

- Old vs new regime comparison
- Recommended regime
- Section-wise allocation across 80C / 80D / NPS
- Monthly investment guardrails
- Cash stress score
- Deadline pressure before March
- Scenario-based recalculation
- Plain-language AI coach insights

The result feels like a real fintech planning dashboard, not a spreadsheet.

---

## 🚀 Live Demo

https://tax-optimized-annual-savings-planner.onrender.com

---

## ✨ Key Features

### 🧾 Regime Comparison — Old vs New

Compares tax payable under both regimes using slab logic, deductions, rebate, surcharge, and cess.

### 🧮 80C / 80D / NPS Optimization

Recommends section-wise allocation based on deduction limits, existing investments, goals, and affordability.

### 💸 Monthly Cash-Flow Guardrails

Shows how much the user can safely invest each month without damaging liquidity.

### 🟢 Cash Stress Meter

Scores monthly pressure using income, expenses, investment load, and remaining free cash flow.

### ⏳ Deadline Pressure Meter

Calculates months left until March, required monthly catch-up, and risk state:

- Comfortable
- Tight
- March Panic Risk

### 🔁 Scenario Simulator

Instantly recalculates the dashboard for life changes:

- Salary Hike +10%
- Bonus ₹2L
- Home Loan EMI
- Parents Insurance
- Child Goal

### 🤖 AI Coach — Plain Language Insights

Turns tax output into concise, human-readable financial guidance.

### 📤 Exportable Plan Brief

Exports or shares a clean text summary of the user’s recommended plan.

---

## 👤 User Flow

1. User enters salary, existing investments, regime choice, goal, age, and expenses
2. Frontend validates input
3. Frontend sends data to `POST /api/plan`
4. Express API passes input to the tax engine
5. Tax engine calculates regime comparison, allocation, guardrails, stress, deadline, and insights
6. Dashboard renders cards, charts, coach guidance, and scenario controls
7. User tries scenarios or exports the plan brief

---

## 🏗️ Architecture

```txt
Frontend
HTML / CSS / Vanilla JavaScript / Chart.js
        ↓
Express API
Node.js server routes and static hosting
        ↓
Tax Engine
Custom business logic for regime comparison and recommendations
        ↓
JSON Response
Dashboard cards, charts, insights, scenario simulator, export brief
```

### Project Structure

```txt
money-os/
├── backend/
│   ├── server.js
│   └── taxEngine.js
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── style.css
│   └── script.js
├── assets/
│   └── screenshots
├── package.json
├── package-lock.json
└── README.md
```

---

## 🛠️ Tech Stack

- **Node.js** — backend runtime
- **Express.js** — API server and static hosting
- **HTML / CSS / Vanilla JavaScript** — frontend
- **Chart.js** — dashboard charts
- **Render** — deployment target

---

<!-- ## 🖼️ Screenshots

Add final screenshots inside the `assets/` folder before submission.

### Landing Page

![Landing Page](assets/landing-page.png)

### Dashboard

![Dashboard](assets/dashboard.png)

### Charts

![Charts](assets/charts.png)

--- -->


## ⚙️ How To Run Locally

```bash
npm install
npm start
```

Open:

```txt
http://localhost:3000/index.html
http://localhost:3000/dashboard.html
```

---

## 🔌 API Endpoints

### Health Check

```http
GET /api/health
```

### Generate Personalized Plan

```http
POST /api/plan
Content-Type: application/json
```

Example:

```json
{
  "annualSalary": 1800000,
  "existingInvestments": {
    "section80C": 60000,
    "section80D": 0,
    "nps": 0
  },
  "taxRegimeChoice": "auto",
  "financialGoal": "balanced-wealth-growth",
  "age": 32,
  "monthlyExpenses": 85000
}
```

### Load Demo Plan

```http
GET /api/sample-plan
```

---

## 🎬 Demo Instructions

1. Open the landing page
2. Enter salary, investments, regime choice, goal, age, and expenses
3. Generate a real plan
4. Review old vs new regime comparison
5. Show 80C / 80D / NPS recommendation cards
6. Explain Cash Stress Meter and Deadline Pressure Meter
7. Try the Scenario Simulator
8. Export the plan brief


---

## 🔮 Future Scope

- Salary slip and payroll integration
- Automated monthly tax-saving reminders
- More advanced investment recommendations
- HRA, home loan interest, employer NPS, and capital gains support
- User accounts and saved annual plans
- PDF export and advisor-ready reports
- Broader personal finance OS expansion

---

## ⚠️ Limitations

Current scope:

- Built for salaried individuals
- Uses simplified tax logic for focused regime comparison
- Covers core 80C / 80D / NPS planning
- Excludes HRA, home loan interest, employer NPS, capital gains, and complex exemptions
- Uses localStorage for demo-friendly state management

This is not a replacement for professional tax advice.

---

## 🏷️ Labels

`Fintech` `Tax Planning` `Money OS` `Node.js` `Express` `Vanilla JavaScript` `Chart.js` `MVP` `Personal Finance`

---

