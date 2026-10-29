import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const crmNewDir = path.join(rootDir, 'crm new');
const publicDir = path.join(rootDir, 'public');

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    console.log('[Build] Preparing public static assets for Vercel and local environments...');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    // 1. Copy CRM index.html to both public/index.html and public/crm/index.html
    const crmHtml = path.join(crmNewDir, 'crm', 'index.html');
    if (fs.existsSync(crmHtml)) {
        fs.copyFileSync(crmHtml, path.join(publicDir, 'index.html'));
        const publicCrmDir = path.join(publicDir, 'crm');
        if (!fs.existsSync(publicCrmDir)) fs.mkdirSync(publicCrmDir, { recursive: true });
        fs.copyFileSync(crmHtml, path.join(publicCrmDir, 'index.html'));
    }

    // 2. Copy css, js, pages directories
    copyDirRecursive(path.join(crmNewDir, 'css'), path.join(publicDir, 'css'));
    copyDirRecursive(path.join(crmNewDir, 'js'), path.join(publicDir, 'js'));
    copyDirRecursive(path.join(crmNewDir, 'pages'), path.join(publicDir, 'pages'));

    // Also copy to public/crm/ for /crm/* path support
    copyDirRecursive(path.join(crmNewDir, 'css'), path.join(publicDir, 'crm', 'css'));
    copyDirRecursive(path.join(crmNewDir, 'js'), path.join(publicDir, 'crm', 'js'));
    copyDirRecursive(path.join(crmNewDir, 'pages'), path.join(publicDir, 'crm', 'pages'));

    // 3. Copy SVG icons
    const svgFiles = fs.readdirSync(rootDir).filter(f => f.startsWith('loanitol') && f.endsWith('.svg'));
    for (const svg of svgFiles) {
        fs.copyFileSync(path.join(rootDir, svg), path.join(publicDir, svg));
        fs.copyFileSync(path.join(rootDir, svg), path.join(publicDir, 'crm', svg));
    }

    console.log('[Build] Successfully generated public assets directory.');
} catch (e) {
    console.warn('[Build] Warning generating public directory:', e.message);
}
