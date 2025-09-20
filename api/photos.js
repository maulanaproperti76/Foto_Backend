import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    console.log('Request received for /api/photos');
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
    const range = 'Sheet1!A2:K'; // ganti sampai K

    console.log('Fetching data from Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueRenderOption: 'FORMATTED_VALUE'
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in Google Sheets.');
      return res.status(200).json([]);
    }

    console.log(`Processing ${rows.length} rows of data...`);
    const groupedProperties = {};
    let lastUniqueId = null;

    rows.forEach((row, index) => {
      console.log(`Row ${index + 1}:`, row);

      const currentUniqueId = row[0]; // Kolom A

      if (currentUniqueId) {
        lastUniqueId = currentUniqueId;
        const type = row[1];
        const harga = row[2];
        const alamat = row[3];
        const deskripsi = row[4];
        const kamar = row[5];
        const kamar_mandi = row[6];
        const link = row[7];
        const status = row[10] || ""; // Kolom K

        console.log(`New property found: ${lastUniqueId}, status: ${status}`);

        groupedProperties[lastUniqueId] = {
          id: lastUniqueId,
          type,
          harga,
          alamat,
          deskripsi,
          kamar,
          kamar_mandi,
          link,
          status,
          foto: []
        };
      }

      // Kolom I (index 8) = foto
      const rawFotoCell = row[8] || '';
      const finalFotoUrl = rawFotoCell.startsWith("http") ? rawFotoCell : null;
      
      if (finalFotoUrl && lastUniqueId) {
          groupedProperties[lastUniqueId].foto.push(finalFotoUrl);
          console.log(`Photo for property ${lastUniqueId} added: ${finalFotoUrl}`);
      }
    });

    const properties = Object.values(groupedProperties);

    console.log('Successfully processed data. Number of properties:', properties.length);
    properties.forEach((p, i) => {
      console.log(`Property #${i + 1}:`, {
        id: p.id,
        status: p.status,
        photos: p.foto.length
      });
    });

    // ✅ Tambahan: manual refresh
    if (req.query.refresh === "1") {
      console.log("Manual refresh requested, bypassing cache headers.");
      return res.status(200).json(properties);
    }

    // Tambahkan di sebelum res.setHeader
    if (req.query.refresh === "1") {
      console.log("Manual refresh requested, bypassing cache...");
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    }


    // Default: tetap pakai cache 5 menit
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
