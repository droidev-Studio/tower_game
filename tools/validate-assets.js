#!/usr/bin/env node
/*
 * validate-assets.js — 真实校验脚本（Node，无依赖）
 * 校验：manifest 每个 src 文件存在、四域目录齐备、无旧路径、无 _archive 引用、JSON 可解析。
 * 用法：node tools/validate-assets.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const errors = [];
const warnings = [];

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { errors.push(`JSON 解析失败: ${path.relative(ROOT, p)} -> ${e.message}`); return null; }
}

// 1. 四域目录
const DOMAINS = ['Audio & Feel', 'Game Art', 'Ui Art', 'Visual Style'];
DOMAINS.forEach((d) => {
  if (!fs.existsSync(path.join(ASSETS, d))) errors.push(`缺少四域目录: assets/${d}`);
});

// 2. 旧路径黑名单（不应作为顶层资产目录）
const LEGACY = ['ui-art', 'ui', 'player', 'bosses', 'enemies', 'pickups', 'skills', 'weapons', 'effects', 'audio'];
LEGACY.forEach((l) => {
  const p = path.join(ASSETS, l);
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) errors.push(`存在旧结构顶层目录: assets/${l}（应迁移到四域）`);
});

// 3. manifest
const manifestPath = path.join(ASSETS, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  errors.push('缺少 assets/manifest.json');
} else {
  const manifest = readJson(manifestPath);
  if (manifest) {
    const base = manifest.basePath || 'assets/';
    const baseDir = path.join(ROOT, base);
    const checkSrc = (section, key, src) => {
      if (!src) return;
      if (/_archive|node_modules|\.git|\.crdownload/.test(src)) { errors.push(`${section}.${key} 引用了禁止路径: ${src}`); return; }
      const full = path.join(baseDir, src);
      if (!fs.existsSync(full)) errors.push(`${section}.${key} 资源不存在: ${base}${src}`);
      else if (/^(player|ui|ui-art|enemies|bosses|pickups|skills|weapons|effects|audio)\//.test(src)) {
        warnings.push(`${section}.${key} 使用了旧结构 src: ${src}`);
      }
    };
    ['images', 'audio'].forEach((sec) => {
      const obj = manifest[sec] || {};
      Object.keys(obj).forEach((k) => {
        checkSrc(sec, k, obj[k].src);
        if (obj[k].alt) checkSrc(sec, k, obj[k].alt);
      });
    });
    Object.keys(manifest.fonts || {}).forEach((k) => {
      const f = manifest.fonts[k];
      checkSrc('fonts', k, f.src);
      (f.variants || []).forEach((v, i) => checkSrc('fonts', `${k}[${i}]`, v));
    });
  }
}

// 4. spec
['spec/game.json', 'spec/schema.json'].forEach((rel) => {
  const p = path.join(ROOT, rel);
  if (fs.existsSync(p)) readJson(p);
  else warnings.push(`缺少 ${rel}`);
});

// 输出
warnings.forEach((w) => console.warn('WARN  ' + w));
if (errors.length) {
  errors.forEach((e) => console.error('ERROR ' + e));
  console.error(`\n校验失败：${errors.length} 个错误，${warnings.length} 个警告。`);
  process.exit(1);
} else {
  console.log(`校验通过：0 错误，${warnings.length} 个警告。`);
  process.exit(0);
}
