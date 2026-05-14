import "./styles.css";

/**
 * Basic Pitch連携準備枠
 * v0.11ではまだBasic Pitch本体は接続していません。
 *
 * 次のv0.12以降で、ここに @spotify/basic-pitch 等の読み込み処理を追加し、
 * 音声ファイルから notes: [{ midi, pc, name, start, end, duration, confidence }]
 * の形式へ変換します。
 */
const BASIC_PITCH_ENABLED = false;

async function analyzeWithBasicPitchIfAvailable(audioBuffer) {
  if (!BASIC_PITCH_ENABLED) return null;

  // v0.12以降で実装予定
  // return {
  //   estimatedBpm,
  //   keyLabel,
  //   keyInfo,
  //   notes
  // };

  return null;
}

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const ROOT_PCS = {
  C: 0, "C#": 1, D: 2, Eb: 3, E: 4, F: 5,
  "F#": 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11
};

const SOLFEGE_NAMES = ["ド", "ド#", "レ", "ミ♭", "ミ", "ファ", "ファ#", "ソ", "ラ♭", "ラ", "シ♭", "シ"];

const state = {
  estimatedBpm: null,
  playbackBpm: 90,
  chordOctave: 3,
  referenceApplyMode: "beat",
  chordOptionMode: "standard",
  key: "--",
  keyInfo: null,
  chords: ["C", "G", "Am", "F", "C", "G", "F", "C"],
  barCandidates: [],
  beatCandidates: [],
  referenceChords: [],
  beatReferenceChords: [],
  beatReferenceOctaves: [],
  chordBeats: [
    ["C", "C", "C", "C"],
    ["G", "G", "G", "G"],
    ["Am", "Am", "Am", "Am"],
    ["F", "F", "F", "F"],
    ["C", "C", "C", "C"],
    ["G", "G", "G", "G"],
    ["F", "F", "F", "F"],
    ["C", "C", "C", "C"]
  ],
  chordOctaveBeats: [
    [3, 3, 3, 3],
    [3, 3, 3, 3],
    [3, 3, 3, 3],
    [3, 3, 3, 3],
    [3, 3, 3, 3],
    [3, 3, 3, 3],
    [3, 3, 3, 3],
    [3, 3, 3, 3]
  ],
  detectedNotes: [],
  audioDuration: 0,
  audioBlob: null,
  audioUrl: null,
  mediaRecorder: null,
  recordedChunks: [],
  audioCtx: null,
  playingNodes: [],
  playbackTimers: [],
  activeBeat: null,
  tapTimes: []
};

const CHORD_OPTION_SETS = {
  basic: [
    "C", "D", "E", "F", "G", "A", "B",
    "Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bm"
  ],
  standard: [
    "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
    "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "Abm", "Am", "Bbm", "Bm"
  ],
  extended: [
    "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
    "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "Abm", "Am", "Bbm", "Bm",
    "Cdim", "C#dim", "Ddim", "Ebdim", "Edim", "Fdim", "F#dim", "Gdim", "Abdim", "Adim", "Bbdim", "Bdim",
    "Cmaj7", "Dmaj7", "Emaj7", "Fmaj7", "Gmaj7", "Amaj7", "Bmaj7",
    "Cm7", "Dm7", "Em7", "Fm7", "Gm7", "Am7", "Bm7",
    "C7", "D7", "E7", "F7", "G7", "A7", "B7"
  ]
};

function getChordOptions() {
  return CHORD_OPTION_SETS[state.chordOptionMode] || CHORD_OPTION_SETS.standard;
}

const chordNotes = buildChordNoteMap();

const els = {
  audioFile: document.getElementById("audioFile"),
  recordButton: document.getElementById("recordButton"),
  audioStatus: document.getElementById("audioStatus"),
  audioPreview: document.getElementById("audioPreview"),
  estimatedBpm: document.getElementById("estimatedBpm"),
  playbackBpm: document.getElementById("playbackBpm"),
  bpmInput: document.getElementById("bpmInput"),
  keyLabel: document.getElementById("keyLabel"),
  noteCount: document.getElementById("noteCount"),
  bpmDown: document.getElementById("bpmDown"),
  bpmUp: document.getElementById("bpmUp"),
  tapTempo: document.getElementById("tapTempo"),
  resetTap: document.getElementById("resetTap"),
  regenerateChords: document.getElementById("regenerateChords"),
  chordOctaveInput: document.getElementById("chordOctaveInput"),
  referenceApplyModeInput: document.getElementById("referenceApplyModeInput"),
  chordOptionModeInput: document.getElementById("chordOptionModeInput"),
  melodyPreview: document.getElementById("melodyPreview"),
  referenceChordPreview: document.getElementById("referenceChordPreview"),
  chordGrid: document.getElementById("chordGrid"),
  addBar: document.getElementById("addBar"),
  removeBar: document.getElementById("removeBar"),
  playChords: document.getElementById("playChords"),
  stopChords: document.getElementById("stopChords"),
  copyText: document.getElementById("copyText"),
  downloadMidi: document.getElementById("downloadMidi"),
  downloadMelodyMidi: document.getElementById("downloadMelodyMidi"),
  downloadFullMidi: document.getElementById("downloadFullMidi"),
  downloadJson: document.getElementById("downloadJson"),
  outputText: document.getElementById("outputText"),
  solfegeOutputText: document.getElementById("solfegeOutputText")
};

function clampBpm(value) {
  const bpm = Number(value);
  if (!Number.isFinite(bpm)) return 90;
  return Math.max(40, Math.min(240, Math.round(bpm)));
}

function setPlaybackBpm(value, options = {}) {
  const { syncInput = true } = options;
  state.playbackBpm = clampBpm(value);
  els.playbackBpm.textContent = state.playbackBpm;

  if (syncInput) {
    els.bpmInput.value = state.playbackBpm;
  }

  updateReferenceChordPreview();
  updateOutputText();
}

function handleBpmTyping() {
  const raw = els.bpmInput.value;

  // 空欄や入力途中の値はそのまま入力させる
  if (raw === "" || raw === "-" || raw === ".") return;

  const value = Number(raw);

  // 40〜240の範囲に入った時だけ再生BPMへ反映する
  if (Number.isFinite(value) && value >= 40 && value <= 240) {
    setPlaybackBpm(value, { syncInput: false });
  }
}

function commitBpmInput() {
  // 入力確定時だけ40〜240に丸めて、入力欄にも反映する
  setPlaybackBpm(els.bpmInput.value || state.playbackBpm, { syncInput: true });
}

function setEstimatedBpm(value) {
  state.estimatedBpm = value ? clampBpm(value) : null;
  els.estimatedBpm.textContent = state.estimatedBpm ?? "--";
}

function setChordOctave(value) {
  const octave = Number(value);
  state.chordOctave = Number.isFinite(octave)
    ? Math.max(1, Math.min(6, Math.round(octave)))
    : 3;

  if (els.chordOctaveInput) {
    els.chordOctaveInput.value = String(state.chordOctave);
  }

  updateOutputText();
}

function setReferenceApplyMode(value) {
  state.referenceApplyMode = value === "bar" ? "bar" : "beat";

  if (els.referenceApplyModeInput) {
    els.referenceApplyModeInput.value = state.referenceApplyMode;
  }

  updateOutputText();
}


function setChordOptionMode(value) {
  state.chordOptionMode = CHORD_OPTION_SETS[value] ? value : "standard";

  if (els.chordOptionModeInput) {
    els.chordOptionModeInput.value = state.chordOptionMode;
  }

  renderChordGrid();
  updateOutputText();
}

function getDisplaySettings() {
  try {
    return JSON.parse(localStorage.getItem("hummingChordDisplaySettings") || "{}");
  } catch (_) {
    return {};
  }
}

function saveDisplaySettings(settings) {
  try {
    localStorage.setItem("hummingChordDisplaySettings", JSON.stringify(settings));
  } catch (_) {}
}

function setupBlockDisplayControls() {
  setupCollapsibleBlock("uploadBlock");
  setupCollapsibleBlock("analysisBlock");
  setupCollapsibleBlock("chordBlock");
  setupCollapsibleBlock("outputBlock");
}

function setupCollapsibleBlock(blockId) {
  const block = document.getElementById(blockId);
  if (!block || block.dataset.collapsibleReady === "true") return;

  const heading = block.querySelector("h2");
  if (!heading) return;

  const body = document.createElement("div");
  body.className = "block-body";

  const siblings = [];
  let node = heading.nextSibling;
  while (node) {
    siblings.push(node);
    node = node.nextSibling;
  }

  siblings.forEach((child) => body.appendChild(child));
  block.appendChild(body);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "block-toggle";
  button.textContent = "折りたたむ";

  button.addEventListener("click", () => {
    const collapsed = block.classList.toggle("block-collapsed");
    button.textContent = collapsed ? "展開する" : "折りたたむ";
  });

  heading.appendChild(button);
  block.dataset.collapsibleReady = "true";
}

function setDetectedNotes(notes) {
  state.detectedNotes = notes || [];
  els.noteCount.textContent = state.detectedNotes.length;

  if (!state.detectedNotes.length) {
    els.melodyPreview.textContent = "音程を検出できませんでした。鼻歌を少し大きめに、雑音を少なめにして試してください。";
    return;
  }

  const preview = state.detectedNotes
    .slice(0, 60)
    .map((note) => `${note.name}(${note.start.toFixed(1)}s-${note.end.toFixed(1)}s)`)
    .join("  ");

  els.melodyPreview.textContent =
    preview + (state.detectedNotes.length > 60 ? "\n..." : "");
}

function transposeChordName(chordName, semitoneDelta) {
  const parsed = parseChordName(chordName);
  if (!parsed) return chordName;

  const nextPc = (parsed.rootPc + semitoneDelta + 120) % 12;
  return `${NOTE_NAMES[nextPc]}${parsed.quality || ""}`;
}

function shiftBeatChord(barIndex, beatIndex, semitoneDelta) {
  ensureChordBeatGrid();

  if (!state.chordBeats[barIndex]) return;

  const current = state.chordBeats[barIndex][beatIndex] || "C";
  state.chordBeats[barIndex][beatIndex] = transposeChordName(current, semitoneDelta);

  syncBarChordsFromBeats();
  renderChordGrid();
  updateOutputText();
}

function shiftBarChords(barIndex, semitoneDelta) {
  ensureChordBeatGrid();

  if (!state.chordBeats[barIndex]) return;

  state.chordBeats[barIndex] = state.chordBeats[barIndex].map((chord) =>
    transposeChordName(chord, semitoneDelta)
  );

  syncBarChordsFromBeats();
  renderChordGrid();
  updateOutputText();
}

function formatBeatCurrentLabel(chord, octave) {
  return `${chord} / 高さ${octave}`;
}

function formatBarCurrentSummary(beats, octaves) {
  return beats
    .map((chord, index) => `${index + 1}拍:${formatBeatCurrentLabel(chord, octaves[index] ?? state.chordOctave)}`)
    .join("　");
}

function renderChordGrid() {
  ensureChordBeatGrid();
  ensureChordOctaveGrid();
  els.chordGrid.innerHTML = "";

  state.chordBeats.forEach((beats, index) => {
    const octaves = state.chordOctaveBeats[index] || [state.chordOctave, state.chordOctave, state.chordOctave, state.chordOctave];
    const cell = document.createElement("div");
    cell.className = "chord-cell";

    const label = document.createElement("label");
    label.textContent = `${index + 1}小節目`;

    const barCurrentSummary = document.createElement("div");
    barCurrentSummary.className = "bar-current-summary";
    barCurrentSummary.textContent = formatBarCurrentSummary(beats, octaves);

    const barSemitoneTools = document.createElement("div");
    barSemitoneTools.className = "bar-semitone-tools";

    const barDownButton = document.createElement("button");
    barDownButton.type = "button";
    barDownButton.textContent = "小節 −1音";
    barDownButton.addEventListener("click", () => shiftBarChords(index, -1));

    const barUpButton = document.createElement("button");
    barUpButton.type = "button";
    barUpButton.textContent = "小節 ＋1音";
    barUpButton.addEventListener("click", () => shiftBarChords(index, 1));

    barSemitoneTools.appendChild(barDownButton);
    barSemitoneTools.appendChild(barUpButton);

    const candidateNames = (state.barCandidates[index] || []).map((item) => item.name);
    const beatCandidateNames = (state.beatCandidates[index] || [])
      .flat()
      .map((item) => item?.name)
      .filter(Boolean);
    const mergedOptions = uniqueArray([...candidateNames, ...beatCandidateNames, ...getChordOptions(), ...beats]);
    const barChord = getUniformChord(beats);

    const barWrap = document.createElement("div");
    barWrap.className = "bar-select-wrap";

    const barCaption = document.createElement("span");
    barCaption.textContent = "小節全体に反映";

    const barSelect = document.createElement("select");
    if (!barChord) {
      const mixed = document.createElement("option");
      mixed.value = "";
      mixed.textContent = "拍ごとに設定中";
      mixed.selected = true;
      barSelect.appendChild(mixed);
    }

    mergedOptions.forEach((option) => {
      if (!option) return;
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      if (option === barChord) opt.selected = true;
      barSelect.appendChild(opt);
    });

    barSelect.addEventListener("change", () => {
      if (!barSelect.value) return;
      state.chordBeats[index] = [barSelect.value, barSelect.value, barSelect.value, barSelect.value];
      syncBarChordsFromBeats();
      renderChordGrid();
      updateOutputText();
    });

    barWrap.appendChild(barCaption);
    barWrap.appendChild(barSelect);

    const barOctaveWrap = document.createElement("div");
    barOctaveWrap.className = "bar-octave-wrap";

    const barOctaveCaption = document.createElement("span");
    barOctaveCaption.textContent = "小節全体の高さに反映";

    const barOctaveSelect = document.createElement("select");
    const uniformOctave = getUniformOctave(octaves);

    if (!uniformOctave) {
      const mixed = document.createElement("option");
      mixed.value = "";
      mixed.textContent = "拍ごとに設定中";
      mixed.selected = true;
      barOctaveSelect.appendChild(mixed);
    }

    [2, 3, 4, 5].forEach((octave) => {
      const opt = document.createElement("option");
      opt.value = String(octave);
      opt.textContent = `オクターブ ${octave}`;
      if (octave === uniformOctave) opt.selected = true;
      barOctaveSelect.appendChild(opt);
    });

    barOctaveSelect.addEventListener("change", () => {
      if (!barOctaveSelect.value) return;
      const octave = clampOctave(barOctaveSelect.value);
      state.chordOctaveBeats[index] = [octave, octave, octave, octave];
      renderChordGrid();
      updateOutputText();
    });

    barOctaveWrap.appendChild(barOctaveCaption);
    barOctaveWrap.appendChild(barOctaveSelect);

    const beatGrid = document.createElement("div");
    beatGrid.className = "beat-grid";

    beats.forEach((beatChord, beatIndex) => {
      const beatCell = document.createElement("div");
      beatCell.className = "beat-cell";
      beatCell.dataset.barIndex = String(index);
      beatCell.dataset.beatIndex = String(beatIndex);

      const beatLabel = document.createElement("span");
      beatLabel.textContent = `${beatIndex + 1}拍`;

      const beatSelect = document.createElement("select");
      mergedOptions.forEach((option) => {
        if (!option) return;
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        if (option === beatChord) opt.selected = true;
        beatSelect.appendChild(opt);
      });

      beatSelect.addEventListener("change", () => {
        state.chordBeats[index][beatIndex] = beatSelect.value;
        syncBarChordsFromBeats();
        renderChordGrid();
        updateOutputText();
      });

      const beatOctaveSelect = document.createElement("select");
      beatOctaveSelect.className = "beat-octave-select";

      [2, 3, 4, 5].forEach((octave) => {
        const opt = document.createElement("option");
        opt.value = String(octave);
        opt.textContent = `高さ${octave}`;
        if (octave === clampOctave(octaves[beatIndex])) opt.selected = true;
        beatOctaveSelect.appendChild(opt);
      });

      beatOctaveSelect.addEventListener("change", () => {
        ensureChordOctaveGrid();
        state.chordOctaveBeats[index][beatIndex] = clampOctave(beatOctaveSelect.value);
        renderChordGrid();
        updateOutputText();
      });

      const currentDisplay = document.createElement("div");
      currentDisplay.className = "beat-current";

      const upButton = document.createElement("button");
      upButton.type = "button";
      upButton.className = "beat-shift-button";
      upButton.textContent = "＋";
      upButton.title = "この拍のコードを＋1音";
      upButton.addEventListener("click", () => shiftBeatChord(index, beatIndex, 1));

      const currentCenter = document.createElement("div");
      currentCenter.className = "beat-current-center";

      const currentCode = document.createElement("span");
      currentCode.className = "code";
      currentCode.textContent = beatChord;

      const currentOctave = document.createElement("span");
      currentOctave.className = "octave";
      currentOctave.textContent = `高さ${clampOctave(octaves[beatIndex])}`;

      currentCenter.appendChild(currentCode);
      currentCenter.appendChild(currentOctave);

      const downButton = document.createElement("button");
      downButton.type = "button";
      downButton.className = "beat-shift-button";
      downButton.textContent = "−";
      downButton.title = "この拍のコードを−1音";
      downButton.addEventListener("click", () => shiftBeatChord(index, beatIndex, -1));

      currentDisplay.appendChild(upButton);
      currentDisplay.appendChild(currentCenter);
      currentDisplay.appendChild(downButton);

      beatCell.appendChild(beatLabel);
      beatCell.appendChild(currentDisplay);
      beatCell.appendChild(beatSelect);
      beatCell.appendChild(beatOctaveSelect);
      beatGrid.appendChild(beatCell);
    });

    cell.appendChild(label);
    cell.appendChild(barCurrentSummary);
    cell.appendChild(barSemitoneTools);
    cell.appendChild(barWrap);
    cell.appendChild(barOctaveWrap);
    cell.appendChild(beatGrid);
    els.chordGrid.appendChild(cell);
  });

  updateOutputText();
}

function ensureChordBeatGrid() {
  if (!Array.isArray(state.chordBeats)) state.chordBeats = [];

  if (state.chordBeats.length !== state.chords.length) {
    state.chordBeats = createBeatGridFromChords(state.chords);
  }

  state.chordBeats = state.chordBeats.map((beats, index) => {
    const fallback = state.chords[index] || "C";
    const normalized = Array.isArray(beats) ? beats.slice(0, 4) : [];
    while (normalized.length < 4) normalized.push(fallback);
    return normalized.map((chord) => chord || fallback);
  });
}

function createBeatGridFromChords(chords) {
  return chords.map((chord) => [chord, chord, chord, chord]);
}

function createOctaveGridFromChords(chords, octave = state.chordOctave) {
  return chords.map(() => [octave, octave, octave, octave]);
}

function clampOctave(value) {
  const octave = Number(value);
  return Number.isFinite(octave)
    ? Math.max(1, Math.min(6, Math.round(octave)))
    : state.chordOctave;
}

function ensureChordOctaveGrid() {
  ensureChordBeatGrid();

  if (!Array.isArray(state.chordOctaveBeats)) state.chordOctaveBeats = [];

  while (state.chordOctaveBeats.length < state.chordBeats.length) {
    state.chordOctaveBeats.push([state.chordOctave, state.chordOctave, state.chordOctave, state.chordOctave]);
  }

  if (state.chordOctaveBeats.length > state.chordBeats.length) {
    state.chordOctaveBeats = state.chordOctaveBeats.slice(0, state.chordBeats.length);
  }

  state.chordOctaveBeats = state.chordOctaveBeats.map((octaves) => {
    const normalized = Array.isArray(octaves) ? octaves.slice(0, 4) : [];
    while (normalized.length < 4) normalized.push(state.chordOctave);
    return normalized.map(clampOctave);
  });
}

function getUniformOctave(octaves) {
  if (!octaves || !octaves.length) return null;
  return octaves.every((octave) => octave === octaves[0]) ? octaves[0] : null;
}

function formatOctaveGridRows() {
  ensureChordOctaveGrid();
  return state.chordOctaveBeats
    .map((octaves, index) => `${index + 1}小節目: ${octaves.map((octave) => `[${octave}]`).join(" ")}`)
    .join("\n");
}

function normalizeBeatGridForReference(beatGrid, referenceChords = []) {
  const source = Array.isArray(beatGrid) && beatGrid.length
    ? beatGrid
    : createBeatGridFromChords(referenceChords.length ? referenceChords : ["C", "G", "Am", "F"]);

  return source.map((beats, index) => {
    const fallback = referenceChords[index] || beats?.[0] || "C";
    const normalized = Array.isArray(beats) ? beats.slice(0, 4) : [];
    while (normalized.length < 4) normalized.push(fallback);
    return normalized.map((chord) => chord || fallback);
  });
}

function normalizeOctaveGridForReference(octaveGrid, beatGrid) {
  const source = Array.isArray(octaveGrid) && octaveGrid.length
    ? octaveGrid
    : createOctaveGridFromChords(beatGrid.length ? beatGrid : ["C", "G", "Am", "F"], state.chordOctave);

  return source.map((octaves, index) => {
    const normalized = Array.isArray(octaves) ? octaves.slice(0, 4) : [];
    while (normalized.length < 4) normalized.push(state.chordOctave);
    return normalized.map(clampOctave);
  });
}

function dominantMidiForWindow(notes, start, end) {
  const weights = new Map();

  notes.forEach((note) => {
    const overlap = Math.max(0, Math.min(note.end, end) - Math.max(note.start, start));
    if (overlap <= 0) return;

    const weight = overlap * Math.max(0.2, note.confidence || 0.5);
    weights.set(note.midi, (weights.get(note.midi) || 0) + weight);
  });

  let bestMidi = null;
  let bestWeight = 0;

  weights.forEach((weight, midi) => {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestMidi = midi;
    }
  });

  return bestMidi;
}

function inferChordOctaveForMelody(chordName, melodyMidi, fallbackOctave = state.chordOctave) {
  if (melodyMidi === null || melodyMidi === undefined) return clampOctave(fallbackOctave);

  let best = {
    octave: clampOctave(fallbackOctave),
    score: Number.POSITIVE_INFINITY
  };

  [2, 3, 4, 5].forEach((octave) => {
    const chordNotes = getChordMidiNotes(chordName, octave);
    const closestDistance = Math.min(...chordNotes.map((note) => Math.abs(note - melodyMidi)));
    const rootDistance = Math.abs(chordNotes[0] - melodyMidi);

    // メロディ音に近い構成音がある高さを優先。
    // 同点の場合は、ルートがメロディより少し下に来る高さを選びやすくする。
    const rootAbovePenalty = chordNotes[0] > melodyMidi ? 1.2 : 0;
    const tooLowPenalty = melodyMidi - chordNotes[0] > 18 ? 0.8 : 0;
    const score = closestDistance * 3 + rootDistance * 0.2 + rootAbovePenalty + tooLowPenalty;

    if (score < best.score) {
      best = { octave, score };
    }
  });

  return best.octave;
}

function summarizeBeatGrid(beatGrid) {
  return beatGrid.map((beats) => getUniformChord(beats) || beats[0] || "C");
}

function applyReferenceChords(chordAnalysis) {
  const fallbackChords = ["C", "G", "Am", "F"];
  const referenceChords = Array.isArray(chordAnalysis?.chords) && chordAnalysis.chords.length
    ? chordAnalysis.chords
    : fallbackChords;

  const rawBeatReferenceChords = Array.isArray(chordAnalysis?.beatChords) && chordAnalysis.beatChords.length
    ? chordAnalysis.beatChords
    : createBeatGridFromChords(referenceChords);

  state.referenceChords = [...referenceChords];
  state.beatReferenceChords = normalizeBeatGridForReference(rawBeatReferenceChords, referenceChords);

  const rawBeatReferenceOctaves = Array.isArray(chordAnalysis?.beatOctaves) && chordAnalysis.beatOctaves.length
    ? chordAnalysis.beatOctaves
    : createOctaveGridFromChords(state.beatReferenceChords, state.chordOctave);

  state.beatReferenceOctaves = normalizeOctaveGridForReference(rawBeatReferenceOctaves, state.beatReferenceChords);

  if (state.referenceApplyMode === "bar") {
    state.chordBeats = createBeatGridFromChords(state.referenceChords);
    state.chordOctaveBeats = normalizeOctaveGridForReference(state.beatReferenceOctaves, state.chordBeats);
  } else {
    // 抽出した参考コードを、下の4拍マスへそのまま個別反映する
    state.chordBeats = state.beatReferenceChords.map((beats) => beats.slice(0, 4));
    // v0.9.5: コードだけでなく、各拍の高さも自動初期反映する
    state.chordOctaveBeats = state.beatReferenceOctaves.map((octaves) => octaves.slice(0, 4));
  }

  // v0.9.2 fix:
  // ここで先に state.chords を4拍マス由来で更新しておく。
  // これをしないと ensureChordBeatGrid() が古い初期コード数を見て、
  // chordBeats を C/G/Am/F... の初期値に戻してしまう。
  state.chords = summarizeBeatGrid(state.chordBeats);

  state.barCandidates = Array.isArray(chordAnalysis?.barCandidates)
    ? chordAnalysis.barCandidates
    : state.chords.map((name) => [{ name, score: 0 }]);
  state.beatCandidates = Array.isArray(chordAnalysis?.beatCandidates)
    ? chordAnalysis.beatCandidates
    : [];

  updateReferenceChordPreview();
}

function updateReferenceChordPreview() {
  if (!els.referenceChordPreview) return;

  if (!state.beatReferenceChords || !state.beatReferenceChords.length) {
    els.referenceChordPreview.textContent = "鼻歌を解析すると、ここに参考コードが表示されます。";
    return;
  }

  els.referenceChordPreview.textContent = formatBeatReferenceRows(state.beatReferenceChords);
}

function formatBeatReferenceRows(beatGrid) {
  const octaveGrid = state.beatReferenceOctaves || [];

  return beatGrid
    .map((beats, index) => {
      const octaves = octaveGrid[index] || [];
      return `${index + 1}小節目: ${beats
        .map((chord, beatIndex) => {
          const octave = octaves[beatIndex];
          return octave ? `[${chord} 高さ${octave}]` : `[${chord}]`;
        })
        .join(" ")}`;
    })
    .join("\n");
}

function syncBarChordsFromBeats() {
  if (!Array.isArray(state.chordBeats)) state.chordBeats = [];
  state.chords = state.chordBeats.map((beats) => {
    const normalized = Array.isArray(beats) ? beats.slice(0, 4) : ["C", "C", "C", "C"];
    while (normalized.length < 4) normalized.push(normalized[0] || "C");
    return getUniformChord(normalized) || normalized[0] || "C";
  });
  ensureChordBeatGrid();
}

function getUniformChord(beats) {
  if (!beats || !beats.length) return null;
  return beats.every((chord) => chord === beats[0]) ? beats[0] : null;
}

function formatBeatGridRows() {
  ensureChordBeatGrid();
  return state.chordBeats
    .map((beats, index) => `${index + 1}小節目: ${beats.map((chord) => `[${chord}]`).join(" ")}`)
    .join("\n");
}

function formatBeatGridCompactRows() {
  ensureChordBeatGrid();
  return state.chordBeats
    .map((beats) => `| ${beats.join(" | ")} |`)
    .join("\n");
}

function getBarSummaryText() {
  ensureChordBeatGrid();
  return state.chordBeats
    .map((beats) => {
      const uniform = getUniformChord(beats);
      return uniform || beats.join("/");
    });
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatChordRows(chords, perRow = 4) {
  const rows = [];
  for (let i = 0; i < chords.length; i += perRow) {
    rows.push(`| ${chords.slice(i, i + perRow).join(" | ")} |`);
  }
  return rows.join("\n");
}

function midiToSolfegeName(midi, withOctave = true) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return withOctave ? `${SOLFEGE_NAMES[pc]}${octave}` : SOLFEGE_NAMES[pc];
}

function chordNameToSolfege(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return chordName;

  let suffix = parsed.quality;
  if (suffix === "m") suffix = "m";
  if (suffix === "dim") suffix = "dim";
  if (suffix === "maj7") suffix = "maj7";
  if (suffix === "m7") suffix = "m7";
  if (suffix === "7") suffix = "7";
  if (suffix === "dim7") suffix = "dim7";

  return `${SOLFEGE_NAMES[parsed.rootPc]}${suffix}`;
}

function formatSolfegeChordRows() {
  ensureChordBeatGrid();
  ensureChordOctaveGrid();

  const rows = [];

  rows.push("ドレミ表記（コード名）");
  state.chordBeats.forEach((beats, barIndex) => {
    const line = beats
      .map((chord, beatIndex) => {
        const octave = state.chordOctaveBeats[barIndex]?.[beatIndex] ?? state.chordOctave;
        return `[${chordNameToSolfege(chord)} 高さ${octave}]`;
      })
      .join(" ");
    rows.push(`${barIndex + 1}小節目: ${line}`);
  });

  rows.push("");
  rows.push("ドレミ表記（実際に鳴る構成音）");
  state.chordBeats.forEach((beats, barIndex) => {
    const beatTexts = beats.map((chord, beatIndex) => {
      const octave = state.chordOctaveBeats[barIndex]?.[beatIndex] ?? state.chordOctave;
      const notes = getChordMidiNotes(chord, octave).map((midi) => midiToSolfegeName(midi, true));
      return `${beatIndex + 1}拍:${notes.join("/")}`;
    });
    rows.push(`${barIndex + 1}小節目: ${beatTexts.join("  ")}`);
  });

  return rows.join("\n");
}

function updateSolfegeOutputText() {
  if (!els.solfegeOutputText) return;
  els.solfegeOutputText.value = formatSolfegeChordRows();
}

function updateOutputText() {
  ensureChordBeatGrid();
  ensureChordOctaveGrid();
  els.keyLabel.textContent = state.key;
  els.outputText.value = [
    `Estimated BPM: ${state.estimatedBpm ?? "not detected"}`,
    `Playback BPM: ${state.playbackBpm}`,
    `Chord Octave: ${state.chordOctave}`,
    `Reference Apply Mode: ${state.referenceApplyMode}`,
    `Chord Option Mode: ${state.chordOptionMode}`,
    `Key: ${state.key}`,
    `Detected Notes: ${state.detectedNotes.length}`,
    "",
    "Bar Summary:",
    formatChordRows(getBarSummaryText()),
    "",
    "Beat Grid:",
    formatBeatGridRows(),
    "",
    "Octave Grid:",
    formatOctaveGridRows()
  ].join("\n");

  updateSolfegeOutputText();
}

async function getAudioContext() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === "suspended") {
    await state.audioCtx.resume();
  }
  return state.audioCtx;
}

async function handleAudioBlob(blob, label) {
  state.audioBlob = blob;
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
  els.audioPreview.src = state.audioUrl;
  els.audioPreview.hidden = false;
  els.audioStatus.textContent = `${label}を読み込みました。解析中です...`;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = await getAudioContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

    els.audioStatus.textContent = "音程・BPM・キーを解析中です。音声が長い場合は少し時間がかかります。";
    await waitFrame();

    const result = analyzeHumming(decoded);
    state.audioDuration = decoded.duration;

    setEstimatedBpm(result.estimatedBpm);
    setPlaybackBpm(result.estimatedBpm || state.playbackBpm);

    state.key = result.keyLabel;
    state.keyInfo = result.keyInfo;
    setDetectedNotes(result.notes);

    const chordAnalysis = generateChordAnalysis(
      state.detectedNotes,
      state.keyInfo,
      state.playbackBpm,
      state.audioDuration
    );
    applyReferenceChords(chordAnalysis);

    renderChordGrid();
    updateOutputText();

    els.audioStatus.textContent = `${label}を解析しました。コードは候補なので、再生して確認してください。`;
  } catch (error) {
    console.error(error);
    els.audioStatus.textContent = "音声解析に失敗しました。別形式の音声で試してください。";
  }
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * v0.2 解析エンジン
 * - 音声を軽くダウンサンプリング
 * - YIN系の簡易ピッチ検出
 * - 検出音からBPM・キーを推定
 * - コード生成は generateChordProgression() に分離
 *
 * 将来的にBasic Pitch等を接続する場合は、
 * notes: [{ midi, name, pc, start, end, duration }] の形に合わせれば置き換え可能です。
 */
function analyzeHumming(audioBuffer) {
  // v0.11:
  // 現時点では簡易解析を使います。
  // v0.12以降でBasic Pitch結果が返るようになったら、ここで差し替えます。
  // analyzeWithBasicPitchIfAvailable は将来の非同期実装用の準備枠です。
  const mono = mixToMono(audioBuffer);
  const targetSampleRate = Math.min(11025, audioBuffer.sampleRate);
  const data = downsample(mono, audioBuffer.sampleRate, targetSampleRate);
  const pitchFrames = detectPitchFrames(data, targetSampleRate);
  const notes = buildNoteEvents(pitchFrames);
  const estimatedBpm = estimateBpmFromNotes(notes);
  const keyInfo = estimateKey(notes);
  const keyLabel = keyInfo ? `${NOTE_NAMES[keyInfo.tonic]} ${keyInfo.mode}` : "--";

  return {
    estimatedBpm,
    keyLabel,
    keyInfo,
    notes
  };
}

function mixToMono(audioBuffer) {
  const length = audioBuffer.length;
  const channels = audioBuffer.numberOfChannels;
  const mono = new Float32Array(length);

  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / channels;
    }
  }

  return mono;
}

function downsample(data, originalRate, targetRate) {
  if (originalRate <= targetRate) return data;

  const ratio = originalRate / targetRate;
  const newLength = Math.floor(data.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), data.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    result[i] = sum / Math.max(1, end - start);
  }

  return result;
}

function detectPitchFrames(data, sampleRate) {
  const maxSeconds = 75;
  const maxSamples = Math.min(data.length, Math.floor(maxSeconds * sampleRate));
  const frameSize = 2048;
  const hopSize = 1024;
  const minFreq = 70;
  const maxFreq = 900;
  const minTau = Math.floor(sampleRate / maxFreq);
  const maxTau = Math.floor(sampleRate / minFreq);
  const frames = [];

  const globalRms = calculateRms(data.subarray(0, maxSamples));
  const rmsThreshold = Math.max(0.006, globalRms * 0.28);

  for (let start = 0; start + frameSize < maxSamples; start += hopSize) {
    const frame = data.subarray(start, start + frameSize);
    const rms = calculateRms(frame);
    const time = start / sampleRate;

    if (rms < rmsThreshold) {
      frames.push({ time, freq: null, midi: null, confidence: 0, rms });
      continue;
    }

    const result = yinPitch(frame, sampleRate, minTau, maxTau);
    if (!result || result.confidence < 0.55) {
      frames.push({ time, freq: null, midi: null, confidence: 0, rms });
      continue;
    }

    const midi = Math.round(freqToMidi(result.freq));
    if (midi < 36 || midi > 88) {
      frames.push({ time, freq: null, midi: null, confidence: 0, rms });
      continue;
    }

    frames.push({
      time,
      freq: result.freq,
      midi,
      confidence: result.confidence,
      rms
    });
  }

  return frames;
}

function calculateRms(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i] * frame[i];
  }
  return Math.sqrt(sum / Math.max(1, frame.length));
}

function yinPitch(frame, sampleRate, minTau, maxTau) {
  const threshold = 0.16;
  const diff = new Float32Array(maxTau + 1);
  const cmnd = new Float32Array(maxTau + 1);

  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    const limit = frame.length - tau;
    for (let i = 0; i < limit; i++) {
      const delta = frame[i] - frame[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = diff[tau] * tau / Math.max(runningSum, 1e-9);
  }

  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) {
    let bestTau = minTau;
    let bestValue = cmnd[minTau];
    for (let tau = minTau + 1; tau <= maxTau; tau++) {
      if (cmnd[tau] < bestValue) {
        bestValue = cmnd[tau];
        bestTau = tau;
      }
    }
    if (bestValue > 0.32) return null;
    tauEstimate = bestTau;
  }

  const betterTau = parabolicInterpolate(cmnd, tauEstimate);
  const freq = sampleRate / betterTau;
  const confidence = 1 - cmnd[tauEstimate];

  return { freq, confidence };
}

function parabolicInterpolate(values, index) {
  if (index <= 0 || index >= values.length - 1) return index;

  const left = values[index - 1];
  const center = values[index];
  const right = values[index + 1];
  const divisor = left - 2 * center + right;

  if (Math.abs(divisor) < 1e-9) return index;

  return index + 0.5 * (left - right) / divisor;
}

function buildNoteEvents(frames) {
  const notes = [];
  let current = null;
  const hopSeconds = frames.length >= 2 ? frames[1].time - frames[0].time : 0.09;

  for (const frame of frames) {
    if (frame.midi === null) {
      if (current) {
        finishCurrentNote(current, notes);
        current = null;
      }
      continue;
    }

    if (!current) {
      current = createNoteAccumulator(frame, hopSeconds);
      continue;
    }

    const currentMidi = Math.round(current.weightedMidi / current.weight);
    const sameNote = Math.abs(frame.midi - currentMidi) <= 1;
    const closeInTime = frame.time - current.lastTime <= hopSeconds * 2.2;

    if (sameNote && closeInTime) {
      current.end = frame.time + hopSeconds;
      current.lastTime = frame.time;
      current.weightedMidi += frame.midi * Math.max(frame.rms, 0.001);
      current.weight += Math.max(frame.rms, 0.001);
      current.confidence += frame.confidence;
      current.frameCount += 1;
    } else {
      finishCurrentNote(current, notes);
      current = createNoteAccumulator(frame, hopSeconds);
    }
  }

  if (current) finishCurrentNote(current, notes);

  return notes.filter((note) => note.duration >= 0.12);
}

function createNoteAccumulator(frame, hopSeconds) {
  const weight = Math.max(frame.rms, 0.001);
  return {
    start: frame.time,
    end: frame.time + hopSeconds,
    lastTime: frame.time,
    weightedMidi: frame.midi * weight,
    weight,
    confidence: frame.confidence,
    frameCount: 1
  };
}

function finishCurrentNote(current, notes) {
  const midi = Math.round(current.weightedMidi / current.weight);
  const pc = ((midi % 12) + 12) % 12;
  const duration = current.end - current.start;

  notes.push({
    midi,
    pc,
    name: midiToNoteName(midi),
    start: current.start,
    end: current.end,
    duration,
    confidence: current.confidence / Math.max(1, current.frameCount)
  });
}

function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

function midiToNoteName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

function estimateBpmFromNotes(notes) {
  if (!notes || notes.length < 3) return null;

  const intervals = [];
  for (let i = 1; i < notes.length; i++) {
    const diff = notes[i].start - notes[i - 1].start;
    if (diff >= 0.22 && diff <= 2.2) intervals.push(diff);
  }

  if (intervals.length < 2) return null;

  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  let bpm = 60 / medianInterval;

  while (bpm < 65) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  return Math.round(bpm);
}

function estimateKey(notes) {
  if (!notes || notes.length < 2) return null;

  const weights = new Array(12).fill(0);
  notes.forEach((note) => {
    weights[note.pc] += Math.max(0.08, note.duration) * Math.max(0.2, note.confidence);
  });

  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  let best = null;

  for (let tonic = 0; tonic < 12; tonic++) {
    const majorScore = scoreKey(weights, majorProfile, tonic);
    const minorScore = scoreKey(weights, minorProfile, tonic);

    if (!best || majorScore > best.score) {
      best = { tonic, mode: "major", score: majorScore };
    }

    if (!best || minorScore > best.score) {
      best = { tonic, mode: "minor", score: minorScore };
    }
  }

  return best;
}

function scoreKey(weights, profile, tonic) {
  let score = 0;
  for (let pc = 0; pc < 12; pc++) {
    const profileIndex = (pc - tonic + 12) % 12;
    score += weights[pc] * profile[profileIndex];
  }
  return score;
}

function buildAllChordCandidates() {
  const candidates = [];

  NOTE_NAMES.forEach((rootName, rootPc) => {
    candidates.push(makeChordCandidate(rootPc, "", null, "chromatic"));
    candidates.push(makeChordCandidate(rootPc, "m", null, "chromatic"));
  });

  // 必要以上にdimが増えると不安定になりやすいので、dimは既存のダイアトニック候補中心に残す
  return candidates;
}

function mergeChordCandidates(primaryCandidates, secondaryCandidates) {
  const seen = new Set();
  const result = [];

  [...primaryCandidates, ...secondaryCandidates].forEach((candidate) => {
    if (!candidate || !candidate.name || seen.has(candidate.name)) return;
    seen.add(candidate.name);
    result.push(candidate);
  });

  return result;
}

function dominantPitchClass(weights) {
  if (!weights || !weights.length) return null;

  let bestPc = null;
  let bestWeight = 0;

  weights.forEach((weight, pc) => {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestPc = pc;
    }
  });

  return bestWeight > 0 ? bestPc : null;
}

function chordContainsPitch(candidate, pc) {
  return candidate?.tones?.includes(pc);
}

function generateChordProgression(notes, keyInfo, bpm, duration) {
  return generateChordAnalysis(notes, keyInfo, bpm, duration).chords;
}

function generateChordAnalysis(notes, keyInfo, bpm, duration) {
  if (!keyInfo || !notes || !notes.length) {
    const fallbackChords = ["C", "G", "Am", "F", "C", "G", "F", "C"];
    return {
      chords: fallbackChords,
      beatChords: createBeatGridFromChords(fallbackChords),
      beatOctaves: createOctaveGridFromChords(fallbackChords, state.chordOctave),
      barCandidates: fallbackChords.map((name) => [{ name, score: 0 }]),
      beatCandidates: fallbackChords.map((name) => [
        [{ name, score: 0 }],
        [{ name, score: 0 }],
        [{ name, score: 0 }],
        [{ name, score: 0 }]
      ])
    };
  }

  const bpmValue = clampBpm(bpm);
  const beatSeconds = 60 / bpmValue;
  const barSeconds = beatSeconds * 4;
  const lastNoteEnd = notes.length ? notes[notes.length - 1].end : 0;
  const rawBarCount = Math.ceil(Math.max(duration || 0, lastNoteEnd || 0) / barSeconds);
  const barCount = Math.max(4, Math.min(16, rawBarCount || 8));

  const diatonicCandidates = buildDiatonicChordCandidates(keyInfo);
  const chromaticCandidates = buildAllChordCandidates();
  const candidates = mergeChordCandidates(diatonicCandidates, chromaticCandidates);
  const fallback = buildFallbackProgression(diatonicCandidates, keyInfo.mode);

  const barLevelChords = [];
  const beatChords = [];
  const barCandidates = [];
  const beatCandidates = [];
  const beatOctaves = [];

  let previousBeatChord = null;

  for (let barIndex = 0; barIndex < barCount; barIndex++) {
    const barStart = barIndex * barSeconds;
    const barEnd = barStart + barSeconds;
    const barWeights = pitchWeightsForWindow(notes, barStart, barEnd);

    const scoredForBar = scoreCandidatesForWindow(candidates, barWeights, barIndex, barCount);
    const fallbackName = fallback[barIndex % fallback.length] || candidates[0]?.name || "C";
    const hasBarSignal = scoredForBar.length && scoredForBar[0].score > 0.01;
    const selectedBarName = hasBarSignal ? scoredForBar[0].name : fallbackName;

    barLevelChords.push(selectedBarName);
    barCandidates.push(
      hasBarSignal
        ? scoredForBar.slice(0, 5)
        : uniqueCandidateObjects([{ name: fallbackName, score: 0 }, ...scoredForBar.slice(0, 4)])
    );

    const beatsForBar = [];
    const octavesForBar = [];
    const candidatesForBar = [];

    for (let beatIndex = 0; beatIndex < 4; beatIndex++) {
      const beatStart = barStart + beatIndex * beatSeconds;
      const beatEnd = beatStart + beatSeconds;
      const beatWeights = pitchWeightsForWindow(notes, beatStart, beatEnd);

      const scoredForBeat = scoreCandidatesForWindow(
        candidates,
        beatWeights,
        barIndex,
        barCount,
        beatIndex
      );

      const hasBeatSignal = scoredForBeat.length && scoredForBeat[0].score > 0.01;
      const fallbackForBeat = previousBeatChord || selectedBarName || fallbackName;
      const selectedBeatName = hasBeatSignal ? scoredForBeat[0].name : fallbackForBeat;

      const topBeatCandidates = hasBeatSignal
        ? scoredForBeat.slice(0, 5)
        : uniqueCandidateObjects([{ name: fallbackForBeat, score: 0 }, ...scoredForBeat.slice(0, 4)]);

      const melodyMidi = dominantMidiForWindow(notes, beatStart, beatEnd);
      const selectedOctave = inferChordOctaveForMelody(selectedBeatName, melodyMidi, state.chordOctave);

      beatsForBar.push(selectedBeatName);
      octavesForBar.push(selectedOctave);
      candidatesForBar.push(topBeatCandidates);
      previousBeatChord = selectedBeatName;
    }

    beatChords.push(beatsForBar);
    beatOctaves.push(octavesForBar);
    beatCandidates.push(candidatesForBar);
  }

  const smoothedBeatChords = smoothBeatGrid(beatChords, barLevelChords);
  const smoothedBeatOctaves = normalizeOctaveGridForReference(beatOctaves, smoothedBeatChords);
  const barSummaries = smoothedBeatChords.map((beats, index) => {
    const uniform = getUniformChord(beats);
    return uniform || beats[0] || barLevelChords[index] || fallback[index % fallback.length] || "C";
  });

  return {
    chords: barSummaries,
    beatChords: smoothedBeatChords,
    beatOctaves: smoothedBeatOctaves,
    barCandidates,
    beatCandidates
  };
}

function scoreCandidatesForWindow(candidates, weights, barIndex, barCount, beatIndex = null) {
  const melodyPc = dominantPitchClass(weights);

  return candidates
    .map((candidate) => ({
      name: candidate.name,
      score: scoreChordCandidate(candidate, weights, barIndex, barCount, beatIndex, melodyPc),
      degree: candidate.degree,
      source: candidate.source
    }))
    .sort((a, b) => b.score - a.score);
}

function smoothBeatGrid(beatGrid, barLevelChords) {
  // v0.9.1:
  // 「1拍ごとに4拍マスへ入れる」仕様を優先するため、
  // 孤立した1拍のコード変化も勝手に潰さず、そのまま初期反映する。
  return beatGrid.map((beats, index) => {
    const fallback = barLevelChords[index] || beats?.[0] || "C";
    const normalized = Array.isArray(beats) ? beats.slice(0, 4) : [];
    while (normalized.length < 4) normalized.push(fallback);
    return normalized.map((chord) => chord || fallback);
  });
}

function buildDiatonicChordCandidates(keyInfo) {
  const tonic = keyInfo.tonic;

  if (keyInfo.mode === "minor") {
    const offsets = [0, 2, 3, 5, 7, 8, 10];
    const qualities = ["m", "dim", "", "m", "m", "", ""];
    const degrees = [1, 2, 3, 4, 5, 6, 7];
    return offsets.map((offset, index) => makeChordCandidate((tonic + offset) % 12, qualities[index], degrees[index]));
  }

  const offsets = [0, 2, 4, 5, 7, 9, 11];
  const qualities = ["", "m", "m", "", "", "m", "dim"];
  const degrees = [1, 2, 3, 4, 5, 6, 7];
  return offsets.map((offset, index) => makeChordCandidate((tonic + offset) % 12, qualities[index], degrees[index]));
}

function makeChordCandidate(rootPc, quality, degree = null, source = "diatonic") {
  const tones = getChordTones(rootPc, quality);
  return {
    name: `${NOTE_NAMES[rootPc]}${quality}`,
    rootPc,
    quality,
    degree,
    source,
    tones
  };
}

function getChordTones(rootPc, quality) {
  if (quality === "m") return [rootPc, (rootPc + 3) % 12, (rootPc + 7) % 12];
  if (quality === "dim") return [rootPc, (rootPc + 3) % 12, (rootPc + 6) % 12];
  return [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12];
}

function buildFallbackProgression(candidates, mode) {
  const byDegree = Object.fromEntries(candidates.map((c) => [c.degree, c.name]));

  if (mode === "minor") {
    return [byDegree[1], byDegree[6], byDegree[3], byDegree[7]].filter(Boolean);
  }

  return [byDegree[1], byDegree[5], byDegree[6], byDegree[4]].filter(Boolean);
}

function pitchWeightsForWindow(notes, start, end) {
  const weights = new Array(12).fill(0);

  notes.forEach((note) => {
    const overlap = Math.max(0, Math.min(note.end, end) - Math.max(note.start, start));
    if (overlap > 0) {
      weights[note.pc] += overlap * Math.max(0.2, note.confidence);
    }
  });

  return weights;
}

function scoreChordCandidate(candidate, weights, barIndex, barCount, beatIndex = null, melodyPc = null) {
  let score = 0;
  const toneSet = new Set(candidate.tones);

  for (let pc = 0; pc < 12; pc++) {
    const weight = weights[pc];
    if (!weight) continue;

    if (pc === candidate.rootPc) score += weight * 3.0;
    else if (toneSet.has(pc)) score += weight * 2.7;
    else score -= weight * 0.75;
  }

  // v0.9.3:
  // 拍単位の参考コードでは、検出された主メロディ音を含むコードを強く優先する。
  // これにより D3 が出ている拍で、D/Dm/G/Bb など「Dを含むコード」が選ばれやすくなる。
  if (melodyPc !== null) {
    if (chordContainsPitch(candidate, melodyPc)) {
      score += beatIndex === null ? 1.2 : 2.8;

      if (candidate.rootPc === melodyPc) {
        score += beatIndex === null ? 0.45 : 1.0;
      }
    } else {
      score -= beatIndex === null ? 0.7 : 1.8;
    }
  }

  // ダイアトニックコードは自然さとして少しだけ優遇。
  // ただし、拍単位ではメロディ音優先にしたいので補正は控えめ。
  if (candidate.source === "diatonic") {
    score += beatIndex === null ? 0.35 : 0.15;
  }

  // 進行として自然になりやすいコードに少しだけ補正
  if ([1, 4, 5, 6].includes(candidate.degree)) score += beatIndex === null ? 0.3 : 0.12;
  if (barIndex === 0 && candidate.degree === 1) score += beatIndex === null ? 0.8 : 0.25;
  if (barIndex === barCount - 1 && [1, 5].includes(candidate.degree)) score += beatIndex === null ? 0.8 : 0.25;

  // 拍単位では強拍にI/IV/V/VIが来やすいよう軽く補正
  if (beatIndex === 0 && [1, 4, 5, 6].includes(candidate.degree)) score += 0.12;
  if (beatIndex === 2 && [4, 5, 6].includes(candidate.degree)) score += 0.08;

  return score;
}

function smoothProgression(chords, fallback) {
  if (chords.length <= 1) return chords;

  const result = [...chords];

  // 全小節同じになった場合は、最低限の展開を作る
  if (result.every((chord) => chord === result[0]) && fallback.length >= 4) {
    return result.map((_, index) => fallback[index % fallback.length]);
  }

  return result;
}

function getChordMidiNotes(chordName, octave = 3) {
  const parsed = parseChordName(chordName);
  if (!parsed) {
    return [48, 52, 55];
  }

  const rootMidi = (octave + 1) * 12 + parsed.rootPc;
  const intervals = getQualityIntervals(parsed.quality);
  return intervals.map((interval) => rootMidi + interval);
}

function parseChordName(chordName) {
  if (!chordName || typeof chordName !== "string") return null;

  const match = chordName.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return null;

  const root = match[1];
  const quality = match[2] || "";
  const rootPc = ROOT_PCS[root];

  if (rootPc === undefined) return null;

  return { root, rootPc, quality };
}

function getQualityIntervals(quality) {
  if (quality === "m") return [0, 3, 7];
  if (quality === "dim") return [0, 3, 6];
  if (quality === "maj7") return [0, 4, 7, 11];
  if (quality === "m7") return [0, 3, 7, 10];
  if (quality === "7") return [0, 4, 7, 10];
  if (quality === "dim7") return [0, 3, 6, 9];

  return [0, 4, 7];
}

function buildChordNoteMap() {
  const map = {};
  const roots = {
    C: 60, "C#": 61, D: 62, Eb: 63, E: 64, F: 65,
    "F#": 66, G: 67, Ab: 68, A: 69, Bb: 70, B: 71
  };

  Object.entries(roots).forEach(([name, midi]) => {
    map[name] = [midi, midi + 4, midi + 7];
    map[`${name}m`] = [midi, midi + 3, midi + 7];
    map[`${name}dim`] = [midi, midi + 3, midi + 6];
    map[`${name}maj7`] = [midi, midi + 4, midi + 7, midi + 11];
    map[`${name}m7`] = [midi, midi + 3, midi + 7, midi + 10];
    map[`${name}7`] = [midi, midi + 4, midi + 7, midi + 10];
    map[`${name}dim7`] = [midi, midi + 3, midi + 6, midi + 9];
  });

  return map;
}

function midiNoteToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

async function playChordProgression() {
  stopChordProgression();
  ensureChordBeatGrid();
  ensureChordOctaveGrid();

  const ctx = await getAudioContext();
  const beatSeconds = 60 / state.playbackBpm;
  const uiStartDelayMs = 80;
  let start = ctx.currentTime + uiStartDelayMs / 1000;
  let beatCounter = 0;

  state.chordBeats.forEach((beats, barIndex) => {
    beats.forEach((chordName, beatIndex) => {
      const octave = state.chordOctaveBeats[barIndex]?.[beatIndex] ?? state.chordOctave;
      const notes = getChordMidiNotes(chordName, octave);
      notes.forEach((note, noteIndex) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(midiNoteToFreq(note), start);

        const volume = noteIndex === 0 ? 0.075 : 0.048;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.015);
        gain.gain.setValueAtTime(volume, start + beatSeconds * 0.78);
        gain.gain.linearRampToValueAtTime(0, start + beatSeconds * 0.94);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + beatSeconds);

        state.playingNodes.push(osc, gain);
      });

      const timer = window.setTimeout(() => {
        setActiveBeat(barIndex, beatIndex);
      }, uiStartDelayMs + beatCounter * beatSeconds * 1000);

      state.playbackTimers.push(timer);

      start += beatSeconds;
      beatCounter += 1;
    });
  });

  const clearTimer = window.setTimeout(() => {
    clearPlaybackHighlight();
  }, uiStartDelayMs + beatCounter * beatSeconds * 1000 + 80);

  state.playbackTimers.push(clearTimer);
}

function stopChordProgression() {
  state.playingNodes.forEach((node) => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (_) {}
  });
  state.playingNodes = [];

  state.playbackTimers.forEach((timer) => window.clearTimeout(timer));
  state.playbackTimers = [];
  clearPlaybackHighlight();
}

function setActiveBeat(barIndex, beatIndex) {
  clearPlaybackHighlight();

  const beatCell = els.chordGrid.querySelector(
    `.beat-cell[data-bar-index="${barIndex}"][data-beat-index="${beatIndex}"]`
  );

  if (!beatCell) return;

  const chordCell = beatCell.closest(".chord-cell");
  beatCell.classList.add("playing");
  if (chordCell) chordCell.classList.add("playing");

  state.activeBeat = { barIndex, beatIndex };
}

function clearPlaybackHighlight() {
  els.chordGrid
    .querySelectorAll(".beat-cell.playing")
    .forEach((el) => el.classList.remove("playing"));

  els.chordGrid
    .querySelectorAll(".chord-cell.playing")
    .forEach((el) => el.classList.remove("playing"));

  state.activeBeat = null;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const data = {
    estimatedBpm: state.estimatedBpm,
    playbackBpm: state.playbackBpm,
    chordOctave: state.chordOctave,
    referenceApplyMode: state.referenceApplyMode,
    chordOptionMode: state.chordOptionMode,
    key: state.key,
    notes: state.detectedNotes,
    referenceChords: state.referenceChords,
    beatReferenceChords: state.beatReferenceChords,
    beatReferenceOctaves: state.beatReferenceOctaves,
    chords: state.chords,
    chordBeats: state.chordBeats,
    chordOctaveBeats: state.chordOctaveBeats,
    barCandidates: state.barCandidates,
    beatCandidates: state.beatCandidates,
    barSummaryText: formatChordRows(getBarSummaryText()),
    beatGridText: formatBeatGridRows(),
    solfegeText: formatSolfegeChordRows()
  };
  downloadBlob(
    "humming-chord.json",
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  );
}

function numberToVariableLengthQuantity(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function textBytes(text) {
  return Array.from(text).map((char) => char.charCodeAt(0) & 0xff);
}

function writeUint32(value) {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function writeUint16(value) {
  return [(value >>> 8) & 255, value & 255];
}

function quantizeTick(tick, grid = 120) {
  return Math.max(0, Math.round(tick / grid) * grid);
}

function createMidiFromTimedEvents(filename, timedEvents, trackName = "Humming Chord") {
  const ppq = 480;
  const tempoMicroseconds = Math.round(60000000 / state.playbackBpm);
  const track = [];

  track.push(0x00, 0xff, 0x51, 0x03,
    (tempoMicroseconds >> 16) & 255,
    (tempoMicroseconds >> 8) & 255,
    tempoMicroseconds & 255
  );

  track.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  const name = textBytes(trackName);
  track.push(0x00, 0xff, 0x03, name.length, ...name);

  // Channel 0: chord piano / Channel 1: melody piano
  track.push(0x00, 0xc0, 0x00);
  track.push(0x00, 0xc1, 0x00);

  const sorted = [...timedEvents].sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.type !== b.type) return a.type === "off" ? -1 : 1;
    return a.note - b.note;
  });

  let currentTick = 0;
  sorted.forEach((event) => {
    const delta = Math.max(0, event.tick - currentTick);
    currentTick = event.tick;
    const channel = Math.max(0, Math.min(15, event.channel || 0));
    const status = (event.type === "on" ? 0x90 : 0x80) + channel;
    const velocity = event.type === "on" ? (event.velocity || 84) : 0;
    track.push(...numberToVariableLengthQuantity(delta), status, event.note, velocity);
  });

  track.push(0x00, 0xff, 0x2f, 0x00);

  const header = [
    ...textBytes("MThd"),
    ...writeUint32(6),
    ...writeUint16(0),
    ...writeUint16(1),
    ...writeUint16(ppq)
  ];

  const trackChunk = [
    ...textBytes("MTrk"),
    ...writeUint32(track.length),
    ...track
  ];

  const bytes = new Uint8Array([...header, ...trackChunk]);
  downloadBlob(filename, new Blob([bytes], { type: "audio/midi" }));
}

function buildChordMidiEvents(channel = 0) {
  ensureChordBeatGrid();
  ensureChordOctaveGrid();

  const ppq = 480;
  const events = [];

  state.chordBeats.forEach((beats, barIndex) => {
    beats.forEach((chordName, beatIndex) => {
      const startTick = (barIndex * 4 + beatIndex) * ppq;
      const endTick = startTick + ppq;
      const octave = state.chordOctaveBeats[barIndex]?.[beatIndex] ?? state.chordOctave;
      const notes = getChordMidiNotes(chordName, octave);

      notes.forEach((note) => {
        events.push({ tick: startTick, type: "on", note, velocity: 78, channel });
        events.push({ tick: endTick, type: "off", note, velocity: 0, channel });
      });
    });
  });

  return events;
}

function buildMelodyMidiEvents(channel = 1) {
  const ppq = 480;
  const events = [];

  state.detectedNotes.forEach((note) => {
    let startTick = Math.round((note.start * state.playbackBpm / 60) * ppq);
    let endTick = Math.round((note.end * state.playbackBpm / 60) * ppq);

    // 鼻歌の揺れを少しだけ作曲アプリ向けに整える
    startTick = quantizeTick(startTick, 120);
    endTick = quantizeTick(endTick, 120);

    if (endTick <= startTick) endTick = startTick + 120;

    events.push({ tick: startTick, type: "on", note: note.midi, velocity: 88, channel });
    events.push({ tick: endTick, type: "off", note: note.midi, velocity: 0, channel });
  });

  return events;
}

function exportMelodyMidi() {
  if (!state.detectedNotes.length) {
    els.audioStatus.textContent = "メロディMIDIを書き出すには、先に鼻歌を解析してください。";
    return;
  }

  createMidiFromTimedEvents(
    "humming-melody.mid",
    buildMelodyMidiEvents(1),
    "Humming Melody"
  );
}

function exportFullMidi() {
  if (!state.detectedNotes.length) {
    els.audioStatus.textContent = "コード＋メロディMIDIを書き出すには、先に鼻歌を解析してください。";
    return;
  }

  createMidiFromTimedEvents(
    "humming-chord-and-melody.mid",
    [...buildChordMidiEvents(0), ...buildMelodyMidiEvents(1)],
    "Humming Chord and Melody"
  );
}

function exportMidi() {
  createMidiFromTimedEvents(
    "humming-chord.mid",
    buildChordMidiEvents(0),
    "Humming Chord"
  );
}

els.audioFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await handleAudioBlob(file, file.name);
});

els.recordButton.addEventListener("click", async () => {
  if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
    state.mediaRecorder.stop();
    els.recordButton.textContent = "録音開始";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordedChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) state.recordedChunks.push(event.data);
    };

    state.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(state.recordedChunks, { type: "audio/webm" });
      await handleAudioBlob(blob, "録音データ");
    };

    state.mediaRecorder.start();
    els.recordButton.textContent = "録音停止";
    els.audioStatus.textContent = "録音中です。もう一度押すと停止します。";
  } catch (error) {
    console.error(error);
    els.audioStatus.textContent = "録音を開始できませんでした。ブラウザのマイク権限を確認してください。";
  }
});

els.bpmDown.addEventListener("click", () => setPlaybackBpm(state.playbackBpm - 1));
els.bpmUp.addEventListener("click", () => setPlaybackBpm(state.playbackBpm + 1));
els.bpmInput.addEventListener("input", handleBpmTyping);
els.bpmInput.addEventListener("change", commitBpmInput);
els.bpmInput.addEventListener("blur", commitBpmInput);
els.bpmInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    commitBpmInput();
    els.bpmInput.blur();
  }
});

if (els.chordOctaveInput) {
  els.chordOctaveInput.addEventListener("change", () => {
    setChordOctave(els.chordOctaveInput.value);
  });
}

if (els.referenceApplyModeInput) {
  els.referenceApplyModeInput.addEventListener("change", () => {
    setReferenceApplyMode(els.referenceApplyModeInput.value);

    if (state.referenceChords.length || state.beatReferenceChords.length) {
      applyReferenceChords({
        chords: state.referenceChords,
        beatChords: state.beatReferenceChords,
        beatOctaves: state.beatReferenceOctaves,
        barCandidates: state.barCandidates,
        beatCandidates: state.beatCandidates
      });
      renderChordGrid();
      els.audioStatus.textContent = state.referenceApplyMode === "beat"
        ? "参考コードを1拍ごとに4拍マスへ反映しました。"
        : "参考コードを小節ごとにまとめて反映しました。";
    }
  });
}

if (els.chordOptionModeInput) {
  els.chordOptionModeInput.addEventListener("change", () => {
    setChordOptionMode(els.chordOptionModeInput.value);
    els.audioStatus.textContent = `コード選択肢を「${els.chordOptionModeInput.options[els.chordOptionModeInput.selectedIndex].textContent}」に変更しました。`;
  });
}


els.tapTempo.addEventListener("click", () => {
  const now = performance.now();
  state.tapTimes.push(now);
  state.tapTimes = state.tapTimes.slice(-8);

  if (state.tapTimes.length >= 2) {
    const intervals = [];
    for (let i = 1; i < state.tapTimes.length; i++) {
      intervals.push(state.tapTimes[i] - state.tapTimes[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setPlaybackBpm(60000 / avg);
  }
});

els.resetTap.addEventListener("click", () => {
  state.tapTimes = [];
});

els.regenerateChords.addEventListener("click", () => {
  if (!state.detectedNotes.length || !state.keyInfo) {
    els.audioStatus.textContent = "先に鼻歌を解析してください。";
    return;
  }

  const chordAnalysis = generateChordAnalysis(
    state.detectedNotes,
    state.keyInfo,
    state.playbackBpm,
    state.audioDuration
  );
  applyReferenceChords(chordAnalysis);
  renderChordGrid();
  els.audioStatus.textContent = `再生BPM ${state.playbackBpm} を基準に参考コードを再抽出し、コード進行欄へ反映しました。`;
});

els.addBar.addEventListener("click", () => {
  state.chords.push("C");
  state.chordBeats.push(["C", "C", "C", "C"]);
  state.chordOctaveBeats.push([state.chordOctave, state.chordOctave, state.chordOctave, state.chordOctave]);
  state.beatReferenceChords.push(["C", "C", "C", "C"]);
  state.beatReferenceOctaves.push([state.chordOctave, state.chordOctave, state.chordOctave, state.chordOctave]);
  state.barCandidates.push([{ name: "C", score: 0 }]);
  state.beatCandidates.push([[{ name: "C", score: 0 }], [{ name: "C", score: 0 }], [{ name: "C", score: 0 }], [{ name: "C", score: 0 }]]);
  renderChordGrid();
});

els.removeBar.addEventListener("click", () => {
  if (state.chords.length <= 1) return;
  state.chords.pop();
  state.chordBeats.pop();
  state.chordOctaveBeats.pop();
  state.beatReferenceChords.pop();
  state.beatReferenceOctaves.pop();
  state.barCandidates.pop();
  state.beatCandidates.pop();
  renderChordGrid();
});

els.playChords.addEventListener("click", playChordProgression);
els.stopChords.addEventListener("click", stopChordProgression);

els.copyText.addEventListener("click", async () => {
  updateOutputText();
  try {
    await navigator.clipboard.writeText(els.outputText.value);
    els.copyText.textContent = "コピーしました";
    setTimeout(() => (els.copyText.textContent = "コードをコピー"), 1200);
  } catch (_) {
    els.outputText.select();
    document.execCommand("copy");
  }
});

els.downloadMidi.addEventListener("click", exportMidi);
els.downloadMelodyMidi.addEventListener("click", exportMelodyMidi);
els.downloadFullMidi.addEventListener("click", exportFullMidi);
els.downloadJson.addEventListener("click", exportJson);

setupBlockDisplayControls();
ensureChordOctaveGrid();
renderChordGrid();
setPlaybackBpm(state.playbackBpm);
setChordOctave(state.chordOctave);
setReferenceApplyMode(state.referenceApplyMode);
setChordOptionMode(state.chordOptionMode);
updateReferenceChordPreview();
updateOutputText();
