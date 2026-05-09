document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#rsvpForm');
  const lookupButton = document.querySelector('#lookupRegistration');
  const notice = document.querySelector('#formNotice');
  const spinner = document.querySelector('#formSpinner');
  const submitButton = document.querySelector('#submitRegistration');
  const modeInput = document.querySelector('#registrationMode');
  const guestIdInput = document.querySelector('#guestId');
  const deadlineText = document.querySelector('#deadlineText');

  if (!form) return;

  if (deadlineText) {
    deadlineText.textContent = '報名與修改截止日：2027 年 2 月 28 日 23:59';
  }

  if (isRegistrationClosed()) {
    submitButton.disabled = true;
    submitButton.textContent = '報名已截止';
    showNotice(notice, '報名與修改已於 2027 年 2 月 28 日截止，若有異動請直接聯絡新人。', 'error');
  }

  lookupButton.addEventListener('click', async () => {
    clearNotice(notice);
    setLoading(spinner, true);

    const name = form.name.value.trim();
    const phone = sanitizePhone(form.phone.value);

    if (!name || !phone) {
      setLoading(spinner, false);
      showNotice(notice, '請先輸入姓名與手機，才能查詢既有登記。', 'error');
      return;
    }

    try {
      if (!weddingSupabase) {
        showNotice(notice, '尚未設定 Supabase URL 與 API Key，請先完成 js/supabase.js 設定。', 'error');
        return;
      }

      const { data, error } = await weddingSupabase
        .from('guests')
        .select('*')
        .eq('phone', phone)
        .ilike('name', name)
        .limit(1);

      if (error) throw error;

      if (!data || !data.length) {
        modeInput.value = 'create';
        guestIdInput.value = '';
        submitButton.textContent = '送出登記';
        showNotice(notice, '目前查無既有登記。你可以直接填寫並送出新的報名資料。', 'error');
        return;
      }

      const guest = data[0];
      form.attend_status.value = guest.attend_status || 'pending';
      form.guest_count.value = guest.guest_count || 1;
      form.meal_type.value = guest.meal_type || '葷食';
      form.group_name.value = guest.group_name || '';
      form.child_count.value = guest.child_count || 0;
      form.special_need.value = guest.special_need || '';
      form.note.value = guest.note || '';
      guestIdInput.value = guest.id;
      modeInput.value = 'update';
      submitButton.textContent = '更新登記';
      showNotice(notice, '已帶入你的既有登記資料，可修改後送出更新。', 'success');
    } catch (error) {
      showNotice(notice, `查詢時發生問題：${error.message}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearNotice(notice);

    if (isRegistrationClosed()) {
      showNotice(notice, '報名與修改已截止，若有異動請直接聯絡新人。', 'error');
      return;
    }

    setLoading(spinner, true);

    if (!weddingSupabase) {
      setLoading(spinner, false);
      showNotice(notice, '尚未設定 Supabase URL 與 API Key，請先完成 js/supabase.js 設定。', 'error');
      return;
    }

    const formData = new FormData(form);
    const guest = {
      name: String(formData.get('name') || '').trim(),
      phone: sanitizePhone(formData.get('phone')),
      attend_status: formData.get('attend_status'),
      guest_count: Number(formData.get('guest_count') || 1),
      meal_type: formData.get('meal_type'),
      group_name: formData.get('group_name') || null,
      child_count: Number(formData.get('child_count') || 0),
      special_need: String(formData.get('special_need') || '').trim(),
      note: String(formData.get('note') || '').trim()
    };

    if (!guest.name || !guest.phone || !guest.attend_status) {
      setLoading(spinner, false);
      showNotice(notice, '請確認姓名、手機與參加狀態都已填寫。', 'error');
      return;
    }

    try {
      const guestId = guestIdInput.value;
      const mode = modeInput.value;
      const query = mode === 'update' && guestId
        ? weddingSupabase.from('guests').update(guest).eq('id', guestId)
        : weddingSupabase.from('guests').insert([guest]);

      const { error } = await query;

      if (error) throw error;

      form.reset();
      guestIdInput.value = '';
      modeInput.value = 'create';
      submitButton.textContent = '送出登記';
      showNotice(notice, mode === 'update'
        ? '已更新您的報名登記，謝謝您。'
        : '已收到您的報名登記，謝謝您把這一天留給我們。', 'success');
    } catch (error) {
      showNotice(notice, `送出時發生問題：${friendlyRegistrationError(error)}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  });
});

function friendlyRegistrationError(error) {
  const message = String(error.message || '');
  if (message.includes('group_name') || message.includes('child_count') || message.includes('special_need')) {
    return `${message}。請先依 README 執行欄位 migration。`;
  }

  return message;
}
