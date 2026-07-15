// EcoVerse Auth Bridge
// Bridges the new multi-page scripts to the canonical EcoVerseSimulator.
// Must be loaded AFTER simulation.js on portal/education pages.
// On pages that DON'T load simulation.js (calculator.html, index.html),
// this creates a lightweight stand-alone adapter that reads from LocalStorage.

(function () {
  const STORAGE_KEY = "ecoverse_user_state";

  function defaultProfile() {
    return {
      points: 0, level: 1, totalTrees: 0, totalGarbage: 0,
      totalEWaste: 0, totalComplaints: 0,
      trees: [], garbageReports: [], ewasteDisposals: [],
      emergencyTickets: [], redeemedVouchers: []
    };
  }

  // If the full Simulator already exists, just alias it and add the helper stubs
  // that the new pages expect (user, saveUser, addActivityLog, triggerToastNotification).
  if (window.EcoVerseSimulator) {
    const sim = window.EcoVerseSimulator;

    // Alias: auth.user → simulator.state
    Object.defineProperty(sim, "user", {
      get() { return this.state; },
      set(v) { this.state = v; }
    });

    // Alias: saveUser → saveState
    if (!sim.saveUser) {
      sim.saveUser = function () { this.saveState(); };
    }

    // Alias: addActivityLog → addActivityRecord
    if (!sim.addActivityLog) {
      sim.addActivityLog = function (desc, type) { this.addActivityRecord(desc, type); };
    }

    // Alias: triggerToastNotification → showToast
    if (!sim.triggerToastNotification) {
      sim.triggerToastNotification = function (msg, type) { this.showToast(msg, type); };
    }

    window.EcoVerseAuth = sim;
    return;
  }

  // ── Lightweight stand-alone adapter (used on index.html & calculator.html) ──
  const adapter = {
    user: null,

    _load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return defaultProfile();
    },

    _init() {
      this.user = this._load();
    },

    saveUser() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
      window.dispatchEvent(new CustomEvent("ecoverseStateChanged", { detail: this.user }));
    },

    getBadgeName(level) {
      if (level >= 10) return "🌳 Grand Eco-Guardian";
      if (level >= 7)  return "🌿 Leaf Legend";
      if (level >= 4)  return "🗑️ Spotless Knight";
      if (level >= 2)  return "♻️ Recycle Ranger";
      return "🌱 Green Novice";
    },

    addPoints(amount, desc, type) {
      this.user.points += amount;
      const oldLevel = this.user.level;
      this.user.level = Math.floor(this.user.points / 500) + 1;
      this.saveUser();
      if (this.user.level > oldLevel) {
        this.triggerToastNotification(`Level Up! You are now Level ${this.user.level}! 🎉`, "success");
      }
    },

    addActivityLog(desc, type) {
      // Persist to a separate log key so it works cross-page
      let logs = [];
      try { logs = JSON.parse(localStorage.getItem("ecoverse_activity_logs") || "[]"); } catch (e) {}
      logs.unshift({ desc, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      if (logs.length > 30) logs.pop();
      localStorage.setItem("ecoverse_activity_logs", JSON.stringify(logs));
      window.dispatchEvent(new CustomEvent("ecoverseLogsChanged"));
    },

    triggerToastNotification(message, type = "info") {
      const container = document.getElementById("toast-container");
      if (!container) return;
      const iconMap = { success: "fa-circle-check", info: "fa-circle-info", warning: "fa-triangle-exclamation", danger: "fa-skull-crossbones" };
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <i class="fa-solid ${iconMap[type] || "fa-circle-info"}"></i>
        <div class="toast-message">${message}</div>
        <div class="toast-close"><i class="fa-solid fa-xmark"></i></div>
      `;
      container.appendChild(toast);
      toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
      setTimeout(() => toast.remove(), 4500);
    },

    // getCurrentLocation stub (used by portal.js but simulator handles it when loaded)
    getCurrentLocation() {
      return new Promise((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({ lat: 12.9716 + (Math.random() - 0.5) * 0.05, lng: 77.5946 + (Math.random() - 0.5) * 0.05 }),
            { timeout: 5000 }
          );
        } else {
          resolve({ lat: 12.9716, lng: 77.5946 });
        }
      });
    },

    drawSimulatedObject() {} // no-op on pages without simulation.js
  };

  adapter._init();
  window.EcoVerseAuth = adapter;
})();
