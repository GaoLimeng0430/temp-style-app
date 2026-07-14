// ============================================================
// ui.js - UI 渲染 & 事件绑定
// ============================================================

const UI = {
  // ---------- Navigation ----------
  initNav() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        app.switchTab(tab);
      });
    });
  },

  switchTab(tab) {
    // Nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
    // Pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${tab}`);
    if (page) {
      page.classList.add('active');
      document.getElementById('main-content').scrollTop = 0;
    }
    // Header
    const titles = { home: '温度感知穿搭', wardrobe: '我的衣橱', outfits: '搭配推荐', profile: '我的' };
    document.querySelector('#header-title span').textContent = titles[tab] || '';
    // Refresh content
    if (tab === 'home') app.refreshHome();
    if (tab === 'wardrobe') app.renderWardrobe();
    if (tab === 'outfits') app.renderOutfits();
    if (tab === 'profile') app.loadProfile();
  },

  // ---------- Weather ----------
  showWeatherLoading() {
    document.getElementById('weather-loading').style.display = 'block';
    document.getElementById('weather-content').style.display = 'none';
    document.getElementById('weather-error').style.display = 'none';
    document.getElementById('weather-manual').style.display = 'none';
  },

  showWeatherData(data) {
    document.getElementById('weather-loading').style.display = 'none';
    document.getElementById('weather-content').style.display = 'block';
    document.getElementById('weather-error').style.display = 'none';
    document.getElementById('weather-manual').style.display = 'none';

    document.getElementById('weather-temp').textContent = `${Math.round(data.temperature)}°`;
    document.getElementById('weather-icon').textContent = WeatherService.getConditionEmoji(data.condition);
    document.getElementById('weather-city').textContent = data.city;
    document.getElementById('weather-condition').textContent = data.condition;
    document.getElementById('weather-humidity').textContent = `湿度: ${data.humidity}%`;

    const comfort = WeatherService.getComfortLevel(data.temperature);
    document.getElementById('weather-advice').textContent = `${comfort.label} · ${comfort.advice}`;
  },

  showWeatherError() {
    document.getElementById('weather-loading').style.display = 'none';
    document.getElementById('weather-content').style.display = 'none';
    document.getElementById('weather-error').style.display = 'flex';
    document.getElementById('weather-manual').style.display = 'none';
  },

  showManualInput() {
    document.getElementById('weather-loading').style.display = 'none';
    document.getElementById('weather-content').style.display = 'none';
    document.getElementById('weather-error').style.display = 'none';
    document.getElementById('weather-manual').style.display = 'flex';
  },

  // ---------- Wardrobe ----------
  renderWardrobe(items, filter) {
    const grid = document.getElementById('wardrobe-grid');
    const empty = document.getElementById('wardrobe-empty');
    const allItems = items || getWardrobe().filter(i => i.inActive);

    let filtered = allItems;
    if (filter && filter !== 'all') {
      filtered = allItems.filter(i => i.category === filter);
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    grid.innerHTML = filtered.map(item => this.clothingCardHTML(item)).join('');

    // Click to edit
    grid.querySelectorAll('.clothing-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        app.openEditItemModal(id);
      });
    });
  },

  clothingCardHTML(item) {
    const color = item.color || '#CCCCCC';
    const thicknessMap = { 1: '极薄', 2: '偏薄', 3: '适中', 4: '偏厚', 5: '加厚' };
    const style = item.style || '';
    const thicknessLabel = thicknessMap[item.thickness] || '';

    return `
      <div class="clothing-card" data-id="${item.id}">
        <div class="color-bar" style="background:${color};"></div>
        <div class="item-category">${CATEGORY_ICONS[item.category] || ''} ${CATEGORY_LABELS[item.category] || item.category}</div>
        <div class="item-name">${item.name}</div>
        <div class="item-detail">${item.fabric} · ${item.colorName || '●'} ${style ? '· ' + style : ''} ${thicknessLabel ? '· ' + thicknessLabel : ''}</div>
        <div class="item-temp">🌡 ${item.suitableTempMin}°C ~ ${item.suitableTempMax}°C</div>
      </div>
    `;
  },

  // ---------- Outfits ----------
  renderOutfits(results) {
    const list = document.getElementById('outfits-list');
    const empty = document.getElementById('outfits-empty');

    if (!results || results.length === 0) {
      const saved = getSavedOutfits();
      if (saved.length > 0) {
        list.innerHTML = saved.map(o => this.savedOutfitHTML(o)).join('');
        empty.style.display = 'none';
      } else {
        list.innerHTML = '';
        empty.style.display = 'block';
      }
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = results.map(r => this.outfitCardHTML(r)).join('');

    // Bind favorite buttons
    list.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const isFav = toggleFavoriteOutfit(id);
        btn.textContent = isFav ? '❤️' : '🤍';
        btn.classList.toggle('active', isFav);
      });
    });
  },

  outfitCardHTML(result) {
    const id = result.id || generateId();
    const itemsHTML = result.items.map(item => `
      <span class="outfit-tag">
        <span class="tag-color-dot" style="background:${item.color || '#ccc'};"></span>
        ${CATEGORY_ICONS[item.category] || ''} ${item.name}
      </span>
    `).join('');

    const reasonLines = (result.reasoning || '').split('\n').map(l => `<div>${l}</div>`).join('');

    return `
      <div class="outfit-card">
        <div class="outfit-header">
          <span class="outfit-title">🌡 ${result.temperature}°C 推荐搭配</span>
          <span class="outfit-temp-badge">评分 ${result.score}</span>
        </div>
        <div class="outfit-body">${itemsHTML}</div>
        <div class="outfit-reason">${reasonLines}</div>
        <div class="outfit-actions">
          <button class="btn btn-sm btn-outline" onclick="app.saveCurrentOutfit('${id}')">💾 保存</button>
          <button class="fav-btn" data-id="${id}">🤍</button>
        </div>
      </div>
    `;
  },

  savedOutfitHTML(outfit) {
    const itemsHTML = (outfit.items || []).map(item => `
      <span class="outfit-tag">
        <span class="tag-color-dot" style="background:${item.color || '#ccc'};"></span>
        ${item.name}
      </span>
    `).join('');
    const dateStr = outfit.createdAt ? new Date(outfit.createdAt).toLocaleDateString() : '已保存';

    return `
      <div class="outfit-card">
        <div class="outfit-header">
          <span class="outfit-title">📅 ${dateStr}</span>
          ${outfit.temperature ? `<span class="outfit-temp-badge">${outfit.temperature}°C</span>` : ''}
        </div>
        <div class="outfit-body">${itemsHTML}</div>
        ${outfit.reasoning ? `<div class="outfit-reason">${outfit.reasoning.split('\n').map(l => `<div>${l}</div>`).join('')}</div>` : ''}
        <div class="outfit-actions">
          <button class="fav-btn" data-id="${outfit.id}">${outfit.isFavorite ? '❤️' : '🤍'}</button>
        </div>
      </div>
    `;
  },

  // ---------- Home Quick Outfits ----------
  renderHomeOutfits(recommendation) {
    const container = document.getElementById('home-outfits');
    if (!recommendation || !recommendation.hasOutfit) {
      container.innerHTML = `<p class="text-muted">${recommendation?.message || '暂无推荐，请先添加衣物'}</p>`;
      return;
    }

    const outfit = recommendation.outfit;
    const itemsHTML = outfit.items.map(item => `
      <span class="outfit-item-tag">${CATEGORY_ICONS[item.category] || ''} ${item.name}</span>
    `).join('');

    container.innerHTML = `
      <div class="outfit-card-mini">
        <div class="outfit-items">${itemsHTML}</div>
        <div class="outfit-reason">${outfit.reasoning?.split('\n')[0] || ''}</div>
      </div>
    `;
  },

  // ---------- Profile ----------
  loadProfile(settings) {
    const s = settings || getSettings();
    document.getElementById('profile-city').value = s.defaultCity || '';
    document.getElementById('profile-api-key').value = s.weatherApiKey || '';
    document.getElementById('profile-height').value = s.heightCm || '';
    document.getElementById('profile-weight').value = s.weightKg || '';
    document.getElementById('profile-body-shape').value = s.bodyShape || '';

    // Style tags
    document.querySelectorAll('#style-tags .tag').forEach(tag => {
      const val = tag.dataset.value;
      tag.classList.toggle('selected', (s.stylePreferences || []).includes(val));
    });
  },

  // ---------- Modal ----------
  initModals() {
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
        }
      });
    });

    // Color picker
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        dot.parentElement.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
        const colorInput = dot.closest('.modal-body')?.querySelector('#add-color-text');
        if (colorInput) colorInput.value = dot.title || dot.style.backgroundColor;
      });
    });
  },

  // ---- 款式下拉同步 ----
  populateStyleSelect(selectId, category) {
    const select = document.getElementById(selectId);
    const styles = CATEGORY_STYLES[category] || ['default'];
    select.innerHTML = styles.map(s => `<option value="${s}">${s === 'default' ? '通用' : s}</option>`).join('');
  },

  // ---- 厚度标签更新 ----
  updateThicknessLabel(inputId, labelId) {
    const val = parseInt(document.getElementById(inputId).value);
    const labels = { 1: '极薄', 2: '偏薄', 3: '适中', 4: '偏厚', 5: '加厚' };
    document.getElementById(labelId).textContent = labels[val] || '适中';
  },

  // ---- 温度预览更新 ----
  updateTempPreview(prefix, category, style, fabric, thickness) {
    const range = calculateTempRange(category, style, fabric, thickness);
    const seasons = calculateSeasons(category, style, fabric, thickness);
    const seasonMap = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

    document.getElementById(`${prefix}-temp-range`).textContent = `${range.min}°C ~ ${range.max}°C`;

    const tagsEl = document.getElementById(`${prefix}-season-tags`);
    tagsEl.innerHTML = seasons.map(s => `<span>${seasonMap[s] || s}</span>`).join('');
  },

  // ---- 收集添加表单数据 ----
  collectAddFormData() {
    return {
      name: document.getElementById('add-name').value.trim(),
      category: document.getElementById('add-category').value,
      style: document.getElementById('add-style').value,
      fabric: document.getElementById('add-fabric').value,
      thickness: parseInt(document.getElementById('add-thickness').value),
      colorHex: document.querySelector('#color-picker .color-dot.selected')?.dataset?.color || '#CCCCCC',
      colorName: document.getElementById('add-color-text').value.trim() || '',
    };
  },

  showAddItemModal() {
    document.getElementById('add-item-modal').style.display = 'flex';
    document.getElementById('add-name').value = '';
    document.getElementById('add-category').value = 'top';
    document.getElementById('add-fabric').value = '棉';
    document.getElementById('add-thickness').value = 3;
    document.getElementById('add-color-text').value = '';
    document.getElementById('add-error').style.display = 'none';
    document.querySelectorAll('#color-picker .color-dot').forEach(d => d.classList.remove('selected'));
    // Init style dropdown
    UI.populateStyleSelect('add-style', 'top');
    UI.updateThicknessLabel('add-thickness', 'add-thickness-label');
    UI.updateTempPreview('add', 'top', '短袖', '棉', 3);
  },

  closeAddItemModal() {
    document.getElementById('add-item-modal').style.display = 'none';
  },

  showEditItemModal(item) {
    document.getElementById('edit-item-modal').style.display = 'flex';
    document.getElementById('edit-name').value = item.name || '';
    document.getElementById('edit-category').value = item.category || 'top';
    document.getElementById('edit-fabric').value = item.fabric || '棉';
    document.getElementById('edit-thickness').value = item.thickness || 3;
    // Populate style and set correct value
    UI.populateStyleSelect('edit-style', item.category || 'top');
    document.getElementById('edit-style').value = item.style || '短袖';
    UI.updateThicknessLabel('edit-thickness', 'edit-thickness-label');
    UI.updateTempPreview('edit', item.category || 'top', item.style || '短袖', item.fabric || '棉', item.thickness || 3);
    document.getElementById('edit-item-modal').dataset.editId = item.id;
  },

  closeEditItemModal() {
    document.getElementById('edit-item-modal').style.display = 'none';
  },

  // ---------- Filter Chips ----------
  initFilters() {
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        app.renderWardrobe(getWardrobe(), chip.dataset.filter);
      });
    });
  },
};
