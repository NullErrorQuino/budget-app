    (function () {
      const STORAGE_KEY = "budget_app_data_v1";
      const MOBILE_QUERY = window.matchMedia("(max-width: 720px)");
      const money = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
      });

      function emptyData() {
        return {
          setup: null,
          incomes: [],
          bills: [],
          savings: [],
          checks: {},
          categories: [],
          transactions: [],
          theme: { primary: "#2a2a2a", accent: "#666666" }
        };
      }

      let appData = emptyData();
      let periodIndex = 0;
      let editingPlan = true;
      let draftCadence = null;
      let currentPage = "homePage";
      let billFrequency = "monthly";
      let editingIncomeId = null;
      let editingBillId = null;
      let editingSavingId = null;
      let savingKind = "timed";
      let editingSavingKind = "timed";

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            appData = Object.assign(emptyData(), parsed);
            if (!Array.isArray(appData.incomes)) appData.incomes = [];
            if (!Array.isArray(appData.bills)) appData.bills = [];
            if (!Array.isArray(appData.savings)) appData.savings = [];
            if (!appData.checks || typeof appData.checks !== "object") appData.checks = {};
            if (!Array.isArray(appData.transactions)) appData.transactions = [];
          }
        }
      } catch (e) {}

      if (
        !appData.setup &&
        (!appData.incomes || !appData.incomes.length) &&
        window.APP_DATA &&
        typeof window.APP_DATA === "object"
      ) {
        appData = Object.assign(emptyData(), window.APP_DATA);
      }

      editingPlan = !appData.setup;
      draftCadence = appData.setup ? appData.setup.cadence : null;

      function persist() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {}
        persistAppJson();
      }

      var linkedJsonHandle = null;

      function dataBlob() {
        return JSON.stringify(appData, null, 2);
      }

      function setDataFileStatus(text) {
        var el = document.getElementById("dataFileStatus");
        if (el) el.textContent = text;
      }

      function persistAppJson() {
        var text = dataBlob();
        writeOpfsJson(text);
        writeLinkedJson(text);
      }

      function writeOpfsJson(text) {
        if (!navigator.storage || !navigator.storage.getDirectory) {
          return Promise.resolve(false);
        }
        return navigator.storage
          .getDirectory()
          .then(function (root) {
            return root.getFileHandle("app.json", { create: true });
          })
          .then(function (handle) {
            return handle.createWritable().then(function (writable) {
              return writable.write(text).then(function () {
                return writable.close();
              });
            });
          })
          .then(function () {
            setDataFileStatus("Also writing app.json inside the installed app.");
            return true;
          })
          .catch(function () {
            return false;
          });
      }

      function writeLinkedJson(text) {
        if (!linkedJsonHandle || !linkedJsonHandle.createWritable) {
          return Promise.resolve(false);
        }
        return linkedJsonHandle
          .createWritable()
          .then(function (writable) {
            return writable.write(text).then(function () {
              return writable.close();
            });
          })
          .then(function () {
            setDataFileStatus("Saving to the app.json file you chose.");
            return true;
          })
          .catch(function () {
            return false;
          });
      }

      function downloadAppJson() {
        var blob = new Blob([dataBlob()], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "app.json";
        a.click();
        URL.revokeObjectURL(url);
      }

      function linkAppJsonFile() {
        if (window.showSaveFilePicker) {
          return window
            .showSaveFilePicker({
              suggestedName: "app.json",
              types: [
                {
                  description: "Budget data",
                  accept: { "application/json": [".json"] }
                }
              ]
            })
            .then(function (handle) {
              linkedJsonHandle = handle;
              return writeLinkedJson(dataBlob());
            })
            .catch(function () {
              return false;
            });
        }
        downloadAppJson();
        setDataFileStatus("This browser cannot keep a live file link. Downloaded app.json instead.");
        return Promise.resolve(false);
      }

      function loadOpfsJson() {
        if (!navigator.storage || !navigator.storage.getDirectory) {
          return Promise.resolve(null);
        }
        return navigator.storage
          .getDirectory()
          .then(function (root) {
            return root.getFileHandle("app.json");
          })
          .then(function (handle) {
            return handle.getFile();
          })
          .then(function (file) {
            return file.text();
          })
          .then(function (text) {
            var parsed = JSON.parse(text);
            return parsed && typeof parsed === "object" ? parsed : null;
          })
          .catch(function () {
            return null;
          });
      }

      function dataLooksEmpty(data) {
        return !(
          data &&
          (data.setup ||
            (data.incomes && data.incomes.length) ||
            (data.bills && data.bills.length) ||
            (data.savings && data.savings.length))
        );
      }

      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(function () {});
      }

      function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
      }

      function hexToRgb(hex) {
        var h = String(hex || "").replace("#", "");
        if (h.length === 3) {
          h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (h.length !== 6) return { r: 42, g: 42, b: 42 };
        return {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16)
        };
      }

      function rgbToHex(r, g, b) {
        return (
          "#" +
          [r, g, b]
            .map(function (n) {
              return clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
            })
            .join("")
        );
      }

      function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var h = 0;
        var s = 0;
        var l = (max + min) / 2;
        if (max !== min) {
          var d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h /= 6;
        }
        return { h: h, s: s, l: l };
      }

      function hslToRgb(h, s, l) {
        function hue2rgb(p, q, t) {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        }
        var r;
        var g;
        var b;
        if (s === 0) {
          r = g = b = l;
        } else {
          var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          var p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: r * 255, g: g * 255, b: b * 255 };
      }

      function shiftLight(hex, delta) {
        var rgb = hexToRgb(hex);
        var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        hsl.l = clamp(hsl.l + delta, 0.04, 0.96);
        var out = hslToRgb(hsl.h, hsl.s, hsl.l);
        return rgbToHex(out.r, out.g, out.b);
      }

      function luminance(hex) {
        var c = hexToRgb(hex);
        var a = [c.r, c.g, c.b].map(function (v) {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      }

      function contrastOn(hex) {
        return luminance(hex) < 0.45 ? "#f3f3f3" : "#161616";
      }

      function punchReadability(color, against) {
        var light = luminance(color) >= 0.5;
        var next = shiftLight(color, light ? 0.14 : -0.14);
        if (Math.abs(luminance(next) - luminance(against)) < 0.32) {
          next = shiftLight(next, luminance(against) < 0.45 ? 0.2 : -0.2);
        }
        return next;
      }

      function mutedOn(bg, text) {
        var seed = luminance(bg) < 0.45 ? shiftLight(text, -0.1) : shiftLight(text, 0.1);
        return punchReadability(seed, bg);
      }

      function applyTheme(primary, accent) {
        var dark = luminance(primary) < 0.45;
        var bg = shiftLight(primary, dark ? -0.08 : 0.1);
        var header = shiftLight(primary, dark ? -0.02 : -0.04);
        var card = shiftLight(primary, dark ? 0.06 : 0.12);
        var inset = shiftLight(primary, dark ? -0.03 : 0.06);
        var border = shiftLight(primary, dark ? 0.12 : -0.1);
        var line = shiftLight(primary, dark ? 0.1 : -0.08);
        var accentHover = shiftLight(accent, dark ? 0.08 : -0.08);
        var text = punchReadability(contrastOn(bg), bg);
        var muted = mutedOn(card, text);
        var accentInk = contrastPush(accent, card);
        var root = document.documentElement.style;
        root.setProperty("--primary", primary);
        root.setProperty("--accent", accent);
        root.setProperty("--bg", bg);
        root.setProperty("--header", header);
        root.setProperty("--card-bg", card);
        root.setProperty("--card-border", border);
        root.setProperty("--inset", inset);
        root.setProperty("--line", line);
        root.setProperty("--text", text);
        root.setProperty("--text-muted", muted);
        root.setProperty("--accent-hover", accentHover);
        root.setProperty("--accent-ink", accentInk);
        root.setProperty("--accent-contrast", punchReadability(contrastOn(accent), accent));
      }

      function contrastPush(color, against) {
        var bgDark = luminance(against) < 0.45;
        var next = shiftLight(color, bgDark ? 0.28 : -0.28);
        if (Math.abs(luminance(next) - luminance(against)) < 0.38) {
          next = shiftLight(next, bgDark ? 0.22 : -0.22);
        }
        return next;
      }

      function currentTheme() {
        var theme = appData.theme || {};
        return {
          primary: theme.primary || "#2a2a2a",
          accent: theme.accent || "#666666"
        };
      }

      function syncThemeFields() {
        var theme = currentTheme();
        document.getElementById("primaryColor").value = theme.primary;
        document.getElementById("accentColor").value = theme.accent;
        document.getElementById("primaryHex").textContent = theme.primary;
        document.getElementById("accentHex").textContent = theme.accent;
      }

      function toIso(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
      }

      function todayIso() {
        return toIso(new Date());
      }

      function parseDay(iso) {
        const parts = String(iso || "").split("-").map(Number);
        return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
      }

      function addDays(iso, days) {
        const date = parseDay(iso);
        date.setDate(date.getDate() + days);
        return toIso(date);
      }

      function addMonths(iso, months) {
        const date = parseDay(iso);
        date.setDate(1);
        date.setMonth(date.getMonth() + months);
        return toIso(date);
      }

      function daysInMonth(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0).getDate();
      }

      function ordinal(n) {
        var v = n % 100;
        if (v >= 11 && v <= 13) return n + "th";
        if (n % 10 === 1) return n + "st";
        if (n % 10 === 2) return n + "nd";
        if (n % 10 === 3) return n + "rd";
        return n + "th";
      }

      function monthlyOccurrence(period, dayOfMonth) {
        var start = parseDay(period.start);
        var last = parseDay(addDays(period.end, -1));
        var year = start.getFullYear();
        var month = start.getMonth();
        var endYear = last.getFullYear();
        var endMonth = last.getMonth();
        while (year < endYear || (year === endYear && month <= endMonth)) {
          var dueDay = Math.min(dayOfMonth, daysInMonth(year, month));
          var due = toIso(new Date(year, month, dueDay));
          if (inPeriod(due, period)) return due;
          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
        }
        return null;
      }

      function yearlyOccurrence(period, monthIndex, day) {
        var start = parseDay(period.start);
        var last = parseDay(addDays(period.end, -1));
        for (var year = start.getFullYear(); year <= last.getFullYear(); year++) {
          var dueDay = Math.min(day, daysInMonth(year, monthIndex));
          var due = toIso(new Date(year, monthIndex, dueDay));
          if (inPeriod(due, period)) return due;
        }
        return null;
      }

      function billDueInPeriod(bill, period) {
        if (!bill || !bill.dueDate || !period) return null;
        var ref = parseDay(bill.dueDate);
        if (bill.frequency === "yearly") {
          return yearlyOccurrence(period, ref.getMonth(), ref.getDate());
        }
        return monthlyOccurrence(period, ref.getDate());
      }

      function formatBillRule(bill) {
        var d = parseDay(bill.dueDate);
        if (bill.frequency === "yearly") {
          return "Every " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
        return "Every " + ordinal(d.getDate());
      }

      function formatDay(iso) {
        return parseDay(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      }

      function uid() {
        return "id-" + Date.now().toString(36) + "-" + Math.random().toString(16).slice(2);
      }

      function currentBiweeklyIndex(startDate, today) {
        const start = parseDay(startDate).getTime();
        const now = parseDay(today).getTime();
        return Math.floor((now - start) / 86400000 / 14);
      }

      function periodAt(setup, index) {
        if (!setup) return null;
        if (setup.cadence === "biweekly") {
          const start = addDays(setup.startDate, index * 14);
          return { start: start, end: addDays(start, 14), index: index };
        }
        const first = todayIso().slice(0, 8) + "01";
        const start = addMonths(first, index);
        return { start: start, end: addMonths(start, 1), index: index };
      }

      function inPeriod(iso, period) {
        return iso >= period.start && iso < period.end;
      }

      function formatRange(period) {
        const start = parseDay(period.start);
        const last = parseDay(addDays(period.end, -1));
        const sameYear = start.getFullYear() === last.getFullYear();
        const startStr = start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric"
        });
        const endStr = last.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: sameYear ? undefined : "numeric"
        });
        return startStr + " – " + endStr;
      }

      function defaultIncomeDate(period) {
        const today = todayIso();
        if (inPeriod(today, period)) return today;
        return period.start;
      }

      function isMobile() {
        return MOBILE_QUERY.matches;
      }

      function applyShell() {
        var mobile = isMobile();
        document.body.classList.toggle("is-mobile", mobile);
        document.body.classList.toggle("is-desktop", !mobile);
      }

      function showPage(id) {
        currentPage = id;
        document.querySelectorAll(".page").forEach(function (el) {
          el.classList.toggle("is-active", el.id === id);
        });
        document.querySelectorAll(".site-nav-link").forEach(function (btn) {
          btn.classList.toggle("is-active", btn.getAttribute("data-page") === id);
        });
        updateFab();
        if (id === "billsPage") renderBills();
        if (id === "planPage") renderPlan();
      }

      function planReady() {
        return !!(
          appData.setup &&
          !editingPlan &&
          (appData.setup.cadence === "monthly" ||
            (appData.setup.cadence === "biweekly" && appData.setup.startDate))
        );
      }

      function updateFab() {
        var fab = document.getElementById("openAddBtn");
        if (currentPage === "billsPage") {
          fab.hidden = false;
          fab.setAttribute("aria-label", "Add bill");
        } else if (currentPage === "homePage" && planReady()) {
          fab.hidden = false;
          fab.setAttribute("aria-label", "Add income");
        } else {
          fab.hidden = true;
        }
      }

      function periodIncomes(period) {
        return (appData.incomes || []).filter(function (item) {
          return inPeriod(item.date, period);
        });
      }

      function periodSpent(period) {
        var logged = (appData.transactions || [])
          .filter(function (item) {
            return inPeriod(item.date, period);
          })
          .reduce(function (n, item) {
            return n + Number(item.amount || 0);
          }, 0);
        return (
          logged +
          periodDueBills(period).reduce(function (n, item) {
            return n + Number(item.amount || 0);
          }, 0) +
          periodDueSavings(period).reduce(function (n, item) {
            return n + Number(item.amount || 0);
          }, 0)
        );
      }

      function periodDueBills(period) {
        return (appData.bills || []).filter(function (bill) {
          return !!billDueInPeriod(bill, period);
        });
      }

      function periodIndexForDate(setup, iso) {
        if (!setup || !iso) return 0;
        if (setup.cadence === "biweekly") {
          return currentBiweeklyIndex(setup.startDate, iso);
        }
        var origin = todayIso().slice(0, 8) + "01";
        var a = parseDay(iso);
        var b = parseDay(origin);
        return a.getFullYear() * 12 + a.getMonth() - (b.getFullYear() * 12 + b.getMonth());
      }

      function periodsCovering(setup, fromIso, toIso) {
        if (!setup || !fromIso || !toIso || toIso < fromIso) return 0;
        return periodIndexForDate(setup, toIso) - periodIndexForDate(setup, fromIso) + 1;
      }

      function savingsPerPeriod(goal, setup) {
        if (goal.kind === "continuous") {
          var monthly = Number(goal.monthlyAmount || 0);
          var each = setup && setup.cadence === "biweekly" ? monthly / 2 : monthly;
          return Math.round(each * 100) / 100;
        }
        var count = periodsCovering(setup, goal.startDate, goal.targetDate);
        if (count < 1) count = 1;
        return Math.round((Number(goal.targetAmount || 0) / count) * 100) / 100;
      }

      function savingsApplies(goal, period) {
        if (!goal || !period) return false;
        var last = addDays(period.end, -1);
        if (goal.kind === "continuous") {
          return last >= (goal.startDate || period.start);
        }
        return period.start <= goal.targetDate && last >= goal.startDate;
      }

      function periodDueSavings(period) {
        var setup = appData.setup;
        if (!setup) return [];
        return (appData.savings || [])
          .filter(function (goal) {
            return savingsApplies(goal, period);
          })
          .map(function (goal) {
            return {
              id: goal.id,
              name: goal.name,
              amount: savingsPerPeriod(goal, setup),
              targetDate: goal.targetDate,
              targetAmount: goal.targetAmount,
              monthlyAmount: goal.monthlyAmount,
              kind: goal.kind || "timed"
            };
          });
      }

      function setSavingKind(next) {
        savingKind = next;
        document.getElementById("savingTimedBtn").classList.toggle("is-active", next === "timed");
        document.getElementById("savingContinuousBtn").classList.toggle("is-active", next === "continuous");
        document.getElementById("savingDateField").hidden = next !== "timed";
        document.getElementById("savingAmountLabel").textContent =
          next === "continuous" ? "Save this much every month" : "How much to save";
        previewSavings();
      }

      function previewSavings() {
        var setup = appData.setup;
        var name = document.getElementById("savingName").value.trim();
        var amount = Number.parseFloat(document.getElementById("savingAmount").value);
        var date = document.getElementById("savingDate").value;
        var note = document.getElementById("savingPreviewNote");
        var figure = document.getElementById("savingPreviewAmount");
        var btn = document.getElementById("saveSavingBtn");
        if (!setup) {
          note.textContent = "Save a plan type on Home first.";
          figure.hidden = true;
          btn.disabled = true;
          return null;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          note.textContent =
            savingKind === "continuous"
              ? "Enter a monthly amount to see what hits each period."
              : "Fill in the amount and date to see the per-period hit.";
          figure.hidden = true;
          btn.disabled = true;
          return null;
        }
        var start = todayIso();
        if (savingKind === "continuous") {
          var eachCont =
            setup.cadence === "biweekly"
              ? Math.round((amount / 2) * 100) / 100
              : Math.round(amount * 100) / 100;
          note.textContent =
            setup.cadence === "biweekly"
              ? "Monthly " +
                money.format(amount) +
                " becomes this much each two-week period."
              : "This amount will hit Due this period every month.";
          figure.hidden = false;
          figure.textContent = money.format(eachCont);
          btn.disabled = !name;
          return {
            kind: "continuous",
            name: name,
            monthlyAmount: Math.round(amount * 100) / 100,
            startDate: start,
            each: eachCont
          };
        }
        if (!date) {
          note.textContent = "Fill in the amount and date to see the per-period hit.";
          figure.hidden = true;
          btn.disabled = true;
          return null;
        }
        if (date < start) {
          note.textContent = "Pick a date from today on.";
          figure.hidden = true;
          btn.disabled = true;
          return null;
        }
        var count = periodsCovering(setup, start, date);
        if (count < 1) count = 1;
        var each = Math.round((amount / count) * 100) / 100;
        var kindLabel = setup.cadence === "biweekly" ? "two-week period" : "month";
        note.textContent =
          "To reach " +
          money.format(amount) +
          " by " +
          formatDay(date) +
          ", set aside this much each " +
          kindLabel +
          " for " +
          count +
          (count === 1 ? " period." : " periods.");
        figure.hidden = false;
        figure.textContent = money.format(each);
        btn.disabled = !name;
        return {
          kind: "timed",
          name: name,
          targetAmount: Math.round(amount * 100) / 100,
          targetDate: date,
          startDate: start,
          each: each,
          count: count
        };
      }

      function renderPlan() {
        var ready = planReady();
        document.getElementById("planNeedSetup").hidden = ready;
        document.getElementById("savingsFormCard").hidden = !ready;
        document.getElementById("savingsListCard").hidden = !ready;
        if (!ready) return;
        setSavingKind(savingKind);
        previewSavings();
        var list = document.getElementById("savingsList");
        var goals = appData.savings || [];
        list.innerHTML = "";
        goals.forEach(function (goal) {
          var each = savingsPerPeriod(goal, appData.setup);
          var subtitle =
            goal.kind === "continuous"
              ? money.format(each) +
                " / period · " +
                money.format(goal.monthlyAmount) +
                " a month"
              : money.format(each) +
                " / period · " +
                money.format(goal.targetAmount) +
                " by " +
                formatDay(goal.targetDate);
          list.appendChild(
            renderEntry({ name: goal.name, amount: each }, subtitle, {
              onEdit: function () {
                openSavingModal(goal);
              }
            })
          );
        });
        document.getElementById("savingsEmpty").hidden = goals.length > 0;
      }

      function openIncomeModal(existing) {
        var setup = appData.setup;
        if (!setup) return;
        var period = periodAt(setup, periodIndex);
        editingIncomeId = existing ? existing.id : null;
        document.getElementById("incomeModalTitle").textContent = existing ? "Edit income" : "Add income";
        document.getElementById("incomeSubmitBtn").textContent = existing ? "Save changes" : "Add income";
        document.getElementById("incomeDeleteBtn").hidden = !existing;
        document.getElementById("incomeName").value = existing ? existing.name : "";
        document.getElementById("incomeAmount").value = existing ? String(existing.amount) : "";
        document.getElementById("incomeDate").value = existing ? existing.date : defaultIncomeDate(period);
        document.getElementById("incomeModal").classList.remove("hidden");
        document.getElementById("incomeName").focus();
      }

      function closeIncomeModal() {
        editingIncomeId = null;
        document.getElementById("incomeModal").classList.add("hidden");
      }

      function checkKey(period, id) {
        return (period && period.start ? period.start : "") + ":" + id;
      }

      function isChecked(period, id) {
        return !!(appData.checks && appData.checks[checkKey(period, id)]);
      }

      function toggleCheck(period, id) {
        if (!appData.checks) appData.checks = {};
        var key = checkKey(period, id);
        if (appData.checks[key]) delete appData.checks[key];
        else appData.checks[key] = true;
        persist();
      }

      function setBillFrequency(next) {
        billFrequency = next;
        document.getElementById("billMonthlyBtn").classList.toggle("is-active", next === "monthly");
        document.getElementById("billYearlyBtn").classList.toggle("is-active", next === "yearly");
        document.getElementById("billDateLabel").textContent =
          next === "yearly" ? "Day of the year" : "Day of the month";
        document.getElementById("billDateHint").textContent =
          next === "yearly"
            ? "Pick any date. The month and day repeat each year."
            : "Pick any date. Only the day is used each month.";
      }

      function openBillModal(existing) {
        editingBillId = existing ? existing.id : null;
        document.getElementById("billModalTitle").textContent = existing ? "Edit bill" : "Add bill";
        document.getElementById("billSubmitBtn").textContent = existing ? "Save changes" : "Add bill";
        document.getElementById("billDeleteBtn").hidden = !existing;
        document.getElementById("billName").value = existing ? existing.name : "";
        document.getElementById("billAmount").value = existing ? String(existing.amount) : "";
        document.getElementById("billDate").value = existing ? existing.dueDate : todayIso();
        setBillFrequency(existing && existing.frequency === "yearly" ? "yearly" : "monthly");
        document.getElementById("billModal").classList.remove("hidden");
        document.getElementById("billName").focus();
      }

      function closeBillModal() {
        editingBillId = null;
        document.getElementById("billModal").classList.add("hidden");
      }

      function openSavingModal(existing) {
        if (!existing) return;
        editingSavingId = existing.id;
        editingSavingKind = existing.kind === "continuous" ? "continuous" : "timed";
        document.getElementById("savingModalName").value = existing.name || "";
        document.getElementById("savingModalAmountLabel").textContent =
          editingSavingKind === "continuous" ? "Save this much every month" : "How much to save";
        document.getElementById("savingModalAmount").value = String(
          editingSavingKind === "continuous" ? existing.monthlyAmount : existing.targetAmount || ""
        );
        document.getElementById("savingModalDateField").hidden = editingSavingKind !== "timed";
        document.getElementById("savingModalDate").value = existing.targetDate || "";
        var each = savingsPerPeriod(existing, appData.setup);
        document.getElementById("savingModalNote").textContent =
          editingSavingKind === "continuous"
            ? money.format(each) + " hits Due this period every window."
            : money.format(each) + " each period until " + formatDay(existing.targetDate);
        document.getElementById("savingModal").classList.remove("hidden");
        document.getElementById("savingModalName").focus();
      }

      function closeSavingModal() {
        editingSavingId = null;
        document.getElementById("savingModal").classList.add("hidden");
      }

      function editOnPage(pageId, opener) {
        showPage(pageId);
        window.setTimeout(opener, 0);
      }

      function renderEntry(item, subtitle, opts) {
        opts = opts || {};
        var li = document.createElement("li");
        li.className = "entry";
        li.innerHTML =
          (opts.check ? "<label class=\"tick\"><input type=\"checkbox\"></label>" : "") +
          "<div class=\"entry-copy\"><strong></strong><span class=\"muted\"></span></div>" +
          "<div class=\"entry-side\"><span class=\"amount\"></span>" +
          "<button type=\"button\" class=\"text-btn\" data-edit>Edit</button></div>";
        li.querySelector("strong").textContent = item.name;
        li.querySelector(".muted").textContent = subtitle;
        li.querySelector(".amount").textContent = money.format(item.amount);
        if (opts.onEdit) {
          li.querySelector("[data-edit]").addEventListener("click", opts.onEdit);
        }
        if (opts.check) {
          var box = li.querySelector("input[type='checkbox']");
          box.checked = isChecked(opts.check.period, opts.check.id);
          if (box.checked) li.classList.add("is-done");
          box.addEventListener("change", function () {
            toggleCheck(opts.check.period, opts.check.id);
            li.classList.toggle("is-done", box.checked);
          });
        }
        return li;
      }

      function renderBills() {
        var list = document.getElementById("billsList");
        var bills = appData.bills || [];
        list.innerHTML = "";
        bills.forEach(function (bill) {
          list.appendChild(
            renderEntry(bill, formatBillRule(bill), {
              onEdit: function () {
                openBillModal(bill);
              }
            })
          );
        });
        document.getElementById("billsEmpty").hidden = bills.length > 0;
      }

      function renderHome() {
        var setup = appData.setup;
        var editor = document.getElementById("planEditor");
        var compact = document.getElementById("planCompact");
        var startField = document.getElementById("startDateField");
        var startInput = document.getElementById("startDateInput");

        document.getElementById("chooseBiweekly").classList.toggle(
          "is-active",
          draftCadence === "biweekly"
        );
        document.getElementById("chooseMonthly").classList.toggle(
          "is-active",
          draftCadence === "monthly"
        );
        startField.hidden = draftCadence !== "biweekly";
        if (draftCadence === "biweekly") {
          startInput.value =
            (setup && setup.cadence === "biweekly" && setup.startDate) ||
            startInput.value ||
            todayIso();
        }

        var showEditor = editingPlan || !setup;
        editor.hidden = !showEditor;
        compact.hidden = showEditor || !setup;
        if (setup && !showEditor) {
          if (setup.cadence === "biweekly") {
            document.getElementById("planCompactTitle").textContent = "Every two weeks";
            document.getElementById("planCompactDetail").textContent =
              "Started " + formatDay(setup.startDate);
          } else {
            document.getElementById("planCompactTitle").textContent = "Monthly";
            document.getElementById("planCompactDetail").textContent =
              "Each period starts on the 1st";
          }
        }

        var ready =
          setup &&
          !showEditor &&
          (setup.cadence === "monthly" ||
            (setup.cadence === "biweekly" && setup.startDate));

        document.getElementById("periodBar").hidden = !ready;
        document.getElementById("summaryCard").hidden = !ready;
        document.getElementById("incomeListCard").hidden = !ready;
        document.getElementById("dueBillsCard").hidden = !ready;
        updateFab();
        if (!ready) return;

        var period = periodAt(setup, periodIndex);
        document.getElementById("periodRange").textContent = formatRange(period);
        document.getElementById("periodKind").textContent =
          setup.cadence === "biweekly" ? "Two-week plan" : "Monthly plan";

        var items = periodIncomes(period);
        var incoming = items.reduce(function (n, item) {
          return n + Number(item.amount || 0);
        }, 0);
        var outgoing = periodSpent(period);
        document.getElementById("inTotal").textContent = money.format(incoming);
        document.getElementById("outTotal").textContent = money.format(outgoing);
        document.getElementById("leftTotal").textContent = money.format(incoming - outgoing);

        var list = document.getElementById("incomeList");
        list.innerHTML = "";
        items
          .slice()
          .sort(function (a, b) {
            return String(a.date).localeCompare(String(b.date));
          })
          .forEach(function (item) {
            list.appendChild(
              renderEntry(item, item.date, {
                onEdit: function () {
                  openIncomeModal(item);
                }
              })
            );
          });
        document.getElementById("incomeEmpty").hidden = items.length > 0;

        var dueList = document.getElementById("dueBillsList");
        dueList.innerHTML = "";
        periodDueBills(period).forEach(function (bill) {
          var landing = billDueInPeriod(bill, period);
          dueList.appendChild(
            renderEntry(bill, formatBillRule(bill) + " · " + landing, {
              check: { period: period, id: bill.id },
              onEdit: function () {
                editOnPage("billsPage", function () {
                  openBillModal(bill);
                });
              }
            })
          );
        });
        periodDueSavings(period).forEach(function (goal) {
          var source = (appData.savings || []).filter(function (row) {
            return row.id === goal.id;
          })[0];
          dueList.appendChild(
            renderEntry(
              goal,
              goal.kind === "continuous"
                ? "Continuous savings each period"
                : "Savings each period until " + formatDay(goal.targetDate),
              {
              check: { period: period, id: goal.id },
              onEdit: function () {
                editOnPage("planPage", function () {
                  openSavingModal(source || goal);
                });
              }
            })
          );
        });
        document.getElementById("dueBillsEmpty").hidden =
          dueList.children.length > 0;
      }

      document.getElementById("chooseBiweekly").addEventListener("click", function () {
        draftCadence = "biweekly";
        renderHome();
      });
      document.getElementById("chooseMonthly").addEventListener("click", function () {
        draftCadence = "monthly";
        renderHome();
      });
      document.getElementById("savePlanBtn").addEventListener("click", function () {
        if (!draftCadence) return;
        var start =
          draftCadence === "biweekly"
            ? document.getElementById("startDateInput").value || todayIso()
            : todayIso().slice(0, 8) + "01";
        if (draftCadence === "biweekly" && !start) return;
        appData.setup = { cadence: draftCadence, startDate: start };
        periodIndex =
          draftCadence === "biweekly" ? currentBiweeklyIndex(start, todayIso()) : 0;
        editingPlan = false;
        persist();
        renderHome();
        renderPlan();
      });
      document.getElementById("editPlanBtn").addEventListener("click", function () {
        editingPlan = true;
        draftCadence = appData.setup ? appData.setup.cadence : null;
        renderHome();
      });

      document.getElementById("prevPeriodBtn").addEventListener("click", function () {
        periodIndex -= 1;
        renderHome();
      });
      document.getElementById("nextPeriodBtn").addEventListener("click", function () {
        periodIndex += 1;
        renderHome();
      });

      document.getElementById("openAddBtn").addEventListener("click", function () {
        if (currentPage === "billsPage") openBillModal();
        else openIncomeModal();
      });
      document.getElementById("billMonthlyBtn").addEventListener("click", function () {
        setBillFrequency("monthly");
      });
      document.getElementById("billYearlyBtn").addEventListener("click", function () {
        setBillFrequency("yearly");
      });
      document.getElementById("billModalClose").addEventListener("click", closeBillModal);
      document.getElementById("billModalCancel").addEventListener("click", closeBillModal);
      document.getElementById("billModal").addEventListener("click", function (e) {
        if (e.target.id === "billModal") closeBillModal();
      });
      document.getElementById("billForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("billName").value.trim();
        var amount = Number.parseFloat(document.getElementById("billAmount").value);
        var date = document.getElementById("billDate").value;
        if (!name || !Number.isFinite(amount) || amount < 0 || !date) return;
        var payload = {
          name: name,
          amount: Math.round(amount * 100) / 100,
          frequency: billFrequency,
          dueDate: date
        };
        if (editingBillId) {
          appData.bills = appData.bills.map(function (row) {
            if (row.id !== editingBillId) return row;
            payload.id = row.id;
            return payload;
          });
        } else {
          payload.id = uid();
          appData.bills.push(payload);
        }
        persist();
        closeBillModal();
        renderBills();
        renderHome();
      });
      document.getElementById("billDeleteBtn").addEventListener("click", function () {
        if (!editingBillId) return;
        appData.bills = appData.bills.filter(function (row) {
          return row.id !== editingBillId;
        });
        persist();
        closeBillModal();
        renderBills();
        renderHome();
      });
      document.getElementById("incomeModalClose").addEventListener("click", closeIncomeModal);
      document.getElementById("incomeModalCancel").addEventListener("click", closeIncomeModal);
      document.getElementById("incomeModal").addEventListener("click", function (e) {
        if (e.target.id === "incomeModal") closeIncomeModal();
      });

      document.getElementById("incomeForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("incomeName").value.trim() || "Paycheck";
        var amount = Number.parseFloat(document.getElementById("incomeAmount").value);
        var date = document.getElementById("incomeDate").value;
        if (!Number.isFinite(amount) || amount < 0 || !date) return;
        var payload = {
          name: name,
          amount: Math.round(amount * 100) / 100,
          date: date
        };
        if (editingIncomeId) {
          appData.incomes = appData.incomes.map(function (row) {
            if (row.id !== editingIncomeId) return row;
            payload.id = row.id;
            return payload;
          });
        } else {
          payload.id = uid();
          appData.incomes.push(payload);
        }
        persist();
        closeIncomeModal();
        renderHome();
      });
      document.getElementById("incomeDeleteBtn").addEventListener("click", function () {
        if (!editingIncomeId) return;
        appData.incomes = appData.incomes.filter(function (row) {
          return row.id !== editingIncomeId;
        });
        persist();
        closeIncomeModal();
        renderHome();
      });
      document.getElementById("savingModalClose").addEventListener("click", closeSavingModal);
      document.getElementById("savingModalCancel").addEventListener("click", closeSavingModal);
      document.getElementById("savingModal").addEventListener("click", function (e) {
        if (e.target.id === "savingModal") closeSavingModal();
      });
      document.getElementById("savingModalForm").addEventListener("submit", function (e) {
        e.preventDefault();
        if (!editingSavingId) return;
        var name = document.getElementById("savingModalName").value.trim();
        var amount = Number.parseFloat(document.getElementById("savingModalAmount").value);
        var date = document.getElementById("savingModalDate").value;
        if (!name || !Number.isFinite(amount) || amount <= 0 || !date) return;
        appData.savings = appData.savings.map(function (row) {
          if (row.id !== editingSavingId) return row;
          var next = {
            id: row.id,
            kind: editingSavingKind,
            name: name,
            startDate: row.startDate || todayIso()
          };
          if (editingSavingKind === "continuous") {
            next.monthlyAmount = Math.round(amount * 100) / 100;
          } else {
            if (!date) return row;
            next.targetAmount = Math.round(amount * 100) / 100;
            next.targetDate = date;
          }
          return next;
        });
        persist();
        closeSavingModal();
        renderPlan();
        renderHome();
      });
      document.getElementById("savingDeleteBtn").addEventListener("click", function () {
        if (!editingSavingId) return;
        appData.savings = appData.savings.filter(function (row) {
          return row.id !== editingSavingId;
        });
        persist();
        closeSavingModal();
        renderPlan();
        renderHome();
      });

      document.getElementById("savingTimedBtn").addEventListener("click", function () {
        setSavingKind("timed");
      });
      document.getElementById("savingContinuousBtn").addEventListener("click", function () {
        setSavingKind("continuous");
      });
      ["savingName", "savingAmount", "savingDate"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", previewSavings);
      });
      document.getElementById("saveSavingBtn").addEventListener("click", function () {
        var draft = previewSavings();
        if (!draft || !draft.name) return;
        var row = {
          id: uid(),
          kind: draft.kind,
          name: draft.name,
          startDate: draft.startDate
        };
        if (draft.kind === "continuous") {
          row.monthlyAmount = draft.monthlyAmount;
        } else {
          row.targetAmount = draft.targetAmount;
          row.targetDate = draft.targetDate;
        }
        appData.savings.push(row);
        persist();
        document.getElementById("savingName").value = "";
        document.getElementById("savingAmount").value = "";
        document.getElementById("savingDate").value = "";
        renderPlan();
        renderHome();
      });

      document.querySelectorAll(".site-nav-link").forEach(function (btn) {
        btn.addEventListener("click", function () {
          showPage(btn.getAttribute("data-page"));
        });
      });

      document.getElementById("primaryColor").addEventListener("input", function () {
        var accent = document.getElementById("accentColor").value;
        document.getElementById("primaryHex").textContent = this.value;
        applyTheme(this.value, accent);
      });
      document.getElementById("accentColor").addEventListener("input", function () {
        var primary = document.getElementById("primaryColor").value;
        document.getElementById("accentHex").textContent = this.value;
        applyTheme(primary, this.value);
      });
      function saveTheme(primary, accent, message) {
        appData.theme = { primary: primary, accent: accent };
        persist();
        applyTheme(primary, accent);
        syncThemeFields();
        var note = document.getElementById("themeSavedNote");
        note.textContent = message || "Saved on this device.";
        note.hidden = false;
      }

      document.getElementById("saveThemeBtn").addEventListener("click", function () {
        saveTheme(
          document.getElementById("primaryColor").value,
          document.getElementById("accentColor").value,
          "Saved on this device."
        );
      });
      document.getElementById("defaultThemeBtn").addEventListener("click", function () {
        saveTheme("#2a2a2a", "#666666", "Restored default gray.");
      });
      document.getElementById("exportJsonBtn").addEventListener("click", downloadAppJson);
      document.getElementById("linkJsonBtn").addEventListener("click", function () {
        linkAppJsonFile();
      });

      if (MOBILE_QUERY.addEventListener) {
        MOBILE_QUERY.addEventListener("change", applyShell);
      } else if (MOBILE_QUERY.addListener) {
        MOBILE_QUERY.addListener(applyShell);
      }

      if (appData.setup && appData.setup.cadence === "biweekly" && appData.setup.startDate) {
        periodIndex = currentBiweeklyIndex(appData.setup.startDate, todayIso());
      } else {
        periodIndex = 0;
      }

      if (!appData.theme || !appData.theme.primary) {
        appData.theme = { primary: "#2a2a2a", accent: "#666666" };
      }
      applyTheme(currentTheme().primary, currentTheme().accent);
      syncThemeFields();
      applyShell();
      renderHome();
      persist();
      if (!window.showSaveFilePicker && !(navigator.storage && navigator.storage.getDirectory)) {
        setDataFileStatus("This page can keep browser data only. Use Download app.json for a file copy.");
      } else if (!window.showSaveFilePicker) {
        setDataFileStatus("Installed app can keep an internal app.json. Use Download for a file you can copy.");
      } else {
        setDataFileStatus("Use Save app.json once to keep a live file. Internal app.json is also updated.");
      }
      if (dataLooksEmpty(appData)) {
        loadOpfsJson().then(function (parsed) {
          if (!parsed || !dataLooksEmpty(appData)) return;
          appData = Object.assign(emptyData(), parsed);
          if (!Array.isArray(appData.incomes)) appData.incomes = [];
          if (!Array.isArray(appData.bills)) appData.bills = [];
          if (!Array.isArray(appData.savings)) appData.savings = [];
          if (!appData.checks || typeof appData.checks !== "object") appData.checks = {};
          editingPlan = !appData.setup;
          draftCadence = appData.setup ? appData.setup.cadence : null;
          applyTheme(currentTheme().primary, currentTheme().accent);
          syncThemeFields();
          renderHome();
          persist();
        });
      }
      window.budgetApp = {
        getData: function () { return appData; },
        isMobile: isMobile
      };

      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("./sw.js").catch(function () {});
      }
    })();
