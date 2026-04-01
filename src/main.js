import {
  BUILT_IN_FUELS,
  GUT_TOLERANCE_OPTIONS,
  PACE_OPTIONS,
  RUN_TYPE_LABELS,
  STORAGE_KEYS,
  SWEAT_RATE_OPTIONS
} from "./constants.js";
import {
  buildGutTrainingPlan,
  buildRunPlan,
  calculateDailyMacros,
  calculateSweatRate,
  estimateDurationMinutes,
  formatClock,
  round
} from "./calculations.js";

const calculatorForm = document.querySelector("#calculator-form");
const sweatForm = document.querySelector("#sweat-form");
const gutForm = document.querySelector("#gut-form");
const macroForm = document.querySelector("#macro-form");
const fuelSelect = document.querySelector("#fuel-select");
const sweatRateSelect = document.querySelector("#sweat-rate-select");
const gutToleranceSelect = document.querySelector("#gut-tolerance-select");
const paceSelect = document.querySelector("#pace-select");
const durationDisplay = document.querySelector("#duration-display");
const heatExposureField = document.querySelector("#heat-exposure-field");
const tabButtons = document.querySelectorAll(".tab-button");
const professionalFuelPanel = document.querySelector("#professional-fuel-panel");
const customFuelPanel = document.querySelector("#custom-fuel-panel");

const sessionSummary = document.querySelector("#session-summary");
const safetyList = document.querySelector("#safety-list");
const fuelTimeline = document.querySelector("#fuel-timeline");
const hydrationTimeline = document.querySelector("#hydration-timeline");
const mathList = document.querySelector("#math-list");
const productNotes = document.querySelector("#product-notes");
const sweatResult = document.querySelector("#sweat-result");
const gutPlanOutput = document.querySelector("#gut-plan");
const macroResult = document.querySelector("#macro-result");

const heroCarbTarget = document.querySelector("#hero-carb-target");
const heroFluidTarget = document.querySelector("#hero-fluid-target");
const heroSodiumTarget = document.querySelector("#hero-sodium-target");

const HEAT_EXPOSURE_THRESHOLD_C = 29.5;

const state = {
  profile: readStorage(STORAGE_KEYS.profile, null),
  lastRun: readStorage(STORAGE_KEYS.lastRun, null),
  fuelMode: "professional"
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

function renderOptions(select, options, formatter = (option) => option.label) {
  select.innerHTML = "";
  for (const optionData of options) {
    const option = document.createElement("option");
    option.value = String(optionData.value);
    option.textContent = formatter(optionData);
    select.appendChild(option);
  }
}

function renderFuelOptions(selectedKey) {
  fuelSelect.innerHTML = "";
  for (const fuel of BUILT_IN_FUELS) {
    const option = document.createElement("option");
    option.value = fuel.key;
    option.textContent = `${fuel.name} · ${fuel.carbsPerServing}g carbs · ${fuel.sodiumPerServing}mg Na`;
    option.selected = fuel.key === selectedKey;
    fuelSelect.appendChild(option);
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
  renderFuelOptions(defaults.fuelKey);

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

function updateCalculatedDuration() {
  const distanceKm = Number(calculatorForm.elements.namedItem("distanceKm").value);
  const paceMinPerKm = Number(calculatorForm.elements.namedItem("paceMinPerKm").value);
  const durationMinutes = estimateDurationMinutes({ distanceKm, paceMinPerKm });
  durationDisplay.value = durationMinutes ? round(durationMinutes, 0) : "";
}

function updateHeatExposureVisibility() {
  const temperatureC = Number(calculatorForm.elements.namedItem("temperatureC").value);
  const acclimatizationField = calculatorForm.elements.namedItem("acclimatizationDays");
  const isRelevant = temperatureC >= HEAT_EXPOSURE_THRESHOLD_C;

  heatExposureField.hidden = !isRelevant;
  acclimatizationField.disabled = !isRelevant;
  acclimatizationField.required = isRelevant;
}

function buildCustomFuel() {
  const name = calculatorForm.elements.namedItem("customFuelName").value.trim();
  const servingSizeGrams = Number(calculatorForm.elements.namedItem("customServingSizeGrams").value);
  const carbsPer100g = Number(calculatorForm.elements.namedItem("customCarbsPer100g").value);
  const sodiumPer100g = Number(calculatorForm.elements.namedItem("customSodiumPer100g").value);
  const notes = calculatorForm.elements.namedItem("customNotes").value.trim();

  return {
    key: "custom-fuel",
    name,
    servingSizeGrams,
    carbsPerServing: round((carbsPer100g / 100) * servingSizeGrams, 1),
    sodiumPerServing: round((sodiumPer100g / 100) * servingSizeGrams, 0),
    calories: round(((carbsPer100g / 100) * servingSizeGrams) * 4, 0),
    transportType: calculatorForm.elements.namedItem("customTransportType").value,
    notes: notes || "Custom fuel source"
  };
}

function getSelectedFuel() {
  return state.fuelMode === "custom" ? buildCustomFuel() : getFuelByKey(fuelSelect.value);
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
      const li = document.createElement("li");
      li.innerHTML = `<span class="time">${formatClock(event.minute)}</span> Take <strong>1 full serving</strong> of ${fuel.name} (${event.carbs}g carbs)${
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

  calculatorForm.addEventListener("submit", handleCalculatorSubmit);
  sweatForm.addEventListener("submit", handleSweatSubmit);
  gutForm.addEventListener("submit", handleGutSubmit);
  macroForm.addEventListener("submit", handleMacroSubmit);
  calculatorForm.elements.namedItem("distanceKm").addEventListener("input", updateCalculatedDuration);
  paceSelect.addEventListener("change", updateCalculatedDuration);
  calculatorForm.elements.namedItem("temperatureC").addEventListener("input", updateHeatExposureVisibility);

  for (const button of tabButtons) {
    button.addEventListener("click", () => setFuelMode(button.dataset.fuelMode));
  }

  handleCalculatorSubmit(new Event("submit", { cancelable: true }));
  handleSweatSubmit(new Event("submit", { cancelable: true }));
  handleGutSubmit(new Event("submit", { cancelable: true }));
  handleMacroSubmit(new Event("submit", { cancelable: true }));
}

bootstrap();
