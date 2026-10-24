/* =============================================================
   Expense Tracker — app.js
   Features:
   - Add income / expense with category, date, amount, description
   - localStorage persistence (no backend needed)
   - Monthly totals bar chart (Chart.js)
   - Category expense doughnut chart (Chart.js)
   - Month filter
   - Delete individual transactions / clear all
   ============================================================= */

'use strict';

/* ---------------------------------------------------------------
   CONSTANTS
--------------------------------------------------------------- */
const STORAGE_KEY = 'expense_tracker_v1';

const CATEGORY_COLORS = {
  Salary:         '#4f46e5',
  Freelance:      '#7c3aed',
  Investment:     '#0ea5e9',
  Gift:           '#f59e0b',
  'Other Income': '#10b981',
  Food:           '#ef4444',
  Transport:      '#f97316',
  Shopping:       '#ec4899',
  Bills:          '#eab308',
  Health:         '#06b6d4',
  Education:      '#8b5cf6',
  Entertainment:  '#14b8a6',
  Rent:           '#dc2626',
  'Other Expense':'#6b7280',
};

/* ---------------------------------------------------------------
   STATE
--------------------------------------------------------------- */
let transactions = loadTransactions();
let monthlyChart = null;
let categoryChart = null;
let activeTab = 'monthly';

/* ---------------------------------------------------------------
   DOM REFERENCES
--------------------------------------------------------------- */
const form            = document.getElementById('transaction-form');
const typeSelect      = document.getElementById('type');
const categorySelect  = document.getElementById('category');
const descInput       = document.getElementById('description');
const amountInput     = document.getElementById('amount');
const dateInput       = document.getElementById('date');
const tbody           = document.getElementById('transaction-body');
const emptyState      = document.getElementById('empty-state');
const totalIncomeEl   = document.getElementById('total-income');
const totalExpenseEl  = document.getElementById('total-expense');
const totalBalanceEl  = document.getElementById('total-balance');
const monthSelect     = document.getElementById('month-select');
const clearAllBtn     = document.getElementById('clear-all-btn');
const toast           = document.getElementById('toast');
const btnMonthly      = document.getElementById('btn-monthly');
const btnCategory     = document.getElementById('btn-category');
const tabMonthly      = document.getElementById('tab-monthly');
const tabCategory     = document.getElementById('tab-category');

/* ---------------------------------------------------------------
   INIT
--------------------------------------------------------------- */
function init() {
  // Set today's date as default
  dateInput.value = new Date().toISOString().split('T')[0];

  populateMonthFilter();
  renderAll();

  form.addEventListener('submit', handleSubmit);
  monthSelect.addEventListener('change', renderAll);
  clearAllBtn.addEventListener('click', handleClearAll);
  btnMonthly.addEventListener('click', () => switchTab('monthly'));
  btnCategory.addEventListener('click', () => switchTab('category'));
}

/* ---------------------------------------------------------------
   LOCAL STORAGE
--------------------------------------------------------------- */
function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/* ---------------------------------------------------------------
   FORM SUBMISSION
--------------------------------------------------------------- */
function handleSubmit(e) {
  e.preventDefault();

  // Basic constraint validation
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const tx = {
    id:          crypto.randomUUID(),
    type:        typeSelect.value,
    category:    categorySelect.value,
    description: descInput.value.trim(),
    amount:      parseFloat(amountInput.value),
    date:        dateInput.value,
  };

  transactions.unshift(tx);
  saveTransactions();
  populateMonthFilter();
  renderAll();
  showToast(`✅ ${tx.type === 'income' ? 'Income' : 'Expense'} of ${formatCurrency(tx.amount)} added!`);

  form.reset();
  dateInput.value = new Date().toISOString().split('T')[0];
}

/* ---------------------------------------------------------------
   DELETE
--------------------------------------------------------------- */
function handleDelete(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  populateMonthFilter();
  renderAll();
  showToast('🗑 Transaction deleted.');
}

function handleClearAll() {
  if (!transactions.length) return;
  if (!confirm('Are you sure you want to delete ALL transactions? This cannot be undone.')) return;
  transactions = [];
  saveTransactions();
  populateMonthFilter();
  renderAll();
  showToast('🗑 All transactions cleared.');
}

/* ---------------------------------------------------------------
   MONTH FILTER
--------------------------------------------------------------- */
function populateMonthFilter() {
  const current = monthSelect.value;
  const months = [...new Set(
    transactions.map(t => t.date.slice(0, 7))
  )].sort().reverse();

  monthSelect.innerHTML = '<option value="all">All Time</option>';
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = formatMonthLabel(m);
    monthSelect.appendChild(opt);
  });

  // Restore previous selection if still valid
  if ([...monthSelect.options].some(o => o.value === current)) {
    monthSelect.value = current;
  }
}

function formatMonthLabel(ym) {
  const [year, month] = ym.split('-');
  const date = new Date(+year, +month - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/* ---------------------------------------------------------------
   FILTERED DATA
--------------------------------------------------------------- */
function getFiltered() {
  const m = monthSelect.value;
  if (m === 'all') return transactions;
  return transactions.filter(t => t.date.startsWith(m));
}

/* ---------------------------------------------------------------
   RENDER ALL
--------------------------------------------------------------- */
function renderAll() {
  const filtered = getFiltered();
  renderSummary(filtered);
  renderTable(filtered);
  renderCharts(filtered);
}

/* ---------------------------------------------------------------
   SUMMARY CARDS
--------------------------------------------------------------- */
function renderSummary(data) {
  const income  = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  totalIncomeEl.textContent  = formatCurrency(income);
  totalExpenseEl.textContent = formatCurrency(expense);
  totalBalanceEl.textContent = formatCurrency(balance);
}

/* ---------------------------------------------------------------
   TRANSACTION TABLE
--------------------------------------------------------------- */
function renderTable(data) {
  tbody.innerHTML = '';

  if (!data.length) {
    emptyState.hidden = false;
    tbody.closest('table').hidden = true;
    return;
  }

  emptyState.hidden = true;
  tbody.closest('table').hidden = false;

  data.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(tx.date)}</td>
      <td>${escapeHTML(tx.description)}</td>
      <td>${escapeHTML(tx.category)}</td>
      <td><span class="badge badge--${tx.type}">${capitalize(tx.type)}</span></td>
      <td class="amount--${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</td>
      <td>
        <button class="btn btn--icon" data-id="${tx.id}" aria-label="Delete transaction: ${escapeHTML(tx.description)}">
          🗑
        </button>
      </td>
    `;
    tr.querySelector('[data-id]').addEventListener('click', e => {
      handleDelete(e.currentTarget.dataset.id);
    });
    tbody.appendChild(tr);
  });
}

/* ---------------------------------------------------------------
   CHARTS
--------------------------------------------------------------- */
function renderCharts(data) {
  renderMonthlyChart(data);
  renderCategoryChart(data);
}

/* --- Monthly Bar Chart --- */
function renderMonthlyChart(data) {
  const ctx = document.getElementById('monthly-chart').getContext('2d');
  const monthlyEmpty = document.getElementById('monthly-empty');

  // Aggregate by month
  const map = {};
  data.forEach(tx => {
    const ym = tx.date.slice(0, 7);
    if (!map[ym]) map[ym] = { income: 0, expense: 0 };
    map[ym][tx.type] += tx.amount;
  });

  const labels  = Object.keys(map).sort();
  const incomes  = labels.map(l => map[l].income);
  const expenses = labels.map(l => map[l].expense);

  if (monthlyChart) monthlyChart.destroy();

  if (!labels.length) {
    monthlyEmpty.hidden = false;
    document.getElementById('monthly-chart').hidden = true;
    return;
  }

  monthlyEmpty.hidden = true;
  document.getElementById('monthly-chart').hidden = false;

  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(formatMonthLabel),
      datasets: [
        {
          label: 'Income',
          data: incomes,
          backgroundColor: '#16a34a',
          borderRadius: 6,
        },
        {
          label: 'Expense',
          data: expenses,
          backgroundColor: '#dc2626',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => '₹' + v.toLocaleString('en-IN'),
          },
        },
      },
    },
  });
}

/* --- Category Doughnut Chart --- */
function renderCategoryChart(data) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  const categoryEmpty = document.getElementById('category-empty');

  const expenses = data.filter(t => t.type === 'expense');
  const catMap = {};
  expenses.forEach(tx => {
    catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
  });

  const labels  = Object.keys(catMap);
  const amounts = Object.values(catMap);
  const colors  = labels.map(l => CATEGORY_COLORS[l] || '#a1a1aa');

  if (categoryChart) categoryChart.destroy();

  if (!labels.length) {
    categoryEmpty.hidden = false;
    document.getElementById('category-chart').hidden = true;
    return;
  }

  categoryEmpty.hidden = true;
  document.getElementById('category-chart').hidden = false;

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: amounts,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

/* ---------------------------------------------------------------
   TAB SWITCHING
--------------------------------------------------------------- */
function switchTab(tab) {
  activeTab = tab;

  const isMonthly = tab === 'monthly';

  btnMonthly.classList.toggle('tab-btn--active', isMonthly);
  btnCategory.classList.toggle('tab-btn--active', !isMonthly);

  btnMonthly.setAttribute('aria-selected', isMonthly ? 'true' : 'false');
  btnCategory.setAttribute('aria-selected', isMonthly ? 'false' : 'true');

  tabMonthly.hidden  = !isMonthly;
  tabCategory.hidden = isMonthly;
}

/* ---------------------------------------------------------------
   UTILITIES
--------------------------------------------------------------- */
function formatCurrency(n) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ---------------------------------------------------------------
   BOOTSTRAP
--------------------------------------------------------------- */
init();
