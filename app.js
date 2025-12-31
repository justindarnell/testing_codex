const habitat = document.getElementById('habitat');
const llamaList = document.getElementById('llama-list');
const feedBtn = document.getElementById('feed-btn');
const placeItemBtn = document.getElementById('place-item-btn');
const itemTypeSelect = document.getElementById('item-type');
const breedBtn = document.getElementById('breed-btn');
const addLlamaBtn = document.getElementById('add-llama-btn');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');
const simTimeLabel = document.getElementById('sim-time');

const STORAGE_KEY = 'llamasim-state-v1';
const MAX_DRIVE = 100;
const TICK_MS = 800;

const itemIcons = {
  toy: '◆',
  bed: '▦',
  food: '●',
  mirror: '▢',
};

let state = loadState();
let selectedLlamas = new Set();
let pendingPlacement = null;
let audioContext;
let simulationIntervalId = null;

function getHabitatDimensions() {
  const width = habitat.clientWidth || 800;
  const height = habitat.clientHeight || 600;
  return { width, height };
}

function init() {
  if (state.llamas.length === 0) {
    state.llamas = [createLlama(), createLlama(), createLlama()];
  }
  renderAll();
  startSimulation();
}

function loadState() {
  const defaultState = {
    day: 1,
    hour: 8,
    minute: 0,
    llamas: [],
    items: [],
  };

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);

      // Basic structural validation and normalization
      if (parsed && typeof parsed === 'object') {
        const normalized = { ...defaultState };

        if (typeof parsed.day === 'number') {
          normalized.day = parsed.day;
        }
        if (typeof parsed.hour === 'number') {
          normalized.hour = parsed.hour;
        }
        if (typeof parsed.minute === 'number') {
          normalized.minute = parsed.minute;
        }

        if (Array.isArray(parsed.llamas)) {
          normalized.llamas = parsed.llamas.map((llama) => normalizeLlama(llama));
        }
        if (Array.isArray(parsed.items)) {
          normalized.items = parsed.items.map((item) => normalizeItem(item));
        }

        return normalized;
      } else {
        console.warn('Saved state has unexpected structure, using default state');
      }
    } catch (error) {
      console.warn('Failed to parse saved state', error);
    }
  }

  return defaultState;
}

function normalizeLlama(llama) {
  const normalized = { ...llama };
  if (!normalized.id) {
    normalized.id = crypto.randomUUID();
  }
  if (!normalized.name) {
    normalized.name = generateUniqueName();
  }
  if (typeof normalized.generation !== 'number') {
    normalized.generation = 1;
  }
  if (!Array.isArray(normalized.parents)) {
    normalized.parents = [];
  }
  return normalized;
}

function normalizeItem(item) {
  const normalized = { ...item };
  if (normalized.type === 'snack') {
    normalized.type = 'food';
  }
  if (!normalized.id) {
    normalized.id = crypto.randomUUID();
  }
  return normalized;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  if (!confirm('Reset the habitat? This clears all llamas.')) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  state.llamas = [createLlama(), createLlama(), createLlama()];
  selectedLlamas.clear();
  renderAll();
  playSound('reset');
}

function createLlama(parentA, parentB) {
  const dna = generateDna(parentA?.dna, parentB?.dna);
  const dimensions = getHabitatDimensions();
  const generation = parentA || parentB ? Math.max(parentA?.generation ?? 1, parentB?.generation ?? 1) + 1 : 1;
  const parents = [parentA?.id, parentB?.id].filter(Boolean);
  return {
    id: crypto.randomUUID(),
    name: generateUniqueName(),
    generation,
    parents,
    dna,
    drives: {
      hunger: randRange(10, 40),
      sleep: randRange(10, 40),
      social: randRange(50, 80),
      boredom: randRange(20, 50),
      curiosity: randRange(30, 70),
      love: randRange(40, 70),
    },
    mood: 'content',
    position: {
      x: randRange(50, dimensions.width - 70),
      y: randRange(50, dimensions.height - 70),
    },
    bubble: '',
  };
}

function generateDna(parentDnaA, parentDnaB) {
  const baseColor = blendGenes(
    parentDnaA?.color || randomColor(),
    parentDnaB?.color || randomColor()
  );
  return {
    color: mutateColor(baseColor),
    traits: {
      sleepiness: blendTrait(parentDnaA, parentDnaB, 'sleepiness'),
      sociability: blendTrait(parentDnaA, parentDnaB, 'sociability'),
      curiosity: blendTrait(parentDnaA, parentDnaB, 'curiosity'),
      playfulness: blendTrait(parentDnaA, parentDnaB, 'playfulness'),
      affection: blendTrait(parentDnaA, parentDnaB, 'affection'),
    },
  };
}

function blendTrait(parentA, parentB, key) {
  const a = parentA?.traits?.[key] ?? Math.random();
  const b = parentB?.traits?.[key] ?? Math.random();
  return clamp((a + b) / 2 + randRange(-0.1, 0.1), 0, 1);
}

function blendGenes(colorA, colorB) {
  return {
    r: Math.round((colorA.r + colorB.r) / 2),
    g: Math.round((colorA.g + colorB.g) / 2),
    b: Math.round((colorA.b + colorB.b) / 2),
  };
}

function mutateColor(color) {
  const mutation = () => clamp(Math.round(colorMutation()), 0, 255);
  function colorMutation() {
    return color.r + randRange(-20, 20);
  }
  return {
    r: mutation(),
    g: clamp(color.g + randRange(-20, 20), 0, 255),
    b: clamp(color.b + randRange(-20, 20), 0, 255),
  };
}

function randomColor() {
  return {
    r: randRange(60, 220),
    g: randRange(60, 220),
    b: randRange(60, 220),
  };
}

function generateName() {
  const first = ['Neo', 'Pixel', 'Byte', 'Nova', 'Echo', 'Flux', 'Aria', 'Zara', 'Vivi', 'Rex'];
  const second = ['Llama', 'Wool', 'Circuit', 'Glow', 'Nimbus', 'Quark', 'Pulse', 'Drift', 'Fuzz'];
  return `${pick(first)} ${pick(second)}`;
}

function generateUniqueName() {
  const existing = getExistingNames();
  const base = generateName();
  let candidate = base;
  let counter = 2;
  while (existing.has(candidate.toLowerCase())) {
    candidate = `${base} ${counter}`;
    counter += 1;
  }
  return candidate;
}

function getExistingNames(excludeId) {
  return new Set(
    state.llamas
      .filter((llama) => llama.id !== excludeId)
      .map((llama) => llama.name.toLowerCase())
  );
}

function renderAll() {
  renderTime();
  renderLlamas();
  renderItems();
  renderRoster();
}

function renderTime() {
  simTimeLabel.textContent = `Day ${state.day} • ${String(state.hour).padStart(2, '0')}:${String(
    state.minute
  ).padStart(2, '0')}`;
}

const llamaElements = new Map();
const itemElements = new WeakMap();

function renderLlamas() {
  const currentIds = new Set();

  state.llamas.forEach((llama) => {
    currentIds.add(llama.id);

    let el = llamaElements.get(llama.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'llama';
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleSelection(llama.id);
      });
      habitat.appendChild(el);
      llamaElements.set(llama.id, el);
    }

    // Update position and appearance
    el.style.left = `${llama.position.x}px`;
    el.style.top = `${llama.position.y}px`;
    el.style.backgroundColor = `rgb(${llama.dna.color.r}, ${llama.dna.color.g}, ${llama.dna.color.b})`;

    // Update selected state
    if (selectedLlamas.has(llama.id)) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }

    // Update bubble content
    let bubble = el.querySelector('.bubble');
    if (llama.bubble) {
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'bubble';
        el.appendChild(bubble);
      }
      bubble.textContent = llama.bubble;
    } else if (bubble) {
      bubble.remove();
    }
  });

  // Remove llamas that no longer exist
  for (const [id, el] of llamaElements.entries()) {
    if (!currentIds.has(id)) {
      el.remove();
      llamaElements.delete(id);
    }
  }
}

function renderItems() {
  const existingNodes = new Set(habitat.querySelectorAll('.item'));
  const usedNodes = new Set();

  state.items.forEach((item) => {
    let el = itemElements.get(item);
    if (!el) {
      el = document.createElement('div');
      el.className = `item ${item.type}`;
      itemElements.set(item, el);
    } else {
      // Ensure the base "item" class is present and update type-specific class.
      el.className = `item ${item.type}`;
    }

    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.textContent = itemIcons[item.type] || '◆';

    if (el.parentNode !== habitat) {
      habitat.appendChild(el);
    }

    usedNodes.add(el);
    existingNodes.delete(el);
  });

  // Remove any item nodes that are no longer used
  existingNodes.forEach((node) => {
    if (!usedNodes.has(node)) {
      node.remove();
    }
  });
}

function renderRoster() {
  llamaList.innerHTML = '';
  state.llamas.forEach((llama) => {
    const card = document.createElement('div');
    card.className = 'llama-card';
    card.dataset.llamaId = llama.id;
    if (selectedLlamas.has(llama.id)) {
      card.classList.add('selected');
    }
    card.addEventListener('click', () => toggleSelection(llama.id));

    const nameRow = document.createElement('div');
    nameRow.className = 'llama-name-row';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    nameLabel.setAttribute('for', `llama-name-${llama.id}`);
    const nameInput = document.createElement('input');
    nameInput.id = `llama-name-${llama.id}`;
    nameInput.type = 'text';
    nameInput.value = llama.name;
    nameInput.addEventListener('click', (event) => event.stopPropagation());
    nameInput.addEventListener('change', () => {
      const trimmed = nameInput.value.trim();
      if (!trimmed) {
        nameInput.value = llama.name;
        return;
      }
      const existing = getExistingNames(llama.id);
      if (existing.has(trimmed.toLowerCase())) {
        alert('That name is already taken.');
        nameInput.value = llama.name;
        return;
      }
      llama.name = trimmed;
      renderAll();
    });
    nameRow.append(nameLabel, nameInput);

    const meta = document.createElement('div');
    meta.className = 'llama-meta';
    meta.innerHTML = `
      <p>Generation: ${llama.generation}</p>
      <p>Parents: ${parentSummary(llama)}</p>
      <p>DNA color: rgb(${llama.dna.color.r}, ${llama.dna.color.g}, ${llama.dna.color.b})</p>
      <p>Traits: ${traitSummary(llama.dna.traits)}</p>
    `;

    const drives = document.createElement('div');
    drives.innerHTML = `
      ${driveRow('Hunger', llama.drives.hunger)}
      ${driveRow('Sleep', llama.drives.sleep)}
      ${driveRow('Social', llama.drives.social)}
      ${driveRow('Boredom', llama.drives.boredom)}
      ${driveRow('Curiosity', llama.drives.curiosity)}
      ${driveRow('Love', llama.drives.love)}
    `;

    card.append(nameRow, meta, drives);
    llamaList.appendChild(card);
  });
}

function driveRow(label, value) {
  const clamped = clamp(value, 0, MAX_DRIVE);
  return `
    <p>${label}: ${Math.round(clamped)}</p>
    <div class="drive-bar"><span style="width: ${clamped}%;"></span></div>
  `;
}

function traitSummary(traits) {
  const summary = Object.entries(traits)
    .map(([key, value]) => `${key.slice(0, 4)} ${Math.round(value * 100)}`)
    .join(' • ');
  return summary;
}

function parentSummary(llama) {
  if (!llama.parents || llama.parents.length === 0) {
    return 'Founders';
  }
  const names = llama.parents
    .map((parentId) => state.llamas.find((candidate) => candidate.id === parentId)?.name)
    .filter(Boolean);
  return names.length ? names.join(' + ') : 'Unknown';
}

function toggleSelection(id) {
  if (selectedLlamas.has(id)) {
    selectedLlamas.delete(id);
  } else {
    if (selectedLlamas.size >= 2) {
      selectedLlamas.clear();
    }
    selectedLlamas.add(id);
  }
  renderLlamas();
  renderRoster();
  playSound('select');
}

function startSimulation() {
  if (simulationIntervalId !== null) {
    clearInterval(simulationIntervalId);
  }
  simulationIntervalId = setInterval(() => {
    tickTime();
    updateLlamas();
    renderAll();
  }, TICK_MS);
}

function tickTime() {
  state.minute += 15;
  if (state.minute >= 60) {
    state.minute = 0;
    state.hour += 1;
  }
  if (state.hour >= 24) {
    state.hour = 0;
    state.day += 1;
  }
}

function updateLlamas() {
  state.llamas.forEach((llama) => {
    updateDrives(llama);
    chooseAction(llama);
    moveLlama(llama);
  });
}

function updateDrives(llama) {
  llama.drives.hunger = clamp(llama.drives.hunger + 2, 0, MAX_DRIVE);
  llama.drives.sleep = clamp(llama.drives.sleep + 1.5 * llama.dna.traits.sleepiness, 0, MAX_DRIVE);
  llama.drives.boredom = clamp(llama.drives.boredom + 1, 0, MAX_DRIVE);
  llama.drives.curiosity = clamp(llama.drives.curiosity + 0.6, 0, MAX_DRIVE);
  llama.drives.social = clamp(llama.drives.social - 0.5 + llama.dna.traits.sociability, 0, MAX_DRIVE);
  llama.drives.love = clamp(llama.drives.love - 0.3 + llama.dna.traits.affection, 0, MAX_DRIVE);
}

function chooseAction(llama) {
  const nearbyItem = findNearestItem(llama);
  const socialMate = findNearestLlama(llama);
  let bubble = '';

  if (llama.drives.hunger > 70 && nearbyItem?.type === 'food') {
    bubble = 'nom nom';
    llama.drives.hunger = clamp(llama.drives.hunger - 30, 0, MAX_DRIVE);
    removeItem(nearbyItem.id);
    playSound('eat');
  } else if (llama.drives.sleep > 70 && nearbyItem?.type === 'bed') {
    bubble = 'zzz';
    llama.drives.sleep = clamp(llama.drives.sleep - 40, 0, MAX_DRIVE);
    playSound('sleep');
  } else if (llama.drives.boredom > 70 && nearbyItem?.type === 'toy') {
    bubble = 'play!';
    llama.drives.boredom = clamp(llama.drives.boredom - 35, 0, MAX_DRIVE);
    playSound('toy');
  } else if (llama.drives.curiosity > 60 && nearbyItem?.type === 'mirror') {
    bubble = 'ooh';
    llama.drives.curiosity = clamp(llama.drives.curiosity - 25, 0, MAX_DRIVE);
    playSound('mirror');
  } else if (socialMate && llama.drives.social < 40) {
    bubble = 'hiya';
    llama.drives.social = clamp(llama.drives.social + 20, 0, MAX_DRIVE);
    llama.drives.love = clamp(llama.drives.love + 10, 0, MAX_DRIVE);
  } else {
    bubble = pick(['...', 'hmm', 'brr', 'blep', 'loom']);
  }

  llama.bubble = bubble;
}

function moveLlama(llama) {
  const speed = 12 + llama.dna.traits.curiosity * 8;
  const dimensions = getHabitatDimensions();
  llama.position.x = clamp(llama.position.x + randRange(-speed, speed), 20, dimensions.width - 60);
  llama.position.y = clamp(llama.position.y + randRange(-speed, speed), 20, dimensions.height - 60);
}

function findNearestItem(llama) {
  return state.items
    .map((item) => ({
      ...item,
      distance: distance(llama.position, item),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function findNearestLlama(llama) {
  return state.llamas
    .filter((other) => other.id !== llama.id)
    .map((other) => ({
      llama: other,
      distance: distance(llama.position, other.position),
    }))
    .filter((entry) => entry.distance < 120)
    .sort((a, b) => a.distance - b.distance)[0]?.llama;
}

function removeItem(itemId) {
  state.items = state.items.filter((item) => item.id !== itemId);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function placeItemAt(x, y, type) {
  const dimensions = getHabitatDimensions();
  state.items.push({
    id: crypto.randomUUID(),
    type,
    x: clamp(x, 20, dimensions.width - 40),
    y: clamp(y, 20, dimensions.height - 40),
  });
}

function feedSelected() {
  const target = state.llamas.find((llama) => selectedLlamas.has(llama.id));
  if (!target) {
    alert('Select a llama first.');
    return;
  }
  target.drives.hunger = clamp(target.drives.hunger - 35, 0, MAX_DRIVE);
  target.bubble = 'nom';
  playSound('eat');
  renderAll();
}

function breedSelected() {
  if (selectedLlamas.size !== 2) {
    alert('Select two llamas to breed.');
    return;
  }
  const [firstId, secondId] = Array.from(selectedLlamas);
  const parentA = state.llamas.find((llama) => llama.id === firstId);
  const parentB = state.llamas.find((llama) => llama.id === secondId);
  if (!parentA || !parentB) {
    return;
  }
  const child = createLlama(parentA, parentB);
  state.llamas.push(child);
  selectedLlamas.clear();
  playSound('breed');
  renderAll();
}

function addLlama() {
  state.llamas.push(createLlama());
  playSound('spawn');
  renderAll();
}

function playSound(type) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = {
      eat: 220,
      sleep: 160,
      toy: 440,
      mirror: 520,
      breed: 320,
      spawn: 280,
      select: 360,
      reset: 180,
    }[type] || 300;
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    oscillator.connect(gainNode).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
  } catch (error) {
    console.warn('Audio unavailable', error);
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

feedBtn.addEventListener('click', feedSelected);
placeItemBtn.addEventListener('click', () => {
  if (pendingPlacement) {
    pendingPlacement = null;
    habitat.classList.remove('placing');
    return;
  }
  pendingPlacement = itemTypeSelect.value;
  habitat.classList.add('placing');
});

itemTypeSelect.addEventListener('change', () => {
  if (pendingPlacement) {
    pendingPlacement = itemTypeSelect.value;
  }
});

habitat.addEventListener('click', (event) => {
  if (!pendingPlacement) {
    return;
  }
  const rect = habitat.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  placeItemAt(x, y, pendingPlacement);
  playSound('select');
  renderAll();
});

breedBtn.addEventListener('click', breedSelected);
addLlamaBtn.addEventListener('click', addLlama);
saveBtn.addEventListener('click', () => {
  saveState();
  playSound('select');
});
resetBtn.addEventListener('click', resetState);

let autosaveIntervalId = null;

function startAutosave() {
  if (autosaveIntervalId !== null) {
    clearInterval(autosaveIntervalId);
  }
  autosaveIntervalId = setInterval(saveState, 8000);
}

window.addEventListener('beforeunload', () => {
  if (autosaveIntervalId !== null) {
    clearInterval(autosaveIntervalId);
    autosaveIntervalId = null;
  }
});

let hasInitialized = false;

function boot() {
  if (hasInitialized) {
    return;
  }
  hasInitialized = true;
  startAutosave();
  init();
}

boot();
