const express = require('express');
const { handleDownload } = require('../controllers/download.controller');
const r = express.Router();
r.get('/',  (req, res) => handleDownload('facebook', req, res));
r.post('/', (req, res) => handleDownload('facebook', req, res));
module.exports = r;
