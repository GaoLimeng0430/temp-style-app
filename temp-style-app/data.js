// ============================================================
// data.js - 数据模型 & localStorage 持久化
// ============================================================

const STORAGE_KEYS = {
  wardrobe: 'tempstyle_wardrobe',
  settings: 'tempstyle_settings',
  outfits: 'tempstyle_outfits',
  weather: 'tempstyle_weather_cache',
};

const CATEGORY_LABELS = {
  top: '上装',
  bottom: '下装',
  outerwear: '外套',
  dress: '连衣裙',
  shoes: '鞋履',
  accessory: '配饰',
};

const CATEGORY_ICONS = {
  top: '👔',
  bottom: '👖',
  outerwear: '🧥',
  dress: '👗',
  shoes: '👟',
  accessory: '💍',
};

const FABRIC_WARMTH = {
  '棉': 2, '羊毛': 5, '聚酯纤维': 3, '真丝': 1, '亚麻': 1,
  '牛仔布': 4, '针织': 3, '皮革': 5, '混纺': 3, '其他': 3,
};

// ---- 温度自动推算知识库 ----

// 每个品类的基准中点温度 + 半幅宽度
// 用户不需知道这个，app 根据品类+款式+面料+厚度自动计算
const CATEGORY_TEMP_BASE = {
  'top':        { mid: 24, halfWidth: 6 },
  'bottom':     { mid: 22, halfWidth: 7 },
  'outerwear':  { mid: 12, halfWidth: 8 },
  'dress':      { mid: 24, halfWidth: 6 },
  'shoes':      { mid: 20, halfWidth: 10 },
  'accessory':  { mid: 20, halfWidth: 12 },
};

// 款式对基准温度的修正（°C，正值 = 更热天适用）
const STYLE_TEMP_ADJUST = {
  'default':    0,
  '短袖':       3,
  '长袖':      -3,
  '无袖':       5,
  '吊带':       6,
  '短裤':       5,
  '九分裤':    -2,
  '长裤':      -4,
  '短裙':       4,
  '薄款':       2,
  '厚款':      -4,
  '羽绒':      -8,
  '凉鞋':       6,
  '运动鞋':     1,
  '靴子':      -5,
  '皮鞋':       0,
};

// 面料对基准温度的修正（°C，正值 = 更热天适用）
const FABRIC_TEMP_ADJUST = {
  '真丝':        4,
  '亚麻':        4,
  '棉':          1,
  '聚酯纤维':   -1,
  '混纺':        0,
  '针织':       -2,
  '牛仔布':     -3,
  '皮革':       -5,
  '羊毛':       -6,
  '其他':        0,
};

// 厚度对基准温度的修正（1-5，正值 = 更热天适用）
function thicknessAdjust(level) {
  return (3 - level) * 2;  // level1→+4, level2→+2, level3→0, level4→-2, level5→-4
}

// ---- 核心推算函数 ----
// 用户只需要知道：品类 + 款式 + 面料 + 厚度（1-5）
// app 自动算出适宜温度区间
function calculateTempRange(category, style, fabric, thickness) {
  const base = CATEGORY_TEMP_BASE[category] || { mid: 20, halfWidth: 8 };
  const styleAdj = STYLE_TEMP_ADJUST[style] || 0;
  const fabricAdj = FABRIC_TEMP_ADJUST[fabric] || 0;
  const thickAdj = thicknessAdjust(thickness || 3);

  const totalShift = styleAdj + fabricAdj + thickAdj;
  const adjustedMid = base.mid + totalShift;

  let tempMin = Math.round(adjustedMid - base.halfWidth);
  let tempMax = Math.round(adjustedMid + base.halfWidth);

  // 边界约束
  if (tempMin < -15) tempMin = -15;
  if (tempMax > 45) tempMax = 45;
  if (tempMin > tempMax) [tempMin, tempMax] = [tempMax, tempMin];

  return { min: tempMin, max: tempMax };
}

// 品类可选款式列表
const CATEGORY_STYLES = {
  'top':        ['短袖', '长袖', '无袖', '吊带'],
  'bottom':     ['短裤', '长裤', '九分裤'],
  'outerwear':  ['薄款', '厚款', '羽绒'],
  'dress':      ['短袖', '长袖', '无袖', '吊带'],
  'shoes':      ['运动鞋', '皮鞋', '凉鞋', '靴子'],
  'accessory':  ['default'],
};

// 厚度描述
const THICKNESS_LABELS = {
  1: '极薄（透视/雪纺）',
  2: '偏薄（普通T恤）',
  3: '适中（衬衫/卫衣）',
  4: '偏厚（加绒/呢料）',
  5: '加厚（羽绒/棉服）',
};

// ---------- 默认设置 ----------
function getDefaultSettings() {
  return {
    defaultCity: '北京',
    weatherApiKey: '',
    heightCm: 170,
    weightKg: 65,
    bodyShape: '',
    stylePreferences: [],
    lastTemperature: null,
    lastWeatherCondition: null,
    lastCitySearched: '',
  };
}

// ---------- 数据读写 ----------
function loadData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ---------- Wardrobe ----------
function getWardrobe() {
  return loadData(STORAGE_KEYS.wardrobe) || [];
}

function saveWardrobe(items) {
  saveData(STORAGE_KEYS.wardrobe, items);
}

function addWardrobeItem(item) {
  const items = getWardrobe();
  const newItem = {
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    inActive: true,
    ...item,
  };
  items.push(newItem);
  saveWardrobe(items);
  return newItem;
}

function updateWardrobeItem(id, updates) {
  let items = getWardrobe();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  saveWardrobe(items);
  return items[idx];
}

function deleteWardrobeItem(id) {
  let items = getWardrobe();
  items = items.filter(i => i.id !== id);
  saveWardrobe(items);
}

// ---------- Settings ----------
function getSettings() {
  return { ...getDefaultSettings(), ...(loadData(STORAGE_KEYS.settings) || {}) };
}

function saveSettings(updates) {
  const current = getSettings();
  saveData(STORAGE_KEYS.settings, { ...current, ...updates });
}

// ---------- Outfits ----------
function getSavedOutfits() {
  return loadData(STORAGE_KEYS.outfits) || [];
}

function saveOutfit(outfit) {
  const outfits = getSavedOutfits();
  const newOutfit = {
    id: 'outfit_' + Date.now(),
    createdAt: new Date().toISOString(),
    isFavorite: false,
    ...outfit,
  };
  outfits.unshift(newOutfit);
  saveData(STORAGE_KEYS.outfits, outfits);
  return newOutfit;
}

function toggleFavoriteOutfit(id) {
  const outfits = getSavedOutfits();
  const idx = outfits.findIndex(o => o.id === id);
  if (idx === -1) return;
  outfits[idx].isFavorite = !outfits[idx].isFavorite;
  saveData(STORAGE_KEYS.outfits, outfits);
  return outfits[idx].isFavorite;
}

// ---------- Weather Cache ----------
function getWeatherCache() {
  return loadData(STORAGE_KEYS.weather);
}

function setWeatherCache(data) {
  data._cachedAt = Date.now();
  saveData(STORAGE_KEYS.weather, data);
}

// ---------- Utility ----------
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function getSeasonByTemp(temp) {
  if (temp >= 25) return 'summer';
  if (temp >= 15) return 'spring';
  if (temp >= 5) return 'autumn';
  return 'winter';
}

function getFabricWarmth(fabric) {
  return FABRIC_WARMTH[fabric] || 3;
}

// ---- 辅助: 根据 category+style+fabric+thickness 推算季节 ----
function calculateSeasons(category, style, fabric, thickness) {
  const range = calculateTempRange(category, style, fabric, thickness);
  const mid = (range.min + range.max) / 2;
  const seasons = [];
  if (mid >= 18 || range.max >= 30) seasons.push('summer');
  if (mid >= 8 && mid <= 28) seasons.push('spring');
  if (mid >= 8 && mid <= 28) seasons.push('autumn');
  if (mid <= 12 || range.min <= 5) seasons.push('winter');
  return seasons.length > 0 ? seasons : ['spring', 'autumn'];
}

// 用知识库创建示例数据（不涉及用户猜温度）
function getSampleItems() {
  const raw = [
    { name: '白色棉T恤', category: 'top', style: '短袖', fabric: '棉', thickness: 2, color: '#FFFFFF', colorName: '白色' },
    { name: '黑色西装外套', category: 'outerwear', style: '薄款', fabric: '混纺', thickness: 3, color: '#000000', colorName: '黑色' },
    { name: '蓝色牛仔裤', category: 'bottom', style: '长裤', fabric: '牛仔布', thickness: 3, color: '#0000FF', colorName: '蓝色' },
    { name: '灰色卫衣', category: 'top', style: '长袖', fabric: '棉', thickness: 3, color: '#808080', colorName: '灰色' },
    { name: '卡其色短裤', category: 'bottom', style: '短裤', fabric: '棉', thickness: 2, color: '#8B4513', colorName: '卡其色' },
    { name: '白色衬衫', category: 'top', style: '长袖', fabric: '棉', thickness: 2, color: '#FFFFFF', colorName: '白色' },
    { name: '黑色皮鞋', category: 'shoes', style: '皮鞋', fabric: '皮革', thickness: 3, color: '#000000', colorName: '黑色' },
    { name: '羊毛大衣', category: 'outerwear', style: '厚款', fabric: '羊毛', thickness: 5, color: '#8B4513', colorName: '驼色' },
    { name: '运动鞋', category: 'shoes', style: '运动鞋', fabric: '聚酯纤维', thickness: 3, color: '#FFFFFF', colorName: '白色' },
    { name: '黑色连衣裙', category: 'dress', style: '短袖', fabric: '聚酯纤维', thickness: 2, color: '#000000', colorName: '黑色' },
    { name: '灰色运动裤', category: 'bottom', style: '长裤', fabric: '聚酯纤维', thickness: 3, color: '#808080', colorName: '灰色' },
    { name: '针织开衫', category: 'outerwear', style: '薄款', fabric: '针织', thickness: 3, color: '#FFC0CB', colorName: '粉色' },
  ];
  return raw.map(item => {
    const range = calculateTempRange(item.category, item.style, item.fabric, item.thickness);
    return {
      ...item,
      suitableTempMin: range.min,
      suitableTempMax: range.max,
      suitableSeasons: calculateSeasons(item.category, item.style, item.fabric, item.thickness),
    };
  });
}
