const express = require('express');
const { handleDownload } = require('../controllers/download.controller');
const r = express.Router();
r.get('/',  (req, res) => handleDownload('snapchat', req, res));
r.post('/', (req, res) => handleDownload('snapchat', req, res));
module.exports = r;
