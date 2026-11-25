const canvases = document.querySelectorAll("[data-dither-canvas]");

for (const canvas of canvases) {
  const image = new Image();
  image.src = canvas.dataset.src ?? "";
  image.addEventListener("load", () => renderDither(canvas, image));
}

function renderDither(canvas, image) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = Math.min(image.naturalWidth, 960);
  const height = Math.round(image.naturalHeight * width / image.naturalWidth);
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);

  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return;
  sourceContext.drawImage(image, 0, 0, width, height);

  const pixels = sourceContext.getImageData(0, 0, width, height).data;
  const cell = Math.max(3, Math.round(width / 150));
  // Dark theme: draw lilac dots on the dark canvas. Brighter pixels get bigger dots.
  const lilac = getComputedStyle(document.documentElement).getPropertyValue("--lilac").trim() || "#b79cff";
  context.fillStyle = lilac;
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const offset = (y * width + x) * 4;
      const luminance = (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
      const radius = luminance * cell * 0.48;
      if (radius < 0.35) continue;
      context.beginPath();
      context.arc(x + cell / 2, y + cell / 2, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}
