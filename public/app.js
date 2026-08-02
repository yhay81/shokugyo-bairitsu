const MAX_COMPARE = 4;
const STORAGE_KEY = "shokugyo-bairitsu:compare:v1";
const DEFAULT_SELECTED = ["JP-00", "JP-13", "JP-27"];
const DEFAULT_OCCUPATION = "25";

const occupationSearch = document.querySelector("#occupation-search");
const occupationGroup = document.querySelector("#occupation-group");
const occupationList = document.querySelector("#occupation-list");
const occupationStatus = document.querySelector("#occupation-status");
const search = document.querySelector("#search");
const region = document.querySelector("#region");
const sort = document.querySelector("#sort");
const employment = document.querySelector("#employment");
const year = document.querySelector("#year");
const results = document.querySelector("#results");
const resultsTitle = document.querySelector("#results-title");
const conditionLabel = document.querySelector("#condition-label");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const metricNote = document.querySelector("#metric-note");
const compareList = document.querySelector("#compare-list");
const compareCount = document.querySelector("#compare-count");
const copyCompare = document.querySelector("#copy-compare");

let index = null;
let records = [];
let recordMap = new Map();
let coverageMap = new Map();
let selected = loadSelected();
let selectedOccupationId = DEFAULT_OCCUPATION;
let occupationSearchTimer;
let regionSearchTimer;
let noResultReported = false;
let occupationNoResultReported = false;

const isPrivacyEnabled = () =>
  navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const isQa = () => navigator.webdriver === true || new URLSearchParams(location.search).has("qa");
const getSession = () => {
  const key = "shokugyo-bairitsu:session:v1";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const track = (name) => {
  if (isPrivacyEnabled()) return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shokugyo-bairitsu-session": getSession(),
      "x-shokugyo-bairitsu-qa": isQa() ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

function loadSelected() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return [...DEFAULT_SELECTED];
    const value = JSON.parse(stored);
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [...DEFAULT_SELECTED];
  } catch {
    return [...DEFAULT_SELECTED];
  }
}
function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // The current comparison remains usable without storage.
  }
}

const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/\s/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = new Intl.NumberFormat("ja-JP");
const ratioNumber = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const selectedOccupation = () => index.occupations.find((item) => item.id === selectedOccupationId);
const selectedRecord = (placeId) => recordMap.get(`${placeId}|${selectedOccupationId}`);
const seriesFor = (placeId) => selectedRecord(placeId)?.[employment.value] ?? [];
const yearIndex = () => index.years.indexOf(Number(year.value));
const currentPair = (placeId) => seriesFor(placeId)[yearIndex()] ?? [null, null];
const ratioFor = (pair) =>
  pair[0] === null || pair[1] === null || pair[1] === 0 ? null : pair[0] / pair[1];
const displayRatio = (pair) => {
  if (pair[0] === null || pair[1] === null) return "公表なし";
  if (pair[1] === 0) return "倍率なし";
  return `${ratioNumber.format(pair[0] / pair[1])}倍`;
};
const displayCount = (value) => (value === null ? "公表なし" : number.format(value));
const shortCount = (value) => {
  if (value === null) return "—";
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 1000000 ? 0 : 1)}万`;
  return number.format(value);
};
const employmentLabel = () =>
  ({
    a: "パートを含む常用",
    f: "パートを除く常用",
    t: "常用的パート",
  })[employment.value];
const coverageFor = (placeId) =>
  coverageMap.get(placeId)?.[employment.value]?.[yearIndex()] ?? [null, null];
const coverageLabel = (placeId) => {
  const [unknown, total] = coverageFor(placeId);
  if (unknown === null || total === null || total === 0) return "分類不能：公表なし";
  return `分類不能：${((unknown / total) * 100).toFixed(1)}%`;
};

function balanceMeter(pair, label) {
  const [openings, seekers] = pair;
  if (openings === null || seekers === null)
    return '<div class="balance-meter is-missing"><span>公式表で公表なし</span></div>';
  const total = openings + seekers;
  const openingWidth = total === 0 ? 50 : (openings / total) * 100;
  return `<div aria-label="${escapeHtml(label)}" class="balance-meter" role="img"><span class="opening-side" style="width:${openingWidth.toFixed(2)}%"><i>求人</i></span><span class="seeker-side" style="width:${(100 - openingWidth).toFixed(2)}%"><i>求職</i></span><b aria-hidden="true"></b></div>`;
}
function yearStrip(placeId) {
  const values = seriesFor(placeId);
  return `<div class="year-strip">${index.years
    .map((value, i) => {
      const pair = values[i] ?? [null, null];
      return `<div class="year-cell${value === Number(year.value) ? " is-current" : ""}"><span>${value}</span><b>${displayRatio(pair)}</b><small>求人 ${shortCount(pair[0])} · 求職 ${shortCount(pair[1])}</small></div>`;
    })
    .join("")}</div>`;
}

function visibleOccupations() {
  const term = normalize(occupationSearch.value);
  const group = occupationGroup.value;
  return index.occupations.filter((occupation) => {
    const matchesTerm = !term || normalize(`${occupation.id}${occupation.name}`).includes(term);
    const matchesGroup = group === "all" || occupation.group === group;
    return matchesTerm && matchesGroup;
  });
}
function renderOccupations() {
  const visible = visibleOccupations();
  occupationStatus.textContent = `${visible.length} / ${index.occupations.length} 職種`;
  if (visible.length === 0) {
    occupationList.innerHTML =
      '<div class="no-occupations"><strong>一致する職種がありません</strong><span>職種名を短くするか、分類を「すべて」に戻してください。</span></div>';
    if (!occupationNoResultReported) {
      occupationNoResultReported = true;
      track("no_result");
    }
    return;
  }
  occupationNoResultReported = false;
  occupationList.innerHTML = visible
    .map((occupation) => {
      const group = index.groups.find((item) => item.id === occupation.group);
      const active = occupation.id === selectedOccupationId;
      return `<button aria-pressed="${active}" class="occupation-option${active ? " is-selected" : ""}" data-occupation="${occupation.id}" type="button"><span>${escapeHtml(occupation.id)} · ${escapeHtml(group.name)}</span><strong>${escapeHtml(occupation.name)}</strong><i aria-hidden="true">${active ? "選択中" : "選ぶ"}</i></button>`;
    })
    .join("");
}

function renderCompare() {
  const places = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean);
  compareCount.textContent = `${places.length} / ${MAX_COMPARE}`;
  copyCompare.disabled = places.length === 0;
  if (places.length === 0) {
    compareList.className = "empty-compare";
    compareList.textContent = "一覧の「比較に追加」から、2〜4地域を選んでください。";
    return;
  }
  compareList.className = "compare-list";
  compareList.innerHTML = places
    .map((place) => {
      const pair = currentPair(place.id);
      return `<article class="compare-card"><div class="compare-title"><div><span>${escapeHtml(place.region)}</span><strong>${escapeHtml(place.name)}</strong></div><button aria-label="${escapeHtml(place.name)}を比較から外す" data-remove="${place.id}" type="button">×</button></div><div class="compare-value"><span>${escapeHtml(selectedOccupation().name)}</span><b>${displayRatio(pair)}</b></div>${balanceMeter(pair, `${place.name}の求人${displayCount(pair[0])}、求職${displayCount(pair[1])}`)}<dl class="count-pair"><div><dt>有効求人数</dt><dd>${displayCount(pair[0])}</dd></div><div><dt>有効求職者数</dt><dd>${displayCount(pair[1])}</dd></div></dl>${yearStrip(place.id)}<p class="coverage-note">${coverageLabel(place.id)}</p></article>`;
    })
    .join("");
}

function visiblePlaces() {
  const term = normalize(search.value);
  const selectedRegion = region.value;
  const filtered = index.places.filter((place) => {
    const haystack = normalize(`${place.name}${place.region}`);
    return (
      (!term || haystack.includes(term)) &&
      (selectedRegion === "all" || place.region === selectedRegion)
    );
  });
  if (sort.value === "name")
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return filtered;
}
function renderResults() {
  const visible = visiblePlaces();
  resultCount.textContent = number.format(visible.length);
  resultsTitle.textContent = selectedOccupation().name;
  conditionLabel.textContent = `${employmentLabel()} · ${year.value}年度`;
  if (visible.length === 0) {
    results.innerHTML =
      '<div class="no-results"><span>0</span><h3>一致する地域がありません</h3><p>都道府県名を短くするか、地域を「すべて」に戻してください。</p></div>';
    if (!noResultReported) {
      noResultReported = true;
      track("no_result");
    }
    return;
  }
  noResultReported = false;
  results.innerHTML = visible
    .map((place) => {
      const pair = currentPair(place.id);
      const active = selected.includes(place.id);
      const disabled = !active && selected.length >= MAX_COMPARE;
      const ratio = ratioFor(pair);
      const ratioSentence =
        ratio === null
          ? pair[1] === 0 && pair[0] !== null
            ? "求職者数が0のため算出しません"
            : "同じ条件の2値がそろっていません"
          : `求職1に対して求人 ${ratioNumber.format(ratio)}`;
      return `<article class="place-card"><div class="place-heading"><div><p>${escapeHtml(place.region)} · ${escapeHtml(place.id)}</p><h3>${escapeHtml(place.name)}</h3></div><strong>${displayRatio(pair)}</strong></div>${balanceMeter(pair, `${place.name}の求人${displayCount(pair[0])}、求職${displayCount(pair[1])}`)}<p class="ratio-sentence">${ratioSentence}</p><dl class="place-counts"><div><dt>有効求人数</dt><dd>${displayCount(pair[0])}</dd></div><div><dt>有効求職者数</dt><dd>${displayCount(pair[1])}</dd></div></dl><p class="coverage-note">${coverageLabel(place.id)}</p><button class="compare-button${active ? " is-selected" : ""}" data-select="${place.id}" ${disabled ? "disabled" : ""} type="button">${active ? "比較中" : disabled ? "4地域を選択済み" : "比較に追加"}</button></article>`;
    })
    .join("");
}
function renderAll() {
  metricNote.textContent = `${employmentLabel()}の月間有効件数を年度で合計した公式値です。同じ職種・地域・年度の求人 ÷ 求職で倍率を算出します。`;
  renderCompare();
  renderResults();
}
function chooseOccupation(id) {
  if (!index.occupations.some((item) => item.id === id)) return;
  selectedOccupationId = id;
  renderOccupations();
  renderAll();
  resultsTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  track("occupation_changed");
}
function toggleSelected(id) {
  if (selected.includes(id)) selected = selected.filter((item) => item !== id);
  else if (selected.length < MAX_COMPARE) {
    selected = [...selected, id];
    track("compared");
  }
  saveSelected();
  renderAll();
}

occupationList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-occupation]");
  if (button) chooseOccupation(button.dataset.occupation);
});
results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) toggleSelected(button.dataset.select);
});
compareList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toggleSelected(button.dataset.remove);
});
occupationSearch.addEventListener("input", () => {
  renderOccupations();
  clearTimeout(occupationSearchTimer);
  if (occupationSearch.value.trim())
    occupationSearchTimer = setTimeout(() => track("searched"), 650);
});
occupationGroup.addEventListener("change", () => {
  renderOccupations();
  track("group_changed");
});
search.addEventListener("input", () => {
  renderResults();
  clearTimeout(regionSearchTimer);
  if (search.value.trim()) regionSearchTimer = setTimeout(() => track("searched"), 650);
});
region.addEventListener("change", () => {
  renderResults();
  track("region_changed");
});
sort.addEventListener("change", renderResults);
employment.addEventListener("change", () => {
  renderAll();
  track("employment_changed");
});
year.addEventListener("change", () => {
  renderAll();
  track("year_changed");
});
copyCompare.addEventListener("click", async () => {
  const lines = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean)
    .map((place) => {
      const pair = currentPair(place.id);
      return `${place.name}｜${displayRatio(pair)}｜求人 ${displayCount(pair[0])}｜求職 ${displayCount(pair[1])}`;
    });
  await navigator.clipboard.writeText(
    [
      `${selectedOccupation().name}（${employmentLabel()}・${year.value}年度）`,
      ...lines,
      "年度の月間有効件数合計。固有の人・求人票数ではなく、分類不能の求職者は職種別倍率に含まれません。",
      "出典：厚生労働省「職業安定業務統計 雇用関係指標 第4表・第5表」",
    ].join("\n"),
  );
  copyCompare.textContent = "コピーしました";
  setTimeout(() => {
    copyCompare.textContent = "比較をコピー";
  }, 1600);
  track("copied");
});

Promise.all([
  fetch("/data/index.json").then((response) => {
    if (!response.ok) throw new Error("index_unavailable");
    return response.json();
  }),
  fetch("/data/ratios.json").then((response) => {
    if (!response.ok) throw new Error("data_unavailable");
    return response.json();
  }),
])
  .then(([indexData, ratioData]) => {
    index = indexData;
    records = ratioData;
    recordMap = new Map(records.map((record) => [`${record.p}|${record.o}`, record]));
    coverageMap = new Map(index.coverage.map((item) => [item.p, item]));
    const validIds = new Set(index.places.map((place) => place.id));
    selected = selected.filter((id) => validIds.has(id));
    saveSelected();
    occupationGroup.insertAdjacentHTML(
      "beforeend",
      index.groups
        .map(
          (item) =>
            `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} ${escapeHtml(item.name)}</option>`,
        )
        .join(""),
    );
    const regions = [...new Set(index.places.map((place) => place.region))];
    region.insertAdjacentHTML(
      "beforeend",
      regions
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join(""),
    );
    dataStatus.textContent = "全国・47労働局 · 73職種 · 2023—2025年度";
    renderOccupations();
    renderAll();
    track("visited");
  })
  .catch(() => {
    occupationStatus.textContent = "職種表を読み込めませんでした";
    dataStatus.textContent = "データを読み込めませんでした。再読み込みしてください。";
    results.innerHTML =
      '<div class="no-results"><h3>公式表を表示できません</h3><p>通信状態を確認して、ページを再読み込みしてください。</p></div>';
  });
