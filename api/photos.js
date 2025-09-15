import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: process.env.GOOGLE_TYPE,
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: process.env.GOOGLE_AUTH_URI,
        token_uri: process.env.GOOGLE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = 'Sheet1!A2:I';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const groupedProperties = {};

    rows.forEach((row) => {
      const uniqueId = row[0]; // kolom A = ID unik
      const rawFotoCellString = row[7] || ''; // kolom H = foto
      let finalFotoUrl = null;

      // cek IMAGE("...") formula
      const match = rawFotoCellString.match(/=IMAGE\("([^"]+)"\)/);
      if (match && match[1]) {
        finalFotoUrl = match[1];
      }

      // bungkus URL jadi lewat proxy
      if (finalFotoUrl) {
        finalFotoUrl = `/api/proxy?url=${encodeURIComponent(finalFotoUrl)}`;
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
            link: row[8], // kolom I untuk link
            foto: [],
          };
        }
        if (finalFotoUrl) {
          groupedProperties[uniqueId].foto.push(finalFotoUrl);
        }
      }
    });

    res.status(200).json(Object.values(groupedProperties));
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
