/* ==========================================================
   lib.js — a small, generic, reusable JavaScript library.

   It knows nothing about books or this page. Any project can
   use it to query the DOM, validate forms, render tables,
   persist data and work with dates.

   Exposes one global object: Lib

     Lib.$(selector, root)             -> first matching element
     Lib.$$(selector, root)            -> array of matching elements
     Lib.on(root, event, selector, fn) -> delegated event listener
     Lib.escape(text)                  -> HTML-escaped string
     Lib.uid()                         -> unique id string

     Lib.store(key)                    -> { get(fallback), set(value) }
     Lib.date.parse/today/isPast/format

     Lib.validators                    -> built-in rules (extendable)
     Lib.form.values(form)
     Lib.form.validate(form, rules)    -> { valid, errors }
     Lib.form.showErrors(form, errors) -> message beside each field
     Lib.form.clearErrors(form)
     Lib.form.live(form, rules)        -> validate on blur / input

     Lib.table.render(tbody, items, columns, options)
   ========================================================== */
(function (global) {
  "use strict";

  var Lib = {};

  /* ---------- DOM helpers ---------- */
  Lib.$ = function (selector, root) {
    return (root || document).querySelector(selector);
  };

  Lib.$$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  // Delegated events: Lib.on(table, "click", "button[data-action]", fn)
  Lib.on = function (root, eventName, selector, handler) {
    root.addEventListener(eventName, function (event) {
      var target = event.target.closest(selector);
      if (target && root.contains(target)) handler(event, target);
    });
  };

  Lib.escape = function (text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  Lib.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /* ---------- Storage (localStorage with safe fallback) ---------- */
  Lib.store = function (key) {
    var memory;
    return {
      get: function (fallback) {
        try {
          var raw = global.localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
          return memory !== undefined ? memory : fallback;
        }
      },
      set: function (value) {
        memory = value;
        try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* memory only */ }
      }
    };
  };

  /* ---------- Dates ("YYYY-MM-DD" strings, local time) ---------- */
  Lib.date = {
    parse: function (value) {
      var p = String(value || "").split("-");
      if (p.length !== 3) return null;
      var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      return isNaN(d.getTime()) ? null : d;
    },
    today: function () {
      var d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    },
    isPast: function (value) {
      var d = Lib.date.parse(value);
      return !!d && d < Lib.date.today();
    },
    format: function (value) {
      var d = Lib.date.parse(value);
      return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : String(value || "");
    }
  };

  /* ---------- Validators (add your own: Lib.validators.x = fn) ---------- */
  // Each validator returns true when the value is valid.
  Lib.validators = {
    required: function (value) { return value.trim() !== ""; },
    minLength: function (value, n) { return value.trim().length >= n; },
    maxLength: function (value, n) { return value.trim().length <= n; },
    date: function (value) { return value === "" || !!Lib.date.parse(value); },
    pattern: function (value, regex) { return value === "" || regex.test(value); }
  };

  /* ---------- Forms ---------- */
  Lib.form = {
    // { fieldName: value } for every named field
    values: function (form) {
      var data = {};
      Lib.$$("[name]", form).forEach(function (el) { data[el.name] = el.value; });
      return data;
    },

    // rules = { field: [ { rule: "required", message: "..." },
    //                    { rule: "minLength", value: 2, message: "..." } ] }
    validateField: function (form, name, rules) {
      var field = form.elements[name];
      var value = field ? String(field.value) : "";
      var list = rules[name] || [];
      for (var i = 0; i < list.length; i++) {
        var check = Lib.validators[list[i].rule];
        if (check && !check(value, list[i].value)) return list[i].message;
      }
      return "";
    },

    validate: function (form, rules) {
      var errors = {};
      Object.keys(rules).forEach(function (name) {
        var msg = Lib.form.validateField(form, name, rules);
        if (msg) errors[name] = msg;
      });
      return { valid: Object.keys(errors).length === 0, errors: errors };
    },

    // Writes the message into <... data-error-for="field"> beside the field
    showError: function (form, name, message) {
      var field = form.elements[name];
      var out = Lib.$('[data-error-for="' + name + '"]', form);
      if (out) out.textContent = message || "";
      if (field) {
        field.classList.toggle("input-invalid", !!message);
        field.setAttribute("aria-invalid", message ? "true" : "false");
      }
    },

    showErrors: function (form, errors) {
      Lib.$$("[data-error-for]", form).forEach(function (el) {
        var name = el.getAttribute("data-error-for");
        Lib.form.showError(form, name, errors[name] || "");
      });
    },

    clearErrors: function (form) {
      Lib.form.showErrors(form, {});
    },

    // Re-check a field when the user leaves it, and while fixing it
    live: function (form, rules) {
      Object.keys(rules).forEach(function (name) {
        var field = form.elements[name];
        if (!field) return;
        field.addEventListener("blur", function () {
          Lib.form.showError(form, name, Lib.form.validateField(form, name, rules));
        });
        field.addEventListener("input", function () {
          if (field.classList.contains("input-invalid")) {
            Lib.form.showError(form, name, Lib.form.validateField(form, name, rules));
          }
        });
      });
    }
  };

  /* ---------- Tables ---------- */
  // columns = [ { key: "name" }, { render: function (item) { return "<b>..</b>"; } } ]
  // Values from "key" are escaped; "render" returns trusted HTML.
  // options = { rowClass: function (item) { return "row-danger"; }, empty: element }
  Lib.table = {
    render: function (tbody, items, columns, options) {
      options = options || {};
      tbody.innerHTML = items.map(function (item) {
        var cls = options.rowClass ? options.rowClass(item) : "";
        var cells = columns.map(function (col) {
          var html = col.render ? col.render(item) : Lib.escape(item[col.key]);
          return "<td" + (col.className ? ' class="' + col.className + '"' : "") + ">" + html + "</td>";
        }).join("");
        return "<tr" + (cls ? ' class="' + cls + '"' : "") + ">" + cells + "</tr>";
      }).join("");
      if (options.empty) options.empty.classList.toggle("hidden", items.length > 0);
    }
  };

  global.Lib = Lib;
})(window);
