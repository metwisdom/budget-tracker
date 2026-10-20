<script>
    const INCOME = 5000;
    const STORAGE_KEY = 'budget-tracker-rows';

    const form = document.getElementById('spend-form');
    const inputCategory = document.getElementById('f-category');
    const inputItem = document.getElementById('f-item');
    const inputPlanned = document.getElementById('f-planned');
    const inputActual = document.getElementById('f-actual');
    const btnAdd = document.getElementById('btn-add');
    const tbody = document.getElementById('budget-body');

    let rows = loadRows();

    function loadRows() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

    function saveRows() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch { }
  }

  const fmt = n => {
    const abs = Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    return (n < 0 ? '−$' : '$') + abs;
  };

  const fmtDiff = n => {
    const abs = Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    if (n === 0) return '$0.00';
    return (n > 0 ? '+$' : '−$') + abs;
  };

    function statusFor(diff) {
    if (diff >= 0) return 'OK';
    if (diff > -50) return 'Warn';
    return 'Over';
  }

    function render() {
        tbody.innerHTML = '';

    if (rows.length === 0) {
      const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'No spending logged yet. Use the form above to add your first item.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    } else {
        rows.forEach((row, i) => {
            const diff = row.planned - row.actual;
            const tr = document.createElement('tr');
            tr.innerHTML = `
          <td>${esc(row.category)}</td>
          <td>${esc(row.item)}</td>
          <td>${fmt(row.planned)}</td>
          <td>${fmt(row.actual)}</td>
          <td>${fmtDiff(diff)}</td>
          <td>${statusFor(diff)}</td>
          <td><button type="button" class="btn-delete" data-index="${i}">✕</button></td>
        `;
            tbody.appendChild(tr);
        });
    }

    updateTotals();
  }

    function updateTotals() {
    const planned = rows.reduce((s, r) => s + r.planned, 0);
    const actual = rows.reduce((s, r) => s + r.actual, 0);
    const diff = planned - actual;
    const remaining = INCOME - actual;

    document.getElementById('stat-income').textContent = fmt(INCOME);
    document.getElementById('stat-planned').textContent = fmt(planned);
    document.getElementById('stat-actual').textContent = fmt(actual);
    document.getElementById('stat-remaining').textContent = fmt(remaining);

    document.getElementById('total-planned').textContent = fmt(planned);
    document.getElementById('total-actual').textContent = fmt(actual);
    document.getElementById('total-diff').textContent = fmtDiff(diff);
  }

    function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

        function validateForm() {
    const okCategory = inputCategory.value.trim().length > 0;
    const okItem = inputItem.value.trim().length > 0;
    const okActual = inputActual.value !== '' && Number(inputActual.value) >= 0;
        btnAdd.disabled = !(okCategory && okItem && okActual);
  }

  [inputCategory, inputItem, inputPlanned, inputActual].forEach(el => {
            el.addEventListener('input', validateForm);
  });

  form.addEventListener('submit', e => {
            e.preventDefault();
        if (btnAdd.disabled) return;

        const plannedRaw = inputPlanned.value;
        const actual = Number(inputActual.value);
        const planned = plannedRaw === '' ? actual : Number(plannedRaw);

        rows.push({
            category: inputCategory.value.trim(),
        item: inputItem.value.trim(),
        planned: planned,
        actual: actual
    });

        saveRows();
        render();
        form.reset();
        validateForm();
        inputCategory.focus();
  });

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete');
        if (!btn) return;
        const index = Number(btn.dataset.index);
        rows.splice(index, 1);
        saveRows();
        render();
  });

        validateForm();
        render();
    </script>