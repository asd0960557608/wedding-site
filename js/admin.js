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
  const hotelTableBody = document.querySelector('#hotelTableBody');
  const scheduleForm = document.querySelector('#scheduleForm');
  const scheduleTableBody = document.querySelector('#scheduleTableBody');
  const exportScheduleButton = document.querySelector('#exportSchedule');
  const backupNameInput = document.querySelector('#backupName');
  const createBackupButton = document.querySelector('#createBackup');
  const backupTableBody = document.querySelector('#backupTableBody');
  const budgetForm = document.querySelector('#budgetForm');
  const budgetTableBody = document.querySelector('#budgetTableBody');
  const vendorForm = document.querySelector('#vendorForm');
  const vendorTableBody = document.querySelector('#vendorTableBody');
  const wishTableBody = document.querySelector('#wishTableBody');

  if (!tableBody) return;

  let guests = [];
  let schedules = [];
  let backups = [];
  let budgets = [];
  let vendors = [];
  let wishes = [];
  let tableNotes = readJson(TABLE_NOTES_KEY, {});

  tableCapacityInput.value = localStorage.getItem(TABLE_CAPACITY_KEY) || '10';

  function unlockAdmin() {
    loginPanel.classList.add('hidden');
    appPanel.classList.remove('hidden');
    loadGuests();
    loadAdminData();
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

  async function loadAdminData() {
    if (!weddingSupabase) return;
    await Promise.all([
      loadSchedules(),
      loadBackups(),
      loadBudgets(),
      loadVendors(),
      loadWishes()
    ]);
  }

  async function loadSchedules() {
    try {
      const { data, error } = await weddingSupabase
        .from('wedding_schedule')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('time', { ascending: true });
      if (error) throw error;
      schedules = data || [];
      renderSchedules();
    } catch (error) {
      renderTableMessage(scheduleTableBody, 4, `流程資料讀取失敗：${friendlyDbError(error)}`);
    }
  }

  async function loadBackups() {
    try {
      const { data, error } = await weddingSupabase
        .from('seating_backups')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      backups = data || [];
      renderBackups();
    } catch (error) {
      renderTableMessage(backupTableBody, 4, `桌次備份讀取失敗：${friendlyDbError(error)}`);
    }
  }

  async function loadBudgets() {
    try {
      const { data, error } = await weddingSupabase
        .from('wedding_budgets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      budgets = data || [];
      renderBudgets();
    } catch (error) {
      renderTableMessage(budgetTableBody, 6, `預算資料讀取失敗：${friendlyDbError(error)}`);
    }
  }

  async function loadVendors() {
    try {
      const { data, error } = await weddingSupabase
        .from('wedding_vendors')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      vendors = data || [];
      renderVendors();
    } catch (error) {
      renderTableMessage(vendorTableBody, 6, `廠商資料讀取失敗：${friendlyDbError(error)}`);
    }
  }

  async function loadWishes() {
    try {
      const { data, error } = await weddingSupabase
        .from('wishes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      wishes = data || [];
      renderWishes();
    } catch (error) {
      renderTableMessage(wishTableBody, 6, `祝福留言讀取失敗：${friendlyDbError(error)}`);
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
        guest.hotel_needed,
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
    renderHotelNeeds();
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
    const hotelNeeds = attending
      .filter((guest) => guest.hotel_needed === 'yes' || guest.hotel_needed === 'maybe')
      .reduce((sum, guest) => sum + Number(guest.hotel_guest_count || 0), 0);
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
    setStat('hotelNeeds', hotelNeeds);
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
      tableBody.innerHTML = '<tr><td colspan="14">目前沒有符合條件的資料。</td></tr>';
      return;
    }

    tableBody.innerHTML = filtered.map((guest) => `
      <tr data-id="${guest.id}">
        <td><label class="check-label"><input type="checkbox" data-select-guest value="${guest.id}"><input data-field="name" value="${escapeAttribute(guest.name || '')}" aria-label="姓名"></label></td>
        <td><input data-field="phone" value="${escapeAttribute(guest.phone || '')}" aria-label="手機"></td>
        <td>
          <select data-field="attend_status">
            <option value="pending" ${guest.attend_status === 'pending' ? 'selected' : ''}>尚未確認</option>
            <option value="attending" ${guest.attend_status === 'attending' ? 'selected' : ''}>確認參加</option>
            <option value="declined" ${guest.attend_status === 'declined' ? 'selected' : ''}>不克參加</option>
          </select>
        </td>
        <td><input data-field="guest_count" type="number" min="1" max="10" value="${getGuestCount(guest)}" aria-label="人數"></td>
        <td>
          <select data-field="meal_type">
            <option value="葷食" ${guest.meal_type === '葷食' ? 'selected' : ''}>葷食</option>
            <option value="素食" ${guest.meal_type === '素食' ? 'selected' : ''}>素食</option>
          </select>
        </td>
        <td>
          <select data-field="group_name">
            ${['', '男方親友', '女方親友', '同事', '同學', '朋友', '其他'].map((item) => `<option value="${escapeAttribute(item)}" ${guest.group_name === item ? 'selected' : ''}>${item || '未分組'}</option>`).join('')}
          </select>
        </td>
        <td><input data-field="child_count" type="number" min="0" max="10" value="${Number(guest.child_count || 0)}" aria-label="兒童椅"></td>
        <td>
          <select data-field="hotel_needed">
            <option value="no" ${guest.hotel_needed === 'no' || !guest.hotel_needed ? 'selected' : ''}>不需要</option>
            <option value="yes" ${guest.hotel_needed === 'yes' ? 'selected' : ''}>需要</option>
            <option value="maybe" ${guest.hotel_needed === 'maybe' ? 'selected' : ''}>未確定</option>
          </select>
        </td>
        <td><input data-field="hotel_guest_count" type="number" min="0" max="10" value="${Number(guest.hotel_guest_count || 0)}" aria-label="住宿人數"></td>
        <td><input data-field="special_need" value="${escapeAttribute(guest.special_need || '')}" aria-label="特殊需求"></td>
        <td><input data-field="table_no" value="${escapeAttribute(guest.table_no || '')}" placeholder="例如 A1"></td>
        <td><input data-field="note" value="${escapeAttribute(guest.note || '')}" aria-label="備註"></td>
        <td>${formatDate(guest.created_at)}</td>
        <td><div class="row-actions"><button class="btn ghost" data-save>儲存</button><button class="btn danger" data-delete>刪除</button></div></td>
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

  function renderHotelNeeds() {
    const list = guests.filter((guest) => guest.hotel_needed === 'yes' || guest.hotel_needed === 'maybe');
    if (!list.length) {
      renderTableMessage(hotelTableBody, 7, '目前還沒有住宿需求。');
      return;
    }

    hotelTableBody.innerHTML = list.map((guest) => `
      <tr data-id="${guest.id}">
        <td>${escapeHtml(guest.name)}</td>
        <td>${escapeHtml(guest.phone || '')}</td>
        <td>
          <select data-hotel-field="hotel_needed">
            <option value="yes" ${guest.hotel_needed === 'yes' ? 'selected' : ''}>需要</option>
            <option value="maybe" ${guest.hotel_needed === 'maybe' ? 'selected' : ''}>未確定</option>
            <option value="no" ${guest.hotel_needed === 'no' ? 'selected' : ''}>不需要</option>
          </select>
        </td>
        <td><input data-hotel-field="hotel_guest_count" type="number" min="0" max="10" value="${Number(guest.hotel_guest_count || 0)}"></td>
        <td>${getGuestCount(guest)}</td>
        <td>${escapeHtml(guest.note || '')}</td>
        <td><button class="btn ghost" data-save-hotel>儲存</button></td>
      </tr>
    `).join('');
  }

  function renderSchedules() {
    if (!scheduleTableBody) return;
    if (!schedules.length) {
      renderTableMessage(scheduleTableBody, 4, '還沒有流程。先新增一個，讓時間慢慢排成婚禮的樣子。');
      return;
    }

    scheduleTableBody.innerHTML = schedules.map((item) => `
      <tr data-id="${item.id}">
        <td><input data-schedule-field="time" value="${escapeAttribute(item.time || '')}"></td>
        <td><input data-schedule-field="title" value="${escapeAttribute(item.title || '')}"></td>
        <td><input data-schedule-field="description" value="${escapeAttribute(item.description || '')}"></td>
        <td><div class="row-actions"><button class="btn ghost" data-save-schedule>儲存</button><button class="btn danger" data-delete-schedule>刪除</button></div></td>
      </tr>
    `).join('');
  }

  function renderBackups() {
    if (!backupTableBody) return;
    if (!backups.length) {
      renderTableMessage(backupTableBody, 4, '還沒有桌次備份。排桌前先存一版，很值得。');
      return;
    }

    backupTableBody.innerHTML = backups.map((backup) => `
      <tr data-id="${backup.id}">
        <td>${escapeHtml(backup.name || '')}</td>
        <td>${formatDate(backup.created_at)}</td>
        <td>${escapeHtml(backup.summary || '')}</td>
        <td><div class="row-actions"><button class="btn ghost" data-restore-backup>還原</button><button class="btn danger" data-delete-backup>刪除</button></div></td>
      </tr>
    `).join('');
  }

  function renderBudgets() {
    if (!budgetTableBody) return;
    const total = budgets.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = budgets.reduce((sum, item) => sum + getPaidAmount(item), 0);
    setBudgetStat('total', total);
    setBudgetStat('paid', paid);
    setBudgetStat('unpaid', Math.max(total - paid, 0));

    if (!budgets.length) {
      renderTableMessage(budgetTableBody, 10, '還沒有預算紀錄。先把最大的幾筆放進來，心裡會踏實很多。');
      return;
    }

    budgetTableBody.innerHTML = budgets.map((item) => `
      <tr data-id="${item.id}">
        <td><input data-budget-field="item_name" value="${escapeAttribute(item.item_name || '')}"></td>
        <td><input data-budget-field="vendor_name" value="${escapeAttribute(item.vendor_name || '')}"></td>
        <td><input data-budget-field="amount" type="number" min="0" value="${Number(item.amount || 0)}"></td>
        <td><input data-budget-field="paid_amount" type="number" min="0" value="${getPaidAmount(item)}"></td>
        <td>${Math.max(Number(item.amount || 0) - getPaidAmount(item), 0).toLocaleString('zh-TW')}</td>
        <td><input data-budget-field="payer" value="${escapeAttribute(item.payer || '')}"></td>
        <td><select data-budget-field="final_payment_method">${paymentMethodOptions(item.final_payment_method)}</select></td>
        <td><select data-budget-field="payment_status">${budgetStatusOptions(item.payment_status)}</select></td>
        <td><input data-budget-field="due_date" type="date" value="${escapeAttribute(item.due_date || '')}"></td>
        <td><div class="row-actions"><button class="btn ghost" data-save-budget>儲存</button><button class="btn danger" data-delete-budget>刪除</button></div></td>
      </tr>
    `).join('');
  }

  function renderVendors() {
    if (!vendorTableBody) return;
    if (!vendors.length) {
      renderTableMessage(vendorTableBody, 6, '還沒有廠商。先把場地、婚攝、主持放進來，之後找電話會快很多。');
      return;
    }

    vendorTableBody.innerHTML = vendors.map((item) => `
      <tr data-id="${item.id}">
        <td><input data-vendor-field="category" value="${escapeAttribute(item.category || '')}"></td>
        <td><input data-vendor-field="vendor_name" value="${escapeAttribute(item.vendor_name || '')}"></td>
        <td><input data-vendor-field="contact_name" value="${escapeAttribute(item.contact_name || '')}"></td>
        <td><input data-vendor-field="phone" value="${escapeAttribute(item.phone || '')}"></td>
        <td><input data-vendor-field="note" value="${escapeAttribute(item.note || '')}"></td>
        <td><div class="row-actions"><button class="btn ghost" data-save-vendor>儲存</button><button class="btn danger" data-delete-vendor>刪除</button></div></td>
      </tr>
    `).join('');
  }

  function renderWishes() {
    if (!wishTableBody) return;
    if (!wishes.length) {
      renderTableMessage(wishTableBody, 6, '還沒有祝福留言。等第一句話出現，這裡會變得很可愛。');
      return;
    }

    wishTableBody.innerHTML = wishes.map((wish) => `
      <tr data-id="${wish.id}">
        <td>${escapeHtml(wish.name || '')}</td>
        <td>${escapeHtml(wish.message || '')}</td>
        <td>${wish.is_public ? '公開' : '悄悄話'}</td>
        <td><select data-wish-field="is_approved"><option value="true" ${wish.is_approved ? 'selected' : ''}>通過</option><option value="false" ${!wish.is_approved ? 'selected' : ''}>隱藏</option></select></td>
        <td>${formatDate(wish.created_at)}</td>
        <td><div class="row-actions"><button class="btn ghost" data-save-wish>儲存</button><button class="btn danger" data-delete-wish>刪除</button></div></td>
      </tr>
    `).join('');
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
    const patch = readGuestPatchFromRow(row);

    saveButton.disabled = true;
    saveButton.textContent = '儲存中';
    clearNotice(notice);

    try {
      await updateGuest(id, patch);
      showNotice(notice, '資料已更新。', 'success');
    } catch (error) {
      showNotice(notice, `更新時發生問題：${friendlyDbError(error)}`, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '儲存';
    }
  }

  function readGuestPatchFromRow(row) {
    return {
      name: row.querySelector('[data-field="name"]').value.trim(),
      phone: sanitizePhone(row.querySelector('[data-field="phone"]').value),
      attend_status: row.querySelector('[data-field="attend_status"]').value,
      guest_count: Number(row.querySelector('[data-field="guest_count"]').value || 1),
      meal_type: row.querySelector('[data-field="meal_type"]').value,
      group_name: row.querySelector('[data-field="group_name"]').value || null,
      child_count: Number(row.querySelector('[data-field="child_count"]').value || 0),
      hotel_needed: row.querySelector('[data-field="hotel_needed"]').value,
      hotel_guest_count: Number(row.querySelector('[data-field="hotel_guest_count"]').value || 0),
      special_need: row.querySelector('[data-field="special_need"]').value.trim(),
      table_no: row.querySelector('[data-field="table_no"]').value.trim() || null,
      note: row.querySelector('[data-field="note"]').value.trim()
    };
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

  async function deleteGuest(id) {
    const guest = guests.find((item) => item.id === id);
    if (!guest) return;

    const confirmed = window.confirm(`確定要刪除「${guest.name}」的報名資料嗎？這個動作無法復原。`);
    if (!confirmed) return;

    clearNotice(notice);
    setLoading(spinner, true);

    try {
      const { error } = await weddingSupabase
        .from('guests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      guests = guests.filter((item) => item.id !== id);
      window.guests = guests;
      showNotice(notice, '已刪除這筆報名資料。', 'success');
      renderAll();
    } catch (error) {
      showNotice(notice, `刪除時發生問題：${friendlyDbError(error)}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
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

  async function saveHotel(row) {
    const id = Number(row.dataset.id);
    await updateGuest(id, {
      hotel_needed: row.querySelector('[data-hotel-field="hotel_needed"]').value,
      hotel_guest_count: Number(row.querySelector('[data-hotel-field="hotel_guest_count"]').value || 0)
    });
    showNotice(notice, '住宿需求已更新。', 'success');
  }

  async function createSchedule(event) {
    event.preventDefault();
    const formData = new FormData(scheduleForm);
    const payload = {
      time: String(formData.get('time') || '').trim(),
      title: String(formData.get('title') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      sort_order: schedules.length + 1
    };
    if (!payload.time || !payload.title) return;
    const { error } = await weddingSupabase.from('wedding_schedule').insert([payload]);
    if (error) throw error;
    scheduleForm.reset();
    await loadSchedules();
  }

  async function saveSchedule(row) {
    const id = Number(row.dataset.id);
    const patch = {
      time: row.querySelector('[data-schedule-field="time"]').value.trim(),
      title: row.querySelector('[data-schedule-field="title"]').value.trim(),
      description: row.querySelector('[data-schedule-field="description"]').value.trim()
    };
    await updateRow('wedding_schedule', id, patch);
    await loadSchedules();
  }

  async function createBackup() {
    const name = backupNameInput.value.trim() || `桌次備份 ${new Date().toLocaleString('zh-TW')}`;
    const assigned = guests.filter((guest) => guest.table_no);
    const payload = {
      name,
      snapshot: assigned.map((guest) => ({ id: guest.id, name: guest.name, table_no: guest.table_no })),
      summary: `${assigned.length} 筆已排桌，${getTableNames(assigned).length} 桌`
    };
    const { error } = await weddingSupabase.from('seating_backups').insert([payload]);
    if (error) throw error;
    backupNameInput.value = '';
    await loadBackups();
    showNotice(notice, '已儲存目前桌次版本。', 'success');
  }

  async function restoreBackup(row) {
    const backup = backups.find((item) => item.id === Number(row.dataset.id));
    if (!backup || !Array.isArray(backup.snapshot)) return;
    if (!window.confirm(`確定要還原「${backup.name}」嗎？目前桌次會被這份備份覆蓋。`)) return;

    setLoading(spinner, true);
    try {
      for (const item of backup.snapshot) {
        await weddingSupabase.from('guests').update({ table_no: item.table_no || null }).eq('id', item.id);
      }
      await loadGuests();
      showNotice(notice, '桌次已還原。', 'success');
    } finally {
      setLoading(spinner, false);
    }
  }

  async function createBudget(event) {
    event.preventDefault();
    clearNotice(notice);
    setLoading(spinner, true);

    if (!weddingSupabase) {
      setLoading(spinner, false);
      showNotice(notice, '尚未設定 Supabase，不能新增預算。', 'error');
      return;
    }

    const data = new FormData(budgetForm);
    const payload = {
      item_name: String(data.get('item_name') || '').trim(),
      vendor_name: String(data.get('vendor_name') || '').trim(),
      amount: Number(data.get('amount') || 0),
      paid_amount: Number(data.get('paid_amount') || 0),
      payer: String(data.get('payer') || '').trim(),
      final_payment_method: data.get('final_payment_method') || null,
      payment_status: data.get('payment_status'),
      due_date: data.get('due_date') || null
    };

    if (!payload.item_name) {
      setLoading(spinner, false);
      showNotice(notice, '請先填寫預算項目名稱。', 'error');
      return;
    }

    try {
      const { data: inserted, error } = await weddingSupabase
        .from('wedding_budgets')
        .insert([payload])
        .select('*')
        .single();

      if (error) throw error;

      budgetForm.reset();
      budgets = inserted ? [inserted, ...budgets] : budgets;
      renderBudgets();
      showNotice(notice, '預算項目已新增。', 'success');
    } finally {
      setLoading(spinner, false);
    }
  }

  async function saveBudget(row) {
    const id = Number(row.dataset.id);
    await updateRow('wedding_budgets', id, {
      item_name: row.querySelector('[data-budget-field="item_name"]').value.trim(),
      vendor_name: row.querySelector('[data-budget-field="vendor_name"]').value.trim(),
      amount: Number(row.querySelector('[data-budget-field="amount"]').value || 0),
      paid_amount: Number(row.querySelector('[data-budget-field="paid_amount"]').value || 0),
      payer: row.querySelector('[data-budget-field="payer"]').value.trim(),
      final_payment_method: row.querySelector('[data-budget-field="final_payment_method"]').value || null,
      payment_status: row.querySelector('[data-budget-field="payment_status"]').value,
      due_date: row.querySelector('[data-budget-field="due_date"]').value || null
    });
    await loadBudgets();
  }

  async function createVendor(event) {
    event.preventDefault();
    const data = new FormData(vendorForm);
    const payload = {
      category: String(data.get('category') || '').trim(),
      vendor_name: String(data.get('vendor_name') || '').trim(),
      contact_name: String(data.get('contact_name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      note: String(data.get('note') || '').trim()
    };
    if (!payload.category || !payload.vendor_name) return;
    const { error } = await weddingSupabase.from('wedding_vendors').insert([payload]);
    if (error) throw error;
    vendorForm.reset();
    await loadVendors();
  }

  async function saveVendor(row) {
    const id = Number(row.dataset.id);
    await updateRow('wedding_vendors', id, {
      category: row.querySelector('[data-vendor-field="category"]').value.trim(),
      vendor_name: row.querySelector('[data-vendor-field="vendor_name"]').value.trim(),
      contact_name: row.querySelector('[data-vendor-field="contact_name"]').value.trim(),
      phone: row.querySelector('[data-vendor-field="phone"]').value.trim(),
      note: row.querySelector('[data-vendor-field="note"]').value.trim()
    });
    await loadVendors();
  }

  async function saveWish(row) {
    const id = Number(row.dataset.id);
    await updateRow('wishes', id, {
      is_approved: row.querySelector('[data-wish-field="is_approved"]').value === 'true'
    });
    await loadWishes();
  }

  async function updateRow(table, id, patch) {
    const { error } = await weddingSupabase.from(table).update(patch).eq('id', id);
    if (error) throw error;
    showNotice(notice, '資料已更新。', 'success');
  }

  async function deleteRow(table, id, reloadFn, label = '資料') {
    if (!window.confirm(`確定要刪除這筆${label}嗎？`)) return;
    const { error } = await weddingSupabase.from(table).delete().eq('id', id);
    if (error) throw error;
    await reloadFn();
    showNotice(notice, '已刪除。', 'success');
  }

  function exportScheduleCsv() {
    const header = ['時間', '流程', '說明'];
    const csv = [header, ...schedules.map((item) => [item.time || '', item.title || '', item.description || ''])]
      .map((row) => row.map(csvCell).join(','))
      .join('\n');
    downloadFile('yu-134-schedule.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8');
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
      hotel_needed: translateHotelNeed(guest.hotel_needed),
      hotel_guest_count: Number(guest.hotel_guest_count || 0),
      special_need: guest.special_need || '',
      table_no: guest.table_no || '',
      note: guest.note || '',
      created_at: formatDate(guest.created_at)
    }));
    const header = ['姓名', '手機', '出席狀態', '人數', '餐點', '分組', '兒童椅', '住宿需求', '住宿人數', '特殊需求', '桌號', '備註', '建立時間'];

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
          <tr>${isPublic ? '<th>姓名</th><th>桌號</th>' : '<th>姓名</th><th>人數</th><th>餐點</th><th>分組</th><th>特殊需求</th><th>住宿</th><th>備註</th>'}</tr>
            ${list.map((guest) => isPublic
              ? `<tr><td>${escapeHtml(guest.name)}</td><td>${escapeHtml(tableNo)}</td></tr>`
              : `<tr><td>${escapeHtml(guest.name)}</td><td>${getGuestCount(guest)}</td><td>${escapeHtml(guest.meal_type || '')}</td><td>${escapeHtml(guest.group_name || '')}</td><td>${escapeHtml(guest.special_need || '')}</td><td>${escapeHtml(formatHotelText(guest))}</td><td>${escapeHtml(guest.note || '')}</td></tr>`
            ).join('')}
          </table>
        </section>
      `;
    }).join('');

    const unassignedHtml = !isPublic && unassigned.length ? `
      <section class="print-table">
        <h2>未排桌</h2>
        <table>
          <tr><th>姓名</th><th>人數</th><th>餐點</th><th>分組</th><th>住宿</th><th>備註</th></tr>
          ${unassigned.map((guest) => `<tr><td>${escapeHtml(guest.name)}</td><td>${getGuestCount(guest)}</td><td>${escapeHtml(guest.meal_type || '')}</td><td>${escapeHtml(guest.group_name || '')}</td><td>${escapeHtml(formatHotelText(guest))}</td><td>${escapeHtml(guest.note || '')}</td></tr>`).join('')}
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
    const deleteButton = event.target.closest('[data-delete]');
    if (saveButton) {
      saveGuest(saveButton.closest('tr'), saveButton);
      return;
    }
    if (deleteButton) {
      deleteGuest(Number(deleteButton.closest('tr').dataset.id));
    }
  });

  hotelTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-hotel]');
    if (!button) return;
    try {
      await saveHotel(button.closest('tr'));
    } catch (error) {
      showNotice(notice, `住宿資料更新失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  scheduleForm.addEventListener('submit', async (event) => {
    try {
      await createSchedule(event);
      showNotice(notice, '流程已新增。', 'success');
    } catch (error) {
      showNotice(notice, `流程新增失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  scheduleTableBody.addEventListener('click', async (event) => {
    const row = event.target.closest('tr');
    if (!row) return;
    try {
      if (event.target.closest('[data-save-schedule]')) await saveSchedule(row);
      if (event.target.closest('[data-delete-schedule]')) await deleteRow('wedding_schedule', Number(row.dataset.id), loadSchedules, '流程');
    } catch (error) {
      showNotice(notice, `流程更新失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  createBackupButton.addEventListener('click', async () => {
    try {
      await createBackup();
    } catch (error) {
      showNotice(notice, `桌次備份失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  backupTableBody.addEventListener('click', async (event) => {
    const row = event.target.closest('tr');
    if (!row) return;
    try {
      if (event.target.closest('[data-restore-backup]')) await restoreBackup(row);
      if (event.target.closest('[data-delete-backup]')) await deleteRow('seating_backups', Number(row.dataset.id), loadBackups, '桌次備份');
    } catch (error) {
      showNotice(notice, `桌次備份操作失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  budgetForm.addEventListener('submit', async (event) => {
    try {
      await createBudget(event);
    } catch (error) {
      showNotice(notice, `預算新增失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  budgetTableBody.addEventListener('click', async (event) => {
    const row = event.target.closest('tr');
    if (!row) return;
    try {
      if (event.target.closest('[data-save-budget]')) await saveBudget(row);
      if (event.target.closest('[data-delete-budget]')) await deleteRow('wedding_budgets', Number(row.dataset.id), loadBudgets, '預算');
    } catch (error) {
      showNotice(notice, `預算更新失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  vendorForm.addEventListener('submit', async (event) => {
    try {
      await createVendor(event);
      showNotice(notice, '廠商已新增。', 'success');
    } catch (error) {
      showNotice(notice, `廠商新增失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  vendorTableBody.addEventListener('click', async (event) => {
    const row = event.target.closest('tr');
    if (!row) return;
    try {
      if (event.target.closest('[data-save-vendor]')) await saveVendor(row);
      if (event.target.closest('[data-delete-vendor]')) await deleteRow('wedding_vendors', Number(row.dataset.id), loadVendors, '廠商');
    } catch (error) {
      showNotice(notice, `廠商更新失敗：${friendlyDbError(error)}`, 'error');
    }
  });

  wishTableBody.addEventListener('click', async (event) => {
    const row = event.target.closest('tr');
    if (!row) return;
    try {
      if (event.target.closest('[data-save-wish]')) await saveWish(row);
      if (event.target.closest('[data-delete-wish]')) await deleteRow('wishes', Number(row.dataset.id), loadWishes, '留言');
    } catch (error) {
      showNotice(notice, `留言更新失敗：${friendlyDbError(error)}`, 'error');
    }
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
  exportScheduleButton.addEventListener('click', exportScheduleCsv);
  batchAssignButton.addEventListener('click', batchAssign);
  printSeatingButton.addEventListener('click', () => printSeating('full'));
  printPublicButton.addEventListener('click', () => printSeating('public'));
});

function getGuestCount(guest) {
  return Number(guest.guest_count || 1);
}

function getPaidAmount(item) {
  if (item.payment_status === 'paid') return Number(item.amount || 0);
  return Number(item.paid_amount || 0);
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

function translateHotelNeed(value) {
  const labels = {
    yes: '需要',
    maybe: '未確定',
    no: '不需要'
  };

  return labels[value] || '不需要';
}

function formatHotelText(guest) {
  const label = translateHotelNeed(guest.hotel_needed);
  const count = Number(guest.hotel_guest_count || 0);
  return count > 0 ? `${label}，${count} 人` : label;
}

function budgetStatusOptions(current) {
  const options = [
    ['unpaid', '未付款'],
    ['deposit', '已付訂金'],
    ['paid', '已付清']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
}

function paymentMethodOptions(current) {
  const options = [
    ['', '未定'],
    ['card', '刷卡'],
    ['transfer', '轉帳'],
    ['cash', '現金']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
}

function setBudgetStat(name, value) {
  const item = document.querySelector(`[data-budget-stat="${name}"]`);
  if (item) item.textContent = Number(value || 0).toLocaleString('zh-TW');
}

function renderTableMessage(body, colspan, message) {
  if (!body) return;
  body.innerHTML = `<tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

function friendlyDbError(error) {
  if (String(error.message || '').includes('group_name')
    || String(error.message || '').includes('child_count')
    || String(error.message || '').includes('hotel_needed')
    || String(error.message || '').includes('hotel_guest_count')
    || String(error.message || '').includes('special_need')
    || String(error.message || '').includes('paid_amount')
    || String(error.message || '').includes('payer')
    || String(error.message || '').includes('final_payment_method')
    || String(error.message || '').includes('wishes')
    || String(error.message || '').includes('wedding_schedule')
    || String(error.message || '').includes('seating_backups')
    || String(error.message || '').includes('wedding_budgets')
    || String(error.message || '').includes('wedding_vendors')) {
    return `${error.message}。請先依 README 建立或更新需要的資料表。`;
  }

  return error.message;
}
