import fetch from 'node-fetch';

export default async function handler(request, response) {
  // --- BAGIAN INI SANGAT PENTING ---
  // API Key Telegram disimpan sebagai variabel lingkungan (environment variable)
  // di Vercel, bukan di dalam kode ini.
  const BOT_TOKEN = process.env.BOT_TOKEN;

  // Ganti dengan ID Spreadsheet Anda
  const SPREADSHEET_ID = '1NadxFspxUmz8sdIpqmwCyjCKGfmMTpFCOYhErnbxZJQ';
  // Ganti dengan Google Sheets API Key Anda
  const GOOGLE_API_KEY = 'AIzaSyBkz_SNQpDZuDJfUZ9AxbBm1GagK5igXug'; 

  // URL API Google Sheets untuk mengambil data dari Sheet1
  const googleSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A:A?key=${GOOGLE_API_KEY}`;

  try {
    const sheetResponse = await fetch(googleSheetUrl);
    const sheetData = await sheetResponse.json();

    const photoUrls = [];
    if (sheetData.values && sheetData.values.length > 0) {
      sheetData.values.forEach(row => {
        const cellData = row[0];
        if (cellData.startsWith('=IMAGE("')) {
          const match = cellData.match(/"([^"]*)"/);
          if (match && match.length > 1) {
            // Pastikan URL memiliki BOT_TOKEN yang benar
            const telegramUrl = match[1].replace('bot[0-9]+:[a-zA-Z0-9_-]+', `bot${BOT_TOKEN}`);
            photoUrls.push(telegramUrl);
          }
        }
      });
    }

    response.status(200).json({ photos: photoUrls });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Gagal mengambil data dari Google Sheets.' });
  }
}
