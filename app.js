/* Application entry point.
   All logic lives in the JavaScript library (book-lending.js);
   this file only configures and starts it. */
BookLending.init({
  form: "#loan-form",
  tableBody: "#loan-table-body",
  emptyMessage: "#empty-message",
  totalEl: "#total-loans",
  overdueEl: "#overdue-loans"
});
