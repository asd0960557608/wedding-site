document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#guestTableBody');
  const searchInput = document.querySelector('#adminSearch');
  const refreshButton = document.querySelector('#refreshGuests');
  const notice = document.querySelector('#adminNotice');
  const spinner = document.querySelector('#adminSpinner');

  if (!tableBody) return;

  let guests = [];

  async function loadGuests() {
    clearNotice(notice);
    setLoading(spinner, true);

    try {
      const { data, error } = await weddingSupabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      guests = data || [];
      renderGuests();
    } catch (error) {
      showNotice(notice, `讀取資料時發生問題：${error.message}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  }

  function renderGuests() {
    const keyword = String(searchInput.value || '').trim().toLowerCase();
    const filtered = guests.filter((guest) => {
      return [guest.name, guest.phone, guest.table_no, guest.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });

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
            <option value="attending" ${guest.attend_status === 'attending' ? 'selected' : ''}>確認出席</option>
            <option value="declined" ${guest.attend_status === 'declined' ? 'selected' : ''}>不克出席</option>
          </select>
        </td>
        <td>${Number(guest.guest_count || 1)}</td>
        <td>${escapeHtml(guest.meal_type || '')}</td>
        <td><input data-field="table_no" value="${escapeAttribute(guest.table_no || '')}" placeholder="桌號"></td>
        <td>${escapeHtml(guest.note || '')}</td>
        <td>${formatDate(guest.created_at)}</td>
        <td><button class="btn ghost" data-save>儲存</button></td>
      </tr>
    `).join('');
  }

  tableBody.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('[data-save]');
    if (!saveButton) return;

    const row = saveButton.closest('tr');
    const id = row.dataset.id;
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

      guests = guests.map((guest) => guest.id === Number(id)
        ? { ...guest, attend_status: attendStatus, table_no: tableNo }
        : guest);
      showNotice(notice, '資料已更新。', 'success');
      renderGuests();
    } catch (error) {
      showNotice(notice, `更新時發生問題：${error.message}`, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '儲存';
    }
  });

  searchInput.addEventListener('input', renderGuests);
  refreshButton.addEventListener('click', loadGuests);

  loadGuests();
});

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
