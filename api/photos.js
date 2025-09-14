import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const SPREADSHEET_ID = '1NadxFspxUmz8sdIpqmwCyjCKGfmMTpFCOYhErnbxZJQ'; // Ganti dengan ID Spreadsheet Anda
    const BOT_TOKEN = process.env.BOT_TOKEN;

    const sheets = google.sheets({ version: 'v4', auth: GOOGLE_API_KEY });
    
    const range = 'Sheet1!A2:E'; // Sesuaikan jika range Anda berbeda
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(200).json([]);
    }

    const properties = rows.map(row => {
      // Dapatkan URL dari dalam formula =IMAGE()
      const rawFotoUrl = row[3];
      const match = rawFotoUrl.match(/\"(https?:\/\/[^\"]+)\"/);
      
      let finalFotoUrl = null;
      if (match && match[1]) {
        finalFotoUrl = match[1].replace('bot', 'bot' + BOT_TOKEN);
      }
      
      return {
        type: row[0],
        harga: row[1],
        alamat: row[2],
        foto: finalFotoUrl,
        link: row[4]
      };
    });

    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
