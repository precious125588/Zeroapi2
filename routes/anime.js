const express = require('express');
const { handleDownload } = require('../controllers/download.controller');
const animeSvc = require('../services/anime.service');
const r = express.Router();
r.get('/', (req, res) => handleDownload('anime', req, res));
r.post('/', (req, res) => handleDownload('anime', req, res));
r.get('/search', async (req, res) => { const {q}=req.query; if(!q) return res.status(400).json({success:false,error:'q required'}); try{res.json({success:true,data:await animeSvc.search(q)})}catch(e){res.status(502).json({success:false,error:e.message})} });
r.get('/info', async (req, res) => { const {id}=req.query; if(!id) return res.status(400).json({success:false,error:'id required'}); try{res.json({success:true,data:await animeSvc.info(id)})}catch(e){res.status(502).json({success:false,error:e.message})} });
module.exports = r;
