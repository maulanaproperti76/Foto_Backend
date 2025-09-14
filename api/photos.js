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

    console.log('Response from Google Sheets:', JSON.stringify(response.data, null, 2));

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No rows found, returning empty array.');
      return res.status(200).json([]);
    }

    const properties = rows.map(row => {
      // Kolom untuk foto berada di indeks 3.
      // Jika kolom ini berisi deskripsi, Anda harus memindahkan data foto ke kolom yang benar di spreadsheet.
      const rawFotoCell = row[3] || '';
      console.log('Processing cell for photo:', rawFotoCell);
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

    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
