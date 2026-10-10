const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || 'D7U-change-moi-2026';

const FRONTEND_ORIGIN = 'https://do7u.onrender.com';

if (!fs.existsSync(DATA)) {
  fs.mkdirSync(DATA, { recursive: true });
}

const dbFile = path.join(DATA, 'content.json');

if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(
    dbFile,
    JSON.stringify({
      activities: [
        {
          id: 1,
          title: 'Journée de solidarité',
          category: 'Communauté',
          date: '2026-08-12',
          image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1000&q=80',
          description: 'Un moment de partage et d’entraide pour renforcer les liens entre les membres et soutenir notre communauté.'
        },
        {
          id: 2,
          title: 'Préparation de notre projet agricole',
          category: 'Nos projets',
          date: '2026-07-05',
          image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80',
          description: 'Nous étudions des activités génératrices de revenus pour faire grandir progressivement le capital du groupe.'
        },
        {
          id: 3,
          title: 'Réunion de planification',
          category: 'Réunion',
          date: '2026-06-22',
          image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=80',
          description: 'Les membres échangent des idées et organisent les prochaines étapes de notre vision commune.'
        }
      ],
      projects: [
        {
          id: 101,
          title: 'Agriculture moderne',
          category: 'Agriculture',
          image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80',
          description: 'Production et transformation de produits agricoles.'
        },
        {
          id: 102,
          title: 'Commerce',
          category: 'Commerce',
          image: 'https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=900&q=80',
          description: 'Développer des activités commerciales au bénéfice des membres.'
        },
        {
          id: 103,
          title: 'Immobilier',
          category: 'Investissement',
          image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
          description: 'Préparer des investissements durables et collectifs.'
        },
        {
          id: 104,
          title: 'Technologie et communication',
          category: 'Innovation',
          image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
          description: 'Utiliser le numérique pour valoriser les activités du groupe.'
        }
      ]
    }, null, 2)
  );
}

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch {
    return { activities: [], projects: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

const sessions = new Map();

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });

  res.end(
    type.startsWith('application/json')
      ? JSON.stringify(body)
      : body
  );
}

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin === FRONTEND_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 2e6) {
        reject(new Error('Contenu trop volumineux'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON invalide'));
      }
    });

    req.on('error', reject);
  });
}

function tokenFrom(req) {
  const match = (req.headers.cookie || '')
    .match(/(?:^|;\s*)d7u_session=([^;]+)/);

  return match ? decodeURIComponent(match[1]) : '';
}

function authorized(req) {
  const token = tokenFrom(req);
  return !!token && sessions.has(token);
}

function clean(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  const url = new URL(req.url, 'http://localhost');

  // Autoriser les requêtes préliminaires du navigateur.
  if (req.method === 'OPTIONS') {
    if (req.headers.origin !== FRONTEND_ORIGIN) {
      return send(res, 403, { error: 'Origine non autorisée.' });
    }

    res.writeHead(204);
    return res.end();
  }

  // Lire les activités et les projets.
  if (req.method === 'GET' && url.pathname === '/api/content') {
    return send(res, 200, readDB());
  }

  // Connexion administrateur.
  if (req.method === 'POST' && url.pathname === '/api/login') {
    try {
      const body = await readBody(req);

      if (
        clean(body.username, 80) !== ADMIN_USER ||
        clean(body.password, 200) !== ADMIN_PASSWORD
      ) {
        return send(res, 401, {
          error: 'Identifiants incorrects.'
        });
      }

      const token = crypto.randomBytes(32).toString('hex');

      sessions.set(token, {
        created: Date.now()
      });

      res.setHeader(
        'Set-Cookie',
        `d7u_session=${token}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=28800`
      );

      return send(res, 200, { ok: true });
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
  }

  // Déconnexion.
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const token = tokenFrom(req);

    sessions.delete(token);

    res.setHeader(
      'Set-Cookie',
      'd7u_session=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0'
    );

    return send(res, 200, { ok: true });
  }

  // Routes d'administration protégées.
  if (url.pathname.startsWith('/api/admin/')) {
    if (!authorized(req)) {
      return send(res, 401, {
        error: 'Connexion administrateur requise.'
      });
    }

    // Vérifier la session.
    if (
      req.method === 'GET' &&
      url.pathname === '/api/admin/check'
    ) {
      return send(res, 200, { ok: true });
    }

    // Ajouter ou modifier un contenu.
    if (
      req.method === 'POST' &&
      url.pathname === '/api/admin/save'
    ) {
      try {
        const body = await readBody(req);
        const db = readDB();

        const kind =
          body.kind === 'projects' ? 'projects' : 'activities';

        const item = {
          title: clean(body.title, 140),
          category: clean(body.category, 80),
          description: clean(body.description, 3000),
          image: clean(body.image, 1000)
        };

        if (!item.title || !item.description) {
          return send(res, 400, {
            error: 'Le titre et la description sont obligatoires.'
          });
        }

        if (kind === 'activities') {
          item.date =
            clean(body.date, 20) ||
            new Date().toISOString().slice(0, 10);
        }

        const id = Number(body.id);

        if (id) {
          const index = db[kind].findIndex(
            entry => entry.id === id
          );

          if (index < 0) {
            return send(res, 404, {
              error: 'Publication introuvable.'
            });
          }

          db[kind][index] = {
            ...db[kind][index],
            ...item
          };
        } else {
          item.id = Date.now();
          db[kind].unshift(item);
        }

        writeDB(db);

        return send(res, 200, {
          ok: true,
          content: db
        });
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
    }

    // Supprimer un contenu.
    if (
      req.method === 'POST' &&
      url.pathname === '/api/admin/delete'
    ) {
      try {
        const body = await readBody(req);
        const kind =
          body.kind === 'projects' ? 'projects' : 'activities';

        const db = readDB();

        db[kind] = db[kind].filter(
          item => item.id !== Number(body.id)
        );

        writeDB(db);

        return send(res, 200, {
          ok: true,
          content: db
        });
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
    }

    return send(res, 404, {
      error: 'Route admin introuvable.'
    });
  }

  // Servir les fichiers publics éventuellement présents.
  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, { error: 'Adresse invalide.' });
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const file = path.resolve(PUBLIC, '.' + pathname);

  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) {
    return send(res, 403, { error: 'Interdit.' });
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      return send(res, 404, 'Page introuvable', 'text/plain; charset=utf-8');
    }

    const extension = path.extname(file);

    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.webp': 'image/webp'
    };

    return send(
      res,
      200,
      data.toString(),
      types[extension] || 'application/octet-stream'
    );
  });
});

server.listen(PORT, () => {
  console.log(`D7U backend démarré sur le port ${PORT}`);
});
