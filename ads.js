/*
 * ads.js - one place for ad settings and ad bridge calls.
 *
 * For APK monetization, the real verification domain is not read from JS by
 * Google. You still need to publish app-ads.txt at:
 *
 *   https://YOUR_DOMAIN/app-ads.txt
 *
 * This file keeps that domain next to the AdMob IDs so the project has a
 * single obvious place to update when real ads are ready.
 */
(function (global) {
  'use strict';

  var ADS_CONFIG = {
    // Replace this with your own domain later, for example:
    // publisherDomain: 'towervillegame.com'
    publisherDomain: 'gamia-ai-games.com',
    appAdsTxtUrl: 'https://gamia-ai-games.com/app-ads.txt',

    // Replace this with the AdMob app ID from AdMob > Apps > App settings.
    adMobAppId: 'ca-app-pub-0000000000000000~0000000000',

    // Keep true while testing. Set false only after real AdMob IDs are ready.
    testMode: true,

    // Current IDs are Google's official test ad-unit IDs.
    adUnits: {
      banner: 'ca-app-pub-3940256099942544/6300978111',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917'
    }
  };

  if (global.TOWER_ADS_CONFIG) {
    ADS_CONFIG = mergeConfig(ADS_CONFIG, global.TOWER_ADS_CONFIG);
  }

  var bridge = (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.AdMob) || null;
  var inApp = !!bridge;

  function mergeConfig(base, overrides) {
    var output = {};
    Object.keys(base).forEach(function (key) {
      if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        output[key] = mergeConfig(base[key], {});
      } else {
        output[key] = base[key];
      }
    });
    Object.keys(overrides || {}).forEach(function (key) {
      if (output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) {
        output[key] = mergeConfig(output[key], overrides[key]);
      } else {
        output[key] = overrides[key];
      }
    });
    return output;
  }

  function simulateAd(kind) {
    return new Promise(function (resolve) {
      if (!global.document || !document.body) {
        resolve(true);
        return;
      }

      var seconds = 3;
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0b0b12;color:#fff;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'font-family:Arial,Helvetica,sans-serif;text-align:center;padding:24px;' +
        '-webkit-user-select:none;user-select:none;';
      overlay.innerHTML =
        '<div style="position:absolute;top:14px;left:14px;background:#f9c000;color:#000;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:.5px;">AD - TEST</div>' +
        '<button id="__sim_close" aria-label="Close" style="position:absolute;top:12px;right:12px;width:34px;height:34px;border:none;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:18px;line-height:34px;cursor:pointer;">&times;</button>' +
        '<div style="font-size:22px;font-weight:800;margin-bottom:8px;">Placeholder Ad</div>' +
        '<div style="font-size:13px;color:#9aa;max-width:300px;line-height:1.4;margin-bottom:26px;">No real ad in the browser. In the APK this becomes a real AdMob ' + kind + ' ad after the native plugin is connected.</div>' +
        '<div id="__sim_count" style="font-size:15px;color:#ddd;margin-bottom:18px;">Reward in ' + seconds + 's&hellip;</div>' +
        '<button id="__sim_claim" disabled style="min-width:220px;min-height:48px;border:none;border-radius:10px;background:#3a3a44;color:#888;font-size:16px;font-weight:700;cursor:default;">CLAIM REWARD</button>';
      document.body.appendChild(overlay);

      var countEl = overlay.querySelector('#__sim_count');
      var claim = overlay.querySelector('#__sim_claim');
      var closeEl = overlay.querySelector('#__sim_close');
      var done = false;

      function finish(rewarded) {
        if (done) return;
        done = true;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(rewarded);
      }

      var timer = setInterval(function () {
        seconds -= 1;
        if (seconds > 0) {
          countEl.innerHTML = 'Reward in ' + seconds + 's&hellip;';
        } else {
          clearInterval(timer);
          countEl.textContent = kind === 'rewarded' ? 'Ad complete - claim your reward!' : 'Ad complete';
          claim.disabled = false;
          claim.style.background = '#2ecc71';
          claim.style.color = '#fff';
          claim.style.cursor = 'pointer';
          if (kind !== 'rewarded') claim.textContent = 'CONTINUE';
        }
      }, 1000);

      claim.addEventListener('click', function () {
        if (!claim.disabled) finish(true);
      });

      closeEl.addEventListener('click', function () {
        clearInterval(timer);
        finish(kind === 'interstitial');
      });
    });
  }

  var Ads = {
    config: ADS_CONFIG,
    available: inApp,

    init: function () {
      if (!inApp) {
        console.log('[Ads] browser placeholder mode', ADS_CONFIG);
        return Promise.resolve();
      }
      return bridge.initialize({ initializeForTesting: ADS_CONFIG.testMode })
        .then(function () { console.log('[Ads] AdMob initialized'); })
        .catch(function (e) { console.warn('[Ads] init failed', e); });
    },

    showRewarded: function () {
      if (!inApp) {
        console.log('[Ads] browser placeholder rewarded');
        return simulateAd('rewarded');
      }
      return bridge.prepareRewardVideoAd({ adId: ADS_CONFIG.adUnits.rewarded })
        .then(function () { return bridge.showRewardVideoAd(); })
        .then(function (reward) { return !!reward; })
        .catch(function (e) {
          console.warn('[Ads] rewarded failed', e);
          return false;
        });
    },

    showInterstitial: function () {
      if (!inApp) {
        console.log('[Ads] browser placeholder interstitial');
        return simulateAd('interstitial');
      }
      return bridge.prepareInterstitial({ adId: ADS_CONFIG.adUnits.interstitial })
        .then(function () { return bridge.showInterstitial(); })
        .then(function () { return true; })
        .catch(function (e) {
          console.warn('[Ads] interstitial failed', e);
          return false;
        });
    },

    showBanner: function () {
      if (!inApp) {
        console.log('[Ads] browser placeholder banner skipped');
        return Promise.resolve();
      }
      return bridge.showBanner({
        adId: ADS_CONFIG.adUnits.banner,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0
      }).catch(function (e) {
        console.warn('[Ads] banner failed', e);
      });
    },

    hideBanner: function () {
      if (inApp) bridge.hideBanner();
    }
  };

  global.Ads = Ads;
  global.ADS_CONFIG = ADS_CONFIG;
})(typeof window !== 'undefined' ? window : this);
