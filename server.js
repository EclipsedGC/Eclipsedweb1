import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

app.get('/api/applicants', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'applicants.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ applicants: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/guilds', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'guilds.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ guilds: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blogs', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'blogs.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ blogs: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  try {
    const status = {
      applicants: existsSync(join(DATA_DIR, 'applicants.json')),
      guilds: existsSync(join(DATA_DIR, 'guilds.json')),
      blogs: existsSync(join(DATA_DIR, 'blogs.json'))
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

