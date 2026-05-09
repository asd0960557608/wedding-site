const ADMIN_PASSWORD = 'yu1342027';
const ADMIN_SESSION_KEY = 'yu134_admin_authenticated';
const TABLE_CAPACITY_KEY = 'yu134_table_capacity';
const TABLE_NOTES_KEY = 'yu134_table_notes';

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.querySelector('#adminLogin');
  const appPanel = document.querySelector('#adminApp');
  const passwordInput = document.querySelector('#adminPassword');
  const loginButton = document.querySelector('#adminLoginButton');
  const logoutButton = document.querySelector('#adminLogout');
  const loginNotice = document.querySelector('#loginNotice');
  const tableBody = document.querySelector('#guestTableBody');
  const searchInput = document.querySelector('#adminSearch');
  const tableFilter = document.querySelector('#tableFilter');
  const refreshButton = document.querySelector('#refreshGuests');
  const exportCsvButton = document.querySelector('#exportCsv');
  const exportExcelButton = document.querySelector('#exportExcel');
  const tableCapacityInput = document.querySelector('#tableCapacity');
  const batchTableInput = document.querySelector('#batchTableNo');
  const batchAssignButton = document.querySelector('#batchAssign');
  const printSeatingButton = document.querySelector('#printSeating');
  const printPublicButton = document.querySelector('#printPublicBoard');
  const duplicatePanel = document.querySelector('#duplicatePanel');
  const duplicateList = document.querySelector('#duplicateList');
  const notice = document.querySelector('#adminNotice');
  const spinner = document.querySelector('#adminSpinner');
  const seatingBoard = document.querySelector('#seatingBoard');
  const unassignedList = document.querySelector('#unassignedList');
  const unassignedCount = document.querySelector('[data-unassigned-count]');

  if (!tableBody) return;

  let guests = [];
  let tableNotes = readJson(TABLE_NOTES_KEY, {});

  tableCapacityInput.value = localStorage.getItem(TABLE_CAPACITY_KEY) || '10';

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
      window.guests = guests;
      renderAll();
    } catch (error) {
      showNotice(notice, `讀取資料時發生問題：${friendlyDbError(error)}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  }

  function getFilteredGuests() {
    const keyword = String(searchInput.value || '').trim().toLowerCase();
    const selectedTable = tableFilter.value;

    return guests.filter((guest) => {
      const tableNo = guest.table_no || '';
      const tableMatched = !selectedTable
        || (selectedTable === '__unassigned__' ? !tableNo : tableNo === selectedTable);
      const textMatched = !keyword || [
        guest.name,
        guest.phone,
        guest.table_no,
        guest.meal_type,
        guest.group_name,
        guest.special_need,
        guest.note
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword));

      return tableMatched && textMatched;
    });
  }

  function renderAll() {
    renderTableFilter();
    renderStats();
    renderDuplicateWarnings();
    renderGuests();
    renderSeatingBoard();
  }

  function renderTableFilter() {
    const current = tableFilter.value;
    const tables = getTableNames(guests.filter((guest) => guest.attend_status === 'attending'));
    tableFilter.innerHTML = [
      '<option value="">全部桌號</option>',
      '<option value="__unassigned__">未排桌</option>',
      ...tables.map((tableNo) => `<option value="${escapeAttribute(tableNo)}">${escapeHtml(tableNo)}</option>`)
    ].join('');
    tableFilter.value = [...tables, '', '__unassigned__'].includes(current) ? current : '';
  }

  function renderStats() {
    const attending = guests.filter((guest) => guest.attend_status === 'attending');
    const tableNames = getTableNames(attending);
    const guestCount = attending.reduce((sum, guest) => sum + getGuestCount(guest), 0);
    const seatedCount = attending
      .filter((guest) => guest.table_no)
      .reduce((sum, guest) => sum + getGuestCount(guest), 0);
    const vegetarian = attending
      .filter((guest) => guest.meal_type === '素食')
      .reduce((sum, guest) => sum + getGuestCount(guest), 0);
    const childSeats = attending.reduce((sum, guest) => sum + Number(guest.child_count || 0), 0);
    const specialNeeds = attending.filter((guest) => String(guest.special_need || '').trim()).length;
    const unassigned = attending.filter((guest) => !guest.table_no).reduce((sum, guest) => sum + getGuestCount(guest), 0);
    const duplicates = findDuplicates().length;

    setStat('total', guests.length);
    setStat('attending', attending.length);
    setStat('guestCount', guestCount);
    setStat('vegetarian', vegetarian);
    setStat('unassigned', unassigned);
    setStat('tableCount', tableNames.length);
    setStat('seatedCount', seatedCount);
    setStat('childSeats', childSeats);
    setStat('specialNeeds', specialNeeds);
    setStat('duplicates', duplicates);
  }

  function setStat(name, value) {
    const item = document.querySelector(`[data-stat="${name}"]`);
    if (item) item.textContent = value;
  }

  function renderDuplicateWarnings() {
    const duplicates = findDuplicates();
    duplicatePanel.classList.toggle('hidden', duplicates.length === 0);
    duplicateList.innerHTML = duplicates.map((item) => `
      <div class="warning-item">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${item.guests.map((guest) => `${escapeHtml(guest.name)} (${escapeHtml(guest.phone || '無手機')})`).join('、')}</span>
      </div>
    `).join('');
  }

  function renderGuests() {
    const filtered = getFilteredGuests();

    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="12">目前沒有符合條件的資料。</td></tr>';
      return;
    }

    tableBody.innerHTML = filtered.map((guest) => `
      <tr data-id="${guest.id}">
        <td><label class="check-label"><input type="checkbox" data-select-guest value="${guest.id}"><span>${escapeHtml(guest.name)}</span></label></td>
        <td>${escapeHtml(guest.phone || '')}</td>
        <td>
          <select data-field="attend_status">
            <option value="pending" ${guest.attend_status === 'pending' ? 'selected' : ''}>尚未確認</option>
            <option value="attending" ${guest.attend_status === 'attending' ? 'selected' : ''}>確認參加</option>
            <option value="declined" ${guest.attend_status === 'declined' ? 'selected' : ''}>不克參加</option>
          </select>
        </td>
        <td>${getGuestCount(guest)}</td>
        <td>${escapeHtml(guest.meal_type || '')}</td>
        <td>${escapeHtml(guest.group_name || '')}</td>
        <td>${Number(guest.child_count || 0)}</td>
        <td>${escapeHtml(guest.special_need || '')}</td>
        <td><input data-field="table_no" value="${escapeAttribute(guest.table_no || '')}" placeholder="例如 A1"></td>
        <td>${escapeHtml(guest.note || '')}</td>
        <td>${formatDate(guest.created_at)}</td>
        <td><button class="btn ghost" data-save>儲存</button></td>
      </tr>
    `).join('');
  }

  function renderSeatingBoard() {
    const filteredAttending = getFilteredGuests().filter((guest) => guest.attend_status === 'attending');
    const unassigned = filteredAttending.filter((guest) => !guest.table_no);
    const assigned = filteredAttending.filter((guest) => guest.table_no);
    const capacity = getCapacity();
    const tableGroups = assigned.reduce((acc, guest) => {
      const tableNo = guest.table_no;
      acc[tableNo] = acc[tableNo] || [];
      acc[tableNo].push(guest);
      return acc;
    }, {});
    const tableNames = getTableNames(assigned);

    unassignedCount.textContent = `${unassigned.reduce((sum, guest) => sum + getGuestCount(guest), 0)} 人`;
    unassignedList.innerHTML = unassigned.length
      ? unassigned.map(renderGuestCard).join('')
      : '<p class="muted-text">所有確認參加的賓客都已排桌。</p>';

    seatingBoard.innerHTML = tableNames.length
      ? tableNames.map((tableNo) => {
        const list = tableGroups[tableNo];
        const total = list.reduce((sum, guest) => sum + getGuestCount(guest), 0);
        const vegetarian = list.filter((guest) => guest.meal_type === '素食').reduce((sum, guest) => sum + getGuestCount(guest), 0);
        const children = list.reduce((sum, guest) => sum + Number(guest.child_count || 0), 0);
        const isOver = total > capacity;
        return `
          <article class="table-card ${isOver ? 'over-capacity' : ''}" data-table-card="${escapeAttribute(tableNo)}">
            <div class="table-card-head">
              <div>
                <span>Table</span>
                <h3>${escapeHtml(tableNo)}</h3>
              </div>
              <strong>${total}/${capacity} 人</strong>
            </div>
            <div class="table-meta">
              <span>葷食 ${Math.max(total - vegetarian, 0)}</span>
              <span>素食 ${vegetarian}</span>
              <span>兒童椅 ${children}</span>
            </div>
            <div class="table-note">
              <label>同桌備註</label>
              <textarea data-table-note="${escapeAttribute(tableNo)}" placeholder="例如女方親友、靠近出口、長輩桌">${escapeHtml(tableNotes[tableNo] || '')}</textarea>
            </div>
            <div class="guest-dropzone" data-table-drop="${escapeAttribute(tableNo)}">
              <div class="mini-guest-list">
                ${list.map(renderGuestCard).join('')}
              </div>
            </div>
          </article>
        `;
      }).join('')
      : '<p class="muted-text">目前沒有已排桌的賓客。</p>';

    setupDragTargets();
  }

  function renderGuestCard(guest) {
    return `
      <article class="guest-card" draggable="true" data-guest-card="${guest.id}">
        <label class="check-label"><input type="checkbox" data-select-guest value="${guest.id}"><span>${escapeHtml(guest.name)}</span></label>
        <small>${getGuestCount(guest)} 人・${escapeHtml(guest.meal_type || '未填')}・${escapeHtml(guest.group_name || '未分組')}</small>
        ${guest.special_need ? `<em>${escapeHtml(guest.special_need)}</em>` : ''}
      </article>
    `;
  }

  function setupDragTargets() {
    document.querySelectorAll('[data-guest-card]').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', card.dataset.guestCard);
      });
    });

    document.querySelectorAll('[data-table-drop]').forEach((dropzone) => {
      dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', async (event) => {
        event.preventDefault();
        dropzone.classList.remove('drag-over');
        const id = Number(event.dataTransfer.getData('text/plain'));
        await updateGuestTable(id, dropzone.dataset.tableDrop || null);
      });
    });
  }

  async function saveGuest(row, saveButton) {
    const id = Number(row.dataset.id);
    const attendStatus = row.querySelector('[data-field="attend_status"]').value;
    const tableNo = row.querySelector('[data-field="table_no"]').value.trim();

    saveButton.disabled = true;
    saveButton.textContent = '儲存中';
    clearNotice(notice);

    try {
      await updateGuest(id, { attend_status: attendStatus, table_no: tableNo || null });
      showNotice(notice, '資料已更新。', 'success');
    } catch (error) {
      showNotice(notice, `更新時發生問題：${friendlyDbError(error)}`, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '儲存';
    }
  }

  async function updateGuestTable(id, tableNo) {
    try {
      await updateGuest(id, { table_no: tableNo || null });
      showNotice(notice, tableNo ? `已安排至 ${tableNo}。` : '已移回未排桌。', 'success');
    } catch (error) {
      showNotice(notice, `排桌時發生問題：${friendlyDbError(error)}`, 'error');
    }
  }

  async function updateGuest(id, patch) {
    const { error } = await weddingSupabase
      .from('guests')
      .update(patch)
      .eq('id', id);

    if (error) throw error;
    guests = guests.map((guest) => guest.id === id ? { ...guest, ...patch } : guest);
    window.guests = guests;
    renderAll();
  }

  async function batchAssign() {
    const ids = getSelectedGuestIds();
    const tableNo = batchTableInput.value.trim();

    if (!ids.length) {
      showNotice(notice, '請先勾選要批次排桌的賓客。', 'error');
      return;
    }

    if (!tableNo) {
      showNotice(notice, '請輸入要指定的桌號。', 'error');
      return;
    }

    clearNotice(notice);
    setLoading(spinner, true);

    try {
      const { error } = await weddingSupabase
        .from('guests')
        .update({ table_no: tableNo })
        .in('id', ids);

      if (error) throw error;
      guests = guests.map((guest) => ids.includes(guest.id) ? { ...guest, table_no: tableNo } : guest);
      window.guests = guests;
      batchTableInput.value = '';
      showNotice(notice, `已將 ${ids.length} 筆資料指定到 ${tableNo}。`, 'success');
      renderAll();
    } catch (error) {
      showNotice(notice, `批次排桌時發生問題：${friendlyDbError(error)}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  }

  function getSelectedGuestIds() {
    return [...document.querySelectorAll('[data-select-guest]:checked')]
      .map((input) => Number(input.value))
      .filter((id, index, arr) => id && arr.indexOf(id) === index);
  }

  function exportGuests(type) {
    const rows = guests.map((guest) => ({
      name: guest.name || '',
      phone: guest.phone || '',
      attend_status: translateStatus(guest.attend_status),
      guest_count: getGuestCount(guest),
      meal_type: guest.meal_type || '',
      group_name: guest.group_name || '',
      child_count: Number(guest.child_count || 0),
      special_need: guest.special_need || '',
      table_no: guest.table_no || '',
      note: guest.note || '',
      created_at: formatDate(guest.created_at)
    }));
    const header = ['姓名', '手機', '出席狀態', '人數', '餐點', '分組', '兒童椅', '特殊需求', '桌號', '備註', '建立時間'];

    if (type === 'csv') {
      const csv = [header, ...rows.map(Object.values)]
        .map((row) => row.map(csvCell).join(','))
        .join('\n');
      downloadFile('yu-134-guests.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8');
      return;
    }

    const html = `
      <html><head><meta charset="UTF-8"></head><body>
        <table>
          <tr>${header.map((item) => `<th>${item}</th>`).join('')}</tr>
          ${rows.map((row) => `<tr>${Object.values(row).map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}
        </table>
      </body></html>
    `;
    downloadFile('yu-134-guests.xls', html, 'application/vnd.ms-excel;charset=utf-8');
  }

  function printSeating(type) {
    const isPublic = type === 'public';
    const attending = guests.filter((guest) => guest.attend_status === 'attending');
    const tableNames = getTableNames(attending);
    const groups = tableNames.map((tableNo) => ({
      tableNo,
      guests: attending.filter((guest) => guest.table_no === tableNo)
    }));
    const unassigned = attending.filter((guest) => !guest.table_no);

    const rows = groups.map(({ tableNo, guests: list }) => {
      const count = list.reduce((sum, guest) => sum + getGuestCount(guest), 0);
      return `
        <section class="print-table">
          <h2>${escapeHtml(tableNo)} <small>${count} 人</small></h2>
          ${!isPublic && tableNotes[tableNo] ? `<p>${escapeHtml(tableNotes[tableNo])}</p>` : ''}
          <table>
            <tr>${isPublic ? '<th>姓名</th><th>桌號</th>' : '<th>姓名</th><th>人數</th><th>餐點</th><th>分組</th><th>特殊需求</th><th>備註</th>'}</tr>
            ${list.map((guest) => isPublic
              ? `<tr><td>${escapeHtml(guest.name)}</td><td>${escapeHtml(tableNo)}</td></tr>`
              : `<tr><td>${escapeHtml(guest.name)}</td><td>${getGuestCount(guest)}</td><td>${escapeHtml(guest.meal_type || '')}</td><td>${escapeHtml(guest.group_name || '')}</td><td>${escapeHtml(guest.special_need || '')}</td><td>${escapeHtml(guest.note || '')}</td></tr>`
            ).join('')}
          </table>
        </section>
      `;
    }).join('');

    const unassignedHtml = !isPublic && unassigned.length ? `
      <section class="print-table">
        <h2>未排桌</h2>
        <table>
          <tr><th>姓名</th><th>人數</th><th>餐點</th><th>分組</th><th>備註</th></tr>
          ${unassigned.map((guest) => `<tr><td>${escapeHtml(guest.name)}</td><td>${getGuestCount(guest)}</td><td>${escapeHtml(guest.meal_type || '')}</td><td>${escapeHtml(guest.group_name || '')}</td><td>${escapeHtml(guest.note || '')}</td></tr>`).join('')}
        </table>
      </section>
    ` : '';

    const doc = `
      <!DOCTYPE html>
      <html lang="zh-Hant">
      <head>
        <meta charset="UTF-8">
        <title>${isPublic ? 'Yu & 134 賓客桌次公告' : 'Yu & 134 桌次表'}</title>
        <style>
          body { font-family: "Noto Sans TC", Arial, sans-serif; color: #2f2a25; padding: 24px; }
          h1 { font-family: Georgia, serif; font-size: 32px; margin: 0 0 18px; }
          h2 { font-size: 20px; margin: 18px 0 8px; color: #8a6a31; }
          small { color: #777; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          th, td { border: 1px solid #d8cab8; padding: 8px; text-align: left; }
          th { background: #f7efe2; }
          @media print { body { padding: 0; } .print-table { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>${isPublic ? 'Yu & 134 賓客桌次公告' : 'Yu & 134 桌次表'}</h1>
        ${rows || '<p>目前沒有已排桌資料。</p>'}
        ${unassignedHtml}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      downloadFile(isPublic ? 'yu-134-public-seating.html' : 'yu-134-seating.html', doc, 'text/html;charset=utf-8');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(doc);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  tableBody.addEventListener('click', (event) => {
    const saveButton = event.target.closest('[data-save]');
    if (!saveButton) return;
    saveGuest(saveButton.closest('tr'), saveButton);
  });

  seatingBoard.addEventListener('input', (event) => {
    const textarea = event.target.closest('[data-table-note]');
    if (!textarea) return;
    tableNotes[textarea.dataset.tableNote] = textarea.value;
    localStorage.setItem(TABLE_NOTES_KEY, JSON.stringify(tableNotes));
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
  tableFilter.addEventListener('change', renderAll);
  tableCapacityInput.addEventListener('change', () => {
    localStorage.setItem(TABLE_CAPACITY_KEY, String(getCapacity()));
    renderAll();
  });
  refreshButton.addEventListener('click', loadGuests);
  exportCsvButton.addEventListener('click', () => exportGuests('csv'));
  exportExcelButton.addEventListener('click', () => exportGuests('excel'));
  batchAssignButton.addEventListener('click', batchAssign);
  printSeatingButton.addEventListener('click', () => printSeating('full'));
  printPublicButton.addEventListener('click', () => printSeating('public'));
});

function getGuestCount(guest) {
  return Number(guest.guest_count || 1);
}

function getCapacity() {
  const value = Number(document.querySelector('#tableCapacity')?.value || 10);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

function getTableNames(list) {
  return [...new Set(list.map((guest) => guest.table_no).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true }));
}

function findDuplicates() {
  const groups = new Map();
  guestsForDuplicateCheck().forEach((guest) => {
    const phoneKey = guest.phone ? `手機 ${guest.phone}` : '';
    const nameKey = guest.name ? `姓名 ${guest.name.trim().toLowerCase()}` : '';
    [phoneKey, nameKey].filter(Boolean).forEach((key) => {
      groups.set(key, [...(groups.get(key) || []), guest]);
    });
  });

  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([label, list]) => ({ label, guests: list }));
}

function guestsForDuplicateCheck() {
  return window.guests || [];
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

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

function friendlyDbError(error) {
  if (String(error.message || '').includes('group_name')
    || String(error.message || '').includes('child_count')
    || String(error.message || '').includes('special_need')) {
    return `${error.message}。請先依 README 執行欄位 migration。`;
  }

  return error.message;
}
