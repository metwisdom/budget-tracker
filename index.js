const ROWS_KEY = 'budget-tracker-rows';
const INCOME_KEY = 'budget-tracker-income';
const CATEGORY_BUDGETS_KEY = 'budget-tracker-category-budgets';
const THEME_KEY = 'budget-tracker-theme';
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
const themeToggle = document.getElementById('theme-toggle');
const accountPanel = document.getElementById('account-panel');
const accountStatus = document.getElementById('account-status');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const signInButton = document.getElementById('sign-in-button');
const signUpButton = document.getElementById('sign-up-button');
const signOutButton = document.getElementById('sign-out-button');
const appContent = document.getElementById('app-content');
const setupLink = document.getElementById('setup-link');

let income = loadIncome();
let rows = loadRows();
let categoryBudgets = loadCategoryBudgets();
let supabaseClient = null;
let activeUser = null;

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
  if (supabaseClient && activeUser) return;
  try {
    localStorage.setItem(ROWS_KEY, JSON.stringify(rows));
    localStorage.setItem(INCOME_KEY, String(income));
    localStorage.setItem(CATEGORY_BUDGETS_KEY, JSON.stringify(categoryBudgets));
    storageMessage.textContent = '';
  } catch (error) {
    showStorageError(error);
  }
}

function requireSignedInUser() {
  if (!supabaseClient) return;
  if (!activeUser) throw new Error('Sign in before saving cloud data.');
}

async function saveIncome(value) {
  requireSignedInUser();
  if (!supabaseClient) return;
  const { error } = await supabaseClient
    .from('user_settings')
    .upsert({ user_id: activeUser.id, income: value }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function saveCategoryBudget(category, amount, existingBudget) {
  requireSignedInUser();
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('category_budgets')
    .upsert({
      ...(existingBudget?.id ? { id: existingBudget.id } : {}),
      user_id: activeUser.id,
      category,
      category_key: category.toLocaleLowerCase(),
      amount
    }, { onConflict: 'user_id,category_key' })
    .select('id, category, amount')
    .single();
  if (error) throw error;
  return { id: data.id, category: data.category, amount: Number(data.amount) };
}

async function removeCategoryBudget(budget) {
  requireSignedInUser();
  if (!supabaseClient) return;
  const { error } = await supabaseClient
    .from('category_budgets')
    .delete()
    .eq('id', budget.id)
    .eq('user_id', activeUser.id);
  if (error) throw error;
}

async function insertExpense(expense) {
  requireSignedInUser();
  if (!supabaseClient) return expense;
  const { data, error } = await supabaseClient
    .from('expenses')
    .insert({
      user_id: activeUser.id,
      category: expense.category,
      item: expense.item,
      planned: expense.planned,
      actual: expense.actual,
      spent_on: expense.date
    })
    .select('id, category, item, planned, actual, spent_on')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category: data.category,
    item: data.item,
    planned: Number(data.planned),
    actual: Number(data.actual),
    date: data.spent_on
  };
}

async function removeExpense(expense) {
  requireSignedInUser();
  if (!supabaseClient) return;
  const { error } = await supabaseClient
    .from('expenses')
    .delete()
    .eq('id', expense.id)
    .eq('user_id', activeUser.id);
  if (error) throw error;
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

function setTheme(theme, persist = false) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  themeToggle.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
  themeToggle.querySelector('[aria-hidden="true"]').textContent = isDark ? '☀' : '☾';

  if (!persist) return;

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    showStorageError(error);
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    showStorageError(error);
    return 'light';
  }
}

themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.dataset.theme;
  setTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
});

function showLocalMode(message) {
  activeUser = null;
  salaryForm.hidden = false;
  appContent.hidden = false;
  authForm.hidden = true;
  signOutButton.hidden = true;
  setupLink.hidden = false;
  accountStatus.textContent = message;
}

function showSignedOut(message = 'Sign in or create an account to load your private cloud data.') {
  activeUser = null;
  income = defaultIncome;
  rows = [];
  categoryBudgets = [];
  salaryForm.hidden = true;
  appContent.hidden = true;
  authForm.hidden = false;
  signOutButton.hidden = true;
  setupLink.hidden = false;
  accountStatus.textContent = message;
  render();
}

async function loadCloudData(user) {
  accountStatus.textContent = 'Loading your private budget data…';
  authForm.hidden = true;
  appContent.hidden = true;
  salaryForm.hidden = true;

  const [settingsResult, budgetsResult, expensesResult] = await Promise.all([
    supabaseClient
      .from('user_settings')
      .select('income')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseClient
      .from('category_budgets')
      .select('id, category, amount')
      .eq('user_id', user.id)
      .order('category'),
    supabaseClient
      .from('expenses')
      .select('id, category, item, planned, actual, spent_on')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
  ]);

  const queryError = settingsResult.error || budgetsResult.error || expensesResult.error;
  if (queryError) throw queryError;

  activeUser = user;
  income = settingsResult.data ? Number(settingsResult.data.income) : defaultIncome;
  categoryBudgets = budgetsResult.data.map(budget => ({
    id: budget.id,
    category: budget.category,
    amount: Number(budget.amount)
  }));
  rows = expensesResult.data.map(expense => ({
    id: expense.id,
    category: expense.category,
    item: expense.item,
    planned: Number(expense.planned),
    actual: Number(expense.actual),
    date: expense.spent_on
  }));
  salaryForm.hidden = false;
  appContent.hidden = false;
  authForm.hidden = true;
  signOutButton.hidden = false;
  setupLink.hidden = true;
  accountStatus.textContent = `Cloud data is private to ${user.email}.`;
  render();
  validateCategoryBudgetForm();
}

function showCloudLoadError(error) {
  console.error('Unable to load cloud budget data.', error);
  activeUser = null;
  salaryForm.hidden = true;
  appContent.hidden = true;
  authForm.hidden = true;
  signOutButton.hidden = false;
  setupLink.hidden = false;
  accountStatus.textContent = `Unable to load your cloud data: ${error.message}. Check the database setup, then sign out and try again.`;
}

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const action = event.submitter?.id;
  const email = authEmail.value.trim();
  const password = authPassword.value;
  signInButton.disabled = true;
  signUpButton.disabled = true;

  try {
    if (action === 'sign-up-button') {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        await loadCloudData(data.session.user);
      } else {
        accountStatus.textContent = 'Account created. Check your email to confirm it, then sign in.';
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadCloudData(data.user);
    }
  } catch (error) {
    console.error('Account action failed.', error);
    accountStatus.textContent = `Unable to ${action === 'sign-up-button' ? 'create your account' : 'sign in'}: ${error.message}`;
  } finally {
    signInButton.disabled = false;
    signUpButton.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  signOutButton.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    showSignedOut();
  } catch (error) {
    console.error('Unable to sign out.', error);
    accountStatus.textContent = `Unable to sign out: ${error.message}`;
  } finally {
    signOutButton.disabled = false;
  }
});

async function initializeCloud() {
  const config = window.BUDGET_TRACKER_SUPABASE_CONFIG;
  if (!config?.url || !config?.anonKey) {
    showLocalMode('Cloud accounts are not configured. Your data is stored only in this browser.');
    return;
  }

  if (!window.supabase?.createClient) {
    showLocalMode('Could not load Supabase. Check your internet connection; data is currently stored only in this browser.');
    return;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  setupLink.hidden = true;
  accountStatus.textContent = 'Checking your account…';
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') showSignedOut();
  });

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (data.session) {
      await loadCloudData(data.session.user);
    } else {
      showSignedOut();
    }
  } catch (error) {
    showCloudLoadError(error);
  }
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

categoryBudgetForm.addEventListener('submit', async event => {
  event.preventDefault();
  validateCategoryBudgetForm();
  if (saveBudgetButton.disabled) return;

  const category = budgetCategoryInput.value.trim();
  const categoryKey = category.toLocaleLowerCase();
  const amount = Number(budgetAmountInput.value);
  const existingBudget = categoryBudgets.find(
    budget => budget.category.toLocaleLowerCase() === categoryKey
  );

  try {
    const savedBudget = await saveCategoryBudget(category, amount, existingBudget);
    if (existingBudget) {
      Object.assign(existingBudget, savedBudget || { category, amount });
    } else {
      categoryBudgets.push(savedBudget || { category, amount });
    }
  } catch (error) {
    console.error('Unable to save category budget.', error);
    budgetMessage.textContent = `Unable to save this budget: ${error.message}`;
    return;
  }

  saveData();
  render();
  categoryBudgetForm.reset();
  budgetMessage.textContent = `${category} monthly budget saved.`;
  validateCategoryBudgetForm();
  budgetCategoryInput.focus();
});

budgetList.addEventListener('click', async event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('.btn-delete-budget');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= categoryBudgets.length) return;

  const budget = categoryBudgets[index];
  try {
    await removeCategoryBudget(budget);
  } catch (error) {
    console.error('Unable to delete category budget.', error);
    budgetMessage.textContent = `Unable to delete this budget: ${error.message}`;
    return;
  }

  const [removedBudget] = categoryBudgets.splice(index, 1);
  saveData();
  render();
  budgetMessage.textContent = `${removedBudget.category} monthly budget deleted.`;
});

salaryForm.addEventListener('submit', async event => {
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
  try {
    await saveIncome(newIncome);
  } catch (error) {
    console.error('Unable to save salary.', error);
    salaryMessage.textContent = `Unable to save salary: ${error.message}`;
    return;
  }
  income = newIncome;
  saveData();
  updateTotals();
  validateCategoryBudgetForm();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  validateForm();
  if (btnAdd.disabled) return;

  const actual = Number(inputActual.value);
  const planned = inputPlanned.value === '' ? actual : Number(inputPlanned.value);
  const expense = {
    category: inputCategory.value.trim(),
    item: inputItem.value.trim(),
    planned,
    actual,
    date: inputDate.value
  };

  try {
    rows.unshift(await insertExpense(expense));
  } catch (error) {
    console.error('Unable to save spending entry.', error);
    formMessage.textContent = `Unable to save spending: ${error.message}`;
    return;
  }

  saveData();
  render();
  form.reset();
  inputDate.value = localDateValue();
  formMessage.textContent = 'Spending added to your tracker.';
  updatePlannedAmount();
  validateForm();
  inputItem.focus();
});

tbody.addEventListener('click', async event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('.btn-delete');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;

  try {
    await removeExpense(rows[index]);
  } catch (error) {
    console.error('Unable to delete spending entry.', error);
    formMessage.textContent = `Unable to delete this entry: ${error.message}`;
    return;
  }

  rows.splice(index, 1);
  saveData();
  render();
  formMessage.textContent = 'Spending entry deleted.';
});

salaryInput.addEventListener('input', () => {
  salaryMessage.textContent = '';
});

inputDate.value = localDateValue();
setTheme(loadTheme());
updateMonthLabel();
validateForm();
validateCategoryBudgetForm();
render();
initializeCloud();
