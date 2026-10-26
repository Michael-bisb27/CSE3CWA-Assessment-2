const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/smartfarm.db');
const db = new Database(dbPath);

// Create crops table using the authoritative schema from SPEC.md Section 17
db.exec(`
  CREATE TABLE IF NOT EXISTS crops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_name TEXT NOT NULL UNIQUE
      CHECK (crop_name IN ('Tomato','Lettuce','Wheat','Maize')),
    location TEXT NOT NULL,
    target_min REAL NOT NULL CHECK (target_min >= 0 AND target_min <= 100),
    target_max REAL NOT NULL CHECK (target_max >= 0 AND target_max <= 100),
    normal_water REAL NOT NULL CHECK (normal_water > 0 AND normal_water <= 10000),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (target_min < target_max)
  );
`);

// Seed initial cards only when table is empty (Maize is unseeded for marker testing)
const countRow = db.prepare('SELECT COUNT(*) AS count FROM crops').get();
if (countRow.count === 0) {
  const insertSeed = db.prepare(`
    INSERT INTO crops (crop_name, location, target_min, target_max, normal_water, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertSeed.run('Tomato', 'Greenhouse A', 55, 75, 500, '');
  insertSeed.run('Lettuce', 'Greenhouse B', 60, 80, 400, '');
  insertSeed.run('Wheat', 'North Field', 35, 55, 300, '');
}

function getAllCrops() {
  return db.prepare('SELECT * FROM crops ORDER BY id ASC').all();
}

function getCropById(id) {
  return db.prepare('SELECT * FROM crops WHERE id = ?').get(id) || null;
}

function getCropByName(cropName) {
  return db.prepare('SELECT * FROM crops WHERE crop_name = ?').get(cropName) || null;
}

function createCrop(cropData) {
  const stmt = db.prepare(`
    INSERT INTO crops (crop_name, location, target_min, target_max, normal_water, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    cropData.crop_name,
    cropData.location,
    cropData.target_min,
    cropData.target_max,
    cropData.normal_water,
    cropData.notes || ''
  );
  return getCropById(result.lastInsertRowid);
}

function updateCrop(id, cropData) {
  const stmt = db.prepare(`
    UPDATE crops
    SET location = ?, target_min = ?, target_max = ?, normal_water = ?, notes = ?
    WHERE id = ?
  `);
  stmt.run(
    cropData.location,
    cropData.target_min,
    cropData.target_max,
    cropData.normal_water,
    cropData.notes || '',
    id
  );
  return getCropById(id);
}

function deleteCrop(id) {
  const stmt = db.prepare('DELETE FROM crops WHERE id = ?');
  stmt.run(id);
}

module.exports = {
  db,
  getAllCrops,
  getCropById,
  getCropByName,
  createCrop,
  updateCrop,
  deleteCrop
};
