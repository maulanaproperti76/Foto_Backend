import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const SPREADSHEET_ID = '1NadxFspxUmz8sdIpqmwCyjCKGfmMTpFCOYhErnbxZJQ';

    const jwtClient = new google.auth.JWT(
      GOOGLE_CREDENTIALS.client_email,
      null,
      GOOGLE_CREDENTIALS.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    await jwtClient.authorize();

    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    // Mengambil data dari kolom A sampai J (indeks 0 sampai 9)
    const range = 'Sheet1!A2:J';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, // Kesalahan ketik sudah diperbaiki di sini
      range,
      valueRenderOption: 'FORMULA'
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      return res.status(200).json([]);
    }

    // Mengelompokkan properti berdasarkan 'nomer' (kolom A, indeks 0)
    const groupedProperties = {};
    rows.forEach(row => {
      const uniqueId = row[0]; // Kolom A (nomer) sebagai ID unik
      const rawFotoCell = row[7]; // Kolom H (Foto)
      
      // Pastikan rawFotoCell adalah string sebelum memanggil .match()
      const rawFotoCellString = typeof rawFotoCell === 'string' ? rawFotoCell : '';
      const match = rawFotoCellString.match(/=IMAGE\("([^"]+)"\)/);
      let finalFotoUrl = null;
      if (match && match[1]) {
        finalFotoUrl = match[1];
      }

      if (uniqueId) {
        if (!groupedProperties[uniqueId]) {
          groupedProperties[uniqueId] = {
            type: row[1],
            harga: row[2],
            alamat: row[3],
            deskripsi: row[4],
            kamar: row[5],
            kamar_mandi: row[6],
            link: row[8], // link property (Google Maps / marketplace)
            foto: finalFotoUrl ? [finalFotoUrl] : [] // langsung isi kalau ada
          };
        } else {
          // kalau properti sudah ada → tambahkan foto baru
          if (finalFotoUrl) {
            groupedProperties[uniqueId].foto.push(finalFotoUrl);
          }
        }
      }


    // Mengubah objek menjadi array final untuk respons
    const properties = Object.values(groupedProperties);

    // Menambahkan header cache ke respons
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
