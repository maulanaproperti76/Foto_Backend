import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    console.log('Request received for /api/photos');
    const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const SPREADSHEET_ID = '1NadxFspxUmz8sdIpqmwCyjCKGfmMTpFCOYhErnbxZJQ';
    const GOOGLE_DRIVE_FOLDER_ID = '1cusUQEcW8cutW56N94M01e8UxDY7MzhN'; // Ganti dengan ID folder utama properti Anda

    const jwtClient = new google.auth.JWT(
      GOOGLE_CREDENTIALS.client_email,
      null,
      GOOGLE_CREDENTIALS.private_key,
      // Tambahkan scope drive.readonly
      ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'] 
    );

    await jwtClient.authorize();

    const sheets = google.sheets({ version: 'v4', auth: jwtClient });
    const drive = google.drive({ version: 'v3', auth: jwtClient });

    // 1. Ambil data dari Google Sheets
    const range = 'Sheet1!A2:K';
    console.log('Fetching data from Google Sheets...');
    const sheetsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });

    const rows = sheetsResponse.data.values || [];
    if (rows.length === 0) {
      console.log('No data found in Google Sheets.');
      return res.status(200).json([]);
    }

    // 2. Ambil daftar foto dari Google Drive
    console.log('Fetching photos from Google Drive...');
    const driveResponse = await drive.files.list({
      q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType contains 'image'`,
      fields: 'files(id, name, parents)'
    });
    
    const photos = driveResponse.data.files || [];
    console.log(`Found ${photos.length} photos in Drive.`);

    // Buat map untuk mencocokkan ID folder dengan ID properti
    const propertyIdMap = {};
    for (const photo of photos) {
      const parentFolderId = photo.parents && photo.parents[0];
      if (parentFolderId) {
        const folderMetadata = await drive.files.get({
          fileId: parentFolderId,
          fields: 'name'
        });
        const folderName = folderMetadata.data.name;
        // Ekstrak ID properti dari nama folder (misalnya "Properti 1" -> 1)
        const match = folderName.match(/Properti (\d+)/);
        if (match) {
          const propertyId = match[1];
          if (!propertyIdMap[propertyId]) {
            propertyIdMap[propertyId] = [];
          }
          propertyIdMap[propertyId].push(`https://drive.google.com/uc?id=${photo.id}`);
        }
      }
    }

    // 3. Gabungkan data sheets dengan data foto
    console.log(`Processing ${rows.length} rows of data...`);
    const groupedProperties = {};
    let lastUniqueId = null;

    rows.forEach((row, index) => {
      const currentUniqueId = row[0]; // Kolom A
      if (currentUniqueId) {
        lastUniqueId = currentUniqueId;
        groupedProperties[lastUniqueId] = {
          id: lastUniqueId,
          type: row[1] || null,
          harga: row[2] || null,
          alamat: row[3] || null,
          deskripsi: row[4] || null,
          kamar: row[5] || null,
          kamar_mandi: row[6] || null,
          link: row[7] || null,
          status: row[10] || "", // Kolom K
          foto: propertyIdMap[lastUniqueId] || [] // Ambil foto dari map
        };
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

    // Cache headers
    if (req.query.refresh === "1") {
      console.log("Manual refresh requested, bypassing cache...");
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    }

    res.status(200).json(properties);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
