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

    // ambil data kolom A sampai J
    const range = 'Sheet1!A2:J';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueRenderOption: 'FORMULA'
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      return res.status(200).json([]);
    }

    // Group properti berdasarkan kolom A (nomer)
    const groupedProperties = {};
    rows.forEach(row => {
      const uniqueId = row[0]; // nomer
      const rawFotoCellString = typeof row[7] === 'string' ? row[7] : '';

      // ambil URL dari =IMAGE("...")
      const match = rawFotoCellString.match(/=IMAGE\("([^"]+)"\)/);
      const finalFotoUrl = match && match[1] ? match[1] : null;

      if (uniqueId) {
        if (!groupedProperties[uniqueId]) {
          groupedProperties[uniqueId] = {
            type: row[1] || '',
            harga: row[2] || '',
            alamat: row[3] || '',
            deskripsi: row[4] || '',
            kamar: row[5] || '',
            kamar_mandi: row[6] || '',
            link: row[8] || '', // kolom I untuk link
            foto: finalFotoUrl ? [finalFotoUrl] : []
          };
        } else {
          if (finalFotoUrl) {
            groupedProperties[uniqueId].foto.push(finalFotoUrl);
          }
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
