/* ==========================================================
   app.js — Book Lending Tracker.
   Built only with the generic library in lib.js (Lib).
   ========================================================== */
(function () {
  "use strict";

  var store = Lib.store("book-lending-tracker:loans");
  var loans = store.get([]);

  var form = Lib.$("#loan-form");
  var tbody = Lib.$("#loan-table-body");

  // Validation rules for this page's form (data for the library)
  var rules = {
    title: [
      { rule: "required", message: "Please enter the book title." },
      { rule: "minLength", value: 2, message: "Title must be at least 2 characters." }
    ],
    author: [
      { rule: "required", message: "Please enter the author's name." },
      { rule: "minLength", value: 2, message: "Author must be at least 2 characters." }
    ],
    borrower: [
      { rule: "required", message: "Please enter who borrowed the book." },
      { rule: "minLength", value: 2, message: "Borrower name must be at least 2 characters." }
    ],
    dueDate: [
      { rule: "required", message: "Please choose a due date." },
      { rule: "date", message: "That is not a valid date." }
    ],
    genre: [
      { rule: "required", message: "Please select a genre." }
    ]
  };

  function isOverdue(loan) {
    return !loan.returned && Lib.date.isPast(loan.dueDate);
  }

  function status(loan) {
    if (loan.returned) return { text: "Returned", badge: "badge-success" };
    if (isOverdue(loan)) return { text: "Overdue", badge: "badge-danger" };
    return { text: "On loan", badge: "badge-warning" };
  }

  // Table columns: Title, Author, Borrower, Due date, Genre, Status, Action
  var columns = [
    { key: "title" },
    { key: "author" },
    { key: "borrower" },
    { render: function (l) { return Lib.escape(Lib.date.format(l.dueDate)); } },
    { key: "genre" },
    {
      className: "text-center",
      render: function (l) {
        var s = status(l);
        return '<span class="badge ' + s.badge + '">' + s.text + "</span>";
      }
    },
    {
      className: "text-center",
      render: function (l) {
        return '<div class="flex gap-1 justify-center">' +
          '<button type="button" class="btn btn-sm btn-success" data-action="toggle" data-id="' + l.id + '">' +
          (l.returned ? "Undo" : "Returned") + "</button>" +
          '<button type="button" class="btn btn-sm btn-danger" data-action="delete" data-id="' + l.id + '">Delete</button>' +
          "</div>";
      }
    }
  ];

  function render() {
    Lib.table.render(tbody, loans, columns, {
      rowClass: function (l) { return isOverdue(l) ? "row-danger" : ""; },
      empty: Lib.$("#empty-message")
    });
    Lib.$("#total-loans").textContent = loans.length;
    Lib.$("#overdue-loans").textContent = loans.filter(isOverdue).length;
  }

  function save() {
    store.set(loans);
    render();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var result = Lib.form.validate(form, rules);
    Lib.form.showErrors(form, result.errors);
    if (!result.valid) {
      form.elements[Object.keys(result.errors)[0]].focus();
      return;
    }
    var v = Lib.form.values(form);
    loans.push({
      id: Lib.uid(),
      title: v.title.trim(),
      author: v.author.trim(),
      borrower: v.borrower.trim(),
      dueDate: v.dueDate,
      genre: v.genre,
      returned: false
    });
    form.reset();
    Lib.form.clearErrors(form);
    save();
  });

  Lib.form.live(form, rules);

  Lib.on(tbody, "click", "button[data-action]", function (event, btn) {
    var id = btn.getAttribute("data-id");
    if (btn.getAttribute("data-action") === "delete") {
      loans = loans.filter(function (l) { return l.id !== id; });
    } else {
      loans.forEach(function (l) { if (l.id === id) l.returned = !l.returned; });
    }
    save();
  });

  render();
})();
