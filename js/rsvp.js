document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#rsvpForm');
  const notice = document.querySelector('#formNotice');
  const spinner = document.querySelector('#formSpinner');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearNotice(notice);
    setLoading(spinner, true);

    const formData = new FormData(form);
    const guest = {
      name: String(formData.get('name') || '').trim(),
      phone: sanitizePhone(formData.get('phone')),
      attend_status: formData.get('attend_status'),
      guest_count: Number(formData.get('guest_count') || 1),
      meal_type: formData.get('meal_type'),
      note: String(formData.get('note') || '').trim()
    };

    if (!guest.name || !guest.phone || !guest.attend_status) {
      setLoading(spinner, false);
      showNotice(notice, '請確認姓名、手機與參加狀態都已填寫。', 'error');
      return;
    }

    try {
      const { error } = await weddingSupabase
        .from('guests')
        .insert([guest]);

      if (error) throw error;

      form.reset();
      showNotice(notice, '已收到您的報名登記，謝謝您把這一天留給我們。', 'success');
    } catch (error) {
      showNotice(notice, `送出時發生問題：${error.message}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  });
});
