document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#seatingForm');
  const queryInput = document.querySelector('#seatingQuery');
  const notice = document.querySelector('#seatingNotice');
  const spinner = document.querySelector('#seatingSpinner');
  const result = document.querySelector('#seatingResult');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearNotice(notice);
    result.classList.remove('show');
    setLoading(spinner, true);

    const keyword = String(queryInput.value || '').trim();
    const phone = sanitizePhone(keyword);

    if (!keyword) {
      setLoading(spinner, false);
      showNotice(notice, '請輸入姓名或手機號碼。', 'error');
      return;
    }

    if (!weddingSupabase) {
      setLoading(spinner, false);
      showNotice(notice, '尚未設定 Supabase URL 與 API Key，請先完成 js/supabase.js 設定。', 'error');
      return;
    }

    try {
      const { data, error } = await weddingSupabase
        .from('guests')
        .select('name, phone, attend_status, table_no, note')
        .or(`name.ilike.%${keyword}%,phone.eq.${phone}`)
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        showNotice(notice, '目前查無資料，請確認輸入內容或聯絡新人。', 'error');
        return;
      }

      const guest = data[0];
      result.querySelector('[data-result-name]').textContent = guest.name || '賓客';
      result.querySelector('[data-result-table]').textContent = guest.table_no || '尚未安排';
      result.querySelector('[data-result-status]').textContent = translateStatus(guest.attend_status);
      result.querySelector('[data-result-note]').textContent = guest.note || '婚禮當天請依現場接待指引入座。';
      result.classList.add('show');
    } catch (error) {
      showNotice(notice, `查詢時發生問題：${error.message}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  });
});
