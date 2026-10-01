// Exporta cada coleccion de la base a database/<coleccion>.json (Extended JSON)
// Uso: npm run db:export
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'database');

(async () => {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  for (const name of collections) {
    const docs = await db.collection(name).find().toArray();
    fs.writeFileSync(path.join(OUT_DIR, name + '.json'), EJSON.stringify(docs, { relaxed: true }, 2));
    console.log(name.padEnd(12), docs.length, 'documentos');
  }
  await client.close();
  console.log('Exportado en', OUT_DIR);
})().catch((e) => { console.error(e.message); process.exit(1); });
