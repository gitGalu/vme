function canvasBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image conversion failed.')), 'image/png')); }

export async function pngImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasBlob(canvas);
  } finally { URL.revokeObjectURL(url); }
}

export async function placeholderImage(title, platform) {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
  const context = canvas.getContext('2d');
  context.fillStyle = '#142337'; context.fillRect(0, 0, 640, 480);
  context.fillStyle = '#1c3754'; context.fillRect(0, 0, 640, 88);
  context.fillStyle = '#8bbaff'; context.font = 'bold 24px system-ui'; context.fillText(platform.toUpperCase(), 36, 60);
  context.fillStyle = '#eff6ff'; context.font = 'bold 38px system-ui';
  const words = title.split(/\s+/); const lines = []; let line = '';
  for (const word of words) {
    if (line && context.measureText(line + ' ' + word).width > 560) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  lines.slice(0, 5).forEach((text, index) => context.fillText(text, 36, 166 + index * 49, 560));
  context.font = 'bold 20px system-ui'; context.fillStyle = '#7f9bbf'; context.fillText('VM/E', 36, 442);
  return canvasBlob(canvas);
}
