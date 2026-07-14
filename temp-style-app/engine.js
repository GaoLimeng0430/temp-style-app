// ============================================================
// engine.js - 穿搭规则引擎
// ============================================================

const OutfitEngine = {
  // 主入口：生成搭配组合
  generate(items, temperature, settings) {
    const temp = temperature ?? 20;
    const prefs = settings?.stylePreferences || [];
    const bodyShape = settings?.bodyShape || '';
    const season = getSeasonByTemp(temp);

    // 1. 筛选适温单品
    const suitable = this.filterByTemperature(items, temp);

    // 2. 按品类分组
    const grouped = this.groupByCategory(suitable);

    // 3. 生成组合
    const combinations = this.buildCombinations(grouped, temp, season, prefs, bodyShape);

    // 4. 排序
    combinations.sort((a, b) => b.score - a.score);

    return combinations;
  },

  // 按温度筛选
  filterByTemperature(items, temp) {
    return items.filter(item => {
      if (!item.inActive) return false;
      return temp >= item.suitableTempMin && temp <= item.suitableTempMax;
    });
  },

  // 按品类分组
  groupByCategory(items) {
    const groups = {};
    for (const item of items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  },

  // 构建搭配组合
  buildCombinations(groups, temp, season, prefs, bodyShape) {
    const tops = groups.top || [];
    const bottoms = groups.bottom || [];
    const outerwears = groups.outerwear || [];
    const dresses = groups.dress || [];
    const shoes = groups.shoes || [];
    const accessories = groups.accessory || [];
    const results = [];

    // 组合 1: 上装 + 下装 (必需) + 可选外套 + 可选鞋 + 可选配饰
    const coreTops = tops.length > 0 ? tops : [null];
    const coreBottoms = bottoms.length > 0 ? bottoms : [null];
    const coreDresses = dresses.length > 0 ? dresses : [null];
    const coreShoes = shoes.length > 0 ? shoes : [null];

    // 最多生成 6 套
    let count = 0;
    const maxResults = 6;

    // 如果有连衣裙，优先用连衣裙
    if (coreDresses[0]) {
      for (const dress of coreDresses) {
        if (count >= maxResults) break;
        const combo = {
          items: [dress],
          temperature: temp,
          season: season,
          score: 0,
        };
        // 加外套
        if (outerwears.length > 0) {
          const bestOuter = this.pickBestMatch(outerwears, dress, temp);
          if (bestOuter) combo.items.push(bestOuter);
        }
        // 加鞋子
        if (coreShoes[0]) {
          combo.items.push(this.pickBestMatch(coreShoes, dress, temp) || coreShoes[0]);
        }
        combo.score = this.calculateScore(combo.items, temp, prefs, bodyShape, season);
        combo.reasoning = this.generateReasoning(combo, temp, season);
        results.push(combo);
        count++;
      }
    }

    // 上装 + 下装 组合
    for (const top of coreTops) {
      if (count >= maxResults || !top) break;
      for (const bottom of coreBottoms) {
        if (count >= maxResults || !bottom) break;
        const combo = {
          items: [top, bottom],
          temperature: temp,
          season: season,
          score: 0,
        };
        // 加外套
        if (outerwears.length > 0 && temp <= 22) {
          const bestOuter = this.pickBestMatch(outerwears, [...combo.items], temp);
          if (bestOuter) combo.items.push(bestOuter);
        }
        // 加鞋子
        if (coreShoes[0] && !combo.items.some(i => i.category === 'shoes')) {
          combo.items.push(this.pickBestMatch(coreShoes, combo.items, temp) || coreShoes[0]);
        }
        combo.score = this.calculateScore(combo.items, temp, prefs, bodyShape, season);
        combo.reasoning = this.generateReasoning(combo, temp, season);
        results.push(combo);
        count++;
      }
    }

    return results;
  },

  // 选取最佳搭配单品
  pickBestMatch(candidates, existingItems, temp) {
    let best = null;
    let bestScore = -Infinity;
    const existing = Array.isArray(existingItems) ? existingItems : [existingItems];

    for (const candidate of candidates) {
      if (existing.some(e => e && e.id === candidate.id)) continue;
      let score = 0;
      // 温度匹配度
      const mid = (candidate.suitableTempMin + candidate.suitableTempMax) / 2;
      score -= Math.abs(temp - mid) * 0.5;
      // 颜色协调（简单规则：避免完全相同颜色）
      for (const exist of existing) {
        if (exist && exist.color === candidate.color) score -= 3;
      }
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  },

  // 计算组合得分
  calculateScore(items, temp, prefs, bodyShape, season) {
    let score = 50; // 基础分

    // 1. 温度匹配度
    for (const item of items) {
      const mid = (item.suitableTempMin + item.suitableTempMax) / 2;
      const diff = Math.abs(temp - mid);
      const range = item.suitableTempMax - item.suitableTempMin;
      const matchRatio = range > 0 ? 1 - (diff / range) : 0;
      score += matchRatio * 20;
    }

    // 2. 季节匹配
    for (const item of items) {
      if (item.suitableSeasons && item.suitableSeasons.includes(season)) {
        score += 5;
      }
    }

    // 3. 风格偏好匹配
    if (prefs && prefs.length > 0) {
      for (const item of items) {
        const matched = item.styleTags
          ? prefs.some(p => item.styleTags.some(t => t.includes(p) || p.includes(t)))
          : false;
        if (matched) score += 8;
      }
    }

    // 4. 品类完整度
    const cats = items.map(i => i.category);
    if (cats.includes('top') && cats.includes('bottom')) score += 10;
    if (cats.includes('outerwear') && temp <= 18) score += 8;
    if (cats.includes('shoes')) score += 5;
    if (cats.includes('accessory')) score += 3;

    // 5. 面料适温惩罚
    for (const item of items) {
      const warmth = getFabricWarmth(item.fabric);
      if (temp > 28 && warmth >= 4) score -= 10;
      if (temp < 10 && warmth <= 1) score -= 10;
      if (temp > 25 && warmth <= 2) score += 5;
      if (temp < 5 && warmth >= 4) score += 5;
    }

    return Math.round(score);
  },

  // 生成搭配说明
  generateReasoning(combo, temp, season) {
    const items = combo.items;
    const parts = [];

    // 温度说明
    const comfort = WeatherService.getComfortLevel(temp);
    parts.push(`今日 ${temp}°C，${comfort.label}`);

    // 品类组合
    const catLabels = items.map(i => `${CATEGORY_ICONS[i.category] || ''} ${i.name}`);
    parts.push(`搭配: ${catLabels.join(' + ')}`);

    // 面料建议
    const fabrics = [...new Set(items.map(i => i.fabric))];
    if (fabrics.length > 0) {
      if (temp > 25 && fabrics.some(f => ['棉', '亚麻', '真丝'].includes(f))) {
        parts.push('✅ 面料透气舒适，适合当前温度');
      } else if (temp < 10 && fabrics.some(f => ['羊毛', '皮革', '牛仔布'].includes(f))) {
        parts.push('✅ 面料保暖性好，适合当前温度');
      }
    }

    // 颜色协调
    const colors = items.map(i => i.color).filter(Boolean);
    if (colors.length >= 2) {
      const uniqueColors = [...new Set(colors)];
      if (uniqueColors.length === 1) {
        parts.push('💡 同色系搭配，简约高级');
      } else if (uniqueColors.length === 2) {
        parts.push('💡 双色搭配，干净利落');
      } else {
        parts.push('💡 多色搭配，层次丰富');
      }
    }

    // 体型建议
    const settings = getSettings();
    if (settings.bodyShape) {
      const shapeAdvice = {
        '梨形': '上浅下深视觉平衡',
        '苹果型': 'V领+直筒裤修饰身形',
        '沙漏型': '收腰设计突出曲线',
        '矩形': '叠穿增加层次感',
        '倒三角': '上深下浅视觉平衡',
      };
      if (shapeAdvice[settings.bodyShape]) {
        parts.push(`📐 ${settings.bodyShape}: ${shapeAdvice[settings.bodyShape]}`);
      }
    }

    return parts.join('\n');
  },

  // 为首页生成快速推荐
  getQuickRecommendation(items, temperature, settings) {
    const results = this.generate(items, temperature, settings);
    if (results.length === 0) {
      return {
        hasOutfit: false,
        message: '衣橱中暂无适合今日温度的衣物，快去添加吧！',
      };
    }
    const best = results[0];
    return {
      hasOutfit: true,
      outfit: best,
      summary: `${best.items.map(i => i.name).join(' + ')}`,
    };
  },
};
