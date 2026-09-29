const clone = value => value == null ? value : structuredClone(value);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
};
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const numOrNull = v => finite(v) ? Number(v) : null;
const boolOrNull = v => typeof v === 'boolean' ? v : null;
const strOrNull = v => typeof v === 'string' && v.trim() ? v : null;

export function buildCanonicalScenarioSnapshot(raw = {}) {
  const source = clone(raw) || {};
  const assumptions = source.assumptions || {};
  const fees = source.fees || {};
  const currentDisability = source.currentDisability || {};
  const sensitivity = source.sensitivity || {};

  const snapshot = {
    schemaVersion: 'F8_CANONICAL_SCENARIO_V1',
    source: 'LEGACY_UX_READ_ONLY_ADAPTER_I0',
    person: {
      currentAge: numOrNull(source.currentAge),
      sex: strOrNull(source.sex),
      targetAge: numOrNull(source.targetAge),
    },
    spouse: {
      expected: boolOrNull(source.spouseExpected),
      age: numOrNull(source.spouseAge),
      sex: strOrNull(source.spouseSex),
    },
    capital: {
      lumpSum: numOrNull(source.lumpSum),
    },
    economics: {
      realReturn: numOrNull(assumptions.realReturn),
      nominalReturn: numOrNull(assumptions.nominalReturn),
      inflation: numOrNull(assumptions.inflation),
      fees: {
        t190: numOrNull(fees.t190),
        savingsPolicy: numOrNull(fees.savingsPolicy),
        pensionFundAccumulation: numOrNull(fees.pensionFundAccumulation),
        managedPortfolio: numOrNull(fees.managedPortfolio),
      },
    },
    pensionContext: {
      officialFactor: numOrNull(source.officialFactor),
      spouseSurvivorPct: numOrNull(source.spouseSurvivorPct),
      guaranteeMonths: numOrNull(source.guaranteeMonths),
      firstLayerAlreadySatisfied: source.firstLayerAlreadySatisfied ?? null,
      firstLayerUsedAmount: numOrNull(source.firstLayerUsedAmount),
      receivingDisabilityPensionNow: boolOrNull(currentDisability.receivingNow),
      pensionFundBalance: numOrNull(source.pensionFundBalance),
      pensionFundQualifyingBalance: numOrNull(source.pensionFundQualifyingBalance),
      pensionFundCoverageStatus: strOrNull(source.pensionFundCoverageStatus),
      pensionFundCurrentMonthlyInsuranceCost: numOrNull(source.pensionFundCurrentMonthlyInsuranceCost),
    },
    taxContext: {
      taxableAnnualIncomeKnown: numOrNull(source.taxableAnnualIncomeKnown),
      annuityTaxClass: strOrNull(source.annuityTaxClass),
    },
    mortalityProfile: {
      self: strOrNull(source.selfMortalityProfile) || 'normal',
      spouse: strOrNull(source.spouseMortalityProfile) || 'normal',
    },
    optimizerInputs: {
      currentAge: numOrNull(source.currentAge),
      sex: strOrNull(source.sex),
      targetAge: numOrNull(source.targetAge),
      spouseExpected: boolOrNull(source.spouseExpected),
      spouseAge: numOrNull(source.spouseAge),
      spouseSex: strOrNull(source.spouseSex),
      lumpSum: numOrNull(source.lumpSum),
      assumptions: {
        realReturn: numOrNull(assumptions.realReturn),
        nominalReturn: numOrNull(assumptions.nominalReturn),
        inflation: numOrNull(assumptions.inflation),
      },
      fees: {
        t190: numOrNull(fees.t190),
        savingsPolicy: numOrNull(fees.savingsPolicy),
        pensionFundAccumulation: numOrNull(fees.pensionFundAccumulation),
        managedPortfolio: numOrNull(fees.managedPortfolio),
      },
      currentDisability: {
        receivingNow: boolOrNull(currentDisability.receivingNow),
      },
      mortalityProfile: {
        self: strOrNull(source.selfMortalityProfile) || 'normal',
        spouse: strOrNull(source.spouseMortalityProfile) || 'normal',
      },
    },
    sensitivityOnly: {
      memberDeathAge: numOrNull(sensitivity.memberDeathAge),
      spouseDeathAge: numOrNull(sensitivity.spouseDeathAge),
      disabilityEventAge: numOrNull(sensitivity.disabilityEventAge),
      excludedFromExAnteOptimizer: true,
    },
    provenance: {
      feePensionFund: source.provenance?.feePensionFund || null,
      managedPortfolioFee: source.provenance?.managedPortfolioFee || 'MISSING_UI_CONTROL',
      deathAges: 'SCENARIO_SENSITIVITY_ONLY',
      disabilityEventAge: 'CONTINGENCY_REOPTIMIZER_ONLY',
    },
  };

  return freeze(snapshot);
}

export function integrationReadiness(snapshot, capabilities = {}) {
  const missingInputs = [];
  const featureBlocks = [];
  if (snapshot?.economics?.fees?.managedPortfolio == null) missingInputs.push('managedPortfolioFee');
  if (snapshot?.economics?.fees?.pensionFundAccumulation == null) missingInputs.push('pensionFundAccumulationFee');
  if (!capabilities.productionRotationAdapters) featureBlocks.push('PRODUCTION_ROTATION_ADAPTERS');
  if (!capabilities.qualifyingTimeline) featureBlocks.push('F8_2_QUALIFYING_TIMELINE');
  if (!capabilities.jointAllocator) featureBlocks.push('JOINT_ALLOCATOR');
  if (!capabilities.longAnnuitization) featureBlocks.push('LONG_OPTIONAL_ANNUITIZATION');
  if (!capabilities.taxableHarvesting) featureBlocks.push('TAXABLE_HARVESTING');
  if (!capabilities.disabilityReoptimizer) featureBlocks.push('DISABILITY_CONTINGENCY_REOPTIMIZER');
  return freeze({
    status: featureBlocks.length ? 'PARTIAL_INTEGRATION_ONLY' : 'READY_FOR_FULL_BINDING',
    canonicalSnapshotReady: true,
    missingInputs,
    featureBlocks,
    liveF81BindingAllowed: !!capabilities.productionRotationAdapters,
  });
}