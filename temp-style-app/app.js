// ============================================================
// app.js - 主应用控制器
// ============================================================

const app = {
  // ---------- 初始化 ----------
  init() {
    this._currentFilter = 'all';
    UI.initNav();
    UI.initModals();
    UI.initFilters();
    this._initStyleTags();
    this.switchTab('home');
  },

  _initStyleTags() {
    document.querySelectorAll('#style-tags .tag').forEach(tag => {
      tag.addEventListener('click', () => {
        tag.classList.toggle('selected');
      });
    });
  },

  switchTab(tab) {
    UI.switchTab(tab);
  },

  // ---------- 天气 ----------
  async refreshWeather() {
    const settings = getSettings();
    const city = settings.defaultCity || '北京';
    const apiKey = settings.weatherApiKey || '';

    UI.showWeatherLoading();

    // 先尝试 API
    if (apiKey) {
      try {
        const data = await WeatherService.fetchFromApi(city, apiKey);
        if (data) {
          const apparentTemp = WeatherService.calculateApparentTemp(
            data.temperature, data.humidity, data.windSpeed || 0
          );
          data.apparentTemp = Math.round(apparentTemp);
          WeatherService.setCache(data);
          UI.showWeatherData(data);

          // 更新缓存
          saveSettings({ lastTemperature: data.temperature, lastWeatherCondition: data.condition, lastCitySearched: city });

          // 生成搭配推荐
          this.generateHomeRecommendation(data.temperature);
          return;
        }
      } catch (e) {
        console.warn('Weather API failed', e);
      }
    }

    // 尝试缓存
    const cached = WeatherService.getCached();
    if (cached && cached.temperature !== undefined) {
      UI.showWeatherData(cached);
      this.generateHomeRecommendation(cached.temperature);
      return;
    }

    // 尝试上次保存的温度
    if (settings.lastTemperature !== null && settings.lastTemperature !== undefined) {
      UI.showWeatherData({
        temperature: settings.lastTemperature,
        condition: settings.lastWeatherCondition || '晴',
        city: settings.lastCitySearched || city,
        humidity: 50,
      });
      this.generateHomeRecommendation(settings.lastTemperature);
      return;
    }

    // 全失败，显示手动输入
    UI.showWeatherError();
  },

  showManualTempInput() {
    UI.showManualInput();
  },

  setManualTemp() {
    const temp = parseFloat(document.getElementById('manual-temp-input').value);
    const condition = document.getElementById('manual-condition-input').value;
    if (isNaN(temp)) {
      alert('请输入有效温度');
      return;
    }
    UI.showWeatherData({
      temperature: temp,
      condition: condition,
      city: getSettings().defaultCity || '未知',
      humidity: 50,
    });
    saveSettings({ lastTemperature: temp, lastWeatherCondition: condition });
    this.generateHomeRecommendation(temp);
  },

  // ---------- 首页搭配推荐 ----------
  generateHomeRecommendation(temp) {
    const items = getWardrobe().filter(i => i.inActive);
    const settings = getSettings();
    const rec = OutfitEngine.getQuickRecommendation(items, temp, settings);
    UI.renderHomeOutfits(rec);
  },

  // ---------- 衣橱 ----------
  renderWardrobe(items, filter) {
    const f = filter || this._currentFilter;
    if (filter) this._currentFilter = filter;
    const allItems = items || getWardrobe().filter(i => i.inActive);
    UI.renderWardrobe(allItems, f);
  },

  // ---- 添加表单变化时实时更新预览 ----
  onAddFormChange() {
    const cat = document.getElementById('add-category').value;
    UI.populateStyleSelect('add-style', cat);
    UI.updateThicknessLabel('add-thickness', 'add-thickness-label');
    const style = document.getElementById('add-style').value;
    const fabric = document.getElementById('add-fabric').value;
    const thick = parseInt(document.getElementById('add-thickness').value);
    UI.updateTempPreview('add', cat, style, fabric, thick);
  },

  onEditFormChange() {
    const cat = document.getElementById('edit-category').value;
    UI.populateStyleSelect('edit-style', cat);
    UI.updateThicknessLabel('edit-thickness', 'edit-thickness-label');
    const style = document.getElementById('edit-style').value;
    const fabric = document.getElementById('edit-fabric').value;
    const thick = parseInt(document.getElementById('edit-thickness').value);
    UI.updateTempPreview('edit', cat, style, fabric, thick);
  },

  showAddItemModal() {
    UI.showAddItemModal();
  },

  closeAddItemModal() {
    UI.closeAddItemModal();
  },

  saveNewItem() {
    const data = UI.collectAddFormData();
    const error = document.getElementById('add-error');

    if (!data.name) { error.textContent = '请输入衣物名称'; error.style.display = 'block'; return; }
    error.style.display = 'none';

    // App 自动推算温度区间
    const range = calculateTempRange(data.category, data.style, data.fabric, data.thickness);
    const seasons = calculateSeasons(data.category, data.style, data.fabric, data.thickness);

    const item = {
      name: data.name,
      category: data.category,
      style: data.style,
      fabric: data.fabric,
      thickness: data.thickness,
      color: data.colorHex,
      colorName: data.colorName,
      suitableTempMin: range.min,
      suitableTempMax: range.max,
      suitableSeasons: seasons,
      styleTags: [],
    };

    addWardrobeItem(item);
    this.closeAddItemModal();
    this.renderWardrobe();
  },

  openEditItemModal(id) {
    const items = getWardrobe();
    const item = items.find(i => i.id === id);
    if (!item) return;
    // Store for reference
    this._editingId = id;
    UI.showEditItemModal(item);
  },

  closeEditItemModal() {
    this._editingId = null;
    UI.closeEditItemModal();
  },

  saveEditedItem() {
    const id = this._editingId;
    if (!id) return;

    const name = document.getElementById('edit-name').value.trim();
    const category = document.getElementById('edit-category').value;
    const style = document.getElementById('edit-style').value;
    const fabric = document.getElementById('edit-fabric').value;
    const thickness = parseInt(document.getElementById('edit-thickness').value);

    if (!name) { alert('请输入衣物名称'); return; }

    const range = calculateTempRange(category, style, fabric, thickness);
    const seasons = calculateSeasons(category, style, fabric, thickness);

    updateWardrobeItem(id, {
      name, category, style, fabric, thickness,
      suitableTempMin: range.min,
      suitableTempMax: range.max,
      suitableSeasons: seasons,
    });

    this._editingId = null;
    this.closeEditItemModal();
    this.renderWardrobe();
  },

  deleteEditingItem() {
    const id = this._editingId;
    if (!id) return;
    if (!confirm('确定删除这件衣物？')) return;
    deleteWardrobeItem(id);
    this._editingId = null;
    this.closeEditItemModal();
    this.renderWardrobe();
  },

  loadSamples() {
    const existing = getWardrobe();
    if (existing.length > 0) {
      if (!confirm('加载示例将添加示例数据到现有衣橱，继续吗？')) return;
    }
    const samples = getSampleItems();
    for (const s of samples) {
      addWardrobeItem(s);
    }
    this.renderWardrobe();
    // Also refresh home if current tab
    if (document.getElementById('page-home').classList.contains('active')) {
      this.refreshWeather();
    }
  },

  // ---------- 搭配 ----------
  generateOutfits() {
    const settings = getSettings();
    const temp = settings.lastTemperature;
    if (temp === null || temp === undefined) {
      alert('请先在首页获取温度数据');
      this.switchTab('home');
      return;
    }

    const items = getWardrobe().filter(i => i.inActive);
    if (items.length === 0) {
      alert('衣橱是空的，请先添加衣物');
      this.switchTab('wardrobe');
      return;
    }

    const results = OutfitEngine.generate(items, temp, settings);
    // 保存结果到全局
    this._lastOutfitResults = results;
    UI.renderOutfits(results);
  },

  renderOutfits() {
    if (this._lastOutfitResults) {
      UI.renderOutfits(this._lastOutfitResults);
    } else {
      UI.renderOutfits(null);
    }
  },

  saveCurrentOutfit(id) {
    const results = this._lastOutfitResults;
    if (!results) return;
    const outfit = results.find(r => r.id === id);
    if (!outfit) return;

    saveOutfit({
      items: outfit.items,
      temperature: outfit.temperature,
      reasoning: outfit.reasoning,
      score: outfit.score,
    });
    alert('搭配已保存！可在搭配页面查看');
  },

  // ---------- 个人 ----------
  loadProfile() {
    UI.loadProfile();
  },

  saveCity() {
    const city = document.getElementById('profile-city').value.trim();
    if (!city) { alert('请输入城市名'); return; }
    saveSettings({ defaultCity: city });
    alert('城市已保存');
  },

  saveApiKey() {
    const key = document.getElementById('profile-api-key').value.trim();
    saveSettings({ weatherApiKey: key });
    alert('API Key 已保存');
  },

  saveBodyData() {
    const height = parseInt(document.getElementById('profile-height').value);
    const weight = parseInt(document.getElementById('profile-weight').value);
    const bodyShape = document.getElementById('profile-body-shape').value;
    if (!height || !weight) { alert('请输入身高和体重'); return; }
    saveSettings({ heightCm: height, weightKg: weight, bodyShape });
    alert('身材数据已保存');
  },

  saveStylePreferences() {
    const selected = [];
    document.querySelectorAll('#style-tags .tag.selected').forEach(tag => {
      selected.push(tag.dataset.value);
    });
    saveSettings({ stylePreferences: selected });
    alert('风格偏好已保存');
  },

  clearAllData() {
    if (!confirm('确定清空所有数据？此操作不可恢复！')) return;
    localStorage.clear();
    this._lastOutfitResults = null;
    this.switchTab('home');
    alert('所有数据已清空');
  },

  // ---------- 刷新首页 ----------
  refreshHome() {
    this.refreshWeather();
  },
};

// ---------- 启动 ----------
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
