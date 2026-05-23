const express = require('express');
const { handleDownload } = require('../controllers/download.controller');
const r = express.Router();
r.get('/', (req, res) => handleDownload('movies', req, res));
r.post('/', (req, res) => handleDownload('movies', req, res));
module.exports = r;
