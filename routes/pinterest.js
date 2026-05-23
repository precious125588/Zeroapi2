const express = require('express');
const { handleDownload } = require('../controllers/download.controller');
const r = express.Router();
r.get('/',  (req, res) => handleDownload('pinterest', req, res));
r.post('/', (req, res) => handleDownload('pinterest', req, res));
module.exports = r;
