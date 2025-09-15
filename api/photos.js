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

    // ambil semua kolom sampai H (kolom foto)
    const range = 'Sheet1!A2:H';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueRenderOption: 'FORMULA'
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(200).json([]);
    }

    const groupedProperties = {};

    rows.forEach(row => {
      const uniqueId = row[0]; // kolom A = nomor unik properti
      const type = row[1];
      const harga = row[2];
      const alamat = row[3];
      const link = row[4];
      const rawFotoCell = row[7] || ''; // kolom H untuk foto

      // ambil URL dari formula =IMAGE("...")
      let finalFotoUrl = null;
      const match = rawFotoCell.match(/=IMAGE\("([^"]+)"\)/);
      if (match && match[1]) {
        finalFotoUrl = match[1];
      }

      if (!groupedProperties[uniqueId]) {
        // baris pertama → simpan detail + array foto kosong
        groupedProperties[uniqueId] = {
          id: uniqueId,
          type,
          harga,
          alamat,
          link,
          foto: []
        };
      }

      // tiap baris dengan ID sama → tambahkan foto
      if (finalFotoUrl) {
        groupedProperties[uniqueId].foto.push(finalFotoUrl);
      }
    });

    // ubah object jadi array
    const properties = Object.values(groupedProperties);

    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
