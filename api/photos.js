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

    // ambil semua kolom sampai J (foto di I index=8, date di J index=9)
    const range = 'Sheet1!A2:J';
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
      const uniqueId = row[0]; // kolom A = no property
      const type = row[1];
      const harga = row[2];
      const alamat = row[3];
      const deskripsi = row[4];
      const kamar = row[5];
      const kamar_mandi = row[6];
      const link = row[7];

      // Kolom I (index 8) = foto
      const rawFotoCell = row[8] || '';
      const match = rawFotoCell.match(/=IMAGE\("([^"]+)"\)/);
      let finalFotoUrl = null;
      if (match && match[1]) {
        finalFotoUrl = match[1];
      } else if (rawFotoCell.startsWith("http")) {
        // kalau bukan formula =IMAGE tapi langsung URL
        finalFotoUrl = rawFotoCell;
      }

      if (uniqueId) {
        if (!groupedProperties[uniqueId]) {
          groupedProperties[uniqueId] = {
            id: uniqueId,
            type,
            harga,
            alamat,
            deskripsi,
            kamar,
            kamar_mandi,
            link,
            foto: []
          };
        }

        if (finalFotoUrl) {
          groupedProperties[uniqueId].foto.push(finalFotoUrl);
        }
      }
    });

    const properties = Object.values(groupedProperties);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
