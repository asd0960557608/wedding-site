const ADMIN_PASSWORD = 'yu1342027';
const ADMIN_SESSION_KEY = 'yu134_admin_authenticated';

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.querySelector('#adminLogin');
  const appPanel = document.querySelector('#adminApp');
  const passwordInput = document.querySelector('#adminPassword');
  const loginButton = document.querySelector('#adminLoginButton');
  const logoutButton = document.querySelector('#adminLogout');
  const loginNotice = document.querySelector('#loginNotice');
  const tableBody = document.querySelector('#guestTableBody');
  const searchInput = document.querySelector('#adminSearch');
  const refreshButton = document.querySelector('#refreshGuests');
  const exportCsvButton = document.querySelector('#exportCsv');
  const exportExcelButton = document.querySelector('#exportExcel');
  const notice = document.querySelector('#adminNotice');
  const spinner = document.querySelector('#adminSpinner');
  const seatingBoard = document.querySelector('#seatingBoard');

  if (!tableBody) return;

  let guests = [];

  function unlockAdmin() {
    loginPanel.classList.add('hidden');
    appPanel.classList.remove('hidden');
    loadGuests();
  }

  function lockAdmin() {
    loginPanel.classList.remove('hidden');
    appPanel.classList.add('hidden');
  }

  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
    unlockAdmin();
  } else {
    lockAdmin();
  }

  loginButton.addEventListener('click', () => {
    if (passwordInput.value === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      clearNotice(loginNotice);
      unlockAdmin();
      return;
    }

    showNotice(loginNotice, '密碼不正確，請再確認。', 'error');
  });

  passwordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loginButton.click();
  });

  logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    lockAdmin();
  });

  async function loadGuests() {
    clearNotice(notice);
    setLoading(spinner, true);

    if (!weddingSupabase) {
      setLoading(spinner, false);
      showNotice(notice, '尚未設定 Supabase URL 與 API Key，請先完成 js/supabase.js 設定。', 'error');
      return;
    }

    try {
      const { data, error } = await weddingSupabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      guests = data || [];
      renderAll();
    } catch (error) {
      showNotice(notice, `讀取資料時發生問題：${error.message}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  }

  function getFilteredGuests() {
    const keyword = String(searchInput.value || '').trim().toLowerCase();
    return guests.filter((guest) => {
      return [guest.name, guest.phone, guest.table_no, guest.meal_type, guest.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }

  function renderAll() {
    renderStats();
    renderGuests();
    renderSeatingBoard();
  }

  function renderStats() {
    const attending = guests.filter((guest) => guest.attend_status === 'attending');
    const guestCount = attending.reduce((sum, guest) => sum + Number(guest.guest_count || 1), 0);
    const vegetarian = guests
      .filter((guest) => guest.attend_status === 'attending' && guest.meal_type === '素食')
      .reduce((sum, guest) => sum + Number(guest.guest_count || 1), 0);
    const unassigned = attending.filter((guest) => !guest.table_no).length;

    setStat('total', guests.length);
    setStat('attending', attending.length);
    setStat('guestCount', guestCount);
    setStat('vegetarian', vegetarian);
    setStat('unassigned', unassigned);
  }

  function setStat(name, value) {
    const item = document.querySelector(`[data-stat="${name}"]`);
    if (item) item.textContent = value;
  }

  function renderGuests() {
    const filtered = getFilteredGuests();

    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="9">目前沒有符合條件的資料。</td></tr>';
      return;
    }

    tableBody.innerHTML = filtered.map((guest) => `
      <tr data-id="${guest.id}">
        <td>${escapeHtml(guest.name)}</td>
        <td>${escapeHtml(guest.phone || '')}</td>
        <td>
          <select data-field="attend_status">
            <option value="pending" ${guest.attend_status === 'pending' ? 'selected' : ''}>尚未確認</option>
            <option value="attending" ${guest.attend_status === 'attending' ? 'selected' : ''}>確認參加</option>
            <option value="declined" ${guest.attend_status === 'declined' ? 'selected' : ''}>不克參加</option>
          </select>
        </td>
        <td>${Number(guest.guest_count || 1)}</td>
        <td>${escapeHtml(guest.meal_type || '')}</td>
        <td><input data-field="table_no" value="${escapeAttribute(guest.table_no || '')}" placeholder="例如 A1"></td>
        <td>${escapeHtml(guest.note || '')}</td>
        <td>${formatDate(guest.created_at)}</td>
        <td><button class="btn ghost" data-save>儲存</button></td>
      </tr>
    `).join('');
  }

  function renderSeatingBoard() {
    const attendingGuests = getFilteredGuests().filter((guest) => guest.attend_status === 'attending');
    const groups = attendingGuests.reduce((acc, guest) => {
      const tableNo = guest.table_no || '未排桌';
      acc[tableNo] = acc[tableNo] || [];
      acc[tableNo].push(guest);
      return acc;
    }, {});

    const tableNames = Object.keys(groups).sort((a, b) => {
      if (a === '未排桌') return 1;
      if (b === '未排桌') return -1;
      return a.localeCompare(b, 'zh-Hant', { numeric: true });
    });

    if (!tableNames.length) {
      seatingBoard.innerHTML = '<p class="muted-text">目前沒有確認參加的賓客。</p>';
      return;
    }

    seatingBoard.innerHTML = tableNames.map((tableNo) => {
      const list = groups[tableNo];
      const total = list.reduce((sum, guest) => sum + Number(guest.guest_count || 1), 0);
      return `
        <article class="table-card">
          <div class="table-card-head">
            <div>
              <span>Table</span>
              <h3>${escapeHtml(tableNo)}</h3>
            </div>
            <strong>${total} 人</strong>
          </div>
          <ul>
            ${list.map((guest) => `
              <li>
                <span>${escapeHtml(guest.name)}</span>
                <small>${Number(guest.guest_count || 1)} 人・${escapeHtml(guest.meal_type || '未填')}</small>
              </li>
            `).join('')}
          </ul>
        </article>
      `;
    }).join('');
  }

  async function saveGuest(row, saveButton) {
    const id = Number(row.dataset.id);
    const attendStatus = row.querySelector('[data-field="attend_status"]').value;
    const tableNo = row.querySelector('[data-field="table_no"]').value.trim();

    saveButton.disabled = true;
    saveButton.textContent = '儲存中';
    clearNotice(notice);

    try {
      const { error } = await weddingSupabase
        .from('guests')
        .update({ attend_status: attendStatus, table_no: tableNo || null })
        .eq('id', id);

      if (error) throw error;

      guests = guests.map((guest) => guest.id === id
        ? { ...guest, attend_status: attendStatus, table_no: tableNo }
        : guest);
      showNotice(notice, '資料已更新。', 'success');
      renderAll();
    } catch (error) {
      showNotice(notice, `更新時發生問題：${error.message}`, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '儲存';
    }
  }

  tableBody.addEventListener('click', (event) => {
    const saveButton = event.target.closest('[data-save]');
    if (!saveButton) return;
    saveGuest(saveButton.closest('tr'), saveButton);
  });

  document.querySelectorAll('[data-admin-view]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-view]').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.admin-view').forEach((view) => view.classList.remove('active'));
      button.classList.add('active');
      document.querySelector(`#${button.dataset.adminView}View`).classList.add('active');
    });
  });

  searchInput.addEventListener('input', renderAll);
  refreshButton.addEventListener('click', loadGuests);
  exportCsvButton.addEventListener('click', () => exportGuests('csv'));
  exportExcelButton.addEventListener('click', () => exportGuests('excel'));

  function exportGuests(type) {
    const rows = guests.map((guest) => ({
      name: guest.name || '',
      phone: guest.phone || '',
      attend_status: translateStatus(guest.attend_status),
      guest_count: guest.guest_count || 1,
      meal_type: guest.meal_type || '',
      table_no: guest.table_no || '',
      note: guest.note || '',
      created_at: formatDate(guest.created_at)
    }));

    if (type === 'csv') {
      const header = ['姓名', '手機', '出席狀態', '人數', '餐點', '桌號', '備註', '建立時間'];
      const csv = [header, ...rows.map(Object.values)]
        .map((row) => row.map(csvCell).join(','))
        .join('\n');
      downloadFile('yu-134-guests.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8');
      return;
    }

    const html = `
      <html><head><meta charset="UTF-8"></head><body>
        <table>
          <tr><th>姓名</th><th>手機</th><th>出席狀態</th><th>人數</th><th>餐點</th><th>桌號</th><th>備註</th><th>建立時間</th></tr>
          ${rows.map((row) => `<tr>${Object.values(row).map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}
        </table>
      </body></html>
    `;
    downloadFile('yu-134-guests.xls', html, 'application/vnd.ms-excel;charset=utf-8');
  }
});

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
