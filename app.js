// Backplan – Berechnung und Anzeige. Keine Bibliotheken, nichts wird nachgeladen oder gespeichert.
'use strict';
{
  // ===================================================================
  // Konstanten
  // ===================================================================

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  // Grundrezept für 1112 g Teig. Alle Mengen werden auf das
  // gewünschte Teiggewicht hochgerechnet.
  const BASE_RECIPE = {
    brothGrain: 250,   // Schrot fürs Brühstück
    brothWater: 250,   // kochendes Wasser fürs Brühstück
    salt: 12,          // Salz (kommt ins Brühstück)
    sourdough: 500,    // fertiger Sauerteig im Teig
    doughFlour: 100,   // Mehl im Teig
  };
  const BASE_DOUGH_WEIGHT = 1112;

  // Stufe 1 dauert immer 3 h. Nach der Arcady-Regel ist das Mehl
  // dann 3 × Starter, z. B. 15 g Mehl + 15 g Wasser + 5 g Starter.
  const STAGE1_HOURS = 3;

  const SPICE_GRAMS_PER_KG = 10;

  // Schieberegler fürs Teiggewicht
  const SLIDER_MIN = 300;
  const SLIDER_MAX = 3000;
  const SLIDER_STEP = 100;

  // Obergrenze, damit absurde Eingaben die Berechnung nicht lahmlegen.
  const MAX_DOUGH_WEIGHT = 10000;
  const RECOMMENDED_MIN_STAGE_HOURS = 10;

  const DEFAULTS = {
    doughWeight: 1000,
    flourSourdough: 'Roggenvollkornmehl',
    brothGrain: 'Schrot',
    flourDough: 'Dinkelvollkornmehl',
    saltPercent: 50,
    stages: 2,
    finalStageHours: 10,
    reserveGrams: 10,
    starterAvailableGrams: 10,
    brothHoursBeforeKneading: 10,
    kneadMinutes: 10,
    restMinutes: 90,
    proofMinutes: 60,
    preheatMinutes: 15,
    preheatTemperature: 230,
    bakeTemperature: 180,
    bakeMinutes: 60,
    spice: false,
  };

  // Alle einstellbaren Werte. Daraus wird der Bereich
  // „Alle Variablen anpassen“ aufgebaut.
  const SETTINGS = [
    { key: 'flourSourdough', type: 'select', label: 'Mehl Sauerteig (beide Stufen)',
      options: ['Roggenvollkornmehl', 'Roggenmehl'] },
    { key: 'brothGrain', type: 'select', label: 'Getreide im Brühstück',
      options: ['Schrot', 'Dinkelvollkornschrot'] },
    { key: 'flourDough', type: 'select', label: 'Mehl im Teig',
      options: ['Dinkelvollkornmehl', 'Roggenmehl'] },
    { key: 'saltPercent', type: 'number', label: 'Salzmenge (% der Grundmenge)',
      hint: '100 % = 12 g pro 1112 g Teig' },
    { key: 'stages', type: 'select', label: 'Sauerteig-Stufen', numeric: true,
      options: [{ value: 2, text: '2 Stufen' }, { value: 1, text: '1 Stufe' }] },
    { key: 'finalStageHours', type: 'number', label: 'Letzte Stufe – Dauer (h)',
      hint: 'Empfehlung: mind. 10 h. Stufe 1 dauert immer 3 h.' },
    { key: 'reserveGrams', type: 'number', label: 'Anstellgut fürs nächste Mal (g)',
      hint: 'Wird von der letzten Stufe abgenommen' },
    { key: 'starterAvailableGrams', type: 'number', label: 'Anstellgut im Kühlschrank (g)',
      hint: 'Es wird geprüft, ob es reicht' },
    { key: 'brothHoursBeforeKneading', type: 'number', label: 'Brühstück: Stunden vor dem Kneten',
      hint: 'Muss gut abgekühlt sein' },
    { key: 'kneadMinutes', type: 'number', label: 'Kneten (min)', hint: 'Schätzung' },
    { key: 'restMinutes', type: 'number', label: 'Teigruhe nach dem Kneten (min)',
      hint: 'Empfehlung: ca. 1,5 h' },
    { key: 'proofMinutes', type: 'number', label: 'Im Gärkörbchen oder in der Form (min)',
      hint: 'Empfehlung: ca. 1 h' },
    { key: 'preheatMinutes', type: 'number', label: 'Ofen vorheizen (min)' },
    { key: 'preheatTemperature', type: 'number', label: 'Vorheizen auf (°C)' },
    { key: 'bakeTemperature', type: 'number', label: 'Backtemperatur nach dem Einschieben (°C)' },
    { key: 'bakeMinutes', type: 'number', label: 'Backzeit, mindestens (min)' },
    { key: 'spice', type: 'checkbox', label: 'Brotgewürz (10 g pro kg Teig)',
      hint: 'Fenchel, Kümmel, Anis, Koriander zu gleichen Teilen' },
  ];

  // ===================================================================
  // Hilfsfunktionen
  // ===================================================================

  const byId = (id) => document.getElementById(id);

  /** Text sicher in HTML einsetzen. */
  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  const shiftTime = (date, milliseconds) => new Date(date.getTime() + milliseconds);
  const twoDigits = (number) => String(number).padStart(2, '0');

  /** Unter 10 g auf halbe Gramm runden, sonst auf ganze Gramm. */
  function formatGrams(grams) {
    if (grams < 10) return String(Math.round(grams * 2) / 2).replace('.', ',');
    return String(Math.round(grams));
  }

  function formatDuration(minutes) {
    const total = Math.round(minutes);
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (hours === 0) return `${rest} min`;
    if (rest === 0) return `${hours} h`;
    return `${hours} h ${rest} min`;
  }

  const formatClock = (date) => `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;

  /** z. B. „morgen, Sa 28.11.“ */
  function formatDay(date) {
    const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const RELATIVE = { '-1': 'gestern', '0': 'heute', '1': 'morgen', '2': 'übermorgen' };
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDifference = Math.round((startOfDay(date) - startOfDay(new Date())) / DAY);
    const relative = RELATIVE[dayDifference];
    const absolute = `${WEEKDAYS[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}.`;
    return relative ? `${relative}, ${absolute}` : absolute;
  }

  /** Datum im Format, das <input type="datetime-local"> erwartet. */
  function toDateTimeInputValue(date) {
    return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
      + `T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
  }

  /** Zahl aus einem Eingabefeld; leer, ungültig oder negativ → Standardwert. */
  function readNonNegativeNumber(text, fallback) {
    const number = Number.parseFloat(text);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  // ===================================================================
  // Berechnung
  // ===================================================================

  /** Glatte Mengen: ab 50 g auf 5 g, ab 10 g auf 1 g, darunter auf 0,5 g. */
  function roundNicely(grams) {
    if (grams >= 50) return Math.round(grams / 5) * 5;
    if (grams >= 10) return Math.round(grams);
    return Math.round(grams * 2) / 2;
  }

  /**
   * Sauerteig nach der Arcady-Regel: Ansatz = Mehl ÷ Stunden, also Mehl = Ansatz × Stunden.
   * Mehl und Wasser 1:1. Nichts wird weggeworfen: Stufe 1 kommt komplett in Stufe 2,
   * und von Stufe 2 geht alles außer dem Anstellgut in den Teig.
   *
   * Der Starter aus dem Kühlschrank wird in ganzen Gramm gewählt – so klein wie möglich,
   * aber so, dass das gewünschte Teiggewicht mindestens erreicht wird.
   */
  function calculateSourdough(settings) {
    const hours = Math.max(0.5, settings.finalStageHours);
    const targetSourdough = BASE_RECIPE.sourdough * settings.doughWeight / BASE_DOUGH_WEIGHT;
    const twoStages = settings.stages === 2;

    const build = (starterGrams) => {
      if (twoStages) {
        const stage1Flour = starterGrams * STAGE1_HOURS;
        const stage1Total = 2 * stage1Flour + starterGrams;
        const stage2Flour = Math.round(stage1Total * hours);
        return {
          starterFromFridge: starterGrams,
          stage1: { flour: stage1Flour, water: stage1Flour, starter: starterGrams, total: stage1Total },
          finalStage: { flour: stage2Flour, water: stage2Flour, starter: stage1Total, hours,
            total: 2 * stage2Flour + stage1Total },
        };
      }
      const flour = Math.round(starterGrams * hours);
      return {
        starterFromFridge: starterGrams,
        stage1: null,
        finalStage: { flour, water: flour, starter: starterGrams, hours, total: 2 * flour + starterGrams },
      };
    };

    let starterGrams = 1;
    while (build(starterGrams).finalStage.total - settings.reserveGrams < targetSourdough) {
      starterGrams += 1;
    }
    return build(starterGrams);
  }

  function calculateRecipe(settings) {
    const sourdough = calculateSourdough(settings);
    const sourdoughInDough = sourdough.finalStage.total - settings.reserveGrams;

    // Alle anderen Zutaten passen sich der tatsächlichen Sauerteigmenge an.
    const scale = sourdoughInDough / BASE_RECIPE.sourdough;
    const brothGrain = roundNicely(BASE_RECIPE.brothGrain * scale);
    const brothWater = roundNicely(BASE_RECIPE.brothWater * scale);
    const salt = roundNicely(BASE_RECIPE.salt * scale * settings.saltPercent / 100);
    const doughFlour = roundNicely(BASE_RECIPE.doughFlour * scale);
    const doughWeightWithoutSpice = brothGrain + brothWater + salt + sourdoughInDough + doughFlour;
    const spice = settings.spice ? roundNicely(doughWeightWithoutSpice / 1000 * SPICE_GRAMS_PER_KG) : 0;

    return {
      twoStages: sourdough.stage1 !== null,
      starterFromFridge: sourdough.starterFromFridge,
      stage1: sourdough.stage1,
      finalStage: sourdough.finalStage,
      sourdoughInDough,
      reserve: settings.reserveGrams,
      brothGrain,
      brothWater,
      salt,
      doughFlour,
      spice,
      doughWeight: doughWeightWithoutSpice + spice,
    };
  }

  /** Alle Zeitpunkte, rückwärts gerechnet vom Ende der Backzeit. */
  function calculateTimes(settings, recipe, bakeEnd) {
    const ovenIn = shiftTime(bakeEnd, -settings.bakeMinutes * MINUTE);
    const proofStart = shiftTime(ovenIn, -settings.proofMinutes * MINUTE);
    const kneadStart = shiftTime(proofStart, -(settings.restMinutes + settings.kneadMinutes) * MINUTE);
    const finalStageStart = shiftTime(kneadStart, -recipe.finalStage.hours * HOUR);
    return {
      stage1Start: shiftTime(finalStageStart, -STAGE1_HOURS * HOUR),
      finalStageStart,
      brothStart: shiftTime(kneadStart, -settings.brothHoursBeforeKneading * HOUR),
      kneadStart,
      proofStart,
      preheatStart: shiftTime(ovenIn, -settings.preheatMinutes * MINUTE),
      ovenIn,
      bakeEnd,
    };
  }

  /** Ablauf als sortierte Liste von Schritten. */
  function buildSteps(settings, recipe, times) {
    const g = formatGrams;
    const flourSourdough = escapeHtml(settings.flourSourdough);
    const flourDough = escapeHtml(settings.flourDough);
    const brothGrain = escapeHtml(settings.brothGrain);
    const { stage1, finalStage } = recipe;
    const steps = [];

    if (recipe.twoStages) {
      steps.push({
        time: times.stage1Start,
        title: 'Sauerteig Stufe 1 ansetzen',
        html: `${g(stage1.flour)} g ${flourSourdough} + ${g(stage1.water)} g Wasser`
          + ` + ${g(stage1.starter)} g Anstellgut aus dem Kühlschrank verrühren.`
          + ` ${formatDuration(STAGE1_HOURS * 60)} ruhen lassen.`,
      });
      steps.push({
        time: times.finalStageStart,
        title: 'Sauerteig Stufe 2 ansetzen',
        html: `Stufe 1 komplett (ca. ${g(stage1.total)} g) + ${g(finalStage.flour)} g ${flourSourdough}`
          + ` + ${g(finalStage.water)} g Wasser (ca. 36 °C) verrühren.`
          + ` ${formatDuration(finalStage.hours * 60)} ruhen lassen.`
          + ` Davon kommen später ${g(recipe.reserve)} g zurück in den Kühlschrank.`,
      });
    } else {
      steps.push({
        time: times.finalStageStart,
        title: 'Sauerteig ansetzen (1 Stufe)',
        html: `${g(finalStage.flour)} g ${flourSourdough} + ${g(finalStage.water)} g Wasser (ca. 36 °C)`
          + ` + ${g(finalStage.starter)} g Anstellgut verrühren.`
          + ` ${formatDuration(finalStage.hours * 60)} ruhen lassen.`,
      });
    }

    steps.push({
      time: times.brothStart,
      title: 'Brühstück machen',
      html: `${g(recipe.brothGrain)} g ${brothGrain} + ${g(recipe.salt)} g Salz (${saltNote(recipe)})`
        + ` mit ${g(recipe.brothWater)} ml kochendem Wasser übergießen. Gut abkühlen lassen.`,
    });
    steps.push({
      time: times.kneadStart,
      kind: 'alert',
      title: 'STOPP! Erst Anstellgut abnehmen!',
      html: `Bevor irgendetwas in den Teig kommt: ${g(recipe.reserve)} g vom fertigen Sauerteig`
        + `${recipe.twoStages ? ' (Stufe 2)' : ''} in ein sauberes Glas füllen und ab in den Kühlschrank.`
        + ' Ohne das gibt es beim nächsten Mal kein Brot!',
    });
    steps.push({
      time: times.kneadStart,
      title: 'Teig kneten',
      html: `Brühstück + ${g(recipe.sourdoughInDough)} g Sauerteig + ${g(recipe.doughFlour)} g ${flourDough}`
        + `${recipe.spice ? ` + ${g(recipe.spice)} g Brotgewürz` : ''} gut verkneten.`
        + ` Danach ${formatDuration(settings.restMinutes)} ruhen lassen.`,
    });
    steps.push({
      time: times.proofStart,
      title: 'Laib formen oder in die Backform',
      html: `<b>Variante A:</b> Laib formen, ins bemehlte Gärkörbchen (oder Schüssel mit Tuch) legen`
        + ` und ${formatDuration(settings.proofMinutes)} ruhen lassen.<br>`
        + `<b>Variante B:</b> Teig in eine gefettete Backform geben und ebenfalls`
        + ` ${formatDuration(settings.proofMinutes)} ruhen lassen.`,
    });
    steps.push({
      time: times.preheatStart,
      title: 'Ofen vorheizen',
      html: `Auf ${g(settings.preheatTemperature)} °C vorheizen (${formatDuration(settings.preheatMinutes)}).`,
    });
    steps.push({
      time: times.ovenIn,
      kind: 'oven',
      title: 'Brot rein',
      html: `Gut beschwaden (Wasser in den Ofen sprühen), Ofen auf ${g(settings.bakeTemperature)} °C`
        + ` runterstellen und <b>mindestens ${formatDuration(settings.bakeMinutes)}</b> backen.`,
    });
    steps.push({
      time: times.bakeEnd,
      kind: 'oven',
      title: 'Brot frühestens aus dem Ofen',
      html: 'Nur herausnehmen, wenn es durchgebacken ist – sonst noch etwas länger im Ofen lassen.'
        + ' Dann auskühlen lassen.',
    });

    // Array.sort ist stabil: Bei gleicher Uhrzeit bleibt „STOPP“ vor „Teig kneten“.
    return steps.sort((a, b) => a.time - b.time);
  }

  function saltNote(recipe) {
    return 'absichtlich wenig Salz – je nach Geschmack bis zur doppelten Menge,'
      + ` also bis ${formatGrams(recipe.salt * 2)} g`;
  }

  function collectWarnings(settings, recipe, times, steps) {
    const warnings = [];
    const now = new Date();
    const firstStep = steps[0].time;

    if (firstStep < now) {
      const earliestEnd = shiftTime(now, times.bakeEnd - firstStep + 5 * MINUTE);
      warnings.push(`<b>Nicht mehr zu schaffen:</b> Der erste Schritt hätte ${formatDay(firstStep)}`
        + ` um ${formatClock(firstStep)} beginnen müssen.`);
      warnings.push(`Wenn du jetzt startest, ist das Brot frühestens ${formatDay(earliestEnd)}`
        + ` um ${formatClock(earliestEnd)} fertig gebacken.`);
    }
    if (recipe.finalStage.hours < RECOMMENDED_MIN_STAGE_HOURS) {
      warnings.push('Die letzte Stufe ist kürzer als 10 h – empfohlen ist: eine Stufe mindestens 10 h.');
    }
    if (recipe.starterFromFridge > settings.starterAvailableGrams) {
      warnings.push(`Du brauchst ${formatGrams(recipe.starterFromFridge)} g Anstellgut,`
        + ` hast aber ${formatGrams(settings.starterAvailableGrams)} g.`);
    }
    if (times.brothStart > shiftTime(times.kneadStart, -HOUR)) {
      warnings.push('Das Brühstück hat weniger als 1 h zum Abkühlen. Es sollte gut abgekühlt sein.');
    }
    return warnings;
  }

  // ===================================================================
  // Anzeige
  // ===================================================================

  function renderSettingsForm() {
    const html = SETTINGS.map((field) => {
      const id = `setting-${field.key}`;
      const hint = field.hint ? `<div class="hint">${escapeHtml(field.hint)}</div>` : '';
      const label = escapeHtml(field.label);

      if (field.type === 'checkbox') {
        return `<div><label class="checkbox-label"><input type="checkbox" id="${id}"> ${label}</label>${hint}</div>`;
      }
      if (field.type === 'select') {
        const options = field.options.map((option) => {
          const value = typeof option === 'object' ? option.value : option;
          const text = typeof option === 'object' ? option.text : option;
          return `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`;
        }).join('');
        return `<div><label for="${id}">${label}</label><select id="${id}">${options}</select>${hint}</div>`;
      }
      return `<div><label for="${id}">${label}</label>`
        + `<input type="number" id="${id}" min="0" step="any" inputmode="decimal">${hint}</div>`;
    }).join('');
    byId('settings').innerHTML = html;
  }

  function writeSettingsToForm(settings) {
    byId('weight').value = settings.doughWeight;
    syncSliderToWeight();
    for (const field of SETTINGS) {
      const input = byId(`setting-${field.key}`);
      if (field.type === 'checkbox') input.checked = settings[field.key];
      else input.value = settings[field.key];
    }
  }

  function readSettingsFromForm() {
    const settings = { ...DEFAULTS };
    for (const field of SETTINGS) {
      const input = byId(`setting-${field.key}`);
      if (field.type === 'checkbox') settings[field.key] = input.checked;
      else if (field.type === 'select') settings[field.key] = field.numeric ? Number(input.value) : input.value;
      else settings[field.key] = readNonNegativeNumber(input.value, DEFAULTS[field.key]);
    }
    const weight = readNonNegativeNumber(byId('weight').value, DEFAULTS.doughWeight);
    settings.doughWeight = weight > 0 ? Math.min(weight, MAX_DOUGH_WEIGHT) : DEFAULTS.doughWeight;
    return settings;
  }

  function renderPlan(steps) {
    const now = new Date();
    byId('plan').innerHTML = steps.map((step) => {
      const classes = [step.kind || '', step.time < now ? 'past' : ''].join(' ').trim();
      return `<li class="${classes}">`
        + `<div class="step-time">${formatClock(step.time)}<span class="step-day">${formatDay(step.time)}</span></div>`
        + `<div><h3>${escapeHtml(step.title)}</h3><p>${step.html}</p></div>`
        + '</li>';
    }).join('');
  }

  function renderStart(steps, times, recipe) {
    const firstStep = steps[0].time;
    byId('startTime').textContent = formatClock(firstStep);
    byId('startRel').textContent = `${formatDay(firstStep)} · Gesamtdauer bis zum fertigen Brot: `
      + `${formatDuration((times.bakeEnd - firstStep) / MINUTE)} · Teig: ${formatGrams(recipe.doughWeight)} g`;
  }

  function renderWarnings(warnings) {
    byId('warnings').innerHTML = warnings.length
      ? `<div class="warn">${warnings.map((text) => `<p>${text}</p>`).join('')}</div>`
      : '';
  }

  function renderIngredients(settings, recipe) {
    const g = formatGrams;
    const table = (rows) => '<table>' + rows.map(([name, amount]) =>
      `<tr><td>${escapeHtml(name)}</td><td class="amount">${escapeHtml(amount)}</td></tr>`).join('') + '</table>';
    const card = (title, content) => `<div class="card"><h3>${escapeHtml(title)}</h3>${content}</div>`;
    const cards = [];

    if (recipe.twoStages) {
      cards.push(card('Sauerteig Stufe 1', table([
        [settings.flourSourdough, `${g(recipe.stage1.flour)} g`],
        ['Wasser', `${g(recipe.stage1.water)} g`],
        ['Anstellgut (Kühlschrank)', `${g(recipe.stage1.starter)} g`],
      ])));
    }
    cards.push(card(recipe.twoStages ? 'Sauerteig Stufe 2' : 'Sauerteig', table([
      [settings.flourSourdough, `${g(recipe.finalStage.flour)} g`],
      ['Wasser ca. 36 °C', `${g(recipe.finalStage.water)} g`],
      [recipe.twoStages ? 'Stufe 1 (komplett)' : 'Anstellgut (Kühlschrank)', `${g(recipe.finalStage.starter)} g`],
    ]) + `<div class="keep">Davon ${g(recipe.reserve)} g zurück in den Kühlschrank!</div>`));
    cards.push(card('Brühstück', table([
      [settings.brothGrain, `${g(recipe.brothGrain)} g`],
      ['Wasser, kochend', `${g(recipe.brothWater)} ml`],
      [`Salz (${saltNote(recipe)})`, `${g(recipe.salt)} g`],
    ])));
    const doughRows = [
      ['Brühstück', 'alles'],
      ['Sauerteig (alles außer Anstellgut)', `${g(recipe.sourdoughInDough)} g`],
      [settings.flourDough, `${g(recipe.doughFlour)} g`],
    ];
    if (recipe.spice) doughRows.push(['Brotgewürz', `${g(recipe.spice)} g`]);
    cards.push(card('Teig', table(doughRows)));

    byId('ingredients').innerHTML = cards.join('');
    byId('reserveNote').textContent = `Teig insgesamt: ${g(recipe.doughWeight)} g`
      + ` (gewünscht ca. ${g(settings.doughWeight)} g – aufgerundet für glatte Mengen).`
      + ` Anstellgut fürs nächste Mal: ${g(recipe.reserve)} g.`;
  }

  /** Liest alle Eingaben und berechnet den kompletten Plan. */
  function computePlan() {
    const settings = readSettingsFromForm();
    const bakeEnd = new Date(byId('bakeEnd').value);
    if (Number.isNaN(bakeEnd.getTime())) return null;
    const recipe = calculateRecipe(settings);
    const times = calculateTimes(settings, recipe, bakeEnd);
    const steps = buildSteps(settings, recipe, times);
    return { settings, recipe, times, steps };
  }

  function render() {
    const plan = computePlan();
    if (!plan) {
      byId('plan').innerHTML = '<li><p>Bitte eine Zeit eingeben.</p></li>';
      return;
    }
    const { settings, recipe, times, steps } = plan;
    renderPlan(steps);
    renderStart(steps, times, recipe);
    renderWarnings(collectWarnings(settings, recipe, times, steps));
    renderIngredients(settings, recipe);
    renderWeightInfo(settings, recipe);
  }

  // ===================================================================
  // Teiggewicht: erwartetes Gewicht und gut passende Reglerwerte
  // ===================================================================

  /** Wie weit liegt das erwartete Teiggewicht von der Eingabe entfernt? */
  function weightDeviation(settings, wantedWeight) {
    const recipe = calculateRecipe({ ...settings, doughWeight: wantedWeight });
    return Math.abs(recipe.doughWeight - wantedWeight);
  }

  /**
   * Reglerwerte, bei denen das erwartete Gewicht näher an der Eingabe liegt
   * als bei beiden Nachbarwerten (±100 g).
   */
  function findBestSliderValues(settings) {
    const values = [];
    for (let weight = SLIDER_MIN; weight <= SLIDER_MAX; weight += SLIDER_STEP) values.push(weight);
    const deviations = values.map((weight) => weightDeviation(settings, weight));
    return values.filter((weight, index) => {
      const own = deviations[index];
      const lower = index > 0 ? deviations[index - 1] : Infinity;
      const higher = index < values.length - 1 ? deviations[index + 1] : Infinity;
      return own <= lower && own <= higher;
    });
  }

  function renderWeightInfo(settings, recipe) {
    const bestValues = findBestSliderValues(settings);
    const isBest = bestValues.includes(settings.doughWeight);

    byId('sweetSpots').innerHTML = bestValues.map((weight) => `<option value="${weight}"></option>`).join('');

    const expected = byId('expected');
    expected.classList.toggle('best', isBest);
    expected.textContent = `Erwartet: ${formatGrams(recipe.doughWeight)} g`
      + (isBest ? ' – passt am besten' : '');

    byId('bestValues').textContent = bestValues.length
      ? `Passt gut: ${bestValues.map((weight) => `${weight} g`).join(' · ')}`
      : '';
  }

  /** Regler auf den nächsten 100-g-Schritt der Eingabe stellen. */
  function syncSliderToWeight() {
    const weight = Number.parseFloat(byId('weight').value);
    if (!Number.isFinite(weight)) return;
    const rounded = Math.round(weight / SLIDER_STEP) * SLIDER_STEP;
    byId('weightSlider').value = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, rounded));
  }

  // ===================================================================
  // Bedienung
  // ===================================================================

  /** Setzt das Ende auf den frühesten Zeitpunkt, wenn man jetzt startet (auf 5 min gerundet). */
  function planFromNow() {
    const plan = computePlan();
    if (!plan) return;
    const totalDuration = plan.times.bakeEnd - plan.steps[0].time;
    const end = new Date(Date.now() + totalDuration + 5 * MINUTE);
    end.setMinutes(Math.ceil(end.getMinutes() / 5) * 5, 0, 0);
    byId('bakeEnd').value = toDateTimeInputValue(end);
    render();
  }

  function resetSettings() {
    writeSettingsToForm(DEFAULTS);
    render();
  }

  function defaultBakeEnd() {
    const today18 = new Date();
    today18.setHours(18, 0, 0, 0);
    return today18;
  }

  // Start: Es wird nichts gespeichert und nichts nachgeladen.
  renderSettingsForm();
  writeSettingsToForm(DEFAULTS);
  byId('bakeEnd').value = toDateTimeInputValue(defaultBakeEnd());
  document.addEventListener('input', (event) => {
    if (event.target.matches('input, select')) render();
  });
  // Regler → Eingabefeld. Das allgemeine 'input'-Ereignis oben rechnet danach neu.
  byId('weightSlider').addEventListener('input', () => {
    byId('weight').value = byId('weightSlider').value;
  });
  byId('weight').addEventListener('input', syncSliderToWeight);
  byId('earliest').addEventListener('click', planFromNow);
  byId('reset').addEventListener('click', resetSettings);
  render();
}
