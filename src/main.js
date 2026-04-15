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
  estimatePaceMinPerKm,
  formatClock,
  round
} from "./calculations.js";
import { canScrollElement, selectScrollPanel } from "./scroll-routing.js";

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
const paceDisplay = document.querySelector("#pace-display");
const hyroxPaceSelect = document.querySelector("#hyrox-pace-select");
const durationDisplay = document.querySelector("#duration-display");
const hyroxDurationDisplay = document.querySelector("#hyrox-duration-display");
const heatExposureField = document.querySelector("#heat-exposure-field");
const appTabButtons = document.querySelectorAll(".app-tab-button");
const runningApp = document.querySelector("#running-app");
const hyroxApp = document.querySelector("#hyrox-app");
const fuelModeButtons = calculatorForm.querySelectorAll("[data-fuel-mode]");
const durationModeButtons = document.querySelectorAll(".duration-mode-button");
const fuelSelectionModeButtons = document.querySelectorAll(".fuel-selection-mode-button");
const hyroxFuelSelectionModeButtons = document.querySelectorAll(".hyrox-fuel-selection-mode-button");
const professionalFuelPanel = document.querySelector("#professional-fuel-panel");
const customFuelPanel = document.querySelector("#custom-fuel-panel");
const addProfessionalFuelButton = document.querySelector("#add-professional-fuel");
const addCustomFuelButton = document.querySelector("#add-custom-fuel");
const fuelQuantityInput = document.querySelector("#fuel-quantity");
const customQuantityInput = calculatorForm.elements.namedItem("customQuantity");
const fuelQuantityField = document.querySelector("#fuel-quantity-field");
const customQuantityField = document.querySelector("#custom-quantity-field");
const fuelKitSummary = document.querySelector("#fuel-kit-summary");
const fuelKitList = document.querySelector("#fuel-kit-list");
const runningKitOutput = document.querySelector("#running-kit-output");
const hyroxFuelTabButtons = document.querySelectorAll(".hyrox-fuel-tab-button");
const hyroxProfessionalFuelPanel = document.querySelector("#hyrox-professional-fuel-panel");
const hyroxCustomFuelPanel = document.querySelector("#hyrox-custom-fuel-panel");
const addHyroxProfessionalFuelButton = document.querySelector("#add-hyrox-professional-fuel");
const addHyroxCustomFuelButton = document.querySelector("#add-hyrox-custom-fuel");
const hyroxFuelQuantityInput = document.querySelector("#hyrox-fuel-quantity");
const hyroxCustomQuantityInput = hyroxForm.elements.namedItem("customQuantity");
const hyroxFuelQuantityField = document.querySelector("#hyrox-fuel-quantity-field");
const hyroxCustomQuantityField = document.querySelector("#hyrox-custom-quantity-field");
const hyroxFuelKitSummary = document.querySelector("#hyrox-fuel-kit-summary");
const hyroxFuelKitList = document.querySelector("#hyrox-fuel-kit-list");
const hyroxKitOutput = document.querySelector("#hyrox-kit-output");

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
const hero = document.querySelector(".hero");
const heroStats = document.querySelector(".hero-stats");
const heroStatsHome = document.querySelector("#hero-stats-home");
const mobileHeroStatsAnchor = document.querySelector("#mobile-hero-stats-anchor");
const durationLabel = document.querySelector("#duration-label");
const paceLabel = document.querySelector("#pace-label");

const HEAT_EXPOSURE_THRESHOLD_C = 29.5;
const MOBILE_STATS_BREAKPOINT = "(max-width: 1140px)";
const DESKTOP_SCROLL_ROUTING_QUERY = "(min-width: 1141px)";

const state = {
  profile: readStorage(STORAGE_KEYS.profile, null),
  lastRun: readStorage(STORAGE_KEYS.lastRun, null),
  hyroxProfile: readStorage(STORAGE_KEYS.hyroxProfile, null),
  hyroxLastPlan: readStorage(STORAGE_KEYS.hyroxLastPlan, null),
  fuelSelectionMode: "single",
  hyroxFuelSelectionMode: "single",
  fuelMode: "professional",
  hyroxFuelMode: "professional",
  durationMode: "calculated",
  runningFuelKit: [],
  hyroxFuelKit: [],
  activeTab: readStorage(STORAGE_KEYS.activeTab, "running")
};

const scrollRoutingState = {
  hoveredPanel: null
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

function formatPaceDisplay(minPerKm) {
  return minPerKm ? `${formatClock(minPerKm)} /km` : "";
}

function formatFuelKitNames(fuelKitSummary) {
  if (!fuelKitSummary?.uniqueNames?.length) {
    return "your selected kit";
  }

  if (fuelKitSummary.uniqueNames.length === 1) {
    return fuelKitSummary.uniqueNames[0];
  }

  if (fuelKitSummary.uniqueNames.length === 2) {
    return `${fuelKitSummary.uniqueNames[0]} and ${fuelKitSummary.uniqueNames[1]}`;
  }

  return `${fuelKitSummary.uniqueNames.slice(0, -1).join(", ")}, and ${fuelKitSummary.uniqueNames.at(-1)}`;
}

function formatSingleFuelRequirement(fuelSummary) {
  const item = fuelSummary?.items?.[0];
  if (!item || !fuelSummary.totalServings) {
    return "";
  }

  if (item.key === "custom-fuel") {
    const totalGrams = round((item.servingSizeGrams ?? 0) * fuelSummary.totalServings, 0);
    return `Total custom fuel needed: <strong>${totalGrams} g</strong>.`;
  }

  return `Total ${item.name} needed: <strong>${fuelSummary.totalServings} serving(s)</strong>.`;
}

function parseDurationDisplay(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parts = trimmed.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return Number.NaN;
  }

  const numericParts = parts.map(Number);
  const [hours, minutes, seconds] =
    numericParts.length === 3 ? numericParts : [0, numericParts[0], numericParts[1]];

  if (minutes > 59 || seconds > 59) {
    return Number.NaN;
  }

  return hours * 60 + minutes + seconds / 60;
}

function syncHeroStatsPosition() {
  if (!hero || !heroStats || !heroStatsHome || !mobileHeroStatsAnchor) {
    return;
  }

  const useMobileRunningPlacement =
    window.matchMedia(MOBILE_STATS_BREAKPOINT).matches && state.activeTab === "running";

  if (useMobileRunningPlacement) {
    if (heroStats.parentElement !== mobileHeroStatsAnchor) {
      mobileHeroStatsAnchor.append(heroStats);
    }
    mobileHeroStatsAnchor.hidden = false;
  } else {
    if (heroStats.parentElement !== hero) {
      heroStatsHome.before(heroStats);
    }
    mobileHeroStatsAnchor.hidden = true;
  }
}

function createKitItemId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function summarizeFuelKitItems(fuelKit) {
  const totalCarbs = fuelKit.reduce((sum, item) => sum + item.carbsPerServing * item.quantity, 0);
  const totalSodium = fuelKit.reduce((sum, item) => sum + item.sodiumPerServing * item.quantity, 0);
  const totalServings = fuelKit.reduce((sum, item) => sum + item.quantity, 0);

  return {
    totalCarbs: round(totalCarbs, 0),
    totalSodium: round(totalSodium, 0),
    totalServings
  };
}

function renderFuelKit(listElement, summaryElement, fuelKit, removeDatasetAttr, adjustDatasetAttr) {
  const summary = summarizeFuelKitItems(fuelKit);
  summaryElement.textContent = fuelKit.length
    ? `${summary.totalServings} serving(s) in kit · ${summary.totalCarbs} g carbs · ${summary.totalSodium} mg sodium`
    : "No fuel added yet. Build a kit before generating the plan.";

  listElement.innerHTML = "";
  fuelKit.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="kit-item-header">
        <strong>${item.name}</strong>
        <div class="kit-item-actions">
          <div class="kit-quantity-controls">
            <button
              type="button"
              class="button button-secondary kit-stepper-button"
              data-${adjustDatasetAttr}="${item.id}"
              data-delta="-1"
              ${item.quantity <= 1 ? "disabled" : ""}
              aria-label="Decrease ${item.name} quantity"
            >
              -
            </button>
            <span class="kit-quantity-value">${item.quantity}</span>
            <button
              type="button"
              class="button button-secondary kit-stepper-button"
              data-${adjustDatasetAttr}="${item.id}"
              data-delta="1"
              aria-label="Increase ${item.name} quantity"
            >
              +
            </button>
          </div>
          <button type="button" class="button button-secondary kit-remove-button" data-${removeDatasetAttr}="${item.id}">
            Remove
          </button>
        </div>
      </div>
      ${item.carbsPerServing} g carbs per serving · ${item.sodiumPerServing} mg sodium per serving
    `;
    listElement.appendChild(li);
  });
}

function buildProfessionalKitItem(select, quantityInput) {
  const fuel = getFuelByKey(select.value);
  return {
    ...fuel,
    id: createKitItemId(),
    quantity: Math.max(1, Number(quantityInput.value || 1)),
    addedOrder: Date.now()
  };
}

function buildCustomKitItem(form) {
  const name = form.elements.namedItem("customFuelName").value.trim();
  const servingSizeGrams = Number(form.elements.namedItem("customServingSizeGrams").value);
  const carbsPer100g = Number(form.elements.namedItem("customCarbsPer100g").value);
  const sodiumPer100g = Number(form.elements.namedItem("customSodiumPer100g").value);
  const quantity = Number(form.elements.namedItem("customQuantity").value || 1);
  const notes = form.elements.namedItem("customNotes").value.trim();

  if (!name || !servingSizeGrams || Number.isNaN(carbsPer100g) || Number.isNaN(sodiumPer100g)) {
    return null;
  }

  return {
    key: "custom-fuel",
    id: createKitItemId(),
    name,
    servingSizeGrams,
    carbsPerServing: round((carbsPer100g / 100) * servingSizeGrams, 1),
    sodiumPerServing: round((sodiumPer100g / 100) * servingSizeGrams, 0),
    calories: round(((carbsPer100g / 100) * servingSizeGrams) * 4, 0),
    transportType: form.elements.namedItem("customTransportType").value,
    fuelType: form.elements.namedItem("customFuelType").value,
    notes: notes || "Custom fuel source",
    quantity: Math.max(1, quantity),
    addedOrder: Date.now()
  };
}

function buildSingleCustomFuel(form) {
  const item = buildCustomKitItem(form);
  if (!item) {
    return null;
  }

  return {
    ...item,
    quantity: 1
  };
}

function renderRunningFuelKit() {
  renderFuelKit(
    fuelKitList,
    fuelKitSummary,
    state.runningFuelKit,
    "running-fuel-remove",
    "running-fuel-adjust"
  );
}

function renderHyroxFuelKit() {
  renderFuelKit(
    hyroxFuelKitList,
    hyroxFuelKitSummary,
    state.hyroxFuelKit,
    "hyrox-fuel-remove",
    "hyrox-fuel-adjust"
  );
}

function addFuelKitItem(targetKey, item) {
  if (!item) {
    return false;
  }

  state[targetKey] = [...state[targetKey], item];
  return true;
}

function removeFuelKitItem(targetKey, itemId) {
  state[targetKey] = state[targetKey].filter((item) => item.id !== itemId);
}

function adjustFuelKitItemQuantity(targetKey, itemId, delta) {
  state[targetKey] = state[targetKey].map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    return {
      ...item,
      quantity: Math.max(1, item.quantity + delta)
    };
  });
}

function updateRunningFuelSelectionModeUi() {
  const useMultiple = state.fuelSelectionMode === "multiple";
  fuelQuantityField.hidden = !useMultiple;
  customQuantityField.hidden = !useMultiple;
  addProfessionalFuelButton.hidden = !useMultiple;
  addCustomFuelButton.hidden = !useMultiple;
  runningKitOutput.hidden = !useMultiple;
  fuelQuantityInput.disabled = !useMultiple;
  customQuantityInput.disabled = !useMultiple;

  if (!useMultiple) {
    fuelQuantityInput.value = 1;
    customQuantityInput.value = 1;
  }
}

function updateHyroxFuelSelectionModeUi() {
  const useMultiple = state.hyroxFuelSelectionMode === "multiple";
  hyroxFuelQuantityField.hidden = !useMultiple;
  hyroxCustomQuantityField.hidden = !useMultiple;
  addHyroxProfessionalFuelButton.hidden = !useMultiple;
  addHyroxCustomFuelButton.hidden = !useMultiple;
  hyroxKitOutput.hidden = !useMultiple;
  hyroxFuelQuantityInput.disabled = !useMultiple;
  hyroxCustomQuantityInput.disabled = !useMultiple;

  if (!useMultiple) {
    hyroxFuelQuantityInput.value = 1;
    hyroxCustomQuantityInput.value = 1;
  }
}

function isDesktopScrollRoutingEnabled() {
  return window.matchMedia(DESKTOP_SCROLL_ROUTING_QUERY).matches;
}

function getVisiblePlannerRoot() {
  return state.activeTab === "hyrox" ? hyroxApp : runningApp;
}

function getVisibleScrollPanels() {
  const activeRoot = getVisiblePlannerRoot();
  if (!activeRoot || activeRoot.hidden) {
    return [];
  }

  return Array.from(activeRoot.querySelectorAll(".controls-panel, .results-column"));
}

function getFocusedScrollPanel() {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return null;
  }

  return getVisibleScrollPanels().find((panel) => panel.contains(activeElement)) ?? null;
}

function getEventScrollPanel(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return null;
  }

  return getVisibleScrollPanels().find((panel) => panel.contains(target)) ?? null;
}

function handleScrollPanelHover(event) {
  if (!isDesktopScrollRoutingEnabled()) {
    scrollRoutingState.hoveredPanel = null;
    return;
  }

  const currentTarget = event.currentTarget instanceof Element ? event.currentTarget : null;
  if (!currentTarget) {
    return;
  }

  if (event.type === "pointerenter") {
    scrollRoutingState.hoveredPanel = currentTarget;
    return;
  }

  if (scrollRoutingState.hoveredPanel === currentTarget) {
    scrollRoutingState.hoveredPanel = null;
  }
}

function handleDesktopWheelRouting(event) {
  if (!isDesktopScrollRoutingEnabled() || event.defaultPrevented || event.ctrlKey || event.metaKey) {
    return;
  }

  const visiblePanels = getVisibleScrollPanels();
  if (visiblePanels.length === 0) {
    return;
  }

  const hoveredPanel = getEventScrollPanel(event) ?? scrollRoutingState.hoveredPanel;
  const focusedPanel = getFocusedScrollPanel();
  const targetPanel = selectScrollPanel({
    hoveredPanel,
    focusedPanel,
    visiblePanels
  });

  if (!targetPanel || !canScrollElement(targetPanel, event.deltaY)) {
    return;
  }

  event.preventDefault();
  targetPanel.scrollTop += event.deltaY;
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

  for (const button of fuelModeButtons) {
    button.classList.toggle("is-active", button.dataset.fuelMode === mode);
    button.setAttribute("aria-selected", button.dataset.fuelMode === mode ? "true" : "false");
  }

  const useCustom = mode === "custom";
  professionalFuelPanel.hidden = useCustom;
  customFuelPanel.hidden = !useCustom;
  updateRunningFuelSelectionModeUi();
}

function setFuelSelectionMode(mode) {
  state.fuelSelectionMode = mode;

  for (const button of fuelSelectionModeButtons) {
    button.classList.toggle("is-active", button.dataset.fuelSelectionMode === mode);
    button.setAttribute("aria-selected", button.dataset.fuelSelectionMode === mode ? "true" : "false");
  }

  updateRunningFuelSelectionModeUi();
}

function setDurationMode(mode) {
  state.durationMode = mode;

  for (const button of durationModeButtons) {
    button.classList.toggle("is-active", button.dataset.durationMode === mode);
    button.setAttribute("aria-selected", button.dataset.durationMode === mode ? "true" : "false");
  }

  const isCalculated = mode === "calculated";
  durationDisplay.readOnly = isCalculated;
  paceSelect.hidden = !isCalculated;
  paceSelect.disabled = !isCalculated;
  paceDisplay.hidden = isCalculated;
  durationLabel.textContent = isCalculated
    ? "Calculated duration (HH:MM:SS)"
    : "Manual duration (HH:MM:SS)";
  paceLabel.textContent = isCalculated ? "Pace" : "Calculated pace (HH:MM:SS /km)";
  durationDisplay.placeholder = isCalculated ? "" : "01:45:00";

  if (isCalculated) {
    updateCalculatedDuration();
    paceDisplay.value = "";
  } else if (!durationDisplay.value) {
    const distanceKm = Number(calculatorForm.elements.namedItem("distanceKm").value);
    const paceMinPerKm = Number(calculatorForm.elements.namedItem("paceMinPerKm").value);
    const calculatedDuration = estimateDurationMinutes({ distanceKm, paceMinPerKm });
    durationDisplay.value = calculatedDuration ? formatClock(calculatedDuration) : "";
    updateManualPaceDisplay();
  } else {
    updateManualPaceDisplay();
  }
}

function setHyroxFuelMode(mode) {
  state.hyroxFuelMode = mode;

  for (const button of hyroxFuelTabButtons) {
    button.classList.toggle("is-active", button.dataset.hyroxFuelMode === mode);
    button.setAttribute("aria-selected", button.dataset.hyroxFuelMode === mode ? "true" : "false");
  }

  const useCustom = mode === "custom";
  hyroxProfessionalFuelPanel.hidden = useCustom;
  hyroxCustomFuelPanel.hidden = !useCustom;
  updateHyroxFuelSelectionModeUi();
}

function setHyroxFuelSelectionMode(mode) {
  state.hyroxFuelSelectionMode = mode;

  for (const button of hyroxFuelSelectionModeButtons) {
    button.classList.toggle("is-active", button.dataset.hyroxFuelSelectionMode === mode);
    button.setAttribute("aria-selected", button.dataset.hyroxFuelSelectionMode === mode ? "true" : "false");
  }

  updateHyroxFuelSelectionModeUi();
}

function setAppTab(tab) {
  state.activeTab = tab;
  scrollRoutingState.hoveredPanel = null;
  writeStorage(STORAGE_KEYS.activeTab, tab);

  for (const button of appTabButtons) {
    button.classList.toggle("is-active", button.dataset.appTab === tab);
    button.setAttribute("aria-selected", button.dataset.appTab === tab ? "true" : "false");
  }

  runningApp.hidden = tab !== "running";
  hyroxApp.hidden = tab !== "hyrox";
  syncHeroStatsPosition();
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
    durationMode: "calculated",
    temperatureC: 18,
    humidityPercent: 58,
    acclimatizationDays: 8,
    fuelKey: "sis-beta-fuel",
    fuelSelectionMode: "single",
    fuelMode: "professional",
    fuelingKit: [],
    customFuelName: "Maple syrup bottle",
    customServingSizeGrams: 30,
    customCarbsPer100g: 86,
    customSodiumPer100g: 8,
    customTransportType: "single",
    customFuelType: "solid",
    customQuantity: 1,
    customNotes: ""
  };
  const defaults = {
    ...baseDefaults,
    ...(state.profile ?? {}),
    sweatRateLHr: baseDefaults.sweatRateLHr
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
  state.durationMode = defaults.durationMode ?? "calculated";
  state.runningFuelKit = Array.isArray(defaults.fuelingKit) ? defaults.fuelingKit : baseDefaults.fuelingKit;
  setFuelSelectionMode(defaults.fuelSelectionMode ?? "single");
  setFuelMode(defaults.fuelMode ?? "professional");
  setDurationMode(state.durationMode);
  renderRunningFuelKit();
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
    fuelSelectionMode: "single",
    fuelMode: "professional",
    fuelingKit: [],
    customFuelName: "Liquid carbs flask",
    customServingSizeGrams: 40,
    customCarbsPer100g: 75,
    customSodiumPer100g: 450,
    customTransportType: "dual",
    customFuelType: "standard-gel",
    customQuantity: 1,
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
  hyroxForm.elements.namedItem("customFuelType").value = defaults.customFuelType;
  hyroxForm.elements.namedItem("customQuantity").value = defaults.customQuantity;
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

  state.hyroxFuelKit = Array.isArray(defaults.fuelingKit) ? defaults.fuelingKit : [];
  setHyroxFuelSelectionMode(defaults.fuelSelectionMode ?? "single");
  setHyroxFuelMode(defaults.fuelMode ?? "professional");
  renderHyroxFuelKit();
  updateHyroxPredictedDuration();
}

function updateCalculatedDuration() {
  if (state.durationMode !== "calculated") {
    return;
  }

  const distanceKm = Number(calculatorForm.elements.namedItem("distanceKm").value);
  const paceMinPerKm = Number(calculatorForm.elements.namedItem("paceMinPerKm").value);
  const durationMinutes = estimateDurationMinutes({ distanceKm, paceMinPerKm });
  durationDisplay.value = durationMinutes ? formatClock(durationMinutes) : "";
}

function updateManualPaceDisplay() {
  if (state.durationMode !== "manual") {
    return;
  }

  const distanceKm = Number(calculatorForm.elements.namedItem("distanceKm").value);
  const durationMinutes = parseDurationDisplay(durationDisplay.value);
  const paceMinPerKm = Number.isFinite(durationMinutes)
    ? estimatePaceMinPerKm({ distanceKm, durationMinutes })
    : 0;
  paceDisplay.value = formatPaceDisplay(paceMinPerKm);
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

function getRunningFuelKit() {
  return state.runningFuelKit;
}

function getHyroxFuelKit() {
  return state.hyroxFuelKit;
}

function getSelectedFuel() {
  return state.fuelMode === "custom" ? buildSingleCustomFuel(calculatorForm) : getFuelByKey(fuelSelect.value);
}

function getSelectedHyroxFuel() {
  return state.hyroxFuelMode === "custom" ? buildSingleCustomFuel(hyroxForm) : getFuelByKey(hyroxFuelSelect.value);
}

function ensureSingleFuelSelection(form, selectedFuel) {
  const nameField = form.elements.namedItem("customFuelName");
  if (selectedFuel) {
    nameField.setCustomValidity("");
    return true;
  }

  nameField.setCustomValidity("Fill in a valid custom fuel source or switch back to a professional fuel.");
  nameField.reportValidity();
  return false;
}

function getRunningFuelSetup() {
  if (state.fuelSelectionMode === "multiple") {
    return {
      mode: "multiple",
      fuelingKit: getRunningFuelKit()
    };
  }

  return {
    mode: "single",
    selectedFuel: getSelectedFuel()
  };
}

function getHyroxFuelSetup() {
  if (state.hyroxFuelSelectionMode === "multiple") {
    return {
      mode: "multiple",
      fuelingKit: getHyroxFuelKit()
    };
  }

  return {
    mode: "single",
    selectedFuel: getSelectedHyroxFuel()
  };
}

function getCalculatorInput() {
  const distanceKm = Number(calculatorForm.elements.namedItem("distanceKm").value);
  const durationMinutes =
    state.durationMode === "manual"
      ? parseDurationDisplay(durationDisplay.value)
      : estimateDurationMinutes({
          distanceKm,
          paceMinPerKm: Number(calculatorForm.elements.namedItem("paceMinPerKm").value)
        });
  const paceMinPerKm =
    state.durationMode === "manual"
      ? estimatePaceMinPerKm({ distanceKm, durationMinutes })
      : Number(calculatorForm.elements.namedItem("paceMinPerKm").value);
  const temperatureC = Number(calculatorForm.elements.namedItem("temperatureC").value);

  return {
    sex: calculatorForm.elements.namedItem("sex").value,
    weightKg: Number(calculatorForm.elements.namedItem("weightKg").value),
    sweatRateLHr: Number(calculatorForm.elements.namedItem("sweatRateLHr").value),
    gutToleranceGHr: Number(calculatorForm.elements.namedItem("gutToleranceGHr").value),
    sweatSaltiness: calculatorForm.elements.namedItem("sweatSaltiness").value,
    runType: calculatorForm.elements.namedItem("runType").value,
    durationMinutes,
    durationMode: state.durationMode,
    durationMinutesDisplay: durationDisplay.value,
    distanceKm,
    paceMinPerKm,
    paceLabel:
      state.durationMode === "manual"
        ? formatPaceDisplay(paceMinPerKm)
        : paceSelect.options[paceSelect.selectedIndex].textContent,
    temperatureC,
    humidityPercent: Number(calculatorForm.elements.namedItem("humidityPercent").value),
    acclimatizationDays:
      temperatureC >= HEAT_EXPOSURE_THRESHOLD_C
        ? Number(calculatorForm.elements.namedItem("acclimatizationDays").value)
        : 0,
    fuelSelectionMode: state.fuelSelectionMode,
    fuelingKit: getRunningFuelKit(),
    fuelSetup: getRunningFuelSetup(),
    fuelMode: state.fuelMode,
    customFuelName: calculatorForm.elements.namedItem("customFuelName").value,
    customServingSizeGrams: calculatorForm.elements.namedItem("customServingSizeGrams").value,
    customCarbsPer100g: calculatorForm.elements.namedItem("customCarbsPer100g").value,
    customSodiumPer100g: calculatorForm.elements.namedItem("customSodiumPer100g").value,
    customTransportType: calculatorForm.elements.namedItem("customTransportType").value,
    customFuelType: calculatorForm.elements.namedItem("customFuelType").value,
    customQuantity: calculatorForm.elements.namedItem("customQuantity").value,
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
    fuelSelectionMode: state.hyroxFuelSelectionMode,
    fuelingKit: getHyroxFuelKit(),
    fuelSetup: getHyroxFuelSetup(),
    fuelMode: state.hyroxFuelMode,
    customFuelName: hyroxForm.elements.namedItem("customFuelName").value,
    customServingSizeGrams: hyroxForm.elements.namedItem("customServingSizeGrams").value,
    customCarbsPer100g: hyroxForm.elements.namedItem("customCarbsPer100g").value,
    customSodiumPer100g: hyroxForm.elements.namedItem("customSodiumPer100g").value,
    customTransportType: hyroxForm.elements.namedItem("customTransportType").value,
    customFuelType: hyroxForm.elements.namedItem("customFuelType").value,
    customQuantity: hyroxForm.elements.namedItem("customQuantity").value,
    customNotes: hyroxForm.elements.namedItem("customNotes").value,
    stationEstimates: HYROX_STATIONS.map((station) => ({
      key: station.key,
      name: station.name,
      minutes: Number(hyroxForm.elements.namedItem(station.key).value)
    }))
  };
}

function renderRunPlan(plan, run) {
  const remainingCarbGap = Math.max(round(plan.totalCarbsGoal - plan.fuelTimeline.actualCarbsTotal, 0), 0);
  const excessCarbs = Math.max(round(plan.fuelTimeline.actualCarbsTotal - plan.totalCarbsGoal, 0), 0);
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
    <p>
      ${plan.fuelPlanMode === "multiple" ? "Current kit" : "Selected fuel"}:
      <strong>${formatFuelKitNames(plan.fuelKitSummary)}</strong> containing
      <strong>${round(plan.fuelKitSummary.totalCarbs, 0)} g carbs</strong> and
      <strong>${round(plan.fuelKitSummary.totalSodium, 0)} mg sodium</strong> across
      <strong>${plan.fuelKitSummary.totalServings} serving(s)</strong>.
    </p>
    ${
      plan.fuelPlanMode === "single" && plan.totalCarbsGoal > 0
        ? `<p>${formatSingleFuelRequirement(plan.fuelKitSummary)}</p>`
        : ""
    }
    ${
      plan.fuelPlanMode === "multiple" && plan.totalCarbsGoal > 0
        ? `
          <p>
            Carbohydrate target for this run: <strong>${round(plan.totalCarbsGoal, 0)} g</strong>.
            Current kit total: <strong>${round(plan.fuelTimeline.actualCarbsTotal, 0)} g</strong>.
            ${
              excessCarbs > 0
                ? `That is <strong>${excessCarbs} g too much</strong>.`
                : remainingCarbGap > 0
                  ? `You are still <strong>${remainingCarbGap} g short</strong>.`
                  : "Your kit matches the target closely."
            }
          </p>
        `
        : ""
    }
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
  if (plan.fuelPlanMode === "multiple" && plan.totalCarbsGoal > 0 && remainingCarbGap > 0) {
    const deficitItem = document.createElement("li");
    deficitItem.innerHTML = `
      <span class="time">Fuel gap</span>
      You still need to add about <strong>${remainingCarbGap} g of carbohydrates</strong> to cover this run.
    `;
    fuelTimeline.appendChild(deficitItem);
  }

  if (plan.preStartFuel) {
    const preStartItem = document.createElement("li");
    preStartItem.innerHTML = `
      <span class="time">Pre-start</span>
      ${plan.preStartFuel.label} <strong>Do not take it too early</strong>: ${plan.preStartFuel.warning}
    `;
    fuelTimeline.appendChild(preStartItem);
  }

  if (plan.fuelTimeline.events.length === 0) {
    const li = document.createElement("li");
    li.textContent =
      plan.fuelPlanMode === "multiple" && plan.totalCarbsGoal > 0 && remainingCarbGap > 0
        ? "Add more fuel to your kit, then regenerate the plan to place the carb events."
        : "Skip intra-run carbohydrates. Focus on water and electrolytes only.";
    fuelTimeline.appendChild(li);
  } else {
    for (const event of plan.fuelTimeline.events) {
      const pairedDrinkEvent = plan.hydrationPlan.events.find(
        (hydrationEvent) => hydrationEvent.pairedWithFuel && hydrationEvent.minute === event.minute
      );
      const distanceMarker = formatFuelDistanceMarker(event.minute, run.paceMinPerKm, run.distanceKm);
      const li = document.createElement("li");
      li.innerHTML = `<span class="time">${formatClock(event.minute)} · ${distanceMarker}</span> Take <strong>1 full serving</strong> of ${event.name} (${event.carbs}g carbs)${
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

  if (plan.scheduledFuelSodiumMg > 0) {
    const fuelSodiumItem = document.createElement("li");
    fuelSodiumItem.innerHTML = `
      <span class="time">Fuel sodium</span>
      The scheduled fuel events already provide <strong>${round(plan.scheduledFuelSodiumMg, 0)} mg sodium</strong>, so only the remaining
      <strong>${plan.totalExternalSodiumMg} mg</strong> needs to go into the water.
    `;
    hydrationTimeline.appendChild(fuelSodiumItem);
  }

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
    const distanceMarker = formatFuelDistanceMarker(event.minute, run.paceMinPerKm, run.distanceKm);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="time">${formatClock(event.minute)} · ${distanceMarker}</span>
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
    `${plan.fuelTimeline.actualCarbsHr || 0} g/hr delivered by the current kit`,
    `${plan.targetFluidLHr} L/hr water target from sweat-rate scaling`,
    `${plan.targetSodiumMgHr} mg/hr sodium target before gel contribution`,
    `${plan.fuelSodiumMgHr} mg/hr sodium coming from the selected fuel kit`,
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
    ...plan.fuelKitSummary.uniqueNotes,
    plan.fuelKitSummary.hasDualTransport
      ? "This kit includes dual-transport carbohydrates, which helps when you are targeting higher hourly intake."
      : "This kit relies on single-source carbohydrates, so practical intake stays closer to 60 g/hr.",
    plan.fuelKitSummary.hasMixedHydrogelKit
      ? "Hydrogels and standard sugars are deliberately spaced apart in the timeline to reduce stomach overload."
      : null
  ]
    .filter(Boolean)
    .forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    productNotes.appendChild(li);
  });
}

function renderHyroxPlan(plan, input) {
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
      <strong>${formatFuelKitNames(plan.fuelKitSummary)}</strong> with a hydration plan of <strong>${plan.hydrationPlan.totalFluidL} L</strong>.
    </p>
    <p>
      ${plan.fuelPlanMode === "multiple" ? "Current race kit" : "Selected race fuel"} provides
      <strong>${round(plan.fuelKitSummary.totalCarbs, 0)} g carbs</strong> and
      <strong>${round(plan.fuelKitSummary.totalSodium, 0)} mg sodium</strong> across
      <strong>${plan.fuelKitSummary.totalServings} serving(s)</strong>.
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
      label: "Fuel sodium",
      text: `Your race kit already supplies ${round(plan.fuelKitSummary.totalSodium, 0)} mg sodium, so the water only needs to cover the remaining electrolyte gap.`
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

function handleAddProfessionalFuel(event) {
  event.preventDefault();
  if (addFuelKitItem("runningFuelKit", buildProfessionalKitItem(fuelSelect, fuelQuantityInput))) {
    renderRunningFuelKit();
  }
}

function handleAddCustomFuel(event) {
  event.preventDefault();
  const customItem = buildCustomKitItem(calculatorForm);
  if (!customItem) {
    calculatorForm.reportValidity();
    return;
  }

  if (addFuelKitItem("runningFuelKit", customItem)) {
    renderRunningFuelKit();
  }
}

function handleAddHyroxProfessionalFuel(event) {
  event.preventDefault();
  if (addFuelKitItem("hyroxFuelKit", buildProfessionalKitItem(hyroxFuelSelect, hyroxFuelQuantityInput))) {
    renderHyroxFuelKit();
  }
}

function handleAddHyroxCustomFuel(event) {
  event.preventDefault();
  const customItem = buildCustomKitItem(hyroxForm);
  if (!customItem) {
    hyroxForm.reportValidity();
    return;
  }

  if (addFuelKitItem("hyroxFuelKit", customItem)) {
    renderHyroxFuelKit();
  }
}

function handleFuelKitClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const adjustButton = target?.closest("[data-running-fuel-adjust]");
  if (adjustButton) {
    adjustFuelKitItemQuantity(
      "runningFuelKit",
      adjustButton.dataset.runningFuelAdjust,
      Number(adjustButton.dataset.delta)
    );
    renderRunningFuelKit();
    return;
  }

  const removeButton = target?.closest("[data-running-fuel-remove]");
  if (!removeButton) {
    return;
  }

  removeFuelKitItem("runningFuelKit", removeButton.dataset.runningFuelRemove);
  renderRunningFuelKit();
}

function handleHyroxFuelKitClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const adjustButton = target?.closest("[data-hyrox-fuel-adjust]");
  if (adjustButton) {
    adjustFuelKitItemQuantity(
      "hyroxFuelKit",
      adjustButton.dataset.hyroxFuelAdjust,
      Number(adjustButton.dataset.delta)
    );
    renderHyroxFuelKit();
    return;
  }

  const removeButton = target?.closest("[data-hyrox-fuel-remove]");
  if (!removeButton) {
    return;
  }

  removeFuelKitItem("hyroxFuelKit", removeButton.dataset.hyroxFuelRemove);
  renderHyroxFuelKit();
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
  if (!Number.isFinite(formValues.durationMinutes) || formValues.durationMinutes <= 0) {
    durationDisplay.setCustomValidity("Enter a valid duration in HH:MM:SS format.");
    durationDisplay.reportValidity();
    return;
  }
  durationDisplay.setCustomValidity("");
  if (
    formValues.fuelSelectionMode === "single" &&
    !ensureSingleFuelSelection(calculatorForm, formValues.fuelSetup.selectedFuel)
  ) {
    return;
  }
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
    durationMinutes: formValues.durationMinutes,
    paceMinPerKm: formValues.paceMinPerKm,
    paceLabel: formValues.paceLabel,
    temperatureC: formValues.temperatureC,
    humidityPercent: formValues.humidityPercent,
    acclimatizationDays: formValues.acclimatizationDays
  };
  const plan = buildRunPlan(profile, run, formValues.fuelSetup);

  renderRunPlan(plan, run);

  state.profile = { ...formValues };
  state.lastRun = { run, fuelSetup: formValues.fuelSetup, plan };
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
  if (
    formValues.fuelSelectionMode === "single" &&
    !ensureSingleFuelSelection(hyroxForm, formValues.fuelSetup.selectedFuel)
  ) {
    return;
  }
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
  const plan = buildHyroxPlan(profile, settings, formValues.fuelSetup);

  renderHyroxPlan(plan, formValues);

  state.hyroxProfile = {
    ...formValues,
    ...Object.fromEntries(formValues.stationEstimates.map((station) => [station.key, station.minutes]))
  };
  state.hyroxLastPlan = { settings, fuelSetup: formValues.fuelSetup, plan };
  writeStorage(STORAGE_KEYS.hyroxProfile, state.hyroxProfile);
  writeStorage(STORAGE_KEYS.hyroxLastPlan, state.hyroxLastPlan);
}

function updateSweatRateModule({ syncRunningSelect = true } = {}) {
  const result = calculateSweatRate({
    preMassKg: Number(sweatForm.elements.namedItem("preMassKg").value),
    postMassKg: Number(sweatForm.elements.namedItem("postMassKg").value),
    fluidLiters: Number(sweatForm.elements.namedItem("fluidLiters").value),
    durationMinutes: Number(sweatForm.elements.namedItem("durationMinutes").value)
  });
  renderSweatRate(result);
  if (syncRunningSelect) {
    setSelectToNumericValue(sweatRateSelect, result.sweatRateLHr, "Measured sweat rate");
  }
}

function handleSweatSubmit(event) {
  event.preventDefault();
  updateSweatRateModule({ syncRunningSelect: true });
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
  syncHeroStatsPosition();

  calculatorForm.addEventListener("submit", handleCalculatorSubmit);
  hyroxForm.addEventListener("submit", handleHyroxSubmit);
  sweatForm.addEventListener("submit", handleSweatSubmit);
  gutForm.addEventListener("submit", handleGutSubmit);
  macroForm.addEventListener("submit", handleMacroSubmit);
  addProfessionalFuelButton.addEventListener("click", handleAddProfessionalFuel);
  addCustomFuelButton.addEventListener("click", handleAddCustomFuel);
  addHyroxProfessionalFuelButton.addEventListener("click", handleAddHyroxProfessionalFuel);
  addHyroxCustomFuelButton.addEventListener("click", handleAddHyroxCustomFuel);
  fuelKitList.addEventListener("click", handleFuelKitClick);
  hyroxFuelKitList.addEventListener("click", handleHyroxFuelKitClick);
  calculatorForm.elements.namedItem("distanceKm").addEventListener("input", updateCalculatedDuration);
  calculatorForm.elements.namedItem("distanceKm").addEventListener("input", updateManualPaceDisplay);
  paceSelect.addEventListener("change", updateCalculatedDuration);
  durationDisplay.addEventListener("input", () => {
    if (state.durationMode === "manual") {
      durationDisplay.setCustomValidity("");
      updateManualPaceDisplay();
    }
  });
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

  for (const button of fuelModeButtons) {
    button.addEventListener("click", () => setFuelMode(button.dataset.fuelMode));
  }

  for (const button of fuelSelectionModeButtons) {
    button.addEventListener("click", () => setFuelSelectionMode(button.dataset.fuelSelectionMode));
  }

  for (const button of durationModeButtons) {
    button.addEventListener("click", () => setDurationMode(button.dataset.durationMode));
  }

  for (const button of hyroxFuelTabButtons) {
    button.addEventListener("click", () => setHyroxFuelMode(button.dataset.hyroxFuelMode));
  }

  for (const button of hyroxFuelSelectionModeButtons) {
    button.addEventListener("click", () => setHyroxFuelSelectionMode(button.dataset.hyroxFuelSelectionMode));
  }

  for (const button of appTabButtons) {
    button.addEventListener("click", () => {
      setAppTab(button.dataset.appTab);
      syncActiveTabPlan();
    });
  }

  document.querySelectorAll(".controls-panel, .results-column").forEach((panel) => {
    panel.addEventListener("pointerenter", handleScrollPanelHover);
    panel.addEventListener("pointerleave", handleScrollPanelHover);
  });

  window.addEventListener("resize", () => {
    scrollRoutingState.hoveredPanel = null;
    syncHeroStatsPosition();
  });
  window.addEventListener("wheel", handleDesktopWheelRouting, { passive: false });

  handleCalculatorSubmit(new Event("submit", { cancelable: true }));
  handleHyroxSubmit(new Event("submit", { cancelable: true }));
  updateSweatRateModule({ syncRunningSelect: false });
  handleGutSubmit(new Event("submit", { cancelable: true }));
  handleMacroSubmit(new Event("submit", { cancelable: true }));
  syncActiveTabPlan();
}

bootstrap();
