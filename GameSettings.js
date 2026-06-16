/*
 * GameSettings.js — Tower Building (盖塔/堆塔)
 * 调参入口：所有高频变动的数值、机制开关、难度倍率、手感参数都集中在这里。
 * 必须先于 game.js 加载。运行时通过 getGameSetting("PATH.KEY", fallback) 读取，禁止裸数值。
 *
 * 归属（遵循 GAME_BUILD_SOP §3）：
 *   - 数值/倍率/开关 -> 本文件
 *   - 流程结构/内容表（里程碑事件、昼夜色阶、云位） -> spec/game.json
 *   - 资源路径 -> assets/manifest.json
 */
(function (global) {
  'use strict';

  var DEFAULT_GAME_SETTINGS = {
    // 调试开关：临时调试只改这里，不改系统代码
    DEBUG: {
      ENABLED: false,
      INVINCIBLE: false,      // 失败不计数
      SHOW_COLLISION: false,  // 绘制塔顶碰撞线
      SHOW_FPS: false,
      LOG: false,
      SKIP_TUTORIAL: false
    },

    // 核心规则
    CORE_RULES: {
      MAX_FAILS: 3,           // 累计失败次数 -> 结算
      CANVAS_RATIO: 1.5,      // 高/宽 目标比例
      SOUND_ON: true
    },

    // 方块（投放/堆叠件）
    BLOCK: {
      WIDTH_RATIO: 0.25,          // 相对画布宽
      HEIGHT_RATIO: 0.71,         // 相对方块宽
      GRAVITY_RATIO: 0.0003,      // 重力加速度 = pixelsPerFrame(GRAVITY_RATIO * height)
      DROP_ROPE_OFFSET: 0.3,      // 投放起点附加绳高比例
      PERFECT_BAND_MIN: 0.8,      // perfect 命中带（相对半宽）
      PERFECT_BAND_MAX: 1.2,
      CHEAT_WIDTH_RATIO: 0.3,     // 超出边界判定作弊 -> 进入 hardMode
      ROTATE_FALL_THRESHOLD: 1.3, // 旋转角超过即整体坠落（约 75°）
      ROTATE_SPEED_RAD: Math.PI * 4, // 悬空旋转角速度（rad/s）
      FALL_Y_RATIO: 0.7,          // 坠落竖直速度比例（相对画布高）
      FALL_X_RATIO: 0.3,          // 坠落水平速度比例（相对画布宽）
      MIN_ROTATE_RATIO: 0.5,      // 旋转比例下限
      SPAWN_Y_RATIO: -1.5         // 出生 y = ropeHeight * 该值
    },

    // 绳/钩
    ROPE: {
      HEIGHT_RATIO: 0.4,      // 相对画布高
      WIDTH_RATIO: 0.1,       // 相对绳高
      HARD_MODE_MIN: 0.35,    // hardMode 下每次成功后随机绳高区间
      HARD_MODE_MAX: 0.55
    },

    // 难度曲线（随楼层/成功数提升）。tiers: 命中第一个 floor < below 的档位
    DIFFICULTY: {
      ANGLE_TIERS: [
        { below: 10, value: 30 },
        { below: 20, value: 60 },
        { below: Infinity, value: 80 }
      ],
      ANGLE_HARD: 90,
      ANGLE_JITTER: 5,            // 初始摆角随机抖动（度）

      SWING_TIERS: [
        { below: 1, value: 0 },
        { below: 10, value: 1 },
        { below: 20, value: 0.8 },
        { below: 30, value: 0.7 },
        { below: Infinity, value: 0.74 }
      ],
      SWING_HARD: 1.1,
      SWING_PERIOD: 200,         // sin(time / (PERIOD / hard))

      LAND_DRIFT_TIERS: [
        { below: 5, value: 0 },
        { below: 13, value: 0.001 },
        { below: 23, value: 0.002 },
        { below: Infinity, value: 0.003 }
      ],
      LAND_DRIFT_PERIOD: 200,    // cos(time / PERIOD) * value * width

      MOVEDOWN_BLOCK_HEIGHTS: 2, // 每次落稳后塔下移 = 该值 * blockHeight
      MOVEDOWN_BOOST_BELOW: 4,   // 前若干层下移更快
      MOVEDOWN_BOOST: 1.25
    },

    // 计分
    SCORING: {
      SUCCESS_SCORE: 25,
      PERFECT_SCORE: 25          // perfect 连击线性叠加
    },

    // 云/石（装饰世界物）
    CLOUD: {
      SIZE_RATIO: 0.3,
      DRIFT_MIN: 0.05,
      DRIFT_MAX: 0.08,
      MOVEDOWN_MULT: 1.2,
      STONE_COUNT_THRESHOLD: 6,  // count > 该值 -> 用石头图，否则云图
      RESET_COUNT_STEP: 4,
      RESET_Y_RATIO: -0.66
    },

    // 背景（昼夜渐变 + 闪电）
    BACKGROUND: {
      GRADIENT_MOVEDOWN_MULT: 1.5,
      LIGHTNING_ALPHA: 0.7
    },

    // 里程碑飞行物速度倍率（事件触发表在 spec/game.json）
    FLIGHT: {
      BOTTOM_VY: 0.7,
      LEFT_VX: 0.4, LEFT_VY: 0.1,
      RIGHT_VX: 0.4, RIGHT_VY: 0.1,
      RIGHTTOP_VX: 0.6, RIGHTTOP_VY: 0.5
    },

    // 教程引导
    TUTORIAL: {
      WIDTH_RATIO: 0.2,
      HEIGHT_RATIO: 0.46,
      Y_RATIO: 0.45,
      BOB_RATIO: 0.01
    },

    // HUD
    HUD: {
      HEARTS: 3,
      GRADIENT_TOP: '#FAD961',
      GRADIENT_BOTTOM: '#F76B1C',
      STROKE: '#FFFFFF',
      FONT_NAME: 'wenxue'
    },

    // 手感/计时（time-movement 时长，单位 ms）
    FEEL: {
      MOVE_DURATION: 500,
      HOOK_DURATION: 500,
      TUTORIAL_DURATION: 500,
      BG_INIT_DURATION: 500,
      LIGHTNING_DURATION: 150,
      LIGHTNING_FLOORS: [10, 15]   // 这些楼层落稳触发闪电
    },

    // 音频
    AUDIO: {
      MASTER_VOLUME: 1.0,
      SFX_VOLUME: 0.8,
      BGM_VOLUME: 0.5,
      SFX_COOLDOWN_MS: 40          // 高频音效最小间隔，避免刺耳
    },

    // 性能上限（对象池）
    PERFORMANCE: {
      MAX_BLOCKS: 64,
      MAX_FLIGHTS: 7,
      MAX_CLOUDS: 4
    }
  };

  // ---- 标准能力 ----
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);
    var out = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = deepClone(obj[k]);
    }
    return out;
  }

  function deepMerge(base, override) {
    if (!override || typeof override !== 'object') return base;
    for (var k in override) {
      if (!Object.prototype.hasOwnProperty.call(override, k)) continue;
      if (override[k] && typeof override[k] === 'object' && !Array.isArray(override[k])
        && base[k] && typeof base[k] === 'object') {
        deepMerge(base[k], override[k]);
      } else {
        base[k] = deepClone(override[k]);
      }
    }
    return base;
  }

  var GAME_SETTINGS = deepClone(DEFAULT_GAME_SETTINGS);

  function getGameSetting(path, defaultValue) {
    if (defaultValue === undefined) defaultValue = null;
    if (!path) return defaultValue;
    var parts = String(path).split('.');
    var node = GAME_SETTINGS;
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== 'object' || !(parts[i] in node)) {
        return defaultValue;
      }
      node = node[parts[i]];
    }
    return node === undefined ? defaultValue : node;
  }

  function setGameSetting(path, value) {
    var parts = String(path).split('.');
    var node = GAME_SETTINGS;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) {
        node[parts[i]] = {};
      }
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    return value;
  }

  function reloadGameSettings(overrides) {
    GAME_SETTINGS = deepClone(DEFAULT_GAME_SETTINGS);
    if (overrides) deepMerge(GAME_SETTINGS, overrides);
    global.GAME_SETTINGS = GAME_SETTINGS;
    return GAME_SETTINGS;
  }

  global.DEFAULT_GAME_SETTINGS = DEFAULT_GAME_SETTINGS;
  global.GAME_SETTINGS = GAME_SETTINGS;
  global.getGameSetting = getGameSetting;
  global.setGameSetting = setGameSetting;
  global.reloadGameSettings = reloadGameSettings;
})(typeof window !== 'undefined' ? window : this);
