/*
 * game.js — Tower Building (盖塔/堆塔) H5
 * 无构建、无外部框架、纯静态。内联精简引擎（移植 cooljs 用到的子集）+ 分层系统 +
 * 状态机 + 对象池 + 移植玩法。所有可调数值读 GameSettings.js，资源走 assets/manifest.json。
 *
 * 分层（GAME_BUILD_SOP §5）：MiniEngine(循环/实例/时间补间/资源/音频/输入) +
 * GameRuntime(状态机) + Spawn/Render/Hud + Hook/Block/TowerLine/Background/Cloud/Flight/Tutorial。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 枚举 / 常量（禁止散落字符串魔法值）
  // ---------------------------------------------------------------------------
  var STATES = { LOADING: 'LOADING', MENU: 'MENU', PLAYING: 'PLAYING', GAMEOVER: 'GAMEOVER', PAUSED: 'PAUSED' };
  var BLOCK = { SWING: 'SWING', BEFORE_DROP: 'BEFORE_DROP', DROP: 'DROP', LAND: 'LAND', ROTATE_LEFT: 'ROTATE_LEFT', ROTATE_RIGHT: 'ROTATE_RIGHT', OUT: 'OUT' };
  var MOVE = { BG_INIT: 'BG_INIT', HOOK_DOWN: 'HOOK_DOWN', HOOK_UP: 'HOOK_UP', LIGHTNING: 'LIGHTNING', TUTORIAL: 'TUTORIAL', MOVE_DOWN: 'MOVE_DOWN' };
  var LAYER = { FLIGHT: 'flight', DEFAULT: 'default' };
  var V = {
    blockCount: 'BLOCK_COUNT', successCount: 'SUCCESS_COUNT', failedCount: 'FAILED_COUNT',
    perfectCount: 'PERFECT_COUNT', gameScore: 'GAME_SCORE', hardMode: 'HARD_MODE',
    blockWidth: 'BLOCK_WIDTH', blockHeight: 'BLOCK_HEIGHT', cloudSize: 'CLOUD_SIZE',
    ropeHeight: 'ROPE_HEIGHT', initialAngle: 'INITIAL_ANGLE',
    bgImgOffset: 'BG_IMG_OFFSET', lineInitialOffset: 'LINE_INITIAL_OFFSET', bgGradOffset: 'BG_GRAD_OFFSET'
  };
  var SAVE_KEY = 'towerGame:v1';
  var SAVE_VERSION = 1;
  var LOG_PREFIX = '[Runtime]';

  // ---------------------------------------------------------------------------
  // 工具
  // ---------------------------------------------------------------------------
  var now = function () { return performance.now(); };
  var random = function (min, max) { return Math.random() * (max - min) + min; };
  var randPN = function () { return Math.random() < 0.5 ? -1 : 1; };
  var raf = window.requestAnimationFrame.bind(window);

  var Tween = {
    linear: function (t, b, c, d) { return c * t / d + b; },
    easeIn: function (t, b, c, d) { return c * (t /= d) * t + b; },
    easeOut: function (t, b, c, d) { return -c * (t /= d) * (t - 2) + b; },
    easeInOut: function (t, b, c, d) { if ((t /= d / 2) < 1) return c / 2 * t * t + b; return -c / 2 * ((--t) * (t - 2) - 1) + b; }
  };

  function get(path, fallback) { return window.getGameSetting ? window.getGameSetting(path, fallback) : fallback; }
  function log() { if (get('DEBUG.LOG', false)) console.log.apply(console, arguments); }

  // 编码四域路径（含空格与 &）
  function encodePath(p) {
    return p.split('/').map(function (seg) { return encodeURIComponent(seg); }).join('/');
  }

  // 难度档：返回第一个 floor < tier.below 的 value
  function tierValue(tiers, floor) {
    for (var i = 0; i < tiers.length; i++) { if (floor < tiers[i].below) return tiers[i].value; }
    return tiers[tiers.length - 1].value;
  }

  // ---------------------------------------------------------------------------
  // Instance（移植 cooljs instance.js）
  // ---------------------------------------------------------------------------
  function makeInstance(opt) {
    return {
      name: opt.name, x: 0, y: 0, width: 0, height: 0, calWidth: 0, calHeight: 0,
      ax: 0, ay: 0, vx: 0, vy: 0, visible: true, ready: false,
      action: opt.action || null, painter: opt.painter || null,
      updateWidth: function (w) { this.width = w; this.calWidth = w / 2; },
      updateHeight: function (h) { this.height = h; this.calHeight = h / 2; },
      update: function (engine, time) { if (this.action) this.action(this, engine, time); },
      paint: function (engine) { if (this.painter && this.visible) this.painter(this, engine); }
    };
  }

  // ---------------------------------------------------------------------------
  // MiniEngine（移植 cooljs engine.js 用到的子集）
  // ---------------------------------------------------------------------------
  function MiniEngine(opt) {
    var w = opt.width, h = opt.height;
    this.canvas = opt.canvas;
    this.highResolution = !!opt.highResolution;
    if (this.highResolution) {
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      w *= 2; h *= 2;
    }
    this.canvas.width = w; this.canvas.height = h;
    this.width = w; this.height = h;
    this.calWidth = w / 2; this.calHeight = h / 2;
    this.ctx = this.canvas.getContext('2d');
    this.soundOn = !!opt.soundOn;
    this.debug = get('DEBUG.ENABLED', false);

    this.layerArr = [LAYER.DEFAULT];
    this.instancesObj = {}; this.instancesObj[LAYER.DEFAULT] = [];
    this.vars = {};
    this.utils = { random: random, randomPositiveNegative: randPN };

    this.assetsObj = { image: {}, audio: {} };
    this._sfxLastPlayed = {};

    this.fps = 60; this.lastTime = 0; this.pausedTime = 0; this.lastPausedAt = 0;
    this.paused = false;
    this.timeMovement = {}; this.timeMovementStartArr = []; this.timeMovementFinishArr = [];

    // 帧钩子（GameRuntime 注入）
    this.paintUnderInstance = function () {};
    this.onFrame = function () {};
    this.onOverlay = function () {};
  }

  MiniEngine.prototype.pixelsPerFrame = function (v) { return v / this.fps; };

  // 变量存储（保留 cooljs 的 truthy 语义，玩法移植零风险）
  MiniEngine.prototype.setVariable = function (k, val) { this.vars[k] = val; };
  MiniEngine.prototype.getVariable = function (k, def) {
    if (def === undefined) def = null;
    var v = this.vars[k];
    if (v) return v;
    if (def !== null) { this.vars[k] = def; return def; }
    return null;
  };

  // 资源
  MiniEngine.prototype.addImg = function (name, img) { this.assetsObj.image[name] = img; };
  MiniEngine.prototype.getImg = function (name) { return this.assetsObj.image[name]; };
  MiniEngine.prototype.addAudio = function (name, a) { this.assetsObj.audio[name] = a; };
  MiniEngine.prototype.getAudio = function (name) { return this.assetsObj.audio[name]; };

  MiniEngine.prototype.playAudio = function (name, loop) {
    if (!this.soundOn) return;
    var a = this.getAudio(name);
    if (!a) return;
    // 高频音效冷却，避免每次 new Audio / 刺耳重叠
    var cooldown = get('AUDIO.SFX_COOLDOWN_MS', 40);
    var t = now();
    if (!loop && this._sfxLastPlayed[name] && (t - this._sfxLastPlayed[name]) < cooldown) return;
    this._sfxLastPlayed[name] = t;
    var master = get('AUDIO.MASTER_VOLUME', 1);
    a.volume = master * (loop ? get('AUDIO.BGM_VOLUME', 0.5) : get('AUDIO.SFX_VOLUME', 0.8));
    a.loop = !!loop;
    try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  };
  MiniEngine.prototype.pauseAudio = function (name) { var a = this.getAudio(name); if (a) { try { a.pause(); } catch (e) {} } };

  // 分层 / 实例
  MiniEngine.prototype.addLayer = function (layer) { this.layerArr.push(layer); this.instancesObj[layer] = []; };
  MiniEngine.prototype.swapLayer = function (i, j) { var t = this.layerArr[j]; this.layerArr[j] = this.layerArr[i]; this.layerArr[i] = t; };
  MiniEngine.prototype.addInstance = function (inst, layer) { this.instancesObj[layer || LAYER.DEFAULT].push(inst); };
  MiniEngine.prototype.getInstance = function (name, layer) {
    var arr = this.instancesObj[layer || LAYER.DEFAULT];
    for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) return arr[i]; }
    return undefined;
  };
  MiniEngine.prototype.removeInstance = function (name, layer) {
    var l = layer || LAYER.DEFAULT;
    this.instancesObj[l] = this.instancesObj[l].filter(function (i) { return i.name !== name; });
  };
  MiniEngine.prototype.updateInstances = function (time) {
    var self = this;
    this.layerArr.forEach(function (l) { self.instancesObj[l].forEach(function (i) { i.update(self, time); }); });
  };
  MiniEngine.prototype.paintInstances = function () {
    var self = this;
    this.layerArr.forEach(function (l) { self.instancesObj[l].forEach(function (i) { i.paint(self); }); });
  };

  // 时间补间（移植 cooljs setTimeMovement / getTimeMovement / checkTimeMovement / tick）
  MiniEngine.prototype.setTimeMovement = function (name, duration) {
    var t = now();
    this.timeMovement[name] = { startTime: t, endTime: t + duration, duration: duration, store: {} };
  };
  MiniEngine.prototype.checkTimeMovement = function (name) {
    var m = this.timeMovement[name] || {};
    return now() <= m.endTime;
  };
  MiniEngine.prototype.getTimeMovement = function (name, value, render, option) {
    option = option || {};
    var timingFunc = Tween[option.easing || 'linear'];
    var instName = option.name || 'default';
    var m = this.timeMovement[name];
    if (!m) return;
    // 按实例惰性初始化 store：每个 instName 首帧捕获 start/end。
    // 不能仅用 m.processing 判断——同一 movement 可能被某实例先翻转为 processing，
    // 而另一实例（如 background）尚未注册自己的 store，否则后续 .map 会读到 undefined。
    if (!m.store[instName]) {
      var entries = [];
      value.forEach(function (v) { entries.push({ start: parseFloat(v[0]), end: parseFloat(v[1]) }); });
      m.store[instName] = entries;
      if (!m.processing) this.timeMovementStartArr.push(name);
      if (option.before) option.before();
    }
    var self = this;
    var processRender = function (last) {
      var t = m.duration;
      if (!last) t = now() - m.startTime;
      var values = m.store[instName].map(function (v) { return timingFunc(t, v.start, v.end - v.start, m.duration); });
      render.apply(self, values);
    };
    if (this.checkTimeMovement(name)) {
      processRender(false);
    } else {
      this.timeMovementFinishArr.push(name);
      processRender(true);
      if (option.after) option.after();
    }
  };
  MiniEngine.prototype.tickTimeMovement = function () {
    var self = this;
    this.timeMovementStartArr.forEach(function (n) { if (self.timeMovement[n]) self.timeMovement[n].processing = true; });
    this.timeMovementStartArr = [];
    this.timeMovementFinishArr.forEach(function (n) { delete self.timeMovement[n]; });
    this.timeMovementFinishArr = [];
  };

  MiniEngine.prototype.togglePaused = function () {
    var t = now();
    this.paused = !this.paused;
    if (this.paused) this.lastPausedAt = t; else this.pausedTime += (t - this.lastPausedAt);
  };

  MiniEngine.prototype._tick = function (time) {
    this.fps = this.lastTime === 0 ? 60 : 1000 / (time - this.lastTime);
    if (!isFinite(this.fps) || this.fps <= 0) this.fps = 60;
    this.lastTime = time;
  };

  MiniEngine.prototype.start = function () {
    var self = this;
    raf(function loop(t) {
      var gameTime = t - self.pausedTime;
      if (self.paused) { setTimeout(function () { raf(loop); }, 100); return; }
      self._tick(gameTime);
      self.ctx.clearRect(0, 0, self.width, self.height);
      self.onFrame(self, gameTime);        // 背景 + 实例更新/绘制 + spawn（由 runtime 决定）
      self.onOverlay(self, gameTime);      // HUD / 状态界面
      self.tickTimeMovement();
      raf(loop);
    });
  };

  // ===========================================================================
  // 难度曲线（移植 utils.js，读 GameSettings）
  // ===========================================================================
  function floorOf(e) { return Number(e.getVariable(V.successCount, 0)); }

  function getMoveDownValue(e, store) {
    var ppf = store ? store.pixelsPerFrame : e.pixelsPerFrame.bind(e);
    var floor = floorOf(e);
    var calHeight = e.getVariable(V.blockHeight) * get('DIFFICULTY.MOVEDOWN_BLOCK_HEIGHTS', 2);
    if (floor <= get('DIFFICULTY.MOVEDOWN_BOOST_BELOW', 4)) return ppf(calHeight * get('DIFFICULTY.MOVEDOWN_BOOST', 1.25));
    return ppf(calHeight);
  }
  function checkMoveDown(e) { return e.checkTimeMovement(MOVE.MOVE_DOWN); }

  function getAngleBase(e) {
    if (e.getVariable(V.hardMode)) return get('DIFFICULTY.ANGLE_HARD', 90);
    return tierValue(get('DIFFICULTY.ANGLE_TIERS', []), floorOf(e));
  }
  function getSwingVelocity(e, time) {
    var hard = tierValue(get('DIFFICULTY.SWING_TIERS', []), floorOf(e));
    if (e.getVariable(V.hardMode)) hard = get('DIFFICULTY.SWING_HARD', 1.1);
    if (hard === 0) return 0;
    return Math.sin(time / (get('DIFFICULTY.SWING_PERIOD', 200) / hard));
  }
  function getLandDrift(e, time) {
    var hard = tierValue(get('DIFFICULTY.LAND_DRIFT_TIERS', []), floorOf(e));
    return Math.cos(time / get('DIFFICULTY.LAND_DRIFT_PERIOD', 200)) * hard * e.width;
  }

  // ===========================================================================
  // 计分 / 成败（移植 utils.js）
  // ===========================================================================
  function addSuccessCount(e) {
    var success = e.getVariable(V.successCount) + 1;
    e.setVariable(V.successCount, success);
    if (e.getVariable(V.hardMode)) {
      e.setVariable(V.ropeHeight, e.height * random(get('ROPE.HARD_MODE_MIN', 0.35), get('ROPE.HARD_MODE_MAX', 0.55)));
    }
  }
  function addFailedCount(e) {
    if (get('DEBUG.INVINCIBLE', false)) return;
    var failed = e.getVariable(V.failedCount) + 1;
    e.setVariable(V.failedCount, failed);
    e.setVariable(V.perfectCount, 0);
    log('[Collision]', 'miss, fails =', failed);
    if (failed >= get('CORE_RULES.MAX_FAILS', 3)) {
      e.pauseAudio('bgm');
      e.playAudio('gameOver');
      Runtime.changeState(STATES.GAMEOVER);
    }
  }
  function addScore(e, isPerfect) {
    var lastPerfect = e.getVariable(V.perfectCount, 0);
    var lastScore = e.getVariable(V.gameScore, 0);
    var perfect = isPerfect ? lastPerfect + 1 : 0;
    var score = lastScore + get('SCORING.SUCCESS_SCORE', 25) + (get('SCORING.PERFECT_SCORE', 25) * perfect);
    e.setVariable(V.gameScore, score);
    e.setVariable(V.perfectCount, perfect);
  }

  function drawYellowString(e, o) {
    var ctx = e.ctx;
    ctx.save(); ctx.beginPath();
    var grad = ctx.createLinearGradient(0, 0, 0, o.y);
    grad.addColorStop(0, get('HUD.GRADIENT_TOP', '#FAD961'));
    grad.addColorStop(1, get('HUD.GRADIENT_BOTTOM', '#F76B1C'));
    ctx.fillStyle = grad;
    ctx.lineWidth = o.size * 0.1;
    ctx.strokeStyle = get('HUD.STROKE', '#FFFFFF');
    ctx.textAlign = o.textAlign || 'center';
    ctx.font = (o.fontWeight || 'normal') + ' ' + o.size + 'px ' + (o.fontName || get('HUD.FONT_NAME', 'wenxue'));
    ctx.strokeText(o.string, o.x, o.y);
    ctx.fillText(o.string, o.x, o.y);
    ctx.restore();
  }

  // ===========================================================================
  // Hook（移植 hook.js）
  // ===========================================================================
  function hookAction(inst, e, time) {
    var ropeHeight = e.getVariable(V.ropeHeight);
    if (!inst.ready) { inst.x = e.width / 2; inst.y = ropeHeight * get('BLOCK.SPAWN_Y_RATIO', -1.5); inst.ready = true; }
    e.getTimeMovement(MOVE.HOOK_UP, [[inst.y, inst.y - ropeHeight]], function (val) { inst.y = val; },
      { after: function () { inst.y = ropeHeight * get('BLOCK.SPAWN_Y_RATIO', -1.5); } });
    e.getTimeMovement(MOVE.HOOK_DOWN, [[inst.y, inst.y + ropeHeight]], function (val) { inst.y = val; }, { name: 'hook' });
    var initialAngle = e.getVariable(V.initialAngle);
    inst.angle = initialAngle * getSwingVelocity(e, time);
    inst.weightX = inst.x + Math.sin(inst.angle) * ropeHeight;
    inst.weightY = inst.y + Math.cos(inst.angle) * ropeHeight;
  }
  function hookPainter(inst, e) {
    var ctx = e.ctx, ropeHeight = e.getVariable(V.ropeHeight), ropeWidth = ropeHeight * get('ROPE.WIDTH_RATIO', 0.1);
    var hook = e.getImg('hook');
    ctx.save();
    ctx.translate(inst.x, inst.y); ctx.rotate(Math.PI * 2 - (inst.angle || 0)); ctx.translate(-inst.x, -inst.y);
    if (hook) ctx.drawImage(hook, inst.x - ropeWidth / 2, inst.y, ropeWidth, ropeHeight + 5);
    else { ctx.fillStyle = '#7a5230'; ctx.fillRect(inst.x - ropeWidth / 2, inst.y, ropeWidth, ropeHeight); }
    ctx.restore();
  }

  // ===========================================================================
  // Block（移植 block.js：碰撞分类 + 下落物理 + 旋转坠落）
  // ===========================================================================
  function checkCollision(b, line) {
    // 0 继续 1 出界 2 左转 3 右转 4 落稳 5 perfect
    if (b.y + b.height >= line.y) {
      if (b.x < line.x - b.calWidth || b.x > line.collisionX + b.calWidth) return 1;
      if (b.x < line.x) return 2;
      if (b.x > line.collisionX) return 3;
      var lo = get('BLOCK.PERFECT_BAND_MIN', 0.8), hi = get('BLOCK.PERFECT_BAND_MAX', 1.2);
      if (b.x > line.x + b.calWidth * lo && b.x < line.x + b.calWidth * hi) return 5;
      return 4;
    }
    return 0;
  }
  function blockSwing(inst, e, time) {
    if (inst.status !== BLOCK.SWING) return;
    var ropeHeight = e.getVariable(V.ropeHeight);
    inst.angle = e.getVariable(V.initialAngle) * getSwingVelocity(e, time);
    inst.weightX = inst.x + Math.sin(inst.angle) * ropeHeight;
    inst.weightY = inst.y + Math.cos(inst.angle) * ropeHeight;
  }
  function checkBlockOut(inst, e) {
    if (inst.status === BLOCK.ROTATE_LEFT) {
      if (inst.y - inst.width >= e.height) { inst.visible = false; inst.status = BLOCK.OUT; addFailedCount(e); }
    } else if (inst.y >= e.height) { inst.visible = false; inst.status = BLOCK.OUT; addFailedCount(e); }
  }
  function blockAction(inst, e, time) {
    if (!inst.visible) return;
    var ropeHeight = e.getVariable(V.ropeHeight);
    if (!inst.ready) {
      inst.ready = true; inst.status = BLOCK.SWING;
      inst.updateWidth(e.getVariable(V.blockWidth)); inst.updateHeight(e.getVariable(V.blockHeight));
      inst.x = e.width / 2; inst.y = ropeHeight * get('BLOCK.SPAWN_Y_RATIO', -1.5);
      inst.vy = 0; inst.rotate = 0; inst.perfect = false;
    }
    var line = e.getInstance('line');
    switch (inst.status) {
      case BLOCK.SWING:
        e.getTimeMovement(MOVE.HOOK_DOWN, [[inst.y, inst.y + ropeHeight]], function (val) { inst.y = val; }, { name: 'block' });
        blockSwing(inst, e, time);
        break;
      case BLOCK.BEFORE_DROP:
        inst.x = inst.weightX - inst.calWidth;
        inst.y = inst.weightY + get('BLOCK.DROP_ROPE_OFFSET', 0.3) * inst.height;
        inst.rotate = 0;
        inst.ay = e.pixelsPerFrame(get('BLOCK.GRAVITY_RATIO', 0.0003) * e.height);
        inst.startDropTime = time; inst.status = BLOCK.DROP;
        break;
      case BLOCK.DROP: {
        var dt = time - inst.startDropTime; inst.startDropTime = time;
        inst.vy += inst.ay * dt;
        inst.y += inst.vy * dt + 0.5 * inst.ay * dt * dt;
        var c = checkCollision(inst, line);
        var blockY = line.y - inst.height;
        var calRotate = function (ins) {
          ins.originOutwardAngle = Math.atan(ins.height / ins.outwardOffset);
          ins.originHypotenuse = Math.sqrt(ins.height * ins.height + ins.outwardOffset * ins.outwardOffset);
          e.playAudio('rotate');
        };
        switch (c) {
          case 1: checkBlockOut(inst, e); break;
          case 2:
            inst.status = BLOCK.ROTATE_LEFT; inst.y = blockY;
            inst.outwardOffset = (line.x + inst.calWidth) - inst.x; calRotate(inst); break;
          case 3:
            inst.status = BLOCK.ROTATE_RIGHT; inst.y = blockY;
            inst.outwardOffset = (line.collisionX + inst.calWidth) - inst.x; calRotate(inst); break;
          case 4:
          case 5: {
            inst.status = BLOCK.LAND;
            var lastSuccess = floorOf(e);
            addSuccessCount(e);
            e.setTimeMovement(MOVE.MOVE_DOWN, get('FEEL.MOVE_DURATION', 500));
            var floors = get('FEEL.LIGHTNING_FLOORS', [10, 15]);
            if (floors.indexOf(lastSuccess) > -1) e.setTimeMovement(MOVE.LIGHTNING, get('FEEL.LIGHTNING_DURATION', 150));
            inst.y = blockY; line.y = blockY; line.x = inst.x - inst.calWidth; line.collisionX = line.x + inst.width;
            var cheat = inst.width * get('BLOCK.CHEAT_WIDTH_RATIO', 0.3);
            if (inst.x > e.width - cheat * 2 || inst.x < -cheat) e.setVariable(V.hardMode, true);
            if (c === 5) { inst.perfect = true; addScore(e, true); e.playAudio('dropPerfect'); }
            else { addScore(e); e.playAudio('drop'); }
            log('[Spawn]', 'floor', floorOf(e), c === 5 ? 'perfect' : 'land');
            break;
          }
          default: break;
        }
        break;
      }
      case BLOCK.LAND:
        e.getTimeMovement(MOVE.MOVE_DOWN,
          [[inst.y, inst.y + getMoveDownValue(e, { pixelsPerFrame: function (s) { return s / 2; } })]],
          function (val) { if (!inst.visible) return; inst.y = val; if (inst.y > e.height) inst.visible = false; },
          { name: inst.name });
        inst.x += getLandDrift(e, time);
        break;
      case BLOCK.ROTATE_LEFT:
      case BLOCK.ROTATE_RIGHT: {
        var isRight = inst.status === BLOCK.ROTATE_RIGHT;
        var rotateSpeed = e.pixelsPerFrame(get('BLOCK.ROTATE_SPEED_RAD', Math.PI * 4));
        var threshold = get('BLOCK.ROTATE_FALL_THRESHOLD', 1.3);
        var shouldFall = isRight ? inst.rotate > threshold : inst.rotate < -threshold;
        var dir = isRight ? 1 : -1;
        if (shouldFall) {
          inst.rotate += (rotateSpeed / 8) * dir;
          inst.y += e.pixelsPerFrame(e.height * get('BLOCK.FALL_Y_RATIO', 0.7));
          inst.x += e.pixelsPerFrame(e.width * get('BLOCK.FALL_X_RATIO', 0.3)) * dir;
        } else {
          var ratio = (inst.calWidth - inst.outwardOffset) / inst.calWidth;
          ratio = ratio > get('BLOCK.MIN_ROTATE_RATIO', 0.5) ? ratio : get('BLOCK.MIN_ROTATE_RATIO', 0.5);
          inst.rotate += rotateSpeed * ratio * dir;
          var angle = inst.originOutwardAngle + inst.rotate;
          var axisX = isRight ? line.collisionX + inst.calWidth : line.x + inst.calWidth;
          inst.x = axisX - Math.cos(angle) * inst.originHypotenuse;
          inst.y = line.y - Math.sin(angle) * inst.originHypotenuse;
        }
        checkBlockOut(inst, e);
        break;
      }
      default: break;
    }
  }
  function drawBlockImg(inst, e) {
    var img = e.getImg(inst.perfect ? 'blockPerfect' : 'block');
    if (img) e.ctx.drawImage(img, inst.x, inst.y, inst.width, inst.height);
    else { e.ctx.fillStyle = inst.perfect ? '#ffd34d' : '#e07a3f'; e.ctx.fillRect(inst.x, inst.y, inst.width, inst.height); }
  }
  function blockPainter(inst, e) {
    switch (inst.status) {
      case BLOCK.SWING: {
        var bl = e.getImg('blockRope');
        if (bl) e.ctx.drawImage(bl, inst.weightX - inst.calWidth, inst.weightY, inst.width, inst.height * 1.3);
        else { e.ctx.fillStyle = '#e07a3f'; e.ctx.fillRect(inst.weightX - inst.calWidth, inst.weightY, inst.width, inst.height); }
        break;
      }
      case BLOCK.DROP:
      case BLOCK.LAND: drawBlockImg(inst, e); break;
      case BLOCK.ROTATE_LEFT:
      case BLOCK.ROTATE_RIGHT: {
        var ctx = e.ctx; ctx.save();
        ctx.translate(inst.x, inst.y); ctx.rotate(inst.rotate); ctx.translate(-inst.x, -inst.y);
        drawBlockImg(inst, e); ctx.restore(); break;
      }
      default: break;
    }
  }

  // ===========================================================================
  // TowerLine（移植 line.js）
  // ===========================================================================
  function lineAction(inst, e, time) {
    if (!inst.ready) {
      inst.y = e.getVariable(V.lineInitialOffset); inst.ready = true;
      inst.x = 0; inst.collisionX = e.width - e.getVariable(V.blockWidth);
    }
    e.getTimeMovement(MOVE.MOVE_DOWN,
      [[inst.y, inst.y + getMoveDownValue(e, { pixelsPerFrame: function (s) { return s / 2; } })]],
      function (val) { inst.y = val; }, { name: 'line' });
    var drift = getLandDrift(e, time);
    inst.x += drift; inst.collisionX += drift;
  }
  function linePainter(inst, e) {
    if (!get('DEBUG.SHOW_COLLISION', false)) return;
    var ctx = e.ctx; ctx.save(); ctx.beginPath(); ctx.strokeStyle = 'red';
    ctx.moveTo(inst.x, inst.y); ctx.lineTo(inst.collisionX, inst.y); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }

  // ===========================================================================
  // Cloud（移植 cloud.js，固定 4 个，对象池复用）
  // ===========================================================================
  function randomCloudImg(inst) {
    var clouds = ['c1', 'c2', 'c3'], stones = ['c4', 'c5', 'c6', 'c7', 'c8'];
    var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    inst.imgName = inst.count > get('CLOUD.STONE_COUNT_THRESHOLD', 6) ? pick(stones) : pick(clouds);
  }
  function cloudAction(inst, e) {
    if (!inst.ready) {
      inst.ready = true; randomCloudImg(inst);
      inst.width = e.getVariable(V.cloudSize); inst.height = inst.width;
      var positions = Spec.cloudPositions;
      var p = positions[(inst.index - 1) % positions.length];
      inst.x = random(e.width * p.x, e.width * p.x * 1.2); inst.originX = inst.x;
      inst.ax = e.pixelsPerFrame(inst.width * random(get('CLOUD.DRIFT_MIN', 0.05), get('CLOUD.DRIFT_MAX', 0.08)) * randPN());
      inst.y = random(e.height * p.y, e.height * p.y * 1.2);
    }
    inst.x += inst.ax;
    if (inst.x >= inst.originX + inst.width || inst.x <= inst.originX - inst.width) inst.ax *= -1;
    if (checkMoveDown(e)) inst.y += getMoveDownValue(e) * get('CLOUD.MOVEDOWN_MULT', 1.2);
    if (inst.y >= e.height) { inst.y = e.height * get('CLOUD.RESET_Y_RATIO', -0.66); inst.count += get('CLOUD.RESET_COUNT_STEP', 4); randomCloudImg(inst); }
  }
  function cloudPainter(inst, e) {
    var img = e.getImg(inst.imgName);
    if (img) e.ctx.drawImage(img, inst.x, inst.y, inst.width, inst.height);
    else { e.ctx.save(); e.ctx.globalAlpha = 0.6; e.ctx.fillStyle = '#fff'; e.ctx.beginPath();
      e.ctx.ellipse(inst.x + inst.width / 2, inst.y + inst.height / 2, inst.width / 2, inst.height / 3, 0, 0, Math.PI * 2); e.ctx.fill(); e.ctx.restore(); }
  }

  // ===========================================================================
  // Flight（移植 flight.js，对象池）
  // ===========================================================================
  function flightConfig(e, type) {
    var size = e.getVariable(V.cloudSize), w = e.width, h = e.height;
    var cfg = {
      bottomToTop: { x: w * random(0.3, 0.7), y: h, vx: 0, vy: e.pixelsPerFrame(h) * get('FLIGHT.BOTTOM_VY', 0.7) * -1 },
      leftToRight: { x: -size, y: h * random(0.3, 0.6), vx: e.pixelsPerFrame(w) * get('FLIGHT.LEFT_VX', 0.4), vy: e.pixelsPerFrame(h) * get('FLIGHT.LEFT_VY', 0.1) * -1 },
      rightToLeft: { x: w, y: h * random(0.2, 0.5), vx: e.pixelsPerFrame(w) * get('FLIGHT.RIGHT_VX', 0.4) * -1, vy: e.pixelsPerFrame(h) * get('FLIGHT.RIGHT_VY', 0.1) },
      rightTopToLeft: { x: w, y: 0, vx: e.pixelsPerFrame(w) * get('FLIGHT.RIGHTTOP_VX', 0.6) * -1, vy: e.pixelsPerFrame(h) * get('FLIGHT.RIGHTTOP_VY', 0.5) }
    };
    return cfg[type];
  }
  function flightAction(inst, e) {
    if (!inst.visible) return;
    var size = e.getVariable(V.cloudSize);
    if (!inst.ready) {
      var a = flightConfig(e, inst.type); inst.ready = true;
      inst.width = size; inst.height = size; inst.x = a.x; inst.y = a.y; inst.vx = a.vx; inst.vy = a.vy;
    }
    inst.x += inst.vx; inst.y += inst.vy;
    if (inst.y + size < 0 || inst.y > e.height || inst.x + size < 0 || inst.x > e.width) inst.visible = false;
  }
  function flightPainter(inst, e) {
    var img = e.getImg(inst.imgName);
    if (img) e.ctx.drawImage(img, inst.x, inst.y, inst.width, inst.height);
  }

  // ===========================================================================
  // Tutorial（移植 tutorial.js）
  // ===========================================================================
  function tutorialAction(inst, e, time) {
    if (!inst.ready) {
      inst.ready = true;
      var tw = e.width * get('TUTORIAL.WIDTH_RATIO', 0.2);
      inst.updateWidth(tw);
      inst.height = tw * get('TUTORIAL.HEIGHT_RATIO', 0.46);
      inst.x = e.calWidth - inst.calWidth; inst.y = e.height * get('TUTORIAL.Y_RATIO', 0.45);
      if (inst.name !== 'tutorial') inst.y += inst.height * 1.2;
    }
    if (inst.name !== 'tutorial') inst.y += Math.cos(time / 200) * inst.height * get('TUTORIAL.BOB_RATIO', 0.01);
  }
  function tutorialPainter(inst, e) {
    if (e.checkTimeMovement(MOVE.TUTORIAL)) return;
    if (getHookStatus(e) !== 'normal') return;
    var img = e.getImg(inst.name === 'tutorial' ? 'tutorial' : 'tutorialArrow');
    if (img) e.ctx.drawImage(img, inst.x, inst.y, inst.width, inst.height);
  }

  function getHookStatus(e) {
    if (e.checkTimeMovement(MOVE.HOOK_DOWN)) return 'down';
    if (e.checkTimeMovement(MOVE.HOOK_UP)) return 'up';
    return 'normal';
  }

  // ===========================================================================
  // Background（移植 background.js：昼夜渐变 + bg 图 + 闪电）
  // ===========================================================================
  function gradientColor(stops, idx, prop) {
    var ci = idx + 1 >= stops.length ? stops.length - 1 : idx;
    var cur = stops[ci];
    var ni = ci + 1 >= stops.length - 1 ? ci : ci + 1;
    var nxt = stops[ni];
    var ch = function (i) { return Math.round(cur[i] + (nxt[i] - cur[i]) * prop); };
    return 'rgb(' + ch(0) + ', ' + ch(1) + ', ' + ch(2) + ')';
  }
  function backgroundGradient(e) {
    var grad = e.ctx.createLinearGradient(0, 0, 0, e.height);
    var stops = Spec.dayNightColorStops;
    var offset = e.getVariable(V.bgGradOffset, 0);
    if (checkMoveDown(e)) e.setVariable(V.bgGradOffset, offset + getMoveDownValue(e) * get('BACKGROUND.GRADIENT_MOVEDOWN_MULT', 1.5));
    var idx = parseInt(offset / e.height, 10);
    var prop = (offset % e.height) / e.height;
    grad.addColorStop(0, gradientColor(stops, idx + 1, prop));
    grad.addColorStop(1, gradientColor(stops, idx, prop));
    e.ctx.fillStyle = grad; e.ctx.fillRect(0, 0, e.width, e.height);
    var lightning = function () { e.ctx.fillStyle = 'rgba(255,255,255,' + get('BACKGROUND.LIGHTNING_ALPHA', 0.7) + ')'; e.ctx.fillRect(0, 0, e.width, e.height); };
    e.getTimeMovement(MOVE.LIGHTNING, [], function () {}, { before: lightning, after: lightning });
  }
  function backgroundImg(e) {
    var bg = e.getImg('background');
    if (!bg) return;
    var zoomedHeight = (bg.height * e.width) / bg.width;
    var offset = e.getVariable(V.bgImgOffset, e.height - zoomedHeight);
    if (offset > e.height) return;
    e.getTimeMovement(MOVE.MOVE_DOWN, [[offset, offset + getMoveDownValue(e, { pixelsPerFrame: function (s) { return s / 2; } })]],
      function (val) { offset = val; }, { name: 'background' });
    e.getTimeMovement(MOVE.BG_INIT, [[offset, offset + zoomedHeight / 4]], function (val) { offset = val; });
    e.setVariable(V.bgImgOffset, offset);
    e.setVariable(V.lineInitialOffset, e.height - zoomedHeight * 0.394);
    e.ctx.drawImage(bg, 0, offset, e.width, zoomedHeight);
  }
  function paintBackground(e) { backgroundGradient(e); backgroundImg(e); }

  // ===========================================================================
  // 资源加载（从 manifest，带进度/重试/超时）
  // ===========================================================================
  function Loader(engine) { this.engine = engine; this.total = 0; this.done = 0; this.failed = 0; }
  Loader.prototype.loadImage = function (key, url, retry) {
    var self = this; retry = retry || 0;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { self.engine.addImg(key, img); self.done++; resolve(); };
      img.onerror = function () {
        if (retry < 3) { self.loadImage(key, url, retry + 1).then(resolve); }
        else { self.failed++; self.done++; console.warn('[Asset] image failed:', key); resolve(); }
      };
      img.src = url;
    });
  };
  Loader.prototype.loadAudio = function (key, url, alt) {
    var self = this;
    return new Promise(function (resolve) {
      var a = new Audio(); var settled = false;
      var finish = function () { if (settled) return; settled = true; self.engine.addAudio(key, a); self.done++; resolve(); };
      a.addEventListener('canplaythrough', finish, false);
      a.addEventListener('loadeddata', finish, false);
      a.addEventListener('error', function () {
        if (alt && a.src.indexOf(alt) === -1) { a.src = alt; a.load(); }
        else { if (!settled) { settled = true; self.failed++; self.done++; console.warn('[Asset] audio failed:', key); resolve(); } }
      }, false);
      setTimeout(finish, 8000); // 超时兜底，避免加载卡死
      a.src = url; a.load();
    });
  };
  Loader.prototype.run = function (manifest, soundOn) {
    var self = this, base = manifest.basePath || 'assets/';
    var tasks = [];
    Object.keys(manifest.images || {}).forEach(function (k) {
      tasks.push(function () { return self.loadImage(k, base + encodePath(manifest.images[k].src)); });
    });
    if (soundOn) {
      Object.keys(manifest.audio || {}).forEach(function (k) {
        var a = manifest.audio[k];
        tasks.push(function () { return self.loadAudio(k, base + encodePath(a.src), a.alt ? base + encodePath(a.alt) : null); });
      });
    }
    this.total = tasks.length;
    return Promise.all(tasks.map(function (t) { return t(); }));
  };

  // ===========================================================================
  // GameRuntime（状态机 + spawn + 输入 + 存档 + 渲染编排）
  // ===========================================================================
  var Spec = { milestones: [], dayNightColorStops: [], cloudPositions: [] };
  var Runtime = {
    engine: null, state: STATES.LOADING, loader: null, activeBlock: null, blockPool: [],
    flightSpawned: {}, bgmStarted: false, highScore: 0, revivedThisRun: false, _adInFlight: false,

    loadSave: function () {
      try {
        var raw = localStorage.getItem(SAVE_KEY);
        if (raw) { var s = JSON.parse(raw); if (s && s.version === SAVE_VERSION) this.highScore = s.highScore || 0; }
      } catch (e) { console.warn('[Runtime] load save failed', e); }
    },
    saveScore: function (score) {
      if (score <= this.highScore) return;
      this.highScore = score;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, highScore: score })); }
      catch (e) { console.warn('[Runtime] save failed', e); }
    },

    changeState: function (next) {
      if (this.state === next) return;
      this._exit(this.state); this.state = next; this._enter(next);
      log('[Runtime] ->', next);
    },
    _enter: function (s) {
      var e = this.engine;
      if (s === STATES.PLAYING) {
        this._hideAdDialog(); this._hideResultDialog();
        // 仅全新一局（blockCount 归零）才播放教程/开场动画；广告复活续局时不重置
        if (Number(e.getVariable(V.blockCount, 0)) === 0) {
          e.setTimeMovement(MOVE.BG_INIT, get('FEEL.BG_INIT_DURATION', 500));
          if (!get('DEBUG.SKIP_TUTORIAL', false)) this._addTutorial();
          e.setTimeMovement(MOVE.TUTORIAL, get('FEEL.TUTORIAL_DURATION', 500));
        }
        this._startBgm();
      } else if (s === STATES.GAMEOVER) {
        this.saveScore(Number(e.getVariable(V.gameScore, 0)));
        // 本局还没用过广告复活 -> 先弹“看广告复活”弹窗；已复活过又死 -> 直接结算
        if (this.revivedThisRun) this._showResultDialog();
        else this._showAdDialog();
      }
    },
    _exit: function () {},

    // ===== 弹窗 1：Game Over 广告复活弹窗（APPLY 看广告复活 / SKIP 去结算）=====
    _showAdDialog: function () {
      var dlg = document.getElementById('ad-dialog');
      if (!dlg) return;
      var apply = document.getElementById('ad-apply');
      if (apply) { apply.disabled = false; apply.classList.remove('is-disabled'); }
      this._hideResultDialog();
      dlg.classList.remove('hidden');
    },
    _hideAdDialog: function () { var d = document.getElementById('ad-dialog'); if (d) d.classList.add('hidden'); },

    // ===== 弹窗 2：结算弹窗（仅 PLAY AGAIN）=====
    _showResultDialog: function () {
      var dlg = document.getElementById('result-dialog');
      if (!dlg) return;
      var sc = document.getElementById('result-score');
      var bs = document.getElementById('result-best');
      if (sc) sc.textContent = String(Number(this.engine.getVariable(V.gameScore, 0)));
      if (bs) bs.textContent = String(this.highScore);
      this._hideAdDialog();
      dlg.classList.remove('hidden');
    },
    _hideResultDialog: function () { var d = document.getElementById('result-dialog'); if (d) d.classList.add('hidden'); },

    // APPLY：本局首次 -> 看激励视频，成功则复活一条命续局；无奖励/失败 -> 转结算
    applyRevive: function () {
      if (this._adInFlight || this.revivedThisRun) return;
      this._adInFlight = true;
      var apply = document.getElementById('ad-apply');
      if (apply) { apply.disabled = true; apply.classList.add('is-disabled'); }
      var R = this;
      var ads = window.Ads;
      var p = (ads && ads.showRewarded) ? ads.showRewarded() : Promise.resolve(true);
      p.then(function (rewarded) {
        R._adInFlight = false;
        if (rewarded) { R.revivedThisRun = true; log('[Ads] rewarded -> revive'); R.revive(); }
        else { log('[Ads] no reward -> result'); R._hideAdDialog(); R._showResultDialog(); }
      });
    },
    // SKIP：放弃广告，直接进入结算弹窗
    skipAd: function () { this._hideAdDialog(); this._showResultDialog(); },

    // 复活：退回一条命，原局继续（不 reset，保留分数/楼层/塔身）
    revive: function () {
      var e = this.engine;
      this._hideAdDialog(); this._hideResultDialog();
      e.setVariable(V.failedCount, Math.max(0, get('CORE_RULES.MAX_FAILS', 3) - 1)); // 留一条命
      this.changeState(STATES.PLAYING);
    },

    playAgain: function () {
      this._hideAdDialog(); this._hideResultDialog();
      this.resetGame();
      this.changeState(STATES.PLAYING);
    },

    _startBgm: function () { if (this.bgmStarted) return; if (Spec.modules && Spec.modules.bgm === false) return; this.bgmStarted = true; this.engine.playAudio('bgm', true); },

    _addTutorial: function () {
      var e = this.engine;
      if (!e.getInstance('tutorial')) e.addInstance(makeInstance({ name: 'tutorial', action: tutorialAction, painter: tutorialPainter }));
      if (!e.getInstance('tutorialArrow')) e.addInstance(makeInstance({ name: 'tutorialArrow', action: tutorialAction, painter: tutorialPainter }));
    },
    _removeTutorial: function () { this.engine.removeInstance('tutorial'); this.engine.removeInstance('tutorialArrow'); },

    // 对象池：取一个可复用方块
    _spawnBlock: function () {
      var e = this.engine, free = null;
      for (var i = 0; i < this.blockPool.length; i++) { if (!this.blockPool[i].visible) { free = this.blockPool[i]; break; } }
      if (!free) {
        if (this.blockPool.length >= get('PERFORMANCE.MAX_BLOCKS', 64)) { free = this.blockPool[0]; }
        else { free = makeInstance({ name: '', action: blockAction, painter: blockPainter }); this.blockPool.push(free); e.addInstance(free); }
      }
      var count = e.getVariable(V.blockCount) + 1;
      e.setVariable(V.blockCount, count);
      free.name = 'block_' + count; free.visible = true; free.ready = false; free.status = BLOCK.SWING; free.perfect = false;
      this.activeBlock = free;
      return free;
    },

    // 投放当前方块（DROP 动作）
    dropActive: function () {
      var e = this.engine;
      if (getHookStatus(e) !== 'normal') return;
      this._removeTutorial();
      var b = this.activeBlock;
      if (b && b.status === BLOCK.SWING) { e.setTimeMovement(MOVE.HOOK_UP, get('FEEL.HOOK_DURATION', 500)); b.status = BLOCK.BEFORE_DROP; }
    },

    // spawn 循环（移植 animateFuncs.startAnimate）
    updateSpawn: function (e) {
      var b = this.activeBlock;
      if (!b || b.status === BLOCK.LAND || b.status === BLOCK.OUT) {
        if (checkMoveDown(e) && getMoveDownValue(e)) return;
        if (e.checkTimeMovement(MOVE.HOOK_UP)) return;
        var base = getAngleBase(e);
        var angle = (Math.PI * random(base, base + get('DIFFICULTY.ANGLE_JITTER', 5)) * randPN()) / 180;
        e.setVariable(V.initialAngle, angle);
        e.setTimeMovement(MOVE.HOOK_DOWN, get('FEEL.HOOK_DURATION', 500));
        this._spawnBlock();
      }
      // 里程碑飞行物
      var floor = floorOf(e);
      for (var i = 0; i < Spec.milestones.length; i++) {
        var m = Spec.milestones[i];
        if (m.floor === floor && !this.flightSpawned[m.flightId]) { this._spawnFlight(m.flightId, m.type); }
      }
    },
    _spawnFlight: function (id, type) {
      if (this.flightSpawned[id]) return;
      this.flightSpawned[id] = true;
      var f = makeInstance({ name: 'flight_' + id, action: flightAction, painter: flightPainter });
      f.imgName = 'f' + id; f.type = type;
      this.engine.addInstance(f, LAYER.FLIGHT);
    },

    resetGame: function () {
      var e = this.engine;
      e.setVariable(V.blockCount, 0); e.setVariable(V.successCount, 0); e.setVariable(V.failedCount, 0);
      e.setVariable(V.perfectCount, 0); e.setVariable(V.gameScore, 0); e.setVariable(V.hardMode, false);
      e.setVariable(V.ropeHeight, e.height * get('ROPE.HEIGHT_RATIO', 0.4));
      e.setVariable(V.bgImgOffset, null); e.setVariable(V.bgGradOffset, 0);
      e.timeMovement = {}; e.timeMovementStartArr = []; e.timeMovementFinishArr = [];
      this.activeBlock = null; this.flightSpawned = {}; this.bgmStarted = false;
      this.revivedThisRun = false; this._adInFlight = false;
      this._hideAdDialog(); this._hideResultDialog();
      this.blockPool.forEach(function (b) { b.visible = false; b.ready = false; });
      // flights 清理
      e.instancesObj[LAYER.FLIGHT] = [];
      // line 重置
      var line = e.getInstance('line'); if (line) { line.ready = false; }
    },

    // 主输入（pointerdown / space）
    onPrimary: function () {
      switch (this.state) {
        case STATES.MENU: this.changeState(STATES.PLAYING); break;
        case STATES.PLAYING: this.dropActive(); break;
        case STATES.GAMEOVER: break; // 交由弹窗按钮（APPLY/SKIP/PLAY AGAIN）处理
        default: break;
      }
    },
    onPause: function () { if (get('DEBUG.ENABLED', false) && this.state === STATES.PLAYING) this.engine.togglePaused(); },

    // 每帧（注入 engine.onFrame）
    frame: function (e, time) {
      if (this.state === STATES.LOADING) return;
      paintBackground(e);
      e.updateInstances(time);
      if (this.state === STATES.PLAYING) this.updateSpawn(e);
      e.paintInstances();
    },

    // overlay（注入 engine.onOverlay）：HUD + 状态界面
    overlay: function (e) {
      if (this.state === STATES.LOADING) { this._drawLoading(e); return; }
      if (this.state === STATES.PLAYING || this.state === STATES.GAMEOVER) this._drawHud(e);
      if (this.state === STATES.MENU) this._drawMenu(e);
      // GAMEOVER 的交互界面改由 HTML 弹窗 #ad-dialog 承担（含分数、APPLY、PLAY AGAIN）
      if (get('DEBUG.SHOW_FPS', false)) { e.ctx.save(); e.ctx.fillStyle = 'red'; e.ctx.font = '32px Arial'; e.ctx.fillText('FPS ' + e.fps.toFixed(0), 8, 40); e.ctx.restore(); }
    },

    _drawLoading: function (e) {
      var ctx = e.ctx, w = e.width, h = e.height;
      ctx.fillStyle = '#f05a50'; ctx.fillRect(0, 0, w, h);
      var bw = w * 0.6, bh = h * 0.02, bx = (w - bw) / 2, by = h * 0.55;
      var pct = this.loader ? (this.loader.total ? this.loader.done / this.loader.total : 1) : 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bw * pct, bh);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = (h * 0.04) + 'px Arial';
      ctx.fillText(Math.round(pct * 100) + '%', w / 2, by - h * 0.03);
      ctx.fillText('Loading...', w / 2, by + h * 0.06);
    },
    _drawMenu: function (e) {
      var ctx = e.ctx, w = e.width, h = e.height;
      // 英文标题（金色描边，匹配游戏风格）；不再使用中文标题图 uiTitle
      drawYellowString(e, { string: 'TOWER', size: w * 0.17, x: w / 2, y: h * 0.28, fontName: 'Arial', fontWeight: 'bold' });
      drawYellowString(e, { string: 'BUILDING', size: w * 0.12, x: w / 2, y: h * 0.4, fontName: 'Arial', fontWeight: 'bold' });
      var start = e.getImg('uiStart');
      if (start) { var sw = w * 0.5, sh = start.height * sw / start.width; ctx.drawImage(start, (w - sw) / 2, h * 0.78, sw, sh); }
      else { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = (w * 0.06) + 'px Arial'; ctx.fillText('TAP TO START', w / 2, h * 0.82); }
    },
    _drawHud: function (e) {
      var w = e.width;
      var success = Number(e.getVariable(V.successCount, 0));
      var failed = Number(e.getVariable(V.failedCount, 0));
      var score = Number(e.getVariable(V.gameScore, 0));
      var off = success > 99 ? w * 0.1 : 0;
      drawYellowString(e, { string: 'floor', size: w * 0.06, x: w * 0.24 + off, y: w * 0.12, textAlign: 'left', fontName: 'Arial', fontWeight: 'bold' });
      drawYellowString(e, { string: success, size: w * 0.17, x: w * 0.22 + off, y: w * 0.2, textAlign: 'right' });
      var scoreImg = e.getImg('score');
      if (scoreImg) { var sw = w * 0.35, sh = scoreImg.height * sw / scoreImg.width; e.ctx.drawImage(scoreImg, w * 0.61, w * 0.038, sw, sh); }
      drawYellowString(e, { string: score, size: w * 0.06, x: w * 0.9, y: w * 0.11, textAlign: 'right' });
      var heart = e.getImg('heart');
      if (heart) {
        var hw = w * 0.08, hh = heart.height * hw / heart.width;
        for (var i = 1; i <= get('HUD.HEARTS', 3); i++) {
          e.ctx.save(); if (i <= failed) e.ctx.globalAlpha = 0.2;
          e.ctx.drawImage(heart, w * 0.66 + (i - 1) * hw, w * 0.16, hw, hh); e.ctx.restore();
        }
      }
    }
  };

  // ===========================================================================
  // Bootstrap
  // ===========================================================================
  function computeSize() {
    var ratio = get('CORE_RULES.CANVAS_RATIO', 1.5);
    var w = window.innerWidth, h = window.innerHeight;
    if (h / w < ratio) w = Math.ceil(h / ratio);
    return { width: w, height: h };
  }

  function boot() {
    var canvas = document.getElementById('game');
    if (!canvas) { console.error('[Runtime] #game canvas not found'); return; }
    var size = computeSize();
    canvas.style.position = 'fixed'; canvas.style.left = '0'; canvas.style.right = '0';
    canvas.style.top = '0'; canvas.style.bottom = '0'; canvas.style.margin = 'auto';

    var soundOn = get('CORE_RULES.SOUND_ON', true);
    var engine = new MiniEngine({ canvas: canvas, width: size.width, height: size.height, highResolution: true, soundOn: soundOn });
    Runtime.engine = engine;
    Runtime.loadSave();

    // 初始化运行时变量（来自 GameSettings）
    engine.setVariable(V.blockWidth, engine.width * get('BLOCK.WIDTH_RATIO', 0.25));
    engine.setVariable(V.blockHeight, engine.getVariable(V.blockWidth) * get('BLOCK.HEIGHT_RATIO', 0.71));
    engine.setVariable(V.cloudSize, engine.width * get('CLOUD.SIZE_RATIO', 0.3));
    engine.setVariable(V.ropeHeight, engine.height * get('ROPE.HEIGHT_RATIO', 0.4));
    engine.setVariable(V.blockCount, 0); engine.setVariable(V.successCount, 0);
    engine.setVariable(V.failedCount, 0); engine.setVariable(V.gameScore, 0); engine.setVariable(V.hardMode, false);

    // 分层：flight 在 default 之下（移植 swapLayer）
    engine.addLayer(LAYER.FLIGHT);
    engine.swapLayer(0, 1);

    // 实例：clouds(4) -> line -> hook -> block pool（绘制顺序）
    var clouds = get('PERFORMANCE.MAX_CLOUDS', 4);
    for (var i = 1; i <= clouds; i++) {
      var c = makeInstance({ name: 'cloud_' + i, action: cloudAction, painter: cloudPainter });
      c.index = i; c.count = (clouds + 1) - i; engine.addInstance(c);
    }
    engine.addInstance(makeInstance({ name: 'line', action: lineAction, painter: linePainter }));
    engine.addInstance(makeInstance({ name: 'hook', action: hookAction, painter: hookPainter }));
    for (var p = 0; p < Math.min(16, get('PERFORMANCE.MAX_BLOCKS', 64)); p++) {
      var b = makeInstance({ name: 'block_pool_' + p, action: blockAction, painter: blockPainter });
      b.visible = false; Runtime.blockPool.push(b); engine.addInstance(b);
    }

    // 帧钩子
    engine.onFrame = function (e, t) { Runtime.frame(e, t); };
    engine.onOverlay = function (e, t) { Runtime.overlay(e, t); };

    // 输入：动作映射（pointerdown / space / enter）
    var onPrimary = function (ev) { if (ev) ev.preventDefault(); Runtime.onPrimary(); };
    canvas.addEventListener('pointerdown', onPrimary, { passive: false });
    window.addEventListener('keydown', function (ev) {
      if (ev.code === 'Space' || ev.key === ' ') {
        // GAMEOVER 时不拦截空格，留给弹窗里聚焦的按钮（APPLY/SKIP/PLAY AGAIN）原生激活
        if (Runtime.state === STATES.GAMEOVER) return;
        ev.preventDefault(); Runtime.onPrimary();
      } else if (ev.code === 'Enter' || ev.key === 'Enter') { Runtime.onPause(); }
    });
    // 重新计算画布尺寸时仅做 CSS 居中（世界坐标在 init 时确定）
    window.addEventListener('resize', function () {
      var s = computeSize(); canvas.style.width = s.width + 'px'; canvas.style.height = s.height + 'px';
    });

    // 广告：初始化桥（浏览器内为空操作）+ 绑定两个弹窗的按钮
    if (window.Ads && window.Ads.init) window.Ads.init();
    var applyBtn = document.getElementById('ad-apply');
    if (applyBtn) applyBtn.addEventListener('click', function () { Runtime.applyRevive(); });
    var skipBtn = document.getElementById('ad-skip');
    if (skipBtn) skipBtn.addEventListener('click', function () { Runtime.skipAd(); });
    var againBtn = document.getElementById('ad-again');
    if (againBtn) againBtn.addEventListener('click', function () { Runtime.playAgain(); });

    engine.start();

    // 异步加载 spec -> manifest -> 资源 -> MENU（均 try-catch 兜底默认值）
    fetchJson('spec/game.json').then(function (spec) {
      applySpec(spec || {});
      return fetchJson('assets/manifest.json');
    }).then(function (manifest) {
      if (!manifest) { console.warn('[Asset] manifest missing, geometric fallback'); Runtime.changeState(STATES.MENU); return; }
      var loader = new Loader(engine); Runtime.loader = loader;
      return loader.run(manifest, soundOn).then(function () {
        log('[Asset] all loaded'); Runtime.changeState(STATES.MENU);
      });
    }).catch(function (err) {
      console.warn('[Asset] load error, fallback to geometric rendering', err);
      Runtime.changeState(STATES.MENU);
    });
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })
      .catch(function (e) { console.warn('[Runtime] fetch failed', url, e); return null; });
  }

  // 应用 spec（带默认值兜底）
  function applySpec(s) {
    s = s || {};
    Spec.milestones = s.milestones || [];
    Spec.dayNightColorStops = s.dayNightColorStops || [[200, 255, 150], [25, 0, 10]];
    Spec.cloudPositions = s.cloudPositions || [{ x: 0.1, y: -0.66 }, { x: 0.65, y: -0.33 }, { x: 0.1, y: 0 }, { x: 0.65, y: 0.33 }];
    Spec.modules = s.modules || {};
  }

  window.TowerGame = { boot: boot, Runtime: Runtime, STATES: STATES };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
