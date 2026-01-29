/**
 * SIKAMU API Handler
 * Modul untuk login dan scraping data dari SIKAMU UMB
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class SikamuAPI {
    constructor() {
        this.sessions = new Map(); // Menyimpan session per user
        this.sessionFile = path.join(__dirname, 'user_sessions.json');
        this.loadSessionsFromFile();
    }

    /**
     * Load sessions from file
     */
    loadSessionsFromFile() {
        try {
            if (fs.existsSync(this.sessionFile)) {
                const data = fs.readFileSync(this.sessionFile, 'utf8');
                const sessionsObj = JSON.parse(data);
                
                // Convert Object ke Map
                Object.keys(sessionsObj).forEach(key => {
                    const session = sessionsObj[key];
                    // Skip session yang sudah expired
                    if (Date.now() - session.timestamp < config.SESSION_TIMEOUT) {
                        this.sessions.set(parseInt(key) || key, session);
                    }
                });
                console.log(`✅ Loaded ${this.sessions.size} persistent sessions.`);
            }
        } catch (error) {
            console.error('Gagal load sessions:', error.message);
        }
    }

    /**
     * Save sessions to file
     */
    saveSessionsToFile() {
        try {
            // Convert Map ke Object
            const sessionsObj = Object.fromEntries(this.sessions);
            fs.writeFileSync(this.sessionFile, JSON.stringify(sessionsObj, null, 2));
        } catch (error) {
            console.error('Gagal save sessions:', error.message);
        }
    }

    /**
     * Membuat axios instance dengan cookie jar
     */
    createClient() {
        return axios.create({
            baseURL: config.SIKAMU_URL,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
            },
            withCredentials: true,
            maxRedirects: 5,
        });
    }

    /**
     * Mengambil CSRF token dari halaman login
     */
    async getCsrfToken(cookies = '') {
        try {
            const client = this.createClient();
            const response = await client.get('/login', {
                headers: cookies ? { 'Cookie': cookies } : {}
            });
            
            const $ = cheerio.load(response.data);
            const token = $('input[name="_token"]').val();
            
            // Ambil cookies dari response
            const setCookies = response.headers['set-cookie'];
            let cookieString = '';
            if (setCookies) {
                cookieString = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
            }
            
            return { token, cookies: cookieString };
        } catch (error) {
            console.error('Error getting CSRF token:', error.message);
            throw new Error('Gagal mengambil CSRF token. Server mungkin tidak dapat dijangkau.');
        }
    }

    /**
     * Login ke SIKAMU
     */
    async login(email, password) {
        try {
            // Step 1: Ambil CSRF token
            const { token, cookies } = await this.getCsrfToken();
            
            if (!token) {
                throw new Error('CSRF token tidak ditemukan');
            }

            // console.log('�� CSRF Token didapat:', token.substring(0, 20) + '...');
            // console.log('🍪 Cookies:', cookies);

            // Step 2: Kirim login request
            const client = this.createClient();
            const formData = new URLSearchParams();
            formData.append('_token', token);
            formData.append('email', email);
            formData.append('password', password);

            const response = await client.post('/login', formData.toString(), {
                headers: {
                    'Cookie': cookies,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': config.SIKAMU_URL,
                    'Referer': config.LOGIN_URL,
                },
                maxRedirects: 0, // Jangan ikuti redirect
                validateStatus: (status) => status >= 200 && status < 400,
            });

            // Ambil cookies baru setelah login
            const newCookies = response.headers['set-cookie'];
            let sessionCookies = cookies;
            if (newCookies) {
                const newCookieStr = newCookies.map(cookie => cookie.split(';')[0]).join('; ');
                sessionCookies = newCookieStr || cookies;
            }

            // Check apakah login berhasil (redirect ke dashboard)
            const isSuccess = response.status === 302 || response.status === 301;
            const redirectUrl = response.headers['location'];

            if (isSuccess && redirectUrl && !redirectUrl.includes('login')) {
                // console.log('✅ Login berhasil! Redirect ke:', redirectUrl);
                return {
                    success: true,
                    cookies: sessionCookies,
                    redirectUrl: redirectUrl,
                    message: 'Login berhasil!'
                };
            } else {
                // Cek apakah ada error message di response body
                const $ = cheerio.load(response.data || '');
                const errorMsg = $('.alert-danger').text().trim() || 
                                 $('.error').text().trim() ||
                                 'Email atau password salah';
                
                return {
                    success: false,
                    message: errorMsg
                };
            }

        } catch (error) {
            console.error('Login error:', error.message);
            
            // Jika error karena redirect, coba handle
            if (error.response && (error.response.status === 302 || error.response.status === 301)) {
                const redirectUrl = error.response.headers['location'];
                const newCookies = error.response.headers['set-cookie'];
                
                if (redirectUrl && !redirectUrl.includes('login')) {
                    let sessionCookies = '';
                    if (newCookies) {
                        sessionCookies = newCookies.map(cookie => cookie.split(';')[0]).join('; ');
                    }
                    
                    return {
                        success: true,
                        cookies: sessionCookies,
                        redirectUrl: redirectUrl,
                        message: 'Login berhasil!'
                    };
                }
            }
            
            return {
                success: false,
                message: 'Gagal login: ' + error.message
            };
        }
    }

    async getDashboard(cookies, redirectUrl = '/dashboardMhs') {
        try {
            const client = this.createClient();
            // Gunakan redirect URL dari login jika tersedia
            const dashboardPath = redirectUrl.replace(config.SIKAMU_URL, '') || '/dashboardMhs';
            const response = await client.get(dashboardPath, {
                headers: {
                    'Cookie': cookies,
                    'Referer': config.SIKAMU_URL,
                }
            });

            const $ = cheerio.load(response.data);
            
            // Debug: simpan HTML untuk troubleshoot
            const debugFile = path.join(__dirname, 'debug_dashboard.html');
            fs.writeFileSync(debugFile, response.data, 'utf8');
            // console.log('📄 HTML disimpan ke:', debugFile);
            // console.log('📄 HTML length:', response.data.length);
            
            // === PARSING BERDASARKAN STRUKTUR HTML SIKAMU ===
            
            // 1. Parse nama dari class .text-red-800
            let nama = $('.text-red-800').first().text().trim();
            // console.log('  Raw nama:', nama);
            
            // Alternatif: cari dari regex jika selector tidak work
            if (!nama) {
                const bodyText = $('body').text();
                const nameMatch = bodyText.match(/Selamat Datang\s+([A-Za-z\s]+)/i);
                if (nameMatch && nameMatch[1]) {
                    nama = nameMatch[1].trim();
                }
            }
            
            // 2. Parse status dari class .text-slate-300
            let status = '';
            const statusText = $('.text-slate-300').first().text().trim();
            // console.log('  Raw status:', statusText);
            if (statusText && statusText.includes('Status')) {
                status = statusText.replace(/Status\s*:\s*/i, '').trim();
            }
            
            // Alternatif
            if (!status) {
                const bodyText = $('body').text();
                const statusMatch = bodyText.match(/Status\s*:\s*([^\n]+)/i);
                if (statusMatch && statusMatch[1]) {
                    status = statusMatch[1].trim();
                }
            }
            
            // 3. Parse statistik dari .st-box cards
            let ipk = '-';
            let sksDitempuh = '-';
            let totalSks = '-';
            let sksSisa = '-';
            
            // Cari semua stat boxes - coba berbagai selector
            const statBoxes = $('.st-box');
            // console.log('  Found st-box count:', statBoxes.length);
            
            const stats = [];
            
            // Jika tidak ketemu, coba selector alternatif
            if (statBoxes.length === 0) {
                $('[class*="text-3xl"]').each((i, el) => {
                    const value = $(el).text().trim();
                    const parent = $(el).parent();
                    const label = parent.find('[class*="text-base"], [class*="text-gray"]').text().trim().toLowerCase();
                    
                    if (label.includes('ip') && !ipk.includes('.')) {
                        ipk = value;
                    } else if (label.includes('telah')) {
                        sksDitempuh = value;
                    } else if (label.includes('total') || label.includes('seluruh')) {
                        totalSks = value;
                    } else if (label.includes('belum')) {
                        sksSisa = value;
                    }
                });
            } else {
                statBoxes.each((i, el) => {
                    const card = $(el);
                    const value = card.find('[class*="text-3xl"]').first().text().trim();
                    const label = card.find('[class*="text-base"]').first().text().trim().toLowerCase();
                    
                    if (label.includes('ip')) {
                        ipk = value;
                    } else if (label.includes('telah ditempuh')) {
                        sksDitempuh = value;
                    } else if (label.includes('total') || label.includes('seluruh')) {
                        totalSks = value;
                    } else if (label.includes('belum')) {
                        sksSisa = value;
                    }
                });
            }
            
            // Fallback: parse dari body text jika masih kosong
            if (ipk === '-') {
                const bodyText = $('body').text();
                // Cari pattern angka dengan titik (IPK biasanya 0.00 - 4.00)
                const ipkMatch = bodyText.match(/(\d\.\d{2})/);
                if (ipkMatch) ipk = ipkMatch[1];
            }
            
            // console.log('📊 Dashboard parsed:', { nama, status, ipk, sksDitempuh, totalSks, sksSisa });

            // 4. Parse IP dari Chart Data (di dalam script atau body)
            let chartData = { semesters: [], ips: [] };
            const fullHtml = response.data; // Gunakan raw HTML string data
            
            // LOGIC BARU: Regex Global Search di seluruh HTML
            // Cari pattern data: [3.7, 3.77, ...]
            // Pattern: data : [ angka.angka , angka.angka ]
            // Regex: /data\s*:\s*\[([\d\.\,\s]+)\]/g
            
            // 1. Cari Data IP - Format baru yang multi-line:
            // data: [
            //     3.7, 3.77, 3.45,                    ],
            // Kita perlu cari pattern "data: [" lalu ambil semua angka sampai "]"
            
            // Hapus semua newlines dan extra spaces untuk parsing lebih mudah
            const cleanHtml = fullHtml.replace(/\s+/g, ' ');
            
            // Cari semua pattern data: [ ... ] dengan content di dalamnya
            const dataMatch = cleanHtml.match(/label:\s*'Nilai'[^}]*data:\s*\[\s*([^\]]+)\]/);
            if (dataMatch && dataMatch[1]) {
                const content = dataMatch[1];
                // Cari semua angka float (termasuk yang dipisah comma)
                const numbers = content.match(/[\d.]+/g);
                if (numbers) {
                    const vals = numbers.map(s => parseFloat(s.trim())).filter(v => !isNaN(v) && v > 0 && v <= 4.00);
                    if (vals.length > 0) {
                        // console.log('🎯 Found IP Data:', vals);
                        chartData.ips = vals;
                    }
                }
            }
            
            // 2. Cari Labels Semester - Format baru:
            // labels: [
            //     '1', '2', '3',                ],
            const labelsMatch = cleanHtml.match(/labels:\s*\[\s*([^\]]+)\]/);
            if (labelsMatch && labelsMatch[1]) {
                const content = labelsMatch[1];
                // Cari semua angka di dalam quotes atau tanpa quotes
                const sems = content.match(/['"]?(\d+)['"]?/g);
                if (sems) {
                    const semVals = sems.map(s => s.replace(/['"]/g, '').trim()).filter(s => s.length > 0 && !isNaN(parseInt(s)));
                    if (semVals.length > 0) {
                        // console.log('🎯 Found Semesters:', semVals);
                        chartData.semesters = semVals;
                    }
                }
            }

            // Fallback: Jika semester kosong tapi IP ada, generate semester sequence
            if (chartData.semesters.length === 0 && chartData.ips.length > 0) {
                chartData.semesters = chartData.ips.map((_, i) => (i + 1).toString());
            }

            // console.log('📈 Final Chart Data:', chartData);
            
            // 5. Parse Tagihan Semester
            let tagihan = 'Rp. 0';
            // Cari pattern Rp. di dekat "Jumlah Tagihan"
            const tagihanMatch = fullHtml.match(/Rp\.\s*[\d\.,]+/g);
            if (tagihanMatch && tagihanMatch.length > 0) {
                tagihan = tagihanMatch[0]; // Ambil yang pertama
            }
            // console.log('💰 Tagihan:', tagihan);
            
            return {
                success: true,
                nama: nama || 'Mahasiswa UMB',
                status: status || 'Aktif',
                ipk: ipk,
                sksDitempuh: sksDitempuh,
                totalSks: totalSks,
                sksSisa: sksSisa,
                tagihan: tagihan,
                chartData: chartData
            };

        } catch (error) {
            console.error('Dashboard error:', error.message);
            return {
                success: false,
                message: 'Gagal mengambil data dashboard: ' + error.message
            };
        }
    }

    async getIPData(cookies) {
        try {
            // Gunakan getDashboard untuk ambil data chart
            const dash = await this.getDashboard(cookies);
            
            if (dash.success && dash.chartData && dash.chartData.ips.length > 0) {
                return {
                    success: true,
                    data: dash.chartData
                };
            }
            return {
                success: false,
                message: 'Data grafik IP tidak ditemukan di dashboard.'
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Mengambil data KRS/KHS untuk semester tertentu
     * URL: /krss{ta?ta=SEMESTER
     * Tabel memiliki 12 kolom: No, Hari, Aksi, Mata Kuliah, Dosen, Jam Mulai, Kelas, Mode Kuliah, Ruangan, Sks, Semester, Nilai
     */
    async getKRS(cookies, semester) {
        try {
            const client = this.createClient();
            // URL pattern: /krss{ta?ta=1 untuk semester 1
            const url = `/krss{ta?ta=${semester}`;
            // console.log(`📥 Fetching KRS from: ${url}`);
            
            const response = await client.get(url, {
                headers: {
                    'Cookie': cookies,
                    'Referer': config.SIKAMU_URL + '/dashboardMhs',
                }
            });

            // Debug: simpan HTML untuk troubleshoot
            const debugFile = path.join(__dirname, 'debug_krs.html');
            fs.writeFileSync(debugFile, response.data, 'utf8');
            // console.log('📄 KRS HTML disimpan ke:', debugFile);
            // console.log('📄 KRS HTML length:', response.data.length);

            const $ = cheerio.load(response.data);
            
            // Ambil NPM dari hidden input
            let npm = $('input[name="npm"]').val() || '';
            // console.log('📋 NPM:', npm);
            
            // Parse tabel KRS
            // Struktur: 12 kolom - No, Hari, Aksi, Mata Kuliah(3), Dosen, Jam Mulai, Kelas, Mode Kuliah, Ruangan, Sks(9), Semester, Nilai(11)
            const courses = [];
            
            // Cari semua rows dalam tabel (table.display atau DataTables_Table_0)
            $('table.display tbody tr, table.dataTable tbody tr').each((i, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 12) {
                    const mataKuliah = $(cells[3]).text().trim();  // Kolom 4: Mata Kuliah
                    const sks = $(cells[9]).text().trim();         // Kolom 10: SKS
                    const nilai = $(cells[11]).text().trim();       // Kolom 12: Nilai
                    
                    // Skip rows kosong atau header
                    if (mataKuliah && mataKuliah.length > 0 && !mataKuliah.toLowerCase().includes('mata kuliah')) {
                        courses.push({
                            nama: mataKuliah,
                            sks: parseInt(sks) || 0,
                            nilai: nilai || '-'
                        });
                    }
                }
            });

            // console.log(`📚 Found ${courses.length} courses for semester ${semester}`);
            
            // Debug: tampilkan courses
            if (courses.length > 0) {
                // console.log('📚 Courses:', courses);
            }
            
            // Hitung total SKS
            const totalSks = courses.reduce((sum, c) => sum + c.sks, 0);
            
            return {
                success: true,
                semester: semester,
                npm: npm,
                totalSks: totalSks,
                courses: courses
            };

        } catch (error) {
            console.error('KRS error:', error.message);
            return {
                success: false,
                message: 'Gagal mengambil data KRS: ' + error.message
            };
        }
    }

    /**
     * Mengambil PDF KRS untuk semester tertentu
     * 1. Fetch halaman KRS untuk dapat link cetak
     * 2. Fetch PDF dari link tersebut
     */
    async getKRSPdf(cookies, semester) {
        try {
            const client = this.createClient();
            
            // Step 1: Fetch halaman KRS untuk mendapatkan link cetak
            const url = `/krss{ta?ta=${semester}`;
            // console.log(`📥 Fetching KRS page for print link: ${url}`);
            
            const response = await client.get(url, {
                headers: {
                    'Cookie': cookies,
                    'Referer': config.SIKAMU_URL + '/dashboardMhs',
                }
            });
            
            const $ = cheerio.load(response.data);
            
            // Cari link "Cetak Krs" - biasanya di <a href="/krs-printst/xxx">
            let printUrl = null;
            $('a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().toLowerCase();
                if (text.includes('cetak') && href.includes('print')) {
                    printUrl = href;
                }
            });
            
            if (!printUrl) {
                // console.log('⚠️ Print link not found, trying alternative pattern');
                // Fallback: cari pattern krs-printst
                $('a[href*="krs-print"]').each((i, el) => {
                    printUrl = $(el).attr('href');
                });
            }
            
            if (!printUrl) {
                return {
                    success: false,
                    message: 'Link cetak KRS tidak ditemukan'
                };
            }
            
            // console.log(`📄 Found print URL: ${printUrl}`);
            
            // Step 2: Download PDF
            const fullPrintUrl = printUrl.startsWith('/') ? printUrl : '/' + printUrl;
            // console.log(`📥 Downloading PDF from: ${fullPrintUrl}`);
            
            const pdfResponse = await client.get(fullPrintUrl, {
                headers: {
                    'Cookie': cookies,
                    'Referer': config.SIKAMU_URL + url,
                },
                responseType: 'arraybuffer'
            });
            
            // console.log(`📄 PDF downloaded, size: ${pdfResponse.data.length} bytes`);
            
            return {
                success: true,
                pdf: Buffer.from(pdfResponse.data),
                filename: `KRS_Semester_${semester}.pdf`
            };
            
        } catch (error) {
            console.error('KRS PDF error:', error.message);
            return {
                success: false,
                message: 'Gagal mengunduh PDF KRS: ' + error.message
            };
        }
    }

    /**
     * Get available tahun akademik for KPU
     */
    async getKpuYears(cookies) {
        try {
            const client = this.createClient();
            const response = await client.get('/KPU-Mahasiswa', {
                headers: {
                    'Cookie': cookies,
                    'Referer': config.SIKAMU_URL,
                }
            });

            const $ = cheerio.load(response.data);
            
            // Parse dropdown tahun akademik
            // Format: value="0#600000#0" text="20232"
            const years = [];
            $('select').first().find('option').each((i, el) => {
                const val = $(el).attr('value');
                const text = $(el).text().trim();
                // Skip placeholder option, use text that matches year pattern
                if (val && text.match(/^\d{5}$/)) {
                    years.push({ 
                        value: val,  // Original value for form submission
                        code: text,  // Year code like "20251"
                        label: text 
                    });
                }
            });
            
            console.log('📋 Found years:', years);
            
            return {
                success: true,
                years: years
            };
        } catch (error) {
            console.error('KPU Years error:', error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get KPU PDF (Kartu Peserta Ujian)
     * @param cookies - session cookies
     * @param tahun - tahun akademik code (e.g., "20251")
     * @param opsi - "UTS" or "UAS"
     */
    async getKpuPdf(cookies, tahun, opsi) {
        try {
            const client = this.createClient();
            
            // Step 1: Get CSRF token from KPU page
            console.log('📋 Getting CSRF token from /KPU-Mahasiswa');
            const kpuPage = await client.get('/KPU-Mahasiswa', {
                headers: {
                    'Cookie': cookies,
                    'Referer': config.SIKAMU_URL,
                },
            });
            
            const $ = cheerio.load(kpuPage.data);
            const csrfToken = $('input[name="_token"]').first().val();
            console.log('🔑 CSRF Token:', csrfToken ? csrfToken.substring(0, 20) + '...' : 'NOT FOUND');
            
            if (!csrfToken) {
                return { success: false, message: 'CSRF token tidak ditemukan' };
            }
            
            // Get new cookies
            let allCookies = cookies;
            if (kpuPage.headers['set-cookie']) {
                const newCookies = kpuPage.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
                allCookies = cookies + '; ' + newCookies;
            }
            
            // Step 2: POST form to /students-card-test
            console.log('📤 Posting form to /students-card-test');
            const formData = new URLSearchParams();
            formData.append('_token', csrfToken);
            formData.append('idTahunAkademik', tahun);  // Year code like "20251"
            formData.append('options', opsi);  // "UTS" or "UAS"
            
            const pdfResponse = await client.post('/students-card-test', formData, {
                headers: {
                    'Cookie': allCookies,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': config.SIKAMU_URL + '/KPU-Mahasiswa',
                },
                responseType: 'arraybuffer',
                maxRedirects: 5,
            });
            
            // Check response
            const contentType = pdfResponse.headers['content-type'] || '';
            console.log('📄 Response:', contentType, 'Size:', pdfResponse.data.length);
            
            if (pdfResponse.data.length > 5000) {
                return {
                    success: true,
                    pdf: Buffer.from(pdfResponse.data),
                    filename: `KPU_${opsi}_${tahun}.pdf`
                };
            }
            
            return {
                success: false,
                message: 'PDF tidak ditemukan atau data kosong'
            };
            
        } catch (error) {
            console.error('KPU PDF error:', error.message);
            return {
                success: false,
                message: 'Gagal mengunduh KPU: ' + error.message
            };
        }
    }

    /**
     * Simpan session user
     */
    saveSession(telegramUserId, data) {
        this.sessions.set(telegramUserId, {
            ...data,
            timestamp: Date.now()
        });
        this.saveSessionsToFile();
    }

    /**
     * Ambil session user
     */
    getSession(telegramUserId) {
        const session = this.sessions.get(telegramUserId);
        if (session) {
            // Cek apakah session masih valid
            if (Date.now() - session.timestamp < config.SESSION_TIMEOUT) {
                return session;
            } else {
                // Jangan hapus langsung dari file di sini untuk performa, 
                // biarkan bersih saat load atau delete eksplisit. 
                // Tapi untuk keamanan, hapus dari memory.
                this.sessions.delete(telegramUserId);
                // this.saveSessionsToFile(); // Opsional: update file jika ingin clean
            }
        }
        return null;
    }

    /**
     * Hapus session user
     */
    deleteSession(telegramUserId) {
        this.sessions.delete(telegramUserId);
        this.saveSessionsToFile();
    }

    /**
     * Ambil data profil dari halaman /account
     * Parsed: NPM, Email, Nama, Prodi, Foto
     */
    async getAccount(cookies) {
        try {
            const client = this.createClient();
            const response = await client.get('/account', {
                headers: {
                    'Cookie': cookies,
                    'Referer': config.SIKAMU_URL,
                }
            });

            const $ = cheerio.load(response.data);
            
            // Debug: simpan HTML account untuk analisis jika perlu
            // const fs = require('fs');
            // const path = require('path');
            // fs.writeFileSync(path.join(__dirname, 'debug_account.html'), response.data);
            
            // 1. Parse NPM
            let npm = '';
            // Pola: "@ 2455201049" atau di dalam teks
            $('div, span, p').each((i, el) => {
                const text = $(el).text().trim();
                if (text.match(/^@?\s*\d{10}$/)) {
                    npm = text.replace('@', '').trim();
                }
            });
            if (!npm) {
                const bodyText = $('body').text();
                const npmMatch = bodyText.match(/(\d{10})/);
                if (npmMatch) npm = npmMatch[1];
            }
            
            // 2. Parse Email (dari input value)
            let email = '';
            $('input[name="email"]').each((i, el) => {
                const val = $(el).val();
                if (val && val.includes('@')) email = val;
            });
            
            // 3. Parse Prodi
            // Biasanya di bawah nama. Cari elemen yg mengandung kata "Teknik" atau "Prodi" atau di dalam card profile
            let prodi = '';
            // Coba cari text yang umum untuk prodi
            const prodiKeywords = ['Teknik', 'Manajemen', 'Akuntansi', 'Hukum', 'Pendidikan', 'Agroteknologi', 'Komunikasi'];
            $('div, p, span').each((i, el) => {
                const text = $(el).text().trim();
                // Jika match salah satu keyword prodi dan panjangnya masuk akal (bukan paragraf panjang)
                if (prodiKeywords.some(k => text.includes(k)) && text.length < 50 && text.length > 5) {
                    // Hindari mengambil elemen menu/navigasi
                    if (!$(el).parents('nav').length && !$(el).parents('.menu').length) {
                        prodi = text;
                        return false; // break loop
                    }
                }
            });
            
            // 4. Parse Foto Profil
            let photoUrl = '';
            // Cari img di area konten utama, bukan logo navbar
            $('img').each((i, el) => {
                const src = $(el).attr('src');
                if (src && !src.includes('umb_new.png') && !src.includes('logo') && !src.includes('favicon')) {
                    // Biasanya foto profil ada di 'storage/photos' atau 'images/profile'
                    // Atau ambil gambar pertama yang di dalam container profile
                    if (src.includes('storage') || src.includes('photos') || $(el).attr('class')?.includes('rounded')) {
                        photoUrl = src;
                        return false; // Ambil yang pertama ketemu
                    }
                }
            });
            
            // Fix relative URL
            if (photoUrl && !photoUrl.startsWith('http')) {
                photoUrl = config.SIKAMU_URL + (photoUrl.startsWith('/') ? '' : '/') + photoUrl;
            }

            console.log('👤 Account Parsed:', { npm, email, prodi, photoUrl });
            
            return {
                success: true,
                npm: npm,
                email: email,
                prodi: prodi,
                photoUrl: photoUrl
            };
        } catch (error) {
            console.error('Account fetch error:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = new SikamuAPI();
