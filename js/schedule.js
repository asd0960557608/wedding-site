document.addEventListener('DOMContentLoaded', async () => {
  const timeline = document.querySelector('[data-schedule-list]');
  if (!timeline || !weddingSupabase) return;

  try {
    const { data, error } = await weddingSupabase
      .from('wedding_schedule')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('time', { ascending: true });

    if (error || !data || !data.length) return;

    timeline.innerHTML = data.map((item) => `
      <article class="timeline-item reveal visible">
        <div class="timeline-time">${escapeHtml(item.time || '')}</div>
        <div><h3>${escapeHtml(item.title || '')}</h3><p>${escapeHtml(item.description || '')}</p></div>
      </article>
    `).join('');
  } catch {
    // Keep the static schedule if the editable schedule is not ready yet.
  }
});
