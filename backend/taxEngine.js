// ========== TAX CONSTANTS ==========
const TAX_YEAR = "FY 2025-26 / AY 2026-27";
const CESS_RATE = 0.04;

const LIMITS = {
  standardDeductionOld: 50000,
  standardDeductionNew: 75000,
  section80C: 150000,
  section80DNonSenior: 25000,
  section80DSenior: 50000,
  nps80CCD1B: 50000,
  oldRegimeRebateIncomeLimit: 500000,
  oldRegimeRebateLimit: 12500,
  newRegimeRebateIncomeLimit: 1200000,
  newRegimeRebateLimit: 60000,
};

const OLD_SLABS = [
  { upto: 250000, rate: 0 },
  { upto: 500000, rate: 0.05 },
  { upto: 1000000, rate: 0.2 },
  { upto: Infinity, rate: 0.3 },
];

const NEW_SLABS = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.1 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.2 },
  { upto: 2400000, rate: 0.25 },
  { upto: Infinity, rate: 0.3 },
];

// ========== INPUT NORMALIZATION ==========
function toRupees(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function normalizeExistingInvestments(existingInvestments = {}) {
  if (typeof existingInvestments === "number") {
    return {
      section80C: toRupees(existingInvestments),
      section80D: 0,
      nps: 0,
    };
  }

  return {
    section80C: toRupees(existingInvestments.section80C ?? existingInvestments.eightyC),
    section80D: toRupees(existingInvestments.section80D ?? existingInvestments.eightyD),
    parents80D: toRupees(existingInvestments.parents80D),
    nps: toRupees(existingInvestments.nps ?? existingInvestments.section80CCD1B),
  };
}

function normalizeInput(input = {}) {
  const annualSalary = toRupees(input.annualSalary ?? input.salary);
  const age = toRupees(input.age) || 30;
  const monthlyExpenses = toRupees(input.monthlyExpenses);
  const taxRegimeChoice = String(input.taxRegimeChoice ?? "auto").toLowerCase();
  const financialGoal = String(input.financialGoal ?? "max-tax-savings").toLowerCase();

  return {
    annualSalary,
    age,
    monthlyExpenses,
    taxRegimeChoice,
    financialGoal,
    existingInvestments: normalizeExistingInvestments(input.existingInvestments),
  };
}

function validateInput(input) {
  const errors = [];

  if (!input.annualSalary) errors.push("Annual salary is required and must be greater than 0.");
  if (input.annualSalary > 100000000) errors.push("Annual salary is unusually high for this MVP model.");
  if (input.age < 18 || input.age > 100) errors.push("Age must be between 18 and 100.");
  if (input.monthlyExpenses && input.monthlyExpenses * 12 > input.annualSalary) {
    errors.push("Monthly expenses cannot exceed annual salary across the year.");
  }

  return errors;
}

// ========== TAX CALCULATION ==========
function calculateSlabTax(taxableIncome, slabs) {
  let tax = 0;
  let lowerBound = 0;

  for (const slab of slabs) {
    if (taxableIncome > lowerBound) {
      const taxableInSlab = Math.min(taxableIncome, slab.upto) - lowerBound;
      tax += taxableInSlab * slab.rate;
      lowerBound = slab.upto;
    }
  }

  return Math.max(0, Math.round(tax));
}

function calculateSurcharge(baseTax, taxableIncome, regime) {
  if (taxableIncome <= 5000000) return 0;
  if (taxableIncome <= 10000000) return Math.round(baseTax * 0.1);
  if (taxableIncome <= 20000000) return Math.round(baseTax * 0.15);
  if (taxableIncome <= 50000000) return Math.round(baseTax * 0.25);
  return Math.round(baseTax * (regime === "old" ? 0.37 : 0.25));
}

function applyRebate(baseTax, taxableIncome, regime) {
  if (regime === "old" && taxableIncome <= LIMITS.oldRegimeRebateIncomeLimit) {
    return Math.max(0, baseTax - LIMITS.oldRegimeRebateLimit);
  }

  if (regime === "new" && taxableIncome <= LIMITS.newRegimeRebateIncomeLimit) {
    return Math.max(0, baseTax - LIMITS.newRegimeRebateLimit);
  }

  if (regime === "new" && taxableIncome > LIMITS.newRegimeRebateIncomeLimit) {
    const incomeAboveRebateLimit = taxableIncome - LIMITS.newRegimeRebateIncomeLimit;
    return Math.min(baseTax, incomeAboveRebateLimit);
  }

  return baseTax;
}

function calculateOldRegime(input, plannedAllocation) {
  const total80C = Math.min(LIMITS.section80C, input.existingInvestments.section80C + plannedAllocation.section80C);
  const total80D = Math.min(get80DLimit(input.age), input.existingInvestments.section80D + plannedAllocation.section80D) + input.existingInvestments.parents80D;
  const totalNps = Math.min(LIMITS.nps80CCD1B, input.existingInvestments.nps + plannedAllocation.nps);
  const deductions = LIMITS.standardDeductionOld + total80C + total80D + totalNps;
  const taxableIncome = Math.max(0, input.annualSalary - deductions);
  const slabTax = calculateSlabTax(taxableIncome, OLD_SLABS);
  const taxAfterRebate = applyRebate(slabTax, taxableIncome, "old");
  const surcharge = calculateSurcharge(taxAfterRebate, taxableIncome, "old");
  const cess = Math.round((taxAfterRebate + surcharge) * CESS_RATE);

  return {
    regime: "old",
    grossIncome: input.annualSalary,
    taxableIncome,
    deductions: {
      standardDeduction: LIMITS.standardDeductionOld,
      section80C: total80C,
      section80D: total80D,
      nps80CCD1B: totalNps,
      total: deductions,
    },
    tax: {
      slabTax,
      rebate: slabTax - taxAfterRebate,
      surcharge,
      cess,
      total: taxAfterRebate + surcharge + cess,
    },
  };
}

function calculateNewRegime(input) {
  const deductions = LIMITS.standardDeductionNew;
  const taxableIncome = Math.max(0, input.annualSalary - deductions);
  const slabTax = calculateSlabTax(taxableIncome, NEW_SLABS);
  const taxAfterRebate = applyRebate(slabTax, taxableIncome, "new");
  const surcharge = calculateSurcharge(taxAfterRebate, taxableIncome, "new");
  const cess = Math.round((taxAfterRebate + surcharge) * CESS_RATE);

  return {
    regime: "new",
    grossIncome: input.annualSalary,
    taxableIncome,
    deductions: {
      standardDeduction: LIMITS.standardDeductionNew,
      section80C: 0,
      section80D: 0,
      nps80CCD1B: 0,
      total: deductions,
    },
    tax: {
      slabTax,
      rebate: slabTax - taxAfterRebate,
      surcharge,
      cess,
      total: taxAfterRebate + surcharge + cess,
    },
  };
}

// ========== RECOMMENDATION ENGINE ==========
function get80DLimit(age) {
  return age >= 60 ? LIMITS.section80DSenior : LIMITS.section80DNonSenior;
}

function buildRecommendedAllocation(input) {
  const remaining80C = Math.max(0, LIMITS.section80C - input.existingInvestments.section80C);
  const remaining80D = Math.max(0, get80DLimit(input.age) - input.existingInvestments.section80D);
  const remainingNps = Math.max(0, LIMITS.nps80CCD1B - input.existingInvestments.nps);
  const grossMonthlyIncome = input.annualSalary / 12;
  const monthlyFreeCash = Math.max(0, grossMonthlyIncome - input.monthlyExpenses);

  let affordabilityFactor = 0.35;
  if (input.financialGoal.includes("cash")) affordabilityFactor = 0.18;
  if (input.financialGoal.includes("balanced")) affordabilityFactor = 0.28;

  const annualCapacity = input.monthlyExpenses ? monthlyFreeCash * affordabilityFactor * 12 : input.annualSalary * 0.12;
  const targetPool = Math.min(remaining80C + remaining80D + remainingNps, Math.round(annualCapacity));

  const section80D = Math.min(remaining80D, targetPool);
  const afterProtection = Math.max(0, targetPool - section80D);
  const npsWeight = input.financialGoal.includes("cash") ? 0.2 : input.financialGoal.includes("balanced") ? 0.32 : 0.4;
  const nps = Math.min(remainingNps, afterProtection * npsWeight);
  const section80C = Math.min(remaining80C, Math.max(0, afterProtection - nps));

  return {
    section80C: Math.round(section80C),
    section80D: Math.round(section80D),
    nps: Math.round(nps),
    totalAnnual: Math.round(section80C + section80D + nps),
    monthly: {
      section80C: Math.round(section80C / 12),
      section80D: Math.round(section80D / 12),
      nps: Math.round(nps / 12),
      total: Math.round((section80C + section80D + nps) / 12),
    },
    products: [
      { section: "80C", name: "ELSS SIP", annualAmount: Math.round(section80C * 0.6), reason: "Market-linked tax saving with shortest 80C lock-in." },
      { section: "80C", name: "PPF / EPF top-up", annualAmount: Math.round(section80C * 0.4), reason: "Stable long-term compounding and retirement ballast." },
      { section: "80D", name: "Health Insurance", annualAmount: Math.round(section80D), reason: "Protects downside while reducing taxable income." },
      { section: "NPS", name: "Tier I NPS", annualAmount: Math.round(nps), reason: "Additional 80CCD(1B) deduction beyond 80C." },
    ].filter((item) => item.annualAmount > 0),
  };
}

function buildGuardrails(input, allocation, preferredRegime) {
  const monthlyIncome = Math.round(input.annualSalary / 12);
  const safeMonthlyTaxSavingAmount = allocation.monthly.total;
  const maxRecommendedMonthlyInvestment = input.monthlyExpenses
    ? Math.round(Math.max(0, monthlyIncome - input.monthlyExpenses) * 0.35)
    : Math.round(monthlyIncome * 0.15);
  const remainingFreeCashFlow = input.monthlyExpenses
    ? Math.round(monthlyIncome - input.monthlyExpenses - safeMonthlyTaxSavingAmount)
    : null;

  return {
    monthlyIncome,
    monthlyExpenses: input.monthlyExpenses || null,
    safeMonthlyTaxSavingAmount,
    maxRecommendedMonthlyInvestment,
    remainingFreeCashFlow,
    riskFlag: remainingFreeCashFlow !== null && remainingFreeCashFlow < 0 ? "tight_cashflow" : "healthy",
    note: preferredRegime === "new"
      ? "New regime wins on simplicity; keep tax-saving investments only if they match your wealth goals."
      : "Old regime benefits from disciplined monthly investing across 80C, 80D and NPS.",
  };
}

function buildCashStressMeter(input, allocation, guardrails) {
  if (!input.monthlyExpenses) {
    return {
      score: 78,
      level: "unknown",
      label: "Needs expense data",
      summary: "Add monthly expenses to turn this into a personalized cash stress score.",
      pressurePoints: ["Expense data missing", "Using salary-based investment guardrail"],
    };
  }

  const expenseRatio = input.monthlyExpenses / guardrails.monthlyIncome;
  const investingRatio = allocation.monthly.total / Math.max(1, guardrails.monthlyIncome);
  const freeCashRatio = Math.max(0, guardrails.remainingFreeCashFlow) / Math.max(1, guardrails.monthlyIncome);
  const score = Math.max(0, Math.min(100, Math.round(100 - expenseRatio * 55 - investingRatio * 35 + freeCashRatio * 18)));
  const level = score >= 75 ? "low" : score >= 52 ? "moderate" : "high";
  const label = level === "low" ? "Low stress" : level === "moderate" ? "Watch zone" : "High stress";
  const summary = level === "low"
    ? "Your plan leaves enough monthly oxygen after expenses and tax-saving investments."
    : level === "moderate"
      ? "This plan works, but avoid front-loading deductions into one quarter."
      : "Cash flow is tight; prioritize insurance and liquidity before locking more money.";

  return {
    score,
    level,
    label,
    summary,
    pressurePoints: [
      `Expenses consume ${Math.round(expenseRatio * 100)}% of monthly income.`,
      `Tax-saving plan uses ${Math.round(investingRatio * 100)}% of monthly income.`,
      `Projected free cash after plan is ₹${Math.max(0, guardrails.remainingFreeCashFlow).toLocaleString("en-IN")}/month.`,
    ],
  };
}

function buildDeadlinePressure(allocation, guardrails, currentDate = new Date()) {
  const monthIndex = currentDate.getMonth();
  const monthsLeft = monthIndex <= 2 ? 3 - monthIndex : 15 - monthIndex;
  const remainingDeductionOpportunity = allocation.totalAnnual;
  const requiredMonthlyCatchUp = monthsLeft > 0 ? Math.ceil(remainingDeductionOpportunity / monthsLeft) : remainingDeductionOpportunity;
  const monthlyCapacity = Math.max(1, guardrails.maxRecommendedMonthlyInvestment);
  const pressureRatio = requiredMonthlyCatchUp / monthlyCapacity;
  const progress = remainingDeductionOpportunity > 0
    ? Math.max(0, Math.min(100, Math.round((allocation.monthly.total / requiredMonthlyCatchUp) * 100)))
    : 100;

  let riskState = "Comfortable";
  if (pressureRatio > 1) riskState = "March Panic Risk";
  else if (pressureRatio > 0.72) riskState = "Tight";

  const recommendation = riskState === "Comfortable"
    ? "You can spread deductions calmly across the remaining financial year."
    : riskState === "Tight"
      ? "Start now and avoid pushing too much tax saving into February or March."
      : "Monthly catch-up exceeds the safe guardrail; reduce lock-ins or increase liquidity first.";

  return {
    currentMonth: currentDate.toLocaleString("en-IN", { month: "long" }),
    targetMonth: "March",
    monthsLeft,
    remainingDeductionOpportunity,
    requiredMonthlyCatchUp,
    riskState,
    progress,
    recommendation,
  };
}

function buildInsights(oldRegime, newRegime, allocation, guardrails, cashStress) {
  const betterRegime = oldRegime.tax.total <= newRegime.tax.total ? "old" : "new";
  const savingsDifference = Math.abs(oldRegime.tax.total - newRegime.tax.total);
  const monthlyTaxDelta = Math.round(savingsDifference / 12);
  const insights = [
    `${betterRegime === "old" ? "Old" : "New"} regime is ahead by ₹${savingsDifference.toLocaleString("en-IN")} a year — roughly ₹${monthlyTaxDelta.toLocaleString("en-IN")} back into monthly cash flow.`,
    `Set aside ₹${allocation.monthly.total.toLocaleString("en-IN")} monthly instead of scrambling in March; it turns tax planning into a habit, not a fire drill.`,
  ];

  if (cashStress.level === "high" || guardrails.riskFlag === "tight_cashflow") {
    insights.push("Cash flow is the constraint here. Fully optimize deductions only after emergency liquidity is protected.");
  } else if (cashStress.level === "moderate") {
    insights.push("The plan is workable, but spread contributions evenly and avoid a large year-end lump sum.");
  } else if (betterRegime === "old") {
    insights.push("Old regime is compelling because your available deductions are large enough to beat the simpler new-regime slabs.");
  } else {
    insights.push("New regime wins on simplicity; keep ELSS, PPF or NPS only where they also match your wealth goals.");
  }

  if (allocation.section80D > 0) {
    insights.push("Health insurance is treated as the first rupee of planning because one medical shock can break an otherwise elegant tax plan.");
  }

  return insights;
}

// ========== PUBLIC PLANNER API ==========
function generatePlan(rawInput) {
  const input = normalizeInput(rawInput);
  const errors = validateInput(input);

  if (errors.length) {
    return { ok: false, errors };
  }

  const recommendedAllocation = buildRecommendedAllocation(input);
  const oldRegime = calculateOldRegime(input, recommendedAllocation);
  const newRegime = calculateNewRegime(input);
  const betterRegime = oldRegime.tax.total <= newRegime.tax.total ? "old" : "new";
  const userChoice = input.taxRegimeChoice;
  const selectedRegime = userChoice.includes("old") ? "old" : userChoice.includes("new") ? "new" : betterRegime;
  const guardrails = buildGuardrails(input, recommendedAllocation, selectedRegime);
  const cashStress = buildCashStressMeter(input, recommendedAllocation, guardrails);
  const deadlinePressure = buildDeadlinePressure(recommendedAllocation, guardrails);

  return {
    ok: true,
    meta: {
      taxYear: TAX_YEAR,
      selectedRegime,
      betterRegime,
      savingsDifference: Math.abs(oldRegime.tax.total - newRegime.tax.total),
      modelScope: "Resident salaried individual; excludes HRA, home-loan interest, employer NPS and capital gains.",
    },
    input,
    comparison: {
      old: oldRegime,
      new: newRegime,
    },
    recommendation: recommendedAllocation,
    guardrails,
    cashStress,
    deadlinePressure,
    insights: buildInsights(oldRegime, newRegime, recommendedAllocation, guardrails, cashStress),
  };
}

module.exports = {
  generatePlan,
  calculateSlabTax,
  LIMITS,
  OLD_SLABS,
  NEW_SLABS,
};
