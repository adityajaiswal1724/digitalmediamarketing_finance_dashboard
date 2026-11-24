export const dateLabel = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const monthLabel = (d: string) =>
  new Date(d + '-01T12:00:00').toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
