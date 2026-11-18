let islemler = [];
let aylikLimit = Number(localStorage.getItem('aylikLimit')) || 0;

const form = document.querySelector('#islemFormu');
const tarihInput = document.querySelector('#tarih');
const listeBody = document.querySelector('#islemListesi');
const filtreTip = document.querySelector('#filtreTip');
const filtreAra = document.querySelector('#filtreAra');
const canvas = document.querySelector('#kategoriGrafik');
const ctx = canvas.getContext('2d');

tarihInput.value = new Date().toISOString().split('T')[0];
if (aylikLimit > 0) {
  document.querySelector('#limitInput').value = aylikLimit;
}

function paraFormatla(sayi) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  }).format(sayi);
}

async function verileriYukle() {
  const yanit = await fetch('/api/islemler');
  islemler = await yanit.json();
  arayuzuGuncelle();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const yeniIslem = {
    tip: document.querySelector('#tip').value,
    kategori: document.querySelector('#kategori').value,
    aciklama: document.querySelector('#aciklama').value.trim(),
    tutar: parseFloat(document.querySelector('#tutar').value),
    tarih: tarihInput.value
  };

  const yanit = await fetch('/api/islemler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(yeniIslem)
  });

  if (yanit.ok) {
    document.querySelector('#aciklama').value = '';
    document.querySelector('#tutar').value = '';
    await verileriYukle();
  }
});

async function islemSil(id) {
  const yanit = await fetch(`/api/islemler/${id}`, { method: 'DELETE' });
  if (yanit.ok) {
    await verileriYukle();
  }
}

document.querySelector('#btnLimitKaydet').addEventListener('click', () => {
  const deger = parseFloat(document.querySelector('#limitInput').value);
  if (!isNaN(deger) && deger >= 0) {
    aylikLimit = deger;
    localStorage.setItem('aylikLimit', String(aylikLimit));
    arayuzuGuncelle();
  }
});

document.querySelector('#btnRaporIndir').addEventListener('click', () => {
  const icerik = JSON.stringify(islemler, null, 2);
  const blob = new Blob([icerik], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `butce_raporu_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

filtreTip.addEventListener('change', arayuzuGuncelle);
filtreAra.addEventListener('input', arayuzuGuncelle);

function hesaplamalariYap() {
  const toplamGelir = islemler
    .filter(i => i.tip === 'gelir')
    .reduce((toplam, i) => toplam + i.tutar, 0);

  const toplamGider = islemler
    .filter(i => i.tip === 'gider')
    .reduce((toplam, i) => toplam + i.tutar, 0);

  const netBakiye = toplamGelir - toplamGider;
  const tasarrufOrani = toplamGelir > 0
    ? Math.max(0, Math.round(((toplamGelir - toplamGider) / toplamGelir) * 100))
    : 0;

  document.querySelector('#toplamGelir').textContent = paraFormatla(toplamGelir);
  document.querySelector('#toplamGider').textContent = paraFormatla(toplamGider);

  const bakiyeEl = document.querySelector('#netBakiye');
  bakiyeEl.textContent = paraFormatla(netBakiye);
  bakiyeEl.className = 'tutar ' + (netBakiye >= 0 ? 'gelir-renk' : 'gider-renk');

  document.querySelector('#tasarrufOrani').textContent = `%${tasarrufOrani}`;

  const limitBar = document.querySelector('#limitBar');
  const limitDurum = document.querySelector('#limitDurumMetni');
  const limitYuzde = document.querySelector('#limitYuzde');

  if (aylikLimit > 0) {
    const oran = Math.min(100, Math.round((toplamGider / aylikLimit) * 100));
    limitBar.value = oran;
    limitYuzde.textContent = `%${oran}`;
    limitDurum.textContent = `${paraFormatla(toplamGider)} / ${paraFormatla(aylikLimit)}`;
  } else {
    limitBar.value = 0;
    limitYuzde.textContent = '%0';
    limitDurum.textContent = 'Limit belirlenmedi';
  }
}

function tabloyuCiz() {
  const seciliTip = filtreTip.value;
  const aramaMetni = filtreAra.value.toLowerCase();

  const suzulmus = islemler
    .filter(i => seciliTip === 'hepsi' || i.tip === seciliTip)
    .filter(i => i.aciklama.toLowerCase().includes(aramaMetni) || i.kategori.toLowerCase().includes(aramaMetni))
    .sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

  listeBody.innerHTML = '';

  if (suzulmus.length === 0) {
    listeBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;">Kayıt bulunamadı.</td></tr>';
    return;
  }

  suzulmus.forEach((item) => {
    const tr = document.createElement('tr');
    const isGelir = item.tip === 'gelir';

    tr.innerHTML = `
      <td>${item.tarih}</td>
      <td>${item.kategori}</td>
      <td>${item.aciklama}</td>
      <td><span class="etiket ${isGelir ? 'etiket-gelir' : 'etiket-gider'}">${isGelir ? 'Gelir' : 'Gider'}</span></td>
      <td class="${isGelir ? 'gelir-renk' : 'gider-renk'}" style="font-weight:600;">
        ${isGelir ? '+' : '-'}${paraFormatla(item.tutar)}
      </td>
      <td><button class="btn-sil" data-id="${item.id}">Sil</button></td>
    `;

    tr.querySelector('.btn-sil').addEventListener('click', () => islemSil(item.id));
    listeBody.appendChild(tr);
  });
}

function grafigiCiz() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const giderler = islemler.filter(i => i.tip === 'gider');
  if (giderler.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('Grafik için henüz gider kaydı bulunmuyor.', 20, 40);
    return;
  }

  const kategoriToplam = {};
  giderler.forEach(g => {
    kategoriToplam[g.kategori] = (kategoriToplam[g.kategori] || 0) + g.tutar;
  });

  const girisler = Object.entries(kategoriToplam).sort((a, b) => b[1] - a[1]);
  const enYuksek = Math.max(...girisler.map(g => g[1]));

  const barYukseklik = 22;
  const bosluk = 12;
  const solBosluk = 145;
  const maxGenislik = canvas.width - solBosluk - 95;

  girisler.forEach(([kategori, tutar], index) => {
    const y = 18 + index * (barYukseklik + bosluk);
    if (y + barYukseklik > canvas.height) return;

    const genislik = (tutar / enYuksek) * maxGenislik;

    ctx.fillStyle = '#334155';
    ctx.font = '12px sans-serif';
    ctx.fillText(kategori, 12, y + 15);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(solBosluk, y, Math.max(4, genislik), barYukseklik);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(paraFormatla(tutar), solBosluk + genislik + 8, y + 15);
  });
}

function arayuzuGuncelle() {
  hesaplamalariYap();
  tabloyuCiz();
  grafigiCiz();
}

verileriYukle();
