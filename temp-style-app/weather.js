// ============================================================
// weather.js - 天气服务 (OpenWeatherMap + 手动备选)
// ============================================================

const WeatherService = {
  // 尝试从 OpenWeatherMap 获取
  async fetchFromApi(city, apiKey) {
    if (!apiKey) return null;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=zh_cn`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      condition: this.mapCondition(data.weather[0].id),
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      city: data.name,
    };
  },

  // 使用缓存
  getCached() {
    const cache = getWeatherCache();
    if (!cache || !cache._cachedAt) return null;
    // 缓存 30 分钟内有效
    if (Date.now() - cache._cachedAt > 30 * 60 * 1000) return null;
    return cache;
  },

  setCache(data) {
    setWeatherCache(data);
  },

  mapCondition(weatherId) {
    if (weatherId >= 200 && weatherId < 300) return '雷暴';
    if (weatherId >= 300 && weatherId < 400) return '小雨';
    if (weatherId >= 500 && weatherId < 510) return '雨';
    if (weatherId >= 510 && weatherId < 600) return '大雨';
    if (weatherId >= 600 && weatherId < 700) return '雪';
    if (weatherId >= 700 && weatherId < 800) return '雾';
    if (weatherId === 800) return '晴';
    if (weatherId === 801 || weatherId === 802) return '多云';
    if (weatherId >= 803) return '阴';
    return '未知';
  },

  getConditionEmoji(condition) {
    const map = {
      '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌦',
      '雨': '🌧', '大雨': '🌧', '雷暴': '⛈', '雪': '❄️', '雾': '🌫',
    };
    return map[condition] || '☀️';
  },

  // 体感温度（简化版）
  calculateApparentTemp(temp, humidity, windSpeed) {
    if (temp > 27 && humidity > 40) {
      // 热指数
      return -8.784695 + 1.61139411 * temp + 2.338549 * humidity
        - 0.14611605 * temp * humidity - 0.012308094 * temp * temp
        - 0.016424828 * humidity * humidity
        + 0.002211732 * temp * temp * humidity
        + 0.00072546 * temp * humidity * humidity
        - 0.000003582 * temp * temp * humidity * humidity;
    }
    if (temp < 10 && windSpeed > 1.34) {
      const ws = windSpeed * 3.6;
      return 13.12 + 0.6215 * temp - 11.37 * Math.pow(ws, 0.16)
        + 0.3965 * temp * Math.pow(ws, 0.16);
    }
    return temp;
  },

  // 舒适度描述
  getComfortLevel(temp) {
    if (temp >= 35) return { level: 5, label: '酷热', advice: '尽量避免外出，注意防暑' };
    if (temp >= 30) return { level: 4, label: '炎热', advice: '建议穿短袖短裤，注意补水' };
    if (temp >= 25) return { level: 3, label: '温暖', advice: '轻薄衣物即可，体感舒适' };
    if (temp >= 20) return { level: 2, label: '舒适', advice: 'T恤或薄衬衫，非常舒适' };
    if (temp >= 15) return { level: 1, label: '微凉', advice: '建议加一件薄外套或开衫' };
    if (temp >= 10) return { level: 0, label: '凉爽', advice: '需要外套，卫衣或夹克合适' };
    if (temp >= 5) return { level: -1, label: '冷', advice: '穿厚外套，建议叠穿' };
    if (temp >= 0) return { level: -2, label: '寒冷', advice: '羽绒服+毛衣，注意保暖' };
    return { level: -3, label: '严寒', advice: '厚羽绒服，围巾手套必备' };
  },

  // 季节性穿搭原则
  getSeasonalAdvice(temp, season) {
    const comfort = this.getComfortLevel(temp);
    return comfort.advice;
  },
};
