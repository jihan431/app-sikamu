const express = require('express');
const sikamu = require('./services/sikamu'); // Memakai logika scraping dari folder services
const app = express();

app.use(express.json());

// Endpoint untuk Login dari HP
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await sikamu.login(email, password);
    
    if (result.success) {
        // Ambil data dashboard sekalian setelah login
        const dashboard = await sikamu.getDashboard(result.cookies, result.redirectUrl);
        
        // Ambil NPM dan Foto dari halaman /account
        let npm = '';
        let photoUrl = '';
        let prodi = '';
        let emailFromAccount = '';
        
        try {
            const account = await sikamu.getAccount(result.cookies);
            if (account.success) {
                if (account.npm) npm = account.npm;
                if (account.photoUrl) photoUrl = account.photoUrl;
                if (account.prodi) prodi = account.prodi;
                if (account.email) emailFromAccount = account.email;
            }
        } catch (e) {
            console.log('Account fetch error:', e.message);
        }
        
        // Sertakan cookies dan redirectUrl untuk API calls selanjutnya
        res.json({ 
            success: true, 
            user: {
                ...dashboard,
                npm: npm,
                photoUrl: photoUrl,
                prodi: prodi,
                email: emailFromAccount || email,
                cookies: result.cookies,
                redirectUrl: result.redirectUrl
            }
        });
    } else {
        res.status(401).json(result);
    }
});

// Endpoint untuk ambil data Dashboard (dengan cookies)
app.post('/api/dashboard', async (req, res) => {
    const { cookies, redirectUrl } = req.body;
    if (!cookies) {
        return res.status(400).json({ success: false, message: 'Cookies diperlukan' });
    }
    const dashboard = await sikamu.getDashboard(cookies, redirectUrl);
    res.json(dashboard);
});

// Endpoint untuk ambil KRS (dengan cookies)
app.post('/api/krs', async (req, res) => {
    const { cookies, semester } = req.body;
    if (!cookies || !semester) {
        return res.status(400).json({ success: false, message: 'Cookies dan semester diperlukan' });
    }
    const krs = await sikamu.getKRS(cookies, semester);
    res.json(krs);
});

// Endpoint untuk ambil KRS PDF (dengan cookies)
app.post('/api/krs-pdf', async (req, res) => {
    const { cookies, semester } = req.body;
    if (!cookies || !semester) {
        return res.status(400).json({ success: false, message: 'Cookies dan semester diperlukan' });
    }
    
    const pdfResult = await sikamu.getKRSPdf(cookies, semester);
    
    if (pdfResult.success) {
        // Convert buffer to base64 for mobile app
        const pdfBase64 = pdfResult.pdf.toString('base64');
        res.json({ 
            success: true, 
            pdfBase64: pdfBase64,
            filename: pdfResult.filename 
        });
    } else {
        res.status(400).json(pdfResult);
    }
});

// Endpoint untuk ambil daftar tahun akademik KPU
app.post('/api/kpu-years', async (req, res) => {
    const { cookies } = req.body;
    if (!cookies) {
        return res.status(400).json({ success: false, message: 'Cookies diperlukan' });
    }
    const result = await sikamu.getKpuYears(cookies);
    res.json(result);
});

// Endpoint untuk ambil KPU PDF
app.post('/api/kpu-pdf', async (req, res) => {
    const { cookies, tahun, opsi } = req.body;
    if (!cookies || !tahun || !opsi) {
        return res.status(400).json({ success: false, message: 'Cookies, tahun, dan opsi diperlukan' });
    }
    
    const pdfResult = await sikamu.getKpuPdf(cookies, tahun, opsi);
    
    if (pdfResult.success) {
        const pdfBase64 = pdfResult.pdf.toString('base64');
        res.json({ 
            success: true, 
            pdfBase64: pdfBase64,
            filename: pdfResult.filename 
        });
    } else {
        res.status(400).json(pdfResult);
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Server API Kampus jalan di port 3000');
});