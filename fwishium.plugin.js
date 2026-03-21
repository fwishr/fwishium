/**
 * @name Fwishium
 * @description A robust Discord optimization plugin — reduce RAM and CPU usage, throttle background activity, and make Discord more responsive.
 * @version 0.2.2-Alpha
 * @author Fwishr
 * @source https://github.com/fwishr/fwishium
 */

const process = require('process');
const fs = require('fs');
const path = require('path');

module.exports = class Fwishium {
  constructor(meta) {
    this.meta = meta;
    this.enabled = false;
    this.monitorInterval = null;
    this.overlay = null;
    this.keyListener = null;
    this.lastCpuTime = process.cpuUsage();
    this.cpuHistory = [];
    this.config = this.loadConfig();
    this.throttled = false;
    this.dispatcher = null;
    this.focusHandlers = [];
    this.focusPollInterval = null;
    this.suppressedCount = 0;
    this.throttleStyle = null;
    this.animThrottleStyle = null;
    this.animObserver = null;
  }

  loadConfig() {
    try {
      const configPath = path.join(path.dirname(__filename), 'fwishium.config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(configData);
      return {
        cpuCap: parsed.all?.amounts?.cpuCap ?? 100,
        candleStickCount: parsed.all?.amounts?.candleStickCount ?? 15,
        updateInterval: parsed.all?.amounts?.updateInterval ?? 1000,
        showCPU: parsed.all?.general?.showCPU ?? true,
        showRSS: parsed.all?.general?.showRSS ?? true,
        showHeap: parsed.all?.general?.showHeap ?? true,
        backgroundThrottle: parsed.all?.general?.backgroundThrottle ?? true,
        animThrottle: parsed.all?.general?.animThrottle ?? false
      };
    } catch (e) {
      return {
        cpuCap: 100,
        showCPU: true,
        showRSS: true,
        showHeap: true,
        backgroundThrottle: true,
        animThrottle: false,
        candleStickCount: 15,
        updateInterval: 1000
      };
    }
  }

  static CRITICAL_ACTIONS = new Set([
    'MESSAGE_CREATE',
    'MESSAGE_UPDATE',
    'MESSAGE_DELETE',
    'CHANNEL_SELECT',
    'CHANNEL_CREATE',
    'CHANNEL_DELETE',
    'NOTIFICATION_CREATE',
    'CALL_CREATE',
    'CALL_UPDATE',
    'CALL_DELETE',
    'CONNECTION_OPEN',
    'CONNECTION_CLOSED',
    'LOGOUT',
    'LOGIN',
    'VOICE_CHANNEL_SELECT',
    'RTC_CONNECTION_STATE',
    'AUDIO_TOGGLE_SELF_MUTE',
    'AUDIO_TOGGLE_SELF_DEAF',
    'MEDIA_ENGINE_SET_VIDEO_ENABLED',
  ]);

  start() {
    this.createOverlay();
    this.setupKeyListener();
    this.setupBackgroundThrottle();
    if (this.config.animThrottle) this.enableAnimThrottle();
  }

  createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "fwishium-overlay";
    this.overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 999999;
      border: 1px solid #00ff00;
      display: none;
      white-space: pre;
      line-height: 1.3;
    `;
    const placeholders = [];
    if (this.config.showRSS) placeholders.push("RSS: -- MB");
    if (this.config.showHeap) placeholders.push("Heap: -- MB");
    if (this.config.showCPU) placeholders.push("CPU: --%");
    this.overlay.textContent = placeholders.join(" | ") + "\n";
    document.body.appendChild(this.overlay);
  }

  setupKeyListener() {
    this.keyListener = (e) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        this.toggleMonitor();
      }
    };
    document.addEventListener("keydown", this.keyListener);
  }

  toggleMonitor() {
    this.enabled = !this.enabled;
    
    if (this.enabled) {
      this.overlay.style.display = "block";
      this.cpuHistory = [];
      this.monitorInterval = setInterval(() => {
        try {
          const metrics = [];
          
          if (this.config.showRSS || this.config.showHeap) {
            const mem = process.memoryUsage();
            if (this.config.showRSS) {
              const rssMB = (mem.rss / 1048576).toFixed(2);
              metrics.push(`RSS: ${rssMB} MB`);
            }
            if (this.config.showHeap) {
              const heapMB = (mem.heapUsed / 1048576).toFixed(2);
              metrics.push(`Heap: ${heapMB} MB`);
            }
          }
          
          if (this.config.showCPU) {
            const cpuUsage = process.cpuUsage(this.lastCpuTime);
            const totalCpuTime = cpuUsage.user + cpuUsage.system;
            const cpuPercent = (totalCpuTime / 10000);
            this.lastCpuTime = process.cpuUsage();
            
            this.cpuHistory.push(cpuPercent);
            if (this.cpuHistory.length > this.config.candleStickCount) this.cpuHistory.shift();
            
            metrics.push(`CPU: ${cpuPercent.toFixed(1)}%`);
          }
          
          if (this.throttled) metrics.push('⏸ Throttled');

          const metricsLine = metrics.join(" | ");
          const candlesLine = this.config.showCPU ? this.generateCandles() : "";
          this.overlay.textContent = metricsLine + "\n" + candlesLine;
        } catch (e) {
        }
      }, this.config.updateInterval);
    } else {
      this.overlay.style.display = "none";
      clearInterval(this.monitorInterval);
    }
  }

  generateCandles() {
    const symbols = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    return this.cpuHistory.map(cpu => {
      const idx = Math.floor((Math.min(cpu, this.config.cpuCap) / this.config.cpuCap) * (symbols.length - 1));
      return symbols[idx];
    }).join('');
  }

  setThrottled(value) {
    if (!this.config.backgroundThrottle) return;
    if (value === this.throttled) return;
    this.throttled = value;
    if (value) {
      this.suppressedCount = 0;
      this.injectThrottleCSS();
    } else {
      this.removeThrottleCSS();
    }
  }

  injectThrottleCSS() {
    if (this.throttleStyle) return;
    this.throttleStyle = document.createElement('style');
    this.throttleStyle.id = 'fwishium-throttle-css';
    this.throttleStyle.textContent = `
      *, *::before, *::after {
        animation-play-state: paused !important;
        transition: none !important;
      }
      video:not([class*="Voice"]):not([class*="video"]):not([class*="stream"]) {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(this.throttleStyle);
  }

  removeThrottleCSS() {
    if (this.throttleStyle) {
      this.throttleStyle.remove();
      this.throttleStyle = null;
    }
  }

  setupBackgroundThrottle() {
    this.dispatcher = BdApi.Webpack.getModule(m => m.dispatch && m.subscribe);
    if (!this.dispatcher) return;

    const onVisibility = () => this.setThrottled(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    this.focusHandlers.push(['visibilitychange', onVisibility, document]);

    const onBlur = () => this.setThrottled(true);
    const onFocus = () => this.setThrottled(false);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    this.focusHandlers.push(['blur', onBlur, window], ['focus', onFocus, window]);

    this.focusPollInterval = setInterval(() => {
      this.setThrottled(!document.hasFocus());
    }, 2000);

    BdApi.Patcher.before('Fwishium', this.dispatcher, 'dispatch', (_, [event]) => {
      if (this.throttled && !Fwishium.CRITICAL_ACTIONS.has(event.type)) {
        this.suppressedCount++;
        return false;
      }
    });
  }

  teardownBackgroundThrottle() {
    for (const [evt, handler, target] of this.focusHandlers) {
      target.removeEventListener(evt, handler);
    }
    this.focusHandlers = [];
    if (this.focusPollInterval) clearInterval(this.focusPollInterval);
    BdApi.Patcher.unpatchAll('Fwishium');
    this.removeThrottleCSS();
    this.throttled = false;
  }

  stop() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.keyListener) document.removeEventListener("keydown", this.keyListener);
    if (this.overlay) this.overlay.remove();
    this.teardownBackgroundThrottle();
    this.disableAnimThrottle();
  }


  freezeAnimatedImg(img) {
    const src = img.src || '';
    if (src.includes('.gif') && src.includes('cdn.discordapp.com')) {
      img.dataset.fwishiumOrigSrc = src;
      img.src = src.replace(/\.gif/, '.webp') + (src.includes('?') ? '&' : '?') + 'quality=lossless';
    }
    if ((src.includes('tenor.com') || src.includes('giphy.com')) && src.includes('.gif')) {
      img.dataset.fwishiumOrigSrc = src;
      img.src = src.replace(/\.gif/, '.webp');
    }
  }

  unfreezeAnimatedImg(img) {
    if (img.dataset.fwishiumOrigSrc) {
      img.src = img.dataset.fwishiumOrigSrc;
      delete img.dataset.fwishiumOrigSrc;
    }
  }

  enableAnimThrottle() {
    if (this.animThrottleStyle) return;

    this.animThrottleStyle = document.createElement('style');
    this.animThrottleStyle.id = 'fwishium-anim-throttle';
    this.animThrottleStyle.textContent = `
      [class*="chat"] video[class*="embed"],
      [class*="chat"] video[class*="mosaic"] {
        animation-play-state: paused !important;
      }
      [class*="animatedEmoji"] {
        animation: none !important;
      }
      img[class*="emoji"][src*=".gif"] {
        content: attr(alt) !important;
      }
    `;
    document.head.appendChild(this.animThrottleStyle);

    document.querySelectorAll('img[src*=".gif"]').forEach(img => this.freezeAnimatedImg(img));

    this.animObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'IMG' && node.src && node.src.includes('.gif')) {
            this.freezeAnimatedImg(node);
          }
          node.querySelectorAll?.('img[src*=".gif"]')?.forEach(img => this.freezeAnimatedImg(img));
        }
      }
    });
    this.animObserver.observe(document.body, { childList: true, subtree: true });
  }

  disableAnimThrottle() {
    if (this.animThrottleStyle) {
      this.animThrottleStyle.remove();
      this.animThrottleStyle = null;
    }
    if (this.animObserver) {
      this.animObserver.disconnect();
      this.animObserver = null;
    }
    document.querySelectorAll('img[data-fwishium-orig-src]').forEach(img => this.unfreezeAnimatedImg(img));
  }

  saveConfig(config) {
    try {
      const configPath = path.join(path.dirname(__filename), 'fwishium.config.json');
      const data = {
        all: {
          amounts: {
            cpuCap: config.cpuCap,
            candleStickCount: config.candleStickCount,
            updateInterval: config.updateInterval
          },
          general: {
            showCPU: config.showCPU,
            showRSS: config.showRSS,
            showHeap: config.showHeap,
            backgroundThrottle: config.backgroundThrottle,
            animThrottle: config.animThrottle
          }
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
      this.config = config;
    } catch (e) {
      console.error('[Fwishium] Failed to save config:', e.message);
    }
  }

  getSettingsPanel() {
    const settings = [
      {
        type: 'category',
        id: 'features',
        name: 'Features',
        collapsible: true,
        shown: true,
        settings: [
          {
            type: 'switch',
            id: 'backgroundThrottle',
            name: 'Background Throttle',
            note: 'Suppress Discord when unfocused',
            value: this.config.backgroundThrottle,
          },
          {
            type: 'switch',
            id: 'animThrottle',
            name: 'Animation Throttle',
            note: 'Replace animated GIFs with static images',
            value: this.config.animThrottle,
          },
        ],
      },
      {
        type: 'category',
        id: 'display',
        name: 'Monitor Display',
        collapsible: true,
        shown: true,
        settings: [
          {
            type: 'switch',
            id: 'showCPU',
            name: 'CPU Usage',
            note: 'Show real-time CPU percentage',
            value: this.config.showCPU,
          },
          {
            type: 'switch',
            id: 'showRSS',
            name: 'RSS Memory',
            note: 'Show resident set size',
            value: this.config.showRSS,
          },
          {
            type: 'switch',
            id: 'showHeap',
            name: 'Heap Usage',
            note: 'Show JavaScript heap allocation',
            value: this.config.showHeap,
          },
        ],
      },
      {
        type: 'category',
        id: 'tuning',
        name: 'Performance Tuning',
        collapsible: true,
        shown: true,
        settings: [
          {
            type: 'slider',
            id: 'cpuCap',
            name: 'CPU Cap',
            note: 'Set maximum CPU % for scaling (20-100%)',
            min: 20,
            max: 100,
            markers: [20, 40, 60, 80, 100],
            value: this.config.cpuCap,
          },
          {
            type: 'slider',
            id: 'candleStickCount',
            name: 'Chart History',
            note: 'Number of candlesticks to display',
            min: 5,
            max: 30,
            markers: [5, 10, 15, 20, 25, 30],
            value: this.config.candleStickCount,
          },
          {
            type: 'slider',
            id: 'updateInterval',
            name: 'Update Interval',
            note: 'Milliseconds between metric updates',
            min: 500,
            max: 5000,
            step: 500,
            markers: [500, 1000, 2000, 3000, 4000, 5000],
            value: this.config.updateInterval,
          },
        ],
      },
    ];

    return BdApi.UI.buildSettingsPanel({
      settings,
      onChange: (category, id, value) => {
        this.config[id] = value;
        
        if (id === 'animThrottle') {
          value ? this.enableAnimThrottle() : this.disableAnimThrottle();
        }
        
        this.saveConfig(this.config);
      },
    });
  }
};
