import { google } from 'googleapis';

export default async function handler(req, res) {
    try {
        console.log('Request received for /api/photos'); // Tambahan: Log awal
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
        const range = 'Sheet1!A2:J';
        
        console.log('Fetching data from Google Sheets...'); // Tambahan: Log saat mengambil data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueRenderOption: 'FORMULA'
        });
        
        const rows = response.data.values;
        
        if (!rows || rows.length === 0) {
            console.log('No data found in Google Sheets.'); // Tambahan: Log jika data kosong
            return res.status(200).json([]);
        }

        console.log(`Processing ${rows.length} rows of data.`); // Tambahan: Log jumlah baris
        const groupedProperties = {};
        rows.forEach(row => {
            const uniqueId = row[0];
            const type = row[1];
            const harga = row[2];
            const alamat = row[3];
            const deskripsi = row[4];
            const kamar = row[5];
            const kamar_mandi = row[6];
            const link = row[7];
            const rawFotoCell = row[8] || '';
            const match = rawFotoCell.match(/=IMAGE\("([^"]+)"\)/);
            let finalFotoUrl = null;
            if (match && match[1]) {
                finalFotoUrl = match[1];
            } else if (rawFotoCell.startsWith("http")) {
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
        
        console.log('Successfully processed data. Number of properties:', properties.length); // Tambahan: Log hasil akhir
        console.log('First property:', JSON.stringify(properties[0], null, 2)); // Tambahan: Log detail properti pertama
        
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        res.status(200).json(properties);

    } catch (error) {
        console.error('Error fetching data:', error); // Log pesan error
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
