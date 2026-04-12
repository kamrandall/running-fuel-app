import {
  BUILT_IN_FUELS,
  GUT_TOLERANCE_OPTIONS,
  HYROX_STATIONS,
  PACE_OPTIONS,
  RUN_TYPE_LABELS,
  STORAGE_KEYS,
  SWEAT_RATE_OPTIONS
} from "./constants.js";
import {
  buildGutTrainingPlan,
  buildHyroxPlan,
  buildRunPlan,
  calculateDailyMacros,
  calculateSweatRate,
  estimateDurationMinutes,
  formatClock,
  round
} from "./calculations.js";

const calculatorForm = document.querySelector("#calculator-form");
const hyroxForm = document.querySelector("#hyrox-form");
const sweatForm = document.querySelector("#sweat-form");
const gutForm = document.querySelector("#gut-form");
const macroForm = document.querySelector("#macro-form");
const fuelSelect = document.querySelector("#fuel-select");
const hyroxFuelSelect = document.querySelector("#hyrox-fuel-select");
const sweatRateSelect = document.querySelector("#sweat-rate-select");
const hyroxSweatRateSelect = document.querySelector("#hyrox-sweat-rate-select");
const gutToleranceSelect = document.querySelector("#gut-tolerance-select");
const paceSelect = document.querySelector("#pace-select");
const hyroxPaceSelect = document.querySelector("#hyrox-pace-select");
const durationDisplay = document.querySelector("#duration-display");
const hyroxDurationDisplay = document.querySelector("#hyrox-duration-display");
const heatExposureField = document.querySelector("#heat-exposure-field");
const appTabButtons = document.querySelectorAll(".app-tab-button");
const runningApp = document.querySelector("#running-app");
const hyroxApp = document.querySelector("#hyrox-app");
const tabButtons = calculatorForm.querySelectorAll(".segment-tabs .tab-button");
const professionalFuelPanel = document.querySelector("#professional-fuel-panel");
const customFuelPanel = document.querySelector("#custom-fuel-panel");
const hyroxFuelTabButtons = document.querySelectorAll(".hyrox-fuel-tab-button");
const hyroxProfessionalFuelPanel = document.querySelector("#hyrox-professional-fuel-panel");
const hyroxCustomFuelPanel = document.querySelector("#hyrox-custom-fuel-panel");

const sessionSummary = document.querySelector("#session-summary");
const safetyList = document.querySelector("#safety-list");
const fuelTimeline = document.querySelector("#fuel-timeline");
const hydrationTimeline = document.querySelector("#hydration-timeline");
const mathList = document.querySelector("#math-list");
const productNotes = document.querySelector("#product-notes");
const sweatResult = document.querySelector("#sweat-result");
const gutPlanOutput = document.querySelector("#gut-plan");
const macroResult = document.querySelector("#macro-result");
const hyroxSummary = document.querySelector("#hyrox-summary");
const hyroxWarnings = document.querySelector("#hyrox-warnings");
const hyroxDailyTargets = document.querySelector("#hyrox-daily-targets");
const hyroxFoodsEat = document.querySelector("#hyrox-foods-eat");
const hyroxFoodsAvoid = document.querySelector("#hyrox-foods-avoid");
const hyroxTiming = document.querySelector("#hyrox-timing");
const hyroxFuelTimeline = document.querySelector("#hyrox-fuel-timeline");
const hyroxHydration = document.querySelector("#hyrox-hydration");
const hyroxRoxzone = document.querySelector("#hyrox-roxzone");
const hyroxBreakdown = document.querySelector("#hyrox-breakdown");

const heroCarbTarget = document.querySelector("#hero-carb-target");
const heroFluidTarget = document.querySelector("#hero-fluid-target");
const heroSodiumTarget = document.querySelector("#hero-sodium-target");

const HEAT_EXPOSURE_THRESHOLD_C = 29.5;

const state = {
  profile: readStorage(STORAGE_KEYS.profile, null),
  lastRun: readStorage(STORAGE_KEYS.lastRun, null),
  hyroxProfile: readStorage(STORAGE_KEYS.hyroxProfile, null),
  hyroxLastPlan: readStorage(STORAGE_KEYS.hyroxLastPlan, null),
  fuelMode: "professional",
  hyroxFuelMode: "professional",
  activeTab: readStorage(STORAGE_KEYS.activeTab, "running")
};

function fahrenheitToCelsius(value) {
  return (value - 32) * (5 / 9);
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatFlaskPart(value) {
  const denominators = [2, 3, 4, 5, 6, 8, 10];
  let best = { numerator: 1, denominator: 1, error: Infinity };

  for (const denominator of denominators) {
    const numerator = Math.max(1, Math.round(value * denominator));
    const error = Math.abs(value - numerator / denominator);
    if (error < best.error) {
      best = { numerator, denominator, error };
    }
  }

  if (best.numerator >= best.denominator) {
    return "1 full flask";
  }

  return `${best.numerator}/${best.denominator} of a flask`;
}

function formatFuelDistanceMarker(minute, paceMinPerKm, distanceKm) {
  const estimatedKm = Math.min(round(minute / paceMinPerKm, 1), distanceKm);
  return `~${estimatedKm} km`;
}

function renderOptions(select, options, formatter = (option) => option.label) {
  select.innerHTML = "";
  for (const optionData of options) {
    const option = document.createElement("option");
    option.value = String(optionData.value);
    option.textContent = formatter(optionData);
    select.appendChild(option);
  }
}

function renderFuelOptions(select, selectedKey) {
  select.innerHTML = "";
  for (const fuel of BUILT_IN_FUELS) {
    const option = document.createElement("option");
    option.value = fuel.key;
    option.textContent = `${fuel.name} · ${fuel.carbsPerServing}g carbs · ${fuel.sodiumPerServing}mg Na`;
    option.selected = fuel.key === selectedKey;
    select.appendChild(option);
  }
}

function getFuelByKey(key) {
  return BUILT_IN_FUELS.find((fuel) => fuel.key === key) ?? BUILT_IN_FUELS[0];
}

function setSelectToNumericValue(select, value, labelPrefix) {
  const stringValue = String(value);
  const matchingOption = Array.from(select.options).find((option) => option.value === stringValue);
  if (matchingOption) {
    select.value = stringValue;
    return;
  }

  const customOption = document.createElement("option");
  customOption.value = stringValue;
  customOption.textContent = `${labelPrefix} (${value})`;
  customOption.dataset.customOption = "true";

  const existingCustomOption = select.querySelector('[data-custom-option="true"]');
  if (existingCustomOption) {
    existingCustomOption.remove();
  }

  select.prepend(customOption);
  select.value = stringValue;
}

function setFuelMode(mode) {
  state.fuelMode = mode;

  for (const button of tabButtons) {
    button.classList.toggle("is-active", button.dataset.fuelMode === mode);
    button.setAttribute("aria-selected", button.dataset.fuelMode === mode ? "true" : "false");
  }

  const customFields = customFuelPanel.querySelectorAll("input, select");
  const useCustom = mode === "custom";
  professionalFuelPanel.hidden = useCustom;
  customFuelPanel.hidden = !useCustom;

  for (const field of customFields) {
    field.disabled = !useCustom;
    if (field.name !== "customNotes") {
      field.required = useCustom;
    }
  }
}

function setHyroxFuelMode(mode) {
  state.hyroxFuelMode = mode;

  for (const button of hyroxFuelTabButtons) {
    button.classList.toggle("is-active", button.dataset.hyroxFuelMode === mode);
    button.setAttribute("aria-selected", button.dataset.hyroxFuelMode === mode ? "true" : "false");
  }

  const customFields = hyroxCustomFuelPanel.querySelectorAll("input, select");
  const useCustom = mode === "custom";
  hyroxProfessionalFuelPanel.hidden = useCustom;
  hyroxCustomFuelPanel.hidden = !useCustom;

  for (const field of customFields) {
    field.disabled = !useCustom;
    if (field.name !== "customNotes") {
      field.required = useCustom;
    }
  }
}

function setAppTab(tab) {
  state.activeTab = tab;
  writeStorage(STORAGE_KEYS.activeTab, tab);

  for (const button of appTabButtons) {
    button.classList.toggle("is-active", button.dataset.appTab === tab);
    button.setAttribute("aria-selected", button.dataset.appTab === tab ? "true" : "false");
  }

  runningApp.hidden = tab !== "running";
  hyroxApp.hidden = tab !== "hyrox";
}

function syncActiveTabPlan() {
  if (state.activeTab === "hyrox") {
    handleHyroxSubmit(new Event("submit", { cancelable: true }));
  } else {
    handleCalculatorSubmit(new Event("submit", { cancelable: true }));
  }
}

function fillCalculatorDefaults() {
  const baseDefaults = {
    sex: "female",
    weightKg: 62,
    sweatRateLHr: 0.8,
    gutToleranceGHr: 60,
    sweatSaltiness: "average",
    runType: "long",
    distanceKm: 22,
    paceMinPerKm: 5.75,
    temperatureC: 18,
    humidityPercent: 58,
    acclimatizationDays: 8,
    fuelKey: "sis-beta-fuel",
    fuelMode: "professional",
    customFuelName: "Maple syrup bottle",
    customServingSizeGrams: 30,
    customCarbsPer100g: 86,
    customSodiumPer100g: 8,
    customTransportType: "single",
    customNotes: ""
  };
  const defaults = {
    ...baseDefaults,
    ...(state.profile ?? {})
  };

  if (!defaults.temperatureC && defaults.temperatureF) {
    defaults.temperatureC = round(fahrenheitToCelsius(Number(defaults.temperatureF)), 1);
  }

  renderOptions(sweatRateSelect, SWEAT_RATE_OPTIONS);
  renderOptions(gutToleranceSelect, GUT_TOLERANCE_OPTIONS);
  renderOptions(paceSelect, PACE_OPTIONS);
  renderFuelOptions(fuelSelect, defaults.fuelKey);

  for (const [key, value] of Object.entries(defaults)) {
    const field = calculatorForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  }

  setSelectToNumericValue(sweatRateSelect, defaults.sweatRateLHr, "Measured sweat rate");
  setSelectToNumericValue(gutToleranceSelect, defaults.gutToleranceGHr, "Measured gut tolerance");
  const storedPace = Number(defaults.paceMinPerKm);
  const nearestPace = PACE_OPTIONS.reduce((closest, option) => {
    return Math.abs(option.value - storedPace) < Math.abs(closest.value - storedPace) ? option : closest;
  }, PACE_OPTIONS[0]);
  paceSelect.value = String(nearestPace.value);
  setFuelMode(defaults.fuelMode ?? "professional");
  updateCalculatedDuration();
  updateHeatExposureVisibility();

  sweatForm.elements.namedItem("durationMinutes").value = 60;
  sweatForm.elements.namedItem("preMassKg").value = defaults.weightKg;
  sweatForm.elements.namedItem("postMassKg").value = round(defaults.weightKg - 0.8, 2);
  sweatForm.elements.namedItem("fluidLiters").value = 0.5;

  gutForm.elements.namedItem("currentWeek").value = 4;
  gutForm.elements.namedItem("goalCarbsHr").value = 90;
  gutForm.elements.namedItem("currentToleranceGHr").value = defaults.gutToleranceGHr;
  gutForm.elements.namedItem("symptomSeverity").value = "none";

  macroForm.elements.namedItem("sex").value = defaults.sex;
  macroForm.elements.namedItem("weightKg").value = defaults.weightKg;
  macroForm.elements.namedItem("trainingHours").value = 1.5;
}

function applyHyroxStationDefaults(sex) {
  for (const station of HYROX_STATIONS) {
    const field = hyroxForm.elements.namedItem(station.key);
    if (!field) {
      continue;
    }
    field.value = sex === "male" ? station.maleDefaultMinutes : station.femaleDefaultMinutes;
  }
}

function fillHyroxDefaults() {
  const defaults = {
    sex: "female",
    weightKg: 62,
    sweatRateLHr: 1.0,
    sweatSaltiness: "average",
    runPaceMinPerKm: 5.25,
    transitionSeconds: 42,
    fuelKey: "sis-beta-fuel",
    fuelMode: "professional",
    customFuelName: "Liquid carbs flask",
    customServingSizeGrams: 40,
    customCarbsPer100g: 75,
    customSodiumPer100g: 450,
    customTransportType: "dual",
    customNotes: "",
    ...(state.hyroxProfile ?? {})
  };

  renderOptions(hyroxSweatRateSelect, SWEAT_RATE_OPTIONS);
  renderOptions(hyroxPaceSelect, PACE_OPTIONS);
  renderFuelOptions(hyroxFuelSelect, defaults.fuelKey);

  hyroxForm.elements.namedItem("sex").value = defaults.sex;
  hyroxForm.elements.namedItem("weightKg").value = defaults.weightKg;
  hyroxForm.elements.namedItem("sweatSaltiness").value = defaults.sweatSaltiness;
  hyroxForm.elements.namedItem("transitionSeconds").value = defaults.transitionSeconds;
  hyroxForm.elements.namedItem("customFuelName").value = defaults.customFuelName;
  hyroxForm.elements.namedItem("customServingSizeGrams").value = defaults.customServingSizeGrams;
  hyroxForm.elements.namedItem("customCarbsPer100g").value = defaults.customCarbsPer100g;
  hyroxForm.elements.namedItem("customSodiumPer100g").value = defaults.customSodiumPer100g;
  hyroxForm.elements.namedItem("customTransportType").value = defaults.customTransportType;
  hyroxForm.elements.namedItem("customNotes").value = defaults.customNotes;

  setSelectToNumericValue(hyroxSweatRateSelect, defaults.sweatRateLHr, "Indoor sweat rate");
  const storedPace = Number(defaults.runPaceMinPerKm);
  const nearestPace = PACE_OPTIONS.reduce((closest, option) => {
    return Math.abs(option.value - storedPace) < Math.abs(closest.value - storedPace) ? option : closest;
  }, PACE_OPTIONS[0]);
  hyroxPaceSelect.value = String(nearestPace.value);

  applyHyroxStationDefaults(defaults.sex);

  if (state.hyroxProfile) {
    for (const station of HYROX_STATIONS) {
      const storedValue = state.hyroxProfile[station.key];
      if (storedValue) {
        hyroxForm.elements.namedItem(station.key).value = storedValue;
      }
    }
  }

  setHyroxFuelMode(defaults.fuelMode ?? "professional");
  updateHyroxPredictedDuration();
}

function updateCalculatedDuration() {
  const distanceKm = Number(calculatorForm.elements.namedItem("distanceKm").value);
  const paceMinPerKm = Number(calculatorForm.elements.namedItem("paceMinPerKm").value);
  const durationMinutes = estimateDurationMinutes({ distanceKm, paceMinPerKm });
  durationDisplay.value = durationMinutes ? formatClock(durationMinutes) : "";
}

function updateHyroxPredictedDuration() {
  const runPaceMinPerKm = Number(hyroxForm.elements.namedItem("runPaceMinPerKm").value);
  const transitionSeconds = Number(hyroxForm.elements.namedItem("transitionSeconds").value);
  const stationMinutes = HYROX_STATIONS.reduce((sum, station) => {
    return sum + Number(hyroxForm.elements.namedItem(station.key).value || 0);
  }, 0);
  const predictedDurationMinutes = 8 * runPaceMinPerKm + stationMinutes + (8 * transitionSeconds) / 60;
  hyroxDurationDisplay.value = predictedDurationMinutes ? formatClock(predictedDurationMinutes) : "";
}

function updateHeatExposureVisibility() {
  const temperatureC = Number(calculatorForm.elements.namedItem("temperatureC").value);
  const acclimatizationField = calculatorForm.elements.namedItem("acclimatizationDays");
  const isRelevant = temperatureC >= HEAT_EXPOSURE_THRESHOLD_C;

  heatExposureField.hidden = !isRelevant;
  acclimatizationField.disabled = !isRelevant;
  acclimatizationField.required = isRelevant;
}

function buildCustomFuelFromForm(form) {
  const name = form.elements.namedItem("customFuelName").value.trim();
  const servingSizeGrams = Number(form.elements.namedItem("customServingSizeGrams").value);
  const carbsPer100g = Number(form.elements.namedItem("customCarbsPer100g").value);
  const sodiumPer100g = Number(form.elements.namedItem("customSodiumPer100g").value);
  const notes = form.elements.namedItem("customNotes").value.trim();

  return {
    key: "custom-fuel",
    name,
    servingSizeGrams,
    carbsPerServing: round((carbsPer100g / 100) * servingSizeGrams, 1),
    sodiumPerServing: round((sodiumPer100g / 100) * servingSizeGrams, 0),
    calories: round(((carbsPer100g / 100) * servingSizeGrams) * 4, 0),
    transportType: form.elements.namedItem("customTransportType").value,
    notes: notes || "Custom fuel source"
  };
}

function getSelectedFuel() {
  return state.fuelMode === "custom" ? buildCustomFuelFromForm(calculatorForm) : getFuelByKey(fuelSelect.value);
}

function getSelectedHyroxFuel() {
  return state.hyroxFuelMode === "custom"
    ? buildCustomFuelFromForm(hyroxForm)
    : getFuelByKey(hyroxFuelSelect.value);
}

function getCalculatorInput() {
  const paceMinPerKm = Number(calculatorForm.elements.namedItem("paceMinPerKm").value);
  const distanceKm = Number(calculatorForm.elements.namedItem("distanceKm").value);
  const durationMinutes = estimateDurationMinutes({ distanceKm, paceMinPerKm });
  const temperatureC = Number(calculatorForm.elements.namedItem("temperatureC").value);

  return {
    sex: calculatorForm.elements.namedItem("sex").value,
    weightKg: Number(calculatorForm.elements.namedItem("weightKg").value),
    sweatRateLHr: Number(calculatorForm.elements.namedItem("sweatRateLHr").value),
    gutToleranceGHr: Number(calculatorForm.elements.namedItem("gutToleranceGHr").value),
    sweatSaltiness: calculatorForm.elements.namedItem("sweatSaltiness").value,
    runType: calculatorForm.elements.namedItem("runType").value,
    durationMinutes,
    distanceKm,
    paceMinPerKm,
    paceLabel: paceSelect.options[paceSelect.selectedIndex].textContent,
    temperatureC,
    humidityPercent: Number(calculatorForm.elements.namedItem("humidityPercent").value),
    acclimatizationDays:
      temperatureC >= HEAT_EXPOSURE_THRESHOLD_C
        ? Number(calculatorForm.elements.namedItem("acclimatizationDays").value)
        : 0,
    fuelKey: fuelSelect.value,
    fuelMode: state.fuelMode,
    customFuelName: calculatorForm.elements.namedItem("customFuelName").value,
    customServingSizeGrams: calculatorForm.elements.namedItem("customServingSizeGrams").value,
    customCarbsPer100g: calculatorForm.elements.namedItem("customCarbsPer100g").value,
    customSodiumPer100g: calculatorForm.elements.namedItem("customSodiumPer100g").value,
    customTransportType: calculatorForm.elements.namedItem("customTransportType").value,
    customNotes: calculatorForm.elements.namedItem("customNotes").value
  };
}

function getHyroxInput() {
  return {
    sex: hyroxForm.elements.namedItem("sex").value,
    weightKg: Number(hyroxForm.elements.namedItem("weightKg").value),
    sweatRateLHr: Number(hyroxForm.elements.namedItem("sweatRateLHr").value),
    sweatSaltiness: hyroxForm.elements.namedItem("sweatSaltiness").value,
    runPaceMinPerKm: Number(hyroxForm.elements.namedItem("runPaceMinPerKm").value),
    transitionSeconds: Number(hyroxForm.elements.namedItem("transitionSeconds").value),
    fuelKey: hyroxFuelSelect.value,
    fuelMode: state.hyroxFuelMode,
    customFuelName: hyroxForm.elements.namedItem("customFuelName").value,
    customServingSizeGrams: hyroxForm.elements.namedItem("customServingSizeGrams").value,
    customCarbsPer100g: hyroxForm.elements.namedItem("customCarbsPer100g").value,
    customSodiumPer100g: hyroxForm.elements.namedItem("customSodiumPer100g").value,
    customTransportType: hyroxForm.elements.namedItem("customTransportType").value,
    customNotes: hyroxForm.elements.namedItem("customNotes").value,
    stationEstimates: HYROX_STATIONS.map((station) => ({
      key: station.key,
      name: station.name,
      minutes: Number(hyroxForm.elements.namedItem(station.key).value)
    }))
  };
}

function renderRunPlan(plan, run, fuel) {
  heroCarbTarget.textContent = `${round(plan.fuelTimeline.actualCarbsTotal, 0)} g`;
  heroFluidTarget.textContent = `${plan.totalFluidL} L`;
  heroSodiumTarget.textContent = `${plan.totalExternalSodiumMg} mg`;

  sessionSummary.innerHTML = `
    <strong>${RUN_TYPE_LABELS[run.runType]} · ${formatClock(plan.durationMinutes)}</strong>
    <p>${plan.rationale}</p>
    <p>
      ${run.distanceKm} km at ${run.paceLabel}. Weather: ${run.temperatureC}°C and ${run.humidityPercent}% humidity.
      Heat index ${plan.heatIndexC}°C. Approximate WBGT ${plan.wbgtC}°C.
    </p>
    <p>
      Plan for <strong>${plan.fuelTimeline.actualCarbsTotal} g carbohydrate total</strong>,
      <strong>${plan.totalFluidL} L water total</strong>, and
      <strong>${plan.totalExternalSodiumMg} mg sodium total in the water</strong>.
    </p>
  `;

  safetyList.innerHTML = "";
  for (const warning of plan.warnings) {
    const li = document.createElement("li");
    li.className =
      warning.tone === "danger"
        ? "callout danger"
        : warning.tone === "success"
          ? "callout success"
          : "callout";
    li.textContent = warning.text;
    safetyList.appendChild(li);
  }

  fuelTimeline.innerHTML = "";
  if (plan.fuelTimeline.events.length === 0) {
    fuelTimeline.innerHTML = `<li>Skip intra-run carbohydrates. Focus on water and electrolytes only.</li>`;
  } else {
    for (const event of plan.fuelTimeline.events) {
      const pairedDrinkEvent = plan.hydrationPlan.events.find(
        (hydrationEvent) => hydrationEvent.pairedWithFuel && hydrationEvent.minute === event.minute
      );
      const distanceMarker = formatFuelDistanceMarker(event.minute, run.paceMinPerKm, run.distanceKm);
      const li = document.createElement("li");
      li.innerHTML = `<span class="time">${formatClock(event.minute)} · ${distanceMarker}</span> Take <strong>1 full serving</strong> of ${fuel.name} (${event.carbs}g carbs)${
        pairedDrinkEvent ? ` and drink ${pairedDrinkEvent.sipMl} mL at the same time.` : "."
      }`;
      fuelTimeline.appendChild(li);
    }
  }

  hydrationTimeline.innerHTML = "";
  const summaryItem = document.createElement("li");
  summaryItem.innerHTML =
    plan.hydrationPlan.mode === "optional"
      ? `
        <span class="time">Hydration</span>
        ${plan.hydrationPlan.guidance}
      `
      : plan.hydrationPlan.mode === "thirst"
        ? `
          <span class="time">Hydration</span>
          ${plan.hydrationPlan.guidance}
          ${
            plan.totalFluidL > 0
              ? `If you do carry water, bring about <strong>${plan.totalFluidL} L</strong> total with roughly <strong>${plan.totalExternalSodiumMg} mg sodium</strong> mixed in.`
              : ""
          }
        `
        : `
          <span class="time">Total</span>
          ${plan.hydrationPlan.guidance}
          Drink <strong>${plan.totalFluidL} L</strong> water overall. Put
          <strong>${plan.totalExternalSodiumMg} mg sodium</strong> total into that water,
          which is about <strong>${plan.hydrationPlan.sodiumPer500MlFlask} mg per 500 mL flask</strong>.
        `;
  hydrationTimeline.appendChild(summaryItem);

  if (plan.hydrationPlan.totalWaterMl > 0) {
    const flaskItem = document.createElement("li");
    flaskItem.innerHTML = `
      <span class="time">Flasks</span>
      That equals <strong>${plan.hydrationPlan.flaskCountEquivalent}</strong> flasks of 500 mL,
      so plan to carry or access <strong>${plan.hydrationPlan.flaskCountToCarry}</strong> flask(s).
    `;
    hydrationTimeline.appendChild(flaskItem);
  }

  for (const event of plan.hydrationPlan.events) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="time">${formatClock(event.minute)}</span>
      ${
        event.pairedWithFuel
          ? `Drink ${event.sipMl} mL with your carb serving, which is about ${formatFlaskPart(event.sipFlaskFraction)}.`
          : `Drink ${event.sipMl} mL, which is about ${formatFlaskPart(event.sipFlaskFraction)}.`
      }
    `;
    hydrationTimeline.appendChild(li);
  }

  mathList.innerHTML = "";
  [
    plan.fuelingMode === "fixed"
      ? `${plan.totalCarbsGoal} g total physiological carbohydrate target`
      : `${plan.requestedCarbsHr || 0} g/hr physiological carbohydrate target`,
    `${plan.fuelTimeline.actualCarbsHr || 0} g/hr delivered after rounding to full servings`,
    `${plan.targetFluidLHr} L/hr water target from sweat-rate scaling`,
    `${plan.targetSodiumMgHr} mg/hr sodium target before gel contribution`,
    `${plan.fuelSodiumMgHr} mg/hr sodium coming from ${fuel.name}`,
    `${plan.externalSodiumMgHr} mg/hr still needed in the water`,
    plan.hydrationPlan.intervalMinutes > 0
      ? `${plan.hydrationPlan.sipMl} mL every ${plan.hydrationPlan.intervalMinutes} minutes`
      : "Hydration timing: drink to thirst rather than on a fixed timer",
    `${plan.bodyMassLossPercent}% projected body-mass loss after planned drinking`,
    `${plan.estimatedCalories} kcal approximate running cost`
  ].forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    mathList.appendChild(li);
  });

  productNotes.innerHTML = "";
  [
    fuel.notes,
    fuel.transportType === "dual"
      ? "Dual-transport carbohydrates support higher hourly intake once your gut is trained."
      : "Single-source carbohydrates are best kept near or below 60 g/hr.",
    "This planner never recommends fractions of a gel. Every event is rounded to a full serving."
  ].forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    productNotes.appendChild(li);
  });
}

function renderHyroxPlan(plan, input, fuel) {
  heroCarbTarget.textContent = `${round(plan.actualCarbsTotal, 0)} g`;
  heroFluidTarget.textContent = `${plan.hydrationPlan.totalFluidL} L`;
  heroSodiumTarget.textContent = `${plan.hydrationPlan.totalExternalSodiumMg} mg`;

  hyroxSummary.innerHTML = `
    <strong>${formatClock(plan.predictedDurationMinutes)} predicted finish time</strong>
    <p>
      Running contributes about <strong>${formatClock(plan.runTotalMinutes)}</strong>,
      stations about <strong>${formatClock(plan.stationTotalMinutes)}</strong>,
      and Roxzone transitions about <strong>${formatClock(plan.roxzoneTotalMinutes)}</strong>.
    </p>
    <p>
      Carb load <strong>${plan.carbLoadingRange[0]}-${plan.carbLoadingRange[1]} g per day</strong> across the final
      48 to 72 hours. In-race plan uses <strong>${round(plan.actualCarbsTotal, 0)} g</strong> total from
      ${fuel.name} with a hydration plan of <strong>${plan.hydrationPlan.totalFluidL} L</strong>.
    </p>
  `;

  hyroxWarnings.innerHTML = "";
  plan.warnings.forEach((warning) => {
    const li = document.createElement("li");
    li.className =
      warning.tone === "danger"
        ? "callout danger"
        : warning.tone === "success"
          ? "callout success"
          : "callout";
    li.textContent = warning.text;
    hyroxWarnings.appendChild(li);
  });

  hyroxDailyTargets.innerHTML = "";
  plan.dailyTargets.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    hyroxDailyTargets.appendChild(li);
  });

  hyroxFoodsEat.innerHTML = "";
  plan.foodsToEat.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    hyroxFoodsEat.appendChild(li);
  });

  hyroxFoodsAvoid.innerHTML = "";
  plan.foodsToAvoid.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    hyroxFoodsAvoid.appendChild(li);
  });

  hyroxTiming.innerHTML = "";
  plan.timingProtocol.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="time">${item.label}</span>${item.text}`;
    hyroxTiming.appendChild(li);
  });

  hyroxFuelTimeline.innerHTML = "";
  plan.fuelEvents.forEach((event) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="time">${event.minute < 0 ? "Pre-start" : formatClock(event.minute)}</span>
      ${event.label}
    `;
    hyroxFuelTimeline.appendChild(li);
  });

  hyroxHydration.innerHTML = "";
  [
    {
      label: "Total",
      text: `Plan about ${plan.hydrationPlan.totalFluidL} L total, with roughly ${plan.hydrationPlan.totalExternalSodiumMg} mg sodium in the carry bottle or flask system.`
    },
    {
      label: "Flasks",
      text: `That is about ${plan.hydrationPlan.flaskCountEquivalent} flasks of 500 mL, or ${plan.hydrationPlan.sodiumPer500MlFlask} mg sodium per 500 mL flask.`
    },
    {
      label: "Rhythm",
      text: `Drink about ${plan.hydrationPlan.sipMl} mL every ${plan.hydrationPlan.intervalMinutes} minutes, ideally during Roxzone transitions or at official aid access.`
    }
  ].forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="time">${item.label}</span>${item.text}`;
    hyroxHydration.appendChild(li);
  });

  hyroxRoxzone.innerHTML = "";
  plan.hydrationPlan.events.forEach((event) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="time">${event.roxzoneLabel ?? formatClock(event.minute)}</span>
      Drink ${event.sipMl} mL here${event.stationName ? ` after ${event.stationName}` : ""}, which is about ${formatFlaskPart(event.sipFlaskFraction)}.
    `;
    hyroxRoxzone.appendChild(li);
  });

  const rows = plan.breakdown
    .map((segment) => {
      return `
        <tr>
          <td>${segment.label}</td>
          <td>${formatClock(segment.startMinute)}</td>
          <td>${formatClock(segment.endMinute)}</td>
          <td>${segment.detail}</td>
        </tr>
      `;
    })
    .join("");

  hyroxBreakdown.innerHTML = `
    <p>
      Estimated HYROX split model based on your selected 1 km pace and editable station times.
      Roxzone transitions are modeled at ${formatClock(input.transitionSeconds / 60)} each.
    </p>
    <table>
      <thead>
        <tr>
          <th>Segment</th>
          <th>Start</th>
          <th>End</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSweatRate(result) {
  sweatResult.innerHTML = `
    <p><strong>${result.sweatRateLHr} L/hr</strong> estimated sweat rate.</p>
    <p>
      Body-mass change was ${result.bodyMassLossPercent}% during the field test.
      A practical starting replacement target is ${result.replaceWindowLHr} L/hr in moderate conditions.
    </p>
    <p class="callout success">Tip: the calculator dropdown now updates to this measured sweat rate, even if it is outside the built-in defaults.</p>
  `;
}

function renderGutPlan(result, currentWeek) {
  const rows = result.plan
    .map((week) => {
      const marker = week.week === currentWeek ? " <strong>Current</strong>" : "";
      return `
        <tr>
          <td>Week ${week.week}${marker}</td>
          <td>${week.targetCarbsHr} g/hr</td>
          <td>${week.note}</td>
        </tr>
      `;
    })
    .join("");

  gutPlanOutput.innerHTML = `
    <p>Peak target is <strong>${result.peakTarget} g/hr</strong>. Keep long-run fuel source and timing stable while the dose climbs.</p>
    <table>
      <thead>
        <tr>
          <th>Week</th>
          <th>Target</th>
          <th>Coaching note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMacros(result) {
  macroResult.innerHTML = `
    <p>
      Carbohydrates: <strong>${result.carbsRange[0]}-${result.carbsRange[1]} g/day</strong>.
      Protein: <strong>${result.proteinRange[0]}-${result.proteinRange[1]} g/day</strong>.
      Fat: <strong>${result.fatRange[0]}-${result.fatRange[1]} g/day</strong>.
    </p>
    <p>
      In the first 4 hours after a long or hard run, aim for
      <strong>${result.postRunCarbsPerHour[0]}-${result.postRunCarbsPerHour[1]} g carbohydrate per hour</strong>
      and <strong>${result.postRunProtein[0]}-${result.postRunProtein[1]} g protein per feeding</strong>.
    </p>
    <p>
      Heuristic training-day energy need: about <strong>${result.heuristicDailyNeed} kcal</strong>.
      Minimum calories implied by the lower macro targets: <strong>${result.minimumMacroCalories} kcal</strong>.
    </p>
    ${
      result.redsRisk
        ? `<p class="callout danger">${result.redsRisk}</p>`
        : `<p class="callout success">Energy availability does not trigger the female RED-S heuristic flag with the current inputs.</p>`
    }
  `;
}

function handleCalculatorSubmit(event) {
  event.preventDefault();
  const formValues = getCalculatorInput();
  const profile = {
    sex: formValues.sex,
    weightKg: formValues.weightKg,
    sweatRateLHr: formValues.sweatRateLHr,
    gutToleranceGHr: formValues.gutToleranceGHr,
    sweatSaltiness: formValues.sweatSaltiness
  };
  const run = {
    runType: formValues.runType,
    distanceKm: formValues.distanceKm,
    paceMinPerKm: formValues.paceMinPerKm,
    paceLabel: formValues.paceLabel,
    temperatureC: formValues.temperatureC,
    humidityPercent: formValues.humidityPercent,
    acclimatizationDays: formValues.acclimatizationDays
  };
  const fuel = getSelectedFuel();
  const plan = buildRunPlan(profile, run, fuel);

  renderRunPlan(plan, run, fuel);

  state.profile = { ...formValues };
  state.lastRun = { run, fuel, plan };
  writeStorage(STORAGE_KEYS.profile, state.profile);
  writeStorage(STORAGE_KEYS.lastRun, state.lastRun);

  macroForm.elements.namedItem("sex").value = profile.sex;
  macroForm.elements.namedItem("weightKg").value = profile.weightKg;
  gutForm.elements.namedItem("goalCarbsHr").value = Math.max(plan.requestedCarbsHr, 60);
  gutForm.elements.namedItem("currentToleranceGHr").value = profile.gutToleranceGHr;
}

function handleHyroxSubmit(event) {
  event.preventDefault();
  const formValues = getHyroxInput();
  const profile = {
    sex: formValues.sex,
    weightKg: formValues.weightKg,
    sweatRateLHr: formValues.sweatRateLHr,
    sweatSaltiness: formValues.sweatSaltiness
  };
  const settings = {
    runPaceMinPerKm: formValues.runPaceMinPerKm,
    transitionSeconds: formValues.transitionSeconds,
    stationEstimates: formValues.stationEstimates
  };
  const fuel = getSelectedHyroxFuel();
  const plan = buildHyroxPlan(profile, settings, fuel);

  renderHyroxPlan(plan, formValues, fuel);

  state.hyroxProfile = {
    ...formValues,
    ...Object.fromEntries(formValues.stationEstimates.map((station) => [station.key, station.minutes]))
  };
  state.hyroxLastPlan = { settings, fuel, plan };
  writeStorage(STORAGE_KEYS.hyroxProfile, state.hyroxProfile);
  writeStorage(STORAGE_KEYS.hyroxLastPlan, state.hyroxLastPlan);
}

function handleSweatSubmit(event) {
  event.preventDefault();
  const result = calculateSweatRate({
    preMassKg: Number(sweatForm.elements.namedItem("preMassKg").value),
    postMassKg: Number(sweatForm.elements.namedItem("postMassKg").value),
    fluidLiters: Number(sweatForm.elements.namedItem("fluidLiters").value),
    durationMinutes: Number(sweatForm.elements.namedItem("durationMinutes").value)
  });
  renderSweatRate(result);
  setSelectToNumericValue(sweatRateSelect, result.sweatRateLHr, "Measured sweat rate");
}

function handleGutSubmit(event) {
  event.preventDefault();
  const currentWeek = Number(gutForm.elements.namedItem("currentWeek").value);
  const result = buildGutTrainingPlan({
    currentWeek,
    goalCarbsHr: Number(gutForm.elements.namedItem("goalCarbsHr").value),
    currentToleranceGHr: Number(gutForm.elements.namedItem("currentToleranceGHr").value),
    symptomSeverity: gutForm.elements.namedItem("symptomSeverity").value
  });
  renderGutPlan(result, currentWeek);
}

function handleMacroSubmit(event) {
  event.preventDefault();
  const intakeValue = macroForm.elements.namedItem("intakeKcal").value;
  const result = calculateDailyMacros({
    sex: macroForm.elements.namedItem("sex").value,
    weightKg: Number(macroForm.elements.namedItem("weightKg").value),
    trainingHours: Number(macroForm.elements.namedItem("trainingHours").value),
    intakeKcal: intakeValue ? Number(intakeValue) : 0
  });
  renderMacros(result);
}

function bootstrap() {
  fillCalculatorDefaults();
  fillHyroxDefaults();
  setAppTab(state.activeTab ?? "running");

  calculatorForm.addEventListener("submit", handleCalculatorSubmit);
  hyroxForm.addEventListener("submit", handleHyroxSubmit);
  sweatForm.addEventListener("submit", handleSweatSubmit);
  gutForm.addEventListener("submit", handleGutSubmit);
  macroForm.addEventListener("submit", handleMacroSubmit);
  calculatorForm.elements.namedItem("distanceKm").addEventListener("input", updateCalculatedDuration);
  paceSelect.addEventListener("change", updateCalculatedDuration);
  calculatorForm.elements.namedItem("temperatureC").addEventListener("input", updateHeatExposureVisibility);
  hyroxPaceSelect.addEventListener("change", updateHyroxPredictedDuration);
  hyroxForm.elements.namedItem("transitionSeconds").addEventListener("input", updateHyroxPredictedDuration);
  hyroxForm.elements.namedItem("sex").addEventListener("change", (event) => {
    applyHyroxStationDefaults(event.target.value);
    updateHyroxPredictedDuration();
  });

  HYROX_STATIONS.forEach((station) => {
    hyroxForm.elements.namedItem(station.key).addEventListener("input", updateHyroxPredictedDuration);
  });

  for (const button of tabButtons) {
    button.addEventListener("click", () => setFuelMode(button.dataset.fuelMode));
  }

  for (const button of hyroxFuelTabButtons) {
    button.addEventListener("click", () => setHyroxFuelMode(button.dataset.hyroxFuelMode));
  }

  for (const button of appTabButtons) {
    button.addEventListener("click", () => {
      setAppTab(button.dataset.appTab);
      syncActiveTabPlan();
    });
  }

  handleCalculatorSubmit(new Event("submit", { cancelable: true }));
  handleHyroxSubmit(new Event("submit", { cancelable: true }));
  handleSweatSubmit(new Event("submit", { cancelable: true }));
  handleGutSubmit(new Event("submit", { cancelable: true }));
  handleMacroSubmit(new Event("submit", { cancelable: true }));
  syncActiveTabPlan();
}

bootstrap();
