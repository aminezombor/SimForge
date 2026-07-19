const { app, BrowserWindow } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const outputDirectory = path.resolve(__dirname, '..', 'assets', 'brand');

function iconFile(images) {
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = headerSize;
  images.forEach(({ size, bytes }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(({ bytes }) => bytes)]);
}

async function generate() {
  const { CubeFocus } = await import('@phosphor-icons/react');
  await mkdir(outputDirectory, { recursive: true });
  const glyph = renderToStaticMarkup(React.createElement(CubeFocus, {
    color: '#68efcc',
    size: 156,
    weight: 'duotone',
  }));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { width: 256px; height: 256px; margin: 0; overflow: hidden; background: transparent; }
    body { display: grid; place-items: center; }
    .mark { width: 220px; height: 220px; display: grid; place-items: center; border: 4px solid #2a655a; border-radius: 56px; background: #102d2c; }
    svg { display: block; }
  </style></head><body><div class="mark">${glyph}</div></body></html>`;
  const window = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: true,
    },
  });
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const source = await window.webContents.capturePage();
  const png = source.toPNG();
  await writeFile(path.join(outputDirectory, 'simforge-icon.png'), png);
  await writeFile(path.join(outputDirectory, 'simforge-icon.ico'), iconFile([{ size: 256, bytes: png }]));
  window.destroy();
}

app.disableHardwareAcceleration();
app.whenReady().then(generate).then(() => app.quit()).catch((error) => {
  console.error(error);
  app.exit(1);
});
