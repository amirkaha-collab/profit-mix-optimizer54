import { buildCanonicalScenarioSnapshot, integrationReadiness } from './f8-canonical-snapshot.js';

const $ = id => document.getElementById(id);
const finite = v => Number.isFinite(Number(v));
const pct = id => finite($(id)?.value) ? Number($(id).value) / 100 : null;
const activeData = (selector, key) => {
  const el = document.querySelector(`${selector} .scenario-btn.active`);
  return el && finite(el.dataset?.[key]) ? Number(el.dataset[key]) : null;
};
const controllerState = () => {
  try { return window.InheritanceResultsControllerS16A?.getState?.() || {}; } catch (_) { return {}; }
};
const ctx = () => {
  try { return window.AppBridgeS54?.inheritanceContext?.() || {}; } catch (_) { return {}; }
};

function legacySource() {
  const c = ctx();
  const input = c.lastInput || {};
  const a = c.lastOut?.accumulation?.primary?.assumptions || {};
  const decision = c.decision || {};
  const rs = controllerState();
  const realReturn = finite(a.realReturn) ? Number(a.realReturn) : activeData('#returnScenarioButtons', 'return');
  const inflation = finite(a.inflation) ? Number(a.inflation) : activeData('#inflationScenarioButtons', 'inflation');
  const nominalReturn = finite(a.nominalReturn) ? Number(a.nominalReturn) : (finite(realReturn) && finite(inflation) ? (1 + realReturn) * (1 + inflation) - 1 : null);

  return {
    currentAge: input.currentAge ?? $('currentAge')?.value,
    sex: input.sex ?? $('sex')?.value ?? $('sexAnnuity')?.value,
    targetAge: input.targetAge ?? $('targetAge')?.value,
    spouseExpected: c.spouseExpected,
    spouseAge: c.spouseAge ?? input.spouseAge ?? $('spouseAge')?.value,
    spouseSex: c.spouseSex ?? input.spouseSex ?? $('spouseSex')?.value,
    lumpSum: input.lumpSum ?? $('lumpSum')?.value,
    assumptions: { realReturn, nominalReturn, inflation },
    fees: {
      t190: finite(a.fee190) ? Number(a.fee190) : pct('fee190'),
      savingsPolicy: finite(a.feePolicy) ? Number(a.feePolicy) : pct('feePolicy'),
      pensionFundAccumulation: pct('feePensionFund'),
      managedPortfolio: null,
    },
    officialFactor: input.officialFactor,
    spouseSurvivorPct: input.spouseSurvivorPct,
    guaranteeMonths: input.guaranteeMonths,
    firstLayerAlreadySatisfied: input.firstLayerAlreadySatisfied,
    firstLayerUsedAmount: input.firstLayerUsedAmount,
    taxableAnnualIncomeKnown: input.taxableAnnualIncomeKnown,
    annuityTaxClass: input.annuityTaxClass,
    currentDisability: { receivingNow: input.receivingDisabilityPension },
    pensionFundBalance: $('k10h5FundTotal')?.value,
    pensionFundQualifyingBalance: $('k10h5FundQ')?.value,
    pensionFundCoverageStatus: $('k10h5CoverageStatus')?.value,
    pensionFundCurrentMonthlyInsuranceCost: $('k10h5FundPremium')?.value,
    selfMortalityProfile: decision.selfStrategyProfile ?? decision.selfProfile ?? 'normal',
    spouseMortalityProfile: decision.spouseStrategyProfile ?? decision.spouseProfile ?? 'normal',
    sensitivity: {
      memberDeathAge: rs.deathAge ?? $('s15DeathNumber')?.value ?? $('inheritanceExactAgeS69')?.value,
      spouseDeathAge: $('h12bSpouseDeathNumber')?.value ?? $('h12InhSpouseNum')?.value,
      disabilityEventAge: rs.disabilityAge ?? $('s15DisabilityNumber')?.value,
    },
    provenance: {
      feePensionFund: $('feePensionFund') ? 'DOM_ASSUMPTION_CONTROL' : 'MISSING_UI_CONTROL',
      managedPortfolioFee: 'MISSING_UI_CONTROL',
    },
  };
}

function snapshot() { return buildCanonicalScenarioSnapshot(legacySource()); }
function readiness() {
  return integrationReadiness(snapshot(), {
    productionRotationAdapters: false,
    qualifyingTimeline: false,
    jointAllocator: false,
    longAnnuitization: false,
    taxableHarvesting: false,
    disabilityReoptimizer: false,
  });
}
function publish() {
  const detail = snapshot();
  const r = readiness();
  document.documentElement.dataset.f8IntegrationStage = 'I0';
  document.documentElement.dataset.f8IntegrationStatus = r.status;
  document.dispatchEvent(new CustomEvent('f8:canonical-snapshot', { detail }));
  return detail;
}
let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(publish, 40); }

document.addEventListener('input', schedule, true);
document.addEventListener('change', schedule, true);
document.addEventListener('inheritance:model-committed', schedule);
window.addEventListener('pageshow', schedule);

window.F8IntegrationBridgeV1 = Object.freeze({
  version: 'I0-CANONICAL-SNAPSHOT',
  snapshot,
  readiness,
  publish,
  optimizerInputs: () => snapshot().optimizerInputs,
  sensitivityOnly: () => snapshot().sensitivityOnly,
});

schedule();