document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#wishForm');
  const wall = document.querySelector('#wishWall');
  const notice = document.querySelector('#wishNotice');
  const spinner = document.querySelector('#wishSpinner');

  if (!form) return;

  loadWishes();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearNotice(notice);

    if (!weddingSupabase) {
      showNotice(notice, '尚未設定 Supabase，暫時不能送出祝福。', 'error');
      return;
    }

    setLoading(spinner, true);
    const formData = new FormData(form);
    const wish = {
      name: String(formData.get('name') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      is_public: formData.get('is_public') === 'true',
      is_approved: formData.get('is_public') === 'true'
    };

    if (!wish.name || !wish.message) {
      setLoading(spinner, false);
      showNotice(notice, '名字和留言都要寫，這樣祝福才找得到主人。', 'error');
      return;
    }

    try {
      const { error } = await weddingSupabase.from('wishes').insert([wish]);
      if (error) throw error;
      form.reset();
      showNotice(notice, wish.is_public ? '收到你的祝福了，留言牆又亮了一點。' : '收到你的悄悄話了，我們會好好收著。', 'success');
      loadWishes();
    } catch (error) {
      showNotice(notice, `送出祝福時發生問題：${friendlyWishError(error)}`, 'error');
    } finally {
      setLoading(spinner, false);
    }
  });

  async function loadWishes() {
    if (!weddingSupabase) {
      wall.innerHTML = '<p class="muted-text">設定 Supabase 後，祝福會出現在這裡。</p>';
      return;
    }

    try {
      const { data, error } = await weddingSupabase
        .from('wishes')
        .select('*')
        .eq('is_public', true)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) throw error;
      wall.innerHTML = data && data.length
        ? data.map((wish) => `
          <article class="wish-card">
            <p>${escapeHtml(wish.message)}</p>
            <strong>${escapeHtml(wish.name)}</strong>
          </article>
        `).join('')
        : '<p class="muted-text">還沒有人留言。你可以當第一個，把祝福放進來。</p>';
    } catch (error) {
      wall.innerHTML = `<p class="muted-text">祝福讀取失敗：${escapeHtml(friendlyWishError(error))}</p>`;
    }
  }
});

function friendlyWishError(error) {
  const message = String(error.message || '');
  if (message.includes('wishes')) {
    return `${message}。請先依 README 建立 wishes 資料表。`;
  }

  return message;
}
