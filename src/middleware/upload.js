// uploads/vercelBlob.js
const { put } = require('@vercel/blob');
const fs = require('fs');
const util = require('util');

const readFile = util.promisify(fs.readFile);

async function uploadToVercelBlob(file) {
  const buffer = await readFile(file.filepath);

  const blob = await put(file.originalFilename, buffer, {
    access: 'public',
  });

  return {
    url: blob.url,
    name: file.originalFilename,
    type: file.mimetype,
    size: file.size,
  };
}

module.exports = { uploadToVercelBlob };
