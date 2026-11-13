/* ==========================================================
   BookLending — a small JavaScript library for tracking
   lent books. Exposes a single global: BookLending.

   Modules:
     BookLending.Validator  – form validation rules
     BookLending.Store      – loan data (in-memory + localStorage)
     BookLending.Utils      – date helpers & escaping
     BookLending.UI         – rendering & DOM helpers
     BookLending.init(opts) – wires everything together
   ========================================================== */
(function (global) {
  "use strict";

  var STORAGE_KEY = "book-lending-tracker:loans";
  var FIELDS = ["title", "author", "borrower", "dueDate", "genre"];

  /* ---------------- Utils ---------------- */
  var Utils = {
    // Today at 00:00 local time
    today: function () {
      var d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    },
    // Parse "YYYY-MM-DD" as a local date (avoids timezone shifts)
    parseDate: function (value) {
      var parts = String(value).split("-");
      if (parts.length !== 3) return null;
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return isNaN(d.getTime()) ? null : d;
    },
    formatDate: function (value) {
      var d = Utils.parseDate(value);
      if (!d) return value;
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    },
    escapeHtml: function (str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
  };

  /* ---------------- Validator ---------------- */
  var Validator = {
    rules: {
      title: function (v) {
        if (!v) return "Please enter the book title.";
        if (v.length < 2) return "Title must be at least 2 characters.";
        return "";
      },
      author: function (v) {
        if (!v) return "Please enter the author's name.";
        if (v.length < 2) return "Author must be at least 2 characters.";
        return "";
      },
      borrower: function (v) {
        if (!v) return "Please enter who borrowed the book.";
        if (v.length < 2) return "Borrower name must be at least 2 characters.";
        return "";
      },
      dueDate: function (v) {
        if (!v) return "Please choose a due date.";
        if (!Utils.parseDate(v)) return "That is not a valid date.";
        return "";
      },
      genre: function (v) {
        if (!v) return "Please select a genre.";
        return "";
      }
    },
    // Validate one field. Returns an error message ("" when valid).
    validateField: function (name, value) {
      var rule = Validator.rules[name];
      return rule ? rule(String(value || "").trim()) : "";
    },
    // Validate a whole object. Returns { valid: Boolean, errors: {field: msg} }
    validate: function (data) {
      var errors = {};
      FIELDS.forEach(function (name) {
        var msg = Validator.validateField(name, data[name]);
        if (msg) errors[name] = msg;
      });
      return { valid: Object.keys(errors).length === 0, errors: errors };
    }
  };

  /* ---------------- Store ---------------- */
  var Store = {
    loans: [],
    load: function () {
      try {
        var raw = global.localStorage.getItem(STORAGE_KEY);
        Store.loans = raw ? JSON.parse(raw) : [];
      } catch (e) {
        Store.loans = [];
      }
      return Store.loans;
    },
    save: function () {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(Store.loans));
      } catch (e) { /* storage unavailable — keep in memory only */ }
    },
    add: function (data) {
      var loan = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        title: data.title.trim(),
        author: data.author.trim(),
        borrower: data.borrower.trim(),
        dueDate: data.dueDate,
        genre: data.genre,
        returned: false
      };
      Store.loans.push(loan);
      Store.save();
      return loan;
    },
    toggleReturned: function (id) {
      Store.loans.forEach(function (l) { if (l.id === id) l.returned = !l.returned; });
      Store.save();
    },
    remove: function (id) {
      Store.loans = Store.loans.filter(function (l) { return l.id !== id; });
      Store.save();
    },
    // A loan is overdue when it is not returned and the due date is before today.
    isOverdue: function (loan) {
      if (loan.returned) return false;
      var due = Utils.parseDate(loan.dueDate);
      return !!due && due < Utils.today();
    },
    status: function (loan) {
      if (loan.returned) return "Returned";
      return Store.isOverdue(loan) ? "Overdue" : "On loan";
    },
    stats: function () {
      return {
        total: Store.loans.length,
        overdue: Store.loans.filter(Store.isOverdue).length
      };
    }
  };

  /* ---------------- UI ---------------- */
  var UI = {
    els: {},

    badgeClass: function (status) {
      if (status === "Overdue") return "ui-badge ui-badge-danger";
      if (status === "Returned") return "ui-badge ui-badge-success";
      return "ui-badge ui-badge-warning";
    },

    showError: function (name, message) {
      var input = UI.els.form.elements[name];
      var out = document.getElementById(name + "-error");
      if (out) out.textContent = message || "";
      if (input) input.classList.toggle("ui-input-invalid", !!message);
    },

    clearErrors: function () {
      FIELDS.forEach(function (n) { UI.showError(n, ""); });
    },

    readForm: function () {
      var data = {};
      FIELDS.forEach(function (n) { data[n] = UI.els.form.elements[n].value; });
      return data;
    },

    renderSummary: function () {
      var s = Store.stats();
      UI.els.total.textContent = s.total;
      UI.els.overdue.textContent = s.overdue;
    },

    renderTable: function () {
      var rows = Store.loans.map(function (loan) {
        var status = Store.status(loan);
        var e = Utils.escapeHtml;
        return (
          '<tr class="' + (status === "Overdue" ? "ui-row-overdue" : "") + '">' +
            "<td>" + e(loan.title) + "</td>" +
            "<td>" + e(loan.author) + "</td>" +
            "<td>" + e(loan.borrower) + "</td>" +
            "<td>" + e(Utils.formatDate(loan.dueDate)) + "</td>" +
            "<td>" + e(loan.genre) + "</td>" +
            '<td><span class="' + UI.badgeClass(status) + '">' + status + "</span></td>" +
            '<td><div class="ui-actions">' +
              '<button type="button" class="ui-btn ui-btn-sm ui-btn-success" data-action="toggle" data-id="' + loan.id + '">' +
                (loan.returned ? "Undo" : "Returned") + "</button>" +
              '<button type="button" class="ui-btn ui-btn-sm ui-btn-danger" data-action="delete" data-id="' + loan.id + '">Delete</button>' +
            "</div></td>" +
          "</tr>"
        );
      });
      UI.els.body.innerHTML = rows.join("");
      UI.els.empty.classList.toggle("ui-hidden", Store.loans.length > 0);
    },

    render: function () {
      UI.renderTable();
      UI.renderSummary();
    },

    onSubmit: function (event) {
      event.preventDefault();
      var data = UI.readForm();
      var result = Validator.validate(data);
      UI.clearErrors();
      if (!result.valid) {
        Object.keys(result.errors).forEach(function (n) { UI.showError(n, result.errors[n]); });
        var first = UI.els.form.elements[Object.keys(result.errors)[0]];
        if (first) first.focus();
        return;
      }
      Store.add(data);
      UI.els.form.reset();
      UI.render();
    },

    onTableClick: function (event) {
      var btn = event.target.closest("button[data-action]");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      if (btn.getAttribute("data-action") === "toggle") Store.toggleReturned(id);
      if (btn.getAttribute("data-action") === "delete") Store.remove(id);
      UI.render();
    }
  };

  /* ---------------- Init ---------------- */
  function init(opts) {
    UI.els.form = document.querySelector(opts.form);
    UI.els.body = document.querySelector(opts.tableBody);
    UI.els.empty = document.querySelector(opts.emptyMessage);
    UI.els.total = document.querySelector(opts.totalEl);
    UI.els.overdue = document.querySelector(opts.overdueEl);

    Store.load();
    UI.els.form.addEventListener("submit", UI.onSubmit);
    UI.els.body.addEventListener("click", UI.onTableClick);

    // Live feedback: re-validate a field once the user leaves it
    FIELDS.forEach(function (name) {
      var input = UI.els.form.elements[name];
      input.addEventListener("blur", function () {
        UI.showError(name, Validator.validateField(name, input.value));
      });
      input.addEventListener("input", function () {
        if (input.classList.contains("ui-input-invalid")) {
          UI.showError(name, Validator.validateField(name, input.value));
        }
      });
    });

    UI.render();
  }

  global.BookLending = {
    Utils: Utils,
    Validator: Validator,
    Store: Store,
    UI: UI,
    init: init
  };
})(window);
