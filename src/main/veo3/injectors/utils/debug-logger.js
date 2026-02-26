(function () {
  if (window.__veo3_debug_loaded) return;
  window.__veo3_debug_loaded = true;

  var CONFIG = { enabled: true, logLevel: 'DEBUG', maxBuffer: 2000 };
  var LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  var buffer = [];

  function log(level, category, message, data) {
    if (!CONFIG.enabled || LEVELS[level] < LEVELS[CONFIG.logLevel]) return;

    var ts = new Date().toISOString().slice(11, 23);
    var entry = { ts: ts, level: level, category: category, message: message, data: data || null };

    buffer.push(entry);
    if (buffer.length > CONFIG.maxBuffer) buffer.shift();

    // Color-coded console output
    var levelColors = { DEBUG: '#888', INFO: '#4285F4', WARN: '#FBBC04', ERROR: '#EA4335' };
    var catColors = {
      INJECT: '#34A853', MSG_SEND: '#8B5CF6', MSG_RECV: '#6366F1',
      DOM: '#F59E0B', MODE: '#EC4899', SUBMIT: '#14B8A6',
      UPLOAD: '#F97316', TIMING: '#64748B', BRIDGE: '#3B82F6', AUTO: '#10B981'
    };

    var levelColor = levelColors[level] || '#888';
    var catColor = catColors[category] || '#888';
    var prefix = '%c[' + ts + '] %c[' + level + '] %c[' + category + ']%c ';

    if (data) {
      console.log(prefix + message, 'color:#666', 'color:' + levelColor, 'color:' + catColor, 'color:inherit', data);
    } else {
      console.log(prefix + message, 'color:#666', 'color:' + levelColor, 'color:' + catColor, 'color:inherit');
    }

    // Report critical errors to React side
    if (level === 'ERROR') {
      console.log(JSON.stringify({
        type: 'CONTENT_TO_SIDEPANEL',
        action: 'DEBUG_ERROR',
        data: entry
      }));
    }
  }

  window.veo3Debug = {
    config: CONFIG,

    debug: function (cat, msg, data) { log('DEBUG', cat, msg, data); },
    info: function (cat, msg, data) { log('INFO', cat, msg, data); },
    warn: function (cat, msg, data) { log('WARN', cat, msg, data); },
    error: function (cat, msg, data) { log('ERROR', cat, msg, data); },

    // Dump all logs as JSON string (for copy-paste)
    dump: function () { return JSON.stringify(buffer, null, 2); },

    // Get log buffer
    getBuffer: function () { return buffer.slice(); },

    // Summary counts by level
    getSummary: function () {
      var s = { total: buffer.length, debug: 0, info: 0, warn: 0, error: 0 };
      for (var i = 0; i < buffer.length; i++) {
        var l = buffer[i].level.toLowerCase();
        if (s[l] !== undefined) s[l]++;
      }
      return s;
    },

    // Clear buffer
    clear: function () { buffer.length = 0; },

    // Enable/disable
    setEnabled: function (v) { CONFIG.enabled = v; },
    setLevel: function (v) { CONFIG.logLevel = v; },

    // Copy logs to clipboard
    copyToClipboard: function () {
      var text = JSON.stringify(buffer, null, 2);
      try {
        navigator.clipboard.writeText(text);
        console.log('[DebugLogger] Logs copied to clipboard (' + buffer.length + ' entries)');
        return true;
      } catch (e) {
        console.log('[DebugLogger] Clipboard not available. Use veo3Debug.dump() instead.');
        return false;
      }
    }
  };

  console.log('[Flow] Debug logger loaded - use veo3Debug.dump() to export logs');
})();
