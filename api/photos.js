import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    console.log('Request received for /api/photos');
    const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const SPREADSHEET_ID = '1NadxFspxUmz8sdIpqmwCyjCKGfmMTpFCOYhErnbxZJQ';
    const GOOGLE_DRIVE_FOLDER_ID = '1cusUQEcW8cutW56N94M01e8UxDY7MzhN'; // PASTIKAN ID INI SUDAH BENAR

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

    // 2. Ambil daftar folder properti dari Google Drive
    console.log('Fetching property folders from Google Drive...');
    const driveFoldersResponse = await drive.files.list({
      q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name)'
    });
    
    const propertyFolders = driveFoldersResponse.data.files || [];
    console.log(`Found ${propertyFolders.length} property folders.`);
    
    // 3. Ambil semua foto dari setiap folder properti
    const photoMap = new Map();
    for (const folder of propertyFolders) {
      const match = folder.name.match(/Properti (\d+)/);
      if (match) {
        // ID dari folder Drive adalah string
        const propertyId = match[1]; 
        console.log(`Fetching photos for property ID: ${propertyId}...`);
        const photosResponse = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType contains 'image'`,
          fields: 'files(id)'
        });
        
        const photos = photosResponse.data.files || [];
        const photoUrls = photos.map(photo => `https://drive.google.com/uc?id=${photo.id}`);
        
        if (photoUrls.length > 0) {
          photoMap.set(propertyId, photoUrls);
          console.log(`Found ${photoUrls.length} photos for property #${propertyId}.`);
        } else {
          photoMap.set(propertyId, []);
        }
      }
    }

    // 4. Gabungkan data sheets dengan data foto
    console.log(`Processing ${rows.length} rows of data...`);
    const groupedProperties = {};
    let lastUniqueId = null;

    rows.forEach((row) => {
      // Ubah ID dari Sheets menjadi string untuk mencocokkan
      const currentUniqueId = String(row[0]); 

      if (currentUniqueId && !groupedProperties[currentUniqueId]) {
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
          status: row[10] || "",
          foto: photoMap.get(lastUniqueId) || [] // Ambil foto dari map
        };
      }
    });

    const properties = Object.values(groupedProperties);

    console.log('Successfully processed data. Number of properties:', properties.length);

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
