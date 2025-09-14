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

    const range = 'Sheet1!A2:G';
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

    const properties = rows.map(row => {
      const rawFotoCell = row[5] || '';
      const match = rawFotoCell.match(/=IMAGE\("([^"]+)"\)/);

      let finalFotoUrl = null;
      if (match && match[1]) {
        finalFotoUrl = match[1];
      }
      
      return {
        type: row[0],
        harga: row[1],
        alamat: row[2],
        foto: finalFotoUrl,
        link: row[4]
      };
    });

    // Menambahkan header cache ke respons
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
