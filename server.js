import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve directories reliably in both standard Node and Vercel serverless runtime
function resolveDirectory(candidatePaths) {
    for (const p of candidatePaths) {
        if (p && fs.existsSync(p)) return p;
    }
    return candidatePaths[0];
}

const crmNewDir = resolveDirectory([
    path.join(__dirname, 'crm new'),
    path.join(process.cwd(), 'crm new'),
    path.join(process.cwd(), 'public'),
    path.join(__dirname, 'public')
]);

const publicDir = resolveDirectory([
    path.join(process.cwd(), 'public'),
    path.join(__dirname, 'public'),
    crmNewDir
]);

// On serverless environments like Vercel, the local filesystem is read-only except /tmp
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const dataDir = isServerless ? path.join('/tmp', 'data') : path.join(__dirname, 'data');

try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    // Seed initial JSON files from repository into /tmp if running serverless
    if (isServerless) {
        const repoDataDir = path.join(__dirname, 'data');
        if (fs.existsSync(repoDataDir)) {
            const files = ['users.json', 'crm_state.json', 'brand_settings.json'];
            for (const file of files) {
                const src = path.join(repoDataDir, file);
                const dest = path.join(dataDir, file);
                if (fs.existsSync(src) && !fs.existsSync(dest)) {
                    fs.copyFileSync(src, dest);
                }
            }
        }
    }
} catch (e) {
    console.warn('Filesystem init warning:', e.message);
}

const USERS_FILE = path.join(dataDir, 'users.json');
const STATE_FILE = path.join(dataDir, 'crm_state.json');
const BRAND_FILE = path.join(dataDir, 'brand_settings.json');

app.use(express.json({ limit: '50mb' }));

// Supabase integration connected with user credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lnwqemrkdhtrqccfdkzg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxud3FlbXJrZGh0cnFjY2Zka3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTE1NjUsImV4cCI6MjEwODY2NzU2NX0.bilzvRSfKMzJvPQaUfhCzbeeThIv98vL3wFPfbneHA8';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_S_BBDOZGZBdHNQdD6mkiZQ_m2QMEh8x';
const SUPABASE_CLIENT_KEY = SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY;

app.get('/api/supabase/config', (req, res) => {
    res.json({
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        publishableKey: SUPABASE_PUBLISHABLE_KEY,
        connected: Boolean(SUPABASE_URL && SUPABASE_CLIENT_KEY),
        disconnected: !SUPABASE_URL || !SUPABASE_CLIENT_KEY
    });
});

// Logging requests to make developer flow highly transparent
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// API Routes for branding & logo settings
app.get('/api/branding', (req, res) => {
    try {
        if (fs.existsSync(BRAND_FILE)) {
            const data = fs.readFileSync(BRAND_FILE, 'utf8');
            return res.json({ success: true, branding: JSON.parse(data) });
        }
        return res.json({ success: true, branding: null });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/branding', (req, res) => {
    try {
        const { branding } = req.body;
        if (branding && typeof branding === 'object') {
            try { fs.writeFileSync(BRAND_FILE, JSON.stringify(branding, null, 2), 'utf8'); } catch (err) {}
            return res.json({ success: true, timestamp: Date.now() });
        }
        return res.status(400).json({ success: false, error: 'invalid branding object' });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// API Routes for shared user and CRM state persistence across all employee devices
app.get('/api/users', (req, res) => {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return res.json({ success: true, users: JSON.parse(data) });
        }
        return res.json({ success: true, users: null });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/users', (req, res) => {
    try {
        const { users } = req.body;
        if (Array.isArray(users)) {
            try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8'); } catch (err) {}
            return res.json({ success: true, count: users.length, timestamp: Date.now() });
        }
        return res.status(400).json({ success: false, error: 'users must be an array' });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// Endpoint to automatically create a user in Supabase Auth & persist in Supabase DB
app.post('/api/auth/create-user', async (req, res) => {
    try {
        const { email, password, userId, displayName, role, department, designation, permissions, phone } = req.body;
        if (!email || !password || !userId) {
            return res.status(400).json({ success: false, error: 'Email, password, and userId are required' });
        }

        const sbClient = createClient(SUPABASE_URL, SUPABASE_CLIENT_KEY);
        let authUserId = `AUTH_${userId}`;

        try {
            const { data: authData, error: authErr } = await sbClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        displayName: displayName || userId,
                        userId,
                        role: role || 'cso',
                        department: department || 'general',
                        designation: designation || 'Loan Officer'
                    }
                }
            });

            if (authData?.user) {
                authUserId = authData.user.id;
            } else if (authErr) {
                console.warn('[Server Supabase Auth] SignUp notice:', authErr.message);
            }
        } catch (authException) {
            console.warn('[Server Supabase Auth] Exception during signup:', authException.message);
        }

        const userRecord = {
            userId,
            authUserId,
            displayName: displayName || userId,
            email,
            phone: phone || '',
            role: role || 'cso',
            designation: designation || 'Loan Officer',
            department: department || 'msme',
            status: 'active',
            permissions: permissions || {},
            createdAt: new Date().toISOString(),
            lastLoginAt: null
        };

        // Persist to Supabase users table without plaintext password
        try {
            await sbClient.from('users').upsert({
                id: userId,
                data: userRecord,
                updated_at: new Date().toISOString()
            });
        } catch (dbErr) {
            console.warn('[Server Supabase] DB upsert notice:', dbErr.message);
        }

        // Persist to local JSON file
        try {
            let currentUsers = [];
            if (fs.existsSync(USERS_FILE)) {
                try { currentUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) {}
            }
            if (!Array.isArray(currentUsers)) currentUsers = [];
            const idx = currentUsers.findIndex(u => u.userId === userId);
            if (idx >= 0) currentUsers[idx] = userRecord;
            else currentUsers.push(userRecord);
            fs.writeFileSync(USERS_FILE, JSON.stringify(currentUsers, null, 2), 'utf8');
        } catch (fErr) {}

        return res.json({ success: true, user: userRecord });
    } catch (err) {
        console.error('Error in /api/auth/create-user:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/state', (req, res) => {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            return res.json({ success: true, state: JSON.parse(data) });
        }
        return res.json({ success: true, state: null });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/state', (req, res) => {
    try {
        const { state } = req.body;
        if (state && typeof state === 'object') {
            try { fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8'); } catch (err) {}
            return res.json({ success: true, timestamp: Date.now() });
        }
        return res.status(400).json({ success: false, error: 'invalid state object' });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// Default handler for main app loading
const serveIndex = (req, res) => {
    const candidatePaths = [
        path.join(publicDir, 'index.html'),
        path.join(crmNewDir, 'crm', 'index.html'),
        path.join(crmNewDir, 'index.html'),
        path.join(process.cwd(), 'crm new', 'crm', 'index.html'),
        path.join(process.cwd(), 'public', 'index.html')
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            return res.sendFile(p);
        }
    }
    return res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="1"></head><body>Loading Loanitol CRM...</body></html>');
};

app.get('/', serveIndex);
app.get('/index.html', serveIndex);
app.get('/crm', serveIndex);
app.get('/crm/', serveIndex);
app.get('/crm/index.html', serveIndex);

// Serve css, js, and pages directories relative to root to resolve "../css" or "../js" relative paths gracefully
if (fs.existsSync(path.join(publicDir, 'css'))) {
    app.use('/css', express.static(path.join(publicDir, 'css')));
}
if (fs.existsSync(path.join(crmNewDir, 'css'))) {
    app.use('/css', express.static(path.join(crmNewDir, 'css')));
}

if (fs.existsSync(path.join(publicDir, 'js'))) {
    app.use('/js', express.static(path.join(publicDir, 'js')));
}
if (fs.existsSync(path.join(crmNewDir, 'js'))) {
    app.use('/js', express.static(path.join(crmNewDir, 'js')));
}

if (fs.existsSync(path.join(publicDir, 'pages'))) {
    app.use('/pages', express.static(path.join(publicDir, 'pages')));
}
if (fs.existsSync(path.join(crmNewDir, 'pages'))) {
    app.use('/pages', express.static(path.join(crmNewDir, 'pages')));
}

// Support prefixed /crm/ paths
if (fs.existsSync(path.join(publicDir, 'crm', 'css'))) {
    app.use('/crm/css', express.static(path.join(publicDir, 'crm', 'css')));
} else if (fs.existsSync(path.join(crmNewDir, 'css'))) {
    app.use('/crm/css', express.static(path.join(crmNewDir, 'css')));
}

if (fs.existsSync(path.join(publicDir, 'crm', 'js'))) {
    app.use('/crm/js', express.static(path.join(publicDir, 'crm', 'js')));
} else if (fs.existsSync(path.join(crmNewDir, 'js'))) {
    app.use('/crm/js', express.static(path.join(crmNewDir, 'js')));
}

if (fs.existsSync(path.join(publicDir, 'crm', 'pages'))) {
    app.use('/crm/pages', express.static(path.join(publicDir, 'crm', 'pages')));
} else if (fs.existsSync(path.join(crmNewDir, 'pages'))) {
    app.use('/crm/pages', express.static(path.join(crmNewDir, 'pages')));
}

// Serve physical static directories
app.use(express.static(publicDir));
app.use(express.static(crmNewDir));

// Warm-up and healthcheck support
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// Start listening only in non-serverless environments (like local Node and AI Studio dev server)
if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server started successfully on port ${PORT}`);
    });
}

export default app;
