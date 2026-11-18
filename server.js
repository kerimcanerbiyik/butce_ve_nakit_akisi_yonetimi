import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const KLASOR = import.meta.dirname;
const VERI_DOSYASI = path.join(KLASOR, 'butce_verileri.json');

async function verileriOku() {
  try {
    const icerik = await fs.readFile(VERI_DOSYASI, 'utf8');
    return JSON.parse(icerik);
  } catch {
    return [];
  }
}

async function verileriYaz(veri) {
  await fs.writeFile(VERI_DOSYASI, JSON.stringify(veri, null, 2), 'utf8');
}

const sunucu = http.createServer(async (req, res) => {
  // API: Tüm işlemleri getir
  if (req.url === '/api/islemler' && req.method === 'GET') {
    const liste = await verileriOku();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(liste));
    return;
  }

  // API: Yeni gelir/gider ekle
  if (req.url === '/api/islemler' && req.method === 'POST') {
    let govde = '';
    req.on('data', parca => govde += parca.toString());
    req.on('end', async () => {
      const yeni = JSON.parse(govde);
      yeni.id = crypto.randomUUID();
      const liste = await verileriOku();
      liste.push(yeni);
      await verileriYaz(liste);

      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(yeni));
    });
    return;
  }

  // API: İşlem sil
  if (req.url.startsWith('/api/islemler/') && req.method === 'DELETE') {
    const id = req.url.split('/').pop();
    const liste = await verileriOku();
    const guncel = liste.filter(item => item.id !== id);
    await verileriYaz(guncel);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ silindi: true }));
    return;
  }

  // Statik dosya sunumu
  if (req.method === 'GET') {
    const dosyaAdi = req.url === '/' ? 'index.html' : req.url;
    const tamYol = path.join(KLASOR, dosyaAdi);
    const uzanti = path.extname(tamYol);

    const tipler = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    };

    try {
      const icerik = await fs.readFile(tamYol);
      res.writeHead(200, { 'Content-Type': tipler[uzanti] || 'text/plain' });
      res.end(icerik);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Sayfa Bulunamadi');
    }
  }
});

const PORT = process.env.PORT || 3000;
sunucu.listen(PORT, '0.0.0.0', () => {
  console.log(`Bütçe Takip Sistemi aktif: http://localhost:${PORT}`);
});
