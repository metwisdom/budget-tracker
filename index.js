const ROWS_KEY = 'budget-tracker-rows';
const INCOME_KEY = 'budget-tracker-income';
const CATEGORY_BUDGETS_KEY = 'budget-tracker-category-budgets';
const defaultIncome = 5000;
const categoryColors = ['#c8f1df', '#f9dfbc', '#dcd8ff', '#cde9f7', '#f5d5dc', '#e8e6dd'];

const form = document.getElementById('spend-form');
const salaryForm = document.getElementById('salary-form');
const categoryBudgetForm = document.getElementById('category-budget-form');
const salaryInput = document.getElementById('salary-input');
const inputCategory = document.getElementById('f-category');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const inputItem = document.getElementById('f-item');
const inputPlanned = document.getElementById('f-planned');
const inputActual = document.getElementById('f-actual');
const inputDate = document.getElementById('f-date');
const btnAdd = document.getElementById('btn-add');
const tbody = document.getElementById('budget-body');
const budgetList = document.getElementById('category-budget-list');
const saveBudgetButton = document.getElementById('btn-save-budget');
const formMessage = document.getElementById('form-message');
const budgetMessage = document.getElementById('budget-message');
const storageMessage = document.getElementById('storage-message');
const budgetError = document.getElementById('budget-error');
const salaryMessage = document.getElementById('salary-message');

let income = loadIncome();
let rows = loadRows();
let categoryBudgets = loadCategoryBudgets();

function loadIncome() {
  try {
    const savedIncome = Number(localStorage.getItem(INCOME_KEY));
    return Number.isFinite(savedIncome) && savedIncome > 0 ? savedIncome : defaultIncome;
  } catch (error) {
    showStorageError(error);
    return defaultIncome;
  }
}

function loadRows() {
  try {
    const raw = localStorage.getItem(ROWS_KEY);
    const savedRows = raw ? JSON.parse(raw) : [];
    return Array.isArray(savedRows)
      ? savedRows
          .filter(row =>
            row &&
            Number.isFinite(Number(row.planned)) &&
            Number(row.planned) >= 0 &&
            Number.isFinite(Number(row.actual)) &&
            Number(row.actual) >= 0
          )
          .map(row => ({
            category: String(row.category ?? 'Other'),
            item: String(row.item ?? row.salary ?? 'Expense'),
            planned: Number(row.planned),
            actual: Number(row.actual),
            date: typeof row.date === 'string' ? row.date : ''
          }))
      : [];
  } catch (error) {
    showStorageError(error);
    return [];
  }
}

function loadCategoryBudgets() {
  try {
    const raw = localStorage.getItem(CATEGORY_BUDGETS_KEY);
    const savedBudgets = raw ? JSON.parse(raw) : [];
    return Array.isArray(savedBudgets)
      ? savedBudgets
          .filter(budget =>
            budget &&
            typeof budget.category === 'string' &&
            budget.category.trim() &&
            Number.isFinite(Number(budget.amount)) &&
            Number(budget.amount) >= 0
          )
          .map(budget => ({
            category: budget.category.trim(),
            amount: Number(budget.amount)
          }))
      : [];
  } catch (error) {
    showStorageError(error);
    return [];
  }
}

function saveData() {
  try {
    localStorage.setItem(ROWS_KEY, JSON.stringify(rows));
    localStorage.setItem(INCOME_KEY, String(income));
    localStorage.setItem(CATEGORY_BUDGETS_KEY, JSON.stringify(categoryBudgets));
    storageMessage.textContent = '';
  } catch (error) {
    showStorageError(error);
  }
}

function showStorageError(error) {
  console.error('Unable to access budget tracker storage.', error);
  storageMessage.textContent = 'Your browser could not save this change. It will be lost when you close this page.';
}

const fmt = value => {
  const amount = Number(value) || 0;
  return `Ksh ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const fmtDiff = value => {
  if (value === 0) return fmt(0);
  return `${value > 0 ? '+' : '−'}${fmt(Math.abs(value))}`;
};

function getCategoryBudget(category) {
  const categoryKey = category.trim().toLocaleLowerCase();
  return categoryBudgets.find(
    budget => budget.category.toLocaleLowerCase() === categoryKey
  );
}

function render() {
  tbody.replaceChildren();

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'empty-state';
    const icon = document.createElement('span');
    icon.className = 'empty-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✳';
    const title = document.createElement('strong');
    title.textContent = 'No spending yet';
    const description = document.createElement('span');
    description.textContent = 'Add your first expense above to start tracking your budget.';
    td.append(icon, title, description);
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((row, index) => {
      const difference = row.planned - row.actual;
      const tr = document.createElement('tr');
      const expenseCell = document.createElement('td');
      const expenseName = document.createElement('span');
      const category = document.createElement('span');
      expenseName.className = 'expense-name';
      expenseName.textContent = row.item;
      category.className = 'category-tag';
      category.textContent = row.category;
      expenseCell.append(expenseName, category);

      const dateCell = document.createElement('td');
      dateCell.className = 'date-cell';
      dateCell.textContent = formatDate(row.date);
      const plannedCell = document.createElement('td');
      plannedCell.textContent = fmt(row.planned);
      const actualCell = document.createElement('td');
      actualCell.className = 'amount-cell';
      actualCell.textContent = fmt(row.actual);
      const differenceCell = document.createElement('td');
      differenceCell.className = difference >= 0 ? 'difference-positive' : 'difference-negative';
      differenceCell.textContent = fmtDiff(difference);

      const actionCell = document.createElement('td');
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn-delete';
      deleteButton.dataset.index = String(index);
      deleteButton.setAttribute('aria-label', `Delete ${row.item}`);
      deleteButton.textContent = '×';
      actionCell.appendChild(deleteButton);

      tr.append(expenseCell, dateCell, plannedCell, actualCell, differenceCell, actionCell);
      tbody.appendChild(tr);
    });
  }

  updateTotals();
  renderCategories();
  renderCategoryBudgets();
  updatePlannedAmount();
  validateForm();
}

function formatDate(date) {
  if (!date) return '—';
  const parsedDate = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? '—'
    : parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateTotals() {
  const planned = categoryBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  const actual = rows.reduce((sum, row) => sum + row.actual, 0);
  const transactionPlanned = rows.reduce((sum, row) => sum + row.planned, 0);
  const remaining = income - actual;
  const percentage = income > 0 ? (actual / income) * 100 : 0;
  const progressPercentage = Math.min(Math.max(percentage, 0), 100);

  salaryInput.value = String(income);
  document.getElementById('stat-income').textContent = fmt(income);
  document.getElementById('stat-planned').textContent = fmt(planned);
  document.getElementById('stat-actual').textContent = fmt(actual);
  document.getElementById('stat-remaining').textContent = fmt(remaining);
  document.getElementById('stat-remaining').classList.toggle('negative-value', remaining < 0);
  document.getElementById('spent-percent').textContent = `${Math.round(percentage)}%`;
  document.getElementById('salary-progress-label').textContent = `${Math.round(percentage)}%`;
  document.getElementById('salary-progress-bar').style.width = `${progressPercentage}%`;
  document.getElementById('salary-progress-track').setAttribute('aria-valuenow', String(Math.round(progressPercentage)));
  document.getElementById('progress-spent').textContent = fmt(actual);
  document.getElementById('progress-left').textContent = fmt(remaining);
  document.getElementById('progress-left').classList.toggle('negative-value', remaining < 0);

  document.getElementById('total-planned').textContent = fmt(transactionPlanned);
  document.getElementById('total-actual').textContent = fmt(actual);
  const totalDifference = document.getElementById('total-diff');
  totalDifference.textContent = fmtDiff(transactionPlanned - actual);
  totalDifference.className = transactionPlanned >= actual ? 'difference-positive' : 'difference-negative';
  document.getElementById('transaction-count').textContent = `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`;
}

function renderCategoryBudgets() {
  budgetList.replaceChildren();

  if (categoryBudgets.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'category-budget-empty';
    empty.textContent = 'No category budgets yet. Add a monthly plan above to get started.';
    budgetList.appendChild(empty);
    return;
  }

  const spentByCategory = rows.reduce((totals, row) => {
    const key = row.category.trim().toLocaleLowerCase();
    totals.set(key, (totals.get(key) || 0) + row.actual);
    return totals;
  }, new Map());

  categoryBudgets.forEach((budget, index) => {
    const spent = spentByCategory.get(budget.category.toLocaleLowerCase()) || 0;
    const remaining = budget.amount - spent;
    const row = document.createElement('div');
    row.className = 'category-budget-row';

    const category = document.createElement('strong');
    category.className = 'budget-category-name';
    category.textContent = budget.category;
    const planned = document.createElement('span');
    planned.textContent = fmt(budget.amount);
    const actual = document.createElement('span');
    actual.textContent = fmt(spent);
    const remainingCell = document.createElement('span');
    remainingCell.className = remaining < 0 ? 'difference-negative' : 'difference-positive';
    remainingCell.textContent = fmtDiff(remaining);
    const actions = document.createElement('span');
    actions.className = 'budget-actions';
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn-delete btn-delete-budget';
    deleteButton.dataset.index = String(index);
    deleteButton.setAttribute('aria-label', `Delete ${budget.category} budget`);
    deleteButton.textContent = '×';
    actions.appendChild(deleteButton);

    row.append(category, planned, actual, remainingCell, actions);
    budgetList.appendChild(row);
  });
}

function renderCategories() {
  const breakdown = document.getElementById('category-breakdown');
  breakdown.replaceChildren();
  const totals = rows.reduce((groups, row) => {
    groups.set(row.category, (groups.get(row.category) || 0) + row.actual);
    return groups;
  }, new Map());
  const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'category-empty';
    empty.textContent = 'Your category breakdown will show up here.';
    breakdown.appendChild(empty);
    return;
  }

  categories.forEach(([name, amount], index) => {
    const row = document.createElement('div');
    row.className = 'category-row';
    const heading = document.createElement('div');
    heading.className = 'category-row-heading';
    const label = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = 'legend-dot';
    dot.style.backgroundColor = categoryColors[index % categoryColors.length];
    label.append(dot, document.createTextNode(name));
    const value = document.createElement('strong');
    value.textContent = fmt(amount);
    heading.append(label, value);
    const track = document.createElement('div');
    track.className = 'category-track';
    const bar = document.createElement('span');
    const share = rows.reduce((sum, entry) => sum + entry.actual, 0);
    bar.style.width = `${share > 0 ? Math.min((amount / share) * 100, 100) : 0}%`;
    bar.style.backgroundColor = categoryColors[index % categoryColors.length];
    track.appendChild(bar);
    row.append(heading, track);
    breakdown.appendChild(row);
  });
}

function validateForm() {
  const validCategory = Boolean(getCategoryBudget(inputCategory.value));
  const validItem = inputItem.value.trim().length > 0;
  const validActual = inputActual.value !== '' && inputActual.validity.valid;
  const validDate = inputDate.value !== '' && inputDate.validity.valid;
  btnAdd.disabled = !(validCategory && validItem && validActual && validDate);
}

function updatePlannedAmount() {
  const budget = getCategoryBudget(inputCategory.value);
  inputPlanned.value = budget ? String(budget.amount) : '';
}

function updateMonthLabel() {
  document.getElementById('current-month').textContent = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

function localDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

inputCategory.addEventListener('input', () => {
  updatePlannedAmount();
  formMessage.textContent = inputCategory.value.trim() && !getCategoryBudget(inputCategory.value)
    ? 'Set a monthly budget for this category before logging spending.'
    : '';
  validateForm();
});

[inputItem, inputActual, inputDate].forEach(input => {
  input.addEventListener('input', () => {
    formMessage.textContent = '';
    validateForm();
  });
});

function validateCategoryBudgetForm() {
  const validAmount = budgetAmountInput.value !== '' && budgetAmountInput.validity.valid;
  const existingBudget = getCategoryBudget(budgetCategoryInput.value);
  const currentPlannedTotal = categoryBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  const proposedPlannedTotal = currentPlannedTotal -
    (existingBudget ? existingBudget.amount : 0) +
    (validAmount ? Number(budgetAmountInput.value) : 0);
  const exceedsSalary = validAmount && proposedPlannedTotal > income;
  budgetError.textContent = exceedsSalary
    ? `The total category plans cannot exceed your salary of ${fmt(income)}.`
    : '';
  saveBudgetButton.disabled = !(
    budgetCategoryInput.value.trim() &&
    validAmount &&
    !exceedsSalary
  );
}

categoryBudgetForm.addEventListener('input', () => {
  budgetMessage.textContent = '';
  validateCategoryBudgetForm();
});

categoryBudgetForm.addEventListener('submit', event => {
  event.preventDefault();
  validateCategoryBudgetForm();
  if (saveBudgetButton.disabled) return;

  const category = budgetCategoryInput.value.trim();
  const categoryKey = category.toLocaleLowerCase();
  const amount = Number(budgetAmountInput.value);
  const existingBudget = categoryBudgets.find(
    budget => budget.category.toLocaleLowerCase() === categoryKey
  );

  if (existingBudget) {
    existingBudget.amount = amount;
  } else {
    categoryBudgets.push({ category, amount });
  }

  saveData();
  render();
  categoryBudgetForm.reset();
  budgetMessage.textContent = `${category} monthly budget saved.`;
  validateCategoryBudgetForm();
  budgetCategoryInput.focus();
});

budgetList.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('.btn-delete-budget');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= categoryBudgets.length) return;

  const [removedBudget] = categoryBudgets.splice(index, 1);
  saveData();
  render();
  budgetMessage.textContent = `${removedBudget.category} monthly budget deleted.`;
});

salaryForm.addEventListener('submit', event => {
  event.preventDefault();
  salaryMessage.textContent = '';
  if (!salaryInput.validity.valid || Number(salaryInput.value) <= 0) {
    salaryInput.reportValidity();
    return;
  }
  const newIncome = Number(salaryInput.value);
  const plannedTotal = categoryBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  if (plannedTotal > newIncome) {
    salaryMessage.textContent = `Your salary must be at least ${fmt(plannedTotal)} to cover all monthly category budgets.`;
    return;
  }
  income = newIncome;
  saveData();
  updateTotals();
  validateCategoryBudgetForm();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  validateForm();
  if (btnAdd.disabled) return;

  const actual = Number(inputActual.value);
  const planned = inputPlanned.value === '' ? actual : Number(inputPlanned.value);
  rows.unshift({
    category: inputCategory.value.trim(),
    item: inputItem.value.trim(),
    planned,
    actual,
    date: inputDate.value
  });

  saveData();
  render();
  form.reset();
  inputDate.value = localDateValue();
  formMessage.textContent = 'Spending added to your tracker.';
  updatePlannedAmount();
  validateForm();
  inputItem.focus();
});

tbody.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('.btn-delete');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;

  rows.splice(index, 1);
  saveData();
  render();
  formMessage.textContent = 'Spending entry deleted.';
});

salaryInput.addEventListener('input', () => {
  salaryMessage.textContent = '';
});

inputDate.value = localDateValue();
updateMonthLabel();
validateForm();
validateCategoryBudgetForm();
render();
