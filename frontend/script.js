/* ========== API CONFIG ========== */
const API_BASE_URL = "";
const PLAN_STORAGE_KEY = "moneyOs.latestPlan";
const BASE_PLAN_STORAGE_KEY = "moneyOs.basePlan";
const PLAN_SOURCE = {
  real: "real",
  demo: "demo",
};

const SCENARIOS = {
  "salary-hike": {
    title: "Salary Hike +10%",
    summary: "Salary rises by 10% while expenses stay flat, testing whether deductions become more valuable.",
    apply: (input) => ({ ...input, annualSalary: Math.round(input.annualSalary * 1.1) }),
  },
  bonus: {
    title: "Bonus ₹2L",
    summary: "Adds a ₹2L annual bonus and checks whether the extra income changes the winning regime.",
    apply: (input) => ({ ...input, annualSalary: input.annualSalary + 200000 }),
  },
  "home-loan": {
    title: "Home Loan EMI",
    summary: "Adds ₹40K/month EMI pressure, so the plan prioritizes cash-flow survival over aggressive lock-ins.",
    apply: (input) => ({
      ...input,
      monthlyExpenses: (input.monthlyExpenses || Math.round(input.annualSalary / 24)) + 40000,
      financialGoal: "higher-monthly-cash-flow",
    }),
  },
  "parents-insurance": {
    title: "Parents Insurance",
    summary: "Adds ₹25K parent health cover under 80D, improving protection and old-regime deduction depth.",
    apply: (input) => ({
      ...input,
      monthlyExpenses: (input.monthlyExpenses || Math.round(input.annualSalary / 24)) + 2083,
      existingInvestments: {
        ...input.existingInvestments,
        section80D: (input.existingInvestments?.section80D || 0) + 25000,
      },
    }),
  },
  "child-goal": {
    title: "Child Goal",
    summary: "Adds ₹15K/month goal pressure and shifts the strategy toward liquidity-first monthly planning.",
    apply: (input) => ({
      ...input,
      monthlyExpenses: (input.monthlyExpenses || Math.round(input.annualSalary / 24)) + 15000,
      financialGoal: "higher-monthly-cash-flow",
    }),
  },
};

/* ========== FORMATTERS ========== */
function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function titleCase(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ========== API CLIENT ========== */
async function requestPlan(payload) {
  const response = await fetch(`${API_BASE_URL}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error((data.errors || ["Unable to generate plan."]).join(" "));
  }

  return data;
}

async function requestDemoPlan() {
  const response = await fetch(`${API_BASE_URL}/api/sample-plan`);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error("Unable to load demo plan.");
  }

  return data;
}

/* ========== LANDING PAGE FORM ========== */
function initPlannerForm() {
  const form = document.querySelector("#plannerForm");
  if (!form) return;

  const message = document.querySelector("#formMessage");
  const submitButton = form.querySelector(".submit-button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";

    const formData = new FormData(form);
    const annualSalary = Number(formData.get("annualSalary"));
    const monthlyExpenses = Number(formData.get("monthlyExpenses") || 0);

    if (!annualSalary || annualSalary <= 0) {
      message.textContent = "Enter a valid annual salary to generate your plan.";
      return;
    }

    if (monthlyExpenses < 0) {
      message.textContent = "Monthly expenses cannot be negative.";
      return;
    }

    const payload = {
      annualSalary,
      existingInvestments: {
        section80C: Number(formData.get("section80C") || 0),
        section80D: Number(formData.get("section80D") || 0),
        nps: Number(formData.get("nps") || 0),
      },
      taxRegimeChoice: formData.get("taxRegimeChoice"),
      financialGoal: formData.get("financialGoal"),
      age: Number(formData.get("age") || 30),
      monthlyExpenses,
    };

    try {
      submitButton.classList.add("is-loading");
      const plan = await requestPlan(payload);
      const realPlan = withPlanSource(plan, PLAN_SOURCE.real);
      localStorage.setItem(BASE_PLAN_STORAGE_KEY, JSON.stringify(realPlan));
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(realPlan));
      window.location.href = "dashboard.html";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitButton.classList.remove("is-loading");
    }
  });
}

/* ========== DASHBOARD STATE ========== */
let taxComparisonChart;
let monthlyPlanChart;
let latestRenderedPlan;
let baseScenarioInput;
let chartResizeTimer;
let isScenarioLoading = false;

function getStoredPlan() {
  try {
    return JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY));
  } catch (error) {
    return null;
  }
}

function getBasePlan() {
  try {
    return JSON.parse(localStorage.getItem(BASE_PLAN_STORAGE_KEY));
  } catch (error) {
    return null;
  }
}

function withPlanSource(plan, source) {
  return {
    ...plan,
    source,
  };
}

function isRealPlan(plan) {
  return plan?.ok && plan.source === PLAN_SOURCE.real;
}

function clearDemoAutoState() {
  const plan = getStoredPlan();
  const basePlan = getBasePlan();

  if (plan?.source === PLAN_SOURCE.demo) {
    localStorage.removeItem(PLAN_STORAGE_KEY);
  }

  if (basePlan?.source === PLAN_SOURCE.demo) {
    localStorage.removeItem(BASE_PLAN_STORAGE_KEY);
  }
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

/* ========== DASHBOARD RENDERING ========== */
function renderDashboard(plan) {
  const emptyState = document.querySelector("#emptyState");
  const dashboardContent = document.querySelector("#dashboardContent");
  if (!dashboardContent) return;

  latestRenderedPlan = plan;
  baseScenarioInput = baseScenarioInput || structuredClone(plan.input);
  emptyState.classList.add("hidden");
  dashboardContent.classList.remove("hidden");

  const oldRegime = plan.comparison.old;
  const newRegime = plan.comparison.new;
  const recommendation = plan.recommendation;
  const scenarioTitle = plan.scenario?.title;

  setText("#modelScope", `${plan.meta.taxYear} · ${plan.meta.modelScope}`);
  setText("#oldTax", formatCurrency(oldRegime.tax.total));
  setText("#newTax", formatCurrency(newRegime.tax.total));
  setText("#oldTaxable", `Taxable income ${formatCurrency(oldRegime.taxableIncome)}`);
  setText("#newTaxable", `Taxable income ${formatCurrency(newRegime.taxableIncome)}`);
  setText("#betterRegime", titleCase(plan.meta.betterRegime));
  setText("#selectedRegime", `Selected regime: ${titleCase(plan.meta.selectedRegime)}`);
  setText("#savingsDifference", formatCurrency(plan.meta.savingsDifference));
  setText("#totalAnnualPlan", `${formatCurrency(recommendation.totalAnnual)}/year`);
  renderCoachNarrative(plan);
  renderScenarioState(plan);

  renderAllocationCards(recommendation);
  renderGuardrails(plan.guardrails);
  renderCashStress(plan.cashStress);
  renderDeadlinePressure(plan.deadlinePressure);
  renderInsights(plan.insights);
  scheduleChartRender(plan);
}

function renderCoachNarrative(plan) {
  const coach = buildCoachNarrative(plan);
  const coachList = document.querySelector("#coachList");

  setText("#storyHeadline", coach.headline);
  setText("#storyBody", coach.summary);

  if (coachList) {
    coachList.innerHTML = coach.points
      .map((point) => `<div class="coach-note">${point}</div>`)
      .join("");
  }
}

function buildCoachNarrative(plan) {
  const regime = titleCase(plan.meta.betterRegime);
  const annualSalary = formatCurrency(plan.input.annualSalary);
  const monthlySavingsDelta = Math.round(plan.meta.savingsDifference / 12);
  const scenarioPrefix = plan.scenario ? `After ${plan.scenario.title.toLowerCase()}, ` : "";
  const deadline = plan.deadlinePressure || {
    monthsLeft: 12,
    requiredMonthlyCatchUp: plan.recommendation.monthly.total,
  };
  const summary = `${scenarioPrefix}${regime} regime looks strongest for a ${annualSalary} salary profile.`;
  const points = [
    `${regime} regime is ahead by ${formatCurrency(plan.meta.savingsDifference)} this year — about ${formatCurrency(monthlySavingsDelta)} per month.`,
  ];

  if (deadline.monthsLeft <= 5) {
    points.push(`With only ${deadline.monthsLeft} months left, move toward ${formatCurrency(deadline.requiredMonthlyCatchUp)}/month now to avoid March stress.`);
  } else {
    points.push(`You have ${deadline.monthsLeft} months to March, so ${formatCurrency(deadline.requiredMonthlyCatchUp)}/month keeps the plan controlled.`);
  }

  if (plan.cashStress?.level === "high") {
    points.push("Cash pressure is high; protect liquidity first and avoid forcing every deduction bucket.");
  } else if (plan.cashStress?.level === "moderate") {
    points.push("Monthly pressure is manageable, but spread contributions evenly instead of waiting for year-end.");
  } else {
    points.push("Cash flow looks healthy enough to automate the recommended tax-saving plan.");
  }

  if (plan.scenario?.key === "salary-hike") {
    points[2] = "After the salary hike, increasing NPS or ELSS gradually can improve efficiency without shocking cash flow.";
  } else if (plan.scenario?.key === "home-loan") {
    points[2] = "With EMI pressure added, keep deductions liquidity-aware and avoid aggressive lock-ins.";
  } else if (plan.scenario?.key === "parents-insurance") {
    points[2] = "Parents insurance improves protection first; treat the tax benefit as a bonus, not the only reason.";
  } else if (plan.scenario?.key === "child-goal") {
    points[2] = "The child goal makes cash discipline more important than chasing every last rupee of deduction.";
  }

  return {
    headline: plan.scenario ? `${plan.scenario.title}: coach view` : "AI coach view",
    summary,
    points: points.slice(0, 3),
  };
}

function renderAllocationCards(recommendation) {
  const allocationGrid = document.querySelector("#allocationGrid");
  if (!allocationGrid) return;

  const cards = [
    {
      section: "80C",
      amount: recommendation.section80C,
      monthly: recommendation.monthly.section80C,
      label: "ELSS + PPF / EPF",
      detail: "Core deduction bucket capped at ₹1.5L.",
    },
    {
      section: "80D",
      amount: recommendation.section80D,
      monthly: recommendation.monthly.section80D,
      label: "Health Insurance",
      detail: "Insurance-first protection with tax benefit.",
    },
    {
      section: "NPS",
      amount: recommendation.nps,
      monthly: recommendation.monthly.nps,
      label: "Tier I NPS",
      detail: "Additional 80CCD(1B) retirement deduction.",
    },
  ];

  allocationGrid.innerHTML = cards
    .map((card) => `
      <div class="allocation-card">
        <span class="tag">${card.section}</span>
        <strong>${formatCurrency(card.amount)}</strong>
        <span>${formatCurrency(card.monthly)} / month</span>
        <h3>${card.label}</h3>
        <p>${card.detail}</p>
      </div>
    `)
    .join("");
}

function renderScenarioState(plan) {
  const resetButton = document.querySelector("#resetScenarioButton");
  const chips = document.querySelectorAll(".scenario-chip");
  const activeScenario = plan.scenario?.key;

  resetButton?.classList.toggle("hidden", !activeScenario);
  setText(
    "#activeScenario",
    activeScenario ? plan.scenario.summary : "Current plan baseline. Try a life event to recalculate strategy instantly."
  );

  chips.forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.scenario === activeScenario);
  });
}

function renderGuardrails(guardrails) {
  const guardrailList = document.querySelector("#guardrailList");
  if (!guardrailList) return;

  const items = [
    ["Monthly income", formatCurrency(guardrails.monthlyIncome)],
    ["Safe tax-saving amount", `${formatCurrency(guardrails.safeMonthlyTaxSavingAmount)} / month`],
    ["Max recommended investment", `${formatCurrency(guardrails.maxRecommendedMonthlyInvestment)} / month`],
    ["Remaining free cash flow", guardrails.remainingFreeCashFlow === null ? "Add expenses for precision" : formatCurrency(guardrails.remainingFreeCashFlow)],
  ];

  guardrailList.innerHTML = `
    ${items.map(([label, value]) => `
      <div class="guardrail-item">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `).join("")}
    <div class="guardrail-item">
      <span>Planner note</span>
      <p>${guardrails.note}</p>
    </div>
  `;
}

function renderCashStress(cashStress) {
  if (!cashStress) return;

  const score = Math.round(cashStress.score || 0);
  const ring = document.querySelector("#cashStressRing");
  const pressureList = document.querySelector("#pressureList");

  setText("#cashStressLabel", cashStress.label);
  setText("#cashStressScore", score);
  setText("#cashStressSummary", cashStress.summary);

  if (ring) {
    ring.style.setProperty("--score", `${score * 3.6}deg`);
    ring.dataset.level = cashStress.level;
  }

  if (pressureList) {
    pressureList.innerHTML = cashStress.pressurePoints
      .map((point) => `<span>${point}</span>`)
      .join("");
  }
}

function renderDeadlinePressure(deadlinePressure) {
  if (!deadlinePressure) return;

  setText("#deadlineRisk", deadlinePressure.riskState);
  setText("#deadlineTimeline", `${deadlinePressure.currentMonth} → ${deadlinePressure.targetMonth}`);
  setText("#deadlineCatchUp", `${formatCurrency(deadlinePressure.requiredMonthlyCatchUp)} / month`);
  setText("#deadlineRecommendation", deadlinePressure.recommendation);
  setText("#deadlineMonths", `${deadlinePressure.monthsLeft} months left`);
  setText("#deadlineRemaining", `${formatCurrency(deadlinePressure.remainingDeductionOpportunity)} opportunity`);

  const progressBar = document.querySelector("#deadlineProgressBar");
  const panel = document.querySelector(".deadline-panel");
  if (progressBar) progressBar.style.width = `${deadlinePressure.progress}%`;
  if (panel) panel.dataset.risk = deadlinePressure.riskState.toLowerCase().replace(/\s+/g, "-");
}

function renderInsights(insights) {
  const insightList = document.querySelector("#insightList");
  if (!insightList) return;

  insightList.innerHTML = insights
    .map((insight, index) => `
      <div class="insight-item">
        <span>Insight ${index + 1}</span>
        <p>${insight}</p>
      </div>
    `)
    .join("");
}

/* ========== CHARTS ========== */
function scheduleChartRender(plan) {
  requestAnimationFrame(() => {
    renderCharts(plan);
    setTimeout(() => resizeCharts(), 120);
  });
}

function resizeCharts() {
  taxComparisonChart?.resize();
  monthlyPlanChart?.resize();
}

function renderCharts(plan) {
  const taxCanvas = document.querySelector("#taxComparisonChart");
  const monthlyCanvas = document.querySelector("#monthlyPlanChart");
  if (!taxCanvas || !monthlyCanvas) return;

  document.querySelectorAll(".chart-fallback").forEach((element) => element.remove());
  taxCanvas.classList.remove("hidden");
  monthlyCanvas.classList.remove("hidden");

  if (typeof Chart === "undefined") {
    renderChartFallback(taxCanvas, [
      ["Old regime tax", plan.comparison.old.tax.total],
      ["New regime tax", plan.comparison.new.tax.total],
    ]);
    renderChartFallback(monthlyCanvas, [
      ["80C / month", plan.recommendation.monthly.section80C],
      ["80D / month", plan.recommendation.monthly.section80D],
      ["NPS / month", plan.recommendation.monthly.nps],
    ]);
    return;
  }

  if (taxComparisonChart) taxComparisonChart.destroy();
  if (monthlyPlanChart) monthlyPlanChart.destroy();

  taxComparisonChart = new Chart(taxCanvas, {
    type: "bar",
    data: {
      labels: ["Old Regime", "New Regime"],
      datasets: [{
        label: "Annual tax",
        data: [plan.comparison.old.tax.total, plan.comparison.new.tax.total],
        backgroundColor: ["rgba(192, 132, 252, 0.78)", "rgba(110, 231, 183, 0.78)"],
        borderColor: ["rgba(192, 132, 252, 1)", "rgba(110, 231, 183, 1)"],
        borderWidth: 1,
        borderRadius: 16,
        yAxisID: "tax",
      }, {
        label: "Taxable income",
        data: [plan.comparison.old.taxableIncome, plan.comparison.new.taxableIncome],
        type: "line",
        borderColor: "rgba(96, 165, 250, 0.95)",
        backgroundColor: "rgba(96, 165, 250, 0.16)",
        borderWidth: 3,
        pointRadius: 5,
        tension: 0.35,
        yAxisID: "income",
      }],
    },
    options: getBarChartOptions("Annual tax payable"),
  });

  monthlyPlanChart = new Chart(monthlyCanvas, {
    type: "doughnut",
    data: {
      labels: ["80C", "80D", "NPS"],
      datasets: [{
        data: [
          plan.recommendation.monthly.section80C,
          plan.recommendation.monthly.section80D,
          plan.recommendation.monthly.nps,
        ],
        backgroundColor: ["#60a5fa", "#6ee7b7", "#c084fc"],
        borderColor: "rgba(8, 17, 31, 0.92)",
        borderWidth: 4,
      }],
    },
    options: getDoughnutChartOptions("Monthly allocation"),
  });
}

function renderChartFallback(canvas, rows) {
  const maxValue = Math.max(...rows.map((row) => row[1]), 1);
  canvas.classList.add("hidden");
  canvas.insertAdjacentHTML("afterend", `
    <div class="chart-fallback">
      ${rows.map(([label, value]) => `
        <div class="fallback-row">
          <span>${label}</span>
          <strong>${formatCurrency(value)}</strong>
          <i style="width: ${Math.max(8, Math.round((value / maxValue) * 100))}%"></i>
        </div>
      `).join("")}
    </div>
  `);
}

function getSharedChartPlugins(title) {
  return {
    legend: {
      labels: { color: "#c8d3e5", font: { family: "Inter", weight: "700" } },
    },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label || context.label}: ${formatCurrency(context.parsed.y ?? context.parsed)}`,
      },
    },
    title: {
      display: true,
      text: title,
      color: "#f7fbff",
      font: { family: "Inter", size: 14, weight: "800" },
    },
  };
}

function getBarChartOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: getSharedChartPlugins(title),
    scales: {
      x: {
        ticks: { color: "#9fb0c7" },
        grid: { display: false },
      },
      y: {
        display: false,
      },
      tax: {
        position: "left",
        ticks: {
          color: "#9fb0c7",
          callback: (value) => formatCurrency(value),
        },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      income: {
        position: "right",
        ticks: {
          color: "#60a5fa",
          callback: (value) => formatCurrency(value),
        },
        grid: { drawOnChartArea: false },
      },
    },
  };
}

function getDoughnutChartOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "68%",
    plugins: getSharedChartPlugins(title),
  };
}

/* ========== EXPORT SUMMARY ========== */
function buildExportText(plan) {
  const deadlinePressure = plan.deadlinePressure || {
    riskState: "Not calculated",
    requiredMonthlyCatchUp: plan.recommendation?.monthly?.total || 0,
  };
  const lines = [
    "Money OS Tax Plan",
    `${plan.meta.taxYear}`,
    "",
    plan.scenario ? `Scenario: ${plan.scenario.title}` : "Scenario: Baseline",
    `Recommended regime: ${titleCase(plan.meta.betterRegime)}`,
    `Old regime tax: ${formatCurrency(plan.comparison.old.tax.total)}`,
    `New regime tax: ${formatCurrency(plan.comparison.new.tax.total)}`,
    `Annual savings difference: ${formatCurrency(plan.meta.savingsDifference)}`,
    "",
    "Recommended monthly plan:",
    `80C: ${formatCurrency(plan.recommendation.monthly.section80C)}/month`,
    `80D: ${formatCurrency(plan.recommendation.monthly.section80D)}/month`,
    `NPS: ${formatCurrency(plan.recommendation.monthly.nps)}/month`,
    "",
    `Cash Stress Meter: ${plan.cashStress.label} (${plan.cashStress.score}/100)`,
    plan.cashStress.summary,
    "",
    `Deadline Pressure: ${deadlinePressure.riskState}`,
    `Required catch-up: ${formatCurrency(deadlinePressure.requiredMonthlyCatchUp)}/month until March`,
    "",
    "Insights:",
    ...plan.insights.map((insight) => `- ${insight}`),
  ];

  return lines.join("\n");
}

async function exportPlan() {
  if (!latestRenderedPlan) {
    alert("Generate or load a plan first.");
    return;
  }

  const text = buildExportText(latestRenderedPlan);
  if (navigator.share) {
    await navigator.share({
      title: "Money OS Tax Plan",
      text,
    });
    return;
  }

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "money-os-tax-plan.txt";
  link.click();
  URL.revokeObjectURL(url);
}

/* ========== SCENARIO SIMULATOR ========== */
function setScenarioBusy(isBusy) {
  document.querySelectorAll(".scenario-chip, #resetScenarioButton").forEach((element) => {
    element.disabled = isBusy;
  });
}

function normalizeScenarioInput(input) {
  const monthlyIncome = Math.max(1, input.annualSalary / 12);
  return {
    annualSalary: input.annualSalary,
    existingInvestments: {
      section80C: input.existingInvestments?.section80C || 0,
      section80D: input.existingInvestments?.section80D || 0,
      nps: input.existingInvestments?.nps || 0,
    },
    taxRegimeChoice: input.taxRegimeChoice || "auto",
    financialGoal: input.financialGoal || "balanced-wealth-growth",
    age: input.age || 30,
    monthlyExpenses: Math.min(input.monthlyExpenses || 0, Math.floor(monthlyIncome * 0.98)),
  };
}

async function applyScenario(scenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario || !baseScenarioInput || isScenarioLoading) return;

  const skeleton = document.querySelector("#dashboardSkeleton");
  const payload = normalizeScenarioInput(scenario.apply(structuredClone(baseScenarioInput)));

  try {
    isScenarioLoading = true;
    setScenarioBusy(true);
    skeleton?.classList.remove("hidden");
    const scenarioPlan = await requestPlan(payload);
    scenarioPlan.scenario = {
      key: scenarioKey,
      title: scenario.title,
      summary: scenario.summary,
    };
    scenarioPlan.source = latestRenderedPlan.source || PLAN_SOURCE.real;
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(scenarioPlan));
    renderDashboard(scenarioPlan);
  } catch (error) {
    alert(error.message);
  } finally {
    isScenarioLoading = false;
    setScenarioBusy(false);
    skeleton?.classList.add("hidden");
  }
}

function resetScenario() {
  const basePlan = getBasePlan();
  if (!basePlan?.ok) return;

  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(basePlan));
  baseScenarioInput = structuredClone(basePlan.input);
  renderDashboard(basePlan);
}

/* ========== DEMO PLAN UX ========== */
function initDashboard() {
  const dashboardContent = document.querySelector("#dashboardContent");
  if (!dashboardContent) return;

  clearDemoAutoState();
  const plan = getStoredPlan();
  const basePlan = getBasePlan();
  if (isRealPlan(basePlan)) baseScenarioInput = structuredClone(basePlan.input);
  if (isRealPlan(plan)) renderDashboard(plan);

  const loadDemo = async () => {
    const emptyState = document.querySelector("#emptyState");
    const skeleton = document.querySelector("#dashboardSkeleton");
    try {
      emptyState?.classList.add("hidden");
      skeleton?.classList.remove("hidden");
      const demoPlan = await requestDemoPlan();
      const sourcedDemoPlan = withPlanSource(demoPlan, PLAN_SOURCE.demo);
      localStorage.setItem(BASE_PLAN_STORAGE_KEY, JSON.stringify(sourcedDemoPlan));
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(sourcedDemoPlan));
      baseScenarioInput = structuredClone(sourcedDemoPlan.input);
      renderDashboard(sourcedDemoPlan);
    } catch (error) {
      alert(error.message);
    } finally {
      skeleton?.classList.add("hidden");
    }
  };

  document.querySelector("#demoPlanButton")?.addEventListener("click", loadDemo);
  document.querySelector("#heroDemoButton")?.addEventListener("click", loadDemo);
  document.querySelector("#emptyDemoButton")?.addEventListener("click", loadDemo);
  document.querySelector("#exportPlanButton")?.addEventListener("click", exportPlan);
  document.querySelector("#resetScenarioButton")?.addEventListener("click", resetScenario);
  document.querySelectorAll(".scenario-chip").forEach((chip) => {
    chip.addEventListener("click", () => applyScenario(chip.dataset.scenario));
  });
}

/* ========== APP BOOT ========== */
document.addEventListener("DOMContentLoaded", () => {
  initPlannerForm();
  initDashboard();
});

window.addEventListener("load", resizeCharts);
window.addEventListener("resize", () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(resizeCharts, 160);
});
