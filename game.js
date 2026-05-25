"use strict";

const DATA_URL = "data/ehime_new_staff_quiz_100.json";
const CONFIG_URL = "data/config.json";
const STORAGE_KEY = "ehimeQuiz100.activeSession.v1";

const fallbackConfig = {
  titles: [
    { min: 90, name: "愛媛県政マイスター", description: "幅広い分野を横断して理解できています。" },
    { min: 80, name: "県政横断プレイヤー", description: "地域課題と政策分野のつながりをよく押さえています。" },
    { min: 60, name: "えひめ基礎マスター", description: "県職員としての基礎知識が着実に身についています。" },
    { min: 40, name: "えひめ学習中", description: "解説と出典を確認しながら定着させましょう。" },
    { min: 0, name: "県政ビギナー", description: "ここからが県政理解の入口です。" }
  ],
  categories: [],
  modes: {}
};

const modeDefinitions = [
  {
    id: "first",
    name: "はじめてモード",
    count: 10,
    duration: "5分",
    difficulty: "基礎中心",
    target: "新規採用職員",
    description: "最初に押さえたい基礎問題を中心に、全体像を短く確認します。",
    filter: (q) => q.difficulty === "basic",
    fallbackFilter: () => true,
    balanced: true,
    reviewEachQuestion: true
  },
  {
    id: "training",
    name: "研修モード",
    count: 30,
    duration: "15から20分",
    difficulty: "基礎・標準",
    target: "研修・確認テスト",
    description: "研修本番で使いやすい30問構成です。全カテゴリから偏りを抑えて出題します。",
    filter: (q) => ["basic", "standard"].includes(q.difficulty),
    fallbackFilter: () => true,
    balanced: true,
    reviewEachQuestion: true
  },
  {
    id: "random10",
    name: "ランダム10問",
    count: 10,
    duration: "5分",
    difficulty: "全難易度",
    target: "短時間学習",
    description: "休憩時間や導入クイズに向く軽量モードです。",
    filter: () => true,
    balanced: false,
    reviewEachQuestion: true
  },
  {
    id: "category",
    name: "カテゴリ別モード",
    count: null,
    duration: "カテゴリにより変動",
    difficulty: "全難易度",
    target: "重点復習",
    description: "人口、防災、産業など、確認したい領域だけに絞って学べます。",
    filter: () => true,
    balanced: false,
    reviewEachQuestion: true,
    opensCategorySelect: true
  },
  {
    id: "all100",
    name: "100問チャレンジ",
    count: 100,
    duration: "45分以上",
    difficulty: "全難易度",
    target: "自己学習・総復習",
    description: "問題バンクの全問を通して、県政基礎力を総点検します。",
    filter: () => true,
    balanced: false,
    reviewEachQuestion: true,
    confirmStart: true
  },
  {
    id: "diagnosis",
    name: "県職員力診断",
    count: 20,
    duration: "10から15分",
    difficulty: "標準・応用中心",
    target: "既存職員・腕試し",
    description: "標準・応用問題を中心に、部局横断の理解度を確認します。",
    filter: (q) => ["standard", "advanced"].includes(q.difficulty),
    fallbackFilter: () => true,
    balanced: true,
    reviewEachQuestion: true
  }
];

const state = {
  dataset: null,
  config: fallbackConfig,
  questions: [],
  categories: [],
  sources: [],
  session: null,
  activeView: "home",
  lastModeId: "first",
  timerId: null,
  timerEndsAt: null
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindGlobalEvents();

  try {
    const [dataset, config] = await Promise.all([fetchJson(DATA_URL), fetchJson(CONFIG_URL).catch(() => fallbackConfig)]);
    state.dataset = dataset;
    state.config = mergeConfig(config);
    state.questions = normalizeQuestions(dataset);
    validateQuestions(state.questions);
    state.categories = buildCategories(state.questions, state.config.categories);
    state.sources = buildSources(dataset, state.questions);
    renderStaticContent();
    renderResumePanel();
    navigate("home");
  } catch (error) {
    showError(error);
  }
}

function cacheElements() {
  const ids = [
    "question-total",
    "category-total",
    "source-total",
    "resume-panel",
    "resume-text",
    "resume-button",
    "discard-save-button",
    "quick-mode-grid",
    "mode-grid",
    "category-grid",
    "training-review-toggle",
    "training-timer-toggle",
    "quiz-mode-name",
    "quiz-position",
    "timer-display",
    "live-score",
    "progress-percent",
    "progress-fill",
    "category-tag",
    "difficulty-tag",
    "update-tag",
    "quiz-question",
    "choices",
    "feedback-panel",
    "feedback-title",
    "correct-answer",
    "feedback-explanation",
    "feedback-sources",
    "next-button",
    "quit-button",
    "result-rate",
    "result-score",
    "result-title-description",
    "retry-button",
    "review-misses-button",
    "category-results",
    "review-list",
    "source-list",
    "source-search",
    "error-message"
  ];

  ids.forEach((id) => {
    els[toCamel(id)] = document.getElementById(id);
  });

  els.views = {
    home: document.getElementById("view-home"),
    modes: document.getElementById("view-modes"),
    categories: document.getElementById("view-categories"),
    quiz: document.getElementById("view-quiz"),
    results: document.getElementById("view-results"),
    sources: document.getElementById("view-sources"),
    about: document.getElementById("view-about"),
    error: document.getElementById("view-error")
  };
}

function bindGlobalEvents() {
  document.body.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-nav]");
    if (navButton) {
      navigate(navButton.dataset.nav);
      return;
    }

    const startButton = event.target.closest("[data-start-mode]");
    if (startButton) {
      handleModeStart(startButton.dataset.startMode);
      return;
    }

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      startCategorySession(categoryButton.dataset.category);
      return;
    }
  });

  els.nextButton.addEventListener("click", nextQuestion);
  els.quitButton.addEventListener("click", confirmQuit);
  els.retryButton.addEventListener("click", () => handleModeStart(state.lastModeId));
  els.reviewMissesButton.addEventListener("click", reviewMissedQuestions);
  els.resumeButton.addEventListener("click", resumeSavedSession);
  els.discardSaveButton.addEventListener("click", discardSavedSession);
  els.sourceSearch.addEventListener("input", () => renderSources(els.sourceSearch.value));

  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("beforeunload", (event) => {
    if (state.session && !state.session.completed) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

function toCamel(id) {
  return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} の読み込みに失敗しました。HTTP ${response.status}`);
  }
  return response.json();
}

function mergeConfig(config) {
  return {
    ...fallbackConfig,
    ...config,
    titles: Array.isArray(config.titles) && config.titles.length ? config.titles : fallbackConfig.titles,
    categories: Array.isArray(config.categories) ? config.categories : [],
    modes: config.modes || {}
  };
}

function normalizeQuestions(dataset) {
  if (!dataset || !Array.isArray(dataset.questions)) {
    throw new Error("JSON内に questions 配列が見つかりません。");
  }

  return dataset.questions.map((question, index) => {
    const sourceIds = Array.isArray(question.source_ids) ? question.source_ids : [];
    const sources = Array.isArray(question.sources) ? question.sources : [];
    return {
      ...question,
      order: index,
      category_id: question.category_id || categoryIdFor(question.category, index),
      source_ids: sourceIds,
      sources: sources.map((source) => enrichSource(source, dataset))
    };
  });
}

function categoryIdFor(categoryName, index) {
  const found = state.config.categories.find((category) => category.name === categoryName);
  if (found) {
    return found.id;
  }
  return `C${String(index + 1).padStart(2, "0")}`;
}

function enrichSource(source, dataset) {
  const indexed = dataset.source_index?.[source.id] || {};
  const title = source.title || indexed.title || "出典未設定";
  return {
    ...indexed,
    ...source,
    title,
    publisher: source.publisher || indexed.publisher || inferPublisher(title),
    confirmed_at: source.confirmed_at || indexed.confirmed_at || dataset.metadata?.created_date || "未設定"
  };
}

function inferPublisher(title) {
  const match = title.match(/^(.+?)「/);
  if (match) {
    return match[1].trim();
  }
  if (title.includes("愛媛県")) {
    return "愛媛県";
  }
  return "未設定";
}

function validateQuestions(questions) {
  const errors = [];
  questions.forEach((question) => {
    if (!question.id) errors.push("ID未設定の問題があります。");
    if (!Array.isArray(question.choices) || question.choices.length !== 4) {
      errors.push(`${question.id}: 選択肢が4つではありません。`);
    }
    if (!Number.isInteger(question.answer_index) || question.answer_index < 0 || question.answer_index > 3) {
      errors.push(`${question.id}: answer_index が不正です。`);
    }
    if (question.choices?.[question.answer_index] !== question.answer) {
      errors.push(`${question.id}: answer_index と answer が一致しません。`);
    }
    if (!question.explanation) errors.push(`${question.id}: 解説がありません。`);
    if (!question.sources?.length) errors.push(`${question.id}: 出典がありません。`);
  });

  if (errors.length) {
    throw new Error(errors.slice(0, 5).join("\n"));
  }
}

function buildCategories(questions, configuredCategories) {
  const counts = new Map();
  questions.forEach((question) => {
    counts.set(question.category, (counts.get(question.category) || 0) + 1);
  });

  return Array.from(counts, ([name, count], index) => {
    const configured = configuredCategories.find((category) => category.name === name) || {};
    return {
      id: configured.id || `C${String(index + 1).padStart(2, "0")}`,
      name,
      shortName: configured.short_name || name,
      description: configured.description || "愛媛県政の基礎知識",
      count
    };
  });
}

function buildSources(dataset, questions) {
  const map = new Map();

  Object.entries(dataset.source_index || {}).forEach(([id, source]) => {
    map.set(id, enrichSource({ id, ...source }, dataset));
  });

  questions.forEach((question) => {
    question.sources.forEach((source) => {
      map.set(source.id, { ...map.get(source.id), ...source });
    });
  });

  return Array.from(map.values())
    .map((source) => ({
      ...source,
      usedCount: questions.filter((question) => question.source_ids.includes(source.id)).length
    }))
    .sort((a, b) => a.id.localeCompare(b.id, "ja"));
}

function renderStaticContent() {
  els.questionTotal.textContent = String(state.questions.length);
  els.categoryTotal.textContent = String(state.categories.length);
  els.sourceTotal.textContent = String(state.sources.length);
  renderQuickModes();
  renderModeCards();
  renderCategoryCards();
  renderSources("");
}

function renderQuickModes() {
  const quickModes = ["first", "training", "random10"];
  els.quickModeGrid.innerHTML = quickModes
    .map((modeId) => {
      const mode = getMode(modeId);
      return `
        <article class="quick-card">
          <header>
            <h3>${escapeHtml(mode.name)}</h3>
            <p>${escapeHtml(mode.description)}</p>
          </header>
          <div class="meta-row">
            <span class="chip orange">${mode.count}問</span>
            <span class="chip">${escapeHtml(mode.duration)}</span>
          </div>
          <button class="secondary-action" type="button" data-start-mode="${mode.id}">開始</button>
        </article>
      `;
    })
    .join("");
}

function renderModeCards() {
  els.modeGrid.innerHTML = modeDefinitions
    .map((mode) => {
      const count = mode.id === "category" ? "選択式" : `${mode.count}問`;
      const actionAttr = mode.opensCategorySelect ? 'data-nav="categories"' : `data-start-mode="${mode.id}"`;
      return `
        <article class="mode-card">
          <header>
            <h3>${escapeHtml(mode.name)}</h3>
            <p>${escapeHtml(mode.description)}</p>
          </header>
          <div class="meta-row">
            <span class="chip orange">${escapeHtml(count)}</span>
            <span class="chip">${escapeHtml(mode.duration)}</span>
            <span class="chip green">${escapeHtml(mode.difficulty)}</span>
          </div>
          <p>${escapeHtml(mode.target)}</p>
          <button class="primary-action" type="button" ${actionAttr}>開始</button>
        </article>
      `;
    })
    .join("");
}

function renderCategoryCards() {
  els.categoryGrid.innerHTML = state.categories
    .map((category) => {
      return `
        <article class="category-card">
          <header>
            <div class="meta-row">
              <span class="chip">${escapeHtml(category.id)}</span>
              <span class="chip orange">${category.count}問</span>
            </div>
            <h3>${escapeHtml(category.name)}</h3>
            <p>${escapeHtml(category.description)}</p>
          </header>
          <button class="primary-action" type="button" data-category="${escapeHtml(category.name)}">このカテゴリで開始</button>
        </article>
      `;
    })
    .join("");
}

function renderSources(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const sources = state.sources.filter((source) => {
    if (!normalizedQuery) return true;
    return [source.title, source.publisher, source.url, source.id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  els.sourceList.innerHTML = sources
    .map((source) => {
      const url = source.url ? `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a>` : "URL未設定";
      return `
        <article class="source-card">
          <div class="meta-row">
            <span class="chip">${escapeHtml(source.id)}</span>
            <span class="chip green">${source.usedCount || 0}問</span>
          </div>
          <h3>${escapeHtml(source.title)}</h3>
          <p>発行主体: ${escapeHtml(source.publisher || "未設定")} / 確認日: ${escapeHtml(source.confirmed_at || "未設定")}</p>
          <p>${url}</p>
        </article>
      `;
    })
    .join("");
}

function navigate(view) {
  if (view === "quiz" && !state.session) return;
  if (!els.views[view]) return;

  state.activeView = view;
  Object.entries(els.views).forEach(([name, element]) => {
    element.classList.toggle("is-active", name === view);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === view);
  });

  if (view !== "quiz") {
    stopTimer();
  } else {
    maybeStartTimer();
  }

  document.getElementById("app").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getMode(modeId) {
  const base = modeDefinitions.find((mode) => mode.id === modeId);
  if (!base) throw new Error(`未定義のモードです: ${modeId}`);
  const configured = state.config.modes?.[modeId] || {};
  return { ...base, ...configured, id: modeId };
}

function handleModeStart(modeId) {
  if (modeId === "category") {
    navigate("categories");
    return;
  }

  const mode = getMode(modeId);
  if (mode.confirmStart && !confirm("100問チャレンジを開始します。所要時間が長くなるため、途中で休憩しながら進めてください。")) {
    return;
  }

  const reviewEachQuestion =
    modeId === "training" ? els.trainingReviewToggle.checked : mode.reviewEachQuestion !== false;
  const timeLimitSec = modeId === "training" && els.trainingTimerToggle.checked ? 20 * 60 : null;
  const selectedQuestions = selectQuestions(mode, mode.count);
  startSession({
    modeId,
    modeName: mode.name,
    questions: selectedQuestions,
    reviewEachQuestion,
    timeLimitSec
  });
}

function startCategorySession(categoryName) {
  const questions = shuffle(state.questions.filter((question) => question.category === categoryName));
  const category = state.categories.find((item) => item.name === categoryName);
  if (!questions.length) {
    alert("このカテゴリの問題が見つかりません。");
    return;
  }

  startSession({
    modeId: "category",
    modeName: `カテゴリ別: ${category?.shortName || categoryName}`,
    categoryName,
    questions,
    reviewEachQuestion: true,
    timeLimitSec: null
  });
}

function startSession({ modeId, modeName, categoryName = null, questions, reviewEachQuestion, timeLimitSec }) {
  if (modeId !== "review") {
    state.lastModeId = modeId;
  }
  const sessionQuestions = randomizeChoicesForSession(questions);
  state.session = {
    modeId,
    modeName,
    categoryName,
    questionIds: sessionQuestions.map((question) => question.id),
    questions: sessionQuestions,
    answers: [],
    currentIndex: 0,
    reviewEachQuestion,
    timeLimitSec,
    startedAt: Date.now(),
    completed: false
  };
  state.timerEndsAt = timeLimitSec ? Date.now() + timeLimitSec * 1000 : null;
  saveSession();
  renderQuestion();
  navigate("quiz");
}

function selectQuestions(mode, count) {
  const primary = state.questions.filter(mode.filter);
  const pool =
    primary.length >= count || !mode.fallbackFilter
      ? primary
      : uniqueQuestions([...primary, ...state.questions.filter(mode.fallbackFilter)]);

  if (pool.length < count) {
    throw new Error(`${mode.name}に必要な問題数が不足しています。必要数: ${count} / 対象: ${pool.length}`);
  }

  if (mode.id === "all100") {
    return shuffle(pool).slice(0, count);
  }

  if (mode.balanced) {
    return balancedPick(pool, count);
  }

  return shuffle(pool).slice(0, count);
}

function balancedPick(pool, count) {
  const groups = new Map();
  shuffle(pool).forEach((question) => {
    if (!groups.has(question.category)) groups.set(question.category, []);
    groups.get(question.category).push(question);
  });

  const selected = [];
  const categoryNames = shuffle(Array.from(groups.keys()));
  let cursor = 0;

  while (selected.length < count && Array.from(groups.values()).some((items) => items.length)) {
    const category = categoryNames[cursor % categoryNames.length];
    const group = groups.get(category);
    if (group?.length) {
      selected.push(group.shift());
    }
    cursor += 1;
  }

  return selected.slice(0, count);
}

function uniqueQuestions(questions) {
  const map = new Map();
  questions.forEach((question) => map.set(question.id, question));
  return Array.from(map.values());
}

function randomizeChoicesForSession(questions) {
  return questions.map((question) => {
    const choices = question.choices.map((choice, index) => ({
      choice,
      isCorrect: index === question.answer_index
    }));
    const randomizedChoices = shuffle(choices);
    return {
      ...question,
      choices: randomizedChoices.map((item) => item.choice),
      answer_index: randomizedChoices.findIndex((item) => item.isCorrect)
    };
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderQuestion() {
  const session = state.session;
  if (!session) return;

  const question = session.questions[session.currentIndex];
  const existingAnswer = session.answers[session.currentIndex];
  const correctCount = session.answers.filter((answer) => answer?.isCorrect).length;
  const progress = session.questions.length ? Math.round((session.currentIndex / session.questions.length) * 100) : 0;

  els.quizModeName.textContent = session.modeName;
  els.quizPosition.textContent = `${session.currentIndex + 1} / ${session.questions.length}`;
  els.liveScore.textContent = String(correctCount);
  els.progressPercent.textContent = `${progress}%`;
  document.querySelector(".progress-ring").style.setProperty("--progress", `${progress}%`);
  els.progressFill.style.width = `${progress}%`;
  els.categoryTag.textContent = question.category;
  els.difficultyTag.textContent = difficultyLabel(question.difficulty);
  els.updateTag.textContent = question.update_required ? "年度更新対象" : "固定知識";
  els.updateTag.classList.toggle("warning", Boolean(question.update_required));
  els.quizQuestion.textContent = question.question;
  els.feedbackPanel.classList.add("is-hidden");

  els.choices.innerHTML = question.choices
    .map((choice, index) => {
      const disabled = existingAnswer ? "disabled" : "";
      const className = existingAnswer ? choiceClass(question, existingAnswer, index) : "";
      return `
        <button class="choice-button ${className}" type="button" data-choice="${index}" ${disabled} aria-label="${index + 1}番 ${escapeAttribute(choice)}">
          <span class="choice-index" aria-hidden="true">${index + 1}</span>
          <span>${escapeHtml(choice)}</span>
        </button>
      `;
    })
    .join("");

  els.choices.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => answerQuestion(Number(button.dataset.choice)));
  });

  if (existingAnswer) {
    renderFeedback(question, existingAnswer, false);
  }

  saveSession();
}

function choiceClass(question, answer, index) {
  if (index === question.answer_index) return "is-correct";
  if (index === answer.selectedIndex && !answer.isCorrect) return "is-wrong";
  return "";
}

function answerQuestion(selectedIndex) {
  const session = state.session;
  if (!session) return;

  const question = session.questions[session.currentIndex];
  if (session.answers[session.currentIndex]) return;

  const answer = {
    questionId: question.id,
    selectedIndex,
    isCorrect: selectedIndex === question.answer_index,
    answeredAt: Date.now()
  };
  session.answers[session.currentIndex] = answer;

  els.choices.querySelectorAll(".choice-button").forEach((button, index) => {
    button.disabled = true;
    const resultClass = choiceClass(question, answer, index);
    if (resultClass) {
      button.classList.add(resultClass);
    }
  });

  const correctCount = session.answers.filter((item) => item?.isCorrect).length;
  els.liveScore.textContent = String(correctCount);

  if (session.reviewEachQuestion) {
    renderFeedback(question, answer, true);
  } else {
    setTimeout(nextQuestion, 260);
  }

  saveSession();
}

function renderFeedback(question, answer, animate) {
  els.feedbackPanel.classList.remove("is-hidden");
  els.feedbackPanel.style.animation = animate ? "" : "none";
  els.feedbackTitle.textContent = answer.isCorrect ? "正解です" : "確認しましょう";
  els.feedbackTitle.className = answer.isCorrect ? "is-correct-text" : "is-wrong-text";
  els.correctAnswer.textContent = `正解: ${question.answer}`;
  els.feedbackExplanation.textContent = question.explanation;
  els.feedbackSources.innerHTML = question.sources.map(renderSourceItem).join("");
  els.nextButton.textContent =
    state.session.currentIndex + 1 >= state.session.questions.length ? "結果を見る" : "次の問題へ";

  if (animate) {
    requestAnimationFrame(() => {
      els.feedbackPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

function renderSourceItem(source) {
  const link = source.url
    ? `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`
    : escapeHtml(source.title);
  return `
    <div class="source-item">
      <strong>${link}</strong>
      <small>発行主体: ${escapeHtml(source.publisher || "未設定")} / 確認日: ${escapeHtml(source.confirmed_at || "未設定")}</small>
    </div>
  `;
}

function nextQuestion() {
  const session = state.session;
  if (!session) return;
  if (!session.answers[session.currentIndex] && session.reviewEachQuestion) return;

  if (session.currentIndex + 1 >= session.questions.length) {
    completeSession();
    return;
  }

  session.currentIndex += 1;
  renderQuestion();
}

function completeSession() {
  if (!state.session) return;
  state.session.completed = true;
  stopTimer();
  clearSavedSession();
  renderResults();
  navigate("results");
}

function renderResults() {
  const session = state.session;
  const total = session.questions.length;
  const correct = session.answers.filter((answer) => answer?.isCorrect).length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  const title = titleFor(rate);
  const misses = getMissedAnswers();
  const reviewItems = session.reviewEachQuestion
    ? misses
    : session.questions.map((question, index) => ({ question, answer: session.answers[index] })).filter((item) => item.answer);

  els.resultRate.textContent = `${rate}%`;
  els.resultScore.textContent = `${correct} / ${total}`;
  document.getElementById("results-title").textContent = title.name;
  els.resultTitleDescription.textContent = title.description;
  els.reviewMissesButton.disabled = misses.length === 0;
  els.reviewMissesButton.textContent = misses.length ? `間違えた問題を復習 (${misses.length})` : "復習対象なし";
  renderCategoryResults();
  renderReviewList(reviewItems, !session.reviewEachQuestion);
}

function titleFor(rate) {
  return [...state.config.titles].sort((a, b) => b.min - a.min).find((title) => rate >= title.min);
}

function renderCategoryResults() {
  const stats = categoryStats();
  els.categoryResults.innerHTML = stats
    .map((stat) => {
      const rate = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
      return `
        <div class="category-result">
          <strong>${escapeHtml(stat.category)}</strong>
          <div class="bar" aria-label="${escapeAttribute(stat.category)} ${rate}%">
            <span style="--value: ${rate}%"></span>
          </div>
          <span>${rate}%</span>
        </div>
      `;
    })
    .join("");
}

function categoryStats() {
  const map = new Map();
  state.session.questions.forEach((question, index) => {
    const current = map.get(question.category) || { category: question.category, total: 0, correct: 0 };
    current.total += 1;
    if (state.session.answers[index]?.isCorrect) current.correct += 1;
    map.set(question.category, current);
  });
  return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category, "ja"));
}

function getMissedAnswers() {
  return state.session.questions
    .map((question, index) => ({ question, answer: state.session.answers[index] }))
    .filter((item) => item.answer && !item.answer.isCorrect);
}

function renderReviewList(items, includeCorrect = false) {
  if (!items.length) {
    els.reviewList.innerHTML = '<p class="review-item">全問正解です。出典一覧で根拠資料を確認すると、研修で説明しやすくなります。</p>';
    return;
  }

  els.reviewList.innerHTML = items
    .map(({ question, answer }) => {
      const userAnswer = question.choices[answer.selectedIndex];
      const resultChip = includeCorrect
        ? `<span class="chip ${answer.isCorrect ? "green" : "orange"}">${answer.isCorrect ? "正解" : "要復習"}</span>`
        : "";
      return `
        <article class="review-item">
          <div class="meta-row">
            <span class="chip">${escapeHtml(question.category)}</span>
            <span class="chip green">${escapeHtml(difficultyLabel(question.difficulty))}</span>
            ${resultChip}
          </div>
          <h4>${escapeHtml(question.question)}</h4>
          <div class="answer-line">
            <span>あなたの回答: ${escapeHtml(userAnswer)}</span>
            <strong>正解: ${escapeHtml(question.answer)}</strong>
          </div>
          <p>${escapeHtml(question.explanation)}</p>
          <div class="source-box">${question.sources.map(renderSourceItem).join("")}</div>
        </article>
      `;
    })
    .join("");
}

function reviewMissedQuestions() {
  const misses = getMissedAnswers();
  if (!misses.length) return;
  startSession({
    modeId: "review",
    modeName: "復習モード",
    questions: misses.map((item) => item.question),
    reviewEachQuestion: true,
    timeLimitSec: null
  });
}

function confirmQuit() {
  if (!state.session) {
    navigate("home");
    return;
  }

  const ok = confirm("トップへ戻ります。現在の進捗はこのブラウザに一時保存されます。");
  if (ok) {
    saveSession();
    navigate("home");
    renderResumePanel();
  }
}

function saveSession() {
  if (!state.session || state.session.completed) return;
  const payload = {
    ...state.session,
    questionVariants: state.session.questions.map((question) => ({
      id: question.id,
      choices: question.choices,
      answer_index: question.answer_index
    })),
    questions: undefined,
    timerRemainingSec: state.timerEndsAt ? Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000)) : null
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSavedSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    const questionMap = new Map(state.questions.map((question) => [question.id, question]));
    const variants = Array.isArray(saved.questionVariants) ? saved.questionVariants : null;
    const questions = saved.questionIds
      .map((id, index) => restoreQuestionVariant(questionMap.get(id), variants?.[index]))
      .filter(Boolean);
    if (!questions.length || questions.length !== saved.questionIds.length) return null;
    return {
      ...saved,
      questions,
      completed: false
    };
  } catch {
    return null;
  }
}

function restoreQuestionVariant(question, variant) {
  if (!question) return null;
  if (!variant) return question;
  const answerIndex = variant.answer_index;
  const hasMatchingChoices =
    variant.id === question.id &&
    Array.isArray(variant.choices) &&
    variant.choices.length === question.choices.length &&
    Number.isInteger(answerIndex) &&
    answerIndex >= 0 &&
    answerIndex < variant.choices.length &&
    variant.choices[answerIndex] === question.answer;

  if (!hasMatchingChoices) return null;

  return {
    ...question,
    choices: variant.choices,
    answer_index: answerIndex
  };
}

function renderResumePanel() {
  const saved = loadSavedSession();
  if (!saved) {
    els.resumePanel.classList.add("is-hidden");
    return;
  }

  els.resumeText.textContent = `${saved.modeName} ${saved.currentIndex + 1} / ${saved.questions.length} から再開できます。`;
  els.resumePanel.classList.remove("is-hidden");
}

function resumeSavedSession() {
  const saved = loadSavedSession();
  if (!saved) return;
  state.session = saved;
  state.lastModeId = saved.modeId;
  state.timerEndsAt = saved.timerRemainingSec ? Date.now() + saved.timerRemainingSec * 1000 : null;
  renderQuestion();
  navigate("quiz");
}

function discardSavedSession() {
  clearSavedSession();
  els.resumePanel.classList.add("is-hidden");
}

function clearSavedSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function maybeStartTimer() {
  stopTimer();
  if (!state.session?.timeLimitSec) {
    els.timerDisplay.classList.add("is-hidden");
    return;
  }
  if (!state.timerEndsAt) {
    state.timerEndsAt = Date.now() + state.session.timeLimitSec * 1000;
  }
  els.timerDisplay.classList.remove("is-hidden");
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 1000);
}

function updateTimer() {
  const remaining = Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  els.timerDisplay.textContent = `${minutes}:${seconds}`;
  if (remaining <= 0) {
    completeSession();
  }
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function handleKeyboard(event) {
  if (state.activeView !== "quiz" || !state.session) return;
  const number = Number(event.key);
  if (number >= 1 && number <= 4) {
    answerQuestion(number - 1);
    return;
  }
  if (event.key === "Enter" && state.session.answers[state.session.currentIndex]) {
    nextQuestion();
  }
}

function difficultyLabel(difficulty) {
  return {
    basic: "基礎",
    standard: "標準",
    advanced: "応用"
  }[difficulty] || difficulty;
}

function showError(error) {
  console.error(error);
  els.errorMessage.textContent =
    `${error.message} ローカルで確認する場合は、プロジェクトフォルダをWebサーバーで配信してください。`;
  navigate("error");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
