/* eslint-disable no-alert */
/*
  Chore Tracker
  - Single-page app in plain HTML/CSS/JS
  - localStorage persistence (sessions array + stats object + chore name list)
  - No external libraries
*/

(() => {
  "use strict";

  // -----------------------------
  // Storage + Data Model
  // -----------------------------
  /*
    localStorage keys (JSON):
      - choreTracker.choreNames: string[]
      - choreTracker.sessions: Session[]
      - choreTracker.stats: Stats

    Session:
      {
        id: string,
        source: "stopwatch" | "manual",
        startedAt: number (epoch ms),
        endedAt: number (epoch ms),
        dateKey: "YYYY-MM-DD" (local),
        durationSeconds: number,
        chores: string[],
        xp: number,
        coins: number,
        bonusXP: number,
        multiplier: number,
        rebirthMultiplier: number,
        usedGoldenGloves: boolean
      }

    Stats:
      {
        totalXP: number,
        totalCoins: number,
        tokens: number,
        rebirths: number,
        lastDailyBonusDate: "YYYY-MM-DD" | null,
        purchases: { itemId: string, at: number, costCoins?: number, note?: string }[],
        consumables: { goldenGloves: number },
        unlocks: {
          musicPack: boolean,
          petMop: boolean,
          themes: string[],
          backgrounds: string[]
        },
        activeTheme: string,
        activeBackground: string,
        settings: {
          petMopEnabled: boolean,
          music: { volume: number, trackId: string, isPlaying: boolean }
        }
      }
  */

  const STORAGE = {
    chores: "choreTracker.choreNames",
    sessions: "choreTracker.sessions",
    stats: "choreTracker.stats",
  };

  const DEFAULT_CHORES = [
    "Dishes",
    "Laundry",
    "Vacuum",
    "Trash",
    "Wipe counters",
    "Clean bathroom",
    "Make bed",
    "Tidy room",
    "Mop floors",
  ];

  // -----------------------------
  // Shop + Unlock Definitions
  // -----------------------------
  // Costs not specified by the prompt are defined here as easy-to-tune constants.
  const COSTS = {
    goldenGloves: 250,
    musicPack: 600,
    petMop: 350,
    rebirth: 1000,
    tokenFromCoins: 2000,
  };

  const SHOP_CATEGORIES = [
    { id: "upgrades", label: "App Upgrades" },
    { id: "music", label: "Music Pack" },
    { id: "themes", label: "Themes" },
    { id: "backgrounds", label: "Backgrounds" },
    { id: "tokens", label: "Tokens" },
  ];

  const THEME_DEFS = [
    { id: "default", name: "Default", cost: 0 },
    { id: "soft-blue", name: "Soft Blue", cost: 100 },
    { id: "clean-green", name: "Clean Green", cost: 150 },
    { id: "warm-beige", name: "Warm Beige", cost: 150 },
    { id: "dark-blue", name: "Dark Blue", cost: 150 },
    { id: "dark-red", name: "Dark Red", cost: 200 },
    { id: "black", name: "Black", cost: 150 },
    { id: "light-red", name: "Light Red", cost: 150 },
    { id: "purple", name: "Purple", cost: 200 },
    { id: "orange", name: "Orange", cost: 200 },
  ];

  const BACKGROUND_DEFS = [
    { id: "default", name: "Default", cost: 0 },
    { id: "radius-gradient", name: "Radius Gradient", cost: 200 },
    { id: "up-down-gradient", name: "Up-Down Gradient", cost: 200 },
    { id: "triangle-pattern", name: "Triangle Pattern", cost: 300 },
    { id: "grid-pattern", name: "Grid Pattern", cost: 300 },
    { id: "horizontal-lines", name: "Horizontal Lines", cost: 300 },
  ];

  // Music tracks are expected to be present locally in /assets/music/.
  // Add your own files there and update this list if desired.
  const MUSIC_TRACKS = [
    { id: "track-1", name: "Track 1", src: "assets/music/track-1.mp3" },
    { id: "track-2", name: "Track 2", src: "assets/music/track-2.mp3" },
    { id: "track-3", name: "Track 3", src: "assets/music/track-3.mp3" },
  ];

  // -----------------------------
  // DOM Helpers
  // -----------------------------
  const $ = (selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Missing element: ${selector}`);
    return el;
  };

  const dom = {
    sessionCard: $(".session"),

    modeButtons: Array.from(document.querySelectorAll(".mode-toggle__btn")),
    stopwatchPanel: $("#stopwatchPanel"),
    manualPanel: $("#manualPanel"),

    timerValue: $("#timerValue"),
    timerHint: $("#timerHint"),
    startBtn: $("#startBtn"),
    pauseBtn: $("#pauseBtn"),
    resumeBtn: $("#resumeBtn"),
    stopBtn: $("#stopBtn"),

    manualMinutes: $("#manualMinutes"),
    manualChores: $("#manualChores"),
    newChoreName: $("#newChoreName"),
    addChoreBtn: $("#addChoreBtn"),
    manualReviewBtn: $("#manualReviewBtn"),

    levelValue: $("#levelValue"),
    xpValue: $("#xpValue"),
    coinsValue: $("#coinsValue"),
    tokensValue: $("#tokensValue"),
    levelProgressText: $("#levelProgressText"),
    levelProgressFill: $("#levelProgressFill"),
    levelProgressBar: $("#levelProgressBar"),
    boostRow: $("#boostRow"),
    rebirthStatus: $("#rebirthStatus"),
    rebirthBtn: $("#rebirthBtn"),

    historyList: $("#historyList"),
    shopGrid: $("#shopGrid"),
    shopCats: $("#shopCats"),
    inventoryPanel: $("#inventoryPanel"),
    shopTabBtn: $("#shopTabBtn"),
    inventoryTabBtn: $("#inventoryTabBtn"),

    weeklySummaryCard: $("#weeklySummaryCard"),
    weekSelect: $("#weekSelect"),
    weekTopStat: $("#weekTopStat"),
    weeklyGrid: $("#weeklyGrid"),

    mobileNav: $("#mobileNav"),
    mobileNavButtons: Array.from(document.querySelectorAll(".mobile-nav__btn")),
    mobileActionBar: $("#mobileActionBar"),
    mobilePrimaryBtn: $("#mobilePrimaryBtn"),

    confirmDialog: $("#confirmDialog"),
    confirmTitle: $("#confirmTitle"),
    confirmText: $("#confirmText"),
    confirmCloseBtn: $("#confirmCloseBtn"),
    confirmCancelBtn: $("#confirmCancelBtn"),
    confirmOkBtn: $("#confirmOkBtn"),

    musicCard: $("#musicCard"),
    musicStatus: $("#musicStatus"),
    musicAudio: $("#musicAudio"),
    musicSelect: $("#musicSelect"),
    musicPlayBtn: $("#musicPlayBtn"),
    musicPauseBtn: $("#musicPauseBtn"),
    musicVolume: $("#musicVolume"),

    petMop: $("#petMop"),
    petDust: $("#petDust"),
    petBubble: $("#petBubble"),

    summaryDialog: $("#summaryDialog"),
    summaryForm: $("#summaryForm"),
    closeSummaryBtn: $("#closeSummaryBtn"),
    discardBtn: $("#discardBtn"),
    saveBtn: $("#saveBtn"),
    summaryDate: $("#summaryDate"),
    summaryDuration: $("#summaryDuration"),
    summaryXp: $("#summaryXp"),
    summaryCoins: $("#summaryCoins"),
    summaryBreakdown: $("#summaryBreakdown"),
    summaryChores: $("#summaryChores"),
    summaryError: $("#summaryError"),
    summaryNewChoreName: $("#summaryNewChoreName"),
    summaryAddChoreBtn: $("#summaryAddChoreBtn"),
  };

  // -----------------------------
  // In-memory state
  // -----------------------------
  let choreNames = [];
  /** @type {any[]} */
  let sessions = [];
  /** @type {any} */
  let stats = {};

  let mode = "stopwatch"; // "stopwatch" | "manual"
  let manualSelected = new Set(); // keeps UI selection stable between renders

  // Draft session that is being reviewed in the Summary modal (not yet saved)
  let draft = null;

  // Shop UI state
  let shopTab = "shop"; // "shop" | "inventory"
  let activeShopCategory = "upgrades";

  // Confirmation dialog state (single active confirm at a time)
  let confirmOnOk = null;

  // Pet Mop timers (created only when enabled)
  let petMessageTimerId = null;
  let petHideBubbleTimerId = null;

  // Weekly summary UI state
  let selectedWeekKey = null;

  // Mobile navigation state
  let mobileArea = "session";

  const stopwatch = {
    status: "idle", // "idle" | "running" | "paused" | "review"
    startEpochMs: 0,
    elapsedMs: 0,
    startedAt: null,
    intervalId: null,
  };

  // -----------------------------
  // Utilities
  // -----------------------------
  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function loadJson(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeJsonParse(raw, fallback);
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatClock(secondsTotal) {
    const minutes = Math.floor(secondsTotal / 60);
    const seconds = Math.floor(secondsTotal % 60);
    return `${pad2(minutes)}:${pad2(seconds)}`;
  }

  function localDateKey(date) {
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    return `${y}-${m}-${d}`;
  }

  function startOfWeekMonday(date) {
    // Weeks are Monday–Sunday.
    const d = new Date(date);
    const offsetFromMonday = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offsetFromMonday);
    return d;
  }

  function weekKeyFromEpochMs(epochMs) {
    return localDateKey(startOfWeekMonday(new Date(epochMs)));
  }

  function weekRangeLabel(weekKey) {
    // weekKey is the local Monday dateKey "YYYY-MM-DD"
    const start = new Date(`${weekKey}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const fmt = (d) =>
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
      });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  function formatDurationShort(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours <= 0) return `${minutes}m`;
    if (mins <= 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function makeId() {
    // Prefer crypto.randomUUID when available.
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function calcLevel(totalXP) {
    // Level caps at 10 (XP still accumulates normally).
    return Math.min(Math.floor(totalXP / 250) + 1, 10);
  }

  function isUnlocked(list, id) {
    return Array.isArray(list) && list.includes(id);
  }

  function applyAppearanceFromStats() {
    const theme = isUnlocked(stats.unlocks?.themes, stats.activeTheme) ? stats.activeTheme : "default";
    const bg = isUnlocked(stats.unlocks?.backgrounds, stats.activeBackground)
      ? stats.activeBackground
      : "default";
    document.body.dataset.theme = theme || "default";
    document.body.dataset.bg = bg || "default";
  }

  function canRebirth() {
    const level = calcLevel(Number(stats.totalXP || 0));
    const coins = Number(stats.totalCoins || 0);
    return level >= 10 && coins >= COSTS.rebirth;
  }

  function normalizeChoreName(name) {
    return name.trim().replace(/\s+/g, " ");
  }

  function minutesForXpFromSeconds(durationSeconds) {
    // Reward rule: 1 XP per minute.
    // We count partial minutes as a full minute (e.g., 61s => 2 minutes).
    if (durationSeconds <= 0) return 0;
    return Math.ceil(durationSeconds / 60);
  }

  function getRebirthMultiplier() {
    const rebirths = Number(stats.rebirths || 0);
    return 1.0 + rebirths * 0.25;
  }

  function computeRewards({ durationSeconds, chores, endedAt }) {
    const minutesForXP = minutesForXpFromSeconds(durationSeconds);
    const choreXP = chores.length * 10;
    const timeXP = minutesForXP;

    const sessionDay = localDateKey(new Date(endedAt ?? Date.now()));
    const bonusXP = stats.lastDailyBonusDate === sessionDay ? 0 : 20;

    const baseXP = choreXP + timeXP + bonusXP;

    // Multipliers:
    // - Rebirth multiplier: 1.0 + (rebirths × 0.25)
    // - Golden Gloves: 2× XP and 2× Coins for the NEXT completed session only
    const rebirthMultiplier = getRebirthMultiplier();
    const hasGoldenGloves = Number(stats.consumables?.goldenGloves || 0) > 0;
    const gloveMultiplier = hasGoldenGloves ? 2 : 1;
    const multiplier = rebirthMultiplier * gloveMultiplier;

    // Keep XP and coins integer-based for UI/levels.
    // (Coins earned must always equal XP earned, including multipliers.)
    const totalXP = Math.max(0, Math.round(baseXP * multiplier));
    const coins = totalXP;

    return {
      minutesForXP,
      choreXP,
      timeXP,
      bonusXP,
      baseXP,
      multiplier,
      rebirthMultiplier,
      usedGoldenGloves: hasGoldenGloves,
      totalXP,
      coins,
    };
  }

  function setText(el, text) {
    el.textContent = text;
  }

  // -----------------------------
  // Render Helpers
  // -----------------------------
  function renderHeader() {
    const totalXP = Number(stats.totalXP || 0);
    const totalCoins = Number(stats.totalCoins || 0);
    const tokens = Number(stats.tokens || 0);
    const level = calcLevel(totalXP);
    setText(dom.levelValue, String(level));
    setText(dom.xpValue, String(totalXP));
    setText(dom.coinsValue, String(totalCoins));
    setText(dom.tokensValue, String(tokens));

    // Level progress UI:
    // - If level < 10: show progress within current level (0..249) out of 250
    // - If level = 10: bar is full and text reads "MAX LEVEL"
    if (level >= 10) {
      setText(dom.levelProgressText, "MAX LEVEL");
      dom.levelProgressFill.style.width = "100%";
      dom.levelProgressBar.setAttribute("aria-valuenow", "100");
    } else {
      const xpIntoLevel = ((totalXP % 250) + 250) % 250;
      const pctFloat = (xpIntoLevel / 250) * 100;
      const pctAria = Math.floor(pctFloat);
      setText(dom.levelProgressText, `${xpIntoLevel} / 250 XP to level ${level + 1}`);
      dom.levelProgressFill.style.width = `${pctFloat.toFixed(1)}%`;
      dom.levelProgressBar.setAttribute("aria-valuenow", String(pctAria));
    }

    // Boost indicators
    dom.boostRow.innerHTML = "";

    const rebirthMult = getRebirthMultiplier();
    const rebirthPill = document.createElement("div");
    rebirthPill.className = "pill";
    rebirthPill.innerHTML = `<strong>Multiplier</strong> x${rebirthMult.toFixed(2)}`;
    dom.boostRow.appendChild(rebirthPill);

    const gloves = Number(stats.consumables?.goldenGloves || 0);
    if (gloves > 0) {
      const glovePill = document.createElement("div");
      glovePill.className = "pill";
      glovePill.innerHTML = `<strong>Golden Gloves</strong> x2 next session • ${gloves} stacked`;
      dom.boostRow.appendChild(glovePill);
    }

    // Rebirth panel state
    const can = canRebirth();
    dom.rebirthBtn.disabled = !can;
    dom.rebirthBtn.textContent = can ? "Rebirth" : "Locked";

    const rebirths = Number(stats.rebirths || 0);
    const reqText =
      level >= 10
        ? totalCoins >= COSTS.rebirth
          ? `Ready: costs ${COSTS.rebirth} coins`
          : `Need ${COSTS.rebirth} coins (you have ${totalCoins})`
        : "Reach level 10";

    setText(
      dom.rebirthStatus,
      `Rebirths: ${rebirths} • Multiplier: x${rebirthMult.toFixed(2)} • ${reqText}`,
    );
  }

  function deleteChoreName(name) {
    // Deletes the chore from the selectable list only (history remains intact).
    choreNames = choreNames.filter((n) => n !== name);
    manualSelected.delete(name);
    if (draft) draft.chores = (draft.chores || []).filter((c) => c !== name);
    saveJson(STORAGE.chores, choreNames);
    renderAll();
  }

  function renderChoreCheckboxes(container, selectedSet, opts = {}) {
    const { allowDelete = false } = opts;
    container.innerHTML = "";

    if (choreNames.length === 0) {
      const empty = document.createElement("div");
      empty.className = "microcopy";
      empty.textContent = "No chores yet — add one to get started.";
      container.appendChild(empty);
      return;
    }

    for (const name of choreNames) {
      const id = `${container.id}_${name.replace(/\W+/g, "_")}`;

      const label = document.createElement("label");
      label.className = "check";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = name;
      input.id = id;
      input.checked = selectedSet.has(name);

      const text = document.createElement("span");
      text.className = "check__text";
      text.textContent = name;

      label.appendChild(input);
      label.appendChild(text);

      if (allowDelete) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "check__delete";
        del.textContent = "✕";
        del.setAttribute("aria-label", `Delete chore "${name}"`);
        del.addEventListener("click", (e) => {
          // Prevent toggling the checkbox (button is inside the label).
          e.preventDefault();
          e.stopPropagation();
          deleteChoreName(name);
        });
        label.appendChild(del);
      }

      container.appendChild(label);
    }
  }

  function renderHistory() {
    dom.historyList.innerHTML = "";

    if (!sessions.length) {
      const li = document.createElement("li");
      li.className = "history-item";
      li.textContent = "No sessions yet. Log one to see it here.";
      dom.historyList.appendChild(li);
      return;
    }

    const sorted = [...sessions].sort((a, b) => b.endedAt - a.endedAt);
    for (const s of sorted) {
      const li = document.createElement("li");
      li.className = "history-item";

      const top = document.createElement("div");
      top.className = "history-item__top";

      const when = new Date(s.endedAt);
      const date = document.createElement("div");
      date.className = "history-item__date";
      date.textContent = when.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const meta = document.createElement("div");
      meta.className = "history-item__meta";
      meta.textContent = `${formatClock(s.durationSeconds)} • +${s.xp} XP • +${s.coins} coins`;

      top.appendChild(date);
      top.appendChild(meta);

      const chores = document.createElement("div");
      chores.className = "history-item__chores";
      const choreText = (s.chores || []).join(", ");
      const label = document.createElement("span");
      label.textContent = "Chores:";
      chores.appendChild(label);
      chores.appendChild(document.createTextNode(` ${choreText || "—"}`));

      li.appendChild(top);
      li.appendChild(chores);
      dom.historyList.appendChild(li);
    }
  }

  function setShopTab(nextTab) {
    shopTab = nextTab === "inventory" ? "inventory" : "shop";

    const isShop = shopTab === "shop";
    dom.shopTabBtn.classList.toggle("is-active", isShop);
    dom.inventoryTabBtn.classList.toggle("is-active", !isShop);
    dom.shopTabBtn.setAttribute("aria-selected", isShop ? "true" : "false");
    dom.inventoryTabBtn.setAttribute("aria-selected", !isShop ? "true" : "false");

    dom.shopCats.style.display = isShop ? "" : "none";
    dom.shopGrid.style.display = isShop ? "" : "none";
    dom.inventoryPanel.classList.toggle("is-hidden", isShop);

    renderShop();
  }

  function setActiveShopCategory(catId) {
    activeShopCategory = SHOP_CATEGORIES.some((c) => c.id === catId) ? catId : "upgrades";
    renderShop();
  }

  function isThemeUnlocked(themeId) {
    return isUnlocked(stats.unlocks?.themes, themeId);
  }

  function isBackgroundUnlocked(bgId) {
    return isUnlocked(stats.unlocks?.backgrounds, bgId);
  }

  function renderShopCategories() {
    dom.shopCats.innerHTML = "";
    for (const cat of SHOP_CATEGORIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-btn";
      btn.textContent = cat.label;
      btn.classList.toggle("is-active", cat.id === activeShopCategory);
      btn.addEventListener("click", () => setActiveShopCategory(cat.id));
      dom.shopCats.appendChild(btn);
    }
  }

  function renderShopItem({ title, desc, costText, metaText, actionLabel, disabled, onAction }) {
    const card = document.createElement("div");
    card.className = "shop-item";

    const name = document.createElement("div");
    name.className = "shop-item__name";
    name.textContent = title;

    const d = document.createElement("div");
    d.className = "shop-item__desc";
    d.textContent = desc;

    const row = document.createElement("div");
    row.className = "shop-item__row";

    const cost = document.createElement("div");
    cost.textContent = costText;

    const meta = document.createElement("div");
    meta.textContent = metaText;

    row.appendChild(cost);
    row.appendChild(meta);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = actionLabel;
    btn.disabled = Boolean(disabled);
    btn.addEventListener("click", onAction);

    card.appendChild(name);
    card.appendChild(d);
    card.appendChild(row);
    card.appendChild(btn);
    return card;
  }

  function renderShopGrid() {
    dom.shopGrid.innerHTML = "";

    const coins = Number(stats.totalCoins || 0);

    if (activeShopCategory === "upgrades") {
      const gloves = Number(stats.consumables?.goldenGloves || 0);
      dom.shopGrid.appendChild(
        renderShopItem({
          title: "Golden Gloves",
          desc: "Consumable. Grants 2× XP and 2× coins for the NEXT completed session only.",
          costText: `${COSTS.goldenGloves} coins`,
          metaText: `In inventory: ${gloves}`,
          actionLabel: "Buy",
          disabled: coins < COSTS.goldenGloves,
          onAction: () =>
            confirmAction({
              title: "Buy Golden Gloves",
              text: `Spend ${COSTS.goldenGloves} coins for 1 Golden Gloves use? (Stacks in inventory.)`,
              okText: "Buy",
              onOk: () => {
                if (!spendCoins(COSTS.goldenGloves)) return;
                stats.consumables.goldenGloves = Number(stats.consumables.goldenGloves || 0) + 1;
                logPurchase({ itemId: "golden-gloves", costCoins: COSTS.goldenGloves });
                persistAll();
                renderAll();
              },
            }),
        }),
      );

      const petUnlocked = Boolean(stats.unlocks?.petMop);
      dom.shopGrid.appendChild(
        renderShopItem({
          title: "Pet Mop Companion",
          desc: "Toggleable corner companion with messages and a tiny dust cleanup.",
          costText: petUnlocked ? "Owned" : `${COSTS.petMop} coins`,
          metaText: petUnlocked ? "Permanent unlock" : "Permanent unlock",
          actionLabel: petUnlocked ? "Owned" : "Buy",
          disabled: petUnlocked || coins < COSTS.petMop,
          onAction: () =>
            confirmAction({
              title: "Unlock Pet Mop",
              text: `Spend ${COSTS.petMop} coins to permanently unlock Pet Mop?`,
              okText: "Unlock",
              onOk: () => {
                if (!spendCoins(COSTS.petMop)) return;
                stats.unlocks.petMop = true;
                logPurchase({ itemId: "pet-mop", costCoins: COSTS.petMop });
                persistAll();
                renderAll();
              },
            }),
        }),
      );
    } else if (activeShopCategory === "music") {
      const musicUnlocked = Boolean(stats.unlocks?.musicPack);
      dom.shopGrid.appendChild(
        renderShopItem({
          title: "Music Pack",
          desc: "Unlocks the Music panel. Tracks are loaded locally from /assets/music/.",
          costText: musicUnlocked ? "Owned" : `${COSTS.musicPack} coins`,
          metaText: musicUnlocked ? "Permanent unlock" : "Permanent unlock",
          actionLabel: musicUnlocked ? "Owned" : "Unlock",
          disabled: musicUnlocked || coins < COSTS.musicPack,
          onAction: () =>
            confirmAction({
              title: "Unlock Music Pack",
              text: `Spend ${COSTS.musicPack} coins to unlock the Music panel?`,
              okText: "Unlock",
              onOk: () => {
                if (!spendCoins(COSTS.musicPack)) return;
                stats.unlocks.musicPack = true;
                logPurchase({ itemId: "music-pack", costCoins: COSTS.musicPack });
                persistAll();
                renderAll();
              },
            }),
        }),
      );
    } else if (activeShopCategory === "themes") {
      for (const t of THEME_DEFS) {
        const unlocked = isThemeUnlocked(t.id);
        const active = stats.activeTheme === t.id;
        const costText = unlocked ? (active ? "Active" : "Owned") : `${t.cost} coins`;
        const actionLabel = unlocked ? (active ? "Active" : "Activate") : "Buy";
        const disabled = unlocked ? active : coins < t.cost;
        dom.shopGrid.appendChild(
          renderShopItem({
            title: t.name,
            desc: "Theme (permanent unlock).",
            costText,
            metaText: unlocked ? "Unlocked" : "Locked",
            actionLabel,
            disabled,
            onAction: () => {
              if (unlocked) {
                stats.activeTheme = t.id;
                persistAll();
                renderAll();
                return;
              }
              confirmAction({
                title: `Buy Theme: ${t.name}`,
                text: `Spend ${t.cost} coins to unlock "${t.name}"?`,
                okText: "Buy",
                onOk: () => {
                  if (!spendCoins(t.cost)) return;
                  if (!stats.unlocks.themes.includes(t.id)) stats.unlocks.themes.push(t.id);
                  stats.activeTheme = t.id;
                  logPurchase({ itemId: `theme:${t.id}`, costCoins: t.cost });
                  persistAll();
                  renderAll();
                },
              });
            },
          }),
        );
      }
    } else if (activeShopCategory === "backgrounds") {
      for (const b of BACKGROUND_DEFS) {
        const unlocked = isBackgroundUnlocked(b.id);
        const active = stats.activeBackground === b.id;
        const costText = unlocked ? (active ? "Active" : "Owned") : `${b.cost} coins`;
        const actionLabel = unlocked ? (active ? "Active" : "Activate") : "Buy";
        const disabled = unlocked ? active : coins < b.cost;
        dom.shopGrid.appendChild(
          renderShopItem({
            title: b.name,
            desc: "Background (permanent unlock).",
            costText,
            metaText: unlocked ? "Unlocked" : "Locked",
            actionLabel,
            disabled,
            onAction: () => {
              if (unlocked) {
                stats.activeBackground = b.id;
                persistAll();
                renderAll();
                return;
              }
              confirmAction({
                title: `Buy Background: ${b.name}`,
                text: `Spend ${b.cost} coins to unlock "${b.name}"?`,
                okText: "Buy",
                onOk: () => {
                  if (!spendCoins(b.cost)) return;
                  if (!stats.unlocks.backgrounds.includes(b.id))
                    stats.unlocks.backgrounds.push(b.id);
                  stats.activeBackground = b.id;
                  logPurchase({ itemId: `bg:${b.id}`, costCoins: b.cost });
                  persistAll();
                  renderAll();
                },
              });
            },
          }),
        );
      }
    } else if (activeShopCategory === "tokens") {
      dom.shopGrid.appendChild(
        renderShopItem({
          title: "Buy 1 Token",
          desc: "Tokens are real-world currency. They can be purchased infinitely and deducted manually (never added manually).",
          costText: `${COSTS.tokenFromCoins} coins`,
          metaText: `You have ${Number(stats.tokens || 0)} tokens`,
          actionLabel: "Exchange",
          disabled: coins < COSTS.tokenFromCoins,
          onAction: () =>
            confirmAction({
              title: "Exchange Coins → Token",
              text: `Spend ${COSTS.tokenFromCoins} coins for +1 token?`,
              okText: "Exchange",
              onOk: () => {
                if (!spendCoins(COSTS.tokenFromCoins)) return;
                stats.tokens = Number(stats.tokens || 0) + 1;
                logPurchase({ itemId: "token", costCoins: COSTS.tokenFromCoins, note: "+1 token" });
                persistAll();
                renderAll();
              },
            }),
        }),
      );
    }
  }

  function renderInventory() {
    const coins = Number(stats.totalCoins || 0);
    const tokens = Number(stats.tokens || 0);
    const gloves = Number(stats.consumables?.goldenGloves || 0);

    dom.inventoryPanel.innerHTML = "";

    const addSection = (title, subtitle) => {
      const section = document.createElement("div");
      section.className = "inv-section";
      const h = document.createElement("h3");
      h.className = "inv-section__title";
      h.textContent = title;
      const p = document.createElement("p");
      p.className = "inv-section__sub";
      p.textContent = subtitle;
      section.appendChild(h);
      section.appendChild(p);
      dom.inventoryPanel.appendChild(section);
      return section;
    };

    const consumables = addSection(
      "Consumables",
      "Consumables are used automatically when you complete a session.",
    );
    const row = document.createElement("div");
    row.className = "inv-row";
    row.innerHTML = `<div class="inv-badge">Golden Gloves: <strong>${gloves}</strong></div>`;
    consumables.appendChild(row);

    const unlocks = addSection("Appearance", "Only one theme and one background can be active.");
    const list = document.createElement("div");
    list.className = "inv-list";

    const addInvItem = ({ name, meta, action, disabled, onClick }) => {
      const item = document.createElement("div");
      item.className = "inv-item";
      const left = document.createElement("div");
      const nm = document.createElement("div");
      nm.className = "inv-item__name";
      nm.textContent = name;
      const mt = document.createElement("div");
      mt.className = "inv-item__meta";
      mt.textContent = meta;
      left.appendChild(nm);
      left.appendChild(mt);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = action;
      btn.disabled = Boolean(disabled);
      btn.addEventListener("click", onClick);

      item.appendChild(left);
      item.appendChild(btn);
      list.appendChild(item);
    };

    for (const t of THEME_DEFS) {
      const unlocked = isThemeUnlocked(t.id);
      const active = stats.activeTheme === t.id;
      addInvItem({
        name: `Theme: ${t.name}`,
        meta: unlocked ? (active ? "Active" : "Unlocked") : `Locked • ${t.cost} coins`,
        action: unlocked ? (active ? "Active" : "Activate") : "Locked",
        disabled: !unlocked || active,
        onClick: () => {
          stats.activeTheme = t.id;
          persistAll();
          renderAll();
        },
      });
    }

    for (const b of BACKGROUND_DEFS) {
      const unlocked = isBackgroundUnlocked(b.id);
      const active = stats.activeBackground === b.id;
      addInvItem({
        name: `Background: ${b.name}`,
        meta: unlocked ? (active ? "Active" : "Unlocked") : `Locked • ${b.cost} coins`,
        action: unlocked ? (active ? "Active" : "Activate") : "Locked",
        disabled: !unlocked || active,
        onClick: () => {
          stats.activeBackground = b.id;
          persistAll();
          renderAll();
        },
      });
    }

    unlocks.appendChild(list);

    const systems = addSection("Systems", "Toggles and account-like currencies.");

    const petRow = document.createElement("div");
    petRow.className = "inv-row";
    const petUnlocked = Boolean(stats.unlocks?.petMop);
    petRow.innerHTML = `
      <div class="inv-badge">Pet Mop: <strong>${petUnlocked ? "Unlocked" : "Locked"}</strong></div>
      <label class="check" style="pointer-events:auto">
        <input type="checkbox" id="petToggle" ${petUnlocked && stats.settings?.petMopEnabled ? "checked" : ""} ${
          petUnlocked ? "" : "disabled"
        } />
        <span>Enabled</span>
      </label>
    `;
    systems.appendChild(petRow);

    const musicRow = document.createElement("div");
    musicRow.className = "inv-row";
    const musicUnlocked = Boolean(stats.unlocks?.musicPack);
    musicRow.innerHTML = `<div class="inv-badge">Music Pack: <strong>${musicUnlocked ? "Unlocked" : "Locked"}</strong></div>`;
    systems.appendChild(musicRow);

    const tokenSection = addSection("Tokens", "Tokens can be deducted manually (never added manually).");
    const tokenRow = document.createElement("div");
    tokenRow.className = "inv-row";
    tokenRow.style.alignItems = "end";
    tokenRow.innerHTML = `
      <div class="inv-badge">Balance: <strong>${tokens}</strong> tokens</div>
      <label class="field" style="min-width:160px">
        <span class="field__label">Deduct tokens</span>
        <input id="deductTokensInput" class="input" type="number" min="1" step="1" value="1" />
      </label>
      <button type="button" class="btn btn--danger" id="deductTokensBtn" ${
        tokens <= 0 ? "disabled" : ""
      }>Deduct</button>
    `;
    tokenSection.appendChild(tokenRow);

    const footer = document.createElement("div");
    footer.className = "inv-row";
    footer.innerHTML = `<div class="inv-badge">Coins: <strong>${coins}</strong></div>`;
    dom.inventoryPanel.appendChild(footer);

    // Inventory panel uses event delegation for a few dynamic controls.
    const petToggle = dom.inventoryPanel.querySelector("#petToggle");
    if (petToggle) {
      petToggle.addEventListener("change", () => {
        stats.settings.petMopEnabled = petToggle.checked;
        persistAll();
        renderAll();
      });
    }

    const deductBtn = dom.inventoryPanel.querySelector("#deductTokensBtn");
    if (deductBtn) {
      deductBtn.addEventListener("click", () => {
        const input = dom.inventoryPanel.querySelector("#deductTokensInput");
        const amount = Number(input?.value);
        if (!Number.isFinite(amount) || amount <= 0) return;
        confirmAction({
          title: "Deduct Tokens",
          text: `Deduct ${amount} token(s)? This cannot add tokens—only reduce them.`,
          okText: "Deduct",
          danger: true,
          onOk: () => {
            stats.tokens = Math.max(0, Number(stats.tokens || 0) - Math.floor(amount));
            logPurchase({ itemId: "token-deduct", note: `-${Math.floor(amount)} tokens` });
            persistAll();
            renderAll();
          },
        });
      });
    }
  }

  function buildWeeklyMap() {
    const map = new Map();
    for (const s of sessions) {
      const endedAt = Number(s.endedAt || 0);
      if (!endedAt) continue;
      const key = weekKeyFromEpochMs(endedAt);

      if (!map.has(key)) {
        map.set(key, {
          weekKey: key,
          totalSeconds: 0,
          totalChores: 0,
          totalXP: 0,
          totalCoins: 0,
          sessions: 0,
        });
      }

      const agg = map.get(key);
      agg.totalSeconds += Number(s.durationSeconds || 0);
      agg.totalChores += Array.isArray(s.chores) ? s.chores.length : 0;
      agg.totalXP += Number(s.xp || 0);
      agg.totalCoins += Number(s.coins || 0);
      agg.sessions += 1;
    }
    return map;
  }

  function renderWeeklySummary() {
    const weeklyMap = buildWeeklyMap();
    const currentWeekKey = weekKeyFromEpochMs(Date.now());

    const keys = Array.from(weeklyMap.keys());
    if (!keys.includes(currentWeekKey)) keys.push(currentWeekKey);
    keys.sort((a, b) => b.localeCompare(a));

    if (!selectedWeekKey) selectedWeekKey = currentWeekKey;
    if (!keys.includes(selectedWeekKey)) selectedWeekKey = currentWeekKey;

    // Week picker
    dom.weekSelect.innerHTML = "";
    for (const key of keys) {
      const opt = document.createElement("option");
      opt.value = key;
      const isCurrent = key === currentWeekKey;
      opt.textContent = isCurrent ? `This week (${weekRangeLabel(key)})` : weekRangeLabel(key);
      dom.weekSelect.appendChild(opt);
    }
    dom.weekSelect.value = selectedWeekKey;

    const agg =
      weeklyMap.get(selectedWeekKey) ||
      ({
        totalSeconds: 0,
        totalChores: 0,
        totalXP: 0,
        totalCoins: 0,
        sessions: 0,
      });

    const avgSeconds = agg.sessions > 0 ? agg.totalSeconds / agg.sessions : 0;

    const statsForTop = [
      { label: "Total XP", value: agg.totalXP, text: `${agg.totalXP} XP` },
      { label: "Total time", value: agg.totalSeconds, text: formatDurationShort(agg.totalSeconds) },
      { label: "Chores", value: agg.totalChores, text: `${agg.totalChores} chores` },
      { label: "Sessions", value: agg.sessions, text: `${agg.sessions} sessions` },
    ];
    const top = statsForTop.sort((a, b) => b.value - a.value)[0];
    setText(dom.weekTopStat, top?.text || "—");

    dom.weeklyGrid.innerHTML = "";
    const add = (label, value) => {
      const card = document.createElement("div");
      card.className = "weekly-stat";
      const l = document.createElement("div");
      l.className = "weekly-stat__label";
      l.textContent = label;
      const v = document.createElement("div");
      v.className = "weekly-stat__value";
      v.textContent = value;
      card.appendChild(l);
      card.appendChild(v);
      dom.weeklyGrid.appendChild(card);
    };

    add("Total time", formatDurationShort(agg.totalSeconds));
    add("Total chores", String(agg.totalChores));
    add("Total XP", String(agg.totalXP));
    add("Total coins", String(agg.totalCoins));
    add("Sessions", String(agg.sessions));
    add("Avg session", formatDurationShort(avgSeconds));
  }

  function renderShop() {
    if (shopTab === "inventory") {
      renderInventory();
      return;
    }

    renderShopCategories();
    renderShopGrid();
  }

  function renderStopwatchUI() {
    const seconds = Math.max(0, Math.floor(stopwatch.elapsedMs / 1000));
    setText(dom.timerValue, formatClock(seconds));

    const isTiming = stopwatch.status === "running" || stopwatch.status === "paused";
    dom.sessionCard.classList.toggle("is-timing", isTiming);
    dom.sessionCard.classList.toggle("is-paused", stopwatch.status === "paused");

    const locked = stopwatch.status === "review";

    // Keep the app focused: prevent switching modes mid-stopwatch session/review.
    for (const btn of dom.modeButtons) {
      const isManual = btn.dataset.mode === "manual";
      btn.disabled = isManual && (isTiming || locked);
    }

    dom.startBtn.disabled = isTiming || locked;
    dom.pauseBtn.disabled = stopwatch.status !== "running";
    dom.resumeBtn.disabled = stopwatch.status !== "paused";
    dom.stopBtn.disabled = !isTiming;

    if (locked) setText(dom.timerHint, "Reviewing session…");
    else if (stopwatch.status === "running") setText(dom.timerHint, "Timing…");
    else if (stopwatch.status === "paused") setText(dom.timerHint, "Paused");
    else setText(dom.timerHint, "Ready");

    // Mobile sticky action button (Start/Stop).
    const showMobileAction =
      window.matchMedia("(max-width: 599px)").matches && mobileArea === "session" && mode === "stopwatch";
    dom.mobileActionBar.style.display = showMobileAction ? "" : "none";

    const canUse = !locked;
    if (stopwatch.status === "idle") {
      dom.mobilePrimaryBtn.textContent = "Start";
      dom.mobilePrimaryBtn.disabled = !canUse;
    } else if (stopwatch.status === "running" || stopwatch.status === "paused") {
      dom.mobilePrimaryBtn.textContent = "Stop";
      dom.mobilePrimaryBtn.disabled = !canUse;
    } else {
      dom.mobilePrimaryBtn.textContent = "Start";
      dom.mobilePrimaryBtn.disabled = true;
    }
  }

  function renderAll() {
    applyAppearanceFromStats();
    renderHeader();
    renderStopwatchUI();
    renderChoreCheckboxes(dom.manualChores, manualSelected, { allowDelete: true });
    if (draft) renderSummary();
    renderMusic();
    renderPet();
    renderHistory();
    renderWeeklySummary();
    renderShop();
  }

  // -----------------------------
  // Mode Switching
  // -----------------------------
  function setMobileArea(nextArea) {
    mobileArea = nextArea;

    for (const btn of dom.mobileNavButtons) {
      const active = btn.dataset.area === mobileArea;
      btn.classList.toggle("is-active", active);
    }

    const panels = Array.from(document.querySelectorAll(".mobile-panel"));
    for (const panel of panels) {
      panel.classList.toggle("is-active", panel.dataset.area === mobileArea);
    }

    // Update the sticky action bar visibility immediately.
    renderStopwatchUI();
  }

  function setMode(nextMode) {
    if (nextMode !== "stopwatch" && nextMode !== "manual") return;

    const isTiming = stopwatch.status === "running" || stopwatch.status === "paused";
    const locked = stopwatch.status === "review";
    if ((isTiming || locked) && nextMode === "manual") return;

    mode = nextMode;

    dom.stopwatchPanel.classList.toggle("is-hidden", mode !== "stopwatch");
    dom.manualPanel.classList.toggle("is-hidden", mode !== "manual");

    for (const btn of dom.modeButtons) {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }

    renderStopwatchUI();
  }

  // -----------------------------
  // Stopwatch Logic
  // -----------------------------
  function tickStopwatch() {
    stopwatch.elapsedMs = Date.now() - stopwatch.startEpochMs;
    renderStopwatchUI();
  }

  function startStopwatch() {
    if (stopwatch.status !== "idle") return;

    stopwatch.status = "running";
    stopwatch.elapsedMs = 0;
    stopwatch.startedAt = Date.now();
    stopwatch.startEpochMs = Date.now();

    stopwatch.intervalId = window.setInterval(tickStopwatch, 200);
    renderStopwatchUI();
  }

  function pauseStopwatch() {
    if (stopwatch.status !== "running") return;
    stopwatch.status = "paused";
    window.clearInterval(stopwatch.intervalId);
    stopwatch.intervalId = null;
    tickStopwatch(); // snap to latest elapsed
  }

  function resumeStopwatch() {
    if (stopwatch.status !== "paused") return;
    stopwatch.status = "running";
    stopwatch.startEpochMs = Date.now() - stopwatch.elapsedMs;
    stopwatch.intervalId = window.setInterval(tickStopwatch, 200);
    renderStopwatchUI();
  }

  function stopStopwatchWithConfirm() {
    if (stopwatch.status !== "running" && stopwatch.status !== "paused") return;

    const ok = confirm("Stop the stopwatch? You’ll review chores before saving.");
    if (!ok) return;

    window.clearInterval(stopwatch.intervalId);
    stopwatch.intervalId = null;

    const endedAt = Date.now();
    const durationMs =
      stopwatch.status === "paused" ? stopwatch.elapsedMs : endedAt - stopwatch.startEpochMs;

    const durationSeconds = Math.max(0, Math.round(durationMs / 1000));
    const startedAt = stopwatch.startedAt ?? endedAt - durationSeconds * 1000;

    stopwatch.status = "review";
    stopwatch.elapsedMs = durationMs;
    renderStopwatchUI();

    openSummaryDraft({
      source: "stopwatch",
      startedAt,
      endedAt,
      durationSeconds,
      chores: [],
    });
  }

  function resetStopwatch() {
    window.clearInterval(stopwatch.intervalId);
    stopwatch.intervalId = null;
    stopwatch.status = "idle";
    stopwatch.startEpochMs = 0;
    stopwatch.elapsedMs = 0;
    stopwatch.startedAt = null;
    renderStopwatchUI();
  }

  // -----------------------------
  // Manual Logging
  // -----------------------------
  function getSelectedChoresFrom(container) {
    const checked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'));
    return checked.map((c) => c.value);
  }

  function openManualReview() {
    const minutes = Number(dom.manualMinutes.value);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      alert("Please enter minutes greater than 0.");
      dom.manualMinutes.focus();
      return;
    }

    const chores = getSelectedChoresFrom(dom.manualChores);
    const endedAt = Date.now();
    const durationSeconds = Math.round(minutes * 60);
    const startedAt = endedAt - durationSeconds * 1000;

    openSummaryDraft({
      source: "manual",
      startedAt,
      endedAt,
      durationSeconds,
      chores,
    });
  }

  // -----------------------------
  // Summary Modal (Draft -> Save)
  // -----------------------------
  function openSummaryDraft(nextDraft) {
    draft = {
      id: makeId(),
      source: nextDraft.source,
      startedAt: nextDraft.startedAt,
      endedAt: nextDraft.endedAt,
      durationSeconds: nextDraft.durationSeconds,
      chores: [...(nextDraft.chores || [])],
    };

    dom.summaryError.textContent = "";
    renderSummary();

    if (typeof dom.summaryDialog.showModal === "function") dom.summaryDialog.showModal();
    else dom.summaryDialog.setAttribute("open", "open"); // basic fallback
  }

  function closeSummary() {
    dom.summaryError.textContent = "";
    if (typeof dom.summaryDialog.close === "function") dom.summaryDialog.close();
    else dom.summaryDialog.removeAttribute("open");
  }

  function renderSummary() {
    if (!draft) return;

    const ended = new Date(draft.endedAt);
    setText(
      dom.summaryDate,
      ended.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );

    setText(dom.summaryDuration, formatClock(draft.durationSeconds));

    const selectedSet = new Set(draft.chores);
    renderChoreCheckboxes(dom.summaryChores, selectedSet, { allowDelete: false });

    const rewards = computeRewards({
      durationSeconds: draft.durationSeconds,
      chores: draft.chores,
      endedAt: draft.endedAt,
    });

    setText(dom.summaryXp, `+${rewards.totalXP}`);
    setText(dom.summaryCoins, `+${rewards.coins}`);

    dom.summaryBreakdown.innerHTML = "";

    const addLine = (title, text) => {
      const line = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = title;
      line.appendChild(strong);
      line.appendChild(document.createTextNode(`: ${text}`));
      dom.summaryBreakdown.appendChild(line);
    };

    addLine("Chores", `${draft.chores.length} × 10 = +${rewards.choreXP} XP`);
    addLine("Time", `${rewards.minutesForXP} min × 1 = +${rewards.timeXP} XP`);
    addLine(
      "Daily bonus",
      rewards.bonusXP > 0 ? `+${rewards.bonusXP} XP` : "already claimed today",
    );

    addLine("Base XP", `${rewards.baseXP} XP`);

    const multParts = [`Rebirth x${rewards.rebirthMultiplier.toFixed(2)}`];
    if (rewards.usedGoldenGloves) multParts.push("Golden Gloves x2 (consumed on save)");
    addLine("Multipliers", multParts.join(" • "));

    addLine("Total (XP = Coins)", `${rewards.totalXP}`);
  }

  function syncDraftChoresFromSummary() {
    if (!draft) return;
    const selected = getSelectedChoresFrom(dom.summaryChores);
    draft.chores = selected;
    renderSummary();
  }

  function saveDraftSession() {
    if (!draft) return;

    if (!draft.chores.length) {
      dom.summaryError.textContent = "Select at least 1 chore to save this session.";
      return;
    }

    if (draft.durationSeconds <= 0) {
      dom.summaryError.textContent = "Time spent must be greater than 0.";
      return;
    }

    const rewards = computeRewards({
      durationSeconds: draft.durationSeconds,
      chores: draft.chores,
      endedAt: draft.endedAt,
    });

    const dateKey = localDateKey(new Date(draft.endedAt));
    if (rewards.bonusXP > 0) stats.lastDailyBonusDate = dateKey;

    // Consume Golden Gloves when a session is actually saved.
    if (rewards.usedGoldenGloves) {
      const current = Number(stats.consumables?.goldenGloves || 0);
      stats.consumables.goldenGloves = Math.max(0, current - 1);
    }

    const session = {
      id: draft.id,
      source: draft.source,
      startedAt: draft.startedAt,
      endedAt: draft.endedAt,
      dateKey,
      durationSeconds: draft.durationSeconds,
      chores: [...draft.chores],
      xp: rewards.totalXP,
      coins: rewards.coins,
      bonusXP: rewards.bonusXP,
      multiplier: rewards.multiplier,
      rebirthMultiplier: rewards.rebirthMultiplier,
      usedGoldenGloves: rewards.usedGoldenGloves,
    };

    sessions.push(session);

    stats.totalXP = Number(stats.totalXP || 0) + rewards.totalXP;
    stats.totalCoins = Number(stats.totalCoins || 0) + rewards.coins;

    persistAll();
    closeSummary();

    draft = null;
    resetStopwatch(); // unlocks stopwatch if we were in "review"
    renderAll();
  }

  function discardDraftSession() {
    if (!draft) return;
    const ok = confirm("Discard this session? It won’t be saved.");
    if (!ok) return;

    closeSummary();
    draft = null;
    resetStopwatch();
    renderAll();
  }

  // -----------------------------
  // Chore Names
  // -----------------------------
  function addChoreFromInput(inputEl, opts = {}) {
    const { selectInManual = false, selectInDraft = false } = opts;
    const raw = inputEl.value;
    const name = normalizeChoreName(raw);

    if (!name) return;

    const already = choreNames.some((n) => n.toLowerCase() === name.toLowerCase());
    if (already) {
      inputEl.value = "";
      return;
    }

    choreNames.push(name);
    inputEl.value = "";

    if (selectInManual) manualSelected.add(name);
    if (selectInDraft && draft) draft.chores = [...new Set([...draft.chores, name])];

    saveJson(STORAGE.chores, choreNames);
    renderAll();
  }

  // -----------------------------
  // Confirm Dialog (modals, not window.confirm)
  // -----------------------------
  function closeConfirm() {
    confirmOnOk = null;
    if (typeof dom.confirmDialog.close === "function") dom.confirmDialog.close();
    else dom.confirmDialog.removeAttribute("open");
  }

  function confirmAction({ title, text, okText = "Confirm", danger = false, onOk }) {
    confirmOnOk = typeof onOk === "function" ? onOk : null;

    setText(dom.confirmTitle, title);
    setText(dom.confirmText, text);
    setText(dom.confirmOkBtn, okText);

    dom.confirmOkBtn.classList.toggle("btn--danger", danger);
    dom.confirmOkBtn.classList.toggle("btn--primary", !danger);

    if (typeof dom.confirmDialog.showModal === "function") dom.confirmDialog.showModal();
    else dom.confirmDialog.setAttribute("open", "open");
  }

  // -----------------------------
  // Economy Helpers (coins, tokens, purchase log)
  // -----------------------------
  function spendCoins(amount) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    const coins = Number(stats.totalCoins || 0);
    if (coins < n) {
      alert("Not enough coins.");
      return false;
    }
    stats.totalCoins = coins - n;
    return true;
  }

  function logPurchase({ itemId, costCoins, note }) {
    stats.purchases = Array.isArray(stats.purchases) ? stats.purchases : [];
    stats.purchases.push({
      itemId: String(itemId),
      at: Date.now(),
      costCoins: Number.isFinite(Number(costCoins)) ? Number(costCoins) : undefined,
      note: typeof note === "string" ? note : undefined,
    });
  }

  // -----------------------------
  // Rebirth
  // -----------------------------
  function triggerRebirth() {
    if (!canRebirth()) return;

    confirmAction({
      title: "Rebirth",
      text: `Rebirth resets XP/level to 1 but keeps coins, purchases, and history. Cost: ${COSTS.rebirth} coins.`,
      okText: "Rebirth",
      danger: true,
      onOk: () => {
        if (!spendCoins(COSTS.rebirth)) return;
        stats.totalXP = 0;
        stats.rebirths = Number(stats.rebirths || 0) + 1;
        logPurchase({ itemId: "rebirth", costCoins: COSTS.rebirth });
        persistAll();
        renderAll();
      },
    });
  }

  // -----------------------------
  // Music
  // -----------------------------
  function renderMusic() {
    const unlocked = Boolean(stats.unlocks?.musicPack);
    dom.musicCard.classList.toggle("is-hidden", !unlocked);
    if (!unlocked) return;

    // Populate track list
    dom.musicSelect.innerHTML = "";
    for (const t of MUSIC_TRACKS) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      dom.musicSelect.appendChild(opt);
    }

    const trackId = stats.settings?.music?.trackId || MUSIC_TRACKS[0]?.id;
    dom.musicSelect.value = trackId;

    // Ensure the audio element points at the selected track.
    const selected = MUSIC_TRACKS.find((x) => x.id === trackId) || MUSIC_TRACKS[0];
    if (selected && dom.musicAudio.src !== selected.src) {
      // When served over http(s), audio.src becomes an absolute URL; compare by suffix.
      const endsWith = dom.musicAudio.src.endsWith(selected.src);
      if (!endsWith) dom.musicAudio.src = selected.src;
    }

    const volume = Number(stats.settings?.music?.volume);
    dom.musicVolume.value = Number.isFinite(volume) ? String(volume) : "0.6";
    dom.musicAudio.volume = Number(dom.musicVolume.value);
    dom.musicAudio.loop = true;

    const nowPlaying = dom.musicAudio.paused ? "Paused" : "Playing";
    setText(dom.musicStatus, nowPlaying);
  }

  function setMusicTrack(trackId) {
    const t = MUSIC_TRACKS.find((x) => x.id === trackId) || MUSIC_TRACKS[0];
    if (!t) return;
    stats.settings.music.trackId = t.id;
    dom.musicAudio.src = t.src;
    persistAll();
  }

  async function musicPlay() {
    try {
      await dom.musicAudio.play();
      stats.settings.music.isPlaying = true;
      persistAll();
      renderMusic();
    } catch {
      setText(dom.musicStatus, "Press Play to start (browser blocked autoplay)");
    }
  }

  function musicPause() {
    dom.musicAudio.pause();
    stats.settings.music.isPlaying = false;
    persistAll();
    renderMusic();
  }

  // -----------------------------
  // Pet Mop Companion
  // -----------------------------
  const PET_MESSAGES = [
    "Small steps add up. You’ve got this.",
    "One chore at a time. Future-you says thanks.",
    "Clean space, calm mind.",
    "Quick win: do a 5-minute tidy.",
    "Hydration check. Then back to it.",
    "You’re building momentum.",
    "If it takes under 2 minutes, do it now.",
    "Nice work showing up.",
  ];

  function buildPetDust() {
    dom.petDust.innerHTML = "";
    for (let i = 0; i < 12; i += 1) {
      const d = document.createElement("div");
      d.className = "dust";
      d.style.left = `${Math.floor(Math.random() * 120)}px`;
      d.style.top = `${Math.floor(Math.random() * 120)}px`;
      d.style.opacity = String(0.25 + Math.random() * 0.4);
      dom.petDust.appendChild(d);
    }
  }

  function petShowMessage() {
    const msg = PET_MESSAGES[Math.floor(Math.random() * PET_MESSAGES.length)];
    dom.petBubble.textContent = msg;
    dom.petBubble.classList.remove("is-hidden");

    // Occasionally clean some dust particles for fun.
    if (Math.random() < 0.35) {
      const dust = Array.from(dom.petDust.querySelectorAll(".dust"));
      dust
        .sort(() => Math.random() - 0.5)
        .slice(0, 4)
        .forEach((d) => d.classList.add("is-cleaned"));
      window.setTimeout(() => buildPetDust(), 900);
    }

    window.clearTimeout(petHideBubbleTimerId);
    petHideBubbleTimerId = window.setTimeout(() => {
      dom.petBubble.classList.add("is-hidden");
    }, 15000);
  }

  function scheduleNextPetMessage() {
    window.clearTimeout(petMessageTimerId);
    const delayMs = 60_000 + Math.floor(Math.random() * 60_000); // 1–2 minutes
    petMessageTimerId = window.setTimeout(() => {
      petShowMessage();
      scheduleNextPetMessage();
    }, delayMs);
  }

  function renderPet() {
    const unlocked = Boolean(stats.unlocks?.petMop);
    const enabled = Boolean(stats.settings?.petMopEnabled);
    const visible = unlocked && enabled;

    dom.petMop.classList.toggle("is-hidden", !visible);
    if (!visible) {
      window.clearTimeout(petMessageTimerId);
      window.clearTimeout(petHideBubbleTimerId);
      dom.petBubble.classList.add("is-hidden");
      return;
    }

    if (!dom.petDust.childElementCount) buildPetDust();
    scheduleNextPetMessage();
  }

  // -----------------------------
  // Persistence
  // -----------------------------
  function makeDefaultStats() {
    return {
      totalXP: 0,
      totalCoins: 0,
      tokens: 0,
      rebirths: 0,
      lastDailyBonusDate: null,
      purchases: [],
      consumables: { goldenGloves: 0 },
      unlocks: { musicPack: false, petMop: false, themes: ["default"], backgrounds: ["default"] },
      activeTheme: "default",
      activeBackground: "default",
      settings: {
        petMopEnabled: false,
        music: { volume: 0.6, trackId: MUSIC_TRACKS[0]?.id || "track-1", isPlaying: false },
      },
    };
  }

  function normalizeStats(input) {
    const s = makeDefaultStats();
    if (!input || typeof input !== "object") return s;

    // Core numbers
    s.totalXP = Number.isFinite(Number(input.totalXP)) ? Number(input.totalXP) : s.totalXP;
    s.totalCoins = Number.isFinite(Number(input.totalCoins)) ? Number(input.totalCoins) : s.totalCoins;
    s.tokens = Number.isFinite(Number(input.tokens)) ? Number(input.tokens) : s.tokens;
    s.rebirths = Number.isFinite(Number(input.rebirths)) ? Number(input.rebirths) : s.rebirths;

    // Daily bonus tracking
    s.lastDailyBonusDate =
      typeof input.lastDailyBonusDate === "string" ? input.lastDailyBonusDate : s.lastDailyBonusDate;

    // Purchases log
    s.purchases = Array.isArray(input.purchases) ? input.purchases.slice(0) : s.purchases;

    // Consumables
    const gg = input.consumables?.goldenGloves;
    s.consumables.goldenGloves = Number.isFinite(Number(gg)) ? Math.max(0, Number(gg)) : 0;

    // Unlocks (default items are always unlocked)
    s.unlocks.musicPack = Boolean(input.unlocks?.musicPack);
    s.unlocks.petMop = Boolean(input.unlocks?.petMop);

    const themes = Array.isArray(input.unlocks?.themes) ? input.unlocks.themes : [];
    s.unlocks.themes = Array.from(new Set(["default", ...themes.filter((t) => typeof t === "string")]));

    const bgs = Array.isArray(input.unlocks?.backgrounds) ? input.unlocks.backgrounds : [];
    s.unlocks.backgrounds = Array.from(new Set(["default", ...bgs.filter((b) => typeof b === "string")]));

    // Active selection (must be unlocked)
    s.activeTheme = typeof input.activeTheme === "string" ? input.activeTheme : s.activeTheme;
    s.activeBackground =
      typeof input.activeBackground === "string" ? input.activeBackground : s.activeBackground;

    // Settings
    s.settings.petMopEnabled = Boolean(input.settings?.petMopEnabled);
    const volume = Number(input.settings?.music?.volume);
    s.settings.music.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : s.settings.music.volume;
    s.settings.music.trackId =
      typeof input.settings?.music?.trackId === "string" ? input.settings.music.trackId : s.settings.music.trackId;
    s.settings.music.isPlaying = Boolean(input.settings?.music?.isPlaying);

    // Ensure active selections are valid for current unlocks.
    if (!isUnlocked(s.unlocks.themes, s.activeTheme)) s.activeTheme = "default";
    if (!isUnlocked(s.unlocks.backgrounds, s.activeBackground)) s.activeBackground = "default";

    return s;
  }

  function persistAll() {
    saveJson(STORAGE.sessions, sessions);
    saveJson(STORAGE.stats, stats);
    saveJson(STORAGE.chores, choreNames);
  }

  function loadAll() {
    choreNames = loadJson(STORAGE.chores, DEFAULT_CHORES);
    if (!Array.isArray(choreNames)) choreNames = [...DEFAULT_CHORES];

    sessions = loadJson(STORAGE.sessions, []);
    if (!Array.isArray(sessions)) sessions = [];

    stats = normalizeStats(loadJson(STORAGE.stats, null));
  }

  // -----------------------------
  // Event Wiring
  // -----------------------------
  function wireEvents() {
    dom.modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    // Mobile section tabs
    dom.mobileNavButtons.forEach((btn) => {
      btn.addEventListener("click", () => setMobileArea(btn.dataset.area));
    });

    dom.startBtn.addEventListener("click", startStopwatch);
    dom.pauseBtn.addEventListener("click", pauseStopwatch);
    dom.resumeBtn.addEventListener("click", resumeStopwatch);
    dom.stopBtn.addEventListener("click", stopStopwatchWithConfirm);

    dom.mobilePrimaryBtn.addEventListener("click", () => {
      if (mode !== "stopwatch") return;
      if (stopwatch.status === "idle") startStopwatch();
      else if (stopwatch.status === "running" || stopwatch.status === "paused")
        stopStopwatchWithConfirm();
    });

    dom.manualPanel.addEventListener("submit", (e) => {
      e.preventDefault();
      openManualReview();
    });

    dom.manualChores.addEventListener("change", () => {
      manualSelected = new Set(getSelectedChoresFrom(dom.manualChores));
    });

    dom.addChoreBtn.addEventListener("click", () =>
      addChoreFromInput(dom.newChoreName, { selectInManual: true }),
    );
    dom.newChoreName.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addChoreFromInput(dom.newChoreName, { selectInManual: true });
    });

    dom.summaryForm.addEventListener("submit", (e) => {
      // Prevent accidental full-page reload if the user presses Enter in a dialog input.
      e.preventDefault();
    });

    dom.summaryChores.addEventListener("change", syncDraftChoresFromSummary);
    dom.saveBtn.addEventListener("click", saveDraftSession);
    dom.discardBtn.addEventListener("click", discardDraftSession);
    dom.closeSummaryBtn.addEventListener("click", discardDraftSession);

    dom.summaryAddChoreBtn.addEventListener("click", () =>
      addChoreFromInput(dom.summaryNewChoreName, { selectInDraft: true }),
    );
    dom.summaryNewChoreName.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addChoreFromInput(dom.summaryNewChoreName, { selectInDraft: true });
    });

    // Close dialog via Esc key or native close controls: discard (do not auto-save).
    dom.summaryDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      discardDraftSession();
    });

    dom.weekSelect.addEventListener("change", () => {
      selectedWeekKey = dom.weekSelect.value;
      renderWeeklySummary();
    });

    // Shop tabs
    dom.shopTabBtn.addEventListener("click", () => setShopTab("shop"));
    dom.inventoryTabBtn.addEventListener("click", () => setShopTab("inventory"));

    // Rebirth
    dom.rebirthBtn.addEventListener("click", triggerRebirth);

    // Confirm dialog
    const cancelConfirm = () => closeConfirm();
    dom.confirmCloseBtn.addEventListener("click", cancelConfirm);
    dom.confirmCancelBtn.addEventListener("click", cancelConfirm);
    dom.confirmDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      cancelConfirm();
    });
    dom.confirmOkBtn.addEventListener("click", () => {
      const fn = confirmOnOk;
      closeConfirm();
      if (typeof fn === "function") fn();
    });

    // Music
    dom.musicSelect.addEventListener("change", () => {
      setMusicTrack(dom.musicSelect.value);
      // If currently playing, continue with the new track.
      if (!dom.musicAudio.paused) void musicPlay();
      renderMusic();
    });
    dom.musicPlayBtn.addEventListener("click", () => void musicPlay());
    dom.musicPauseBtn.addEventListener("click", musicPause);
    dom.musicVolume.addEventListener("input", () => {
      const v = Number(dom.musicVolume.value);
      dom.musicAudio.volume = v;
      stats.settings.music.volume = v;
      persistAll();
    });

    dom.musicAudio.addEventListener("play", () => renderMusic());
    dom.musicAudio.addEventListener("pause", () => renderMusic());
    dom.musicAudio.addEventListener("error", () => {
      const trackId = stats.settings?.music?.trackId || MUSIC_TRACKS[0]?.id;
      const t = MUSIC_TRACKS.find((x) => x.id === trackId);
      setText(dom.musicStatus, t ? `Missing file: ${t.src}` : "Audio error");
    });
  }

  // -----------------------------
  // Boot
  // -----------------------------
  function boot() {
    loadAll();
    wireEvents();
    setMode("stopwatch");
    setShopTab("shop");
    setMobileArea("session");
    setMusicTrack(stats.settings?.music?.trackId);
    renderAll();
  }

  boot();
})();
